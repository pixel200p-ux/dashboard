import { authClient, authEnabled } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { BarChart3, Moon, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useUiStore, type LoginThemeId } from "@/lib/ui-store";

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
  return VALID_SEASONS.has(id as LoginThemeId) ? (id as LoginThemeId) : "default";
}

export function LoginScreen() {
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const theme = useUiStore((s) => s.theme);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const loginThemeRaw = useUiStore((s) => s.loginTheme);
  const setLoginTheme = useUiStore((s) => s.setLoginTheme);
  const season = resolveSeason(loginThemeRaw);
  const skin = SEASONS.find((s) => s.id === season)!;

  const bgUrl =
    season === "default" ? null : theme === "dark" ? (skin.night ?? null) : (skin.day ?? null);

  useEffect(() => {
    if (!bgUrl) return;
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

  async function onEmail(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "up") {
        const { error: err } = await authClient.signUp.email({
          email,
          password,
          name: name || email,
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({ email, password });
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
      className="login-stage relative grid min-h-dvh place-items-center overflow-hidden p-4 sm:p-8"
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
          className="login-season-bg pointer-events-none absolute inset-0 -z-10"
          style={{
            backgroundImage: `url(${bgUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
          aria-hidden
        />
      ) : null}
      <div
        className={`pointer-events-none absolute inset-0 -z-10 ${bgUrl ? "bg-black/25" : ""}`}
        aria-hidden
      />

      <div className="absolute right-4 top-4 z-30 flex items-center gap-2">
        <button
          type="button"
          title={theme === "dark" ? "Chuyển sáng (ảnh ngày)" : "Chuyển tối (ảnh đêm)"}
          aria-label="Đổi sáng tối"
          onClick={toggleTheme}
          className="grid h-10 w-10 place-items-center rounded-full border border-white/80 bg-white/85 text-[#0a2540] shadow-md backdrop-blur"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            title={`${skin.label} · Nhấn đúp để đổi mùa`}
            aria-label={`Theme ${skin.label}. Nhấn đúp để mở menu mùa`}
            aria-expanded={menuOpen}
            onDoubleClick={(e) => {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              setMenuOpen((v) => !v);
            }}
            className="h-10 w-10 rounded-full border-2 border-white/90 shadow-lg ring-2 ring-black/10 transition hover:scale-105"
            style={{ background: skin.swatch }}
          />

          {menuOpen && (
            <div className="absolute right-0 top-12 w-44 overflow-hidden rounded-2xl border border-black/10 bg-white/95 py-1 shadow-xl backdrop-blur">
              {SEASONS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    setLoginTheme(s.id);
                    setMenuOpen(false);
                    const url = theme === "dark" ? s.night : s.day;
                    if (url) {
                      const img = new Image();
                      img.src = url;
                    }
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-[#0a2540] transition hover:bg-black/5 ${
                    season === s.id ? "font-semibold" : ""
                  }`}
                >
                  <span
                    className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                    style={{ background: s.swatch }}
                  />
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="login-card relative z-20 flex w-full max-w-[980px] overflow-hidden">
        {/* Trái: trắng */}
        <aside className="login-left relative hidden w-[46%] lg:block">
          <div className="login-left-mark" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-10">
            <div className="login-mark-icon grid h-16 w-16 place-items-center rounded-2xl text-white shadow-lg">
              <BarChart3 className="h-8 w-8" />
            </div>
            <p className="login-kicker mt-8 text-[11px] font-semibold tracking-[0.55em]">WELCOME</p>
            <h2 className="login-title mt-3 text-center text-3xl font-semibold tracking-tight">
              Portfolio
              <span className="login-title-sub block font-normal">Manager</span>
            </h2>
            <p className="login-sub mt-3 text-center text-sm">Sổ cái danh mục · Trade T+</p>
          </div>
        </aside>

        {/* Phải: form + sóng cùng 1 màu */}
        <section className="login-panel relative z-20 flex w-full flex-col justify-center px-8 py-14 text-white sm:px-12 lg:w-[54%] lg:py-16 lg:pl-16 lg:pr-14">
          <div className="login-wave pointer-events-none absolute inset-y-0 right-full z-0 hidden w-[120px] lg:block" aria-hidden>
            <svg viewBox="0 0 120 800" preserveAspectRatio="none" className="h-full w-full">
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

          <div className="relative mx-auto w-full max-w-[340px] space-y-7">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-white/45">
                Portfolio Manager
              </p>
              <h1 className="mt-2 text-[1.85rem] font-semibold leading-snug tracking-tight">Xin chào!</h1>
              <p className="mt-1.5 text-[15px] text-white/70">Rất vui được gặp bạn :)</p>
            </div>

            {authEnabled ? (
              <>
                <form className="space-y-4" onSubmit={onEmail}>
                  {mode === "up" && (
                    <div className="space-y-1.5">
                      <Label className="text-[13px] font-medium text-white/70">Tên</Label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Tên của bạn"
                        className="login-field"
                      />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-white/70">Email</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="Email"
                      className="login-field"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[13px] font-medium text-white/70">Mật khẩu</Label>
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={8}
                      placeholder="Mật khẩu"
                      className="login-field"
                    />
                  </div>
                  {error && <p className="text-sm text-red-300">{error}</p>}
                  <Button type="submit" disabled={busy} className="login-submit">
                    {busy ? "Đang xử lý..." : mode === "up" ? "Tạo tài khoản" : "Đăng nhập"}
                  </Button>
                </form>
                <button
                  type="button"
                  className="w-full text-center text-sm text-white/55 transition hover:text-white"
                  onClick={() => setMode(mode === "up" ? "in" : "up")}
                >
                  {mode === "up" ? "Đã có tài khoản? Đăng nhập" : "Chưa có tài khoản? Đăng ký"}
                </button>
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