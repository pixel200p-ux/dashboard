import { AllocChart } from "@/components/AllocChart";
import { BrokerPieChart } from "@/components/BrokerPieChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle, CollapsibleCard } from "@/components/ui/card";
import { formatViDate } from "@/engine/dates";
import { displayMoney, displayPrice } from "@/lib/display";
import { formatQty } from "@/engine/money";
import { deleteTransaction } from "@/lib/api/portfolio";
import { usePortfolio, usePortfolioMutation } from "@/lib/use-portfolio";
import { useUiStore } from "@/lib/ui-store";
import type { AssetType, Transaction } from "@/engine/types";
import { Skeleton } from "@/components/ui/skeleton";
import { NavOriginalCard, PnlCard, TplusLoweredCard } from "@/components/NavOriginalCards";
import { FilterMenu } from "@/components/FilterMenu";
import { Pencil, Trash2 } from "lucide-react";

const TITLE: Record<AssetType, { title: string; sub: string }> = {
  DCDS: { title: "DCDS", sub: "Quỹ mở · số CCQ = tiền / giá, làm tròn 4 số" },
  ETF: { title: "ETF", sub: "Quỹ ETF" },
  STOCK: { title: "Stock", sub: "VPS và SSI độc lập về holdings, giá vốn, P&L và T+" },
  CRYPTO: { title: "Crypto", sub: "Giá USD · tỷ giá VND khóa theo từng lệnh" },
};

