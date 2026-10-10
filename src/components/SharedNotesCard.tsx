import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, LoaderCircle, Pin, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { deleteSharedNote, fetchSharedNotes, saveSharedNote, type SharedNote } from "@/lib/api/notes";
import { cn } from "@/lib/utils";

const NOTES_QUERY_KEY = ["shared-notes"] as const;

const NOTE_COLORS: { id: SharedNote["color"]; label: string; className: string }[] = [
  { id: "slate", label: "Xám", className: "bg-muted-foreground" },
  { id: "blue", label: "Xanh dương", className: "bg-sky-500" },
  { id: "amber", label: "Vàng", className: "bg-amber-500" },
  { id: "rose", label: "Hồng", className: "bg-rose-500" },
  { id: "green", label: "Xanh lá", className: "bg-emerald-500" },
  { id: "violet", label: "Tím", className: "bg-violet-500" },
];

type NoteDraft = SharedNote;

function relativeTime(value: string): string {
  const elapsed = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(elapsed) || elapsed < 0) return "vừa xong";
  if (elapsed < 60_000) return "vừa xong";
  if (elapsed < 60 * 60_000) return `${Math.floor(elapsed / 60_000)} phút trước`;
  if (elapsed < 24 * 60 * 60_000) return `${Math.floor(elapsed / (60 * 60_000))} giờ trước`;
  return new Intl.DateTimeFormat("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
}

