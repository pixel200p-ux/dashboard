import { AllocChart } from "@/components/AllocChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { NavCapitalChart } from "@/components/NavCapitalChart";
import { TplusOpenCard } from "@/components/TplusOpenCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle } from "@/components/ui/card";
import { formatViDate } from "@/engine/dates";
import { NavOriginalCard, PnlCard, TplusLoweredCard } from "@/components/NavOriginalCards";
import { signedClass } from "@/engine/money";
import { displayMoney } from "@/lib/display";
import { usePortfolio, usePortfolioMutation } from "@/lib/use-portfolio";
import { useUiStore } from "@/lib/ui-store";
import { deleteCapital } from "@/lib/api/portfolio";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@tanstack/react-router";
import { FilterMenu } from "@/components/FilterMenu";
import { useState } from "react";

const CAT_ORDER = ["DCDS", "ETF", "STOCK", "CRYPTO", "BANK"] as const;
const CAT_LABEL: Record<string, string> = {
  DCDS: "DCDS",
  ETF: "ETF",
  STOCK: "Stock",
  CRYPTO: "Crypto",
  BANK: "Bank",
};

export function DashboardPage() {
  const { data, isPending } = usePortfolio();
  const currency = useUiStore((s) => s.currency);
  const stockFilter = useUiStore((s) => s.stockFilter);
  const setStockFilter = useUiStore((s) => s.setStockFilter);
  const openCapital = useUiStore((s) => s.openCapital);
  const openCapitalEdit = useUiStore((s) => s.openCapitalEdit);
  const openTx = useUiStore((s) => s.openTx);
  const [showAllCapital, setShowAllCapital] = useState(false);
  const delCapital = usePortfolioMutation(
    (d: Parameters<typeof deleteCapital>[0]) => deleteCapital(d),
    "Đã xóa dòng vốn gốc",
  );

  if (isPending || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  const { state, ledger } = data;
  const usd = state.usdVnd;
  const holdings = state.holdings.filter((h) => {
    if (stockFilter === "ALL") return true;
    if (h.assetType !== "STOCK") return true;
    return h.accountId === stockFilter;
  });

  const alloc = CAT_ORDER.map((k) => ({
    key: k,
    label: CAT_LABEL[k],
    value: state.allocation[k]?.value ?? 0,
    pct: state.allocation[k]?.pct ?? 0,
  }));

  const recent = [...ledger.transactions].sort((a, b) => b.txDate.localeCompare(a.txDate) || b.createdAt.localeCompare(a.createdAt)).slice(0, 8);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Sổ cái thật · Asset-Only Ledger</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => openCapital("DEPOSIT")}>Nạp vốn gốc</Button>
          <Button variant="outline" onClick={() => openCapital("WITHDRAW")}>
            Rút vốn gốc
          </Button>
          <Button variant="outline" onClick={() => openTx()}>
            Giao dịch
          </Button>
        </div>
      </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-stretch">
        <NavOriginalCard
          title="NAV / Original Capital"
          originalLabel="Original Capital"
          nav={state.nav}
          original={state.originalCapital}
          usdVnd={usd}
        />
        <PnlCard
          pnl={state.totalPnl}
          original={state.originalCapital}
          subtitle="NAV − Original Capital"
          usdVnd={usd}
        />
        <TplusLoweredCard
          amount={state.tplusProfit}
          hint="Lợi nhuận T+ ròng đã COMPLETED"
          usdVnd={usd}
        />
      </div>

      {state.tplusCards.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold">T+ đang mở</h2>
              <p className="text-xs text-muted-foreground">
                Qty T+ cộng vào Holdings. Lãi ròng chỉ hạ giá vốn khi Sell đã khớp COMPLETED.
              </p>
            </div>
            <Link to="/tplus" className="text-sm text-primary hover:underline">
              Trade T+
            </Link>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {state.tplusCards.map((c) => (
              <TplusOpenCard key={c.assetId} card={c} usdVnd={usd} />
            ))}
          </div>
        </section>
      )}

            {/* Hàng biểu đồ: Phân bổ (cột ngang) + NAV/Vốn gốc 6 tháng */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <CardTitle>Phân bổ danh mục</CardTitle>
          <CardDesc className="mb-3">DCDS → ETF → Stock → Crypto → Bank · hiển thị % và giá trị</CardDesc>
          <AllocChart data={alloc} usdVnd={usd} />
        </Card>

        <Card className="p-4">
          <CardTitle>NAV &amp; Original Capital</CardTitle>
          <CardDesc className="mb-3">
            6 tháng gần nhất · chỉ các mốc có thay đổi (nạp/rút hoặc giao dịch)
          </CardDesc>
          <NavCapitalChart ledger={ledger} usdVnd={usd} />
        </Card>
      </div>

      {/* Bảng Holdings full chiều ngang */}
      <Card className="p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Holdings</CardTitle>
            <CardDesc>VPS / SSI độc lập · T+ OPEN cộng vào SL</CardDesc>
          </div>
          <div className="flex gap-1">
              <FilterMenu
              value={stockFilter}
              onChange={setStockFilter}
              options={[
                { id: "ALL", label: "All" },
                { id: "vps", label: "VPS" },
                { id: "ssi", label: "SSI" },
              ]}
            />
          </div>
        </div>
        <HoldingsTable rows={holdings} usdVnd={usd} />
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitle>Vốn gốc</CardTitle>
          <CardDesc className="mb-2">Nạp / Rút · Sửa số tiền, ngày, danh mục, ghi chú</CardDesc>
          <ul className="mt-3 space-y-2 text-sm">
            {ledger.capital.length === 0 && (
              <li className="text-muted-foreground">Chưa nạp vốn. Bấm Nạp vốn gốc.</li>
            )}
            {ledger.capital
              .slice()
              .reverse()
              .slice(0, showAllCapital ? undefined : 6)
              .map((c) => (
                <li key={c.id} className="flex flex-wrap items-start justify-between gap-2 border-b border-border/50 pb-2 last:border-0">
                  <span className="min-w-0 flex-1">
                    {formatViDate(c.movementDate)} · {c.kind === "DEPOSIT" ? "Nạp" : "Rút"} · {c.bucket}
                    {c.notes ? (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{c.notes}</span>
                    ) : null}
                  </span>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <span className={c.kind === "DEPOSIT" ? "text-profit" : "text-loss"}>
                      {c.kind === "DEPOSIT" ? "+" : "−"}
                      {displayMoney(c.amount, currency, usd)}
                    </span>
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          openCapitalEdit({
                            id: c.id,
                            kind: c.kind,
                            amount: c.amount,
                            movementDate: c.movementDate,
                            notes: c.notes,
                            bucket: c.bucket,
                          })
                        }
                      >
                        Sửa
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={delCapital.isPending}
                        onClick={() => {
                          if (!window.confirm("Bạn chắc chưa? Xóa dòng vốn gốc này?")) return;
                          delCapital.mutate({ data: { id: c.id } });
                        }}
                      >
                        Xóa
                      </Button>
                    </div>
                  </div>
                </li>
              ))}
          </ul>
          {ledger.capital.length > 6 && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="mt-3 w-full"
              onClick={() => setShowAllCapital((v) => !v)}
            >
              {showAllCapital ? "Thu gọn" : `Xem thêm (${ledger.capital.length - 6} dòng)`}
            </Button>
          )}
        </Card>
        <Card>
          <CardTitle>Giao dịch gần đây</CardTitle>
          <ul className="mt-3 space-y-2 text-sm">
            {recent.length === 0 && <li className="text-muted-foreground">Chưa có lệnh. Sổ cái đang trống.</li>}
            {recent.map((t) => {
              const asset = ledger.assets.find((a) => a.id === t.assetId);
              return (
                <li key={t.id} className="flex justify-between gap-2">
                  <span className="min-w-0 truncate">
                    {formatViDate(t.txDate)} · {t.txType} {asset?.symbol ?? ""} {t.tradeTplus ? <Badge tone="navy">T+</Badge> : null}
                  </span>
                  <span className={`shrink-0 font-mono tabular-nums ${signedClass(t.txType === "SELL" ? 1 : -1)}`}>
                    {t.quantity ?? ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}
