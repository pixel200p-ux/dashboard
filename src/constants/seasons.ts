import type { LoginThemeId } from "@/lib/ui-store";

export type ProfileSeason = Exclude<LoginThemeId, "default">;

export const PROFILE_SEASON_BG: Record<ProfileSeason, { light: string; dark: string }> = {
  spring: {
    light: "/login/spring-day.webp",
    dark: "/login/spring-night.webp",
  },
  summer: {
    light: "/login/summer-day.webp",
    dark: "/login/summer-night.webp",
  },
  autumn: {
    light: "/login/autumn-day.webp",
    dark: "/login/autumn-night.webp",
  },
  winter: {
    light: "/login/winter-day.webp",
    dark: "/login/winter-night.webp",
  },
};

export function resolveProfileSeason(season: LoginThemeId): ProfileSeason {
  return season === "default" ? "spring" : season;
}