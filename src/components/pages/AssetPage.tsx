import { AllocChart } from "@/components/AllocChart";
import { BrokerPieChart } from "@/components/BrokerPieChart";
import { HoldingsTable } from "@/components/HoldingsTable";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle, CollapsibleCard } from "@/components/ui/card";
import { formatViDate } from "@/engine/dates";
import { displayMoney, displayPrice } from "@/lib/display";
import { formatPct, formatQty, signedClass } from "@/engine/money";
import { usePortfolio } from "@/lib/use-portfolio";
import { useUiStore } from "@/lib/ui-store";
import type { AssetType, Transaction } from "@/engine/types";
import { Skeleton } from "@/components/ui/skeleton";
import { SmartDeleteTransactionDialog } from "@/components/SmartDeleteTransactionDialog";
import { NavOriginalCard, PnlCard, TplusLoweredCard } from "@/components/NavOriginalCards";
import { FilterMenu } from "@/components/FilterMenu";
import { useState, useMemo } from "react";
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
  const [deleteTarget, setDeleteTarget] = useState<{ transaction: Transaction; symbol: string } | null>(null);
  const [txFilterSymbols, setTxFilterSymbols] = useState<string[]>([]);
  const [showTxFilter, setShowTxFilter] = useState(false);
  const [collapsedTxYears, setCollapsedTxYears] = useState<Record<string, boolean>>({});

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

  const activeHoldings = holdings.filter(h => (h.quantity ?? 0) > 1e-12);
  const totalMarketValue = activeHoldings.reduce((s, x) => s + x.marketValue, 0);
  const pie = [...activeHoldings]
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h) => ({
      key: h.assetId,
      label: h.symbol,
      value: h.marketValue,
      pct: totalMarketValue > 0 ? (h.marketValue / totalMarketValue) * 100 : 0,
    }));

  const vpsPie = [...activeHoldings]
    .filter((h) => h.accountId === "vps")
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h) => {
      const tot = activeHoldings.filter((x) => x.accountId === "vps").reduce((s, x) => s + x.marketValue, 0);
      return { key: h.assetId, label: h.symbol, value: h.marketValue, pct: tot ? (h.marketValue / tot) * 100 : 0 };
    });
  const ssiPie = [...activeHoldings]
    .filter((h) => h.accountId === "ssi")
    .sort((a, b) => b.marketValue - a.marketValue)
    .map((h) => {
      const tot = activeHoldings.filter((x) => x.accountId === "ssi").reduce((s, x) => s + x.marketValue, 0);
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
      <SmartDeleteTransactionDialog
        transaction={deleteTarget?.transaction ?? null}
        symbol={deleteTarget?.symbol ?? ""}
        onClose={() => setDeleteTarget(null)}
      />
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

      {assetType === "DCDS" || assetType === "ETF" ? (() => {
        const openLots = [];
        for (const h of holdings) {
          const assetTxs = txs
            .filter((t) => t.assetId === h.assetId)
            .sort((a, b) => a.txDate.localeCompare(b.txDate) || a.createdAt.localeCompare(b.createdAt));
          const buys = assetTxs.filter((t) => t.txType === "BUY").map((t) => ({ ...t, remaining: t.quantity || 0 }));
          const sells = assetTxs.filter((t) => t.txType === "SELL");

          for (const sell of sells) {
            let sellQty = sell.quantity || 0;
            for (const buy of buys) {
              if (sellQty <= 0) break;
              if (buy.remaining > 0) {
                const take = Math.min(buy.remaining, sellQty);
                buy.remaining -= take;
                sellQty -= take;
              }
            }
          }

          openLots.push(
            ...buys
              .filter((b) => b.remaining > 1e-12)
              .map((b) => ({
                ...b,
                symbol: h.symbol,
                currentPrice: h.currentPrice,
              }))
          );
        }

        const totalQty = openLots.reduce((s, b) => s + b.remaining, 0);
        const totalCost = openLots.reduce((s, b) => s + b.remaining * (b.price || 0), 0);
        const avgCost = totalQty > 0 ? totalCost / totalQty : 0;

        return (
          <CollapsibleCard
            title="Vị thế"
            description={`Tổng số lượng: ${formatQty(totalQty, assetType)} · Giá vốn TB: ${displayPrice(avgCost, assetType, currency, usd)}`}
            defaultOpen
          >
            <div className="table-scroll">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="px-2 py-2 font-medium">Ngày</th>
                    <th className="px-2 py-2 font-medium text-right">SL</th>
                    <th className="px-2 py-2 font-medium text-right">Giá mua</th>
                    <th className="px-2 py-2 font-medium text-right">Lãi/lỗ</th>
                    <th className="px-2 py-2 font-medium text-right">NAV</th>
                    <th className="px-2 py-2 font-medium text-right">P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {openLots.map((b) => {
                    const price = b.price || 0;
                    const navVal = b.remaining * b.currentPrice;
                    const pnl = b.remaining * (b.currentPrice - price);
                    const costBasis = b.remaining * price;
                    const pct = costBasis > 0 ? (pnl / costBasis) * 100 : 0;
                    return (
                      <tr key={b.id} className="border-b border-border/70 hover:bg-muted/50">
                        <td className="px-2 py-2 font-medium">{formatViDate(b.txDate)}</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">{formatQty(b.remaining, assetType)}</td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">{displayPrice(price, assetType, currency, usd)}</td>
                        <td className={`px-2 py-2 text-right font-mono tabular-nums ${signedClass(pnl)}`}>
                          {formatPct(pct)}
                        </td>
                        <td className="px-2 py-2 text-right font-mono tabular-nums">{displayMoney(navVal, currency, usd)}</td>
                        <td className={`px-2 py-2 text-right font-mono tabular-nums ${signedClass(pnl)}`}>
                          {displayMoney(pnl, currency, usd)}
                        </td>
                      </tr>
                    );
                  })}
                  {openLots.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-sm text-muted-foreground">
                        Chưa có vị thế.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CollapsibleCard>
        );
      })() : (
        <CollapsibleCard
          title="Vị thế"
          description="Giá vốn đã gồm hạ vốn T+ đã COMPLETED"
          defaultOpen
        >
          <HoldingsTable rows={holdings} usdVnd={usd} />
        </CollapsibleCard>
      )}

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
                  <div className="hidden sm:block">
                    <table className="w-full table-fixed text-left text-xs">
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
                  <div className="space-y-2 sm:hidden">
                    {group.rows.map((h) => (
                      <div
                        key={`${group.key}-${h.assetId}`}
                        className="grid grid-cols-[minmax(0,0.55fr)_minmax(0,1fr)_minmax(0,0.85fr)] items-center gap-1.5 border-b border-border/70 py-2 text-[11px] last:border-0"
                      >
                        <span className="min-w-0 truncate font-semibold">{h.symbol}</span>
                        <span className="min-w-0 text-right">
                          <span className="block text-[9px] text-muted-foreground">Tiền mặt</span>
                          <span className="break-words font-mono tabular-nums">
                            {h.cashDividend > 0 ? displayMoney(h.cashDividend, currency, usd) : "—"}
                          </span>
                        </span>
                        <span className="min-w-0 text-right">
                          <span className="block text-[9px] text-muted-foreground">CP thưởng</span>
                          <span className="break-words font-mono tabular-nums">
                            {h.stockDividendQty > 0 ? formatQty(h.stockDividendQty, "STOCK") : "—"}
                          </span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleCard>
        );
      })()}

      {(() => {
        const txSymbols = Array.from(new Set(txs.map(t => ledger.assets.find(a => a.id === t.assetId)?.symbol).filter(Boolean) as string[])).sort();
        const filteredTxs = txFilterSymbols.length > 0 
          ? txs.filter(t => {
              const a = ledger.assets.find(a => a.id === t.assetId);
              return a && txFilterSymbols.includes(a.symbol);
            }) 
          : txs;
        const sortedTxs = filteredTxs
          .slice()
          .sort((a, b) => b.txDate.localeCompare(a.txDate) || b.createdAt.localeCompare(a.createdAt));
        const transactionYears: { year: string; items: Transaction[] }[] = [];
        for (const transaction of sortedTxs) {
          const year = transaction.txDate.slice(0, 4);
          const last = transactionYears[transactionYears.length - 1];
          if (last?.year === year) last.items.push(transaction);
          else transactionYears.push({ year, items: [transaction] });
        }

        return (
          <CollapsibleCard 
            title="Lịch sử giao dịch" 
            defaultOpen={false}
            headerAction={
              (assetType === "STOCK" || assetType === "CRYPTO") && txSymbols.length > 0 ? (
                <Button
                  size="sm"
                  variant={txFilterSymbols.length > 0 ? "secondary" : "ghost"}
                  className="h-8 text-xs px-3 font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowTxFilter(prev => !prev);
                  }}
                >
                  {txFilterSymbols.length > 0 ? `Đã lọc (${txFilterSymbols.length})` : "Lọc mã"}
                </Button>
              ) : undefined
            }
          >
            {showTxFilter && (assetType === "STOCK" || assetType === "CRYPTO") && txSymbols.length > 0 && (
              <div className="flex flex-wrap gap-1.5 p-3 border-b border-border bg-muted/20">
                <span className="text-xs text-muted-foreground self-center mr-1">Lọc theo:</span>
                {txSymbols.map((sym) => {
                  const active = txFilterSymbols.includes(sym);
                  return (
                    <Button
                      key={sym}
                      size="sm"
                      variant={active ? "default" : "outline"}
                      className="h-7 text-xs rounded-full px-3"
                      onClick={() => setTxFilterSymbols(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym])}
                    >
                      {sym}
                    </Button>
                  );
                })}
                {txFilterSymbols.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs rounded-full px-3 text-muted-foreground hover:text-foreground"
                    onClick={() => setTxFilterSymbols([])}
                  >
                    Bỏ lọc
                  </Button>
                )}
              </div>
            )}
            <div className="table-scroll max-h-125 overflow-y-auto p-4">
              {transactionYears.length === 0 ? (
                <p className="rounded-xl border border-dashed border-[#94A3B8] bg-[#CDD5DF] px-3 py-6 text-center text-sm text-[#64748B] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                  Chưa có giao dịch.
                </p>
              ) : (
                <div className="space-y-4">
                  {transactionYears.map((group) => {
                    const byDate = group.items.reduce<Record<string, Transaction[]>>((acc, transaction) => {
                      acc[transaction.txDate] ??= [];
                      acc[transaction.txDate].push(transaction);
                      return acc;
                    }, {});
                    const isCollapsed = !!collapsedTxYears[group.year];

                    return (
                      <section key={group.year} className="relative last:mb-0">
                        <div className="relative flex items-center gap-2 pl-1">
                          <div className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-[#CBD5E1] dark:bg-[#334155]" />
                          <div className="absolute left-[calc(100%-0.2rem)] top-1/2 h-px w-4 -translate-y-1/2 bg-[#CBD5E1] dark:bg-[#334155]" />
                          <button
                            type="button"
                            aria-expanded={!isCollapsed}
                            onClick={() => setCollapsedTxYears((prev) => ({ ...prev, [group.year]: !prev[group.year] }))}
                            className="relative z-10 flex items-center rounded-xl border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-left shadow-sm transition hover:bg-[#1E293B] dark:border-[#94A3B8] dark:bg-[#354969] dark:hover:bg-[#475569]"
                          >
                            <span className="text-[11px] font-bold tabular-nums tracking-[0.14em] text-white">
                              {group.year}
                            </span>
                          </button>
                        </div>

                        {!isCollapsed && (
                          <div className="relative mt-2 ml-4 border-l border-[#CBD5E1] pl-3 dark:border-[#334155]">
                            {Object.entries(byDate).map(([date, transactions]) => (
                              <div key={date} className="pb-6 last:pb-0">
                                <div className="flex items-center gap-2 text-[11px] font-semibold tabular-nums tracking-[0.08em] text-[#475569] dark:text-[#94A3B8]">
                                  <span className="inline-block h-2 w-2 rounded-full bg-[#94A3B8] dark:bg-[#64748B]" />
                                  <span>{date.slice(5).replace("-", "/")}</span>
                                </div>

                                <div className="mt-1 ml-4 border-l border-[#E2E8F0] pl-3 dark:border-[#334155]">
                                  {transactions.map((transaction) => {
                                    const asset = ledger.assets.find((item) => item.id === transaction.assetId);
                                    const typeLabel = transaction.txType === "BUY"
                                      ? "MUA"
                                      : transaction.txType === "SELL"
                                        ? "BÁN"
                                        : transaction.txType === "CASH_DIVIDEND"
                                          ? "CỔ TỨC TIỀN"
                                          : "CỔ TỨC CỔ PHIẾU";
                                    const tone = transaction.txType === "BUY"
                                      ? "profit"
                                      : transaction.txType === "SELL"
                                        ? "loss"
                                        : "muted";

                                    return (
                                      <div key={transaction.id} className="relative py-1 pl-3.5">
                                        <span className="absolute left-0 top-[0.8rem] h-1 w-1 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                                        <div className="flex items-start justify-between gap-3">
                                          <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                              <Badge tone={tone}>{typeLabel}</Badge>
                                              <span className="text-xs font-semibold text-[#0F172A] dark:text-white">
                                                {asset?.symbol ?? "—"}
                                              </span>
                                              {transaction.tradeTplus && <Badge tone="navy">T+</Badge>}
                                            </div>
                                            <p className="mt-1 text-xs leading-5 text-[#475569] dark:text-[#CBD5E1]">
                                              SL {transaction.quantity != null ? formatQty(transaction.quantity, assetType) : "—"}
                                              {" · "}
                                              {transaction.price != null
                                                ? displayPrice(transaction.price, assetType, currency, usd)
                                                : displayMoney(transaction.amount, currency, usd)}
                                            </p>
                                          </div>
                                          <div className="flex shrink-0 gap-1">
                                            <Button
                                              size="icon"
                                              variant="outline"
                                              className="h-8 w-8 min-h-8 p-0"
                                              title="Sửa"
                                              aria-label="Sửa"
                                              onClick={() => editTx(transaction)}
                                            >
                                              <Pencil />
                                            </Button>
                                            <Button
                                              size="icon"
                                              variant="ghost"
                                              className="h-8 w-8 min-h-8 p-0"
                                              title="Xóa"
                                              aria-label="Xóa"
                                              onClick={() => setDeleteTarget({ transaction, symbol: asset?.symbol ?? "" })}
                                            >
                                              <Trash2 />
                                            </Button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </section>
                    );
                  })}
                </div>
              )}
            </div>
      </CollapsibleCard>
        );
      })()}
    </div>
  );
}
