import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  alertMessage,
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
import { CalendarDays, ChevronLeft, ChevronRight, History, Pencil, Trash2 } from "lucide-react";
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
  const [collapsedYears, setCollapsedYears] = useState<Record<string, boolean>>({});

  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpText, setJumpText] = useState("");
  const [eventDateText, setEventDateText] = useState("");
  const [historyOpen, setHistoryOpen] = useState(false);

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

  const upcomingGroups = useMemo(() => {
    const map = new Map<string, { date: string; items: { ev: CalendarEvent; occur: string; days: number }[] }>();
    for (const item of upcoming) {
      const current = map.get(item.occur) ?? { date: item.occur, items: [] };
      current.items.push(item);
      map.set(item.occur, current);
    }
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [upcoming]);

  const past = useMemo(() => {
    return events
      .map((ev) => {
        const occur = prevOccurrence(ev, today);
        return occur ? { ev, occur } : null;
      })
      .filter((x): x is { ev: CalendarEvent; occur: string } => Boolean(x))
      .sort((a, b) => b.occur.localeCompare(a.occur))
      .slice(0, 10);
  }, [events, today]);

  const pastGroups = useMemo(() => {
    const map = new Map<string, { date: string; items: { ev: CalendarEvent; occur: string }[] }>();
    for (const item of past) {
      const current = map.get(item.occur) ?? { date: item.occur, items: [] };
      current.items.push(item);
      map.set(item.occur, current);
    }
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [past]);

  const historyYears = useMemo(() => {
    const rows: { ev: CalendarEvent; occur: string }[] = [];
    const endY = Number(today.slice(0, 4));
    for (const ev of events) {
      if (!ev.yearly) {
        if (ev.eventDate <= today) rows.push({ ev, occur: ev.eventDate });
        continue;
      }
      const startY = Number(ev.eventDate.slice(0, 4));
      const mmdd = ev.eventDate.slice(5);
      for (let y = endY; y >= startY; y--) {
        const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
        const occur = mmdd === "02-29" && !leap ? `${y}-02-28` : `${y}-${mmdd}`;
        if (occur <= today) rows.push({ ev, occur });
      }
    }
    rows.sort((a, b) => b.occur.localeCompare(a.occur) || a.ev.title.localeCompare(b.ev.title));
    const groups: { year: string; items: typeof rows }[] = [];
    for (const row of rows) {
      const year = row.occur.slice(0, 4);
      const last = groups[groups.length - 1];
      if (last && last.year === year) last.items.push(row);
      else groups.push({ year, items: [row] });
    }
    return groups;
  }, [events, today]);

  const sideCardRows = "minmax(0, auto) minmax(0, 1fr)";

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
    <div className="flex h-full min-h-0 flex-1 flex-col gap-5 overflow-hidden">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="relative shrink-0 overflow-hidden rounded-2xl border border-border bg-card px-4 py-5 shadow-(--shadow-card) dark:border-[#334155] dark:bg-[#162238] sm:px-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-[#0F172A]/5 blur-3xl dark:bg-[#0F172A]/40" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-[#0F172A]/5 blur-3xl dark:bg-[#0F172A]/30" />

        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#0F172A] text-white shadow-md shadow-[#0F172A]/10 dark:bg-[#0F172A] dark:shadow-none">
                <CalendarDays className="h-4 w-4" />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0F172A] dark:text-[#94A3B8]">
                Personal Calendar
              </span>
            </div>

            <h1 className="text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl dark:text-white">
              Calendar
            </h1>
          </div>

          <div className="flex w-full shrink-0 flex-col gap-2 sm:w-40">
            {jumpOpen ? (
              <Input
                autoFocus
                className="h-8 w-full rounded-xl border-[#E2E8F0] bg-white text-[#0F172A] shadow-sm focus-visible:border-[#0F172A] focus-visible:ring-1 focus-visible:ring-[#0F172A]/20 dark:border-[#334155] dark:bg-[#0F172A] dark:text-white sm:w-40"
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
                className="h-7 gap-1.5 rounded-xl border-[#0F172A] bg-[#0F172A] px-2.5 text-xs text-white shadow-sm transition-all hover:border-[#354969] hover:bg-[#354969] dark:border-[#334155] dark:bg-[#354969] dark:text-white dark:hover:border-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-white"
                onClick={() => setJumpOpen(true)}
              >
                <CalendarDays className="h-3.5 w-3.5" />
                Đến ngày
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              className="h-7 w-full gap-1.5 rounded-xl border-[#0F172A] bg-[#0F172A] px-2.5 text-xs text-white shadow-sm transition-all hover:border-[#354969] hover:bg-[#354969] dark:border-[#334155] dark:bg-[#354969] dark:text-white dark:hover:border-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-white"
              onClick={() => setHistoryOpen(true)}
            >
              <History className="h-3.5 w-3.5" />
              Lịch sử sự kiện
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main ───────────────────────────────────────── */}
      <div className="grid h-full min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,5.6fr)_minmax(0,3fr)] lg:overflow-hidden">
        {/* Calendar */}
        <Card className="min-h-0 overflow-hidden border border-border bg-card p-3 text-[#0F172A] shadow-(--shadow-card) dark:border-[#334155] dark:bg-[#162238] sm:p-4">
          {/* Month navigation */}
          <div className="mb-4 flex items-center gap-2">
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#94A3B8] bg-[#CDD5DF] text-[#0F172A] transition-all hover:border-[#0F172A]/30 hover:bg-[#B8C4D0] active:scale-95 dark:border-[#334155] dark:bg-[#354969] dark:text-[#94A3B8] dark:hover:border-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-white"
              onClick={() => setCursor((d) => startOfMonth(subMonths(d, 1)))}
              aria-label="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <p
              className="flex min-h-10 min-w-0 flex-1 cursor-default items-center justify-center rounded-xl border border-[#94A3B8] bg-[#CDD5DF] px-3 text-sm font-semibold tabular-nums text-[#0F172A] shadow-sm dark:border-[#334155] dark:bg-[#354969] dark:text-white"
              title="Nhấp đúp để về hôm nay"
              onDoubleClick={() => goToDate(today)}
            >
              <span className="text-[#64748B] dark:text-[#94A3B8]">Tháng&nbsp;</span>
              <span className="text-[#0F172A] dark:text-white">{monthLabel}</span>
            </p>

            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#94A3B8] bg-[#CDD5DF] text-[#0F172A] transition-all hover:border-[#0F172A]/30 hover:bg-[#B8C4D0] active:scale-95 dark:border-[#334155] dark:bg-[#354969] dark:text-[#94A3B8] dark:hover:border-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-white"
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
                  "flex items-center justify-center rounded-xl py-2 text-base font-bold uppercase tracking-[0.12em]",
                  index === 6
                    ? "bg-[#CADCFC] text-[#0F172A] dark:bg-transparent dark:text-[#94A3B8]"
                    : "bg-[#0F172A] text-white dark:bg-transparent dark:text-[#94A3B8]",
                )}
              >
                {d}
              </div>
            ))}
          </div>

          {/* Cells */}
          <div
            className="mt-3 grid min-h-0 flex-1 grid-cols-7 gap-x-1.5 gap-y-1"
            style={{ gridTemplateRows: "repeat(6, minmax(0, 1.2fr))" }}
          >
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
                    "group relative flex h-full min-h-0 flex-col items-center rounded-xl border px-1 py-1 text-sm transition-all duration-150",
                    inMonth
                      ? "border-transparent bg-card text-[#0F172A] dark:border-transparent dark:bg-[#162238] dark:text-white"
                      : "border-transparent bg-transparent text-[#94A3B8] dark:border-transparent dark:text-[#64748B]",
                    // Selected
                    isSel &&
                      "border-[#0F172A] bg-[#0F172A] text-white shadow-sm ring-1 ring-[#0F172A] dark:border-white dark:bg-[#334155] dark:text-white dark:ring-white",
                    // Today
                    !isSel &&
                      isToday &&
                      "border-[#CADCFC] bg-[#CADCFC] dark:border-[#94A3B8] dark:bg-[#354969]",
                    // Hover
                    !isSel &&
                      !isToday &&
                      inMonth &&
                      "hover:border-[#94A3B8] hover:bg-[#CDD5DF] dark:hover:border-[#94A3B8] dark:hover:bg-[#354969]",
                  )}
                >

                  <span
                    className={cn(
                      "mt-0.5 font-medium tabular-nums",
                      isToday && !isSel && "font-bold text-[#0F172A] dark:text-white",
                      isSel && "font-semibold text-white dark:text-white",
                    )}
                  >
                    {Number(iso.slice(8))}
                  </span>

                  {marks.length > 0 && (
                    <span className="mt-0.5 flex min-h-1.5 items-center gap-1">
                      {marks.slice(0, 3).map((ev) => (
                        <span
                          key={ev.id}
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            hot
                              ? isSel
                                ? "bg-white shadow-[0_0_0_2px] shadow-white/30 dark:bg-white"
                                : "bg-[#0F172A] shadow-[0_0_0_2px] shadow-[#0F172A]/20 dark:bg-white dark:shadow-white/30"
                              : isSel
                                ? "bg-white/70 dark:bg-[#94A3B8]"
                                : "bg-[#64748B] dark:bg-[#94A3B8]",
                          )}
                        />
                      ))}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day panel */}
          <div className="mt-4 border-t border-[#E2E8F0] pt-4 dark:border-[#334155]">
            {onSelected.length === 0 ? (
              <button
                type="button"
                onClick={() => openNew(selected)}
                className="mt-3 flex w-full items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-white px-3 py-3 text-xs text-[#64748B] transition hover:border-[#0F172A]/30 hover:bg-[#F8FAFC] hover:text-[#0F172A] dark:border-[#334155] dark:bg-transparent dark:text-[#94A3B8] dark:hover:border-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-white"
              >
                Nhấp đúp ô ngày để thêm mốc
              </button>
            ) : (
              <ul className="mt-3 max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {onSelected.map((ev) => (
                  <li
                    key={ev.id}
                    className="flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[#0F172A] transition dark:text-white"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-[#0F172A] dark:text-white">
                      {ev.title}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        className="h-6 w-6 min-h-6 rounded-md border-[#E2E8F0] bg-white p-0 text-[#0F172A] transition hover:border-[#0F172A]/30 hover:bg-[#F8FAFC] dark:border-[#334155] dark:bg-transparent dark:text-[#94A3B8] dark:hover:border-white dark:hover:bg-[#354969] dark:hover:text-white"
                        title="Sửa"
                        aria-label="Sửa"
                        onClick={() => openEdit(ev)}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 min-h-6 rounded-md p-0 text-[#64748B] transition hover:bg-red-500/10 hover:text-red-600 dark:text-[#94A3B8] dark:hover:bg-red-500/20 dark:hover:text-red-400"
                        title="Xóa"
                        aria-label="Xóa"
                        onClick={() => delMut.mutate({ data: { id: ev.id } })}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        {/* ── Side panels ───────────────────────────────── */}
        <div
          className="grid min-h-0 flex-1 gap-4 lg:h-full lg:overflow-hidden"
          style={{ gridTemplateRows: sideCardRows }}
        >
          {/* Upcoming */}
          <Card
            className="flex min-h-0 flex-col overflow-hidden border border-border bg-card text-[#0F172A] shadow-(--shadow-card) dark:border-[#334155] dark:bg-[#162238]"
          >
            <div className="flex shrink-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-[#0F172A] dark:text-white">Sắp tới</CardTitle>
                <CardDesc className="mb-0 mt-1 text-[#64748B] dark:text-[#94A3B8]">
                  Kể cả mốc lặp năm sau
                </CardDesc>
              </div>
              {upcoming.length > 0 && (
                <div className="grid h-8 min-w-8 shrink-0 place-items-center rounded-lg bg-[#0F172A] px-2 text-xs font-semibold text-white dark:border dark:border-[#334155] dark:bg-[#162238] dark:text-white">
                  {upcoming.length}
                </div>
              )}
            </div>

            <ul className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
              {upcoming.length === 0 && (
                <li className="rounded-xl border border-dashed border-[#94A3B8] bg-[#CDD5DF] px-3 py-4 text-center text-xs text-[#64748B] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                  Chưa có mốc phía trước.
                </li>
              )}

              {upcomingGroups.map((group) => {
                const first = group.items[0];
                const isTodayOccur = group.date === today;
                return (
                  <li key={group.date} className="relative pb-3 pl-6">
                    <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                    <div className="flex items-start gap-3">
                      <span
                        className={cn(
                          "mt-0.5 inline-flex min-w-[5.2rem] justify-center rounded-md border px-2 py-1 text-[10px] font-semibold tabular-nums",
                          isTodayOccur
                            ? "border-[#F59E0B] bg-[#FFF7ED] text-[#B45309] dark:border-[#F59E0B] dark:bg-[#3B2A13] dark:text-[#FBBF24]"
                            : "border-[#CBD5E1] bg-[#F8FAFC] text-[#475569] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8]",
                        )}
                      >
                        {formatViDate(group.date)}
                      </span>
                      <div className="min-w-0 flex-1 border-l border-[#CBD5E1] pl-3 dark:border-[#334155]">
                        <div>
                          {group.items.map(({ ev, days }) => (
                            <div key={`${group.date}-${ev.id}`} className="relative pb-3 pl-3.5">
                              <span className="absolute left-0 top-[0.8rem] h-1 w-1 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                              <p className="text-xs leading-5 text-[#0F172A] dark:text-white">
                                {alertMessage(ev.title, days)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>

          {/* Past */}
          <Card
            className="flex min-h-0 flex-col overflow-hidden border border-border bg-card text-[#0F172A] shadow-(--shadow-card) dark:border-[#334155] dark:bg-[#162238]"
          >
            <div className="shrink-0">
              <CardTitle className="text-[#0F172A] dark:text-white">Đã qua</CardTitle>
              <CardDesc className="mb-0 mt-1 text-[#64748B] dark:text-[#94A3B8]">
                10 mốc gần nhất
              </CardDesc>
            </div>
            <ul className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
              {past.length === 0 && (
                <li className="rounded-xl border border-dashed border-[#94A3B8] bg-[#CDD5DF] px-3 py-4 text-center text-xs text-[#64748B] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                  Chưa có mốc đã qua.
                </li>
              )}
              {pastGroups.map((group) => (
                <li key={group.date} className="relative pb-3 pl-6">
                  <span className="absolute left-0 top-2 h-2.5 w-2.5 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex min-w-[5.2rem] justify-center rounded-md border border-[#CBD5E1] bg-[#F8FAFC] px-2 py-1 text-[10px] font-semibold tabular-nums text-[#475569] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8]">
                      {formatViDate(group.date)}
                    </span>
                    <div className="min-w-0 flex-1 border-l border-[#CBD5E1] pl-3 dark:border-[#334155]">
                      <div>
                        {group.items.map(({ ev, occur }) => (
                          <div key={`${group.date}-${ev.id}:${occur}`} className="relative pb-3 pl-3.5">
                            <span className="absolute left-0 top-[0.8rem] h-1 w-1 rounded-full bg-[#64748B] dark:bg-[#94A3B8]" />
                            <p className="text-xs leading-5 text-[#0F172A] dark:text-white">{ev.title}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
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
          className="bg-white border-[#E2E8F0] dark:border-[#334155] dark:bg-[#162238]"
        >
          {draft && (
            <form className="space-y-4" onSubmit={submit}>
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 dark:border-[#334155] dark:bg-[#0F172A]">
                <p className="text-xs leading-5 text-[#64748B] dark:text-[#94A3B8]">
                  Tiêu đề sẽ vào câu thông báo: «Hôm nay là …» / «Còn 3 ngày nữa đến …»
                </p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#0F172A] dark:text-[#94A3B8]">
                  Tiêu đề
                </Label>
                <Input
                  className="h-10 rounded-xl border-[#E2E8F0] bg-white text-[#0F172A] focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/10 dark:border-[#334155] dark:bg-[#0F172A] dark:text-white dark:focus-visible:border-[#94A3B8] dark:focus-visible:ring-[#334155]"
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  placeholder="ngày họp FED"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#0F172A] dark:text-[#94A3B8]">
                  Ngày
                </Label>
                <div className="flex gap-2">
                  <Input
                    className="h-10 flex-1 rounded-xl border-[#E2E8F0] bg-white text-[#0F172A] focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/10 dark:border-[#334155] dark:bg-[#0F172A] dark:text-white dark:focus-visible:border-[#94A3B8] dark:focus-visible:ring-[#334155]"
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
                    className="h-10 shrink-0 rounded-xl border-[#E2E8F0] bg-[#F8FAFC] px-3 text-[#0F172A] hover:bg-[#E2E8F0] dark:border-[#334155] dark:bg-[#354969] dark:text-[#94A3B8] dark:hover:bg-[#0F172A] dark:hover:text-white"
                    onClick={() => {
                      setEventDateText(formatViDate(selected));
                      setDraft((c) => (c ? { ...c, eventDate: selected } : c));
                    }}
                    title="Dùng ngày đang chọn"
                  >
                    <CalendarDays className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                  Nhập dd/mm/yyyy hoặc dd-mm-yyyy
                </p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 dark:border-[#334155] dark:bg-[#0F172A]">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] dark:text-white">Lặp hàng năm</p>
                  <p className="mt-0.5 text-xs leading-5 text-[#64748B] dark:text-[#94A3B8]">
                    Cùng ngày mỗi năm (vd. đáo hạn phái sinh)
                  </p>
                </div>
                <Switch
                  checked={draft.yearly}
                  onCheckedChange={(v) => setDraft({ ...draft, yearly: v })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-[#0F172A] dark:text-[#94A3B8]">
                  Ghi chú (tùy chọn)
                </Label>
                <Input
                  className="h-10 rounded-xl border-[#E2E8F0] bg-white text-[#0F172A] focus-visible:border-[#0F172A] focus-visible:ring-2 focus-visible:ring-[#0F172A]/10 dark:border-[#334155] dark:bg-[#0F172A] dark:text-white dark:focus-visible:border-[#94A3B8] dark:focus-visible:ring-[#334155]"
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                className="h-10 w-full rounded-xl bg-[#0F172A] font-medium text-white shadow-sm transition hover:bg-[#354969] dark:bg-white dark:text-[#0F172A] dark:shadow-none dark:hover:bg-[#E2E8F0]"
                disabled={saveMut.isPending}
              >
                {saveMut.isPending ? "Đang lưu..." : "Lưu mốc"}
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent
          title="Lịch sử sự kiện"
          className="max-w-xl bg-white border-[#E2E8F0] dark:border-[#334155] dark:bg-[#354969]"
        >
          {historyYears.length === 0 ? (
            <p className="rounded-xl border border-dashed border-[#94A3B8] bg-[#CDD5DF] px-3 py-6 text-center text-sm text-[#64748B] dark:border-[#334155] dark:bg-[#0F172A] dark:text-[#94A3B8]">
              Chưa có sự kiện trước giờ.
            </p>
          ) : (
            <div className="space-y-4">
              {historyYears.map((group) => {
                const byDate = group.items.reduce<Record<string, typeof group.items>>((acc, item) => {
                  acc[item.occur] ??= [];
                  acc[item.occur].push(item);
                  return acc;
                }, {});
                const isCollapsed = !!collapsedYears[group.year];

                return (
                  <section key={group.year} className="relative last:mb-0">
                    <div className="relative flex items-center gap-2 pl-1">
                      <div className="absolute left-0 top-1/2 h-px w-5 -translate-y-1/2 bg-[#CBD5E1] dark:bg-[#334155]" />
                      <div className="absolute left-[calc(100%-0.2rem)] top-1/2 h-px w-4 -translate-y-1/2 bg-[#CBD5E1] dark:bg-[#334155]" />
                      <button
                        type="button"
                        onClick={() =>
                          setCollapsedYears((prev) => ({
                            ...prev,
                            [group.year]: !prev[group.year],
                          }))
                        }
                        className="relative z-10 flex items-center rounded-xl border border-[#0F172A] bg-[#0F172A] px-3 py-2 text-left shadow-sm transition hover:bg-[#1E293B] dark:border-[#94A3B8] dark:bg-[#354969] dark:hover:bg-[#475569]"
                      >
                        <span className="text-[11px] font-bold tabular-nums tracking-[0.14em] text-white dark:text-white">
                          {group.year}
                        </span>
                      </button>
                    </div>

                    {!isCollapsed && (
                      <div className="relative mt-2 ml-4 border-l border-[#CBD5E1] pl-3 dark:border-[#334155]">
                        {Object.entries(byDate).map(([date, items]) => (
                          <div key={date} className="pb-6 last:pb-0">
                            <div className="flex items-center gap-2 text-[11px] font-semibold tabular-nums tracking-[0.08em] text-[#475569] dark:text-[#94A3B8]">
                              <span className="inline-block h-2 w-2 rounded-full bg-[#94A3B8] dark:bg-[#64748B]" />
                              <span>{date.slice(5).replace("-", "/")}</span>
                            </div>

                            <div className="mt-1 ml-4 border-l border-[#E2E8F0] pl-3 dark:border-[#334155]">
                              {items.map(({ ev, occur }) => (
                                <button
                                  key={`${ev.id}:${occur}`}
                                  type="button"
                                  onClick={() => {
                                    goToDate(occur);
                                    setHistoryOpen(false);
                                  }}
                                  className="group block w-full py-1 text-left transition hover:text-[#0F172A] dark:hover:text-white"
                                >
                                  <span className="block text-xs leading-5 text-[#0F172A] transition group-hover:text-[#0F172A] dark:text-white dark:group-hover:text-white">
                                    {ev.title}
                                    {ev.yearly ? " · hàng năm" : ""}
                                  </span>
                                </button>
                              ))}
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
        </DialogContent>
      </Dialog>
    </div>
  );
}