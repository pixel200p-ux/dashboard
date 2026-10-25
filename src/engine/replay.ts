import { replayBank } from "./bank";
import { todayYmd } from "./dates";
import { num, roundTo4 } from "./money";
import type {
  Asset,
  CapitalBucket,
  CapitalMovement,
  CorporateAction,
  FeeSetting,
  HoldingView,
  LedgerSnapshot,
  OpenTplusLot,
  PortfolioState,
  TplusCard,
  TplusCycleRecord,
  Transaction,
} from "./types";
import { CAPITAL_BUCKETS } from "./types";

const CASH_DIVIDEND_NET_FACTOR = 0.95;

function netCashDividend(gross: number, declaredTax: number): number {
  const tax = declaredTax > 0 ? declaredTax : gross * (1 - CASH_DIVIDEND_NET_FACTOR);
  return Math.max(0, gross - tax);
}

interface Pos {
  asset: Asset;
  accountId: string;
  accountName: string;
  accountKind: HoldingView["accountKind"];
  coreQty: number;
  coreCostTotal: number;
  coreCostVndTotal: number;
  coreOriginalCostVndTotal: number;
  tplusReduction: number;
  tplusReductionVnd: number;
  realizedTradePnl: number;
  cashDividend: number;
  stockDividendQty: number;
  totalInvested: number;
  coreCostLots: { buyTxId: string; quantity: number; adjustedCost: number }[];
  openLots: OpenTplusLot[];
  cycles: TplusCycleRecord[];
}

function feeProfileFor(kind: string): FeeSetting["profile"] | null {
  if (kind === "STOCK_VPS") return "STOCK_VPS";
  if (kind === "STOCK_SSI") return "STOCK_SSI";
  if (kind === "CRYPTO") return "CRYPTO";
  if (kind === "DCDS") return "DCDS";
  if (kind === "ETF") return "ETF";
  return null;
}

function sellRates(
  fees: FeeSetting[],
  kind: string,
): { feePct: number; taxPct: number } {
  const p = feeProfileFor(kind);
  const row = fees.find((f) => f.profile === p);
  return { feePct: row?.sellFeePct ?? 0, taxPct: row?.sellTaxPct ?? 0 };
}

function adjustedAvg(p: Pos): number {
  if (p.coreQty <= 0) return 0;
  return Math.max(0, p.coreCostTotal - p.tplusReduction) / p.coreQty;
}

function originalAvg(p: Pos): number {
  if (p.coreQty <= 0) return 0;
  return Math.max(0, p.coreCostTotal) / p.coreQty;
}

function syncCoreLotCosts(p: Pos): void {
  const targetCost = Math.max(0, p.coreCostTotal - p.tplusReduction);
  const currentCost = p.coreCostLots.reduce(
    (sum, lot) => sum + lot.adjustedCost,
    0,
  );
  if (currentCost > 0) {
    const ratio = targetCost / currentCost;
    for (const lot of p.coreCostLots) lot.adjustedCost *= ratio;
  } else if (targetCost > 0) {
    const totalQty = p.coreCostLots.reduce((sum, lot) => sum + lot.quantity, 0);
    if (totalQty > 0) {
      for (const lot of p.coreCostLots) {
        lot.adjustedCost = (targetCost * lot.quantity) / totalQty;
      }
    }
  }
}

function openQty(p: Pos): number {
  return p.openLots.reduce((s, l) => s + l.qtyRemaining, 0);
}

function openCost(p: Pos): number {
  return p.openLots.reduce((s, l) => {
    const feeShare =
      l.qtyOriginal > 0 ? (l.buyFee * l.qtyRemaining) / l.qtyOriginal : 0;
    return s + l.qtyRemaining * l.buyPrice + feeShare;
  }, 0);
}

function cryptoGross(
  buyPrice: number,
  buyFx: number,
  sellPrice: number,
  sellFx: number,
  qty: number,
): number {
  return sellPrice * sellFx * qty - buyPrice * buyFx * qty;
}

function ensurePos(
  map: Map<string, Pos>,
  asset: Asset,
  accounts: LedgerSnapshot["accounts"],
): Pos {
  let p = map.get(asset.id);
  if (p) return p;
  const acc = accounts.find((a) => a.id === asset.accountId);
  p = {
    asset,
    accountId: asset.accountId,
    accountName: acc?.name ?? asset.accountId,
    accountKind: (acc?.kind ?? "STOCK_VPS") as Pos["accountKind"],
    coreQty: 0,
    coreCostTotal: 0,
    coreCostVndTotal: 0,
    coreOriginalCostVndTotal: 0,
    tplusReduction: 0,
    tplusReductionVnd: 0,
    realizedTradePnl: 0,
    cashDividend: 0,
    stockDividendQty: 0,
    totalInvested: 0,
    coreCostLots: [],
    openLots: [],
    cycles: [],
  };
  map.set(asset.id, p);
  return p;
}

