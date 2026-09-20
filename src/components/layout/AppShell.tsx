import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import {
  BarChart3,
  Building2,
  CalendarDays,
  UserRound,
  CandlestickChart,
  Coins,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  PieChart,
  RefreshCw,
  Settings,
  Sun,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { LoginScreen } from "@/components/LoginScreen";
import { useUiStore } from "@/lib/ui-store";
import { refreshMarketPrices } from "@/lib/api/prices";
import { useQueryClient } from "@tanstack/react-query";
import { PORTFOLIO_KEY, usePortfolio } from "@/lib/use-portfolio";
import { toast } from "sonner";
import { TxDialog } from "@/components/forms/TxDialog";
import { CapitalDialog } from "@/components/forms/CapitalDialog";
import { BankDialog } from "@/components/forms/BankDialog";
import { NotificationFooter, NotifyBell } from "@/components/NotificationFooter";
import { cn } from "@/lib/utils";

const NAV_HOME = [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] as const;

const NAV_ASSETS = [
  { to: "/dcds", label: "DCDS", icon: Landmark },
  { to: "/etf", label: "ETF", icon: PieChart },
  { to: "/stock", label: "Stock", icon: CandlestickChart },
  { to: "/crypto", label: "Crypto", icon: Coins },
  { to: "/bank", label: "Bank", icon: Building2 },
] as const;

const NAV_TOOLS = [
  { to: "/tplus", label: "Trade T+", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: Wallet },
  { to: "/calendar", label: "Calendar", icon: CalendarDays },
  { to: "/profile", label: "Profile", icon: UserRound },
] as const;

const NAV_SETTINGS = [{ to: "/settings", label: "Settings", icon: Settings }] as const;

function formatPriceAgoShort(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const ms = Date.now() - then;
  if (ms < 60_000) return "vừa xong";
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} tiếng trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}

