import { authClient, authEnabled } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Eye, EyeOff, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiStore, type LoginThemeId } from "@/lib/ui-store";
import { PROFILE_SEASON_BG, type ProfileSeason } from "@/constants/seasons";
import { saveSharedLoginTheme } from "@/lib/api/login-theme";

const SEASONS: {
  id: LoginThemeId;
  label: string;
  swatch: string;
  day?: string;
  night?: string;
  navy: string;
  btn: string;
}[] = [
  {
    id: "default",
    label: "Mặc định",
    swatch: "#0a2540",
    navy: "#0a2540",
    btn: "#c5d4e0",
  },
  {
    id: "spring",
    label: "Xuân",
    swatch: "#3d8b6e",
    day: "/login/spring-day.webp",
    night: "/login/spring-night.webp",
    navy: "#1a4d3a",
    btn: "#d4e8dc",
  },
  {
    id: "summer",
    label: "Hạ",
    swatch: "#d97706",
    day: "/login/summer-day.webp",
    night: "/login/summer-night.webp",
    navy: "#7c2d12",
    btn: "#f5e6d3",
  },
  {
    id: "autumn",
    label: "Thu",
    swatch: "#c2410c",
    day: "/login/autumn-day.webp",
    night: "/login/autumn-night.webp",
    navy: "#5c2a1a",
    btn: "#f0e0d0",
  },
  {
    id: "winter",
    label: "Đông",
    swatch: "#3b82a0",
    day: "/login/winter-day.webp",
    night: "/login/winter-night.webp",
    navy: "#1a2f45",
    btn: "#d6e4ee",
  },
];

const VALID_SEASONS = new Set(SEASONS.map((s) => s.id));

function resolveSeason(id: string): LoginThemeId {
  return VALID_SEASONS.has(id as LoginThemeId)
    ? (id as LoginThemeId)
    : "default";
}

