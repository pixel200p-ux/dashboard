import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bot, Check, Grip, History, LoaderCircle, MessageCircle, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  deletePixelConversations,
  fetchPixelConversation,
  fetchPixelConversations,
  fetchPixelSettings,
  PIXEL_SETTINGS_QUERY_KEY,
  savePixelExchange,
  savePixelMemorySuggestion,
  sendPixelMessage,
  type PixelConversationMessage,
} from "@/lib/api/pixel";
import type { PortfolioPayload } from "@/lib/api/portfolio";
import {
  useUiStore,
  type AssistantPanelSize,
  type LoginThemeId,
  type ThemeMode,
} from "@/lib/ui-store";
import { cn } from "@/lib/utils";

type PixelSource = { title: string; url: string; publishedDate?: string };

type PixelMessage = {
  id: string;
  role: "pixel" | "user";
  text: string;
  choices?: string[];
  quizAnswer?: number;
  quizExplanation?: string;
  selectedChoice?: number;
  memorySuggestion?: string;
  memorySaved?: boolean;
  sources?: PixelSource[];
};

type Position = { x: number; y: number };
const BUTTON_SIZE = 64;
/** Khoảng trống giữa mép dưới khung chat và icon (không chạm nhau). */
const ICON_GAP = 12;

const QUIZ_CHOICES = [

  "Toàn bộ vào một mã đang tăng",
  "Chia vốn cho nhiều loại tài sản",
  "Chỉ mua theo tin đồn",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);
}

function portfolioContextForAI(portfolio: PortfolioPayload | undefined): string {
  if (!portfolio) return "Danh mục chưa tải xong.";
  const accounts = new Map(portfolio.ledger.accounts.map((account) => [account.id, account.name]));
  const assets = new Map(portfolio.ledger.assets.map((asset) => [asset.id, asset]));
  const transactions = portfolio.ledger.transactions;
  const payload = {
    asOf: portfolio.state.asOf,
    summary: {
      nav: portfolio.state.nav,
      originalCapital: portfolio.state.originalCapital,
      totalPnl: portfolio.state.totalPnl,
      totalReturnPct: portfolio.state.totalReturnPct,
      realizedPnl: portfolio.state.realizedTradePnl,
      unrealizedPnl: portfolio.state.unrealizedPnl,
      cashDividend: portfolio.state.cashDividend,
      stockDividendQuantity: portfolio.state.stockDividendQty,
      bankInterest: portfolio.state.bankInterest,
      allocation: portfolio.state.allocation,
    },
    allHoldings: portfolio.state.holdings.map(({ openLots: _openLots, ...holding }) => holding),
    activeBankDeposits: portfolio.state.banks,
    redeemedBankDeposits: portfolio.state.redeemedBanks,
    openTplusTrades: portfolio.state.tplusCards,
    completedTplusHistory: portfolio.state.tplusHistory.slice(-50),
    assets: portfolio.ledger.assets,
    transactionCounts: transactions.reduce<Record<string, number>>((counts, transaction) => {
      counts[transaction.txType] = (counts[transaction.txType] ?? 0) + 1;
      return counts;
    }, {}),
    dividendTransactions: transactions
      .filter((transaction) => transaction.txType === "CASH_DIVIDEND" || transaction.txType === "STOCK_DIVIDEND")
      .map((transaction) => ({
        type: transaction.txType,
        date: transaction.txDate,
        symbol: transaction.assetId ? assets.get(transaction.assetId)?.symbol ?? "unknown" : "unknown",
        account: accounts.get(transaction.accountId) ?? transaction.accountId,
        quantity: transaction.quantity,
        cashAmount: transaction.amount,
        stockDividendQuantity: transaction.stockDivQty,
        notes: transaction.notes,
      })),
    recentTransactions: transactions.slice(-50).map((transaction) => ({
      type: transaction.txType,
      date: transaction.txDate,
      symbol: transaction.assetId ? assets.get(transaction.assetId)?.symbol ?? "unknown" : "unknown",
      account: accounts.get(transaction.accountId) ?? transaction.accountId,
      quantity: transaction.quantity,
      price: transaction.price,
      amount: transaction.amount,
      fees: transaction.fee,
      tax: transaction.tax,
      notes: transaction.notes,
    })),
  };
  const serialized = JSON.stringify(payload);
  if (serialized.length > 58_000) {
    const compactPayload = {
      ...payload,
      completedTplusHistory: payload.completedTplusHistory.slice(-20),
      recentTransactions: payload.recentTransactions.slice(-25),
    };
    return JSON.stringify(compactPayload);
  }
  return serialized;
}

function parseStoredSources(content: string): { text: string; sources?: PixelSource[] } {
  const marker = "\n\nNguồn tham khảo:\n";
  const markerIndex = content.lastIndexOf(marker);
  if (markerIndex < 0) return { text: content };
  const sourceLines = content.slice(markerIndex + marker.length).split("\n");
  const sources = sourceLines.flatMap((line) => {
    const match = line.match(/^\[\d+\]\s+(.+?)\s+—\s+(https:\/\/\S+)$/);
    return match ? [{ title: match[1], url: match[2] }] : [];
  });
  return sources.length
    ? { text: content.slice(0, markerIndex), sources }
    : { text: content };
}

