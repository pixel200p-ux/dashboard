import type { LoginThemeId } from "@/lib/ui-store";

const VALID_THEMES = new Set<LoginThemeId>([
  "default",
  "spring",
  "summer",
  "autumn",
  "winter",
]);

export async function fetchSharedLoginTheme(): Promise<LoginThemeId | null> {
  try {
    const response = await fetch("/api/login-theme", { cache: "no-store" });
    if (!response.ok) return null;
    const data = (await response.json()) as { theme?: unknown };
    return typeof data.theme === "string" && VALID_THEMES.has(data.theme as LoginThemeId)
      ? (data.theme as LoginThemeId)
      : null;
  } catch {
    return null;
  }
}

export async function saveSharedLoginTheme(theme: LoginThemeId): Promise<void> {
  if (!VALID_THEMES.has(theme)) return;
  await fetch("/api/login-theme", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ theme }),
  });
}
