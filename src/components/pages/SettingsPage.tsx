import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDesc, CardTitle, CollapsibleCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveFees } from "@/lib/api/portfolio";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { signOut } from "@/lib/auth/client";
import { usePortfolio, usePortfolioMutation, PORTFOLIO_KEY } from "@/lib/use-portfolio";
import { useProfile } from "@/lib/use-profile";
import { resetApplication, setEditPin } from "@/lib/api/profile";
import { CALENDAR_KEY } from "@/lib/use-calendar";
import { PROFILE_KEY, MILESTONES_KEY } from "@/lib/use-profile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/lib/ui-store";
import { Check, Database, KeyRound, LogOut, Moon, Pencil, RotateCcw, ShieldCheck, Sun, WalletCards } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type { FeeProfile } from "@/engine/types";

const PROFILES: { id: FeeProfile; label: string }[] = [
  { id: "STOCK_VPS", label: "VPS Stock" },
  { id: "STOCK_SSI", label: "SSI Stock" },
  { id: "CRYPTO", label: "Crypto" },
  { id: "DCDS", label: "DCDS" },
  { id: "ETF", label: "ETF" },
];

export function SettingsPage() {
  const user = useCurrentUser();
  const { data, isPending } = usePortfolio();
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const feeMut = usePortfolioMutation((d: Parameters<typeof saveFees>[0]) => saveFees(d), "Đã lưu phí");
  const [draft, setDraft] = useState<Record<string, { buy: string; sell: string; tax: string }>>({});
  const [signingOut, setSigningOut] = useState(false);
  const [editFees, setEditFees] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetPin, setResetPin] = useState("");

  const pinMut = useMutation({
    mutationFn: (input: Parameters<typeof setEditPin>[0]) => setEditPin(input),
    onSuccess: (next) => {
      qc.setQueryData(PROFILE_KEY, (old: typeof profile) => old ? { ...old, hasEditPin: next.hasEditPin } : old);
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
    },
  });
  const resetMut = useMutation({
    mutationFn: (input: Parameters<typeof resetApplication>[0]) => resetApplication(input),
    onSuccess: () => {
      localStorage.removeItem("pm-ui");
      void Promise.all([
        qc.invalidateQueries({ queryKey: PORTFOLIO_KEY }),
        qc.invalidateQueries({ queryKey: CALENDAR_KEY }),
        qc.invalidateQueries({ queryKey: PROFILE_KEY }),
        qc.invalidateQueries({ queryKey: MILESTONES_KEY }),
      ]);
      setResetPin("");
      window.location.reload();
    },
  });

  if (isPending || !data) return <Skeleton className="h-64" />;
  const email = user?.primaryEmail ?? user?.displayName ?? "Account";

  return (
    <div className="settings-page relative mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="settings-hero relative overflow-hidden rounded-2xl border border-border/70 p-5 shadow-(--shadow-card) sm:p-7">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace preferences</p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Quản lý tài khoản, giao diện và các quy tắc tính toán của sổ cái.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/45 px-3 py-2 text-xs font-medium backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-profit shadow-[0_0_0_4px_color-mix(in_oklab,var(--app-profit)_15%,transparent)]" />
            Hệ thống đang hoạt động
          </div>
        </div>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
        <CollapsibleCard
          title="Tài khoản hiện tại"
          defaultOpen={false}
          className="settings-panel p-0"
          headerAction={
            <Button variant="outline" size="sm" disabled={signingOut} onClick={(e) => { e.stopPropagation(); setSigningOut(true); void signOut().catch(() => setSigningOut(false)); }}>
              <LogOut className="h-4 w-4" /> Đăng xuất
            </Button>
          }
        >
          <div className="flex items-center gap-4 p-5 sm:p-6">
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/15">
              <WalletCards className="h-6 w-6" />
            </div>
            <div className="min-w-0">
              <p className="mt-1 truncate text-base font-semibold">{email}</p>
              <p className="mt-1 text-xs text-muted-foreground">Sổ cái dùng chung cho workspace này</p>
            </div>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Tỷ giá tham chiếu"
          defaultOpen={false}
          className="settings-panel"
        >
          <div className="mt-2 space-y-2">
            <p className="font-mono text-2xl font-semibold tabular-nums tracking-tight">{data.state.usdVnd.toLocaleString("vi-VN")}</p>
            <p className="text-xs text-muted-foreground">USD / VND · cập nhật từ header</p>
          </div>
        </CollapsibleCard>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <CollapsibleCard
          title="Giao diện"
          defaultOpen={false}
          className="settings-panel"
        >
          <p className="mt-1 text-xs text-muted-foreground">Chọn chế độ hiển thị cho workspace.</p>
          <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl border border-border/70 bg-background/35 p-1.5">
            <button type="button" aria-pressed={theme === "light"} onClick={() => setTheme("light")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${theme === "light" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60"}`}>
              <Sun className="h-4 w-4" /> Sáng {theme === "light" && <Check className="h-4 w-4 text-profit" />}
            </button>
            <button type="button" aria-pressed={theme === "dark"} onClick={() => setTheme("dark")} className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-medium transition ${theme === "dark" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:bg-muted/60"}`}>
              <Moon className="h-4 w-4" /> Tối {theme === "dark" && <Check className="h-4 w-4 text-profit" />}
            </button>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Mã bảo vệ"
          defaultOpen={false}
          className="settings-panel"
          headerAction={
            <div className={`rounded-full px-2.5 py-1 text-xs font-semibold ${profile?.hasEditPin ? "bg-profit/10 text-profit" : "bg-warn/10 text-warn"}`}>
              {profile?.hasEditPin ? "Đã bật" : "Chưa thiết lập"}
            </div>
          }
        >
          <p className="mt-1 text-xs text-muted-foreground">Dùng khi sửa hoặc xóa dữ liệu lịch sử.</p>
          <form className="mt-4 space-y-2.5" onSubmit={(event) => { event.preventDefault(); if (newPin !== confirmPin || newPin.length !== 6) return; pinMut.mutate({ data: { currentPin: profile?.hasEditPin ? currentPin : undefined, newPin } }); }}>
            {profile?.hasEditPin && <Input aria-label="Mã hiện tại" value={currentPin} onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Mã hiện tại" type="password" />}
            <div className="grid gap-2 sm:grid-cols-2">
              <Input aria-label="Mã mới" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Mã mới · 6 số" type="password" required />
              <Input aria-label="Xác nhận mã mới" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Nhập lại mã" type="password" required />
            </div>
            <Button type="submit" size="sm" disabled={pinMut.isPending || newPin.length !== 6 || newPin !== confirmPin}><KeyRound className="h-4 w-4" /> {profile?.hasEditPin ? "Đổi mã bảo vệ" : "Tạo mã bảo vệ"}</Button>
          </form>
        </CollapsibleCard>
      </section>

      <CollapsibleCard
        title="Phí & thuế mặc định"
        defaultOpen={false}
        className="settings-panel p-0"
        headerAction={
          <Button size="sm" variant={editFees ? "outline" : "default"} onClick={(e) => { e.stopPropagation(); setEditFees((v) => !v); }}>{editFees ? "Đóng chỉnh sửa" : <><Pencil className="h-3.5 w-3.5" /> Chỉnh sửa</>}</Button>
        }
      >
        <div className="p-5 sm:p-6 border-b border-border/70 text-xs text-muted-foreground">Các thông số được dùng khi ghi nhận giao dịch mới.</div>
        <div className="divide-y divide-border/60">
          {PROFILES.map((p) => {
            const row = data.ledger.fees.find((f) => f.profile === p.id);
            const d = draft[p.id] ?? { buy: String(row?.buyFeePct ?? 0), sell: String(row?.sellFeePct ?? 0), tax: String(row?.sellTaxPct ?? 0) };
            return (
              <div key={p.id} className="settings-fee-row p-5 sm:px-6">
                <div className="mb-4 flex items-center justify-between gap-3"><p className="font-semibold">{p.label}</p><span className="text-xs text-muted-foreground">{p.id === "CRYPTO" ? "Tài sản số" : p.id.includes("STOCK") ? "Chứng khoán" : "Quỹ"}</span></div>
                {editFees ? (
                  <form className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); feeMut.mutate({ data: { profile: p.id, buyFeePct: Number(d.buy), sellFeePct: Number(d.sell), sellTaxPct: Number(d.tax) } }); }}>
                    <div><Label className="text-xs">Mua %</Label><Input value={d.buy} onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...d, buy: e.target.value } }))} /></div>
                    <div><Label className="text-xs">Bán %</Label><Input value={d.sell} onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...d, sell: e.target.value } }))} /></div>
                    <div><Label className="text-xs">Thuế %</Label><Input value={d.tax} onChange={(e) => setDraft((x) => ({ ...x, [p.id]: { ...d, tax: e.target.value } }))} /></div>
                    <Button type="submit" size="sm">Lưu</Button>
                  </form>
                ) : (
                  <dl className="grid grid-cols-3 gap-4"><div><dt className="text-xs text-muted-foreground">Mua</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{row?.buyFeePct ?? 0}%</dd></div><div><dt className="text-xs text-muted-foreground">Bán</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{row?.sellFeePct ?? 0}%</dd></div><div><dt className="text-xs text-muted-foreground">Thuế</dt><dd className="mt-1 font-mono text-sm font-semibold tabular-nums">{row?.sellTaxPct ?? 0}%</dd></div></dl>
                )}
              </div>
            );
          })}
        </div>
      </CollapsibleCard>

      <CollapsibleCard
        title="Vùng nguy hiểm"
        defaultOpen={false}
        className="settings-danger rounded-2xl border border-destructive/30"
      >
        <div className="space-y-4 pt-2">
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Reset sẽ xóa vĩnh viễn portfolio, lịch, giá, hồ sơ và mã bảo vệ. Tài khoản đăng nhập vẫn được giữ.</p>
          <form className="flex w-full flex-col gap-2 sm:flex-row lg:w-auto" onSubmit={(event) => { event.preventDefault(); if (!window.confirm("Xóa vĩnh viễn toàn bộ dữ liệu? Thao tác này không thể hoàn tác.")) return; resetMut.mutate({ data: { pin: resetPin } }); }}>
            <Input className="sm:w-52" aria-label="Mã xác nhận reset" value={resetPin} onChange={(e) => setResetPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Mã 6 số" type="password" required />
            <Button type="submit" variant="destructive" disabled={resetMut.isPending || resetPin.length !== 6}><RotateCcw className="h-4 w-4" /> Reset dữ liệu</Button>
          </form>
        </div>
      </CollapsibleCard>
    </div>
  );
}