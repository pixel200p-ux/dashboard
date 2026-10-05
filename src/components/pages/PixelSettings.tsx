import { useState } from "react";
import { Check, CircleAlert, CircleCheck, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { checkGeminiKey } from "@/lib/pixel-ai";
import { maskGeminiKey, usePixelStore, type GeminiKey } from "@/lib/pixel-store";

function KeyEditor({
  initialName,
  initialValue,
  onSave,
  onCancel,
  savingLabel,
}: {
  initialName: string;
  initialValue: string;
  onSave: (name: string, value: string) => void;
  onCancel: () => void;
  savingLabel: string;
}) {
  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialValue);

  return (
    <form
      className="grid gap-2 rounded-xl border border-border/70 bg-background/50 p-3 sm:grid-cols-[1fr_1.5fr_auto_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!name.trim() || !value.trim()) return;
        onSave(name.trim(), value.trim());
      }}
    >
      <Input aria-label="Tên API key" autoComplete="off" placeholder="Tên dễ nhớ" value={name} onChange={(event) => setName(event.target.value)} required />
      <Input aria-label="Gemini API key" autoComplete="new-password" placeholder="Dán Gemini API key" type="password" value={value} onChange={(event) => setValue(event.target.value)} required />
      <Button type="submit" size="sm" disabled={!name.trim() || !value.trim()}><Check /> {savingLabel}</Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Hủy" onClick={onCancel}><X /></Button>
    </form>
  );
}

function KeyRow({ item }: { item: GeminiKey }) {
  const updateKey = usePixelStore((state) => state.updateKey);
  const removeKey = usePixelStore((state) => state.removeKey);
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);

  async function testKey() {
    setChecking(true);
    try {
      const active = await checkGeminiKey(item.value);
      updateKey(item.id, { status: active ? "active" : "inactive", checkedAt: Date.now() });
      if (active) toast.success(`${item.name}: API key đang hoạt động`);
      else toast.error(`${item.name}: API key không hợp lệ hoặc không hoạt động`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể kiểm tra API key");
    } finally {
      setChecking(false);
    }
  }

  if (editing) {
    return (
      <KeyEditor
        initialName={item.name}
        initialValue={item.value}
        savingLabel="Lưu"
        onCancel={() => setEditing(false)}
        onSave={(name, value) => {
          updateKey(item.id, { name, value, status: "untested", checkedAt: null });
          setEditing(false);
        }}
      />
    );
  }

  const status = item.status === "active"
    ? { label: "Đang hoạt động", className: "text-profit", icon: <CircleCheck className="h-3.5 w-3.5" /> }
    : item.status === "inactive"
      ? { label: "Không hoạt động", className: "text-loss", icon: <CircleAlert className="h-3.5 w-3.5" /> }
      : { label: "Chưa kiểm tra", className: "text-muted-foreground", icon: <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> };

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-background/45 p-3 ${item.status === "active" ? "border-l-2 border-l-profit" : item.status === "inactive" ? "border-l-2 border-l-loss" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] ${status.className}`}>{status.icon}{status.label}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">{maskGeminiKey(item.value)}</p>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={checking} onClick={() => void testKey()}>
        {checking ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} Kiểm tra
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label={`Sửa ${item.name}`} onClick={() => setEditing(true)}><Pencil /></Button>
      <Button type="button" size="icon" variant="ghost" aria-label={`Xóa ${item.name}`} onClick={() => {
        if (window.confirm(`Xóa API key “${item.name}” khỏi trình duyệt này?`)) removeKey(item.id);
      }}><Trash2 className="text-destructive" /></Button>
    </div>
  );
}

export function PixelSettings() {
  const keys = usePixelStore((state) => state.keys);
  const addKey = usePixelStore((state) => state.addKey);
  const [adding, setAdding] = useState(false);

  return (
    <div className="grid gap-4">

      <CollapsibleCard
        title="Pixel · Gemini API keys"
        defaultOpen={false}
        className="settings-panel"
        headerAction={<Button type="button" size="sm" variant="outline" onClick={(event) => { event.stopPropagation(); setAdding((current) => !current); }}>{adding ? <X /> : <Plus />}{adding ? "Đóng" : "Thêm key"}</Button>}
      >
        <p className="mt-1 text-xs leading-5 text-muted-foreground">Key được lưu riêng trên trình duyệt này. Chỉ hiện 3 ký tự đầu/cuối; trạng thái màu xanh/đỏ phản ánh lần kiểm tra gần nhất. Khi chat, câu hỏi cùng số liệu danh mục và mã đang lưu sẽ được gửi tới Google Gemini bằng key của bạn.</p>
        <div className="mt-4 space-y-2">
          {adding && (
            <KeyEditor
              initialName={`Gemini ${keys.length + 1}`}
              initialValue=""
              savingLabel="Thêm"
              onCancel={() => setAdding(false)}
              onSave={(name, value) => {
                addKey(name, value);
                setAdding(false);
                toast.success("Đã thêm API key");
              }}
            />
          )}
          {keys.map((item) => <KeyRow key={item.id} item={item} />)}
          {keys.length === 0 && !adding && <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">Chưa có API key. Thêm key Gemini để trò chuyện với Pixel.</p>}
        </div>
      </CollapsibleCard>
    </div>
  );
}