export function AppShell() {
  const { user, isPending } = useCurrentUserState();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [mobile, setMobile] = useState(false);
  const [isPhone, setIsPhone] = useState(false);
  const theme = useUiStore((s) => s.theme);
  const currency = useUiStore((s) => s.currency);
  const toggleTheme = useUiStore((s) => s.toggleTheme);
  const toggleCurrency = useUiStore((s) => s.toggleCurrency);
  const qc = useQueryClient();
  const { data: portfolio } = usePortfolio();

  const lastPriceAt = useMemo(() => {
    const times = (portfolio?.ledger.assets ?? [])
      .map((a) => a.priceUpdatedAt)
      .filter((t): t is string => Boolean(t))
      .map((t) => new Date(t).getTime())
      .filter((n) => Number.isFinite(n));
    if (times.length === 0) return null;
    return new Date(Math.max(...times)).toISOString();
  }, [portfolio]);

  const stale = lastPriceAt != null && Date.now() - new Date(lastPriceAt).getTime() > 24 * 60 * 60 * 1000;
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsPhone(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  if (isPending) return <LoginScreen />;
  if (!user) return <RedirectToSignIn />;

  const email = user.primaryEmail ?? user.displayName ?? "Account";

  async function onRefresh() {
    setRefreshing(true);
    try {
      const res = await refreshMarketPrices();
      qc.setQueryData(PORTFOLIO_KEY, { ledger: res.ledger, state: res.state });

      const entries = Object.values(res.status ?? {});
      if (entries.length > 0) {
        for (const entry of entries) {
          const msg = `${entry.label}: ${entry.ok ? "thành công" : "thất bại"}${entry.detail ? ` (${entry.detail})` : ""}`;
          if (entry.ok) {
            toast.success(msg);
          } else {
            toast.warning(msg);
          }
        }
      } else {
        const summary = res.notes.join(" · ");
        toast.success(summary || "Cập nhật giá xong");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không cập nhật được giá");
    } finally {
      setRefreshing(false);
    }
  }

  function renderItems(items: typeof NAV_HOME | typeof NAV_ASSETS | typeof NAV_TOOLS | typeof NAV_SETTINGS, variant: "default" | "soft" = "default") {
    return items.map((item) => {
      const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
      const Icon = item.icon;
      return (
        <Link
          key={item.to}
          to={item.to}
          onClick={() => setMobile(false)}
          className={cn(
            "flex min-h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
            variant === "soft"
              ? active
                ? "bg-[#3b5a7d] text-white shadow-sm"
                : "text-sidebar-foreground/75 hover:bg-[#2d4667]/80 hover:text-white"
              : active
                ? "bg-white/12 text-white"
                : "text-sidebar-foreground/75 hover:bg-white/8 hover:text-white"
          )}
        >
          <Icon className="h-4 w-4 shrink-0" />
          {item.label}
        </Link>
      );
    });
  }

  const HeaderActions = () => (
    <div className="flex items-center gap-1 sm:gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={onRefresh}
        disabled={refreshing}
        className={cn("relative gap-1.5", pathname.startsWith("/profile") && "bg-background/80")}
      >
        <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        <span className="hidden sm:inline">
          {refreshing
            ? "Đang cập nhật..."
            : lastPriceAt
              ? `Cập nhật giá (${formatPriceAgoShort(lastPriceAt)})`
              : "Cập nhật giá"}
        </span>
        <span
          className={cn(
            "absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-background",
            !lastPriceAt || stale ? "bg-orange-500" : "bg-emerald-500"
          )}
          aria-hidden
        />
      </Button>

      <Button size="sm" variant="outline" onClick={toggleCurrency} title="Chuyển VND / USD" className={cn(pathname.startsWith("/profile") && "bg-background/80")}>
        <span className={currency === "VND" ? "font-semibold" : "text-muted-foreground"}>VND</span>
        <span className="text-muted-foreground">/</span>
        <span className={currency === "USD" ? "font-semibold" : "text-muted-foreground"}>USD</span>
      </Button>

      <NotifyBell />

      <Button size="icon" variant="outline" onClick={toggleTheme} title="Theme" className={cn(pathname.startsWith("/profile") && "bg-background/80")}>
        {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );

  return (
    <div className="min-h-dvh bg-background text-foreground">
      {mobile && (
        <button
          className="fixed inset-0 z-[120] bg-black/50 md:hidden"
          onClick={() => setMobile(false)}
          aria-label="Đóng menu"
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 flex w-[17rem] flex-col border-r border-white/10 bg-sidebar text-sidebar-foreground",
          pathname.startsWith("/profile") && !isPhone
            ? "profile-aside"
            : "transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
          mobile ? "translate-x-0 shadow-2xl" : "max-md:-translate-x-full",
          !mobile && "md:inset-y-0"
        )}
        style={{
          zIndex: mobile ? 130 : 50,
        }}
      >
        <div className="flex items-center justify-between gap-2 border-b border-white/10 px-4 py-5">
          <Link to="/" onClick={() => setMobile(false)} className="flex min-w-0 items-center gap-2.5">
            <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10">
              <BarChart3 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-base font-semibold leading-tight">Portfolio Manager</p>
              <p className="text-sm text-white/50">Sổ cái thuần tài sản</p>
            </div>
          </Link>
          <button className="grid h-10 w-10 place-items-center md:hidden" onClick={() => setMobile(false)}>
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col p-3">
          <div className="flex flex-1 flex-col gap-1">
            {renderItems(NAV_HOME)}
            <div className="my-1 rounded-xl bg-[#0F172A]/95 p-1 ring-1 ring-inset ring-white/8">
              {renderItems(NAV_ASSETS, "soft")}
            </div>
            <div className="mx-3 my-1.5 h-px bg-white/10" aria-hidden />
            {renderItems(NAV_TOOLS)}
          </div>

          <div className="mt-3 border-t border-white/10 pt-2">
            {renderItems(NAV_SETTINGS)}
            <div className="mt-1 flex items-center gap-1 px-2 py-1">
              <span className="min-w-0 flex-1 truncate px-1 text-xs text-white/55" title={email}>
                {email}
              </span>
              <Tooltip content="Đăng xuất">
                <button
                  type="button"
                  disabled={signingOut}
                  onClick={() => {
                    setSigningOut(true);
                    void signOut().catch(() => setSigningOut(false));
                  }}
                  className="grid h-10 w-10 shrink-0 place-items-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
                  aria-label="Đăng xuất"
                >
                  <LogOut className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          </div>
        </nav>
      </aside>

      <div className="md:pl-[17rem] [--sidebar-w:0px] md:[--sidebar-w:17rem]">
        <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 w-full items-center justify-between gap-2 px-3 md:px-5">
            <div className="flex items-center gap-2">
              {!mobile && (
                <button
                  className="grid h-10 w-10 place-items-center rounded-md hover:bg-muted md:hidden"
                  onClick={() => setMobile(true)}
                  aria-label="Menu"
                >
                  <Menu className="h-5 w-5" />
                </button>
              )}
              <span className="hidden text-sm font-semibold sm:inline">Portfolio Manager</span>
            </div>

            <div className="flex items-center gap-2">
              <div className="mr-1 hidden min-w-0 flex-col items-end leading-tight sm:flex">
                <span className={cn("max-w-[11rem] truncate text-[11px]", stale || !lastPriceAt ? "text-orange-500" : "text-muted-foreground")}>
                  {lastPriceAt ? formatPriceAgoShort(lastPriceAt) : "Chưa cập nhật"}
                </span>
                {!lastPriceAt && (
                  <span className="text-[10px] text-muted-foreground">Đang dùng giá vốn</span>
                )}
              </div>
              <HeaderActions />
            </div>
          </div>
        </header>

        <main
          className={cn(
            "min-w-0",
            pathname.startsWith("/profile")
              ? "min-h-dvh overflow-x-hidden overflow-y-auto p-0 pb-4 touch-pan-y"
              : pathname.startsWith("/calendar")
                ? "overflow-x-hidden p-3 pb-4 lg:flex lg:h-[calc(100dvh-3.5rem)] lg:max-h-[calc(100dvh-3.5rem)] lg:overflow-hidden lg:p-6"
                : "overflow-x-hidden p-3 pb-4 md:p-6",
          )}
        >
          <div className="w-full">
            <Outlet />
          </div>
        </main>
        <NotificationFooter />
      </div>

      <TxDialog />
      <CapitalDialog />
      <BankDialog />
    </div>
  );
}