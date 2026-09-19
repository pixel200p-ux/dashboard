import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { replayPortfolio } from "@/engine/replay";
import type { LedgerSnapshot } from "@/engine/types";
import { displayMoney } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";
import { formatViDate, todayYmd, toDate, ymd } from "@/engine/dates";
import { subMonths } from "date-fns";

type Point = {
  date: string;
  label: string;
  nav: number;
  originalCapital: number;
};

function buildHistory(ledger: LedgerSnapshot, months = 6): Point[] {
  const end = todayYmd();
  const startDate = ymd(subMonths(toDate(end), months));
  const dateSet = new Set<string>();
  for (const c of ledger.capital) {
    if (!c.deletedAt && c.movementDate >= startDate) dateSet.add(c.movementDate);
  }
  for (const t of ledger.transactions) {
    if (!t.deletedAt && t.txDate >= startDate) dateSet.add(t.txDate);
  }
  dateSet.add(end);

  const points: Point[] = [];
  for (const d of Array.from(dateSet).sort()) {
    const sliced: LedgerSnapshot = {
      ...ledger,
      capital: ledger.capital.filter((c) => !c.deletedAt && c.movementDate <= d),
      transactions: ledger.transactions.filter((t) => !t.deletedAt && t.txDate <= d),
      matches: ledger.matches.filter((m) => {
        const sell = ledger.transactions.find((t) => t.id === m.sellTxId);
        return Boolean(sell && !sell.deletedAt && sell.txDate <= d);
      }),
      banks: ledger.banks.filter((b) => !b.deletedAt && b.startDate <= d),
    };
    const state = replayPortfolio(sliced, d);
    points.push({
      date: d,
      label: formatViDate(d),
      nav: state.nav,
      originalCapital: state.originalCapital,
    });
  }
  return points;
}

function ChartTip({
  active,
  payload,
  label,
  usdVnd,
}: {
  active?: boolean;
  payload?: { dataKey?: string; value?: number }[];
  label?: string;
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
  if (!active || !payload?.length) return null;
  const nav = payload.find((p) => p.dataKey === "nav")?.value ?? 0;
  const cap = payload.find((p) => p.dataKey === "originalCapital")?.value ?? 0;
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground shadow-md">
      <p className="mb-1.5 font-medium">{label}</p>
      <p className="flex justify-between gap-6">
        <span className="text-muted-foreground">NAV</span>
        <span className="font-mono tabular-nums">{displayMoney(nav, currency, usdVnd)}</span>
      </p>
      <p className="mt-0.5 flex justify-between gap-6">
        <span className="text-muted-foreground">Original Capital</span>
        <span className="font-mono tabular-nums">{displayMoney(cap, currency, usdVnd)}</span>
      </p>
    </div>
  );
}

export function NavCapitalChart({
  ledger,
  usdVnd,
}: {
  ledger: LedgerSnapshot;
  usdVnd: number;
}) {
  const data = buildHistory(ledger, 6);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (data.length === 0) {
    return (
      <div className="grid h-48 place-items-center text-sm text-muted-foreground">
        Chưa có dữ liệu trong 6 tháng
      </div>
    );
  }

  return (
        <div className="mx-auto h-[260px] w-full text-muted-foreground">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={data}
          margin={
            isMobile
              ? { top: 8, right: 36, left: 0, bottom: 4 }
              : { top: 8, right: 12, left: 4, bottom: 8 }
          }
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--app-border)" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "var(--app-fg-muted)" }}
            axisLine={{ stroke: "var(--app-border)" }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={28}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--app-fg-muted)" }}
            axisLine={false}
            tickLine={false}
            width={isMobile ? 36 : 72}
            tickFormatter={(v) => {
              const n = Number(v);
              if (!Number.isFinite(n)) return "";
              if (Math.abs(n) >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
              if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
              if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`;
              return String(Math.round(n));
            }}
          />
                    <Tooltip
            cursor={{ stroke: "var(--app-border)", strokeDasharray: "4 4" }}
                        content={({ active, payload, label }) => (
              <ChartTip
                active={active}
                payload={payload as { dataKey?: string; value?: number }[] | undefined}
                label={String(label ?? "")}
                usdVnd={usdVnd}
              />
            )}
          />
          <Legend
            verticalAlign="top"
            align="center"
            height={28}
            wrapperStyle={
              isMobile
                ? { color: "var(--app-fg-muted)", left: 0, width: "100%" }
                : { color: "var(--app-fg-muted)" }
            }
            formatter={(value) => (value === "nav" ? "NAV" : "Original Capital")}
          />
          <Line
            type="monotone"
            dataKey="nav"
            name="nav"
            stroke="var(--app-navy)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--app-navy)", strokeWidth: 0 }}
                        activeDot={{ r: 5, fill: "var(--app-navy)", stroke: "var(--app-surface)", strokeWidth: 2 }}
          />
          <Line
            type="monotone"
            dataKey="originalCapital"
            name="originalCapital"
                        stroke="var(--app-fg-muted)"
            strokeWidth={2}
            strokeDasharray="5 4"
            dot={{ r: 3, fill: "var(--app-fg-muted)", strokeWidth: 0 }}
            activeDot={{ r: 5, fill: "var(--app-fg-muted)", stroke: "var(--app-surface)", strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}