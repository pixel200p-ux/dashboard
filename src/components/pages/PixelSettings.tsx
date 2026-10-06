import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, CircleAlert, CircleCheck, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CollapsibleCard } from "@/components/ui/card";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  deletePixelKey,
  fetchPixelSettings,
  PIXEL_SETTINGS_QUERY_KEY,
  savePixelKey,
  savePixelPreferences,
  testPixelKey,
  type PixelKeyMetadata,
  type PixelSettingsPayload,
} from "@/lib/api/pixel";
import { verifyEditPinFn } from "@/lib/api/profile";
import { askEditPin } from "@/lib/edit-pin";
import { PIXEL_KEY_PROVIDERS, usePixelStore, type PixelKeyProvider } from "@/lib/pixel-store";
import { useProfile } from "@/lib/use-profile";

function isPixelKeyProvider(value: string): value is PixelKeyProvider {
  return PIXEL_KEY_PROVIDERS.some((item) => item.value === value);
}

type KeyEditorProps = {
  initialName: string;
  initialValue: string;
  initialProvider: PixelKeyProvider | "";
  requireKey: boolean;
  savingLabel: string;
  onSave: (name: string, value: string | undefined, provider: PixelKeyProvider) => void;
  onCancel: () => void;
};

function KeyEditor({
  initialName,
  initialValue,
  initialProvider,
  requireKey,
  savingLabel,
  onSave,
  onCancel,
}: KeyEditorProps) {
  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialValue);
  const [provider, setProvider] = useState<PixelKeyProvider | "">(initialProvider);
  const canSave = Boolean(provider && name.trim() && (value.trim() || !requireKey));

  return (
    <form
      className="grid gap-2 rounded-xl border border-border/70 bg-background/50 p-3 sm:grid-cols-[1fr_1.2fr_1.5fr_auto_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        if (!provider || !name.trim() || (requireKey && !value.trim())) return;
        onSave(name.trim(), value.trim() || undefined, provider);
      }}
    >
      <label className="space-y-1 text-xs text-muted-foreground">
        Nhà cung cấp
        <Select
          value={provider}
          placeholder="Chọn nhà cung cấp"
          onValueChange={(next) => {
            if (isPixelKeyProvider(next)) setProvider(next);
          }}
          options={PIXEL_KEY_PROVIDERS}
        />
      </label>
      <Input
        aria-label="Tên API key"
        autoComplete="off"
        placeholder="Tên dễ nhớ"
        value={name}
        onChange={(event) => setName(event.target.value)}
        required
      />
      <Input
        aria-label={`${provider || "AI"} API key`}
        autoComplete="new-password"
        placeholder={provider ? (requireKey ? `Dán ${provider} API key` : "Để trống nếu giữ key hiện tại") : "Chọn nhà cung cấp trước"}
        type="password"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        required={requireKey}
      />
      <Button type="submit" size="sm" disabled={!canSave}>
        <Check /> {savingLabel}
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label="Hủy" onClick={onCancel}>
        <X />
      </Button>
    </form>
  );
}

