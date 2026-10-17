import { interestForPeriod, periodRate } from "@/engine/bank";
import { addTermMonths, todayYmd } from "@/engine/dates";
import { replayPortfolio } from "@/engine/replay";
import type { CapitalBucket, CorporateAction, LedgerSnapshot } from "@/engine/types";

export type ReportKind =
  | "DEPOSIT"
  | "WITHDRAW"
  | "BUY"
  | "SELL"
  | "BUY_TPLUS"
  | "SELL_TPLUS"
  | "CASH_DIVIDEND"
  | "STOCK_DIVIDEND"
  | "EX_RIGHTS"
  | "BANK_OPEN"
  | "BANK_ROLLOVER"
  | "BANK_REDEEM";

export type ReportRow = {
  id: string;
  date: string;
  createdAt: string;
  bucket: CapitalBucket | "ALL";
  relatedBuckets?: CapitalBucket[];
  symbol: string;
  kind: ReportKind;
  kindLabel: string;
  quantity: number | null;
  price: number | null;
  amount: number;
  notes: string | null;
  assetType: "STOCK" | "ETF" | "DCDS" | "CRYPTO" | "BANK" | "ORIGINAL";
  corporateAction?: CorporateAction;
};

export const REPORT_BUCKETS: { value: "ALL" | CapitalBucket; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DCDS", label: "DCDS" },
  { value: "ETF", label: "ETF" },
  { value: "VPS", label: "VPS" },
  { value: "SSI", label: "SSI" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "BANK", label: "Bank" },
];

export const REPORT_KINDS: { value: "ALL" | ReportKind; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "DEPOSIT", label: "Nạp Original" },
  { value: "WITHDRAW", label: "Rút Original" },
  { value: "BUY", label: "Buy" },
  { value: "SELL", label: "Sell" },
  { value: "BUY_TPLUS", label: "Buy T+" },
  { value: "SELL_TPLUS", label: "Sell T+" },
  { value: "CASH_DIVIDEND", label: "Cổ tức tiền" },
  { value: "STOCK_DIVIDEND", label: "Cổ tức CP" },
  { value: "EX_RIGHTS", label: "Ngày GDKHQ" },
  { value: "BANK_OPEN", label: "Mở sổ" },
  { value: "BANK_ROLLOVER", label: "Tái tục" },
  { value: "BANK_REDEEM", label: "Tất toán" },
];

const KIND_LABEL: Record<ReportKind, string> = {
  DEPOSIT: "Nạp Original",
  WITHDRAW: "Rút Original",
  BUY: "Buy",
  SELL: "Sell",
  BUY_TPLUS: "Buy T+",
  SELL_TPLUS: "Sell T+",
  CASH_DIVIDEND: "Cổ tức tiền",
  STOCK_DIVIDEND: "Cổ tức CP",
  EX_RIGHTS: "Ngày GDKHQ",
  BANK_OPEN: "Mở sổ",
  BANK_ROLLOVER: "Tái tục",
  BANK_REDEEM: "Tất toán",
};

function accountBucket(accountId: string, ledger: LedgerSnapshot): CapitalBucket {
  const kind = ledger.accounts.find((a) => a.id === accountId)?.kind;
  if (kind === "STOCK_VPS") return "VPS";
  if (kind === "STOCK_SSI") return "SSI";
  if (kind === "CRYPTO") return "CRYPTO";
  if (kind === "ETF") return "ETF";
  if (kind === "DCDS") return "DCDS";
  return "BANK";
}

