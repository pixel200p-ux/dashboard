import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { displayMoney } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import type { CapitalBucket } from "@/engine/types";

const COLORS: Record<string, string> = {
  DCDS: "var(--app-chart-dcds)",
  ETF: "var(--app-chart-etf)",
  STOCK: "var(--app-chart-stock)",
  CRYPTO: "var(--app-chart-crypto)",
  BANK: "var(--app-chart-bank)",
};

const ROWS = [
  { key: "DCDS", label: "DCDS" },
  { key: "ETF", label: "ETF" },
  { key: "STOCK", label: "Stock" },
  { key: "CRYPTO", label: "Crypto" },
  { key: "BANK", label: "Bank" },
] as const;

export function DepositCapitalButton({
  originalByBucket,
  usdVnd,
  onDeposit,
}: {
  originalByBucket: Record<CapitalBucket, number>;
  usdVnd: number;
  onDeposit: () => void;
}) {
  const currency = useUiStore((s) => s.currency);
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0, caret: 16 });

  const rows = ROWS.map((r) => {
    const value =
      r.key === "STOCK"
        ? (originalByBucket.VPS ?? 0) + (originalByBucket.SSI ?? 0)
        : originalByBucket[r.key];
    return { ...r, value };
  });
  const max = Math.max(...rows.map((r) => r.value), 1);
  const total = rows.reduce((s, r) => s + r.value, 0);

  function place() {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = 260;
    const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
    const top = r.bottom + 8;
    const caret = Math.min(width - 16, Math.max(16, r.left + r.width / 2 - left));
    setPos({ top, left, caret });
  }

  useEffect(() => {
    if (!open) return;
    place();
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (btn.current?.contains(t) || panel.current?.contains(t)) return;
      setOpen(false);
    }
    function onWin() {
      place();
    }
    document.addEventListener("mousedown", onDoc);
    window.addEventListener("resize", onWin);
    window.addEventListener("scroll", onWin, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      window.removeEventListener("resize", onWin);
      window.removeEventListener("scroll", onWin, true);
    };
  }, [open]);

  return (
    <div className="inline-flex overflow-hidden rounded-md">
      <button
        ref={btn}
        type="button"
        title="Vốn gốc theo danh mục"
        aria-label="Vốn gốc theo danh mục"
        aria-expanded={open}
        onClick={() => {
          place();
          setOpen((v) => !v);
        }}
        className="inline-flex h-10 min-h-10 w-9 items-center justify-center bg-primary text-primary-foreground hover:opacity-90"
      >
        <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      <Button className="rounded-none border-l border-primary-foreground/20" onClick={onDeposit}>
        Nạp vốn gốc
      </Button>
      {open &&
        createPortal(
          <div
            ref={panel}
            style={{ top: pos.top, left: pos.left, width: 260 }}
            className="fixed z-[80] rounded-lg border border-border bg-card p-3 shadow-[var(--shadow-card)]"
          >
            <span
              className="absolute -top-1.5 h-3 w-3 border-l border-t border-border bg-card"
              style={{ left: pos.caret, transform: "translateX(-50%) rotate(45deg)" }}
            />
            <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              Vốn gốc đã nạp
            </p>
            <p className="mt-1 font-mono text-sm font-semibold tabular-nums">
              {displayMoney(total, currency, usdVnd)}
            </p>
            <ul className="mt-3 space-y-2">
              {rows.map((r) => (
                <li key={r.key}>
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ background: COLORS[r.key] }}
                      />
                      {r.label}
                    </span>
                    <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                      {r.value > 0 ? displayMoney(r.value, currency, usdVnd) : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${r.value > 0 ? Math.max(6, (r.value / max) * 100) : 0}%`,
                        background: COLORS[r.key],
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )}
    </div>
  );
}