function KeyRow({
  item,
  onUpdate,
  onDelete,
  onTest,
}: {
  item: PixelKeyMetadata;
  onUpdate: (id: string, name: string, value: string | undefined, provider: PixelKeyProvider) => void;
  onDelete: (id: string) => void;
  onTest: (id: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [checking, setChecking] = useState(false);
  const status = item.status === "active"
    ? { label: "Đang hoạt động", className: "text-profit", icon: <CircleCheck className="h-3.5 w-3.5" /> }
    : item.status === "inactive"
      ? { label: "Không hoạt động", className: "text-loss", icon: <CircleAlert className="h-3.5 w-3.5" /> }
      : { label: "Chưa kiểm tra", className: "text-muted-foreground", icon: <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> };
  const provider = PIXEL_KEY_PROVIDERS.find((option) => option.value === item.provider)?.label ?? item.provider;

  if (editing) {
    return (
      <KeyEditor
        initialName={item.name}
        initialValue=""
        initialProvider={item.provider}
        requireKey={false}
        savingLabel="Lưu"
        onCancel={() => setEditing(false)}
        onSave={(name, value, nextProvider) => {
          onUpdate(item.id, name, value, nextProvider);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border/70 bg-background/45 p-3 ${item.status === "active" ? "border-l-2 border-l-profit" : item.status === "inactive" ? "border-l-2 border-l-loss" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium">{provider}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] ${status.className}`}>{status.icon}{status.label}</span>
        </div>
        <p className="mt-1 font-mono text-xs text-muted-foreground">•••••••• · API key đã mã hóa</p>
      </div>
      <Button type="button" size="sm" variant="outline" disabled={checking} onClick={() => {
        setChecking(true);
        void onTest(item.id).finally(() => setChecking(false));
      }}>
        {checking ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} Kiểm tra
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label={`Sửa ${item.name}`} onClick={() => setEditing(true)}>
        <Pencil />
      </Button>
      <Button type="button" size="icon" variant="ghost" aria-label={`Xóa ${item.name}`} onClick={() => onDelete(item.id)}>
        <Trash2 className="text-destructive" />
      </Button>
    </div>
  );
}

export function PixelSettings() {
  const qc = useQueryClient();
  const { data: profile } = useProfile();
  const { data, isPending } = useQuery({
    queryKey: PIXEL_SETTINGS_QUERY_KEY,
    queryFn: () => fetchPixelSettings(),
    refetchInterval: 10_000,
  });
  const legacyKeys = usePixelStore((state) => state.keys);
  const removeLegacyKey = usePixelStore((state) => state.removeKey);
  const migrationStarted = useRef(false);
  const [mandatoryRules, setMandatoryRules] = useState("");
  const [memories, setMemories] = useState("");
  const [preferenceStatus, setPreferenceStatus] = useState<"saved" | "saving" | "error">("saved");
  const [adding, setAdding] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [editingSection, setEditingSection] = useState<"api" | "rules" | null>(null);
  const saveKeyMut = useMutation({
    mutationFn: (input: Parameters<typeof savePixelKey>[0]) => savePixelKey(input),
    onSuccess: (key) => {
      qc.setQueryData<PixelSettingsPayload>(PIXEL_SETTINGS_QUERY_KEY, (current) => current
        ? { ...current, keys: [...current.keys.filter((item) => item.id !== key.id), key] }
        : current);
    },
    onError: (error: Error) => toast.error(error.message || "Không lưu được API key"),
  });
  const saveLegacyKey = saveKeyMut.mutateAsync;
  const deleteKeyMut = useMutation({
    mutationFn: (input: Parameters<typeof deletePixelKey>[0]) => deletePixelKey(input),
    onSuccess: (_result, input) => {
      qc.setQueryData<PixelSettingsPayload>(PIXEL_SETTINGS_QUERY_KEY, (current) => current
        ? { ...current, keys: current.keys.filter((item) => item.id !== input.data.id) }
        : current);
      toast.success("Đã xóa API key");
    },
    onError: (error: Error) => toast.error(error.message || "Không xóa được API key"),
  });
  const savePrefMut = useMutation({
    mutationFn: (input: Parameters<typeof savePixelPreferences>[0]) => savePixelPreferences(input),
    onSuccess: (updated) => {
      qc.setQueryData(PIXEL_SETTINGS_QUERY_KEY, updated);
      setPreferenceStatus("saved");
      toast.success("Đã lưu quy tắc Pixel");
    },
    onError: (error: Error) => {
      setPreferenceStatus("error");
      toast.error(error.message || "Không lưu được quy tắc Pixel");
    },
  });

  useEffect(() => {
    if (!data) return;
    setMandatoryRules(data.mandatoryRules);
    setMemories(data.memories);
  }, [data]);

  useEffect(() => {
    if (!data || migrationStarted.current || legacyKeys.length === 0) return;
    migrationStarted.current = true;
    void (async () => {
      let moved = 0;
      for (const legacy of legacyKeys) {
        try {
          await saveLegacyKey({
            data: {
              provider: legacy.provider ?? "gemini",
              name: legacy.name,
              key: legacy.value,
            },
          });
          removeLegacyKey(legacy.id);
          moved += 1;
        } catch (error) {
          toast.error(error instanceof Error ? error.message : "Không thể đồng bộ API key cũ");
          break;
        }
      }
      if (moved > 0) toast.success(`Đã mã hóa và đồng bộ ${moved} API key cũ`);
    })();
  }, [data, legacyKeys, removeLegacyKey, saveLegacyKey]);

  async function testKey(id: string) {
    try {
      const result = await testPixelKey({ data: { id } });
      await qc.invalidateQueries({ queryKey: PIXEL_SETTINGS_QUERY_KEY });
      if (result.status === "active") toast.success("API key đang hoạt động");
      else toast.error("API key không hợp lệ hoặc không hoạt động");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không thể kiểm tra API key");
    }
  }

  function deleteKey(id: string) {
    if (!window.confirm("Xóa vĩnh viễn API key dùng chung này? Các tài khoản khác cũng sẽ mất key này.")) return;
    deleteKeyMut.mutate({ data: { id } });
  }

  async function openSection(section: "api" | "rules") {
    if (!unlocked) {
      if (!profile?.hasEditPin) {
        toast.error("Hãy tạo mã bảo vệ ở mục Mã bảo vệ trước");
        return;
      }
      const pin = await askEditPin();
      if (!pin) return;
      try {
        const result = await verifyEditPinFn({ data: { pin } });
        if (!result.valid) {
          toast.error("Mã bảo vệ không đúng");
          return;
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Không xác minh được mã bảo vệ");
        return;
      }
      setUnlocked(true);
    }
    setEditingSection(section);
  }

  function closeEditor() {
    setEditingSection(null);
    setAdding(false);
  }

  const keys = data?.keys ?? [];

  return (
    <div className="grid gap-4">
      <CollapsibleCard title="Pixel Assistant" defaultOpen={false} className="settings-panel">
        <div className="divide-y divide-border/70">
          <div className="flex flex-wrap items-end justify-between gap-3 py-4 first:pt-1">
            <div className="min-w-0">
              <p className="text-sm font-semibold">API</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {isPending
                  ? "Đang tải…"
                  : keys.length > 0
                    ? `${keys.length} API key đã lưu`
                    : "Chưa có API key"}
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => void openSection("api")}>
              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
            </Button>
          </div>
          <div className="flex flex-wrap items-end justify-between gap-3 py-4 last:pb-1">
            <div className="min-w-0">
              <p className="text-sm font-semibold">Quy tắc</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Quy tắc bắt buộc và thông tin lưu trữ
              </p>
            </div>
            <Button type="button" size="sm" onClick={() => void openSection("rules")}>
              <Pencil className="h-3.5 w-3.5" /> Chỉnh sửa
            </Button>
          </div>
        </div>
      </CollapsibleCard>

      <Dialog
        open={editingSection !== null}
        onOpenChange={(open) => {
          if (!open) closeEditor();
        }}
      >
        <DialogContent
          title={editingSection === "api" ? "API" : "Quy tắc"}
          className="max-w-3xl"
        >
          {editingSection === "api" ? (
            <div className="space-y-3">
              <div className="flex justify-end">
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding((current) => !current)}>
                  {adding ? <X /> : <Plus />}{adding ? "Đóng" : "Thêm key"}
                </Button>
              </div>
              {adding && (
                <KeyEditor
                  initialName={`AI ${keys.length + 1}`}
                  initialValue=""
                  initialProvider=""
                  requireKey
                  savingLabel="Thêm"
                  onCancel={() => setAdding(false)}
                  onSave={(name, value, provider) => {
                    if (!value) return;
                    saveKeyMut.mutate(
                      { data: { provider, name, key: value } },
                      { onSuccess: () => { setAdding(false); toast.success("Đã mã hóa và chia sẻ API key cho các tài khoản"); } },
                    );
                  }}
                />
              )}
              {isPending && <p className="text-sm text-muted-foreground">Đang tải API key…</p>}
              {keys.map((item) => (
                <KeyRow
                  key={item.id}
                  item={item}
                  onUpdate={(id, name, value, provider) => saveKeyMut.mutate({ data: { id, name, key: value, provider } })}
                  onDelete={deleteKey}
                  onTest={testKey}
                />
              ))}
              {!isPending && keys.length === 0 && !adding && (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                  Chưa có key. Thêm Gemini/Groq/OpenRouter để chat và Tavily/Jina để Pixel tra cứu web khi cần.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-medium">Quy tắc bắt buộc</span>
                <span className="block text-xs text-muted-foreground">Gửi kèm mỗi lần hỏi Pixel</span>
                <textarea
                  value={mandatoryRules}
                  onChange={(event) => {
                    setMandatoryRules(event.target.value);
                    setPreferenceStatus("saved");
                  }}
                  maxLength={12000}
                  rows={5}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Ví dụ: Trả lời bằng tiếng Việt, nêu rõ khi thiếu dữ liệu…"
                />
              </label>
              <label className="block space-y-2">
                <span className="text-sm font-medium">Thông tin lưu trữ</span>
                <span className="block text-xs text-muted-foreground">Pixel dùng khi câu hỏi liên quan hoặc bạn hỏi về ghi nhớ</span>
                <textarea
                  value={memories}
                  onChange={(event) => {
                    setMemories(event.target.value);
                    setPreferenceStatus("saved");
                  }}
                  maxLength={12000}
                  rows={5}
                  className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Thông tin bạn muốn Pixel ghi nhớ…"
                />
              </label>
              <div className="flex items-center justify-end gap-2">
                <p className="mr-auto text-xs text-muted-foreground" aria-live="polite">
                  {preferenceStatus === "saving" ? "Đang lưu…" : preferenceStatus === "error" ? "Chưa lưu được" : "Có thể lưu lại"}
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={savePrefMut.isPending}
                  onClick={() => {
                    setPreferenceStatus("saving");
                    savePrefMut.mutate({ data: { mandatoryRules, memories } });
                  }}
                >
                  {savePrefMut.isPending ? <LoaderCircle className="animate-spin" /> : <Check />} Lưu
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}