function quizMessage(): PixelMessage {
  return {
    id: crypto.randomUUID(),
    role: "pixel",
    text: "Đố vui nhanh: Cách nào thường giúp giảm rủi ro tập trung trong danh mục?",
    choices: QUIZ_CHOICES,
    quizAnswer: 1,
    quizExplanation: "Đa dạng hóa giúp giảm mức phụ thuộc vào biến động của một mã hoặc một loại tài sản.",
  };
}

function BlackHoleIcon({
  open,
  hovered,
  position,
  theme,
}: {
  open: boolean;
  hovered: boolean;
  position: Position;
  theme: ThemeMode;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stateRef = useRef({ open, hovered, position, theme });
  stateRef.current = { open, hovered, position, theme };

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const maxOrbit = 100;
    const maxOpacity = 1;
    const lineWidth = 0.6;
    const normalStars = 1400;
    const expanseStars = 2000;
    const stars: {
      index: number;
      x: number;
      y: number;
      yOrigin: number;
      speed: number;
      rotation: number;
      startRotation: number;
      collapseBonus: number;
      color: string;
      hoverPos: number;
      expansePos: number;
      prevR: number;
      prevX: number;
      prevY: number;
      opacity: number;
    }[] = [];

    let width = 0;
    let height = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);
    let maxRadius = 0;
    let frameId = 0;
    let resizeTimer: ReturnType<typeof setTimeout> | null = null;
    let startTime = 0;
    let currentTime = 0;
    let currentTheme = stateRef.current.theme;
    let wasExpanse = false;

    const colorForStar = (opacity: number) =>
      `rgba(${currentTheme === "dark" ? "255, 255, 255" : "0, 0, 0"}, ${opacity.toFixed(3)})`;

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = window.innerWidth;
      height = window.innerHeight;
      maxRadius = Math.max(width, height) * 1.2;
      canvas.width = Math.ceil(width * dpr);
      canvas.height = Math.ceil(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);
      createStars();
    };

    const createStars = () => {
      stars.length = 0;
      for (let i = 0; i < expanseStars; i += 1) {
        const orbitRanges = [
          Math.random() * (maxOrbit / 2) + 1,
          Math.random() * maxOrbit + maxOrbit / 2,
        ];
        const orbital = (orbitRanges[0] + orbitRanges[1]) / 2;
        const startRotation = (Math.floor(Math.random() * 360) + 1) * Math.PI / 180;
        const collapseBonus = Math.max(0, orbital - maxOrbit * 0.7);
        const distFactor = Math.pow(Math.random(), 1.8);
        const expanseRadius = distFactor * maxRadius;
        const baseAlpha = 1 - (expanseRadius / maxRadius) * 0.85;
        const opacity = Math.max(0.05, baseAlpha * maxOpacity);

        stars.push({
          index: i,
          x: 0,
          y: orbital,
          yOrigin: orbital,
          speed: (Math.floor(Math.random() * 2.5) + 1.5) * Math.PI / 180,
          rotation: 0,
          startRotation,
          collapseBonus,
          color: colorForStar(opacity),
          hoverPos: maxOrbit / 2 + collapseBonus,
          expansePos: -expanseRadius,
          prevR: startRotation,
          prevX: 0,
          prevY: orbital,
          opacity,
        });
      }
    };

    const rotate = (px: number, py: number, x: number, y: number, angle: number) => {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return [
        cos * (x - px) + sin * (y - py) + px,
        cos * (y - py) - sin * (x - px) + py,
      ];
    };

    const animate = () => {
      if (document.visibilityState !== "visible") return;
      currentTime = (Date.now() - startTime) / 50;
      ctx.globalCompositeOperation = "destination-out";
      ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = "lighter";

      const { open: expanse, hovered: collapse, position: iconPosition, theme: nextTheme } = stateRef.current;
      const centerX = iconPosition.x + BUTTON_SIZE / 2;
      const centerY = iconPosition.y + BUTTON_SIZE / 2;

      if (currentTheme !== nextTheme) {
        currentTheme = nextTheme;
        for (const star of stars) {
          star.color = colorForStar(star.opacity);
        }
      }

      if (expanse && !wasExpanse) {
        for (const star of stars) {
          star.y = 0;
          star.prevY = 0;
          star.prevX = 0;
        }
      }
      wasExpanse = expanse;

      for (const star of stars) {
        if (!expanse && star.index >= normalStars) continue;
        if (expanse && star.index >= expanseStars) continue;

        if (expanse) {
          star.rotation = star.startRotation + currentTime * (star.speed / 2);
          star.y += (star.expansePos - star.y) * 0.05;
        } else if (collapse) {
          star.rotation = star.startRotation + currentTime * star.speed;
          if (star.y > star.hoverPos) star.y -= (star.hoverPos - star.y) / -5;
          if (star.y < star.hoverPos - 4) star.y += 2.5;
        } else {
          star.rotation = star.startRotation + currentTime * star.speed;
          star.y += (star.yOrigin - star.y) * 0.08;
        }

        ctx.strokeStyle = star.color;
        ctx.lineWidth = lineWidth;
        ctx.beginPath();
        const oldPos = rotate(0, 0, star.prevX, star.prevY, -star.prevR);
        ctx.moveTo(centerX + oldPos[0], centerY + oldPos[1]);
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(star.rotation);
        ctx.translate(-centerX, -centerY);
        ctx.lineTo(centerX + star.x, centerY + star.y);
        ctx.stroke();
        ctx.restore();

        star.prevR = star.rotation;
        star.prevX = star.x;
        star.prevY = star.y;
      }

      ctx.globalCompositeOperation = "source-over";
      frameId = requestAnimationFrame(animate);
    };

    const start = () => {
      cancelAnimationFrame(frameId);
      if (document.visibilityState !== "visible") return;
      if (startTime === 0) startTime = Date.now();
      frameId = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        resize();
        start();
      }, 150);
    };

    resize();
    start();
    document.addEventListener("visibilitychange", start);
    window.addEventListener("resize", handleResize);
    window.addEventListener("orientationchange", handleResize);

    return () => {
    cancelAnimationFrame(frameId);
    if (resizeTimer) clearTimeout(resizeTimer);
    document.removeEventListener("visibilitychange", start);
    window.removeEventListener("resize", handleResize);
    window.removeEventListener("orientationchange", handleResize);
    };
  }, []);

  return <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[119] h-dvh w-screen" aria-hidden="true" />;
}