export function LoginScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [signupUnlocked, setSignupUnlocked] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const loginThemeRaw = useUiStore((s) => s.loginTheme);
  const setLoginTheme = useUiStore((s) => s.setLoginTheme);
  const season = resolveSeason(loginThemeRaw);
  const skin = SEASONS.find((s) => s.id === season)!;

  const visualSeason = season === "default" ? "spring" : season;
  const bgUrl = PROFILE_SEASON_BG[visualSeason][theme];

  useEffect(() => {
    const img = new Image();
    img.src = bgUrl;
  }, [bgUrl]);

  useEffect(() => {
    if (!VALID_SEASONS.has(loginThemeRaw as LoginThemeId)) {
      setLoginTheme("default");
    }
  }, [loginThemeRaw, setLoginTheme]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDoc(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [menuOpen]);

  function normalizeEmail(value: string) {
    const trimmed = value.trim();
    return trimmed && !trimmed.includes("@") ? `${trimmed}@gmail.com` : trimmed;
  }

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    const normalizedEmail = normalizeEmail(email);
    setEmail(normalizedEmail);
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email: normalizedEmail,
          password,
          name: name || email,
        });
        if (err) throw new Error(err.message);
        setSignupUnlocked(false);
        setMode("in");
      } else {
        const { error: err } = await authClient.signIn.email({
          email: normalizedEmail,
          password,
        });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đăng nhập thất bại");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="login-stage relative isolate grid min-h-dvh place-items-center overflow-hidden p-4 sm:p-8"
      data-skin={season}
      style={
        {
          "--login-navy": skin.navy,
          "--login-btn": skin.btn,
        } as React.CSSProperties
      }
    >
      {bgUrl ? (
        <div
          className="login-season-bg pointer-events-none absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={`pointer-events-none absolute inset-0 z-[1] ${bgUrl ? "bg-black/25" : ""}`}
        aria-hidden
      />

      <div className="absolute right-4 top-4 z-30 flex items-center gap-2 sm:right-7 sm:top-7">
        <button
          type="button"
          title={
            theme === "dark" ? "Chuyển sáng (ảnh ngày)" : "Chuyển tối (ảnh đêm)"
          }
          aria-label="Đổi sáng tối"
          onClick={toggleTheme}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/80 bg-white/85 text-[#0a2540] shadow-md backdrop-blur"
        >
          {theme === "dark" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <div
          ref={menuRef}
          className="relative"
        >
          <button
            type="button"
            title={`${skin.label} · Nhấn để đổi mùa`}
            aria-label={`Theme ${skin.label}. Nhấn để mở menu mùa`}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }}
            className="h-10 w-10 rounded-full border-2 border-white/90 bg-cover bg-center shadow-lg ring-2 ring-black/10 transition hover:scale-105"
            style={{
              backgroundImage: `url(${PROFILE_SEASON_BG[visualSeason][theme]})`,
            }}
          />

          {menuOpen && (
            <div className="absolute right-0 top-12 z-30 flex flex-row-reverse items-center gap-1.5 rounded-2xl border border-white/20 bg-black/60 p-1.5 shadow-xl backdrop-blur-md md:w-12 md:flex-col md:gap-1 md:p-1">
              {(Object.keys(PROFILE_SEASON_BG) as ProfileSeason[])
                .filter((item) => item !== visualSeason)
                .map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setLoginTheme(item);
                      void saveSharedLoginTheme(item);
                      setMenuOpen(false);
                    }}
                    onPointerUp={(event) => event.stopPropagation()}
                    aria-label={`Chọn mùa ${item}`}
                    className="h-9 w-9 shrink-0 rounded-full border border-white/40 bg-cover bg-center transition-transform hover:scale-110"
                    style={{
                      backgroundImage: `url(${PROFILE_SEASON_BG[item][theme]})`,
                    }}
                  ></button>
                ))}
            </div>
          )}
        </div>
      </div>

      <div className="login-card relative z-20 grid w-full max-w-[1360px] overflow-hidden">
        <aside className="login-left relative p-3 sm:p-4 lg:p-5">
          <div
            className="login-visual-frame relative flex h-full min-h-[190px] items-end overflow-hidden rounded-[20px] border border-white/35 bg-cover bg-center p-5 sm:min-h-[230px] lg:min-h-0 lg:p-7"
            style={{ backgroundImage: `url(${bgUrl})` }}
          >
            <div className="login-visual-shade absolute inset-0" aria-hidden />
            <div className="login-left-mark" aria-hidden />
            <div className="relative z-10">
              <div className="login-mark-icon grid h-12 w-12 place-items-center rounded-2xl text-white shadow-lg sm:h-14 sm:w-14">
                <BarChart3 className="h-6 w-6 sm:h-7 sm:w-7" />
              </div>
              <p className="login-kicker mt-5 text-[10px] font-semibold tracking-[0.5em]">
                WELCOME
              </p>
              <h2 className="login-title mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
                Portfolio
                <span className="login-title-sub block font-normal">
                  Manager
                </span>
              </h2>
              <p className="login-sub mt-2 text-sm">
                Sổ danh mục · Trade T+
              </p>
            </div>
          </div>
        </aside>

        {/* Phải: form + sóng cùng 1 màu */}
        <section className="login-panel relative z-20 flex w-full flex-col justify-center px-5 py-10 text-white sm:px-8 sm:py-14 lg:px-10 lg:py-16">
          <div
            className="login-wave pointer-events-none absolute inset-y-0 right-full z-0 hidden w-[120px] lg:block"
            aria-hidden
          >
            <svg
              viewBox="0 0 120 800"
              preserveAspectRatio="none"
              className="h-full w-full"
            >
              <path
                d="M18,0
                   C72,70  108,150  62,250
                   C8,360  110,430  58,540
                   C18,630  86,710  40,800
                   L120,800 L120,0 Z"
                fill="var(--login-navy)"
              />
            </svg>
          </div>
          <div className="login-orbs" aria-hidden />

          <div className="relative mx-auto w-full max-w-[310px] space-y-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                Portfolio Manager
              </p>
              <h1
                className="mt-2 cursor-default text-[1.85rem] font-semibold leading-snug tracking-tight"
                onDoubleClick={() => setSignupUnlocked((unlocked) => !unlocked)}
              >
                Xin chào!
              </h1>
              <p className="mt-1.5 text-[15px] text-white/70">
                Rất vui được gặp bạn :)
              </p>
            </div>

            {authEnabled ? (
              <>
                <form className="space-y-4" onSubmit={onEmail}>
                  {mode === "up" && (
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-white/70">
                        Tên
                      </Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tên của bạn"
                        className="login-field"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-white/70">
                      Email
                    </Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) =>
                        setEmail(e.target.value.replace(/\s/g, ""))
                      }
                      onBlur={() => setEmail((value) => normalizeEmail(value))}
                      required
                      placeholder="...@gmail.com"
                      className="login-field"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-white/70">
                      Mật khẩu
                    </Label>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={8}
                        placeholder="..."
                        className="login-field pr-12"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((visible) => !visible)}
                        aria-label={
                          showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"
                        }
                        className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-white/55 transition hover:bg-white/10 hover:text-white"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  {error && <p className="text-sm text-red-300">{error}</p>}
                  <Button
                    type="submit"
                    disabled={busy}
                    className="login-submit"
                  >
                    {busy
                      ? "Đang xử lý..."
                      : mode === "up"
                        ? "Tạo tài khoản"
                        : "Đăng nhập"}
                  </Button>
                </form>
                {signupUnlocked && (
                  <button
                    type="button"
                    className="w-full text-center text-sm text-white/55 transition hover:text-white"
                    onClick={() => setMode(mode === "up" ? "in" : "up")}
                  >
                    {mode === "up" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-sm text-white/60">Đăng nhập đang tắt.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