export function SharedNotesCard({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [activeNote, setActiveNote] = useState<NoteDraft | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const draftRef = useRef<NoteDraft | null>(null);
  const saveQueue = useRef<Promise<void>>(Promise.resolve());

  const notesQuery = useQuery({
    queryKey: NOTES_QUERY_KEY,
    queryFn: fetchSharedNotes,
    enabled: open,
    refetchInterval: open ? 30_000 : false,
  });
  const notes = useMemo(() => notesQuery.data ?? [], [notesQuery.data]);
  const filteredNotes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("vi");
    if (!query) return notes;
    return notes.filter((note) => `${note.title}\n${note.content}`.toLocaleLowerCase("vi").includes(query));
  }, [notes, search]);

  useEffect(() => {
    if (open && !activeNote && notes.length > 0) {
      setActiveNote(notes[0]);
      draftRef.current = notes[0];
    }
  }, [activeNote, notes, open]);

  const scheduleSave = useCallback((snapshot: NoteDraft) => {
    setSaving(true);
    setSaveError(false);
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(async () => {
        try {
          const saved = await saveSharedNote({
            data: {
              id: snapshot.id,
              title: snapshot.title,
              content: snapshot.content,
              color: snapshot.color,
              pinned: snapshot.pinned,
            },
          });
          queryClient.setQueryData<SharedNote[]>(NOTES_QUERY_KEY, (current = []) => {
            const updated = current.filter((note) => note.id !== saved.id);
            return [saved, ...updated].sort((a, b) =>
              Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt),
            );
          });
          setSaveError(false);
          if (draftRef.current?.id === saved.id) {
            setActiveNote((current) => current?.id === saved.id
              ? { ...current, updatedAt: saved.updatedAt }
              : current);
            const latest = draftRef.current;
            if (
              latest.title === snapshot.title
              && latest.content === snapshot.content
              && latest.color === snapshot.color
              && latest.pinned === snapshot.pinned
            ) {
              setDirty(false);
            }
          }
        } catch (error) {
          setSaveError(true);
          toast.error(error instanceof Error ? error.message : "Không lưu được ghi chú");
        } finally {
          setSaving(false);
        }
      });
  }, [queryClient]);

  useEffect(() => {
    if (!open || !dirty || !activeNote) return;
    const timer = window.setTimeout(() => scheduleSave(activeNote), 650);
    return () => window.clearTimeout(timer);
  }, [activeNote, dirty, open, scheduleSave]);

  function updateDraft(update: Partial<NoteDraft>) {
    setActiveNote((current) => {
      if (!current) return current;
      const next = { ...current, ...update };
      draftRef.current = next;
      return next;
    });
    setDirty(true);
  }

  async function createNote() {
    if (dirty && activeNote) scheduleSave(activeNote);
    try {
      const created = await saveSharedNote({
        data: { title: "", content: "", color: "slate", pinned: false },
      });
      queryClient.setQueryData<SharedNote[]>(NOTES_QUERY_KEY, (current = []) => [created, ...current]);
      setActiveNote(created);
      draftRef.current = created;
      setDirty(false);
      setSaveError(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tạo được ghi chú");
    }
  }

  function selectNote(note: SharedNote) {
    if (dirty && activeNote) scheduleSave(activeNote);
    setActiveNote(note);
    draftRef.current = note;
    setDirty(false);
    setSaveError(false);
  }

  async function removeNote() {
    if (!activeNote) return;
    if (!window.confirm("Xóa ghi chú này vĩnh viễn? Tất cả tài khoản đều sẽ mất ghi chú.")) return;
    try {
      await deleteSharedNote({ data: { id: activeNote.id } });
      const remaining = notes.filter((note) => note.id !== activeNote.id);
      queryClient.setQueryData(NOTES_QUERY_KEY, remaining);
      const next = remaining[0] ?? null;
      setActiveNote(next);
      draftRef.current = next;
      setDirty(false);
      setSaveError(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không xóa được ghi chú");
    }
  }

  function closeCard(nextOpen: boolean) {
    if (!nextOpen && dirty && activeNote) scheduleSave(activeNote);
    onOpenChange(nextOpen);
  }

  const activeColor = NOTE_COLORS.find((color) => color.id === activeNote?.color);

  return (
    <Dialog open={open} onOpenChange={closeCard}>
      <DialogContent title="Ghi chú chung" className="max-w-5xl">
        <div className="grid h-[min(72dvh,680px)] min-h-[360px] -m-4 grid-cols-1 md:min-h-[480px] md:grid-cols-[270px_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col border-b border-border bg-muted/30 md:border-b-0 md:border-r">
            <div className="space-y-3 border-b border-border p-4">
              <Button type="button" className="w-full" onClick={() => void createNote()}>
                <Plus /> Ghi chú mới
              </Button>
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Tìm trong ghi chú…"
                  aria-label="Tìm ghi chú"
                  className="pl-9"
                />
              </label>
              <p className="text-[11px] text-muted-foreground">
                {notes.length} ghi chú · dùng chung cho mọi tài khoản
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {notesQuery.isPending && (
                <div className="flex items-center justify-center gap-2 py-8 text-xs text-muted-foreground">
                  <LoaderCircle className="h-4 w-4 animate-spin" /> Đang tải ghi chú…
                </div>
              )}
              {notesQuery.isError && (
                <p className="px-2 py-6 text-center text-xs text-loss">Không tải được ghi chú. Hãy đóng rồi mở lại.</p>
              )}
              {!notesQuery.isPending && !notesQuery.isError && filteredNotes.length === 0 && (
                <div className="px-3 py-8 text-center">
                  <FileText className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                  <p className="text-xs text-muted-foreground">{search ? "Không tìm thấy ghi chú phù hợp." : "Chưa có ghi chú nào."}</p>
                </div>
              )}
              {filteredNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => selectNote(note)}
                  className={cn(
                    "w-full rounded-lg border border-transparent px-3 py-2.5 text-left transition hover:bg-muted/70",
                    activeNote?.id === note.id && "border-border bg-card shadow-sm",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("h-2 w-2 shrink-0 rounded-full", NOTE_COLORS.find((color) => color.id === note.color)?.className)} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{note.title || "Ghi chú chưa đặt tên"}</span>
                    {note.pinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                  </span>
                  <span className="mt-1.5 block line-clamp-2 pl-4 text-xs leading-5 text-muted-foreground">
                    {note.content || "Chưa có nội dung"}
                  </span>
                  <span className="mt-1.5 block pl-4 text-[10px] text-muted-foreground">{relativeTime(note.updatedAt)}</span>
                </button>
              ))}
            </div>
          </aside>

          {activeNote ? (
            <section className="flex min-h-0 flex-col bg-card">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
                  <span className={cn("h-2 w-2 rounded-full", activeColor?.className)} />
                  {saving ? "Đang lưu…" : saveError ? "Lưu chưa thành công" : dirty ? "Đang soạn" : `Đã lưu · ${relativeTime(activeNote.updatedAt)}`}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => updateDraft({ pinned: !activeNote.pinned })}
                    aria-label={activeNote.pinned ? "Bỏ ghim ghi chú" : "Ghim ghi chú"}
                    title={activeNote.pinned ? "Bỏ ghim" : "Ghim lên đầu danh sách"}
                    className={activeNote.pinned ? "text-primary" : ""}
                  >
                    <Pin className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => void removeNote()} disabled={saving} aria-label="Xóa ghi chú" title="Xóa ghi chú">
                    <Trash2 className="h-4 w-4 text-loss" />
                  </Button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col px-5 pb-3 pt-4 md:px-8">
                <Input
                  value={activeNote.title}
                  onChange={(event) => updateDraft({ title: event.target.value })}
                  maxLength={160}
                  placeholder="Tiêu đề ghi chú"
                  aria-label="Tiêu đề ghi chú"
                  className="h-12 border-0 bg-transparent px-0 text-xl font-semibold shadow-none focus-visible:ring-0"
                />
                <div className="mt-2 flex items-center justify-between gap-2 border-b border-border/70 pb-3">
                  <div className="flex items-center gap-1.5" aria-label="Màu ghi chú">
                    {NOTE_COLORS.map((color) => (
                      <button
                        key={color.id}
                        type="button"
                        onClick={() => updateDraft({ color: color.id })}
                        className={cn(
                          "grid h-7 w-7 place-items-center rounded-full transition hover:bg-muted",
                          activeNote.color === color.id && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                        )}
                        aria-label={`Đổi màu ${color.label}`}
                        aria-pressed={activeNote.color === color.id}
                      >
                        <span className={cn("h-3 w-3 rounded-full", color.className)} />
                      </button>
                    ))}
                  </div>
                  <span className="text-[10px] tabular-nums text-muted-foreground">
                    {activeNote.content.length.toLocaleString("vi-VN")} / 50.000
                  </span>
                </div>
                <textarea
                  value={activeNote.content}
                  onChange={(event) => updateDraft({ content: event.target.value })}
                  maxLength={50_000}
                  placeholder="Bắt đầu viết…&#10;&#10;Ghi lại ý tưởng, kế hoạch và những điều cần nhớ."
                  aria-label="Nội dung ghi chú"
                  className="min-h-0 flex-1 resize-none bg-transparent py-4 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground/70"
                />
                <p className="border-t border-border/70 pt-2 text-[10px] text-muted-foreground">
                  Tự động lưu · Ghi chú hiển thị với mọi tài khoản
                </p>
              </div>
            </section>
          ) : (
            <section className="flex min-h-[240px] flex-col items-center justify-center gap-3 bg-card p-6 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold">Ghi lại điều quan trọng</p>
                <p className="mt-1 text-xs text-muted-foreground">Tạo ghi chú đầu tiên để bắt đầu.</p>
              </div>
              <Button type="button" size="sm" onClick={() => void createNote()}><Plus /> Tạo ghi chú</Button>
            </section>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