function applyCorporateAction(
  action: CorporateAction,
  positions: Map<string, Pos>,
): void {
  for (const p of positions.values()) {
    if (p.asset.assetType !== "STOCK" || p.asset.symbol !== action.symbol) continue;
    if (action.actionType === "RIGHTS_ISSUE") {
      const subscribedQty =
        p.accountId === "vps"
          ? action.vpsSubscribedQty
          : p.accountId === "ssi"
            ? action.ssiSubscribedQty
            : 0;
      const subscriptionPrice = action.subscriptionPrice ?? 0;
      if (subscribedQty <= 0 || subscriptionPrice <= 0) continue;
      const subscriptionCost = subscribedQty * subscriptionPrice;
      p.coreQty += subscribedQty;
      p.coreCostTotal += subscriptionCost;
      p.coreCostVndTotal += subscriptionCost;
      p.coreOriginalCostVndTotal += subscriptionCost;
      p.totalInvested += subscriptionCost;
      p.coreCostLots.push({
        buyTxId: `rights:${action.id}:${p.accountId}`,
        quantity: subscribedQty,
        adjustedCost: subscriptionCost,
      });
      syncCoreLotCosts(p);
      continue;
    }
    const eligibleQty = p.coreQty + openQty(p);
    if (eligibleQty <= 1e-12) continue;

    if (action.actionType === "CASH_DIVIDEND") {
      const grossCashPerShare = 10_000 * (action.distributionPct / 100);
      const netCashPerShare = grossCashPerShare * CASH_DIVIDEND_NET_FACTOR;
      p.cashDividend += eligibleQty * grossCashPerShare;
      let coreCostReduction = 0;
      for (const lot of p.coreCostLots) {
        if (lot.quantity <= 1e-12) continue;
        const reduction = Math.min(
          lot.adjustedCost,
          netCashPerShare * lot.quantity,
        );
        lot.adjustedCost -= reduction;
        coreCostReduction += reduction;
      }
      p.coreCostTotal = Math.max(0, p.coreCostTotal - coreCostReduction);
      p.coreCostVndTotal = Math.max(
        0,
        p.coreCostVndTotal - coreCostReduction,
      );
      let dividendProfit = Math.max(
        0,
        p.coreQty * netCashPerShare - coreCostReduction,
      );
      for (const lot of p.openLots) {
        const reduction = Math.min(lot.buyPrice, netCashPerShare);
        dividendProfit +=
          (netCashPerShare - reduction) * lot.qtyRemaining;
        lot.buyPrice -= reduction;
      }
      p.realizedTradePnl += dividendProfit;
      continue;
    }

    const bonusQty = Math.floor(
      eligibleQty * (action.distributionPct / 100) + 1e-9,
    );
    if (bonusQty <= 0) continue;
    const shareFactor = (eligibleQty + bonusQty) / eligibleQty;
    p.coreQty *= shareFactor;
    p.stockDividendQty += bonusQty;
    for (const lot of p.coreCostLots) lot.quantity *= shareFactor;
    for (const lot of p.openLots) {
      lot.qtyRemaining *= shareFactor;
      lot.qtyOriginal *= shareFactor;
      lot.buyPrice /= shareFactor;
    }
  }
}