export function PixelAssistant({ portfolio }: { portfolio: PortfolioPayload | undefined }) {
  const queryClient = useQueryClient();
  const theme = useUiStore((state) => state.theme);
  const setTheme = useUiStore((state) => state.setTheme);
  const setLoginTheme = useUiStore((state) => state.setLoginTheme);
  const assistantPanelSize = useUiStore((state) => state.assistantPanelSize);
  const setAssistantPanelSize = useUiStore((state) => state.setAssistantPanelSize);
  
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PixelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [savingMemoryId, setSavingMemoryId] = useState<string | null>(null);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [iconHovered, setIconHovered] = useState(false);
  const [unread, setUnread] = useState(false);
  const [notification, setNotification] = useState<PixelMessage | null>(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [selectedConversations, setSelectedConversations] = useState<string[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [deletingConversations, setDeletingConversations] = useState(false);

  const { data: settings, isFetched: settingsFetched } = useQuery({
    queryKey: PIXEL_SETTINGS_QUERY_KEY,
    queryFn: () => fetchPixelSettings(),
    refetchInterval: 10_000,
  });

  const { data: conversations = [], isError: conversationsError, isPending: conversationsPending, refetch: refetchConversations } = useQuery({
    queryKey: ["pixel-conversations"],
    queryFn: () => fetchPixelConversations(),
    enabled: historyOpen,
    refetchInterval: historyOpen ? 10_000 : false,
  });

  const openRef = useRef(open);
  const dockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; pointerX: number; pointerY: number } | null>(null);
  const dragged = useRef(false);
  const ignoreTriggerClick = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const positionRef = useRef(position);
  positionRef.current = position;

  const panelRef = useRef<HTMLDivElement>(null);
  const targetPanelSize = useRef<AssistantPanelSize>(assistantPanelSize);
  const currentSize = useRef<AssistantPanelSize>(assistantPanelSize);
  const rafResizeRef = useRef<number>(0);
  const resizeStart = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  useEffect(() => {
    targetPanelSize.current = assistantPanelSize;
    currentSize.current = assistantPanelSize;
  }, [assistantPanelSize]);

  // High-performance smooth resize (Dragon-style)
  useEffect(() => {
    const smoothResize = () => {
      const dw = targetPanelSize.current.width - currentSize.current.width;
      const dh = targetPanelSize.current.height - currentSize.current.height;

      if (Math.abs(dw) > 0.1 || Math.abs(dh) > 0.1) {
        currentSize.current.width += dw * 0.18;
        currentSize.current.height += dh * 0.18;
      } else if (dw !== 0 || dh !== 0) {
        currentSize.current = { ...targetPanelSize.current };
      }

      if (panelRef.current) {
        const w = currentSize.current.width;
        const h = currentSize.current.height;
        const icon = positionRef.current;
        panelRef.current.style.width = `${w}px`;
        panelRef.current.style.height = `${h}px`;
        // Neo góc dưới phải = icon; kéo góc trên trái thì icon không chạy
        panelRef.current.style.left = `${icon.x + BUTTON_SIZE - w}px`;
        panelRef.current.style.top = `${icon.y - ICON_GAP - h}px`;
      }

      rafResizeRef.current = requestAnimationFrame(smoothResize);
    };
    rafResizeRef.current = requestAnimationFrame(smoothResize);
    return () => cancelAnimationFrame(rafResizeRef.current);
  }, []);

  const startResizing = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: targetPanelSize.current.width,
      h: targetPanelSize.current.height,
    };

    const handleMove = (moveEvent: globalThis.PointerEvent) => {
      if (!resizeStart.current) return;
      moveEvent.preventDefault();
      // Tay cầm góc TRÊN TRÁI: kéo sang trái / lên = to hơn
      const dx = moveEvent.clientX - resizeStart.current.x;
      const dy = moveEvent.clientY - resizeStart.current.y;
      targetPanelSize.current = {
        width: Math.max(300, Math.min(window.innerWidth - 24, resizeStart.current.w - dx)),
        height: Math.max(200, Math.min(window.innerHeight - 24, resizeStart.current.h - dy)),
      };
    };

    const handleUp = () => {
      resizeStart.current = null;
      setAssistantPanelSize({ ...targetPanelSize.current });
      window.removeEventListener("pointermove", handleMove as any);
      window.removeEventListener("pointerup", handleUp as any);
      window.removeEventListener("pointercancel", handleUp as any);
    };

    window.addEventListener("pointermove", handleMove as any);
    window.addEventListener("pointerup", handleUp as any);
    window.addEventListener("pointercancel", handleUp as any);
  };

  const nav = portfolio?.state.nav ?? 0;
  const pnl = portfolio?.state.totalPnl ?? 0;
  const returnPct = portfolio?.state.totalReturnPct ?? 0;
  const allocation = Object.entries(portfolio?.state.allocation ?? {})
    .sort(([, a], [, b]) => b.pct - a.pct)
    .slice(0, 3)
    .map(([name, value]) => `${name}: ${value.pct.toFixed(0)}%`)
    .join(" · ");
  const portfolioContext = portfolioContextForAI(portfolio);
  const heldSymbols = (portfolio?.state.holdings ?? [])
    .filter((holding) => holding.quantity > 0)
    .map((holding) => holding.symbol);
  const assetSummary = (portfolio?.state.holdings ?? [])
    .map((holding) => `${holding.symbol}: ${holding.quantity.toLocaleString("vi-VN")} đơn vị`)
    .join("; ");
  const portfolioSummary = portfolio
    ? `${formatCurrency(nav)} giá trị tài sản; ${pnl >= 0 ? "lãi" : "lỗ"} ${formatCurrency(Math.abs(pnl))}; lợi nhuận ${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%; phân bổ ${allocation || "chưa có dữ liệu"}.`
    : "Danh mục đang tải dữ liệu.";

  const dismissNotification = useCallback(() => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    notificationTimer.current = null;
    setNotification(null);
  }, []);

  const addPixelMessage = useCallback((text: string, options: Pick<PixelMessage, "choices" | "quizAnswer" | "quizExplanation" | "memorySuggestion" | "sources"> = {}) => {
    const message: PixelMessage = { id: crypto.randomUUID(), role: "pixel", text, ...options };
    setMessages((current) => [...current, message]);
    if (!openRef.current) {
      setNotification(message);
      setUnread(true);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
      notificationTimer.current = setTimeout(() => setNotification(null), 12_000);
    }
  }, []);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const isBacktick =
        event.code === "Backquote" || event.key === "`" || event.key === "~";
      if (!isBacktick) return;
      event.preventDefault();
      dismissNotification();
      const next = !openRef.current;
      if (next) {
        const margin = 20;
        const iconX = Math.max(12, window.innerWidth - BUTTON_SIZE - margin);
        const iconY = Math.max(12, window.innerHeight - BUTTON_SIZE - margin);
        positionRef.current = { x: iconX, y: iconY };
        setPosition({ x: iconX, y: iconY });

        const maxH = Math.max(200, iconY - ICON_GAP - 12);
        const maxW = Math.max(300, iconX + BUTTON_SIZE - 12);
        if (targetPanelSize.current.height > maxH) {
          targetPanelSize.current.height = maxH;
          currentSize.current.height = maxH;
        }
        if (targetPanelSize.current.width > maxW) {
          targetPanelSize.current.width = maxW;
          currentSize.current.width = maxW;
        }

        window.setTimeout(() => {
          document
            .querySelector<HTMLInputElement>('input[aria-label="Tin nhắn cho Pixel"]')
            ?.focus();
        }, 0);
      }
      openRef.current = next;
      setOpen(next);
      setUnread(false);
      if (next) {
        clearDockTimer();
      } else {
        resetDockTimer();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dismissNotification]);

  useEffect(() => {
    const resize = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setPosition((current) => {
        if (current.x === 0 && current.y === 0) {
          return { x: window.innerWidth - BUTTON_SIZE - 20, y: window.innerHeight - BUTTON_SIZE - 24 };
        }
        return {
          x: Math.min(Math.max(current.x, -BUTTON_SIZE / 2), window.innerWidth - BUTTON_SIZE / 2),
          y: Math.min(Math.max(current.y, 12), window.innerHeight - BUTTON_SIZE - 12),
        };
      });
    };
    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    if (!settingsFetched || messages.length > 0 || conversationId || loadingConversation) return;
    addPixelMessage(
      (settings?.keys.length ?? 0) > 0
        ? "Chào bạn, mình là Pixel. Mình có thể tóm tắt danh mục, giải thích rủi ro hoặc cùng bạn làm một câu đố nhỏ."
        : settings
          ? "Chào bạn, mình là Pixel. Thêm API key Gemini, Groq hoặc OpenRouter trong Cài đặt để mình trò chuyện nhé."
          : "Chào bạn, mình là Pixel. Hiện chưa tải được cài đặt AI; hãy thử tải lại hoặc kiểm tra kết nối.",
      { choices: ["Tóm tắt danh mục", "Cập nhật các mã", "Đố vui tài chính"] },
    );
  }, [addPixelMessage, conversationId, loadingConversation, messages.length, settings, settingsFetched]);

  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      const update = assetSummary
        ? `Ghé qua cập nhật một chút: giá gần nhất trong sổ của bạn là ${assetSummary}. Đây là dữ liệu sẵn có trong danh mục, chưa phải báo giá trực tiếp.`
        : `Ghé qua chào bạn một chút! ${portfolioSummary} Khi cần, mình có thể giúp xem lại phân bổ hoặc giải thích một khái niệm đầu tư.`;
      addPixelMessage(update, { choices: ["Xem phân bổ", "Đố vui tài chính"] });
    }, 30 * 60 * 1000);
    return () => clearInterval(timer);
  }, [addPixelMessage, assetSummary, portfolioSummary]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending, open]);

  function clearDockTimer() {
    if (dockTimer.current) {
      clearTimeout(dockTimer.current);
      dockTimer.current = null;
    }
  }

  function resetDockTimer() {
    clearDockTimer();
    // Chỉ nép 10% khi khung chat ĐANG ĐÓNG
    if (openRef.current) return;
    dockTimer.current = setTimeout(() => {
      if (openRef.current) return; // vẫn đang mở thì bỏ qua
      setPosition((current) => {
        const maxX = Math.max(0, window.innerWidth - BUTTON_SIZE);
        return {
          x: current.x + BUTTON_SIZE / 2 < window.innerWidth / 2
            ? -BUTTON_SIZE * 0.1
            : maxX + BUTTON_SIZE * 0.1,
          y: Math.min(Math.max(current.y, 16), window.innerHeight - BUTTON_SIZE - 16),
        };
      });
    }, 5000); // 5 giây không đụng → nép 10%
  }

  useEffect(() => {
    resetDockTimer();
    return () => {
      if (dockTimer.current) clearTimeout(dockTimer.current);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, []);

  // Auto-close when interacting outside the chat.
  useEffect(() => {
    if (!open) return;
    const handlePointerDownOutside = (e: globalThis.PointerEvent) => {
      if (resizeStart.current || !(e.target instanceof Element)) return;
      const target = e.target;
      if (target.closest('section[aria-label="Trò chuyện với Pixel"]')) return;
      if (target.closest('button[aria-label="Mở Pixel"], button[aria-label="Đóng Pixel"]')) {
        ignoreTriggerClick.current = true;
      }
      setOpen(false);
      openRef.current = false;
      resetDockTimer();
    };
    window.addEventListener("pointerdown", handlePointerDownOutside);
    return () => window.removeEventListener("pointerdown", handlePointerDownOutside);
  }, [open]);

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { x: position.x, y: position.y, pointerX: event.clientX, pointerY: event.clientY };
    dragged.current = false;
    setDragging(true);
    clearDockTimer();

    // Kéo icon → đóng khung nếu đang mở
    if (open) {
      setOpen(false);
      openRef.current = false;
    }
  }


  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const origin = dragOrigin.current;
    if (!origin) return;
    const dx = event.clientX - origin.pointerX;
    const dy = event.clientY - origin.pointerY;
    if (Math.abs(dx) + Math.abs(dy) > 6) dragged.current = true;
    if (!dragged.current) return;
    setPosition({
      x: Math.min(Math.max(origin.x + dx, -BUTTON_SIZE / 2), window.innerWidth - BUTTON_SIZE / 2),
      y: Math.min(Math.max(origin.y + dy, 12), window.innerHeight - BUTTON_SIZE - 12),
    });
  }

  function endDrag() {
    dragOrigin.current = null;
    setDragging(false);

    // Chỉ nép cạnh khi đã KÉO thật; bấm mở chat thì để onClick xử lý
    if (!dragged.current) return;
    ignoreTriggerClick.current = false;

    setPosition((current) => {
      const maxX = Math.max(0, window.innerWidth - BUTTON_SIZE);
      const nearLeft = current.x + BUTTON_SIZE / 2 < window.innerWidth / 2;
      return {
        x: nearLeft ? 8 : maxX - 8,
        y: Math.min(Math.max(current.y, 12), window.innerHeight - BUTTON_SIZE - 12),
      };
    });

    resetDockTimer();
  }

  async function sendMessage(text: string) {
    const prompt = text.trim();
    if (!prompt || sending) return;
    setDraft("");
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", text: prompt }]);

    const normalizedPrompt = prompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
    const themeCommands: { mode: ThemeMode; pattern: RegExp; label: string }[] = [
      { mode: "light", pattern: /(?:theme|giao dien|che do).*(?:sang|light)|(?:doi|chuyen).*(?:sang|light)|^(?:sang|light)$/, label: "sáng" },
      { mode: "dark", pattern: /(?:theme|giao dien|che do).*(?:toi|dark)|(?:doi|chuyen).*(?:toi|dark)|^(?:toi|dark)$/, label: "tối" },
    ];
    const themeCommand = themeCommands.find(({ pattern }) => pattern.test(normalizedPrompt));
    if (themeCommand) {
      setTheme(themeCommand.mode);
      const answer = `Đã chuyển giao diện sang chế độ ${themeCommand.label}.`;
      addPixelMessage(answer, { choices: ["Đổi sang sáng", "Đổi sang tối"] });
      await saveLocalAnswer(prompt, answer);
      return;
    }

    const seasonCommands: { pattern: RegExp; season: LoginThemeId; label: string }[] = [
      { pattern: /(?:mua|season).*(?:xuan|spring)|\b(?:xuan|spring)\b/, season: "spring", label: "xuân" },
      { pattern: /(?:mua|season).*(?:ha|he|summer)|\b(?:ha|he|summer)\b/, season: "summer", label: "hạ" },
      { pattern: /(?:mua|season).*(?:thu|autumn|fall)|\b(?:thu|autumn|fall)\b/, season: "autumn", label: "thu" },
      { pattern: /(?:mua|season).*(?:dong|winter)|\b(?:dong|winter)\b/, season: "winter", label: "đông" },
    ];
    const seasonCommand = seasonCommands.find(({ pattern }) => pattern.test(normalizedPrompt));
    if (seasonCommand) {
      setLoginTheme(seasonCommand.season);
      const answer = `Đã chuyển phong cảnh giao diện sang mùa ${seasonCommand.label}.`;
      addPixelMessage(answer, { choices: ["Mùa xuân", "Mùa hạ", "Mùa thu", "Mùa đông"] });
      await saveLocalAnswer(prompt, answer);
      return;
    }

    if (/^(đố vui|đố vui tài chính|đố vui tiếp)$/i.test(prompt)) {
      const quiz = quizMessage();
      addPixelMessage(quiz.text, { choices: quiz.choices, quizAnswer: quiz.quizAnswer, quizExplanation: quiz.quizExplanation });
      await saveLocalAnswer(prompt, quiz.text);
      return;
    }

    setSending(true);
    try {
      const result = await sendPixelMessage({
        data: {
          conversationId: conversationId ?? undefined,
          prompt,
          portfolioContext,
          portfolioSymbols: heldSymbols,
        },
      });
      setConversationId(result.conversationId);
      addPixelMessage(result.answer, {
        choices: ["Hỏi thêm", "Đố vui tài chính"],
        ...(result.memorySuggestion ? { memorySuggestion: result.memorySuggestion } : {}),
        ...(result.sources ? { sources: result.sources } : {}),
      });
      void queryClient.invalidateQueries({ queryKey: ["pixel-conversations"] });
      void queryClient.invalidateQueries({ queryKey: PIXEL_SETTINGS_QUERY_KEY });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không gửi được yêu cầu tới AI.";
      addPixelMessage(`Mình chưa kết nối được AI: ${text}`, { choices: ["Thử lại", "Đố vui tài chính"] });
    } finally {
      setSending(false);
    }
  }

  async function saveLocalAnswer(prompt: string, answer: string) {
    setSending(true);
    try {
      const result = await savePixelExchange({
        data: { conversationId: conversationId ?? undefined, prompt, answer },
      });
      setConversationId(result.conversationId);
      void queryClient.invalidateQueries({ queryKey: ["pixel-conversations"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được hội thoại Pixel");
    } finally {
      setSending(false);
    }
  }

  async function confirmMemorySuggestion(message: PixelMessage) {
    if (!message.memorySuggestion || savingMemoryId) return;
    setSavingMemoryId(message.id);
    try {
      const { memories } = await savePixelMemorySuggestion({
        data: { suggestion: message.memorySuggestion },
      });
      queryClient.setQueryData(PIXEL_SETTINGS_QUERY_KEY, (current: typeof settings) => current
        ? { ...current, memories }
        : current);
      setMessages((current) => current.map((item) => item.id === message.id
        ? { ...item, memorySuggestion: undefined, memorySaved: true }
        : item));
      toast.success("Đã lưu vào Thông tin cần nhớ");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được nội dung ghi nhớ");
    } finally {
      setSavingMemoryId(null);
    }
  }

  function dismissMemorySuggestion(message: PixelMessage) {
    setMessages((current) => current.map((item) => item.id === message.id
      ? { ...item, memorySuggestion: undefined }
      : item));
  }

  async function choose(message: PixelMessage, index: number, choice: string) {
    if (message.quizAnswer !== undefined) {
      if (message.selectedChoice !== undefined) return;
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, selectedChoice: index } : item));
      const correct = index === message.quizAnswer;
      const answer = `${correct ? "Chính xác!" : "Chưa đúng rồi."} ${message.quizExplanation ?? ""}`;
      addPixelMessage(answer, { choices: ["Đố vui tiếp", "Tóm tắt danh mục"] });
      await saveLocalAnswer(choice, answer);
      return;
    }
    void sendMessage(choice === "Hỏi thêm" ? "Hãy giải thích thêm về nội dung vừa trả lời." : choice);
  }

  function startNewConversation() {
    setConversationId(null);
    setMessages([]);
    setHistoryOpen(false);
    setSelectedConversations([]);
  }

  async function openConversation(id: string) {
    setConversationId(id);
    setMessages([]);
    setHistoryOpen(false);
    setLoadingConversation(true);
    try {
      const conversation = await fetchPixelConversation({ data: { id } });
      setMessages(conversation.messages.map((message: PixelConversationMessage) => {
        const parsed = message.role === "pixel" ? parseStoredSources(message.content) : { text: message.content };
        return {
          id: message.id,
          role: message.role === "user" ? "user" as const : "pixel" as const,
          text: parsed.text,
          ...(parsed.sources ? { sources: parsed.sources } : {}),
        };
      }));
    } catch (error) {
      setConversationId(null);
      toast.error(error instanceof Error ? error.message : "Không mở được hội thoại");
    } finally {
      setLoadingConversation(false);
    }
  }

  async function deleteSelectedConversations() {
    if (selectedConversations.length === 0) return;
    if (!window.confirm(`Xóa vĩnh viễn ${selectedConversations.length} hội thoại đã chọn? Thao tác này không thể hoàn tác.`)) return;
    setDeletingConversations(true);
    try {
      await deletePixelConversations({ data: { ids: selectedConversations } });
      if (conversationId && selectedConversations.includes(conversationId)) startNewConversation();
      setSelectedConversations([]);
      await refetchConversations();
      toast.success("Đã xóa vĩnh viễn hội thoại đã chọn");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xóa được hội thoại");
    } finally {
      setDeletingConversations(false);
    }
  }

    const onLeft = position.x + BUTTON_SIZE / 2 < viewport.width / 2;
    const panelWidth = currentSize.current.width;
    const panelHeight = currentSize.current.height;
    // Khung nằm phía trên icon, góc dưới phải; cách ICON_GAP — không chạm
    const panelLeft = position.x + BUTTON_SIZE - panelWidth;
    const panelTop = position.y - ICON_GAP - panelHeight;
    const notificationAbove = position.y > viewport.height / 2;

    return (
      <>
        {notification && !open && (

        <div
          className="fixed z-120 w-[min(300px,calc(100vw-88px))] animate-in fade-in slide-in-from-bottom-2 duration-200"
          style={{
            ...(onLeft ? { left: Math.max(12, position.x + BUTTON_SIZE + 12) } : { right: Math.max(12, viewport.width - position.x + 12) }),
            ...(notificationAbove
              ? { bottom: Math.max(12, viewport.height - position.y + 12) }
              : { top: Math.max(12, position.y + BUTTON_SIZE + 12) }),
          }}
          aria-live="polite"
        >
          <button
            type="button"
            className="fixed-surface w-full rounded-2xl border border-border/80 p-3 text-left text-card-foreground shadow-[0_10px_32px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.24)]"
            onClick={() => {
              dismissNotification();
              openRef.current = true;
              setOpen(true);
              setUnread(false);
            }}
            aria-label="Mở tin nhắn mới từ Pixel"
          >
            <span className="mb-1.5 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary/10 text-primary"><Bot className="h-3.5 w-3.5" /></span>
              <span className="text-xs font-semibold">Pixel</span>
              <span className="ml-auto text-[10px] text-muted-foreground">Tin nhắn mới</span>
            </span>
            <span className="line-clamp-3 block text-sm leading-5 text-foreground">{notification.text}</span>
            <span className="mt-2 flex items-center gap-1 text-[11px] font-medium text-primary"><MessageCircle className="h-3.5 w-3.5" /> Nhấn để trò chuyện</span>
          </button>
          <button
            type="button"
            className="fixed-surface absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border text-muted-foreground shadow-sm hover:text-foreground"
            onClick={dismissNotification}
            aria-label="Đóng thông báo Pixel"
          ><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent title="Lịch sử trò chuyện">
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">Lịch sử này được chia sẻ với mọi tài khoản đăng nhập.</p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!selectedConversations.length || deletingConversations}
              onClick={() => void deleteSelectedConversations()}
            >
              <Trash2 className="mr-1.5 h-4 w-4" /> Xóa ({selectedConversations.length})
            </Button>
          </div>
          {conversationsPending ? (
            <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground"><LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải hội thoại…</div>
          ) : conversationsError ? (
            <p className="py-8 text-sm text-loss">Không tải được lịch sử trò chuyện.</p>
          ) : conversations.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Chưa có hội thoại nào được lưu.</p>
          ) : (
            <div className="max-h-[55dvh] space-y-2 overflow-y-auto">
              {conversations.map((conversation) => (
                <div key={conversation.id} className="flex items-center gap-3 rounded-xl border border-border p-3">
                  <Checkbox
                    checked={selectedConversations.includes(conversation.id)}
                    onCheckedChange={(checked) => setSelectedConversations((current) => (
                      checked === true
                        ? current.includes(conversation.id) ? current : [...current, conversation.id]
                        : current.filter((id) => id !== conversation.id)
                    ))}
                    aria-label={`Chọn hội thoại ${conversation.title}`}
                  />
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => void openConversation(conversation.id)}>
                    <span className="block truncate text-sm font-medium">{conversation.title}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {conversation.messageCount} tin nhắn · {new Date(conversation.updatedAt).toLocaleString("vi-VN")}
                    </span>
                  </button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

            {open && (
              <section
                ref={panelRef}
                className={cn("fixed-surface fixed flex flex-col overflow-hidden rounded-2xl border border-border/80 text-card-foreground shadow-[0_16px_48px_rgba(15,23,42,0.22)]", historyOpen ? "z-40" : "z-[130]")}
                style={{
                  width: panelWidth,
                  height: panelHeight,
                  maxWidth: "calc(100vw - 24px)",
                  maxHeight: "calc(100dvh - 24px)",
                  transformOrigin: "bottom right",
                  top: panelTop,
                  left: panelLeft,
                  willChange: "width, height, top, left",
                }}
                onPointerDown={() => resetDockTimer()}
                aria-label="Trò chuyện với Pixel"
              >



          <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold">Pixel</p><p className="text-[11px] text-muted-foreground">Trợ lý danh mục của bạn</p></div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={startNewConversation} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Tạo hội thoại mới"><Plus className="h-4 w-4" /></button>
              <button type="button" onClick={() => { setSelectedConversations([]); setHistoryOpen(true); }} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Mở lịch sử trò chuyện"><History className="h-4 w-4" /></button>
              <button
                type="button"
                onClick={() => {
                  openRef.current = false;
                  setOpen(false);
                  resetDockTimer();
                }}
                className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Đóng Pixel"
              ><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div ref={scrollRef} className="min-h-48 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {loadingConversation && <div className="flex items-center gap-2 px-2 py-4 text-xs text-muted-foreground"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Đang mở hội thoại…</div>}
            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[92%] rounded-2xl px-3 py-2", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/70")}>
                  <p className="whitespace-pre-wrap text-xs leading-5">{message.text}</p>
                  {message.sources && message.sources.length > 0 && (
                    <div className="mt-2 border-t border-border/60 pt-2">
                      <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Nguồn web</p>
                      <ul className="space-y-1">
                        {message.sources.map((source, index) => (
                          <li key={source.url} className="text-[11px] leading-4">
                            <a href={source.url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">
                              [{index + 1}] {source.title}
                            </a>
                            {source.publishedDate ? <span className="ml-1 text-muted-foreground">· {source.publishedDate}</span> : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {message.memorySuggestion && (
                    <div className="mt-2 rounded-xl border border-primary/20 bg-card/80 p-2.5">
                      <p className="text-[11px] font-semibold text-primary">Gợi ý ghi nhớ</p>
                      <p className="mt-1 whitespace-pre-wrap text-xs leading-5">{message.memorySuggestion}</p>
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 px-2.5 text-xs"
                          disabled={savingMemoryId !== null}
                          onClick={() => void confirmMemorySuggestion(message)}
                        >
                          {savingMemoryId === message.id ? <LoaderCircle className="animate-spin" /> : <Check />}
                          Lưu ghi nhớ
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-8 px-2.5 text-xs"
                          disabled={savingMemoryId !== null}
                          onClick={() => dismissMemorySuggestion(message)}
                        >
                          Bỏ qua
                        </Button>
                      </div>
                    </div>
                  )}
                  {message.memorySaved && (
                    <p className="mt-2 flex items-center gap-1 text-[11px] text-profit"><Check className="h-3.5 w-3.5" /> Đã lưu vào ghi nhớ</p>
                  )}
                  {message.choices && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.choices.map((choice, index) => (
                        <button
                          key={choice}
                          type="button"
                          disabled={sending || (message.quizAnswer !== undefined && message.selectedChoice !== undefined)}
                          onClick={() => void choose(message, index, choice)}
                          className={cn(
                            "rounded-full border border-border bg-card px-2.5 py-1 text-left text-xs transition hover:border-primary/50 hover:bg-primary/5 disabled:cursor-default disabled:opacity-70",
                            message.quizAnswer !== undefined && message.selectedChoice === index && (index === message.quizAnswer ? "border-profit text-profit" : "border-loss text-loss"),
                          )}
                        >{choice}</button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {sending && <div className="flex items-center gap-2 px-2 text-xs text-muted-foreground"><LoaderCircle className="h-3.5 w-3.5 animate-spin" /> Pixel đang suy nghĩ…</div>}
          </div>

          <form className="flex items-center gap-2 border-t border-border/70 p-3" onSubmit={(event) => { event.preventDefault(); void sendMessage(draft); }}>
            <Input aria-label="Tin nhắn cho Pixel" placeholder={(settings?.keys.length ?? 0) ? "Hỏi Pixel về danh mục…" : "Thêm API key trong Cài đặt"} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending || loadingConversation} />
            <Button type="submit" size="icon" aria-label="Gửi tin nhắn" disabled={!draft.trim() || sending}><Send /></Button>
          </form>

          {/* Resize handle — góc trên trái */}
          <div
            onPointerDown={startResizing}
            className="absolute left-0 top-0 z-[60] flex h-8 w-8 cursor-nwse-resize items-start justify-start p-1.5 opacity-50 transition-opacity hover:opacity-100"
            title="Kéo để đổi kích thước"
          >
            <Grip className="h-4 w-4 rotate-45" />
          </div>
        </section>
      )}


      <button
        type="button"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onMouseEnter={() => setIconHovered(true)}
        onMouseLeave={() => setIconHovered(false)}
        onClick={() => {
          if (ignoreTriggerClick.current) {
            ignoreTriggerClick.current = false;
            return;
          }
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          dismissNotification();

          const willOpen = !openRef.current;

          // Khi MỞ: icon luôn về góc dưới phải màn hình (gọi setPosition NGOÀI setOpen)
          if (willOpen) {
            const margin = 20;
            const iconX = Math.max(12, window.innerWidth - BUTTON_SIZE - margin);
            const iconY = Math.max(12, window.innerHeight - BUTTON_SIZE - margin);
            positionRef.current = { x: iconX, y: iconY };
            setPosition({ x: iconX, y: iconY });

            const maxH = Math.max(200, iconY - ICON_GAP - 12);
            const maxW = Math.max(300, iconX + BUTTON_SIZE - 12);
            if (targetPanelSize.current.height > maxH) {
              targetPanelSize.current.height = maxH;
              currentSize.current.height = maxH;
            }
            if (targetPanelSize.current.width > maxW) {
              targetPanelSize.current.width = maxW;
              currentSize.current.width = maxW;
            }
          }

          openRef.current = willOpen;
          setOpen(willOpen);
          setUnread(false);
          if (willOpen) {
            clearDockTimer(); // đang mở → không nép
          } else {
            resetDockTimer(); // đóng → sau 5s mới nép 10%
          }
        }}
        className={cn(
          "fixed grid h-16 w-16 touch-none place-items-center rounded-full border-0 bg-transparent p-0 text-primary shadow-none transition-transform hover:scale-105 hover:shadow-none",
          open ? "z-[140]" : "z-120",
          dragging && "scale-105 cursor-grabbing",
        )}
        style={{ left: position.x, top: position.y, background: "transparent", boxShadow: "none" }}
        aria-label={open ? "Đóng Pixel" : "Mở Pixel"}
        title="Kéo để di chuyển · Pixel"
      >
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-secondary text-secondary-foreground" aria-hidden="true">
          {unread ? <Sparkles className="h-3 w-3" /> : <Grip className="h-3 w-3" />}
        </span>
      </button>
      <BlackHoleIcon open={open} hovered={iconHovered} position={position} theme={theme} />
    </>
  );
}
