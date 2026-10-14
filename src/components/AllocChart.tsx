import { displayMoney } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";

const COLORS: Record<string, string> = {
  DCDS: "var(--app-chart-dcds)",
  ETF: "var(--app-chart-etf)",
  STOCK: "var(--app-chart-stock)",
  CRYPTO: "var(--app-chart-crypto)",
  USDT: "var(--app-chart-crypto)",
  BANK: "var(--app-chart-bank)",
  VPS: "var(--app-chart-stock)",
  SSI: "var(--app-chart-bank)",
};

function compactMoney(vnd: number, currency: "VND" | "USD", usdVnd: number): string {
  const n = currency === "USD" ? (usdVnd > 0 ? vnd / usdVnd : 0) : vnd;
  const abs = Math.abs(n);
  const suffix = currency === "USD" ? "$" : "₫";
  if (abs >= 1e12) return `${(n / 1e12).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} nghìn tỷ ${suffix}`;
  if (abs >= 1e9) return `${(n / 1e9).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tỷ ${suffix}`;
  if (abs >= 1e6) return `${(n / 1e6).toLocaleString("vi-VN", { maximumFractionDigits: 2 })} tr ${suffix}`;
  return displayMoney(vnd, currency, usdVnd);
}

export function AllocChart({
  data,
  usdVnd,
}: {
  data: { key: string; label: string; value: number; pct: number }[];
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
    const rows = data;
  const max = Math.max(...rows.map((r) => r.value), 1);

  if (rows.every((r) => r.value <= 0) && !rows.some((r) => r.key === "USDT")) {
    return (
      <div className="grid h-40 place-items-center text-sm text-muted-foreground">Chưa có tài sản</div>
    );
  }

  return (
    <ul className="space-y-2.5">
      {rows.map((r) => {
        const width = r.value > 0 ? Math.max(4, (r.value / max) * 100) : 0;
        return (
          <li
            key={r.key}
            className="group rounded-md px-1 py-1.5 transition-colors hover:bg-muted/60"
          >
            <div className="flex items-center gap-3">
              <span className="flex w-16 shrink-0 items-center gap-2 text-sm font-medium text-foreground">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: COLORS[r.key] ?? "var(--app-navy)" }}
                />
                {r.label}
              </span>

                            <div className="flex min-w-0 flex-1 items-center gap-2">
                <div
                  className="h-3.5 shrink-0 rounded-full"
                  style={{
                    width: `clamp(0px, calc((100% - 9rem) * ${width / 100}), calc(100% - 9rem))`,
                    background: COLORS[r.key] ?? "var(--app-navy)",
                  }}
                />
                <span className="shrink-0 whitespace-nowrap font-mono text-xs tabular-nums text-foreground">
                  {r.value > 0 || r.key === "USDT"
                    ? displayMoney(r.value, currency, usdVnd)
                    : "—"}
                </span>
              </div>

              <span className="w-14 shrink-0 pr-3 text-right font-mono text-sm tabular-nums text-foreground">
                {r.pct.toFixed(1)}%
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}