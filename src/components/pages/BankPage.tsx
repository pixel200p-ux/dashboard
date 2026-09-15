import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatViDate } from "@/engine/dates";
import { displayMoney } from "@/lib/display";
import { confirmBankRate, deleteBank, redeemBank } from "@/lib/api/portfolio";
import { usePortfolio, usePortfolioMutation } from "@/lib/use-portfolio";
import { useUiStore } from "@/lib/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import { NavOriginalCard, PnlCard } from "@/components/NavOriginalCards";

export function BankPage() {
  const { data, isPending } = usePortfolio();
  const currency = useUiStore((s) => s.currency);
  const openBank = useUiStore((s) => s.openBank);
  const rateMut = usePortfolioMutation((d: Parameters<typeof confirmBankRate>[0]) => confirmBankRate(d), "Đã lưu lãi suất");
  const redeemMut = usePortfolioMutation((d: Parameters<typeof redeemBank>[0]) => redeemBank(d), "Đã tất toán sổ");
  const delMut = usePortfolioMutation((d: Parameters<typeof deleteBank>[0]) => deleteBank(d), "Đã xóa sổ");
  const [draft, setDraft] = useState<Record<string, string>>({});

  if (isPending || !data) return <Skeleton className="h-64" />;
  const usd = data.state.usdVnd;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">Bank</h1>
          <p className="text-sm text-muted-foreground">Nhiều sổ, nhiều ngân hàng. Gần đáo hạn lên trên.</p>
        </div>
        <Button onClick={() => openBank()}>Mở sổ</Button>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] md:items-stretch">
        <NavOriginalCard
          title="NAV / Original Bank"
          originalLabel="Original Bank"
          nav={data.state.navByBucket.BANK}
          original={data.state.originalByBucket.BANK}
          usdVnd={usd}
        />
        <PnlCard
          pnl={data.state.navByBucket.BANK - data.state.originalByBucket.BANK}
          original={data.state.originalByBucket.BANK}
          subtitle="NAV − Original Bank"
          usdVnd={usd}
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {data.state.banks.map((b) => (
          <Card key={b.id} className="space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle>{b.bankName}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  {formatViDate(b.currentPeriodStart)} → {formatViDate(b.maturityDate)} · {b.termMonths} tháng
                </p>
              </div>
              <Badge tone={b.remainingDays <= 5 ? "warn" : "navy"}>{b.remainingDays} ngày</Badge>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Gốc hiện tại</dt>
                <dd className="font-mono">{displayMoney(b.currentPrincipal, currency, usd)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lãi dồn</dt>
                <dd className="font-mono">{displayMoney(b.accumulatedInterest, currency, usd)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Lãi suất</dt>
                <dd>{b.currentRate}% {b.rateUnconfirmed && <span className="text-warn">· chưa nhập kỳ này</span>}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Tái tục</dt>
                <dd>
                  {b.autoRollover ? "Có" : "Không"} · {b.renewalCount} lần
                </dd>
              </div>
            </dl>
            {(b.remainingDays <= 5 || b.rateUnconfirmed) && (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  rateMut.mutate({
                    data: {
                      depositId: b.id,
                      periodNumber: b.rateUnconfirmed ? b.renewalCount : b.renewalCount + 1,
                      interestRate: Number(draft[b.id] ?? b.currentRate),
                    },
                  });
                }}
              >
                <Input
                  className="w-28"
                  value={draft[b.id] ?? String(b.currentRate)}
                  onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                />
                <Button size="sm" type="submit">
                  Lãi suất mới
                </Button>
              </form>
            )}
                        <div className="flex flex-wrap items-center gap-2">
              <Button size="icon" variant="outline" className="h-8 w-8 min-h-8 p-0" title="Sửa" aria-label="Sửa" onClick={() => openBank(b.id)}>
                <Pencil />
              </Button>
              <Button size="sm" variant="outline" onClick={() => redeemMut.mutate({ data: { id: b.id } })}>
                Tất toán
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 min-h-8 p-0" title="Xóa" aria-label="Xóa" onClick={() => delMut.mutate({ data: { id: b.id } })}>
                <Trash2 />
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {data.state.banks.length === 0 && (
        <Card>
          <p className="text-sm text-muted-foreground">Chưa có sổ tiết kiệm.</p>
        </Card>
      )}

      <Card>
        <CardTitle>Lịch sử đáo hạn</CardTitle>
        <div className="table-scroll mt-3">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-2 py-2">Ngân hàng</th>
                <th className="px-2 py-2">Ngày</th>
                <th className="px-2 py-2 text-right">Gốc thu hồi</th>
                <th className="px-2 py-2 text-right">Lãi thực nhận</th>
              </tr>
            </thead>
            <tbody>
              {data.state.redeemedBanks.map((b) => (
                <tr key={b.id} className="border-b border-border/70">
                  <td className="px-2 py-2">{b.bankName}</td>
                  <td className="px-2 py-2">{b.maturityDate ? formatViDate(b.maturityDate) : "—"}</td>
                  <td className="px-2 py-2 text-right font-mono">
                    {displayMoney(data.ledger.banks.find((x) => x.id === b.id)?.redeemedPrincipal ?? 0, currency, usd)}
                  </td>
                  <td className="px-2 py-2 text-right font-mono">{displayMoney(b.accumulatedInterest, currency, usd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.state.redeemedBanks.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa tất toán sổ nào.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
