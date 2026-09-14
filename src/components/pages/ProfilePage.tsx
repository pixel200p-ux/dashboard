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

  // 1. ENGINE ANIMATION DIRECT DOM (Chỉ ghi đè CSS Variable qua direct ref)
  useEffect(() => {
    let raf = 0;
    const k = 0.16;

    function tick() {
      const cur = pRef.current;
      const diff = target - cur;

      if (Math.abs(diff) < 0.0005) {
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

  // 2. XỬ LÝ GESTURE MƯỢT CHO CẢ TRACKPAD VÀ CHUỘT
  useEffect(() => {
    function isInsideCardScroll(el: EventTarget | null): boolean {
      if (!(el instanceof Element)) return false;
      return Boolean(el.closest("[data-profile-scroll]"));
    }

        function onWheel(e: WheelEvent) {
      if (isInsideCardScroll(e.target)) return;

      const cur = Math.max(0, Math.min(1, Number(useUiStore.getState().profileDecor) || 0));
      // Ở 0 chỉ cho cuộn xuống (tăng p), ở 1 chỉ cho cuộn lên (giảm p)
      if (cur <= 0 && e.deltaY < 0) return;
      if (cur >= 1 && e.deltaY > 0) return;

      e.preventDefault();
      // Tăng hệ số 0.0025 → 0.005 = lăn ít hơn đã full màn
      // Muốn nhạy hơn nữa: 0.006 hoặc 0.007
      // Muốn chậm hơn: 0.003
      const step = Math.sign(e.deltaY) * Math.min(Math.abs(e.deltaY) * 10, 0.6);
      const next = Math.max(0, Math.min(1, cur + step));
      setDecor(next);
    }

    let startY = 0;
    function onTouchStart(e: TouchEvent) {
      startY = e.touches[0]?.clientY ?? 0;
    }
    function onTouchMove(e: TouchEvent) {
      if (isInsideCardScroll(e.target)) return;

      const y = e.touches[0]?.clientY ?? 0;
      const dy = startY - y;
      startY = y;
      const cur = Math.max(0, Math.min(1, Number(useUiStore.getState().profileDecor) || 0));
      if (cur <= 0 && dy <= 0) return;

      e.preventDefault();
      const next = Math.max(0, Math.min(1, cur + dy / 100));
      setDecor(next);
    }

    const opts = { passive: false, capture: true } as const;
    window.addEventListener("wheel", onWheel, opts);
    window.addEventListener("touchstart", onTouchStart, { passive: true, capture: true });
    window.addEventListener("touchmove", onTouchMove, opts);
    return () => {
      window.removeEventListener("wheel", onWheel, opts);
      window.removeEventListener("touchstart", onTouchStart, true);
      window.removeEventListener("touchmove", onTouchMove, opts);
    };
  }, [setDecor]);

  useEffect(() => {
    return () => setDecor(0);
  }, [setDecor]);

  const txStats = useMemo(() => {
    const empty = { open: 0, closed: 0, buys: 0, sells: 0, bankOpen: 0, bankClosed: 0 };
    if (!portfolio) return empty;
    const txs = portfolio.ledger.transactions.filter((t) => !t.deletedAt);
    const buys = txs.filter((t) => t.txType === "BUY");
    const sells = txs.filter((t) => t.txType === "SELL");
    const tplusLeft = new Map<string, number>();
    for (const h of portfolio.state.holdings) {
      for (const lot of h.openLots) {
        tplusLeft.set(lot.buyTxId, (tplusLeft.get(lot.buyTxId) ?? 0) + lot.qtyRemaining);
      }
    }
    const coreOpen = new Set(portfolio.state.holdings.filter((h) => h.coreQty > 0).map((h) => h.assetId));
    let open = 0;
    for (const b of buys) {
      if (b.tradeTplus) {
        if ((tplusLeft.get(b.id) ?? 0) > 0) open += 1;
      } else if (b.assetId && coreOpen.has(b.assetId)) {
        open += 1;
      }
    }
    const banks = portfolio.ledger.banks.filter((b) => !b.deletedAt);
    const bankOpen = portfolio.state.banks.filter((b) => b.status === "ACTIVE").length;
    return {
      open,
      closed: buys.length - open,
      buys: buys.length,
      sells: sells.length,
      bankOpen,
      bankClosed: Math.max(0, banks.length - bankOpen),
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
      className="relative h-dvh max-h-dvh w-full flex flex-col bg-background select-none overflow-hidden"
      style={{
        "--p": 0,
        // Dùng clip-path inset để mở rộng/thu hẹp Cover mà KHÔNG gây Reflow
        "--cover-clip": "calc((1 - var(--p)) * 67vh)",
      } as React.CSSProperties}
    >
      {/* 1. COVER LAYER: Cố định 100vh, cắt chiều cao bằng clip-path (GPU-accelerated) */}
      <div 
        className="fixed inset-0 w-full h-full bg-[#4a5d4e] will-change-transform"
        style={{
          clipPath: "inset(0 0 var(--cover-clip) 0)",
          // Thu nhỏ (p thấp) → z thấp hơn sidebar → sidebar không bị đè
          // Phóng to (p cao) → z cao hơn sidebar → ảnh nền phủ lên sidebar
          zIndex: target > 0.08 ? 45 : 30,
        }}
        onDoubleClick={() => coverRef.current?.click()}
      >
        {profile.coverData ? (
          <img 
            src={profile.coverData} 
            alt="Cover" 
            className="h-full w-full object-cover object-center" 
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
        <div className="h-[5.5rem] w-full shrink-0 pointer-events-none" aria-hidden />

        <div className="fixed z-[110] top-[calc(33vh-4.5rem)] left-4 md:left-[16.5rem] flex flex-col sm:flex-row items-start sm:items-end gap-4 shrink-0 pointer-events-none">
          <div 
            className="flex flex-col sm:flex-row items-start sm:items-end gap-4 pointer-events-auto will-change-transform"
            style={{
              transform: `translate3d(calc(var(--p) * -12.5rem), calc(var(--p) * (52vh - 6rem)), 0) scale(calc(1 + var(--p) * 1.2))`,
              transformOrigin: "top left",
            }}
          >
            {/* Avatar */}
            <div className="relative shrink-0 w-28 h-28 sm:w-32 sm:h-32">
              <button
                type="button"
                onDoubleClick={() => avaRef.current?.click()}
                className="h-full w-full overflow-hidden rounded-full border-4 border-background bg-muted shadow-lg active:scale-95 transition-transform"
                title="Nhấp đúp để đổi avatar"
              >
                {profile.avatarData ? (
                  <img src={profile.avatarData} alt="Avatar" className="h-full w-full object-cover" />
                ) : (
                  <span className="grid h-full place-items-center text-muted-foreground">
                    <UserRound className="h-12 w-12" />
                  </span>
                )}
              </button>
            </div>

            {/* Display Name */}
            <div className="min-w-0 flex-1 pb-1">
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
                  className="cursor-text text-2xl sm:text-3xl font-bold tracking-tight drop-shadow-md select-none text-foreground"
                  title="Nhấp đúp để đổi tên"
                  onDoubleClick={() => setEditingName(true)}
                >
                  {profile.displayName}
                </h1>
              )}
            </div>
          </div>
        </div>

        {/* 3. CARDS GRID */}
        <div 
          className="mt-4 flex-1 min-h-0 grid gap-4 grid-cols-1 lg:grid-cols-3 will-change-transform"
          style={{
  opacity: "calc(1 - var(--p) * 2.5)",
  transform: "translate3d(0, calc(var(--p) * 60px), 0)",
  pointerEvents: "auto", // sẽ tắt bằng JS nếu cần, hoặc giữ nguyên auto
}}
        >
          {/* Card 1: Thống kê */}
          <Card className="flex flex-col h-full min-h-0 overflow-hidden p-5">
            <div className="shrink-0">
              <CardTitle>Thống kê lệnh</CardTitle>
              <CardDesc className="mb-3">Không tính lệnh đã xóa</CardDesc>
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