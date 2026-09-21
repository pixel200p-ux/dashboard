import { Card, CardDesc, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatViDate } from "@/engine/dates";
import { displayMoney } from "@/lib/display";
import { useMilestones, useProfile, useSaveProfile } from "@/lib/use-profile";
import { usePortfolio } from "@/lib/use-portfolio";
import { UserRound, Activity, BarChart3, PlusCircle } from "lucide-react";
import React, { useMemo, useRef, useState } from "react";
import { FilterMenu } from "@/components/FilterMenu";

function readImage(file: File, maxEdge: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("canvas"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.92));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không đọc được ảnh"));
    };
    img.src = url;
  });
}

type TxStat = {
  open: number;
  closed: number;
  buys: number;
  sells: number;
  bankOpen: number;
  bankClosed: number;
};

const emptyStat: TxStat = {
  open: 0,
  closed: 0,
  buys: 0,
  sells: 0,
  bankOpen: 0,
  bankClosed: 0,
};

export function ProfilePage() {
  const { data: profile, isPending } = useProfile();
  const { data: marks, isPending: marksPending } = useMilestones();
  const { data: portfolio } = usePortfolio();
  const save = useSaveProfile();
  const usd = portfolio?.state.usdVnd ?? 25000;

  const coverRef = useRef<HTMLInputElement>(null);
  const avaRef = useRef<HTMLInputElement>(null);

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [kindFilter, setKindFilter] = useState("ALL");
  const [openYear, setOpenYear] = useState<string | null>(null);
  const { txStats, yearStats } = useMemo(() => {
    const empty = { txStats: emptyStat, yearStats: [] as { year: string; stats: TxStat }[] };
    if (!portfolio) return empty;

    const txs = portfolio.ledger.transactions.filter((t) => !t.deletedAt);
    const tplusLeft = new Map<string, number>();
    for (const h of portfolio.state.holdings) {
      for (const lot of h.openLots) {
        tplusLeft.set(lot.buyTxId, (tplusLeft.get(lot.buyTxId) ?? 0) + lot.qtyRemaining);
      }
    }
    const coreOpen = new Set(portfolio.state.holdings.filter((h) => h.coreQty > 0).map((h) => h.assetId));
    const banks = portfolio.ledger.banks.filter((b) => !b.deletedAt);
    const activeIds = new Set(portfolio.state.banks.filter((b) => b.status === "ACTIVE").map((b) => b.id));

    function yearOf(iso?: string | null) {
      return iso && iso.length >= 4 ? iso.slice(0, 4) : null;
    }

    function isBuyOpen(b: (typeof txs)[number]) {
      if (b.tradeTplus) return (tplusLeft.get(b.id) ?? 0) > 0;
      return Boolean(b.assetId && coreOpen.has(b.assetId));
    }

    function count(year?: string): TxStat {
      const buys = txs.filter((t) => t.txType === "BUY" && (!year || yearOf(t.txDate) === year));
      const sells = txs.filter((t) => t.txType === "SELL" && (!year || yearOf(t.txDate) === year));
      let open = 0;
      for (const b of buys) if (isBuyOpen(b)) open += 1;
      const bankOpen = banks.filter((b) => activeIds.has(b.id) && (!year || yearOf(b.startDate) === year)).length;
      const bankClosed = banks.filter((b) => !activeIds.has(b.id) && (!year || yearOf(b.startDate) === year)).length;
      return { open, closed: Math.max(0, buys.length - open), buys: buys.length, sells: sells.length, bankOpen, bankClosed };
    }

    const years = new Set<string>();
    for (const t of txs) {
      const y = yearOf(t.txDate);
      if (y) years.add(y);
    }
    for (const b of banks) {
      const y = yearOf(b.startDate);
      if (y) years.add(y);
    }

    return {
      txStats: count(),
      yearStats: [...years].sort((a, b) => b.localeCompare(a)).map((year) => ({ year, stats: count(year) })),
    };
  }, [portfolio]);

  const timeline = useMemo(() => {
    const list = (marks ?? []).filter((m) => {
      if (kindFilter === "ALL") return true;
      if (kindFilter === "nav" || kindFilter === "orig" || kindFilter === "pnl" || kindFilter === "tplus") return m.kind === kindFilter;
      return m.bucket === kindFilter;
    });
    const order: string[] = [];
    const map = new Map<string, typeof list>();
    for (const m of list) {
      if (!map.has(m.date)) {
        map.set(m.date, []);
        order.push(m.date);
      }
      map.get(m.date)!.push(m);
    }
    return order.map((date) => ({ date, items: map.get(date)! }));
  }, [marks, kindFilter]);

  if (isPending || !profile) return <Skeleton className="h-96" />;

  const name = nameDraft ?? profile.displayName;
  const handleSaveName = () => {
    const next = name.trim() || "pixel200p";
    if (next !== profile.displayName) {
      save.mutate({ data: { displayName: next } }, { onSuccess: () => { setNameDraft(null); setEditingName(false); } });
    } else {
      setNameDraft(null); setEditingName(false);
    }
  };

  return (
    <div className="relative min-h-dvh w-full bg-background text-foreground">
      <div className="mx-auto w-full px-3 pb-6 pt-4 md:px-6 md:pt-6 xl:px-8">
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-[#3d4d41] shadow-sm">
          <div
            className="relative min-h-[180px] md:min-h-[220px]"
            onDoubleClick={() => coverRef.current?.click()}
          >
            {profile.coverData ? (
              <img
                src={profile.coverData}
                alt="Cover"
                decoding="async"
                fetchPriority="low"
                draggable={false}
                className="h-full w-full object-cover object-center"
              />
            ) : (
              <div className="grid min-h-[180px] h-full place-items-center text-sm text-white/80 md:min-h-[220px]">
                Nhấp đúp để chọn ảnh bìa
              </div>
            )}
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/30 via-background/0 to-black/10" />

            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 px-4 pb-4 md:gap-4 md:px-6 md:pb-5">
              <button
                type="button"
                className="profile-hero-avt pointer-events-auto relative h-16 w-16 overflow-hidden rounded-full border-2 border-background/80 bg-card/80 shadow-md backdrop-blur-sm md:h-20 md:w-20"
                onClick={() => avaRef.current?.click()}
              >
                {profile.avatarData ? (
                  <img src={profile.avatarData} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center">
                    <UserRound className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
              </button>

              <div className="profile-hero-name pointer-events-auto min-w-0 max-w-[min(18rem,52vw)] pb-2 md:pb-2.5">
                <div className="inline-flex max-w-full items-center rounded-full border border-white/10 bg-background/55 px-2.5 py-1 shadow-sm backdrop-blur-sm ring-1 ring-border/30 dark:bg-background/30 dark:border-white/10">
                  {editingName ? (
                    <form onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}>
                      <Input
                        autoFocus
                        value={name}
                        onChange={(e) => setNameDraft(e.target.value)}
                        onBlur={handleSaveName}
                        className="h-8 max-w-sm rounded-full border-0 bg-transparent px-1 text-lg font-bold tracking-tight shadow-none md:text-xl"
                      />
                    </form>
                  ) : (
                    <h1
                      className="cursor-text truncate text-xl font-bold tracking-tight text-foreground drop-shadow-sm md:text-2xl"
                      onDoubleClick={() => setEditingName(true)}
                    >
                      {profile.displayName}
                    </h1>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <input
          ref={coverRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) save.mutate({ data: { coverData: await readImage(f, 1920) } });
          }}
        />
        <input
          ref={avaRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) save.mutate({ data: { avatarData: await readImage(f, 512) } });
          }}
        />

        <div className="mt-4 grid gap-3 lg:grid-cols-12 lg:gap-3">
          <Card className="lg:col-span-5 flex h-auto min-h-0 flex-col overflow-hidden border-border bg-card shadow-(--shadow-card)">
            <div className="mb-3 flex items-center justify-between border-b border-border/70 pb-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  Thống kê lệnh
                </CardTitle>
                <CardDesc className="mt-0.5">Tổng quan không tính lệnh đã xóa</CardDesc>
              </div>
            </div>

            <div data-profile-scroll className="space-y-3 pr-1 overscroll-contain">
              <div className="grid grid-cols-2 gap-2.5">
                <div className="rounded-xl border border-border bg-muted/50 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Đang mở</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{txStats.open}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/40 px-3.5 py-2.5">
                  <p className="text-[11px] font-medium text-muted-foreground">Đã chốt</p>
                  <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{txStats.closed}</p>
                </div>
              </div>

              {/* ===== BẮT ĐẦU PHẦN DESIGN LẠI: Giao dịch khớp & Sổ Ngân hàng ===== */}
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-muted/20">
                {/* Giao dịch khớp */}
                <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-background text-[10px] font-bold text-muted-foreground ring-1 ring-border/70">
                      GD
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Giao dịch khớp</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        {txStats.buys}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">Mua</span>
                    </div>
                    <div className="h-3.5 w-px bg-border" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base font-semibold tabular-nums text-rose-600 dark:text-rose-400">
                        {txStats.sells}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">Bán</span>
                    </div>
                  </div>
                </div>

                {/* Sổ Ngân hàng */}
                <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                  <div className="flex items-center gap-2.5">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-background text-[10px] font-bold text-muted-foreground ring-1 ring-border/70">
                      NH
                    </span>
                    <span className="text-xs font-medium text-muted-foreground">Sổ Ngân hàng</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                        {txStats.bankOpen}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">Đang gửi</span>
                    </div>
                    <div className="h-3.5 w-px bg-border" />
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-mono text-base font-semibold tabular-nums text-foreground">
                        {txStats.bankClosed}
                      </span>
                      <span className="text-[10px] font-medium text-muted-foreground">Tất toán</span>
                    </div>
                  </div>
                </div>
              </div>
              {/* ===== KẾT THÚC PHẦN DESIGN LẠI ===== */}

              <div className="pt-2">
                <p className="mb-2 text-xs font-semibold text-muted-foreground">Chi tiết theo năm</p>
                {yearStats.map(({ year, stats }) => (
                  <div key={year} className="mb-2 space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 text-left transition-opacity hover:opacity-80"
                      onClick={() => setOpenYear((cur) => (cur === year ? null : year))}
                    >
                      <span className="rounded-lg border border-indigo-200/60 bg-indigo-50/50 px-2.5 py-1 text-xs font-bold tabular-nums text-indigo-700 dark:border-indigo-800/50 dark:bg-indigo-950/30 dark:text-indigo-300">
                        {year}
                      </span>
                      <span className="h-px min-w-0 flex-1 bg-indigo-100 dark:bg-indigo-900/40" />
                    </button>
                    {openYear === year && (
                      <div className="space-y-2 pl-1">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg border border-indigo-100/40 bg-indigo-50/40 px-3 py-1.5 dark:border-indigo-900/20 dark:bg-indigo-950/20">
                            <p className="text-[10px] text-muted-foreground">Đang mở</p>
                            <p className="font-mono text-lg font-bold tabular-nums">{stats.open}</p>
                          </div>
                          <div className="rounded-lg border border-border/40 bg-muted/40 px-3 py-1.5">
                            <p className="text-[10px] text-muted-foreground">Đã chốt</p>
                            <p className="font-mono text-lg font-bold tabular-nums">{stats.closed}</p>
                          </div>
                        </div>
                        <p className="text-[11px] text-muted-foreground">Mua {stats.buys} · Bán {stats.sells}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </Card>

          <Card className="lg:col-span-7 flex h-auto min-h-0 flex-col overflow-hidden border-border bg-card shadow-(--shadow-card)">
            <div className="mb-3 shrink-0 border-b border-border/70 pb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-foreground">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  Performance history
                </CardTitle>
                <FilterMenu
                  value={kindFilter}
                  onChange={setKindFilter}
                  options={[
                    { id: "ALL", label: "All" },
                    { id: "nav", label: "NAV" },
                    { id: "orig", label: "Original" },
                    { id: "pnl", label: "Lãi/lỗ" },
                    { id: "tplus", label: "T+" },
                    { id: "DCDS", label: "DCDS" },
                    { id: "ETF", label: "ETF" },
                    { id: "VPS", label: "VPS" },
                    { id: "SSI", label: "SSI" },
                    { id: "CRYPTO", label: "Crypto" },
                    { id: "BANK", label: "Bank" },
                  ]}
                />
              </div>
              <CardDesc className="mt-0.5">Mốc lịch sử đạt được · xếp mới nhất trên cùng</CardDesc>
            </div>

            <div data-profile-scroll className="pr-1 overscroll-contain">
              {marksPending && <p className="text-sm text-muted-foreground">Đang tính mốc…</p>}
              {!marksPending && timeline.length === 0 && (
                <p className="text-sm text-muted-foreground">Chưa có snapshot giá.</p>
              )}
              <ol className="relative ml-2.5 border-l-2 border-border/80">
                {timeline.map((g) => (
                  <li key={g.date} className="relative pb-4 pl-5 last:pb-1">
                    <span className="absolute -left-[6px] top-1.5 h-3 w-3 rounded-full bg-primary/80 ring-4 ring-background" />
                    <p className="text-xs font-bold tracking-wide text-foreground/80">
                      {formatViDate(g.date)}
                    </p>
                    <ul className="mt-1.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {g.items.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-lg border border-border bg-muted/35 p-2.5 shadow-2xs"
                        >
                          <p className="text-xs font-medium leading-snug text-foreground">{m.label}</p>
                          <p className="mt-0.5 font-mono text-xs font-semibold tabular-nums text-foreground/90">
                            {displayMoney(m.value, "VND", usd)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            </div>
          </Card>

          <Card className="lg:col-span-12 flex h-auto min-h-0 flex-col overflow-hidden border-border bg-card p-4 shadow-(--shadow-card)">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <PlusCircle className="h-4 w-4 text-muted-foreground" />
                <div>
                  <CardTitle className="text-sm font-semibold text-foreground">
                    Ghi chú bổ sung
                  </CardTitle>
                  <CardDesc className="text-xs">Khu vực mở rộng tính năng trong tương lai</CardDesc>
                </div>
              </div>
              <span className="text-xs font-medium text-muted-foreground">Sẵn sàng</span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}