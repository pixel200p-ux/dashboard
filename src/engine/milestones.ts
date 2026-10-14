import { replayPortfolio } from "@/engine/replay";
import type { CapitalBucket, LedgerSnapshot, PortfolioState } from "@/engine/types";
import { CAPITAL_BUCKETS } from "@/engine/types";

export const MILESTONE_STEP = 50_000_000;

export type PriceSnap = { assetId: string; asOf: string; price: number };
export type FxSnap = { asOf: string; usdVnd: number };

export type MilestoneKind = "nav" | "orig" | "pnl" | "tplus";

export type Milestone = {
  id: string;
  date: string;
  label: string;
  threshold: number;
  value: number;
  kind: MilestoneKind;
  bucket: CapitalBucket | "TOTAL";
};

function sliceLedger(ledger: LedgerSnapshot, d: string): LedgerSnapshot {
  return {
    ...ledger,
    capital: ledger.capital.filter((c) => !c.deletedAt && c.movementDate <= d),
    transactions: ledger.transactions.filter((t) => !t.deletedAt && t.txDate <= d),
    matches: ledger.matches.filter((m) => {
      const sell = ledger.transactions.find((t) => t.id === m.sellTxId);
      return Boolean(sell && !sell.deletedAt && sell.txDate <= d);
    }),
    banks: ledger.banks.filter((b) => !b.deletedAt && b.startDate <= d),
  };
}

function overlayPrices(
  ledger: LedgerSnapshot,
  priceByAsset: Record<string, number>,
  fx: number,
): LedgerSnapshot {
  return {
    ...ledger,
    usdVnd: fx > 0 ? fx : ledger.usdVnd,
    assets: ledger.assets.map((a) => ({
      ...a,
      currentPrice: priceByAsset[a.id] ?? a.currentPrice,
    })),
  };
}

const BUCKET_LABEL: Record<CapitalBucket, string> = {
  DCDS: "DCDS",
  ETF: "ETF",
  VPS: "VPS",
  SSI: "SSI",
  CRYPTO: "Crypto",
  BANK: "Bank",
};

type Series = { key: string; title: string; read: (s: PortfolioState) => number };

function seriesList(): Series[] {
  const out: Series[] = [
    { key: "nav", title: "NAV tổng", read: (s) => s.nav },
    { key: "orig", title: "Original tổng", read: (s) => s.originalCapital },
    { key: "pnl", title: "Lãi/lỗ tổng", read: (s) => s.totalPnl },
    {
      key: "tplus",
      title: "Lãi T+",
      read: (s) => s.tplusByBucket.VPS + s.tplusByBucket.SSI + s.tplusByBucket.CRYPTO,
    },
  ];
  for (const b of CAPITAL_BUCKETS) {
    const name = BUCKET_LABEL[b];
    out.push({ key: `nav.${b}`, title: `NAV ${name}`, read: (s) => s.navByBucket[b] });
    out.push({ key: `orig.${b}`, title: `Original ${name}`, read: (s) => s.originalByBucket[b] });
    out.push({
      key: `pnl.${b}`,
      title: `Lãi/lỗ ${name}`,
      read: (s) =>
        s.navByBucket[b] -
        (b === "CRYPTO" ? s.usdtNavValue : 0) -
        s.originalByBucket[b],
    });
  }
  return out;
}

function seriesMeta(key: string): { kind: MilestoneKind; bucket: CapitalBucket | "TOTAL" } {
  if (key === "tplus") return { kind: "tplus", bucket: "TOTAL" };
  const [kind, bucket] = key.split(".") as [MilestoneKind, CapitalBucket | undefined];
  return { kind, bucket: bucket ?? "TOTAL" };
}

export function computeMilestones(
  ledger: LedgerSnapshot,
  prices: PriceSnap[],
  fxRows: FxSnap[],
): Milestone[] {
  const dateSet = new Set<string>();
  for (const p of prices) dateSet.add(p.asOf);
  for (const f of fxRows) dateSet.add(f.asOf);
  for (const t of ledger.transactions) {
    if (!t.deletedAt) dateSet.add(t.txDate);
  }
  for (const c of ledger.capital) {
    if (!c.deletedAt) dateSet.add(c.movementDate);
  }
  for (const snapshot of ledger.usdtBalanceHistory) {
    dateSet.add(snapshot.effectiveDate);
  }
  for (const b of ledger.banks) {
    if (b.deletedAt) continue;
    dateSet.add(b.startDate);
    if (b.redeemedAt) dateSet.add(String(b.redeemedAt).slice(0, 10));
  }
  const dates = Array.from(dateSet).sort();
  if (dates.length === 0) return [];

  const series = seriesList();
  const reached: Record<string, number> = {};
  for (const s of series) reached[s.key] = 0;

  const out: Milestone[] = [];
  const runningPx: Record<string, number> = {};
  for (const a of ledger.assets) {
    if (a.currentPrice && a.currentPrice > 0) runningPx[a.id] = a.currentPrice;
  }
  let runningFx = ledger.usdVnd;

  for (const d of dates) {
    for (const p of prices) {
      if (p.asOf === d) runningPx[p.assetId] = p.price;
    }
    const fxHit = fxRows.find((f) => f.asOf === d);
    if (fxHit) runningFx = fxHit.usdVnd;

    const state = replayPortfolio(overlayPrices(sliceLedger(ledger, d), runningPx, runningFx), d);

    for (const s of series) {
      const v = s.read(state);
      if (v < MILESTONE_STEP) continue;
      const maxLv = Math.floor(v / MILESTONE_STEP);
      while (reached[s.key] < maxLv) {
        reached[s.key] += 1;
        const threshold = reached[s.key] * MILESTONE_STEP;
        const meta = seriesMeta(s.key);
        out.push({
          id: `${s.key}:${threshold}:${d}`,
          date: d,
          label: `${s.title} đạt ${threshold / 1_000_000}tr`,
          threshold,
          value: v,
          kind: meta.kind,
          bucket: meta.bucket,
        });
      }
    }
  }

  out.sort((a, b) => b.date.localeCompare(a.date) || b.threshold - a.threshold);
  return out;
}