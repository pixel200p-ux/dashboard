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
  };
}

export const fetchCalendar = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<CalendarEvent[]> => {
    try {
      const sql = await getSql();
      const rows = await sql`
        select * from calendar_events
        where deleted_at is null
        order by event_date, created_at
      `;
      return rows.map(mapEvent);
    } catch (err) {
      console.error("[calendar]", err);
      return [];
    }
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
    const rows = await sql`
      select * from calendar_events
      where deleted_at is null
      order by event_date, created_at
    `;
    return rows.map(mapEvent);
  });

export const deleteCalendarEvent = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), pin: z.string() }))
  .handler(async ({ data }): Promise<CalendarEvent[]> => {
    const sql = await getSql();
    await (await import("@/lib/auth/edit-pin.server")).requireEditPin(sql, data.pin);
    await sql`update calendar_events set deleted_at = now() where id = ${data.id}`;
    const rows = await sql`
      select * from calendar_events
      where deleted_at is null
      order by event_date, created_at
    `;
    return rows.map(mapEvent);
  });