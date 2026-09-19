import { Card, CardDesc, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatViDate } from "@/engine/dates";
import { displayMoney } from "@/lib/display";
import { useMilestones, useProfile, useSaveProfile } from "@/lib/use-profile";
import { usePortfolio } from "@/lib/use-portfolio";
import { UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FilterMenu } from "@/components/FilterMenu";
import { useUiStore } from "@/lib/ui-store";

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

export function ProfilePage() {
  const { data: profile, isPending } = useProfile();
  const { data: marks, isPending: marksPending } = useMilestones();
  const { data: portfolio } = usePortfolio();
  const save = useSaveProfile();
  const usd = portfolio?.state.usdVnd ?? 25000;

  const containerRef = useRef<HTMLDivElement>(null);
  const coverRef = useRef<HTMLInputElement>(null);
  const avaRef = useRef<HTMLInputElement>(null);

  const decor = useUiStore((s) => s.profileDecor);
  const setDecor = useUiStore((s) => s.setProfileDecor);

  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [kindFilter, setKindFilter] = useState("ALL");

  const target = Math.max(0, Math.min(1, Number(decor) || 0));
  const pRef = useRef(0);
  const targetRef = useRef(target);
  const gestureRef = useRef(false);

  useEffect(() => {
    targetRef.current = target;
  }, [target]);

  // Loop mượt với hệ thống lò xo Damped Spring
  useEffect(() => {
    let raf = 0;
    const k = 0.28;

    function tick() {
      if (!gestureRef.current) {
        const tgt = targetRef.current;
        const cur = pRef.current;
        const diff = tgt - cur;

        if (Math.abs(diff) >= 0.0002) {
          const next = cur + diff * k;
          pRef.current = next;
          containerRef.current?.style.setProperty("--p", next.toFixed(4));
        } else if (cur !== tgt) {
          pRef.current = tgt;
          containerRef.current?.style.setProperty("--p", tgt.toString());
        }
      }
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    function isInsideCardScroll(el: EventTarget | null): boolean {
      if (!(el instanceof Element)) return false;
      return Boolean(el.closest("[data-profile-scroll]"));
    }

    function isInsideHeroGesture(el: EventTarget | null): boolean {
      if (!(el instanceof Element)) return false;
      return Boolean(el.closest("[data-profile-gesture]"));
    }

    function writeP(next: number) {
      const v = Math.max(0, Math.min(1, next));
      pRef.current = v;
      containerRef.current?.style.setProperty("--p", v.toFixed(4));
      return v;
    }

    function snapFrom(origin: number, cur: number) {
      if (origin < 0.5) return cur - origin >= 0.15 ? 1 : 0;
      return origin - cur >= 0.15 ? 0 : 1;
    }

    function finish(origin: number) {
      const next = snapFrom(origin, pRef.current);
      targetRef.current = next;
      gestureRef.current = false;
      setDecor(next);
    }

    function canStart(el: EventTarget | null, clientY: number) {
      if (isInsideCardScroll(el)) return false;
      if ((el as HTMLElement | null)?.closest?.("input, textarea, select, button")) return false;
      if (isInsideHeroGesture(el)) return true;
      if (pRef.current > 0.08) return true;
      const coverH = window.innerHeight * (0.33 + pRef.current * 0.67);
      return clientY <= coverH;
    }

    let wheelTimer: ReturnType<typeof setTimeout> | null = null;
    let wheelOrigin: number | null = null;
    let wheelRaf = 0;
    let wheelDelta = 0;

    function onWheel(e: WheelEvent) {
      if (!canStart(e.target, e.clientY)) return;
      const cur = pRef.current;
      if (cur <= 0 && e.deltaY > 0) return;
      if (cur >= 1 && e.deltaY < 0) return;

      e.preventDefault();
      gestureRef.current = true;
      if (wheelOrigin == null) wheelOrigin = cur;
      wheelDelta += -e.deltaY;

      if (!wheelRaf) {
        wheelRaf = requestAnimationFrame(() => {
          wheelRaf = 0;
          writeP(pRef.current + wheelDelta * 0.0011);
          wheelDelta = 0;
        });
      }

      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => {
        const origin = wheelOrigin ?? 0;
        wheelOrigin = null;
        finish(origin);
      }, 120);
    }

    let startY = 0;
    let startP = 0;
    let active = false;
    let pointerId = -1;
    let moveY = 0;
    let moveRaf = 0;

    function onPointerDown(e: PointerEvent) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      if (!canStart(e.target, e.clientY)) return;
      active = true;
      pointerId = e.pointerId;
      startY = e.clientY;
      startP = pRef.current;
      moveY = e.clientY;
      gestureRef.current = true;
    }

    function onPointerMove(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return;
      moveY = e.clientY;
      if (e.cancelable) e.preventDefault();
      if (!moveRaf) {
        moveRaf = requestAnimationFrame(() => {
          moveRaf = 0;
          if (!active) return;
          writeP(startP + (moveY - startY) / 300);
        });
      }
    }

    function onPointerUp(e: PointerEvent) {
      if (!active || e.pointerId !== pointerId) return;
      active = false;
      pointerId = -1;
      if (moveRaf) {
        cancelAnimationFrame(moveRaf);
        moveRaf = 0;
      }
      writeP(startP + (e.clientY - startY) / 300);
      finish(startP);
    }

    const opts = { passive: false, capture: true } as const;
    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("pointerdown", onPointerDown, opts);
    window.addEventListener("pointermove", onPointerMove, opts);
    window.addEventListener("pointerup", onPointerUp, opts);
    window.addEventListener("pointercancel", onPointerUp, opts);
    return () => {
      if (wheelTimer) clearTimeout(wheelTimer);
      if (wheelRaf) cancelAnimationFrame(wheelRaf);
      if (moveRaf) cancelAnimationFrame(moveRaf);
      window.removeEventListener("wheel", onWheel, opts);
      window.removeEventListener("pointerdown", onPointerDown, opts);
      window.removeEventListener("pointermove", onPointerMove, opts);
      window.removeEventListener("pointerup", onPointerUp, opts);
      window.removeEventListener("pointercancel", onPointerUp, opts);
    };
  }, [setDecor]);

  type TxStat = { open: number; closed: number; buys: number; sells: number; bankOpen: number; bankClosed: number };
  const emptyStat: TxStat = { open: 0, closed: 0, buys: 0, sells: 0, bankOpen: 0, bankClosed: 0 };
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
      setNameDraft(null);
      setEditingName(false);
    }
  };

  return (
    <div
      ref={containerRef}
            className="relative h-dvh max-h-dvh w-full flex flex-col bg-background text-foreground select-none overflow-hidden touch-pan-x"
      style={{
        "--p": 0,
        "--cover-clip": "calc(67vh - var(--p) * 52vh)",
      } as React.CSSProperties}
    >
      {/* 1. LAYER COVER CỐ ĐỊNH Ở DƯỚI CÙNG */}
      <div
        data-profile-gesture
        className="fixed inset-0 w-full h-full bg-[#4a5d4e] z-10 touch-none will-change-[clip-path]"
        style={{ clipPath: "inset(0 0 var(--cover-clip) 0)" }}
        onDoubleClick={() => coverRef.current?.click()}
      >
        {profile.coverData ? (
          <img
            src={profile.coverData}
            alt="Cover"
            decoding="async"
            fetchPriority="low"
            draggable={false}
            className="h-full w-full object-cover object-center pointer-events-none select-none [transform:translateZ(0)]"
          />
        ) : (
          <div className="grid h-full place-items-center text-sm text-white/80">Nhấp đúp chọn ảnh</div>
        )}
      </div>

      {/* PC: Nền trắng phủ cột sidebar khi Cover bung full */}
      <div
        aria-hidden
        className="pointer-events-none fixed bottom-0 left-0 z-[25] hidden w-60 bg-background md:block will-change-transform"
        style={{
          transform: "translate3d(0, calc(var(--p) * 50vh), 0)",
          top: "33vh",
        }}
      />

      <input ref={coverRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const coverData = await readImage(f, 1920); save.mutate({ data: { coverData } }); }} />
      <input ref={avaRef} type="file" accept="image/*" className="hidden" onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ""; if (!f) return; const avatarData = await readImage(f, 512); save.mutate({ data: { avatarData } }); }} />

      {/* 2. KHU VỰC CHỨA CÁC CARD VÀ NỀN TRẮNG CHUYỂN ĐỘNG */}
      <div className="relative z-20 w-full flex-1 flex flex-col pointer-events-none">
        
        {/* Khoảng trống ban đầu hiển thị Cover (33vh) */}
        <div className="h-[33vh] w-full shrink-0" />

        {/* --- KHỐI NỀN TRẮNG ĐỒNG BỘ CHUYỂN ĐỘNG --- */}
                <div
          data-profile-gesture
          className="relative flex-1 w-full bg-background border-t border-border/40 pointer-events-auto will-change-transform flex flex-col"
          style={{
            transform: "translate3d(0, calc(var(--p) * 52vh), 0)",
          }}
        >

          {/* NHÓM AVATAR VÀ TÊN */}
          <div className="relative z-10 px-4 md:px-8 flex items-end gap-4 -mt-8 md:-mt-10 pointer-events-none">
            <button
              type="button"
              className="pointer-events-auto relative h-16 w-16 md:h-20 md:w-20 rounded-full border-2 border-background bg-muted overflow-hidden shrink-0 shadow-md transition-transform active:scale-95"
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

            <div className="pointer-events-auto min-w-0 flex-1 mb-1">
              {editingName ? (
                <form onSubmit={(e) => { e.preventDefault(); handleSaveName(); }}>
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={handleSaveName}
                    className="max-w-sm text-lg md:text-xl font-bold tracking-tight bg-background h-8 md:h-10"
                  />
                </form>
              ) : (
                <h1
                  className="cursor-text text-xl md:text-2xl font-bold tracking-tight select-none text-foreground truncate drop-shadow-sm"
                  onDoubleClick={() => setEditingName(true)}
                >
                  {profile.displayName}
                </h1>
              )}
            </div>
          </div>

          {/* CÁC CARD NỘI DUNG */}
          <div
            className="relative z-10 flex-1 px-4 md:px-8 mt-6 pb-6 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-3 will-change-opacity"
            style={{
              opacity: "calc(1 - var(--p) * 2.5)",
            }}
          >
            {/* Card 1: Thống kê */}
            <Card className="flex flex-col h-full min-h-0 overflow-hidden p-5 shadow-sm bg-background border border-border">
              <div className="shrink-0">
                <CardTitle>Thống kê lệnh</CardTitle>
                <CardDesc className="mb-3">Tổng · không tính lệnh đã xóa</CardDesc>
              </div>
              <div data-profile-scroll className="flex-1 overflow-y-auto pr-1 space-y-3 overscroll-contain">
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Đang mở</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">{txStats.open}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-[11px] text-muted-foreground">Đã chốt</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">{txStats.closed}</p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">Mua {txStats.buys} · Bán {txStats.sells}</p>
                <p className="text-xs text-muted-foreground">Sổ Bank: đang gửi {txStats.bankOpen} · tất toán {txStats.bankClosed}</p>

                {yearStats.map(({ year, stats }) => (
                  <div key={year} className="space-y-2 pt-1">
                    <button type="button" className="flex w-full items-center gap-3 text-left hover:opacity-80 transition-opacity" onClick={() => setOpenYear((cur) => (cur === year ? null : year))}>
                      <span className="rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-sm font-semibold tabular-nums">{year}</span>
                      <span className="h-px min-w-0 flex-1 bg-border" />
                    </button>
                    {openYear === year && (
                      <div className="space-y-2 pl-1 animate-in fade-in-50 duration-200">
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Đang mở</p>
                            <p className="font-mono text-2xl font-semibold tabular-nums">{stats.open}</p>
                          </div>
                          <div className="rounded-lg bg-muted/50 px-3 py-2">
                            <p className="text-[11px] text-muted-foreground">Đã chốt</p>
                            <p className="font-mono text-2xl font-semibold tabular-nums">{stats.closed}</p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">Mua {stats.buys} · Bán {stats.sells}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            {/* Card 2: Trống */}
            <Card className="flex flex-col h-full min-h-0 overflow-hidden border-dashed p-5 shadow-sm bg-background">
              <CardTitle className="text-muted-foreground shrink-0">Trống</CardTitle>
              <CardDesc>Sẽ bổ sung sau</CardDesc>
            </Card>

            {/* Card 3: Performance History */}
            <Card className="flex flex-col h-full min-h-0 overflow-hidden p-5 shadow-sm bg-background border border-border">
              <div className="shrink-0 mb-2">
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Performance history</CardTitle>
                  <FilterMenu
                    value={kindFilter}
                    onChange={setKindFilter}
                    options={[
                      { id: "ALL", label: "All" }, { id: "nav", label: "NAV" }, { id: "orig", label: "Original" },
                      { id: "pnl", label: "Lãi/lỗ" }, { id: "tplus", label: "T+" }, { id: "DCDS", label: "DCDS" },
                      { id: "ETF", label: "ETF" }, { id: "VPS", label: "VPS" }, { id: "SSI", label: "SSI" },
                      { id: "CRYPTO", label: "Crypto" }, { id: "BANK", label: "Bank" },
                    ]}
                  />
                </div>
                <CardDesc className="mt-1">Ngày đầu tiên cán mốc · mới nhất trên cùng</CardDesc>
              </div>
              <div data-profile-scroll className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2 overscroll-contain">
                {marksPending && <p className="text-sm text-muted-foreground">Đang tính mốc…</p>}
                {!marksPending && timeline.length === 0 && <p className="text-sm text-muted-foreground">Chưa có snapshot giá.</p>}
                <ol className="relative ml-2 border-l-2 border-border">
                  {timeline.map((g) => (
                    <li key={g.date} className="relative pb-5 pl-5 last:pb-1">
                      <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground">{formatViDate(g.date)}</p>
                      <ul className="mt-2 space-y-1.5">
                        {g.items.map((m) => (
                          <li key={m.id} className="rounded-md bg-muted/30 px-2.5 py-1.5 border border-border/50">
                            <p className="text-sm font-medium leading-snug">{m.label}</p>
                            <p className="font-mono text-[11px] tabular-nums text-muted-foreground">{displayMoney(m.value, "VND", usd)}</p>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ol>
              </div>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}