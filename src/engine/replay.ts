import { replayBank } from "./bank";
import { todayYmd } from "./dates";
import { num, roundTo4 } from "./money";
import type {
  Asset,
  CapitalBucket,
  CapitalMovement,
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

interface Pos {
  asset: Asset;
  accountId: string;
  accountName: string;
  accountKind: HoldingView["accountKind"];
  coreQty: number;
  coreCostTotal: number;
  tplusReduction: number;
  realizedTradePnl: number;
  cashDividend: number;
  stockDividendQty: number;
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

function sellRates(fees: FeeSetting[], kind: string): { feePct: number; taxPct: number } {
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

function openQty(p: Pos): number {
  return p.openLots.reduce((s, l) => s + l.qtyRemaining, 0);
}

function openCost(p: Pos): number {
  return p.openLots.reduce((s, l) => {
    const feeShare = l.qtyOriginal > 0 ? (l.buyFee * l.qtyRemaining) / l.qtyOriginal : 0;
    return s + l.qtyRemaining * l.buyPrice + feeShare;
  }, 0);
}

function cryptoGross(buyPrice: number, buyFx: number, sellPrice: number, sellFx: number, qty: number): number {
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
    tplusReduction: 0,
    realizedTradePnl: 0,
    cashDividend: 0,
    stockDividendQty: 0,
    openLots: [],
    cycles: [],
  };
  map.set(asset.id, p);
  return p;
}

function sortTx(a: Transaction, b: Transaction): number {
  const d = a.txDate.localeCompare(b.txDate);
  if (d !== 0) return d;
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function applyCoreSell(p: Pos, qty: number, netProceeds: number) {
  if (p.coreQty <= 0 || qty <= 0) return;
  const sellQty = Math.min(qty, p.coreQty);
  const frac = sellQty / p.coreQty;
  const cost = (p.coreCostTotal - p.tplusReduction) * frac;
  p.realizedTradePnl += netProceeds * (sellQty / qty) - cost;
  p.coreCostTotal -= p.coreCostTotal * frac;
  p.tplusReduction -= p.tplusReduction * frac;
  p.coreQty -= sellQty;
}
export function emptyBuckets(): Record<CapitalBucket, number> {
  return { DCDS: 0, ETF: 0, VPS: 0, SSI: 0, CRYPTO: 0, BANK: 0 };
}

/** Original từng ô: nạp cộng, rút trừ, không âm. Original Capital = tổng 6 ô. */
export function replayOriginalByBucket(capital: CapitalMovement[]): Record<CapitalBucket, number> {
  const o = emptyBuckets();
  const rows = capital
    .filter((c) => !c.deletedAt)
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
/**
 * Shared Calculation Engine. UI must never compute P&L / holdings itself.
 * Replay is deterministic from the ledger (soft-deleted rows excluded).
 */
export function replayPortfolio(ledger: LedgerSnapshot, asOf = todayYmd()): PortfolioState {
    const originalByBucket = replayOriginalByBucket(ledger.capital);
  const originalCapital = CAPITAL_BUCKETS.reduce((s, b) => s + originalByBucket[b], 0);

  const assets = new Map(ledger.assets.map((a) => [a.id, a]));
  const positions = new Map<string, Pos>();
  const txs = ledger.transactions.filter((t) => !t.deletedAt).slice().sort(sortTx);
  const matchesBySell = new Map<string, typeof ledger.matches>();
  for (const m of ledger.matches) {
    const list = matchesBySell.get(m.sellTxId) ?? [];
    list.push(m);
    matchesBySell.set(m.sellTxId, list);
  }

  for (const tx of txs) {
    if (!tx.assetId) continue;
    const asset = assets.get(tx.assetId);
    if (!asset) continue;
    const p = ensurePos(positions, asset, ledger.accounts);
    const qty = num(tx.quantity);
    const price = num(tx.price);
    const fee = num(tx.fee);
    const tax = num(tx.tax);

    if (tx.txType === "BUY") {
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
          fxRate: tx.fxRate,
        });
      } else {
        p.coreCostTotal += qty * price + fee;
        p.coreQty += qty;
      }
      continue;
    }

    if (tx.txType === "CASH_DIVIDEND") {
      const net = Math.max(0, num(tx.amount) - tax);
      p.cashDividend += net;
      if (net >= p.coreCostTotal) {
        const excess = net - p.coreCostTotal;
        p.coreCostTotal = 0;
        if (excess > 0) p.realizedTradePnl += excess;
      } else {
        p.coreCostTotal -= net;
      }
      continue;
    }

    if (tx.txType === "STOCK_DIVIDEND") {
      const add = num(tx.stockDivQty) || (num(tx.dividendPerShare) > 0 ? p.coreQty * num(tx.dividendPerShare) : qty);
      p.coreQty += add;
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
      const lot = p.openLots.find((l) => l.buyTxId === m.buyTxId && l.qtyRemaining > 0);
      if (!lot) continue;
      const take = Math.min(m.quantity, lot.qtyRemaining, qty - matchedQty);
      if (take <= 0) continue;

      const buyFeeAlloc = lot.qtyOriginal > 0 ? (lot.buyFee * take) / lot.qtyOriginal : 0;
      const sellFeeAlloc = qty > 0 ? (fee * take) / qty : 0;
      const sellTaxAlloc = qty > 0 ? (tax * take) / qty : 0;
      let gross: number;
      if (asset.assetType === "CRYPTO") {
        const buyFx = lot.fxRate ?? ledger.usdVnd;
        const sellFx = tx.fxRate ?? ledger.usdVnd;
        gross = cryptoGross(lot.buyPrice, buyFx, price, sellFx, take);
      } else {
        gross = (price - lot.buyPrice) * take;
      }
      const net = gross - buyFeeAlloc - sellFeeAlloc - sellTaxAlloc;
      lot.qtyRemaining -= take;
      matchedQty += take;
      p.tplusReduction += net;

      const avgAfter = adjustedAvg(p);
      p.cycles.push({
        id: `${tx.id}:${lot.buyTxId}:${take}`,
        assetId: asset.id,
        symbol: asset.symbol,
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
        grossProfit: gross,
        netProfit: net,
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
      const proceeds = leftover * price - (qty > 0 ? ((fee + tax) * leftover) / qty : 0);
      applyCoreSell(p, leftover, proceeds);
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
    const coreBasis = Math.max(0, p.coreCostTotal - p.tplusReduction);
    const tplusBasis = isCrypto
      ? p.openLots.reduce((s, l) => {
          const fxBuy = l.fxRate ?? fx;
          const feeShare = l.qtyOriginal > 0 ? (l.buyFee * l.qtyRemaining) / l.qtyOriginal : 0;
          return s + l.qtyRemaining * l.buyPrice * fxBuy + feeShare * fxBuy;
        }, 0)
      : openCost(p);
    const costBasis = coreBasis + tplusBasis;
    const unreal = mv - costBasis;
    const adj = adjustedAvg(p);
    const orig = originalAvg(p);

    for (const c of p.cycles) {
      c.remainingUnrealized = unreal;
      tplusHistory.push(c);
    }

    if (totalQty > 1e-12 || p.realizedTradePnl || p.cashDividend) {
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
        unrealizedPnl: unreal,
        realizedTradePnl: p.realizedTradePnl,
        cashDividend: p.cashDividend,
        stockDividendQty: p.stockDividendQty,
        tplusProfitCompleted: p.tplusReduction,
        openLots: p.openLots,
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
          breakEven = costBasis / (totalQtyBe * fx * drag);
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
        tplusProfitCompleted: p.tplusReduction,
        openLots: p.openLots,
      });
    }
  }

  const activeBanks = ledger.banks
    .filter((b) => !b.deletedAt && b.status === "ACTIVE")
    .map((b) => replayBank(b, ledger.bankRates.filter((r) => r.depositId === b.id), asOf))
    .sort((a, b) => a.remainingDays - b.remainingDays || a.bankName.localeCompare(b.bankName));

  const redeemedBanks = ledger.banks
    .filter((b) => !b.deletedAt && b.status === "REDEEMED")
    .map((b) => replayBank(b, ledger.bankRates.filter((r) => r.depositId === b.id), asOf));

  const bankValue = activeBanks.reduce((s, b) => s + b.currentPrincipal, 0);
  const bankInterest =
    activeBanks.reduce((s, b) => s + b.accumulatedInterest, 0) +
    redeemedBanks.reduce((s, b) => s + b.accumulatedInterest, 0);

  const cat: Record<string, number> = { DCDS: 0, ETF: 0, STOCK: 0, CRYPTO: 0, BANK: bankValue };
  for (const h of holdings) {
    if (h.assetType === "DCDS") cat.DCDS += h.marketValue;
    else if (h.assetType === "ETF") cat.ETF += h.marketValue;
    else if (h.assetType === "STOCK") cat.STOCK += h.marketValue;
    else if (h.assetType === "CRYPTO") cat.CRYPTO += h.marketValue;
  }
  const nav = cat.DCDS + cat.ETF + cat.STOCK + cat.CRYPTO + cat.BANK;
  const allocation: PortfolioState["allocation"] = {};
  for (const key of ["DCDS", "ETF", "STOCK", "CRYPTO", "BANK"]) {
    allocation[key] = { value: cat[key], pct: nav > 0 ? (cat[key] / nav) * 100 : 0 };
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
  navByBucket.VPS = holdings.filter((h) => h.accountId === "vps").reduce((s, h) => s + h.marketValue, 0);
  navByBucket.SSI = holdings.filter((h) => h.accountId === "ssi").reduce((s, h) => s + h.marketValue, 0);
  const tplusByBucket = {
    VPS: holdings.filter((h) => h.accountId === "vps").reduce((s, h) => s + h.tplusProfitCompleted, 0),
    SSI: holdings.filter((h) => h.accountId === "ssi").reduce((s, h) => s + h.tplusProfitCompleted, 0),
    CRYPTO: holdings.filter((h) => h.assetType === "CRYPTO").reduce((s, h) => s + h.tplusProfitCompleted, 0),
  };
  const totalPnl = nav - originalCapital;
  const totalReturnPct = originalCapital > 0 ? (totalPnl / originalCapital) * 100 : 0;

  holdings.sort((a, b) => {
    const order = ["DCDS", "ETF", "STOCK", "CRYPTO"];
    const d = order.indexOf(a.assetType) - order.indexOf(b.assetType);
    if (d !== 0) return d;
    return a.symbol.localeCompare(b.symbol) || a.accountName.localeCompare(b.accountName);
  });

  tplusCards.sort((a, b) => a.symbol.localeCompare(b.symbol));
  tplusHistory.sort((a, b) => b.sellDate.localeCompare(a.sellDate));

  return {
    asOf,
  originalCapital,
    originalByBucket,
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
