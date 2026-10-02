import { useCallback, useEffect, useRef, useState, type PointerEvent } from "react";
import { Bot, Grip, LoaderCircle, MessageCircle, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { PortfolioPayload } from "@/lib/api/portfolio";
import { askGemini } from "@/lib/pixel-ai";
import { usePixelStore } from "@/lib/pixel-store";
import { useUiStore, type LoginThemeId, type ThemeMode } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

type PixelMessage = {
  id: string;
  role: "pixel" | "user";
  text: string;
  choices?: string[];
  quizAnswer?: number;
  quizExplanation?: string;
  selectedChoice?: number;
};

type Position = { x: number; y: number };
const BUTTON_SIZE = 64;
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

export function PixelAssistant({ portfolio }: { portfolio: PortfolioPayload | undefined }) {
  const keys = usePixelStore((state) => state.keys);
  const updateKey = usePixelStore((state) => state.updateKey);
  const setTheme = useUiStore((state) => state.setTheme);
  const setLoginTheme = useUiStore((state) => state.setLoginTheme);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<PixelMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [unread, setUnread] = useState(false);
  const [notification, setNotification] = useState<PixelMessage | null>(null);
  const openRef = useRef(open);
  const dockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notificationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragOrigin = useRef<{ x: number; y: number; pointerX: number; pointerY: number } | null>(null);
  const dragged = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const nav = portfolio?.state.nav ?? 0;
  const pnl = portfolio?.state.totalPnl ?? 0;
  const returnPct = portfolio?.state.totalReturnPct ?? 0;
  const allocation = Object.entries(portfolio?.state.allocation ?? {})
    .sort(([, a], [, b]) => b.pct - a.pct)
    .slice(0, 3)
    .map(([name, value]) => `${name}: ${value.pct.toFixed(0)}%`)
    .join(" · ");
  const portfolioSummary = portfolio
    ? `${formatCurrency(nav)} giá trị tài sản; ${pnl >= 0 ? "lãi" : "lỗ"} ${formatCurrency(Math.abs(pnl))}; lợi nhuận ${returnPct >= 0 ? "+" : ""}${returnPct.toFixed(1)}%; phân bổ ${allocation || "chưa có dữ liệu"}.`
    : "Danh mục đang tải dữ liệu.";
  const assetSummary = (portfolio?.ledger.assets ?? [])
    .slice(0, 12)
    .map((asset) => `${asset.symbol}: ${asset.currentPrice == null ? "chưa có giá" : asset.currentPrice.toLocaleString("vi-VN")} ${asset.currency}`)
    .join("; ");

  const dismissNotification = useCallback(() => {
    if (notificationTimer.current) clearTimeout(notificationTimer.current);
    notificationTimer.current = null;
    setNotification(null);
  }, []);

  const addPixelMessage = useCallback((text: string, options: Pick<PixelMessage, "choices" | "quizAnswer" | "quizExplanation"> = {}) => {
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
    if (messages.length > 0) return;
    addPixelMessage(
      keys.length
        ? "Chào bạn, mình là Pixel. Mình có thể tóm tắt danh mục, giải thích rủi ro hoặc cùng bạn làm một câu đố nhỏ."
        : "Chào bạn, mình là Pixel. Thêm Gemini API key trong Cài đặt để mình trò chuyện và phân tích danh mục nhé.",
      { choices: ["Tóm tắt danh mục", "Cập nhật các mã", "Đố vui tài chính"] },
    );
  }, [addPixelMessage, keys.length, messages.length]);

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

  function resetDockTimer() {
    if (dockTimer.current) clearTimeout(dockTimer.current);
    dockTimer.current = setTimeout(() => {
      setPosition((current) => {
        const maxX = Math.max(0, window.innerWidth - BUTTON_SIZE);
        return {
          x: current.x + BUTTON_SIZE / 2 < window.innerWidth / 2 ? -BUTTON_SIZE / 2 : maxX + BUTTON_SIZE / 2,
          y: Math.min(Math.max(current.y, 16), window.innerHeight - BUTTON_SIZE - 16),
        };
      });
    }, 5000);
  }

  useEffect(() => {
    resetDockTimer();
    return () => {
      if (dockTimer.current) clearTimeout(dockTimer.current);
      if (notificationTimer.current) clearTimeout(notificationTimer.current);
    };
  }, []);

  function beginDrag(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragOrigin.current = { x: position.x, y: position.y, pointerX: event.clientX, pointerY: event.clientY };
    dragged.current = false;
    setDragging(true);
    if (dockTimer.current) clearTimeout(dockTimer.current);
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
      addPixelMessage(`Đã chuyển giao diện sang chế độ ${themeCommand.label}.`, { choices: ["Đổi sang sáng", "Đổi sang tối"] });
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
      addPixelMessage(`Đã chuyển phong cảnh giao diện sang mùa ${seasonCommand.label}.`, { choices: ["Mùa xuân", "Mùa hạ", "Mùa thu", "Mùa đông"] });
      return;
    }

    if (/^(đố vui|đố vui tài chính|đố vui tiếp)$/i.test(prompt)) {
      const quiz = quizMessage();
      addPixelMessage(quiz.text, { choices: quiz.choices, quizAnswer: quiz.quizAnswer, quizExplanation: quiz.quizExplanation });
      return;
    }

    setSending(true);
    try {
      const answer = await askGemini(
        keys,
        prompt,
        portfolioSummary,
        assetSummary,
        (keyId, active) => updateKey(keyId, { status: active ? "active" : "inactive", checkedAt: Date.now() }),
      );
      addPixelMessage(answer, { choices: ["Hỏi thêm", "Đố vui tài chính"] });
    } catch (error) {
      const text = error instanceof Error ? error.message : "Không gửi được yêu cầu tới Gemini.";
      addPixelMessage(`Mình chưa kết nối được Gemini: ${text}`, { choices: ["Thử lại", "Đố vui tài chính"] });
    } finally {
      setSending(false);
    }
  }

  function choose(message: PixelMessage, index: number, choice: string) {
    if (message.quizAnswer !== undefined) {
      if (message.selectedChoice !== undefined) return;
      setMessages((current) => current.map((item) => item.id === message.id ? { ...item, selectedChoice: index } : item));
      const correct = index === message.quizAnswer;
      addPixelMessage(`${correct ? "Chính xác!" : "Chưa đúng rồi."} ${message.quizExplanation ?? ""}`, { choices: ["Đố vui tiếp", "Tóm tắt danh mục"] });
      return;
    }
    void sendMessage(choice === "Hỏi thêm" ? "Hãy giải thích thêm về nội dung vừa trả lời." : choice);
  }

  const onLeft = position.x + BUTTON_SIZE / 2 < viewport.width / 2;
  const panelTop = Math.min(Math.max(position.y - 380, 12), Math.max(12, viewport.height - 460));
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
            className="w-full rounded-2xl border border-border/80 bg-card p-3 text-left text-card-foreground shadow-[0_10px_32px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_36px_rgba(15,23,42,0.24)]"
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
            className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
            onClick={dismissNotification}
            aria-label="Đóng thông báo Pixel"
          ><X className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {open && (
        <section
          className="fixed z-120 flex max-h-[min(460px,calc(100dvh-24px))] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-border/80 bg-card text-card-foreground shadow-[0_16px_48px_rgba(15,23,42,0.22)]"
          style={{ top: panelTop, ...(onLeft ? { left: 12 } : { right: 12 }) }}
          onPointerDown={resetDockTimer}
          aria-label="Trò chuyện với Pixel"
        >
          <header className="flex items-center justify-between border-b border-border/70 px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Bot className="h-5 w-5" /></span>
              <div><p className="text-sm font-semibold">Pixel</p><p className="text-[11px] text-muted-foreground">Trợ lý danh mục của bạn</p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Đóng Pixel"><X className="h-4 w-4" /></button>
          </header>

          <div ref={scrollRef} className="min-h-48 flex-1 space-y-3 overflow-y-auto p-3" aria-live="polite">
            {messages.map((message) => (
              <div key={message.id} className={cn("flex", message.role === "user" ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[92%] rounded-2xl px-3 py-2", message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted/70")}>
                  <p className="whitespace-pre-wrap text-sm leading-5">{message.text}</p>
                  {message.choices && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {message.choices.map((choice, index) => (
                        <button
                          key={choice}
                          type="button"
                          disabled={sending || (message.quizAnswer !== undefined && message.selectedChoice !== undefined)}
                          onClick={() => choose(message, index, choice)}
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
            <Input aria-label="Tin nhắn cho Pixel" placeholder={keys.length ? "Hỏi Pixel về danh mục…" : "Thêm API key trong Cài đặt"} value={draft} onChange={(event) => setDraft(event.target.value)} disabled={sending} />
            <Button type="submit" size="icon" aria-label="Gửi tin nhắn" disabled={!draft.trim() || sending}><Send /></Button>
          </form>
        </section>
      )}

      <button
        type="button"
        onPointerDown={beginDrag}
        onPointerMove={moveDrag}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          dismissNotification();
          setOpen((current) => {
            openRef.current = !current;
            return !current;
          });
          setUnread(false);
          resetDockTimer();
        }}
        className={cn(
          "fixed z-120 grid h-16 w-16 touch-none place-items-center rounded-full border border-border bg-card/95 text-primary shadow-[0_6px_22px_rgba(15,23,42,0.18)] backdrop-blur transition-[transform,box-shadow] hover:scale-105 hover:shadow-[0_8px_28px_rgba(15,23,42,0.24)]",
          dragging && "scale-105 cursor-grabbing",
        )}
        style={{ left: position.x, top: position.y }}
        aria-label={open ? "Đóng Pixel" : "Mở Pixel"}
        title="Kéo để di chuyển · Pixel"
      >
        <span className="absolute inset-1 rounded-full border border-primary/10" aria-hidden="true" />
        {open ? <MessageCircle className="relative h-6 w-6" /> : <Bot className="relative h-7 w-7" />}
        <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full border-2 border-card bg-secondary text-secondary-foreground" aria-hidden="true">
          {unread ? <Sparkles className="h-3 w-3" /> : <Grip className="h-3 w-3" />}
        </span>
      </button>
    </>
  );
}