export function AssetPage({ assetType }: { assetType: AssetType }) {
  const { data, isPending } = usePortfolio();
  const currency = useUiStore((s) => s.currency);
  const stockFilter = useUiStore((s) => s.stockFilter);
  const setStockFilter = useUiStore((s) => s.setStockFilter);
  const openTx = useUiStore((s) => s.openTx);
  const del = usePortfolioMutation((d: Parameters<typeof deleteTransaction>[0]) => deleteTransaction(d), "Đã xóa lệnh");

  if (isPending || !data) return <Skeleton className="h-64" />;
  const { state, ledger } = data;
  const usd = state.usdVnd;
    const meta = TITLE[assetType];
    const ob = state.originalByBucket;
  const nb = state.navByBucket;
  const tb = state.tplusByBucket;
  let sliceNav = 0;
  let sliceOriginal = 0;
  let sliceName = meta.title;
    const tplusSlice: { key: string; title: string; amount: number; hint: string }[] = [];

  function editTx(t: Transaction) {
    const a = ledger.assets.find((x) => x.id === t.assetId);
    openTx({
      id: t.id,
      accountId: t.accountId,
      symbol: a?.symbol,
      name: a?.name,
      assetType: a?.assetType ?? assetType,
      txType: t.txType,
      tradeTplus: t.tradeTplus,
      price: t.price ?? undefined,
      txDate: t.txDate,
      quantity: t.quantity,
      amount: t.amount,
      fee: t.fee,
      tax: t.tax,
      fxRate: t.fxRate,
      stockDivQty: t.stockDivQty,
      notes: t.notes,
      matches: ledger.matches
        .filter((m) => m.sellTxId === t.id)
        .map((m) => ({ buyTxId: m.buyTxId, quantity: m.quantity })),
    });
  }

  if (assetType === "DCDS") {
    sliceNav = nb.DCDS;
    sliceOriginal = ob.DCDS;
    sliceName = "DCDS";
  } else if (assetType === "ETF") {
    sliceNav = nb.ETF;
    sliceOriginal = ob.ETF;
    sliceName = "ETF";
  } else if (assetType === "CRYPTO") {
    sliceNav = nb.CRYPTO;
    sliceOriginal = ob.CRYPTO;
    sliceName = "Crypto";
    tplusSlice.push({
      key: "crypto",
      title: "T+ đã hạ vốn",
      amount: tb.CRYPTO,
      hint: "Crypto · lợi nhuận T+ ròng đã COMPLETED",
    });
  } else if (assetType === "STOCK") {
    if (stockFilter === "vps") {
      sliceNav = nb.VPS;
      sliceOriginal = ob.VPS;
      sliceName = "VPS";
      tplusSlice.push({
        key: "vps",
        title: "T+ đã hạ vốn",
        amount: tb.VPS,
        hint: "VPS · lợi nhuận T+ ròng đã COMPLETED",
      });
    } else if (stockFilter === "ssi") {
      sliceNav = nb.SSI;
      sliceOriginal = ob.SSI;
      sliceName = "SSI";
      tplusSlice.push({
        key: "ssi",
        title: "T+ đã hạ vốn",
        amount: tb.SSI,
        hint: "SSI · lợi nhuận T+ ròng đã COMPLETED",
      });
    } else {
      sliceNav = nb.VPS + nb.SSI;
      sliceOriginal = ob.VPS + ob.SSI;
      sliceName = "Stock";
      tplusSlice.push(
        {
          key: "vps",
          title: "T+ đã hạ vốn · VPS",
          amount: tb.VPS,
          hint: "VPS · lợi nhuận T+ ròng đã COMPLETED",
        },
        {
          key: "ssi",
          title: "T+ đã hạ vốn · SSI",
          amount: tb.SSI,
          hint: "SSI · lợi nhuận T+ ròng đã COMPLETED",
        },
      );
    }
  }

  const kpiGrid =
    assetType === "STOCK" && stockFilter === "ALL"
      ? "grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 md:items-stretch"
      : tplusSlice.length > 0
        ? "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)] md:items-stretch"
        : "grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-stretch";

  let holdings = state.holdings.filter((h) => h.assetType === assetType);
  if (assetType === "STOCK" && stockFilter !== "ALL") holdings = holdings.filter((h) => h.accountId === stockFilter);

  const txs = ledger.transactions.filter((t) => {
    const a = ledger.assets.find((x) => x.id === t.assetId);
    if (!a || a.assetType !== assetType) return false;
    if (assetType === "STOCK" && stockFilter !== "ALL") return t.accountId === stockFilter;
    return true;
  });

  const totalMarketValue = holdings.reduce((s, x) => s + x.marketValue, 0);
  const pie = [...holdings]
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h) => ({
      key: h.assetId,
      label: h.symbol,
      value: h.marketValue,
      pct: totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0,
    }));

  const vpsPie = [...holdings]
    .filter((h) => h.accountId === "vps")
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h) => {
      const tot = holdings.filter((x) => x.accountId === "vps").reduce((s, x) => s + x.marketValue, 0);
      return { key: h.assetId, label: h.symbol, value: h.marketValue, pct: tot ? (h.marketValue / tot) * 100 : 0 };
    });
  const ssiPie = [...holdings]
    .filter((h) => h.accountId === "ssi")
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h) => {
      const tot = holdings.filter((x) => x.accountId === "ssi").reduce((s, x) => s + x.marketValue, 0);
      return { key: h.assetId, label: h.symbol, value: h.marketValue, pct: tot ? (h.marketValue / tot) * 100 : 0 };
    });
  const originalTotal = ob.VPS + ob.SSI;
  const originalCompare = [
    { key: "VPS", label: "VPS", value: ob.VPS, pct: originalTotal > 0 ? (ob.VPS / originalTotal) * 100 : 0 },
    { key: "SSI", label: "SSI", value: ob.SSI, pct: originalTotal > 0 ? (ob.SSI / originalTotal) * 100 : 0 },
  ];
  const navTotal = nb.VPS + nb.SSI;
  const navCompare = [
    { key: "VPS", label: "VPS", value: nb.VPS, pct: navTotal > 0 ? (nb.VPS / navTotal) * 100 : 0 },
    { key: "SSI", label: "SSI", value: nb.SSI, pct: navTotal > 0 ? (nb.SSI / navTotal) * 100 : 0 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">{meta.title}</h1>
          <p className="text-sm text-muted-foreground">{meta.sub}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {assetType === "STOCK" && (
              <FilterMenu
                value={stockFilter}
                onChange={setStockFilter}
                options={[
                  { id: "ALL", label: "All" },
                  { id: "vps", label: "VPS" },
                  { id: "ssi", label: "SSI" },
                ]}
              />
            )}
          <Button onClick={() => openTx({ assetType, accountId: assetType === "STOCK" ? (stockFilter === "ssi" ? "ssi" : "vps") : undefined, txType: "BUY" })}>
            Buy
          </Button>
              <Button
          variant="outline"
          onClick={() =>
            openTx({
              assetType,
              accountId: assetType === "STOCK" ? (stockFilter === "ssi" ? "ssi" : "vps") : undefined,
              txType: "SELL",
            })
          }
        >
          Sell
        </Button>
        </div>
      </div>
      <div className={kpiGrid}>
        <NavOriginalCard
          title={`NAV / Original ${sliceName}`}
          originalLabel={`Original ${sliceName}`}
          nav={sliceNav}
          original={sliceOriginal}
          usdVnd={usd}
        />
        <PnlCard
          pnl={sliceNav - sliceOriginal}
          original={sliceOriginal}
          subtitle={`NAV − Original ${sliceName}`}
          usdVnd={usd}
        />
        {tplusSlice.map((c) => (
          <TplusLoweredCard key={c.key} title={c.title} amount={c.amount} hint={c.hint} usdVnd={usd} />
        ))}
      </div>
            {assetType === "STOCK" && stockFilter === "ALL" && (
                <div className="flex flex-wrap items-start gap-4">
          <Card className="w-full sm:w-[32rem]">
            <CardTitle>Original VPS / SSI</CardTitle>
            <CardDesc className="mb-3">Vốn gốc theo tài khoản · % trên tổng Original Stock</CardDesc>
            <BrokerPieChart data={originalCompare} usdVnd={usd} centerLabel="Original" />
          </Card>
          <Card className="w-full sm:w-[32rem]">
            <CardTitle>NAV VPS / SSI</CardTitle>
            <CardDesc className="mb-3">Giá trị hiện tại theo tài khoản · % trên tổng NAV Stock</CardDesc>
            <BrokerPieChart data={navCompare} usdVnd={usd} centerLabel="NAV" />
          </Card>
        </div>
      )}
                  {assetType === "STOCK" && (
        <div className="grid gap-4 md:grid-cols-10">
          <Card className={stockFilter === "ssi" ? "md:col-span-3" : stockFilter === "vps" ? "md:col-span-7" : "md:col-span-5"}>
            <CardTitle>VPS</CardTitle>
            <AllocChart data={vpsPie} usdVnd={usd} />
          </Card>
          <Card className={stockFilter === "vps" ? "md:col-span-3" : stockFilter === "ssi" ? "md:col-span-7" : "md:col-span-5"}>
            <CardTitle>SSI</CardTitle>
            <AllocChart data={ssiPie} usdVnd={usd} />
          </Card>
        </div>
      )}

      {assetType === "CRYPTO" && (
        <CollapsibleCard title="Phân bổ mã" defaultOpen>
          <AllocChart
            usdVnd={usd}
            data={pie.map((p) => ({
              ...p,
              key: "CRYPTO",
            }))}
          />
        </CollapsibleCard>
      )}

      <CollapsibleCard
        title="Vị thế"
        description="Giá vốn đã gồm hạ vốn T+ đã COMPLETED"
        defaultOpen
      >
        <HoldingsTable rows={holdings} usdVnd={usd} />
      </CollapsibleCard>

      {assetType === "STOCK" && (() => {
        const dividendRows = holdings
          .filter((h) => Math.abs(h.cashDividend) > 0 || h.stockDividendQty > 0)
          .sort((a, b) => {
            const aTotal = Math.abs(a.cashDividend) + a.stockDividendQty * 1000;
            const bTotal = Math.abs(b.cashDividend) + b.stockDividendQty * 1000;
            return bTotal - aTotal;
          });

        const groups = [
          { key: "vps", label: "VPS", rows: dividendRows.filter((h) => h.accountId === "vps") },
          { key: "ssi", label: "SSI", rows: dividendRows.filter((h) => h.accountId === "ssi") },
        ].filter((group) => group.rows.length > 0);

        if (groups.length === 0) {
          return (
            <CollapsibleCard title="Cổ tức lũy kế" defaultOpen>
              <p className="text-sm text-muted-foreground">Chưa có cổ tức.</p>
            </CollapsibleCard>
          );
        }

        return (
          <CollapsibleCard title="Cổ tức lũy kế" defaultOpen>
            <div className="space-y-5">
              {groups.map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#0F172A] dark:text-white">{group.label}</div>
                  <div className="table-scroll">
                    <table className="w-full text-left text-xs">
                      <thead className="text-[10px] uppercase text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-2 py-2 font-medium">Mã</th>
                          <th className="px-2 py-2 text-right font-medium">Tiền mặt</th>
                          <th className="px-2 py-2 text-right font-medium">CP thưởng</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.rows.map((h) => (
                          <tr key={`${group.key}-${h.assetId}`} className="border-b border-border/70">
                            <td className="px-2 py-2 font-medium">{h.symbol}</td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">
                              {h.cashDividend > 0 ? displayMoney(h.cashDividend, currency, usd) : "—"}
                            </td>
                            <td className="px-2 py-2 text-right font-mono tabular-nums">
                              {h.stockDividendQty > 0 ? formatQty(h.stockDividendQty, "STOCK") : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        );
      })()}

      <CollapsibleCard title="Lịch sử giao dịch" defaultOpen>
        <div className="table-scroll">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2">Ngày</th>
                <th className="px-2 py-2">Mã</th>
                <th className="px-2 py-2">Loại</th>
                <th className="px-2 py-2 text-right">SL</th>
                <th className="px-2 py-2 text-right">Giá</th>
                <th className="px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {txs
                .slice()
                .reverse()
                .map((t) => {
                  const a = ledger.assets.find((x) => x.id === t.assetId);
                  return (
                    <tr key={t.id} className="border-b border-border/70">
                      <td className="px-2 py-2">{formatViDate(t.txDate)}</td>
                      <td className="px-2 py-2 font-medium">
                        {a?.symbol} {t.tradeTplus && <Badge tone="navy">T+</Badge>}
                      </td>
                      <td className="px-2 py-2">{t.txType}</td>
                      <td className="px-2 py-2 text-right font-mono">{t.quantity != null ? formatQty(t.quantity, assetType) : "—"}</td>
                      <td className="px-2 py-2 text-right font-mono">
                        {t.price != null ? displayPrice(t.price, assetType, currency, usd) : displayMoney(t.amount, currency, usd)}
                      </td>
                      <td className="px-2 py-2 text-right">
                                <div className="flex justify-end gap-0.5">
                    <Button size="icon" variant="outline" className="h-8 w-8 min-h-8 p-0" title="Sửa" aria-label="Sửa" onClick={() => editTx(t)}>
                      <Pencil />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 min-h-8 p-0" title="Xóa" aria-label="Xóa" onClick={() => del.mutate({ data: { id: t.id } })}>
                      <Trash2 />
                    </Button>
                  </div>
            </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
          {txs.length === 0 && <p className="py-6 text-center text-sm text-muted-foreground">Chưa có giao dịch.</p>}
        </div>
      </CollapsibleCard>
    </div>
  );
}