function previousDate(ymd: string): string {
  const date = new Date(`${ymd}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

function bankRows(ledger: LedgerSnapshot, asOf: string): ReportRow[] {
  const rows: ReportRow[] = [];
  for (const d of ledger.banks) {
    if (d.deletedAt) continue;
    const rates = ledger.bankRates.filter((r) => r.depositId === d.id);
    rows.push({
      id: `${d.id}:open`,
      date: d.startDate,
      createdAt: d.createdAt,
      bucket: "BANK",
      symbol: d.bankName,
      kind: "BANK_OPEN",
      kindLabel: KIND_LABEL.BANK_OPEN,
      quantity: null,
      price: null,
      amount: d.principal,
      notes: d.notes,
      assetType: "BANK",
    });

    const horizon = d.status === "REDEEMED" && d.redeemedAt ? d.redeemedAt : asOf;
    if (d.autoRollover) {
      let periodStart = d.startDate;
      let principal = d.principal;
      let period = 0;
      while (period < 600) {
        const maturity = addTermMonths(periodStart, d.termMonths);
        if (maturity > horizon) break;
        if (d.status === "REDEEMED" && d.redeemedAt && maturity >= d.redeemedAt) break;
        const { rate } = periodRate(d, period, rates);
        const earned = interestForPeriod(principal, rate, periodStart, maturity);
        rows.push({
          id: `${d.id}:roll:${period + 1}`,
          date: maturity,
          createdAt: `${maturity}T00:00:00Z`,
          bucket: "BANK",
          symbol: d.bankName,
          kind: "BANK_ROLLOVER",
          kindLabel: KIND_LABEL.BANK_ROLLOVER,
          quantity: null,
          price: null,
          amount: earned,
          notes: `Kỳ ${period + 1}`,
          assetType: "BANK",
        });
        principal += earned;
        periodStart = maturity;
        period += 1;
      }
    }

    if (d.status === "REDEEMED" && d.redeemedAt) {
      rows.push({
        id: `${d.id}:redeem`,
        date: d.redeemedAt,
        createdAt: d.createdAt,
        bucket: "BANK",
        symbol: d.bankName,
        kind: "BANK_REDEEM",
        kindLabel: KIND_LABEL.BANK_REDEEM,
        quantity: null,
        price: null,
        amount: (d.redeemedPrincipal ?? 0) + (d.redeemedInterest ?? 0),
        notes: d.notes,
        assetType: "BANK",
      });
    }
  }
  return rows;
}

export function buildReportRows(ledger: LedgerSnapshot, asOf = todayYmd()): ReportRow[] {
  const rows: ReportRow[] = [];

  for (const c of ledger.capital) {
    if (c.deletedAt) continue;
    rows.push({
      id: c.id,
      date: c.movementDate,
      createdAt: c.createdAt,
      bucket: c.bucket,
      symbol: "Original",
      kind: c.kind,
      kindLabel: KIND_LABEL[c.kind],
      quantity: null,
      price: null,
      amount: c.kind === "WITHDRAW" ? -c.amount : c.amount,
      notes: c.notes,
      assetType: "ORIGINAL",
    });
  }

  for (const t of ledger.transactions) {
    if (t.deletedAt) continue;
    const asset = ledger.assets.find((a) => a.id === t.assetId);
    let kind: ReportKind = t.txType;
    if (t.txType === "BUY" && t.tradeTplus) kind = "BUY_TPLUS";
    if (t.txType === "SELL" && t.tradeTplus) kind = "SELL_TPLUS";
    const signed =
      t.txType === "SELL" || t.txType === "CASH_DIVIDEND"
        ? Math.abs(t.amount)
        : t.txType === "STOCK_DIVIDEND"
          ? 0
          : -Math.abs(t.amount);
    rows.push({
      id: t.id,
      date: t.txDate,
      createdAt: t.createdAt,
      bucket: accountBucket(t.accountId, ledger),
      symbol: asset?.symbol ?? "—",
      kind,
      kindLabel: KIND_LABEL[kind],
      quantity: t.txType === "STOCK_DIVIDEND" ? (t.stockDivQty ?? t.quantity) : t.quantity,
      price: t.price,
      amount: signed,
      notes: t.notes,
      assetType: asset?.assetType ?? "STOCK",
    });
  }

  for (const action of ledger.corporateActions) {
    if (action.deletedAt) continue;
    const eligibleHoldings =
      action.actionType === "RIGHTS_ISSUE"
        ? []
        : replayPortfolio(ledger, previousDate(action.exDate)).holdings.filter(
            (holding) =>
              holding.assetType === "STOCK" &&
              holding.symbol === action.symbol,
          );
    const eligibleQty = eligibleHoldings.reduce(
      (sum, holding) => sum + holding.quantity,
      0,
    );
    const stockBonusQty = eligibleHoldings.reduce(
      (sum, holding) =>
        sum + Math.floor(holding.quantity * (action.distributionPct / 100) + 1e-9),
      0,
    );
    const grossCashDividend =
      eligibleQty * 10_000 * (action.distributionPct / 100);
    const relatedBuckets = [
      ...new Set(
        ledger.assets
          .filter(
            (asset) =>
              asset.assetType === "STOCK" && asset.symbol === action.symbol,
          )
          .map((asset) => accountBucket(asset.accountId, ledger)),
      ),
    ];
    const distributionLabel =
      action.actionType === "CASH_DIVIDEND"
        ? `Cổ tức tiền gộp trước thuế ${action.distributionPct}%`
        : action.actionType === "STOCK_DIVIDEND"
          ? `Cổ tức cổ phiếu ${action.distributionPct}%`
          : `Quyền mua ${action.distributionPct}%`;
    rows.push({
      id: action.id,
      date: action.exDate,
      createdAt: action.createdAt,
      bucket: "ALL",
      relatedBuckets,
      symbol: action.symbol,
      kind: "EX_RIGHTS",
      kindLabel: KIND_LABEL.EX_RIGHTS,
      quantity:
        action.actionType === "RIGHTS_ISSUE"
          ? action.vpsSubscribedQty + action.ssiSubscribedQty
          : action.actionType === "CASH_DIVIDEND"
            ? eligibleQty
            : stockBonusQty,
      price:
        action.actionType === "RIGHTS_ISSUE"
          ? action.subscriptionPrice
          : action.actionType === "CASH_DIVIDEND"
            ? 10_000 * (action.distributionPct / 100)
            : null,
      amount:
        action.actionType === "CASH_DIVIDEND" ? grossCashDividend : 0,
      notes: [
        distributionLabel,
        action.recordDate ? `Ngày ĐKCC ${action.recordDate}` : null,
        action.paymentDate ? `Ngày thanh toán ${action.paymentDate}` : null,
        action.actionType === "RIGHTS_ISSUE" && action.subscriptionPrice != null
          ? `Giá đăng ký ${action.subscriptionPrice}`
          : null,
        action.actionType === "RIGHTS_ISSUE"
          ? `Đăng ký VPS ${action.vpsSubscribedQty} CP · SSI ${action.ssiSubscribedQty} CP`
          : null,
        action.notes,
      ]
        .filter(Boolean)
        .join(" · "),
      assetType: "STOCK",
      corporateAction: action,
    });
  }

  rows.push(...bankRows(ledger, asOf));

  rows.sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id),
  );
  return rows;
}

export function filterReportRows(
  rows: ReportRow[],
  opts: {
    bucket: "ALL" | CapitalBucket;
    kind: "ALL" | ReportKind;
    symbol: string;
    from: string;
    to: string;
  },
): ReportRow[] {
  return rows.filter((r) => {
    if (
      opts.bucket !== "ALL" &&
      r.bucket !== opts.bucket &&
      !r.relatedBuckets?.includes(opts.bucket)
    ) return false;
    if (opts.kind !== "ALL" && r.kind !== opts.kind) return false;
    if (opts.symbol !== "ALL" && r.symbol !== opts.symbol) return false;
    if (opts.from && r.date < opts.from) return false;
    if (opts.to && r.date > opts.to) return false;
    return true;
  });
}