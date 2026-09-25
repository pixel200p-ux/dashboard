import { Kpi } from "@/components/Kpi";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { formatViDate } from "@/engine/dates";
import { formatPct, formatQty, signedClass } from "@/engine/money";
import type { CapitalBucket } from "@/engine/types";
import { displayMoney, displayPrice } from "@/lib/display";
import {
  buildReportRows,
  filterReportRows,
  REPORT_BUCKETS,
  REPORT_KINDS,
  type ReportKind,
} from "@/lib/report-history";
import { usePortfolio } from "@/lib/use-portfolio";
import { usePortfolioMutation } from "@/lib/use-portfolio";
import { deleteCapital, deleteBank, deleteTransaction } from "@/lib/api/portfolio";
import { useUiStore } from "@/lib/ui-store";
import { askEditPin } from "@/lib/edit-pin";
import { Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

export function ReportsPage() {
  const { data, isPending } = usePortfolio();
  const currency = useUiStore((s) => s.currency);
  const openTx = useUiStore((s) => s.openTx);
  const openCapitalEdit = useUiStore((s) => s.openCapitalEdit);
  const openBank = useUiStore((s) => s.openBank);
  const deleteCapitalMut = usePortfolioMutation((d: Parameters<typeof deleteCapital>[0]) => deleteCapital(d), "Đã xóa dòng vốn");
  const deleteTransactionMut = usePortfolioMutation((d: Parameters<typeof deleteTransaction>[0]) => deleteTransaction(d), "Đã xóa giao dịch");
  const deleteBankMut = usePortfolioMutation((d: Parameters<typeof deleteBank>[0]) => deleteBank(d), "Đã xóa sổ");
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

  return (
    <div className="space-y-5">
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

        <div className="table-scroll mt-3">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
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
                          onClick={() => {
                            const pin = askEditPin();
                            if (!pin) return;
                            if (r.kind === "DEPOSIT" || r.kind === "WITHDRAW") deleteCapitalMut.mutate({ data: { id: r.id, pin } });
                            else if (r.kind === "BANK_OPEN") deleteBankMut.mutate({ data: { id: r.id.replace(/:open$/, ""), pin } });
                            else deleteTransactionMut.mutate({ data: { id: r.id, pin } });
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