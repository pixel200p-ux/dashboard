import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsibleCard, CollapsibleCardGroup } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatViDate } from "@/engine/dates";
import { saveFees } from "@/lib/api/portfolio";
import { fetchTrash, permanentlyDeleteTrashItem, restoreTrashItem } from "@/lib/api/trash";
import { useCurrentUser } from "@/lib/auth/use-current-user";
import { usePortfolio, usePortfolioMutation, PORTFOLIO_KEY } from "@/lib/use-portfolio";
import { useProfile } from "@/lib/use-profile";
import { resetApplication, setEditPin } from "@/lib/api/profile";
import { CALENDAR_KEY } from "@/lib/use-calendar";
import { PROFILE_KEY, MILESTONES_KEY } from "@/lib/use-profile";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useUiStore } from "@/lib/ui-store";
import { PixelSettings } from "@/components/pages/PixelSettings";
import { KeyRound, Pencil, RotateCcw, ShieldCheck, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import type { FeeProfile } from "@/engine/types";
import { toast } from "sonner";

type TrashKind = "TRANSACTION" | "CAPITAL" | "BANK";
type TrashPayload = Awaited<ReturnType<typeof fetchTrash>>;

type TrashRow = {
  id: string;
  kind: TrashKind;
  type: string;
  title: string;
  details: string;
  deletedAt: string;
};

function formatTrashNumber(value: number | null, digits = 4) {
  return value == null ? "—" : value.toLocaleString("vi-VN", { maximumFractionDigits: digits });
}

function getTrashRows(trash: TrashPayload): TrashRow[] {
  return [
    ...trash.transactions.map((transaction) => ({
      id: transaction.id,
      kind: "TRANSACTION" as const,
      type: transaction.txType === "BUY" ? "Lệnh MUA" : transaction.txType === "SELL" ? "Lệnh BÁN" : "Giao dịch",
      title: transaction.symbol ?? "Không rõ mã tài sản",
      details: `Ngày giao dịch ${formatViDate(transaction.txDate)} · SL ${formatTrashNumber(transaction.quantity)} · Giá ${formatTrashNumber(transaction.price)}`,
      deletedAt: transaction.deletedAt ?? transaction.createdAt,
    })),
    ...trash.capitalMovements.map((movement) => ({
      id: movement.id,
      kind: "CAPITAL" as const,
      type: movement.kind === "DEPOSIT" ? "Nạp vốn" : "Rút vốn",
      title: `${formatTrashNumber(movement.amount, 0)} ₫ · ${movement.bucket}`,
      details: `Ngày ghi nhận ${formatViDate(movement.movementDate)}${movement.notes ? ` · ${movement.notes}` : ""}`,
      deletedAt: movement.deletedAt ?? movement.createdAt,
    })),
    ...trash.bankDeposits.map((deposit) => ({
      id: deposit.id,
      kind: "BANK" as const,
      type: "Sổ tiết kiệm",
      title: deposit.bankName,
      details: `${formatTrashNumber(deposit.principal, 0)} ₫ · Mở ngày ${formatViDate(deposit.startDate)} · ${deposit.termMonths} tháng`,
      deletedAt: deposit.deletedAt ?? deposit.createdAt,
    })),
  ].sort((a, b) => Date.parse(b.deletedAt) - Date.parse(a.deletedAt));
}

function removeTrashRow(trash: TrashPayload, kind: TrashKind, id: string): TrashPayload {
  if (kind === "TRANSACTION") {
    return { ...trash, transactions: trash.transactions.filter((item) => item.id !== id) };
  }
  if (kind === "CAPITAL") {
    return { ...trash, capitalMovements: trash.capitalMovements.filter((item) => item.id !== id) };
  }
  return { ...trash, bankDeposits: trash.bankDeposits.filter((item) => item.id !== id) };
}

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
  const cardOpacity = useUiStore((s) => s.cardOpacity);
  const setCardOpacity = useUiStore((s) => s.setCardOpacity);
  const feeMut = usePortfolioMutation((d: Parameters<typeof saveFees>[0]) => saveFees(d), "Đã lưu phí");
  const [draft, setDraft] = useState<Record<string, { buy: string; sell: string; tax: string }>>({});
  const [editFees, setEditFees] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [resetPin, setResetPin] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [trashPin, setTrashPin] = useState("");
  const [trashData, setTrashData] = useState<TrashPayload | null>(null);
  const [emptyingTrash, setEmptyingTrash] = useState(false);

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
  const trashReadMut = useMutation({
    mutationFn: (pin: string) => fetchTrash({ data: { pin } }),
    onSuccess: (next) => setTrashData(next),
    onError: (error: Error) => toast.error(error.message || "Không mở được thùng rác"),
  });
  const trashRestoreMut = useMutation({
    mutationFn: (input: Parameters<typeof restoreTrashItem>[0]) => restoreTrashItem(input),
    onSuccess: (_result, input) => {
      setTrashData((current) => current ? removeTrashRow(current, input.data.kind, input.data.id) : current);
      void qc.invalidateQueries({ queryKey: PORTFOLIO_KEY });
      toast.success("Đã khôi phục mục đã chọn");
    },
    onError: (error: Error) => toast.error(error.message || "Không khôi phục được"),
  });
  const trashDeleteMut = useMutation({
    mutationFn: (input: Parameters<typeof permanentlyDeleteTrashItem>[0]) => permanentlyDeleteTrashItem(input),
    onSuccess: (_result, input) => {
      setTrashData((current) => current ? removeTrashRow(current, input.data.kind, input.data.id) : current);
      toast.success("Đã xóa vĩnh viễn mục đã chọn");
    },
    onError: (error: Error) => toast.error(error.message || "Không xóa vĩnh viễn được"),
  });

  function closeTrash() {
    setTrashOpen(false);
    setTrashPin("");
    setTrashData(null);
    trashReadMut.reset();
    trashRestoreMut.reset();
    trashDeleteMut.reset();
  }

  async function emptyTrash() {
    if (!trashData || !trashPin) return;
    const rows = getTrashRows(trashData);
    if (rows.length === 0 || !window.confirm(`Xóa vĩnh viễn toàn bộ ${rows.length} mục trong thùng rác? Thao tác này không thể hoàn tác.`)) return;

    setEmptyingTrash(true);
    try {
      const results = await Promise.allSettled(rows.map((row) =>
        permanentlyDeleteTrashItem({ data: { id: row.id, kind: row.kind, pin: trashPin } }),
      ));
      const successfulRows = rows.filter((_row, index) => results[index]?.status === "fulfilled");
      const failedCount = rows.length - successfulRows.length;
      setTrashData((current) => current
        ? successfulRows.reduce((next, row) => removeTrashRow(next, row.kind, row.id), current)
        : current);

      if (failedCount > 0) {
        try {
          setTrashData(await fetchTrash({ data: { pin: trashPin } }));
        } catch {
          toast.error("Một số mục chưa xóa được; danh sách hiện lại những mục đã xác nhận xóa thành công.");
        }
        toast.error(`Đã xóa ${successfulRows.length}/${rows.length} mục; còn ${failedCount} mục.`);
      } else {
        toast.success(`Đã làm sạch ${successfulRows.length} mục trong thùng rác`);
      }
    } finally {
      setEmptyingTrash(false);
    }
  }

  if (isPending || !data) return <Skeleton className="h-64" />;
  const accountName = (user?.primaryEmail ?? user?.displayName ?? "Account").split("@")[0];
  const trashRows = trashData ? getTrashRows(trashData) : [];

  return (
    <div className="settings-page relative mx-auto w-full max-w-6xl space-y-6 pb-8">
      <header className="settings-hero relative overflow-hidden rounded-2xl border border-border/70 p-5 shadow-(--shadow-card) sm:p-7">
        <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="mb-3 flex items-center justify-between gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace preferences</p>
              <p className="whitespace-nowrap text-right font-mono text-sm font-semibold tabular-nums">
                {data.state.usdVnd.toLocaleString("vi-VN")} VND
              </p>
            </div>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Settings</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">Quản lý tài khoản, giao diện và các quy tắc tính toán của sổ cái.</p>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/45 px-3 py-2 text-xs font-medium backdrop-blur-md">
            <span className="h-2 w-2 rounded-full bg-profit shadow-[0_0_0_4px_color-mix(in_oklab,var(--app-profit)_15%,transparent)]" />
            {accountName}
          </div>
        </div>
      </header>

      <section>
        <CollapsibleCardGroup defaultOpen={false}>
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
        </CollapsibleCardGroup>
      </section>

      <PixelSettings />

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

      <section className="grid gap-4 lg:grid-cols-3">
        <CollapsibleCard title="Độ mờ card" defaultOpen={false} className="settings-panel">
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="app-card-opacity" className="text-sm text-muted-foreground">Độ mờ</label>
            <output htmlFor="app-card-opacity" className="font-mono text-sm font-semibold">{cardOpacity}%</output>
          </div>
          <input
            id="app-card-opacity"
            type="range"
            min="0"
            max="100"
            step="1"
            value={cardOpacity}
            onChange={(event) => setCardOpacity(Number(event.currentTarget.value))}
            aria-label="Độ mờ của các card"
            className="mt-3 w-full accent-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">Mặc định 82%.</p>
        </CollapsibleCard>

        <CollapsibleCard title="Thùng rác" defaultOpen={false} className="settings-panel">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Các mục đã xóa</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {profile?.hasEditPin
                  ? "Khôi phục từng mục hoặc xóa vĩnh viễn khỏi sổ cái."
                  : "Hãy thiết lập mã bảo vệ 6 số trước khi mở thùng rác."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                setTrashPin("");
                setTrashData(null);
                setTrashOpen(true);
              }}
              disabled={!profile?.hasEditPin}
            >
              <Trash2 /> Mở thùng rác
            </Button>
          </div>
        </CollapsibleCard>

        <CollapsibleCard
          title="Vùng nguy hiểm"
          defaultOpen={false}
          className="settings-danger rounded-2xl border border-destructive/30"
        >
          <div className="space-y-4 pt-2">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">Reset sẽ xóa vĩnh viễn portfolio, lịch, giá, hồ sơ và mã bảo vệ. Tài khoản đăng nhập vẫn được giữ.</p>
            <form className="flex w-full flex-col gap-2" onSubmit={(event) => { event.preventDefault(); if (!window.confirm("Xóa vĩnh viễn toàn bộ dữ liệu? Thao tác này không thể hoàn tác.")) return; resetMut.mutate({ data: { pin: resetPin } }); }}>
              <Input className="w-full" aria-label="Mã xác nhận reset" value={resetPin} onChange={(e) => setResetPin(e.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" maxLength={6} placeholder="Mã 6 số" type="password" required />
              <Button type="submit" variant="destructive" disabled={resetMut.isPending || resetPin.length !== 6}><RotateCcw className="h-4 w-4" /> Reset dữ liệu</Button>
            </form>
          </div>
        </CollapsibleCard>
      </section>

      <Dialog open={trashOpen} onOpenChange={(open) => { if (!open) closeTrash(); else setTrashOpen(true); }}>
        <DialogContent title="Thùng rác" className="max-w-5xl">
          {!trashData ? (
            <form
              className="mx-auto max-w-sm space-y-4 py-2"
              onSubmit={(event) => {
                event.preventDefault();
                trashReadMut.mutate(trashPin);
              }}
            >
              <div className="text-center">
                <ShieldCheck className="mx-auto h-8 w-8 text-primary" />
                <p className="mt-3 font-medium">Nhập mã bảo vệ</p>
                <p className="mt-1 text-sm text-muted-foreground">Mã PIN gồm 6 chữ số</p>
              </div>
              <Input
                autoFocus
                aria-label="Mã PIN thùng rác"
                autoComplete="one-time-code"
                inputMode="numeric"
                maxLength={6}
                placeholder="••••••"
                type="password"
                value={trashPin}
                onChange={(event) => setTrashPin(event.target.value.replace(/\D/g, "").slice(0, 6))}
              />
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={closeTrash}>
                  Đóng
                </Button>
                <Button type="submit" disabled={trashPin.length !== 6 || trashReadMut.isPending}>
                  {trashReadMut.isPending ? "Đang xác minh..." : "Mở thùng rác"}
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground" aria-live="polite">
                  {trashRows.length} mục trong thùng rác
                </p>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void emptyTrash()}
                  disabled={trashRows.length === 0 || emptyingTrash || trashDeleteMut.isPending || trashRestoreMut.isPending}
                >
                  <Trash2 /> {emptyingTrash ? "Đang làm sạch..." : "Làm sạch thùng rác"}
                </Button>
              </div>

              <div className="max-h-[60dvh] overflow-auto rounded-md border border-border">
                <table className="w-full min-w-184 text-left text-sm">
                  <thead className="sticky top-0 bg-muted text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Loại</th>
                      <th className="px-3 py-2 font-medium">Nội dung</th>
                      <th className="px-3 py-2 font-medium">Ngày xóa</th>
                      <th className="px-3 py-2 text-right font-medium">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {trashRows.map((row) => (
                      <tr key={`${row.kind}:${row.id}`}>
                        <td className="whitespace-nowrap px-3 py-3">
                          <Badge tone={row.kind === "TRANSACTION" ? "navy" : row.kind === "CAPITAL" ? "warn" : "muted"}>
                            {row.type}
                          </Badge>
                        </td>
                        <td className="min-w-64 px-3 py-3">
                          <p className="font-medium">{row.title}</p>
                          <p className="mt-1 text-xs text-muted-foreground">{row.details}</p>
                        </td>
                        <td className="whitespace-nowrap px-3 py-3 text-muted-foreground">
                          {formatViDate(row.deletedAt.slice(0, 10))}
                        </td>
                        <td className="whitespace-nowrap px-3 py-3">
                          <div className="flex justify-end gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={emptyingTrash || trashRestoreMut.isPending || trashDeleteMut.isPending}
                              onClick={() => trashRestoreMut.mutate({ data: { id: row.id, kind: row.kind, pin: trashPin } })}
                            >
                              <RotateCcw /> Khôi phục
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              title="Xóa vĩnh viễn"
                              aria-label={`Xóa vĩnh viễn ${row.type}: ${row.title}`}
                              disabled={emptyingTrash || trashDeleteMut.isPending || trashRestoreMut.isPending}
                              onClick={() => {
                                if (!window.confirm(`Xóa vĩnh viễn “${row.title}”? Thao tác này không thể hoàn tác.`)) return;
                                trashDeleteMut.mutate({ data: { id: row.id, kind: row.kind, pin: trashPin } });
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {trashRows.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-3 py-12 text-center text-muted-foreground">
                          Thùng rác đang trống
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}