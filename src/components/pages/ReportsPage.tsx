import { Kpi } from "@/components/Kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatViDate } from "@/engine/dates";
import { formatPct, formatQty, signedClass } from "@/engine/money";
import type { CapitalBucket, HoldingView, Transaction } from "@/engine/types";
import { displayMoney, displayPrice } from "@/lib/display";
import { SmartDeleteTransactionDialog } from "@/components/SmartDeleteTransactionDialog";
import {
  buildReportRows,
  filterReportRows,
  REPORT_BUCKETS,
  REPORT_KINDS,
  type ReportKind,
} from "@/lib/report-history";
import { usePortfolio } from "@/lib/use-portfolio";
import { usePortfolioMutation } from "@/lib/use-portfolio";
import { deleteCapital, deleteBank } from "@/lib/api/portfolio";
import { useUiStore } from "@/lib/ui-store";
import { askEditPin } from "@/lib/edit-pin";
import { Pencil, Trash2, TrendingUp, TrendingDown } from "lucide-react";
import { useMemo, useState } from "react";

function RealizedProfitCard({ holding, currency, usd }: { holding: HoldingView; currency: string; usd: number }) {
  const totalPnl = holding.realizedTradePnl + holding.tplusProfitCompleted + holding.cashDividend;
  const pnlPct = holding.totalInvested > 0 ? (totalPnl / holding.totalInvested) * 100 : 0;
  const isProfit = totalPnl >= 0;

  return (
    <div className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold">{holding.symbol}</span>
        <Badge variant="outline" className={isProfit ? "border-emerald-500 text-emerald-600" : "border-rose-500 text-rose-600"}>
          {isProfit ? <TrendingUp className="mr-1 h-3 w-3" /> : <TrendingDown className="mr-1 h-3 w-3" />}
          {formatPct(pnlPct)}
        </Badge>
      </div>
      <div className="mt-1 flex flex-col">
        <span className="text-xs text-muted-foreground uppercase tracking-wider">Tổng Lãi/Lỗ</span>
        <span className={`text-xl font-mono font-bold ${signedClass(totalPnl)}`}>
          {displayMoney(totalPnl, currency, usd)}
        </span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground border-t border-border/50 pt-2">
        <div>
          <span>Vốn: </span>
          <span className="font-mono">{displayMoney(holding.totalInvested, currency, usd)}</span>
        </div>
        <div className="text-right">
          <span>Cổ tức: </span>
          <span className="font-mono text-emerald-600">{displayMoney(holding.cashDividend, currency, usd)}</span>
        </div>
      </div>
    </div>
  );
}

