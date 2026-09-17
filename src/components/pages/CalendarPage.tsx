import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  nextOccurrence,
  occursOn,
  prevOccurrence,
  type CalendarEvent,
} from "@/engine/calendar";
import {
  formatViDate,
  remainingDays,
  toDate,
  todayYmd,
  ymd,
} from "@/engine/dates";
import { deleteCalendarEvent, saveCalendarEvent } from "@/lib/api/calendar";
import { useCalendar, useCalendarMutation } from "@/lib/use-calendar";
import { cn } from "@/lib/utils";
import { addDays, addMonths, format, getDay, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Pencil, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

const WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

type Draft = {
  id?: string;
  title: string;
  eventDate: string;
  yearly: boolean;
  notes: string;
};

export function CalendarPage() {
  const { data, isPending } = useCalendar();
  const today = todayYmd();

  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState(today);
  const [draft, setDraft] = useState<Draft | null>(null);

  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpText, setJumpText] = useState("");
  const [eventDateText, setEventDateText] = useState("");

  function goToDate(iso: string) {
    setSelected(iso);
    setCursor(startOfMonth(toDate(iso)));
  }

  function parseJumpDate(raw: string): string | null {
    const t = raw.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
      const d = new Date(`${t}T00:00:00`);
      if (Number.isNaN(d.getTime())) return null;
      if (
        d.getFullYear() !== Number(t.slice(0, 4)) ||
        d.getMonth() + 1 !== Number(t.slice(5, 7)) ||
        d.getDate() !== Number(t.slice(8, 10))
      ) return null;
      return t;
    }
    const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/);
    if (!m) return null;
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    let year = m[3];
    if (year.length === 2) {
      const n = Number(year);
      year = String(n >= 70 ? 1900 + n : 2000 + n);
    }
    const iso = `${year}-${mm}-${dd}`;
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return null;
    if (
      d.getFullYear() !== Number(year) ||
      d.getMonth() + 1 !== Number(mm) ||
      d.getDate() !== Number(dd)
    ) return null;
    return iso;
  }

  function applyJump() {
    const iso = parseJumpDate(jumpText);
    if (!iso) return;
    goToDate(iso);
    setJumpOpen(false);
    setJumpText("");
  }

  function applyEventDate() {
    const iso = parseJumpDate(eventDateText);
    if (!iso) return false;
    setDraft((c) => (c ? { ...c, eventDate: iso } : c));
    return true;
  }

  const saveFn = useCallback(
    (d: Parameters<typeof saveCalendarEvent>[0]) => saveCalendarEvent(d),
    [],
  );
  const deleteFn = useCallback(
    (d: Parameters<typeof deleteCalendarEvent>[0]) => deleteCalendarEvent(d),
    [],
  );
  const saveMut = useCalendarMutation(saveFn);
  const delMut = useCalendarMutation(deleteFn, "Đã xóa mốc");

  const events = useMemo(() => data ?? [], [data]);

  const cells = useMemo(() => {
    const start = startOfMonth(cursor);
    const pad = (getDay(start) + 6) % 7;
    const begin = addDays(start, -pad);
    return Array.from({ length: 42 }, (_, i) => ymd(addDays(begin, i)));
  }, [cursor]);

  const marksByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const iso of cells) map.set(iso, events.filter((ev) => occursOn(ev, iso)));
    return map;
  }, [cells, events]);

  const hotDates = useMemo(() => {
    const set = new Set<string>();
    for (const ev of events) {
      const n = nextOccurrence(ev, today);
      if (n && remainingDays(today, n) <= 3) set.add(n);
    }
    return set;
  }, [events, today]);

  const onSelected = useMemo(
    () => events.filter((ev) => occursOn(ev, selected)),
    [events, selected],
  );

  const cursorYm = useMemo(() => ymd(cursor).slice(0, 7), [cursor]);
  const monthLabel = useMemo(() => format(cursor, "MM/yyyy"), [cursor]);

  const upcoming = useMemo(() => {
    return events
      .map((ev) => {
        const occur = nextOccurrence(ev, today);
        return occur ? { ev, occur, days: remainingDays(today, occur) } : null;
      })
      .filter((x): x is { ev: CalendarEvent; occur: string; days: number } => Boolean(x))
      .sort(
        (a, b) =>
          a.occur.localeCompare(b.occur) || a.ev.title.localeCompare(b.ev.title),
      );
  }, [events, today]);

  const past = useMemo(() => {
    return events
      .map((ev) => {
        const occur = prevOccurrence(ev, today);
        return occur ? { ev, occur } : null;
      })
      .filter((x): x is { ev: CalendarEvent; occur: string } => Boolean(x))
      .sort((a, b) => b.occur.localeCompare(a.occur))
      .slice(0, 12);
  }, [events, today]);

  function openNew(date = selected) {
    setDraft({ title: "", eventDate: date, yearly: false, notes: "" });
    setEventDateText(formatViDate(date));
  }

  function openEdit(ev: CalendarEvent) {
    setDraft({
      id: ev.id,
      title: ev.title,
      eventDate: ev.eventDate,
      yearly: ev.yearly,
      notes: ev.notes ?? "",
    });
    setEventDateText(formatViDate(ev.eventDate));
  }

  function closeDraft() {
    setDraft(null);
    setEventDateText("");
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) return;
    const parsedEventDate = parseJumpDate(eventDateText);
    if (!parsedEventDate) return;

    saveMut.mutate(
      {
        data: {
          id: draft.id,
          title,
          eventDate: parsedEventDate,
          yearly: draft.yearly,
          notes: draft.notes.trim() || undefined,
        },
      },
      { onSuccess: () => closeDraft() },
    );
  }

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 rounded-2xl" />
        <Skeleton className="h-145 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="min-h-full space-y-5 pb-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/25 bg-linear-to-br from-primary/12 via-card to-background px-4 py-5 shadow-(--shadow-card) backdrop-blur-sm dark:border-white/15 dark:from-white/[0.06] dark:via-card dark:to-background sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-primary/15 blur-3xl dark:bg-white/8" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-primary/10 blur-3xl dark:bg-white/5" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              {/* Icon badge: light navy đặc, dark đảo trắng */}
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/25 dark:bg-white dark:text-slate-900 dark:shadow-none">
                <CalendarDays className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary dark:text-white">
                Personal Calendar
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-primary sm:text-4xl dark:text-foreground">
              Calendar
            </h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-primary/80 dark:text-white/65">
              Nhập mốc · banner hiện từ 3 ngày trước đến đúng ngày, trên mọi trang
            </p>
          </div>

          <div className="shrink-0">
            {jumpOpen ? (
              <Input
                autoFocus
                className="h-10 w-full rounded-xl border-primary/45 bg-background/80 shadow-sm dark:border-white/25 dark:bg-white/8 sm:w-40"
                placeholder="dd/mm/yyyy"
                value={jumpText}
                onChange={(e) => setJumpText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") applyJump();
                  if (e.key === "Escape") {
                    setJumpOpen(false);
                    setJumpText("");
                  }
                }}
                onBlur={applyJump}
              />
            ) : (
              <Button
                type="button"
                variant="outline"
                className="h-10 gap-2 rounded-xl border-primary/30 bg-background/80 px-4 text-primary shadow-sm transition-all hover:border-primary/50 hover:bg-primary/10 dark:border-white/20 dark:bg-white/8 dark:text-white dark:hover:border-white/35 dark:hover:bg-white/15"
                onClick={() => setJumpOpen(true)}
              >
                <CalendarDays className="h-4 w-4" />
                Đến ngày
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main ───────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(330px,1fr)]">
        {/* Calendar */}
        <Card className="overflow-hidden border border-primary/25 bg-linear-to-br from-[#dce5ef] via-[#d7e1ec] to-[#cfdbe8] p-3 text-[#0a2540] shadow-[0_4px_14px_rgb(10_37_64_/_0.12)] backdrop-blur-sm dark:border-white/12 dark:from-card dark:via-background dark:to-white/[0.03] sm:p-4">
          {/* Month navigation */}
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-background/80 text-primary transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95 dark:border-white/20 dark:bg-white/8 dark:text-white dark:hover:border-white/35 dark:hover:bg-white/15"
              onClick={() => setCursor((d) => startOfMonth(subMonths(d, 1)))}
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <p
              className="flex min-h-10 min-w-0 flex-1 cursor-default items-center justify-center rounded-xl border border-primary/25 bg-primary/8 px-3 text-sm font-semibold tabular-nums text-foreground shadow-sm dark:border-white/15 dark:bg-white/8"
              title="Nhấp đúp để về hôm nay"
              onDoubleClick={() => goToDate(today)}
            >
              <span className="text-primary/70 dark:text-white/60">Tháng&nbsp;</span>
              <span className="text-primary dark:text-white">{monthLabel}</span>
            </p>

            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-primary/25 bg-background/80 text-primary transition-all hover:border-primary/50 hover:bg-primary/10 active:scale-95 dark:border-white/20 dark:bg-white/8 dark:text-white dark:hover:border-white/35 dark:hover:bg-white/15"
              onClick={() => setCursor((d) => startOfMonth(addMonths(d, 1)))}
              aria-label="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Weekday */}
          <div className="grid grid-cols-7 gap-1.5 px-0.5 text-center">
            {WEEK.map((d, index) => (
              <div
                key={d}
                className={cn(
                  "rounded-lg py-2 text-[10px] font-bold uppercase tracking-[0.12em]",
                  index === 6
                    ? "text-primary dark:text-white/85"
                    : "text-primary/70 dark:text-white/55",
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div className="mt-1 grid grid-cols-7 gap-1.5">
            {cells.map((iso) => {
              const inMonth = iso.slice(0, 7) === cursorYm;
              const marks = marksByDate.get(iso) ?? [];
              const isToday = iso === today;
              const isSel = iso === selected;
              const hot = hotDates.has(iso);

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => setSelected(iso)}
                  onDoubleClick={() => openNew(iso)}
                  className={cn(
                    "group relative flex min-h-16 flex-col items-center rounded-xl border px-1 py-1.5 text-sm transition-all duration-150 sm:min-h-17",
                    inMonth
                      ? "border-transparent bg-background/60 text-primary dark:bg-white/[0.04] dark:text-foreground"
                      : "border-transparent bg-transparent text-primary/35 dark:text-white/25",
                    // Selected: navy đậm
                    isSel &&
                      "border-primary/55 bg-primary/15 shadow-sm ring-1 ring-primary/30 dark:border-white/45 dark:bg-white/15 dark:ring-white/30",
                    // Today: navy vừa
                    !isSel &&
                      isToday &&
                      "border-primary/45 bg-primary/10 dark:border-white/35 dark:bg-white/10",
                    // Hover
                    !isSel &&
                      !isToday &&
                      inMonth &&
                      "hover:border-primary/30 hover:bg-primary/8 dark:hover:border-white/25 dark:hover:bg-white/8",
                  )}
                >
                  {isToday && (
                    <span className="absolute left-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px] shadow-primary/20 dark:bg-white dark:shadow-white/20" />
                  )}

                  <span
                    className={cn(
                      "mt-0.5 font-medium tabular-nums",
                      isToday && "font-bold text-primary dark:text-white",
                      isSel && "font-semibold text-primary dark:text-white",
                    )}
                  >
                    {Number(iso.slice(8))}
                  </span>

                  {marks.length > 0 && (
                    <span className="mt-1.5 flex min-h-2 items-center gap-1">
                      {marks.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            hot
                              ? "bg-primary shadow-[0_0_0_2px] shadow-primary/25 dark:bg-white dark:shadow-white/30"
                              : "bg-primary/75 dark:bg-white/75",
                          )}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Hint */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-primary/15 pt-3 dark:border-white/12">
            <p className="text-[11px] text-primary/80 dark:text-white/55">
              Chọn ngày · nhấn đúp để thêm mốc
            </p>
            <div className="flex items-center gap-1.5 text-[11px] text-primary/80 dark:text-white/55">
              <span className="h-1.5 w-1.5 rounded-full bg-primary dark:bg-white" />
              Trong 3 ngày tới
            </div>
          </div>

          {/* Selected day panel — navy tint rõ hơn */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-primary/30 bg-linear-to-br from-primary/15 via-primary/8 to-background p-3.5 sm:p-4 dark:border-white/18 dark:from-white/10 dark:via-white/5 dark:to-background">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary dark:text-white/85">
                  Ngày đã chọn
                </p>
                <p className="mt-1 text-sm font-semibold text-primary dark:text-foreground">
                  {formatViDate(selected)}
                </p>
              </div>
              {onSelected.length > 0 && (
                <Badge
                  tone="navy"
                  className="shrink-0 rounded-lg px-2 py-1 text-[10px]"
                >
                  {onSelected.length} mốc
                </Badge>
              )}
            </div>

            {onSelected.length === 0 ? (
              <button
                type="button"
                onClick={() => openNew(selected)}
                className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-primary/35 bg-background/40 px-3 py-3 text-xs text-primary/80 transition hover:border-primary/55 hover:bg-primary/8 hover:text-primary dark:border-white/20 dark:text-white/60 dark:hover:border-white/35 dark:hover:bg-white/8 dark:hover:text-white"
              >
                Nhấp đúp ô ngày để thêm mốc
              </button>
            ) : (
              <ul className="mt-3 space-y-2">
                {onSelected.map((ev) => (
                  <li
                    key={ev.id}
                    className="group flex items-start justify-between gap-2 rounded-xl border border-primary/15 bg-background/75 px-3 py-2.5 shadow-sm transition hover:border-primary/35 dark:border-white/12 dark:bg-white/[0.05] dark:hover:border-white/25"
                  >
                    <div className="min-w-0 pt-0.5">
                      <p className="truncate text-sm font-medium text-primary dark:text-foreground">
                        {ev.title}
                      </p>
                      {ev.yearly && (
                        <Badge
                          tone="navy"
                          className="mt-1.5 rounded-md px-1.5 py-0.5 text-[10px]"
                        >
                          Lặp hàng năm
                        </Badge>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-8 w-8 min-h-8 rounded-lg border-primary/25 p-0 text-primary transition hover:border-primary/50 hover:bg-primary/10 dark:border-white/20 dark:text-white dark:hover:border-white/35 dark:hover:bg-white/15"
                        title="Sửa"
                        aria-label="Sửa"
                        onClick={() => openEdit(ev)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 min-h-8 rounded-lg p-0 text-primary/70 transition hover:bg-destructive/10 hover:text-destructive dark:text-white/55 dark:hover:bg-red-500/20 dark:hover:text-red-400"
                        title="Xóa"
                        aria-label="Xóa"
                        onClick={() => delMut.mutate({ data: { id: ev.id } })}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ── Side panels ───────────────────────────────── */}
        <div className="space-y-4">
          {/* Upcoming */}
          <Card className="border border-primary/25 bg-linear-to-br from-[#dce5ef] via-[#d7e1ec] to-[#cfdbe8] text-[#0a2540] shadow-[0_4px_14px_rgb(10_37_64_/_0.12)] backdrop-blur-sm dark:border-white/12 dark:from-card dark:via-background dark:to-white/[0.03]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-primary dark:text-foreground">Sắp tới</CardTitle>
                <CardDesc className="mb-0 mt-1 text-primary/70 dark:text-white/60">
                  Kể cả mốc lặp năm sau
                </CardDesc>
              </div>
              {upcoming.length > 0 && (
                <div className="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg bg-primary/15 px-2 text-xs font-semibold text-primary dark:bg-white/15 dark:text-white">
                  {upcoming.length}
                </div>
              )}
            </div>

            <ul className="mt-4 space-y-2">
              {upcoming.length === 0 && (
                <li className="rounded-xl border border-dashed border-primary/25 bg-background/40 px-3 py-4 text-center text-xs text-primary/80 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/55">
                  Chưa có mốc phía trước.
                </li>
              )}

              {upcoming.map(({ ev, occur, days }) => (
                <li key={ev.id}>
                  <button
                    type="button"
                    onClick={() => goToDate(occur)}
                    className="group flex w-full items-center gap-3 rounded-xl border border-primary/12 bg-background/65 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/8 dark:border-white/12 dark:bg-white/[0.04] dark:hover:border-white/30 dark:hover:bg-white/10"
                  >
                    <span
                      className={cn(
                        "h-2 w-2 shrink-0 rounded-full",
                        days <= 3
                          ? "bg-primary shadow-[0_0_0_3px] shadow-primary/20 dark:bg-white dark:shadow-white/25"
                          : "bg-primary/50 dark:bg-white/60",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-primary group-hover:text-primary dark:text-foreground dark:group-hover:text-white">
                        {ev.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-primary/70 dark:text-white/60">
                        {formatViDate(occur)}
                        {ev.yearly ? " · hàng năm" : ""}
                      </p>
                    </div>
                    <Badge
                      tone={days === 0 ? "warn" : days <= 3 ? "navy" : "muted"}
                      className="shrink-0 rounded-lg px-2 py-1 text-[10px]"
                    >
                      {days === 0 ? "Hôm nay" : `Còn ${days} ngày`}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          {/* Past */}
          <Card className="border border-primary/25 bg-linear-to-br from-[#dce5ef] via-[#d7e1ec] to-[#cfdbe8] text-[#0a2540] shadow-[0_4px_14px_rgb(10_37_64_/_0.12)] backdrop-blur-sm dark:border-white/12 dark:from-card dark:via-background dark:to-white/[0.03]">
            <div>
              <CardTitle className="text-primary dark:text-foreground">Đã qua</CardTitle>
              <CardDesc className="mb-0 mt-1 text-primary/70 dark:text-white/60">
                12 mốc gần nhất
              </CardDesc>
            </div>
            <ul className="mt-4 space-y-1.5">
              {past.length === 0 && (
                <li className="rounded-xl border border-dashed border-primary/25 bg-background/40 px-3 py-4 text-center text-xs text-primary/80 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/55">
                  Chưa có mốc đã qua.
                </li>
              )}
              {past.map(({ ev, occur }) => (
                <li
                  key={`${ev.id}:${occur}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-transparent px-3 py-2 text-primary/80 transition hover:border-primary/25 hover:bg-primary/8 dark:text-white/60 dark:hover:border-white/20 dark:hover:bg-white/8"
                >
                  <span className="min-w-0 truncate text-xs">{ev.title}</span>
                  <span className="shrink-0 text-[11px] tabular-nums text-primary/60 dark:text-white/45">
                    {formatViDate(occur)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>

      {/* ── Dialog ──────────────────────────────────────── */}
      <Dialog open={!!draft} onOpenChange={(open) => { if (!open) closeDraft(); }}>
        <DialogContent
          title={draft?.id ? "Sửa mốc" : "Thêm mốc"}
          className="dark:border-white/15"
        >
          {draft && (
            <form className="space-y-4" onSubmit={submit}>
              <div className="rounded-xl border border-primary/25 bg-primary/8 px-3.5 py-3 dark:border-white/15 dark:bg-white/8">
                <p className="text-xs leading-5 text-primary/80 dark:text-white/70">
                  Tiêu đề sẽ vào câu thông báo: «Hôm nay là …» / «Còn 3 ngày nữa đến …»
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-primary dark:text-white/85">
                  Tiêu đề
                </Label>
                <Input
                  className="h-10 rounded-xl border-primary/25 bg-background/70 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/15 dark:bg-white/5 dark:focus-visible:border-white/35 dark:focus-visible:ring-white/10"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="ngày họp FED"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-primary dark:text-white/85">
                  Ngày
                </Label>
                <div className="flex gap-2">
                  <Input
                    className="h-10 flex-1 rounded-xl border-primary/25 bg-background/70 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/15 dark:bg-white/5 dark:focus-visible:border-white/35 dark:focus-visible:ring-white/10"
                    placeholder="dd/mm/yyyy"
                    value={eventDateText}
                    onChange={(e) => {
                      const value = e.target.value;
                      setEventDateText(value);
                      const iso = parseJumpDate(value);
                      if (iso) {
                        setDraft((c) => (c ? { ...c, eventDate: iso } : c));
                      }
                    }}
                    onBlur={applyEventDate}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        applyEventDate();
                      }
                      if (e.key === "Escape") {
                        setEventDateText(formatViDate(draft.eventDate));
                      }
                    }}
                    required
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="h-10 shrink-0 rounded-xl border-primary/35 bg-primary/10 px-3 text-primary hover:bg-primary/20 dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                    onClick={() => {
                      setEventDateText(formatViDate(selected));
                      setDraft((c) => (c ? { ...c, eventDate: selected } : c));
                    }}
                    title="Dùng ngày đang chọn"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-primary/80 dark:text-white/55">
                  Nhập dd/mm/yyyy hoặc dd-mm-yyyy
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-3.5 py-3 dark:border-white/15 dark:bg-white/[0.05]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-primary dark:text-foreground">Lặp hàng năm</p>
                  <p className="mt-0.5 text-xs leading-5 text-primary/70 dark:text-white/60">
                    Cùng ngày mỗi năm (vd. đáo hạn phái sinh)
                  </p>
                </div>
                <Switch
                  checked={draft.yearly}
                  onCheckedChange={(v) => setDraft({ ...draft, yearly: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-primary dark:text-white/85">
                  Ghi chú (tùy chọn)
                </Label>
                <Input
                  className="h-10 rounded-xl border-primary/25 bg-background/70 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 dark:border-white/15 dark:bg-white/5 dark:focus-visible:border-white/35 dark:focus-visible:ring-white/10"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>

              {/* Submit: light gradient navy, dark đảo trắng */}
              <Button
                type="submit"
                className="h-10 w-full rounded-xl bg-gradient-to-r from-primary to-primary/85 font-medium text-primary-foreground shadow-md shadow-primary/25 transition hover:from-primary/90 hover:to-primary/75 dark:bg-white dark:bg-none dark:text-slate-900 dark:shadow-none dark:hover:bg-white/90"
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? "Đang lưu..." : "Lưu mốc"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}