function sortTx(a: Transaction, b: Transaction): number {
  const d = a.txDate.localeCompare(b.txDate);
  if (d !== 0) return d;
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function accountBucket(
  accountId: string,
  accounts: LedgerSnapshot["accounts"],
): CapitalBucket | null {
  const kind = accounts.find((account) => account.id === accountId)?.kind;
  if (kind === "STOCK_VPS") return "VPS";
  if (kind === "STOCK_SSI") return "SSI";
  if (kind === "CRYPTO") return "CRYPTO";
  if (kind === "ETF") return "ETF";
  if (kind === "DCDS") return "DCDS";
  return null;
}

function applyCoreSell(p: Pos, qty: number, netProceedsVnd: number) {
  if (p.coreQty <= 0 || qty <= 0) return;
  const sellQty = Math.min(qty, p.coreQty);
  const frac = sellQty / p.coreQty;
  const costVnd = (p.coreCostVndTotal - p.tplusReductionVnd) * frac;
  p.realizedTradePnl += netProceedsVnd * (sellQty / qty) - costVnd;
  p.coreCostTotal -= p.coreCostTotal * frac;
  p.coreCostVndTotal -= p.coreCostVndTotal * frac;
  p.coreOriginalCostVndTotal -= p.coreOriginalCostVndTotal * frac;
  p.tplusReduction -= p.tplusReduction * frac;
  p.tplusReductionVnd -= p.tplusReductionVnd * frac;
  for (const lot of p.coreCostLots) {
    lot.quantity *= 1 - frac;
    lot.adjustedCost *= 1 - frac;
  }
  p.coreCostLots = p.coreCostLots.filter((lot) => lot.quantity > 1e-12);
  p.coreQty -= sellQty;
}
export function emptyBuckets(): Record<CapitalBucket, number> {
  return { DCDS: 0, ETF: 0, VPS: 0, SSI: 0, CRYPTO: 0, BANK: 0 };
}

/** Original từng ô: nạp cộng, rút trừ, không âm. Original Capital = tổng 6 ô. */
export function replayOriginalByBucket(
  capital: CapitalMovement[],
  asOf = todayYmd(),
): Record<CapitalBucket, number> {
  const o = emptyBuckets();
  const rows = capital
    .filter((c) => !c.deletedAt && c.movementDate <= asOf)
    .slice()
    .sort(
      (a, b) =>
        a.movementDate.localeCompare(b.movementDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  for (const c of rows) {
    if (!(c.bucket in o)) continue;
    if (c.kind === "DEPOSIT") o[c.bucket] += c.amount;
    else o[c.bucket] = Math.max(0, o[c.bucket] - c.amount);
  }
  return o;
}

export function replayOriginalByBucketUsd(
  capital: CapitalMovement[],
  fallbackRate: number,
  asOf = todayYmd(),
): Record<CapitalBucket, number> {
  const original = emptyBuckets();
  const rows = capital
    .filter((c) => !c.deletedAt && c.movementDate <= asOf)
    .slice()
    .sort(
      (a, b) =>
        a.movementDate.localeCompare(b.movementDate) ||
        a.createdAt.localeCompare(b.createdAt) ||
        a.id.localeCompare(b.id),
    );
  for (const c of rows) {
    if (!(c.bucket in original)) continue;
    const amount =
      c.bucket === "CRYPTO" ? c.amount / (c.fxRate ?? fallbackRate) : c.amount;
    if (c.kind === "DEPOSIT") original[c.bucket] += amount;
    else original[c.bucket] = Math.max(0, original[c.bucket] - amount);
  }
  return original;
}
/**
 * Shared Calculation Engine. UI must never compute P&L / holdings itself.
 * Replay is deterministic from the ledger (soft-deleted rows excluded).
 */
export function replayPortfolio(
  ledger: LedgerSnapshot,
  asOf = todayYmd(),
): PortfolioState {
  const originalByBucket = replayOriginalByBucket(ledger.capital, asOf);
  const originalByBucketUsd = replayOriginalByBucketUsd(
    ledger.capital,
    ledger.usdVnd,
    asOf,
  );
  const originalCapital = CAPITAL_BUCKETS.reduce(
    (s, b) => s + originalByBucket[b],
    0,
  );

  const assets = new Map(ledger.assets.map((a) => [a.id, a]));
  const positions = new Map<string, Pos>();
  const cashByBucket = emptyBuckets();
  const corporateActionReceivableByBucket = emptyBuckets();
  const txs = ledger.transactions
    .filter((t) => !t.deletedAt)
    .slice()
    .sort(sortTx);
  const cashDividendActions = ledger.corporateActions.filter(
    (action) =>
      !action.deletedAt &&
      action.actionType === "CASH_DIVIDEND" &&
      action.exDate <= asOf,
  );
  const cashDividendEntitlements = new Map<string, Map<string, number>>();
  const rightsEntitlements = new Map<string, Map<string, number>>();
  const timeline = [
    ...ledger.capital
      .filter(
        (movement) =>
          !movement.deletedAt &&
          movement.bucket !== "BANK" &&
          movement.movementDate <= asOf,
      )
      .map((movement) => ({
        date: movement.movementDate,
        priority: -1,
        createdAt: movement.createdAt,
        id: movement.id,
        capitalMovement: movement,
      })),
    ...ledger.corporateActions
      .filter(
        (action) =>
          !action.deletedAt &&
          (action.actionType === "RIGHTS_ISSUE"
            ? (action.paymentDate ?? action.exDate) <= asOf
            : action.exDate <= asOf),
      )
      .map((action) => ({
        date:
          action.actionType === "RIGHTS_ISSUE"
            ? action.paymentDate ?? action.exDate
            : action.exDate,
        priority: action.actionType === "RIGHTS_ISSUE" ? 1 : 0,
        createdAt: action.createdAt,
        id: action.id,
        action,
      })),
    ...ledger.corporateActions
      .filter(
        (action) =>
          !action.deletedAt &&
          action.actionType === "RIGHTS_ISSUE" &&
          action.exDate <= asOf,
      )
      .map((action) => ({
        date: action.exDate,
        priority: 0,
        createdAt: action.createdAt,
        id: `${action.id}:rights-entitlement`,
        rightsEntitlement: action,
      })),
    ...cashDividendActions
      .filter((action) => (action.paymentDate ?? action.exDate) <= asOf)
      .map((action) => ({
        date: action.paymentDate ?? action.exDate,
        priority: 1,
        createdAt: action.createdAt,
        id: `${action.id}:cash-payment`,
        dividendPayment: action,
      })),
    ...txs
      .filter((tx) => tx.txDate <= asOf)
      .map((tx) => ({
        date: tx.txDate,
        priority: 2,
        createdAt: tx.createdAt,
        id: tx.id,
        transaction: tx,
      })),
  ].sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      a.priority - b.priority ||
      a.createdAt.localeCompare(b.createdAt) ||
      a.id.localeCompare(b.id),
  );
  const matchesBySell = new Map<string, typeof ledger.matches>();
  for (const m of ledger.matches) {
    const list = matchesBySell.get(m.sellTxId) ?? [];
    list.push(m);
    matchesBySell.set(m.sellTxId, list);
  }

  for (const item of timeline) {
    if ("capitalMovement" in item) {
      const movement = item.capitalMovement;
      cashByBucket[movement.bucket] +=
        movement.kind === "DEPOSIT" ? movement.amount : -movement.amount;
      continue;
    }
    if ("dividendPayment" in item) {
      const action = item.dividendPayment;
      const entitlements = cashDividendEntitlements.get(action.id);
      for (const [accountId, amount] of entitlements ?? []) {
        const hasLinkedPayment = txs.some(
          (tx) =>
            tx.txType === "CASH_DIVIDEND" &&
            tx.accountId === accountId &&
            tx.assetId != null &&
            assets.get(tx.assetId)?.symbol === action.symbol &&
            (tx.corporateActionId === action.id ||
              tx.txDate === (action.paymentDate ?? action.exDate)),
        );
        if (hasLinkedPayment) continue;
        const bucket = accountBucket(accountId, ledger.accounts);
        if (!bucket || amount === 0) continue;
        const receivable = Math.min(
          amount,
          corporateActionReceivableByBucket[bucket],
        );
        corporateActionReceivableByBucket[bucket] -= receivable;
        cashByBucket[bucket] += receivable;
      }
      continue;
    }
    if ("rightsEntitlement" in item) {
      const action = item.rightsEntitlement;
      const entitlements = new Map<string, number>();
      const referencePrice = action.referencePrice ?? 0;
      const subscriptionPrice = action.subscriptionPrice ?? 0;
      const ratio = action.distributionPct / 100;
      const theoreticalExPrice =
        referencePrice > 0 && ratio > 0
          ? (referencePrice + ratio * subscriptionPrice) / (1 + ratio)
          : 0;
      const rightValuePerShare = Math.max(
        0,
        theoreticalExPrice - subscriptionPrice,
      );
      for (const position of positions.values()) {
        if (
          position.asset.assetType !== "STOCK" ||
          position.asset.symbol !== action.symbol
        ) {
          continue;
        }
        const subscribedQty =
          position.accountId === "vps"
            ? action.vpsSubscribedQty
            : position.accountId === "ssi"
              ? action.ssiSubscribedQty
              : 0;
        const eligibleQty = position.coreQty + openQty(position);
        const maxEntitlement = Math.floor(
          eligibleQty * ratio + 1e-9,
        );
        const recognizedQty = Math.min(subscribedQty, maxEntitlement);
        const amount = recognizedQty * rightValuePerShare;
        const bucket = accountBucket(position.accountId, ledger.accounts);
        if (!bucket || amount <= 0) continue;
        entitlements.set(
          position.accountId,
          (entitlements.get(position.accountId) ?? 0) + amount,
        );
        corporateActionReceivableByBucket[bucket] += amount;
      }
      rightsEntitlements.set(action.id, entitlements);
      continue;
    }
    if ("action" in item) {
      const action = item.action;
      if (action.actionType === "CASH_DIVIDEND") {
        const entitlement = new Map<string, number>();
        for (const position of positions.values()) {
          if (
            position.asset.assetType !== "STOCK" ||
            position.asset.symbol !== action.symbol
          ) {
            continue;
          }
          const bucket = accountBucket(position.accountId, ledger.accounts);
          if (!bucket) continue;
          const eligibleQty = position.coreQty + openQty(position);
          const amount =
            eligibleQty *
            10_000 *
            (action.distributionPct / 100) *
            CASH_DIVIDEND_NET_FACTOR;
          entitlement.set(
            position.accountId,
            (entitlement.get(position.accountId) ?? 0) + amount,
          );
          corporateActionReceivableByBucket[bucket] += amount;
        }
        cashDividendEntitlements.set(action.id, entitlement);
      } else if (action.actionType === "RIGHTS_ISSUE") {
        const entitlements = rightsEntitlements.get(action.id);
        for (const [accountId, amount] of entitlements ?? []) {
          const bucket = accountBucket(accountId, ledger.accounts);
          if (!bucket) continue;
          corporateActionReceivableByBucket[bucket] -= Math.min(
            amount,
            corporateActionReceivableByBucket[bucket],
          );
        }
        cashByBucket.VPS -=
          action.vpsSubscribedQty * (action.subscriptionPrice ?? 0);
        cashByBucket.SSI -=
          action.ssiSubscribedQty * (action.subscriptionPrice ?? 0);
      }
      applyCorporateAction(item.action, positions);
      continue;
    }
    const tx = item.transaction;
    const txAsset = tx.assetId ? assets.get(tx.assetId) : undefined;
    const bucket = accountBucket(tx.accountId, ledger.accounts);
    if (bucket) {
      const fx = tx.fxRate ?? ledger.usdVnd;
      const currencyMultiplier = txAsset?.assetType === "CRYPTO" ? fx : 1;
      const qty = num(tx.quantity);
      const price = num(tx.price);
      const grossAmount = num(tx.amount) || qty * price;
      if (tx.txType === "BUY") {
        cashByBucket[bucket] -=
          (grossAmount + num(tx.fee)) * currencyMultiplier;
      } else if (tx.txType === "SELL") {
        cashByBucket[bucket] +=
          (grossAmount - num(tx.fee) - num(tx.tax)) * currencyMultiplier;
      } else if (tx.txType === "CASH_DIVIDEND") {
        const matchingAction = cashDividendActions.find(
          (action) =>
            txAsset?.symbol === action.symbol &&
            (tx.corporateActionId === action.id ||
              tx.txDate === (action.paymentDate ?? action.exDate)),
        );
        if (matchingAction) {
          const entitlement =
            cashDividendEntitlements
              .get(matchingAction.id)
              ?.get(tx.accountId) ?? 0;
          const receivable = Math.min(
            entitlement,
            corporateActionReceivableByBucket[bucket],
          );
          corporateActionReceivableByBucket[bucket] -= receivable;
        }
        cashByBucket[bucket] += netCashDividend(
          num(tx.amount),
          num(tx.tax),
        );
      }
    }
    if (!tx.assetId) continue;
    const asset = assets.get(tx.assetId);
    if (!asset) continue;
    const p = ensurePos(positions, asset, ledger.accounts);
    const qty = num(tx.quantity);
    const price = num(tx.price);
    const fee = num(tx.fee);
    const tax = num(tx.tax);

    if (tx.txType === "BUY") {
      const isCrypto = asset.assetType === "CRYPTO";
      const fx = tx.fxRate ?? ledger.usdVnd;
      const buyCostNative = qty * price + fee;
      const buyCostVnd = isCrypto ? buyCostNative * fx : buyCostNative;
      p.totalInvested += buyCostVnd;

      const allowTplus =
        tx.tradeTplus &&
        (asset.assetType === "STOCK" || asset.assetType === "CRYPTO") &&
        p.coreQty > 1e-12;
      if (allowTplus) {
        p.openLots.push({
          buyTxId: tx.id,
          buyDate: tx.txDate,
          qtyRemaining: qty,
          qtyOriginal: qty,
          buyPrice: price,
          buyFee: fee,
          originalCostVnd: buyCostVnd,
          fxRate: tx.fxRate,
        });
      } else {
        p.coreCostTotal += buyCostNative;
        p.coreCostVndTotal += buyCostVnd;
        p.coreOriginalCostVndTotal += buyCostVnd;
        p.coreQty += qty;
        p.coreCostLots.push({
          buyTxId: tx.id,
          quantity: qty,
          adjustedCost: buyCostNative,
        });
        syncCoreLotCosts(p);
      }
      continue;
    }

    if (tx.txType === "CASH_DIVIDEND") {
      const net = netCashDividend(num(tx.amount), tax);
      const coveredByCorporateAction = ledger.corporateActions.some(
        (action) =>
          !action.deletedAt &&
          action.actionType === "CASH_DIVIDEND" &&
          action.symbol === asset.symbol &&
          (action.id === tx.corporateActionId ||
            action.paymentDate === tx.txDate),
      );
      if (!coveredByCorporateAction) p.cashDividend += net;
      if (!coveredByCorporateAction) {
        if (net >= p.coreCostTotal) {
          const excess = net - p.coreCostTotal;
          p.coreCostTotal = 0;
          p.coreCostVndTotal = 0;
          if (excess > 0) p.realizedTradePnl += excess;
        } else {
          p.coreCostTotal -= net;
          p.coreCostVndTotal -= net;
        }
      }
      syncCoreLotCosts(p);
      continue;
    }

    if (tx.txType === "STOCK_DIVIDEND") {
      const coveredByCorporateAction = ledger.corporateActions.some(
        (action) =>
          !action.deletedAt &&
          action.actionType === "STOCK_DIVIDEND" &&
          action.symbol === asset.symbol &&
          (action.paymentDate ?? action.exDate) === tx.txDate,
      );
      if (coveredByCorporateAction) continue;
      const add =
        num(tx.stockDivQty) ||
        (num(tx.dividendPerShare) > 0
          ? p.coreQty * num(tx.dividendPerShare)
          : qty);
      const coreQtyBeforeDividend = p.coreQty;
      p.coreQty += add;
      if (coreQtyBeforeDividend > 0) {
        const ratio = p.coreQty / coreQtyBeforeDividend;
        for (const lot of p.coreCostLots) lot.quantity *= ratio;
      }
      p.stockDividendQty += add;
      continue;
    }

    if (tx.txType !== "SELL") continue;

    const matched = matchesBySell.get(tx.id) ?? [];
    let matchedQty = 0;
    const avgBefore = adjustedAvg(p);
    const origBefore = originalAvg(p);
    const holdingBefore = p.coreQty;

    for (const m of matched) {
      const lot = p.openLots.find(
        (l) => l.buyTxId === m.buyTxId && l.qtyRemaining > 0,
      );
      if (!lot) continue;
      const take = Math.min(m.quantity, lot.qtyRemaining, qty - matchedQty);
      if (take <= 0) continue;

      const buyFeeAlloc =
        lot.qtyOriginal > 0 ? (lot.buyFee * take) / lot.qtyOriginal : 0;
      const sellFeeAlloc = qty > 0 ? (fee * take) / qty : 0;
      const sellTaxAlloc = qty > 0 ? (tax * take) / qty : 0;
      const buyFx = lot.fxRate ?? ledger.usdVnd;
      const sellFx = tx.fxRate ?? ledger.usdVnd;
      const grossNative = (price - lot.buyPrice) * take;
      let grossVnd: number;
      if (asset.assetType === "CRYPTO") {
        grossVnd = cryptoGross(lot.buyPrice, buyFx, price, sellFx, take);
      } else {
        grossVnd = grossNative;
      }
      const netNative = grossNative - buyFeeAlloc - sellFeeAlloc - sellTaxAlloc;
      const netVnd =
        grossVnd -
        (asset.assetType === "CRYPTO"
          ? buyFeeAlloc * buyFx + (sellFeeAlloc + sellTaxAlloc) * sellFx
          : buyFeeAlloc + sellFeeAlloc + sellTaxAlloc);
      lot.qtyRemaining -= take;
      matchedQty += take;
      p.tplusReduction += netNative;
      p.tplusReductionVnd += netVnd;
      syncCoreLotCosts(p);

      const avgAfter = adjustedAvg(p);
      p.cycles.push({
        id: `${tx.id}:${lot.buyTxId}:${take}`,
        assetId: asset.id,
        symbol: asset.symbol,
        assetType: asset.assetType,
        accountId: p.accountId,
        accountName: p.accountName,
        buyTxId: lot.buyTxId,
        sellTxId: tx.id,
        buyDate: lot.buyDate,
        sellDate: tx.txDate,
        holdingBefore,
        buyQuantity: lot.qtyOriginal,
        buyPrice: lot.buyPrice,
        sellQuantity: take,
        sellPrice: price,
        fees: buyFeeAlloc + sellFeeAlloc,
        tax: sellTaxAlloc,
        grossProfit: grossVnd,
        netProfit: netVnd,
        cryptoNetProfitUsd:
          asset.assetType === "CRYPTO" ? netNative : undefined,
        avgCostBefore: avgBefore || origBefore,
        avgCostAfter: avgAfter,
        costReduction: (avgBefore || origBefore) - avgAfter,
        remainingHolding: p.coreQty,
        remainingUnrealized: 0,
        status: lot.qtyRemaining > 0 ? "PARTIAL" : "COMPLETED",
      });
    }

    p.openLots = p.openLots.filter((l) => l.qtyRemaining > 1e-12);
    const leftover = qty - matchedQty;
    if (leftover > 1e-12) {
      const netProceedsNative =
        leftover * price - (qty > 0 ? ((fee + tax) * leftover) / qty : 0);
      const sellFx = tx.fxRate ?? ledger.usdVnd;
      const netProceedsVnd =
        asset.assetType === "CRYPTO"
          ? netProceedsNative * sellFx
          : netProceedsNative;
      applyCoreSell(p, leftover, netProceedsVnd);
    }
  }

  const holdings: HoldingView[] = [];
  const tplusCards: TplusCard[] = [];
  const tplusHistory: TplusCycleRecord[] = [];

  for (const p of positions.values()) {
    const totalQty = p.coreQty + openQty(p);
    const price = num(p.asset.currentPrice) || adjustedAvg(p) || originalAvg(p);
    const isCrypto = p.asset.assetType === "CRYPTO";
    const fx = ledger.usdVnd;
    const mv = isCrypto ? totalQty * price * fx : totalQty * price;
    const coreBasisNative = Math.max(0, p.coreCostTotal - p.tplusReduction);
    const coreBasisVnd = Math.max(0, p.coreCostVndTotal - p.tplusReductionVnd);
    const tplusBasis = isCrypto
      ? p.openLots.reduce((s, l) => {
          const fxBuy = l.fxRate ?? fx;
          const feeShare =
            l.qtyOriginal > 0 ? (l.buyFee * l.qtyRemaining) / l.qtyOriginal : 0;
          return s + l.qtyRemaining * l.buyPrice * fxBuy + feeShare * fxBuy;
        }, 0)
      : openCost(p);
    const tplusBasisNative = isCrypto
      ? p.openLots.reduce((s, l) => {
          const feeShare =
            l.qtyOriginal > 0 ? (l.buyFee * l.qtyRemaining) / l.qtyOriginal : 0;
          return s + l.qtyRemaining * l.buyPrice + feeShare;
        }, 0)
      : openCost(p);
    const costBasis = coreBasisVnd + tplusBasis;
    const originalOpenCostBasis = p.openLots.reduce(
      (sum, lot) =>
        sum +
        (lot.qtyOriginal > 0
          ? (lot.originalCostVnd * lot.qtyRemaining) / lot.qtyOriginal
          : 0),
      0,
    );
    const originalCostBasis =
      p.coreOriginalCostVndTotal + originalOpenCostBasis;
    const unreal = mv - costBasis;
    const cryptoCostBasisUsd = isCrypto
      ? coreBasisNative + tplusBasisNative
      : undefined;
    const cryptoUnrealizedPnlUsd = isCrypto
      ? totalQty * price - (cryptoCostBasisUsd ?? 0)
      : undefined;
    const adj = adjustedAvg(p);
    const orig = originalAvg(p);

    for (const c of p.cycles) {
      c.remainingUnrealized = unreal;
      tplusHistory.push(c);
    }

    if (
      totalQty > 1e-12 ||
      p.realizedTradePnl !== 0 ||
      p.tplusReductionVnd !== 0 ||
      p.cashDividend !== 0
    ) {
      holdings.push({
        assetId: p.asset.id,
        accountId: p.accountId,
        accountName: p.accountName,
        accountKind: p.accountKind,
        symbol: p.asset.symbol,
        name: p.asset.name || p.asset.symbol,
        assetType: p.asset.assetType,
        currency: p.asset.currency,
        coreQty: p.coreQty,
        openTplusQty: openQty(p),
        quantity: totalQty,
        originalAvgCost: orig,
        adjustedAvgCost: adj,
        currentPrice: price,
        marketValue: mv,
        costBasis,
        originalCostBasis,
        unrealizedPnl: unreal,
        cryptoCostBasisUsd,
        cryptoUnrealizedPnlUsd,
        realizedTradePnl: p.realizedTradePnl,
        cashDividend: p.cashDividend,
        stockDividendQty: p.stockDividendQty,
        tplusProfitCompleted: p.tplusReductionVnd,
        totalInvested: p.totalInvested,
        openLots: p.openLots,
        buyLotCosts: p.coreCostLots
          .filter((lot) => lot.quantity > 1e-12)
          .map((lot) => ({
            buyTxId: lot.buyTxId,
            remainingQty: lot.quantity,
            adjustedPrice: lot.adjustedCost / lot.quantity,
          })),
      });
    }

    const oq = openQty(p);
    if (oq > 1e-12) {
      const weightedBuy =
        p.openLots.reduce((s, l) => s + l.qtyRemaining * l.buyPrice, 0) / oq;
      const mult = p.asset.assetType === "CRYPTO" ? 1.05 : 1.03;
      const { feePct, taxPct } = sellRates(ledger.fees, p.accountKind);
      const totalQtyBe = p.coreQty + oq;
      const drag = 1 - (feePct + taxPct) / 100;
      let breakEven = 0;
      if (totalQtyBe > 0 && drag > 0) {
        if (isCrypto) {
          breakEven =
            (cryptoCostBasisUsd ?? 0) / (totalQtyBe * drag);
        } else {
          breakEven = costBasis / (totalQtyBe * drag);
        }
      }
      tplusCards.push({
        assetId: p.asset.id,
        accountId: p.accountId,
        accountName: p.accountName,
        symbol: p.asset.symbol,
        name: p.asset.name || p.asset.symbol,
        assetType: p.asset.assetType,
        coreQty: p.coreQty,
        openTplusQty: oq,
        tradePrice: weightedBuy,
        originalAvgCost: orig,
        adjustedAvgCost: adj,
        currentPrice: price,
        suggestedSell: weightedBuy * mult,
        breakEvenPrice: breakEven,
        remainingUnrealized: unreal,
        cryptoRemainingUnrealizedUsd: cryptoUnrealizedPnlUsd,
        tplusProfitCompleted: p.tplusReductionVnd,
        openLots: p.openLots,
      });
    }
  }

  const activeBanks = ledger.banks
    .filter(
      (b) =>
        !b.deletedAt &&
        b.status === "ACTIVE" &&
        b.startDate <= asOf,
    )
    .map((b) =>
      replayBank(
        b,
        ledger.bankRates.filter((r) => r.depositId === b.id),
        asOf,
      ),
    )
    .sort(
      (a, b) =>
        a.remainingDays - b.remainingDays ||
        a.bankName.localeCompare(b.bankName),
    );

  const redeemedBanks = ledger.banks
    .filter(
      (b) =>
        !b.deletedAt &&
        b.status === "REDEEMED" &&
        b.startDate <= asOf,
    )
    .map((b) =>
      replayBank(
        b,
        ledger.bankRates.filter((r) => r.depositId === b.id),
        asOf,
      ),
    );

  const bankValue = [...activeBanks, ...redeemedBanks].reduce(
    (s, b) => s + b.currentValue,
    0,
  );
  const bankInterest =
    activeBanks.reduce((s, b) => s + b.accumulatedInterest, 0) +
    redeemedBanks.reduce((s, b) => s + b.accumulatedInterest, 0);

  const cat: Record<string, number> = {
    DCDS: cashByBucket.DCDS + corporateActionReceivableByBucket.DCDS,
    ETF: cashByBucket.ETF + corporateActionReceivableByBucket.ETF,
    STOCK: 0,
    CRYPTO: cashByBucket.CRYPTO + corporateActionReceivableByBucket.CRYPTO,
    BANK: bankValue,
  };
  for (const h of holdings) {
    if (h.assetType === "DCDS") cat.DCDS += h.marketValue;
    else if (h.assetType === "ETF") cat.ETF += h.marketValue;
    else if (h.assetType === "STOCK") cat.STOCK += h.marketValue;
    else if (h.assetType === "CRYPTO") cat.CRYPTO += h.marketValue;
  }
  const usdtHistory = ledger.usdtBalanceHistory;
  const pastUsdt = usdtHistory.filter(
    (snapshot) => snapshot.effectiveDate <= asOf,
  );
  const historicalUsdt = pastUsdt[pastUsdt.length - 1];
  const usdtBalance =
    usdtHistory.length > 0
      ? historicalUsdt?.amount ?? 0
      : ledger.usdtBalance;
  const usdtNav = usdtBalance * ledger.usdVnd;
  cat.CRYPTO += usdtNav;
  const vpsCash =
    cashByBucket.VPS + corporateActionReceivableByBucket.VPS;
  const ssiCash =
    cashByBucket.SSI + corporateActionReceivableByBucket.SSI;
  const nav =
    cat.DCDS +
    cat.ETF +
    cat.CRYPTO +
    cat.BANK +
    holdings
      .filter((h) => h.assetType === "STOCK" && h.accountId === "vps")
      .reduce((sum, h) => sum + h.marketValue, 0) +
    holdings
      .filter((h) => h.assetType === "STOCK" && h.accountId === "ssi")
      .reduce((sum, h) => sum + h.marketValue, 0) +
    vpsCash +
    ssiCash;
  cat.STOCK += vpsCash + ssiCash;
  const allocation: PortfolioState["allocation"] = {};
  for (const key of ["DCDS", "ETF", "STOCK", "CRYPTO", "BANK"]) {
    allocation[key] = {
      value: cat[key],
      pct: nav > 0 ? (cat[key] / nav) * 100 : 0,
    };
  }

  const realizedTradePnl = holdings.reduce((s, h) => s + h.realizedTradePnl, 0);
  const unrealizedPnl = holdings.reduce((s, h) => s + h.unrealizedPnl, 0);
  const cashDividend = holdings.reduce((s, h) => s + h.cashDividend, 0);
  const stockDividendQty = holdings.reduce((s, h) => s + h.stockDividendQty, 0);
  const tplusProfit = holdings.reduce((s, h) => s + h.tplusProfitCompleted, 0);
  const navByBucket = emptyBuckets();
  navByBucket.DCDS = cat.DCDS;
  navByBucket.ETF = cat.ETF;
  navByBucket.CRYPTO = cat.CRYPTO;
  navByBucket.BANK = cat.BANK;
  navByBucket.VPS = holdings
    .filter((h) => h.accountId === "vps")
    .reduce((s, h) => s + h.marketValue, vpsCash);
  navByBucket.SSI = holdings
    .filter((h) => h.accountId === "ssi")
    .reduce((s, h) => s + h.marketValue, ssiCash);
  const tplusByBucket = {
    VPS: holdings
      .filter((h) => h.accountId === "vps")
      .reduce((s, h) => s + h.tplusProfitCompleted, 0),
    SSI: holdings
      .filter((h) => h.accountId === "ssi")
      .reduce((s, h) => s + h.tplusProfitCompleted, 0),
    CRYPTO: holdings
      .filter((h) => h.assetType === "CRYPTO")
      .reduce((s, h) => s + h.tplusProfitCompleted, 0),
  };
  const totalPnl = nav - originalCapital;
  const totalReturnPct =
    originalCapital > 0 ? (totalPnl / originalCapital) * 100 : 0;

  holdings.sort((a, b) => {
    const order = ["DCDS", "ETF", "STOCK", "CRYPTO"];
    const d = order.indexOf(a.assetType) - order.indexOf(b.assetType);
    if (d !== 0) return d;
    return (
      a.symbol.localeCompare(b.symbol) ||
      a.accountName.localeCompare(b.accountName)
    );
  });

  tplusCards.sort((a, b) => a.symbol.localeCompare(b.symbol));
  tplusHistory.sort((a, b) => b.sellDate.localeCompare(a.sellDate));

  return {
    asOf,
    originalCapital,
    originalByBucket,
    originalByBucketUsd,
    cashByBucket,
    corporateActionReceivableByBucket,
    nav,
    navByBucket,
    tplusByBucket,
    totalPnl,
    totalReturnPct,
    realizedTradePnl,
    unrealizedPnl,
    cashDividend,
    stockDividendQty,
    tplusProfit,
    bankInterest,
    bankValue,
    usdVnd: ledger.usdVnd,
    holdings,
    banks: activeBanks,
    redeemedBanks,
    tplusCards,
    tplusHistory,
    allocation,
  };
}

export function dcdsQty(amount: number, navPrice: number): number {
  if (navPrice <= 0) return 0;
  return roundTo4(amount / navPrice);
}
