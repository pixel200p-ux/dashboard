import { Card } from "@/components/ui/card";
import { formatPct, formatUsd } from "@/engine/money";
import { displayMoney } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";

export function NavOriginalCard({
  title,
  originalLabel,
  nav,
  original,
  usdVnd,
  originalUsd,
}: {
  title: string;
  originalLabel: string;
  nav: number;
  original: number;
  usdVnd: number;
  originalUsd?: number;
}) {
  const currency = useUiStore((s) => s.currency);
  const originalForDisplay =
    currency === "USD" && originalUsd != null ? originalUsd * usdVnd : original;
  const barPct =
    originalForDisplay > 0 ? Math.min(100, (nav / originalForDisplay) * 100) : nav > 0 ? 100 : 0;

  return (
    <Card className="flex flex-col p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <div className="mt-3 flex items-end justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] text-muted-foreground">NAV</p>
          <p className="truncate font-mono text-xl font-semibold tabular-nums tracking-tight">
            {displayMoney(nav, currency, usdVnd)}
          </p>
        </div>
        <span className="mb-0.5 shrink-0 text-lg font-light text-muted-foreground/40">/</span>
        <div className="min-w-0 flex-1 text-right">
          <p className="text-[11px] text-muted-foreground">{originalLabel}</p>
          <p className="truncate font-mono text-sm font-medium tabular-nums text-muted-foreground">
            {currency === "USD" && originalUsd != null
              ? formatUsd(originalUsd)
              : displayMoney(original, currency, usdVnd)}
          </p>
        </div>
      </div>
      <div className="mt-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full ${nav >= original ? "bg-profit" : "bg-loss"}`}
            style={{ width: `${barPct}%` }}
          />
        </div>
      </div>
      <p className="mt-auto flex items-center justify-between gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground">
        <span>Tỷ lệ NAV trên vốn gốc</span>
        <span className="shrink-0 font-mono tabular-nums">
          {original > 0
            ? `${(nav / originalForDisplay).toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}×`
            : "—"}
        </span>
      </p>
    </Card>
  );
}

export function PnlCard({
  pnl,
  original,
  subtitle,
  usdVnd,
  pnlUsd,
  originalUsd,
}: {
  pnl: number;
  original: number;
  subtitle: string;
  usdVnd: number;
  pnlUsd?: number;
  originalUsd?: number;
}) {
  const currency = useUiStore((s) => s.currency);
  const displayPnl =
    currency === "USD" && pnlUsd != null ? pnlUsd : pnl;
  const displayOriginal =
    currency === "USD" && originalUsd != null ? originalUsd : original;
  const pct = displayOriginal > 0 ? (displayPnl / displayOriginal) * 100 : 0;

  return (
    <Card className="flex flex-col p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        Lãi / lỗ
      </p>
      <p
        className={`mt-3 font-mono text-xl font-semibold tabular-nums ${
          displayPnl > 0 ? "text-profit" : displayPnl < 0 ? "text-loss" : ""
        }`}
      >
        {currency === "USD" && pnlUsd != null
          ? formatUsd(pnlUsd)
          : displayMoney(pnl, currency, usdVnd)}
      </p>
      {displayOriginal > 0 ? (
        <p className="mt-1 font-mono text-sm tabular-nums text-muted-foreground">{formatPct(pct)}</p>
      ) : (
        <p className="mt-1 text-sm text-transparent">.</p>
      )}
      <p className="mt-auto border-t border-border pt-3 text-[11px] leading-snug text-muted-foreground">
        {subtitle}
      </p>
    </Card>
  );
}

export function TplusLoweredCard({
  title = "T+ đã hạ vốn",
  amount,
  hint,
  usdVnd,
}: {
  title?: string;
  amount: number;
  hint: string;
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
  return (
    <Card className="flex flex-col p-4">
      <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </p>
      <p className="mt-3 font-mono text-xl font-semibold tabular-nums">
        {displayMoney(amount, currency, usdVnd)}
      </p>
      <p className="mt-1 text-sm text-transparent">.</p>
      <p className="mt-auto border-t border-border pt-3 text-[11px] leading-snug text-muted-foreground">
        {hint}
      </p>
    </Card>
  );
}