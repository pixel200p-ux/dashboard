import { createFileRoute } from "@tanstack/react-router";
import { getSql } from "@/lib/db";
import type { LoginThemeId } from "@/lib/ui-store";

const VALID_THEMES = new Set<LoginThemeId>([
  "default",
  "spring",
  "summer",
  "autumn",
  "winter",
]);

function monthKey(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function automaticTheme(date = new Date()): Exclude<LoginThemeId, "default"> {
  const month = date.getMonth() + 1;
  return month <= 2 || month === 12 ? "winter" : month <= 5 ? "spring" : month <= 8 ? "summer" : "autumn";
}

async function readTheme() {
  const sql = await getSql();
  const rows = await sql<{ key: string; value: string }>`
    select key, value from app_meta where key in ('login_theme', 'login_theme_override_month')
  `;
  const values = new Map(rows.map((row) => [row.key, row.value]));
  const currentMonth = monthKey();
  const overrideMonth = values.get("login_theme_override_month");
  const stored = values.get("login_theme") as LoginThemeId | undefined;

  if (overrideMonth === currentMonth && stored && VALID_THEMES.has(stored)) return stored;

  const theme = automaticTheme();
  await sql`
    insert into app_meta (key, value) values ('login_theme', ${theme})
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
  await sql`
    insert into app_meta (key, value) values ('login_theme_override_month', '')
    on conflict (key) do update set value = excluded.value, updated_at = now()
  `;
  return theme;
}

export const Route = createFileRoute("/api/login-theme")({
  server: {
    handlers: {
      GET: async () => Response.json({ theme: await readTheme() }),
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => null)) as { theme?: unknown } | null;
        if (typeof body?.theme !== "string" || !VALID_THEMES.has(body.theme as LoginThemeId)) {
          return Response.json({ message: "Mùa không hợp lệ" }, { status: 400 });
        }
        const sql = await getSql();
        await sql`
          insert into app_meta (key, value) values ('login_theme', ${body.theme})
          on conflict (key) do update set value = excluded.value, updated_at = now()
        `;
        await sql`
          insert into app_meta (key, value) values ('login_theme_override_month', ${monthKey()})
          on conflict (key) do update set value = excluded.value, updated_at = now()
        `;
        return Response.json({ theme: body.theme });
      },
    },
  },
});
