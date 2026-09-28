import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { calendarAlerts } from "@/engine/calendar";
import { formatViDate, todayYmd } from "@/engine/dates";
import { displayMoney } from "@/lib/display";
import { confirmBankRateFromNotification } from "@/lib/api/portfolio";
import { useCalendar } from "@/lib/use-calendar";
import { usePortfolio, usePortfolioMutation } from "@/lib/use-portfolio";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { Bell, Building2, CalendarDays, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function useNotifyItems() {
  const { data: cal } = useCalendar();
  const { data: portfolio } = usePortfolio();
  const today = todayYmd();
  const alerts = useMemo(() => (cal ? calendarAlerts(cal, today) : []), [cal, today]);
  const banks = useMemo(
    () => (portfolio?.state.banks ?? []).filter((b) => b.remainingDays <= 5 || b.rateUnconfirmed),
    [portfolio],
  );
  return { alerts, banks, portfolio, count: alerts.length + banks.length };
}

export function NotifyBell() {
  const { count } = useNotifyItems();
  const notifyOpen = useUiStore((s) => s.notifyOpen);
  const toggleNotify = useUiStore((s) => s.toggleNotify);
  return (
    <Button
      size="icon"
      variant="outline"
      title="Thông báo"
      onClick={() => count > 0 && toggleNotify()}
      className="relative"
      disabled={count === 0}
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span
          className={cn(
            "absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-warn px-1 text-[10px] font-semibold leading-none text-white",
            notifyOpen && "ring-2 ring-card",
          )}
        >
          {count}
        </span>
      )}
    </Button>
  );
}

export function NotificationFooter() {
  const { alerts, banks, portfolio, count } = useNotifyItems();
  const notifyOpen = useUiStore((s) => s.notifyOpen);
  const setNotifyOpen = useUiStore((s) => s.setNotifyOpen);
  const currency = useUiStore((s) => s.currency);
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  const rateMut = usePortfolioMutation(
    (d: Parameters<typeof confirmBankRateFromNotification>[0]) => confirmBankRateFromNotification(d),
    "Đã cập nhật lãi suất",
  );

  useEffect(() => {
    if (count === 0 && notifyOpen) setNotifyOpen(false);
  }, [count, notifyOpen, setNotifyOpen]);

  const open = notifyOpen && count > 0;
  const usd = portfolio?.state.usdVnd ?? 25000;
  const rates = portfolio?.ledger.bankRates ?? [];

  return (
    <>
      <button
        type="button"
        aria-label="Đóng thông báo"
        onClick={() => setNotifyOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-navy-deep/25 transition-opacity md:bg-navy-deep/20",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      />

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-full flex-col border-l border-border bg-card shadow-[var(--shadow-card)] transition-transform duration-300 ease-out sm:w-1/3 sm:min-w-[22rem]",
          open ? "translate-x-0" : "translate-x-full",
        )}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-semibold">{count} thông báo</p>
          <button
            type="button"
            onClick={() => setNotifyOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Đóng"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
          {alerts.map((a) => (
            <li
              key={`cal-${a.id}`}
              className={cn(
                "flex items-start gap-2.5 rounded-lg border px-3 py-2 text-sm",
                a.daysLeft === 0 ? "border-warn/45 bg-warn/10" : "border-primary/20 bg-primary/5",
              )}
            >
              <CalendarDays className={cn("mt-0.5 h-4 w-4 shrink-0", a.daysLeft === 0 ? "text-warn" : "text-primary")} />
              <p className="min-w-0 leading-snug">
                <span className="font-medium">{a.message}</span>
                <span className="ml-2 text-xs text-muted-foreground">{formatViDate(a.occurDate)}</span>
              </p>
            </li>
          ))}

          {banks.map((b) => {
            const nextPeriod = b.rateUnconfirmed ? b.renewalCount : b.renewalCount + 1;
            const nextSaved = rates.some((r) => r.depositId === b.id && r.periodNumber === nextPeriod);
            const showRateForm = b.rateUnconfirmed || (b.autoRollover && b.remainingDays <= 5 && !nextSaved);
            return (
              <li key={`bank-${b.id}`} className="rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5">
                <div className="flex items-start gap-2.5">
                  <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {b.remainingDays <= 0
                        ? `Hết hôm nay sổ ${b.bankName} đáo hạn — ${displayMoney(b.currentPrincipal, currency, usd)}`
                        : `Sổ ${b.bankName} còn ${b.remainingDays} ngày đáo hạn`}
                    </p>
                    {showRateForm && (
                      <>
                        {b.rateUnconfirmed && (
                          <p className="mt-0.5 text-xs text-warn">
                            Chưa nhập lãi suất kỳ này — đang dùng tạm {b.currentRate}%.
                          </p>
                        )}
                        <form
                          className="mt-2 flex flex-wrap items-center gap-2"
                          onSubmit={(e) => {
                            e.preventDefault();
                            rateMut.mutate({
                              data: {
                                depositId: b.id,
                                periodNumber: nextPeriod,
                                interestRate: Number(rateDraft[b.id] ?? b.currentRate),
                              },
                            });
                          }}
                        >
                          <Input
                            className="h-9 w-24"
                            value={rateDraft[b.id] ?? String(b.currentRate)}
                            onChange={(e) => setRateDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                          />
                          <span className="text-xs text-muted-foreground">%/năm</span>
                          <Button size="sm" type="submit">
                            Lưu lãi suất
                          </Button>
                        </form>
                      </>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </aside>
    </>
  );
}