export function ReportsPage() {
  const { data, isPending } = usePortfolio();
  const currency = useUiStore((s) => s.currency);
  const openTx = useUiStore((s) => s.openTx);
  const openCapitalEdit = useUiStore((s) => s.openCapitalEdit);
  const openBank = useUiStore((s) => s.openBank);
  const deleteCapitalMut = usePortfolioMutation((d: Parameters<typeof deleteCapital>[0]) => deleteCapital(d), "Đã xóa dòng vốn");
  const deleteBankMut = usePortfolioMutation((d: Parameters<typeof deleteBank>[0]) => deleteBank(d), "Đã xóa sổ");
  const [deleteTarget, setDeleteTarget] = useState<{ transaction: Transaction; symbol: string } | null>(null);
  const [bucket, setBucket] = useState<"ALL" | CapitalBucket>("ALL");
  const [kind, setKind] = useState<"ALL" | ReportKind>("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const allRows = useMemo(() => (data ? buildReportRows(data.ledger, data.state.asOf) : []), [data]);
  const rows = useMemo(
    () => filterReportRows(allRows, { bucket, kind, from, to }),
    [allRows, bucket, kind, from, to],
  );

  if (isPending || !data) return <Skeleton className="h-64" />;
  const s = data.state;
  const usd = s.usdVnd;

  const sumIn = rows.filter((r) => r.kind === "DEPOSIT").reduce((n, r) => n + r.amount, 0);
  const sumOut = rows.filter((r) => r.kind === "WITHDRAW").reduce((n, r) => n + r.amount, 0);

  // Filter holdings with quantity = 0 and have some trading activity
  const liquidatedHoldings = s.holdings.filter((h) => Math.abs(h.quantity) < 1e-12 && h.totalInvested > 0);

  const vpsLiquidated = liquidatedHoldings.filter((h) => h.accountId === "vps");
  const ssiLiquidated = liquidatedHoldings.filter((h) => h.accountId === "ssi");
  const cryptoLiquidated = liquidatedHoldings.filter((h) => h.assetType === "CRYPTO");

  return (
    <div className="space-y-5">
      <SmartDeleteTransactionDialog
        transaction={deleteTarget?.transaction ?? null}
        symbol={deleteTarget?.symbol ?? ""}
        onClose={() => setDeleteTarget(null)}
      />
      <div>
        <h1 className="text-4xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">Sổ lịch sử toàn danh mục · sửa/xóa cần mã bảo vệ 6 số</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="col-span-2 min-w-0 sm:col-span-1">
          <Kpi label="Original Capital" value={displayMoney(s.originalCapital, currency, usd)} />
        </div>
        <div className="min-w-0">
          <Kpi label="NAV" value={displayMoney(s.nav, currency, usd)} />
        </div>
        <div className="min-w-0">
          <Kpi
            label="Hiệu suất"
            value={s.originalCapital > 0 ? formatPct(s.totalReturnPct) : displayMoney(s.totalPnl, currency, usd)}
            hint={s.originalCapital > 0 ? displayMoney(s.totalPnl, currency, usd) : "Original Capital = 0 · toàn bộ NAV là lãi/lỗ"}
            tone={s.totalPnl > 0 ? "profit" : s.totalPnl < 0 ? "loss" : "default"}
          />
        </div>
      </div>

      {liquidatedHoldings.length > 0 && (
        <Card className="p-4">
          <CardTitle className="mb-4">Báo cáo mã đã tất toán (Realized P&L)</CardTitle>
          <Tabs defaultValue="vps">
            <TabsList className="mb-4">
              <TabsTrigger value="vps">Stock (VPS)</TabsTrigger>
              <TabsTrigger value="ssi">Stock (SSI)</TabsTrigger>
              <TabsTrigger value="crypto">Crypto</TabsTrigger>
            </TabsList>
            <TabsContent value="vps">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {vpsLiquidated.length > 0 ? (
                  vpsLiquidated.map((h) => <RealizedProfitCard key={h.assetId} holding={h} currency={currency} usd={usd} />)
                ) : (
                  <p className="text-sm text-muted-foreground col-span-full py-4 text-center">Chưa có mã VPS nào tất toán</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="ssi">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {ssiLiquidated.length > 0 ? (
                  ssiLiquidated.map((h) => <RealizedProfitCard key={h.assetId} holding={h} currency={currency} usd={usd} />)
                ) : (
                  <p className="text-sm text-muted-foreground col-span-full py-4 text-center">Chưa có mã SSI nào tất toán</p>
                )}
              </div>
            </TabsContent>
            <TabsContent value="crypto">
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {cryptoLiquidated.length > 0 ? (
                  cryptoLiquidated.map((h) => <RealizedProfitCard key={h.assetId} holding={h} currency={currency} usd={usd} />)
                ) : (
                  <p className="text-sm text-muted-foreground col-span-full py-4 text-center">Chưa có mã Crypto nào tất toán</p>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </Card>
      )}

      <Card>

        <CardTitle>Lịch sử</CardTitle>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <Label>Danh mục</Label>
            <Select
              value={bucket}
              onValueChange={(v) => setBucket(v as "ALL" | CapitalBucket)}
              options={REPORT_BUCKETS}
            />
          </div>
          <div className="space-y-1">
            <Label>Loại</Label>
            <Select
              value={kind}
              onValueChange={(v) => setKind(v as "ALL" | ReportKind)}
              options={REPORT_KINDS}
            />
          </div>
          <div className="space-y-1">
            <Label>Từ ngày</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Đến ngày</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {rows.length} lệnh giao dịch
            {sumIn !== 0 || sumOut !== 0
              ? ` · Nạp ${displayMoney(sumIn, currency, usd)} · Rút ${displayMoney(sumOut, currency, usd)}`
              : ""}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              setBucket("ALL");
              setKind("ALL");
              setFrom("");
              setTo("");
            }}
          >
            Xóa bộ lọc
          </Button>
        </div>

        <div className="table-scroll mt-3 max-h-125 overflow-y-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 z-10 bg-card text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="w-12 px-2 py-2">STT</th>
                <th className="px-2 py-2">Ngày</th>
                <th className="px-2 py-2">Danh mục</th>
                <th className="px-2 py-2">Mã</th>
                <th className="px-2 py-2">Loại</th>
                <th className="px-2 py-2 text-right">SL</th>
                <th className="px-2 py-2 text-right">Giá</th>
                <th className="px-2 py-2 text-right">Số tiền</th>
                <th className="px-2 py-2">Ghi chú</th>
                <th className="w-24 px-2 py-2 text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, idx) => (
                <tr key={r.id} className="border-b border-border/70">
                  <td className="px-2 py-2 text-center font-mono tabular-nums">{idx + 1}</td>
                  <td className="whitespace-nowrap px-2 py-2">{formatViDate(r.date)}</td>
                  <td className="px-2 py-2">{r.bucket === "CRYPTO" ? "Crypto" : r.bucket}</td>
                  <td className="px-2 py-2 font-medium">
                    {r.symbol}
                    {(r.kind === "BUY_TPLUS" || r.kind === "SELL_TPLUS") && (
                      <Badge tone="navy" className="ml-1">
                        T+
                      </Badge>
                    )}
                  </td>
                  <td className="px-2 py-2">{r.kindLabel}</td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {r.quantity != null ? formatQty(r.quantity, r.assetType === "ORIGINAL" ? "STOCK" : r.assetType) : "—"}
                  </td>
                  <td className="px-2 py-2 text-right font-mono tabular-nums">
                    {r.price != null && r.assetType !== "ORIGINAL" && r.assetType !== "BANK"
                      ? displayPrice(r.price, r.assetType, currency, usd)
                      : "—"}
                  </td>
                  <td className={`px-2 py-2 text-right font-mono tabular-nums ${signedClass(r.amount)}`}>
                    {r.amount !== 0 ? displayMoney(Math.abs(r.amount), currency, usd) : "—"}
                    {r.amount < 0 ? "" : r.amount > 0 && (r.kind === "DEPOSIT" || r.kind === "SELL" || r.kind === "SELL_TPLUS" || r.kind === "CASH_DIVIDEND") ? "" : ""}
                  </td>
                  <td className="max-w-[16rem] truncate px-2 py-2 text-xs text-muted-foreground" title={r.notes ?? ""}>
                    {r.notes ?? "—"}
                  </td>
                  <td className="px-2 py-2">
                    {r.kind !== "BANK_ROLLOVER" && (
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-md hover:bg-muted"
                          aria-label="Sửa dòng lịch sử"
                          onClick={() => {
                            if (r.kind === "DEPOSIT" || r.kind === "WITHDRAW") {
                              const c = data.ledger.capital.find((item) => item.id === r.id);
                              if (c) openCapitalEdit(c);
                              return;
                            }
                            if (r.kind === "BANK_OPEN") {
                              openBank(r.id.replace(/:open$/, ""));
                              return;
                            }
                            const t = data.ledger.transactions.find((item) => item.id === r.id);
                            const asset = t ? data.ledger.assets.find((item) => item.id === t.assetId) : undefined;
                            if (t) openTx({ id: t.id, accountId: t.accountId, symbol: asset?.symbol, name: asset?.name, assetType: asset?.assetType, txType: t.txType, txDate: t.txDate, quantity: t.quantity, price: t.price ?? undefined, amount: t.amount, fee: t.fee, tax: t.tax, tradeTplus: t.tradeTplus, fxRate: t.fxRate, stockDivQty: t.stockDivQty, notes: t.notes, matches: data.ledger.matches.filter((m) => m.sellTxId === t.id).map((m) => ({ buyTxId: m.buyTxId, quantity: m.quantity })) });
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          className="grid h-9 w-9 place-items-center rounded-md text-destructive hover:bg-destructive/10"
                          aria-label="Xóa dòng lịch sử"
                          onClick={async () => {
                            if (r.kind !== "DEPOSIT" && r.kind !== "WITHDRAW" && r.kind !== "BANK_OPEN") {
                              const transaction = data.ledger.transactions.find((item) => item.id === r.id);
                              const asset = transaction ? data.ledger.assets.find((item) => item.id === transaction.assetId) : undefined;
                              if (transaction) setDeleteTarget({ transaction, symbol: asset?.symbol ?? "" });
                              return;
                            }
                            const pin = await askEditPin();
                            if (!pin) return;
                            if (r.kind === "DEPOSIT" || r.kind === "WITHDRAW") deleteCapitalMut.mutate({ data: { id: r.id, pin } });
                            else deleteBankMut.mutate({ data: { id: r.id.replace(/:open$/, ""), pin } });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-2 py-8 text-center text-muted-foreground">
                    Không có dòng nào khớp bộ lọc
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}