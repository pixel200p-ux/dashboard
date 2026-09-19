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

  const [isMobile, setIsMobile] = useState(() => typeof window !== "undefined" ? window.innerWidth < 640 : false);
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [kindFilter, setKindFilter] = useState("ALL");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(max-width: 640px)");
    const update = () => setIsMobile(mediaQuery.matches);

    update();
    mediaQuery.addEventListener("change", update);
    window.addEventListener("resize", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  const target = Math.max(0, Math.min(1, Number(decor) || 0));
  const pRef = useRef(0);

  // 1. ENGINE
  useEffect(() => {
    let raf = 0;
    const k = 0.22;

    function tick() {
      const cur = pRef.current;
      const diff = target - cur;

      if (Math.abs(diff) < 0.001) {
        pRef.current = target;
        containerRef.current?.style.setProperty("--p", target.toFixed(4));
        return;
      }

      const next = cur + diff * k;
      pRef.current = next;
      containerRef.current?.style.setProperty("--p", next.toFixed(4));
      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);

  // 2. GESTURE (FIXED FOR MOBILE UNTHROTTLE & SNAP)
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

    let wheelTimer: ReturnType<typeof setTimeout> | null = null;

    function onWheel(e: WheelEvent) {
      if (!isInsideHeroGesture(e.target) || isInsideCardScroll(e.target)) return;

      const cur = pRef.current;
      if (cur <= 0 && e.deltaY > 0) return;
      if (cur >= 1 && e.deltaY < 0) return;

      e.preventDefault();
      const step = -Math.sign(e.deltaY) * 0.28;
      const next = writeP(cur + step);

      if (wheelTimer) clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => setDecor(next), 80);
    }

    let startY = 0;
    let startP = 0;
    let activeGesture = false;

    function onTouchStart(e: TouchEvent) {
      if (isInsideCardScroll(e.target)) {
        activeGesture = false;
        return;
      }

      // Khi cover đang mở rộng (p > 0.1), cho phép vuốt ở bất kỳ đâu trên viewport ngoại trừ phần scroll card
      const cur = pRef.current;
      if (!isInsideHeroGesture(e.target) && cur < 0.1) {
        activeGesture = false;
        return;
      }

      activeGesture = true;
      startY = e.touches[0]?.clientY ?? 0;
      startP = cur;
    }

    function onTouchMove(e: TouchEvent) {
      if (!activeGesture || isInsideCardScroll(e.target)) return;

      const y = e.touches[0]?.clientY ?? 0;
      const deltaY = startY - y; // Vuốt lên => deltaY > 0, Vuốt xuống => deltaY < 0

      // Quy đổi khoảng cách vuốt (px) ra tỷ lệ --p
      // Vuốt xuống (deltaY < 0) làm tăng p (mở rộng Cover)
      // Vuốt lên (deltaY > 0) làm giảm p (thu gọn Cover)
      const sensitivity = 260; // Số px cần vuốt để đi hết từ 0 -> 1
      const nextP = startP - (deltaY / sensitivity);

      if (e.cancelable) e.preventDefault();
      writeP(nextP);
    }

    function onTouchEnd() {
      if (!activeGesture) return;
      activeGesture = false;

      // Snap thông minh: nếu p > 0.4 thì bung hết (1), ngược lại thu gọn về (0)
      const snapped = pRef.current >= 0.4 ? 1 : 0;
      writeP(snapped);
      setDecor(snapped);
    }

    const opts = { passive: false, capture: true } as const;
    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, opts);
    window.addEventListener("touchend", onTouchEnd, { passive: true, capture: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true, capture: true });
    return () => {
      if (wheelTimer) clearTimeout(wheelTimer);
      window.removeEventListener("wheel", onWheel, opts);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, opts);
      window.removeEventListener("touchend", onTouchEnd, true);
      window.removeEventListener("touchcancel", onTouchEnd, true);
    };
  }, [setDecor]);

  useEffect(() => {
    return () => setDecor(0);
  }, [setDecor]);

  type TxStat = {
    open: number;
    closed: number;
    buys: number;
    sells: number;
    bankOpen: number;
    bankClosed: number;
  };

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
      return {
        open,
        closed: Math.max(0, buys.length - open),
        buys: buys.length,
        sells: sells.length,
        bankOpen,
        bankClosed,
      };
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
      yearStats: [...years]
        .sort((a, b) => b.localeCompare(a))
        .map((year) => ({ year, stats: count(year) })),
    };
  }, [portfolio]);

  const timeline = useMemo(() => {
    const list = (marks ?? []).filter((m) => {
      if (kindFilter === "ALL") return true;
      if (kindFilter === "nav" || kindFilter === "orig" || kindFilter === "pnl" || kindFilter === "tplus") {
        return m.kind === kindFilter;
      }
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

  return (
    <div 
      ref={containerRef} 
      className="relative min-h-dvh w-full flex flex-col bg-background select-none overflow-x-hidden"
      style={{
        "--p": 0,
        "--cover-clip": "calc((1 - var(--p)) * 67vh)",
      } as React.CSSProperties}
    >
      {/* 1. COVER LAYER */}
      <div 
        data-profile-gesture
        className="fixed inset-0 w-full h-full bg-[#4a5d4e] [contain:strict] will-change-[clip-path] touch-none"
        style={{
          clipPath: "inset(0 0 var(--cover-clip) 0)",
          zIndex: 40,
        }}
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
          <div className="grid h-full place-items-center text-sm text-white/80">
            Nhấp đúp để chọn ảnh nền
          </div>
        )}
      </div>

      <div className="h-[33vh] w-full shrink-0 pointer-events-none" aria-hidden />

      {/* INPUTS */}
      <input
        ref={coverRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          const coverData = await readImage(f, 1920);
          save.mutate({ data: { coverData } });
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
          if (!f) return;
          const avatarData = await readImage(f, 512);
          save.mutate({ data: { avatarData } });
        }}
      />

      {/* BACKDROP ĐÁY */}
      <div
        className="fixed left-0 right-0 bottom-0 w-full h-[12.5vh] bg-background pointer-events-none z-[101]"
        style={{ opacity: "var(--p)" }}
      />

      {/* 2. PROFILE HERO INFO */}
      <div className="relative flex-1 flex flex-col px-4 md:px-8 pb-4 min-h-0">
        <div className={`w-full shrink-0 pointer-events-none ${isMobile ? "h-[8.5rem]" : "h-[5.5rem]"}`} aria-hidden />

        <div
          className="fixed z-[110] left-4 max-w-[calc(100vw-2rem)] flex flex-col items-start shrink-0 pointer-events-none md:left-[16.5rem] md:flex-row md:items-end md:gap-4"
          style={{
            top: isMobile ? "calc(26vh - 3.25rem)" : "calc(33vh - 4.5rem)",
            gap: isMobile ? "0.35rem" : undefined,
          }}
        >
          <div 
            data-profile-gesture
            className="flex max-w-full flex-col items-start pointer-events-auto will-change-transform md:flex-row md:items-end md:gap-4"
            style={{
              transform: isMobile
                ? "translate3d(calc(var(--p) * -0.75rem), calc(var(--p) * 50vh), 0) scale(calc(1 + var(--p) * 0.1))"
                : "translate3d(calc(var(--p) * -12.5rem), calc(var(--p) * (52vh - 6rem)), 0) scale(calc(1 + var(--p) * 1.2))",
              transformOrigin: "top left",
            }}
          >
            {/* Avatar */}
            <div
              className={isMobile ? "relative shrink-0 w-[76px] h-[76px]" : "relative shrink-0 w-28 h-28 sm:w-32 sm:h-32"}
              style={
                isMobile
                  ? {
                      transform: "scale(calc(1 - var(--p) * 0.15))",
                      transformOrigin: "left center"
                    }
                  : undefined
              }
            >
              <button
                type="button"
                onDoubleClick={() => avaRef.current?.click()}
                className={isMobile ? "h-full w-full overflow-hidden rounded-full border-2 border-background bg-muted shadow-lg active:scale-95 transition-transform" : "h-full w-full overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg active:scale-95 transition-transform"}
                title="Nhấp đúp để đổi avatar"
                style={isMobile ? { borderWidth: "2px" } : undefined}
              >
                {profile.avatarData ? (
                  <img src={profile.avatarData} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-muted-foreground">
                    <UserRound className={isMobile ? "h-8 w-8" : "h-12 w-12"} />
                  </span>
                )}
              </button>
            </div>

            {/* Display Name */}
            <div
              className={isMobile ? "min-w-0 max-w-[calc(100vw-7rem)]" : "min-w-0 flex-1 pb-1"}
              style={
                isMobile 
                  ? { 
                      marginTop: "-0.15rem", 
                      transform: "translate3d(0, calc(var(--p) * 0.35rem), 0)" 
                    } 
                  : undefined
              }
            >
              {editingName ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const next = name.trim() || "pixel200p";
                    save.mutate(
                      { data: { displayName: next } },
                      { onSuccess: () => { setNameDraft(null); setEditingName(false); } }
                    );
                  }}
                >
                  <Input
                    autoFocus
                    value={name}
                    onChange={(e) => setNameDraft(e.target.value)}
                    onBlur={() => {
                      const next = name.trim() || "pixel200p";
                      if (next !== profile.displayName) {
                        save.mutate(
                          { data: { displayName: next } },
                          { onSuccess: () => { setNameDraft(null); setEditingName(false); } }
                        );
                      } else {
                        setNameDraft(null);
                        setEditingName(false);
                      }
                    }}
                    className="max-w-sm text-2xl font-bold tracking-tight"
                  />
                </form>
              ) : (
                <h1
                  className={isMobile ? "cursor-text text-xl font-bold tracking-tight drop-shadow-md select-none text-foreground" : "cursor-text text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-md select-none text-foreground"}
                  title="Nhấp đúp để đổi tên"
                  onDoubleClick={() => setEditingName(true)}
                  style={isMobile ? { lineHeight: 1.1, maxWidth: "100%" } : undefined}
                >
                  {profile.displayName}
                </h1>
              )}
            </div>
          </div>
        </div>

        {/* 3. CARDS GRID */}
        <div 
          className="relative z-50 mt-4 flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-3 will-change-transform"
          style={{
            opacity: "calc(1 - var(--p) * 2.5)",
            transform: "translate3d(0, calc(var(--p) * 60px), 0)",
            pointerEvents: "auto",
          }}
        >
          {/* Card 1: Thống kê */}
          <Card className="flex flex-col h-full min-h-0 overflow-hidden p-5">
            <div className="shrink-0">
              <CardTitle>Thống kê lệnh</CardTitle>
              <CardDesc className="mb-3">Tổng · không tính lệnh đã xóa</CardDesc>
            </div>
            <div data-profile-scroll className="flex-1 overflow-y-auto pr-1 space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Đang mở</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums">{txStats.open}</p>
                </div>
                <div className="rounded-lg bg-background/70 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Đã chốt</p>
                  <p className="font-mono text-2xl font-semibold tabular-nums">{txStats.closed}</p>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Mua {txStats.buys} · Bán {txStats.sells}
              </p>
              <p className="text-xs text-muted-foreground">
                Sổ Bank: đang gửi {txStats.bankOpen} · tất toán {txStats.bankClosed}
              </p>

              {yearStats.map(({ year, stats }) => (
                <div key={year} className="space-y-2 pt-1">
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 text-left"
                    onClick={() => setOpenYear((cur) => (cur === year ? null : year))}
                  >
                    <span className="rounded-xl border border-border bg-background/80 px-3 py-1.5 text-sm font-semibold tabular-nums">
                      {year}
                    </span>
                    <span className="h-px min-w-0 flex-1 bg-border" />
                  </button>
                  {openYear === year && (
                    <div className="space-y-2 pl-1">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-background/70 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">Đang mở</p>
                          <p className="font-mono text-2xl font-semibold tabular-nums">{stats.open}</p>
                        </div>
                        <div className="rounded-lg bg-background/70 px-3 py-2">
                          <p className="text-[11px] text-muted-foreground">Đã chốt</p>
                          <p className="font-mono text-2xl font-semibold tabular-nums">{stats.closed}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Mua {stats.buys} · Bán {stats.sells}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Sổ Bank: đang gửi {stats.bankOpen} · tất toán {stats.bankClosed}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {/* Card 2: Trống */}
          <Card className="flex flex-col h-full min-h-0 overflow-hidden border-dashed p-5">
            <CardTitle className="text-muted-foreground shrink-0">Trống</CardTitle>
            <CardDesc>Sẽ bổ sung sau</CardDesc>
          </Card>

          {/* Card 3: Performance History */}
          <Card className="flex flex-col h-full min-h-0 overflow-hidden p-5">
            <div className="shrink-0 mb-2">
              <div className="flex items-center justify-between gap-2">
                <CardTitle>Performance history</CardTitle>
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
              <CardDesc className="mt-1">Ngày đầu tiên cán mốc · mới nhất trên cùng</CardDesc>
            </div>

            <div data-profile-scroll className="flex-1 min-h-0 overflow-y-auto pr-1 mt-2">
              {marksPending && <p className="text-sm text-muted-foreground">Đang tính mốc…</p>}
              {!marksPending && timeline.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Chưa có snapshot giá. Mở Dashboard hoặc bấm Cập nhật giá lần đầu trong ngày.
                </p>
              )}
              <ol className="relative ml-2 border-l-2 border-border">
                {timeline.map((g) => (
                  <li key={g.date} className="relative pb-5 pl-5 last:pb-1">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary ring-4 ring-card" />
                    <p className="text-xs font-semibold tracking-wide text-muted-foreground">{formatViDate(g.date)}</p>
                    <ul className="mt-2 space-y-1.5">
                      {g.items.map((m) => (
                        <li key={m.id} className="rounded-md bg-background/70 px-2.5 py-1.5">
                          <p className="text-sm font-medium leading-snug">{m.label}</p>
                          <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
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
        </div>
      </div>
    </div>
  );
}