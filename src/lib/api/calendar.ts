import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import type { CalendarEvent } from "@/engine/calendar";

function mapEvent(r: Record<string, unknown>): CalendarEvent {
  return {
    id: String(r.id),
    title: String(r.title),
    eventDate: String(r.event_date).slice(0, 10),
    yearly: Boolean(r.yearly),
    notes: r.notes ? String(r.notes) : null,
    createdAt: String(r.created_at),
    source: "MANUAL",
  };
}

async function loadCalendarEvents(): Promise<CalendarEvent[]> {
  const sql = await getSql();
  const [rows, actions] = await Promise.all([
    sql`
      select * from calendar_events
      where deleted_at is null
      order by event_date, created_at
    `,
    sql`
      select id, symbol, ex_date, action_type, distribution_pct, created_at
      from corporate_actions
      where deleted_at is null
      order by ex_date, created_at
    `,
  ]);
  return [
    ...rows.map(mapEvent),
    ...actions.map((row) => {
      const action = row as {
        id: string;
        symbol: string;
        ex_date: string;
        action_type: string;
        distribution_pct: number | string;
        created_at: string;
      };
      const actionLabel =
        action.action_type === "CASH_DIVIDEND"
          ? "cổ tức tiền mặt"
          : action.action_type === "STOCK_DIVIDEND"
            ? "cổ tức cổ phiếu"
            : "quyền mua";
      return {
        id: `corporate-action:${action.id}`,
        title: `GDKHQ ${action.symbol} · ${actionLabel} ${String(action.distribution_pct)}%`,
        eventDate: String(action.ex_date).slice(0, 10),
        yearly: false,
        notes: null,
        createdAt: String(action.created_at),
        source: "CORPORATE_ACTION" as const,
        symbol: String(action.symbol),
        actionType: action.action_type as
          | "CASH_DIVIDEND"
          | "STOCK_DIVIDEND"
          | "RIGHTS_ISSUE",
        distributionPct: Number(action.distribution_pct),
      };
    }),
  ];
}

export const fetchCalendar = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<CalendarEvent[]> => {
    return loadCalendarEvents();
  });

const saveSchema = z.object({
  id: z.string().optional(),
  pin: z.string().optional(),
  title: z.string().min(1),
  eventDate: z.string(),
  yearly: z.boolean(),
  notes: z.string().optional(),
});

export const saveCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saveSchema)
  .handler(async ({ data }): Promise<CalendarEvent[]> => {
    const sql = await getSql();
    if (data.id) await (await import("@/lib/auth/edit-pin.server")).requireEditPin(sql, data.pin ?? "");
    const title = data.title.trim();
    const notes = data.notes?.trim() ? data.notes.trim() : null;
    const id = data.id ?? crypto.randomUUID();
    if (data.id) {
      await sql`
        update calendar_events set
          title = ${title},
          event_date = ${data.eventDate},
          yearly = ${data.yearly},
          notes = ${notes}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into calendar_events (id, title, event_date, yearly, notes)
        values (${id}, ${title}, ${data.eventDate}, ${data.yearly}, ${notes})
      `;
    }
    return loadCalendarEvents();
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), pin: z.string() }))
  .handler(async ({ data }): Promise<CalendarEvent[]> => {
    const sql = await getSql();
    await (await import("@/lib/auth/edit-pin.server")).requireEditPin(sql, data.pin);
    await sql`update calendar_events set deleted_at = now() where id = ${data.id}`;
    return loadCalendarEvents();
  });