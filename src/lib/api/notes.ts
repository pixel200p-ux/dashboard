import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const noteColorSchema = z.enum(["slate", "blue", "amber", "rose", "green", "violet"]);

export type SharedNote = {
  id: string;
  title: string;
  content: string;
  color: z.infer<typeof noteColorSchema>;
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
};

function mapNote(row: Record<string, unknown>): SharedNote {
  return {
    id: String(row.id),
    title: String(row.title),
    content: String(row.content),
    color: noteColorSchema.parse(row.color),
    pinned: Boolean(row.pinned),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export const fetchSharedNotes = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<SharedNote[]> => {
    const sql = await getSql();
    const rows = await sql`
      select id, title, content, color, pinned, created_at, updated_at
      from shared_notes
      order by pinned desc, updated_at desc
    `;
    return rows.map((row) => mapNote(row as Record<string, unknown>));
  });

const saveNoteSchema = z.object({
  id: z.string().min(1).max(100).optional(),
  title: z.string().trim().max(160),
  content: z.string().max(50_000),
  color: noteColorSchema,
  pinned: z.boolean(),
});

export const saveSharedNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(saveNoteSchema)
  .handler(async ({ data }): Promise<SharedNote> => {
    const sql = await getSql();
    if (data.id) {
      const rows = await sql`
        update shared_notes
        set title = ${data.title}, content = ${data.content}, color = ${data.color},
            pinned = ${data.pinned}, updated_at = now()
        where id = ${data.id}
        returning id, title, content, color, pinned, created_at, updated_at
      `;
      if (rows.length === 0) throw new Error("Không tìm thấy ghi chú cần lưu.");
      return mapNote(rows[0] as Record<string, unknown>);
    }

    const rows = await sql`
      insert into shared_notes (id, title, content, color, pinned)
      values (${crypto.randomUUID()}, ${data.title}, ${data.content}, ${data.color}, ${data.pinned})
      returning id, title, content, color, pinned, created_at, updated_at
    `;
    return mapNote(rows[0] as Record<string, unknown>);
  });

export const deleteSharedNote = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string().min(1).max(100) }))
  .handler(async ({ data }): Promise<{ deleted: true }> => {
    const sql = await getSql();
    const rows = await sql`delete from shared_notes where id = ${data.id} returning id`;
    if (rows.length === 0) throw new Error("Không tìm thấy ghi chú cần xóa.");
    return { deleted: true };
  });
