import { remainingDays, todayYmd } from "@/engine/dates";
import type { CorporateActionType } from "./types";

export type CalendarEvent = {
  id: string;
  title: string;
  eventDate: string;
  yearly: boolean;
  notes: string | null;
  createdAt: string;
  source?: "MANUAL" | "CORPORATE_ACTION";
  symbol?: string;
  actionType?: CorporateActionType;
  distributionPct?: number;
};

export type CalendarAlert = {
  id: string;
  title: string;
  occurDate: string;
  daysLeft: number;
  message: string;
};

function isLeap(year: number) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function dateInYear(eventDate: string, year: number): string {
  const mmdd = eventDate.slice(5, 10);
  if (mmdd === "02-29" && !isLeap(year)) return `${year}-02-28`;
  return `${year}-${mmdd}`;
}

/** Lần diễn ra tiếp theo (hôm nay hoặc sau). Yearly: cùng ngày mỗi năm. */
export function nextOccurrence(ev: CalendarEvent, asOf = todayYmd()): string | null {
  if (!ev.yearly) return ev.eventDate >= asOf ? ev.eventDate : null;
  const year = Number(asOf.slice(0, 4));
  const thisY = dateInYear(ev.eventDate, year);
  return thisY >= asOf ? thisY : dateInYear(ev.eventDate, year + 1);
}

export function prevOccurrence(ev: CalendarEvent, asOf = todayYmd()): string | null {
  if (!ev.yearly) return ev.eventDate < asOf ? ev.eventDate : null;
  const year = Number(asOf.slice(0, 4));
  const thisY = dateInYear(ev.eventDate, year);
  return thisY < asOf ? thisY : dateInYear(ev.eventDate, year - 1);
}

export function occursOn(ev: CalendarEvent, ymd: string): boolean {
  if (ev.yearly) return dateInYear(ev.eventDate, Number(ymd.slice(0, 4))) === ymd;
  return ev.eventDate === ymd;
}

export function alertMessage(title: string, daysLeft: number): string {
  if (daysLeft <= 0) return `Hôm nay là ${title}`;
  return `Còn ${daysLeft} ngày nữa đến ${title}`;
}

export function calendarAlerts(events: CalendarEvent[], asOf = todayYmd()): CalendarAlert[] {
  const out: CalendarAlert[] = [];
  for (const ev of events) {
    const occur = nextOccurrence(ev, asOf);
    if (!occur) continue;
    const daysLeft = remainingDays(asOf, occur);
    if (daysLeft < 0 || daysLeft > 3) continue;
    out.push({
      id: ev.id,
      title: ev.title,
      occurDate: occur,
      daysLeft,
      message: alertMessage(ev.title, daysLeft),
    });
  }
  out.sort((a, b) => a.daysLeft - b.daysLeft || a.title.localeCompare(b.title));
  return out;
}