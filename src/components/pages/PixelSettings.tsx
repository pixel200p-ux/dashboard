import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, CircleAlert, CircleCheck, LoaderCircle, Pencil, Plus, Trash2, X } from "lucide-react";
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
  testAllPixelKeys,
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
  existingKeys?: PixelKeyMetadata[];
  onSave: (name: string, value: string | undefined, provider: PixelKeyProvider) => void;
  onCancel: () => void;
};

function suggestKeyName(provider: PixelKeyProvider, existingKeys: PixelKeyMetadata[]): string {
  const providerLabel = PIXEL_KEY_PROVIDERS.find((item) => item.value === provider)?.label ?? provider;
  const count = existingKeys.filter((k) => k.provider === provider).length;
  return `${providerLabel} ${count + 1}`;
}

function ProviderGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <section className="overflow-hidden rounded-xl border border-border/70">
      <button
        type="button"
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:bg-muted/50"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span>{label}</span>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && <div className="space-y-2 border-t border-border/70 p-3">{children}</div>}
    </section>
  );
}

function KeyEditor({
  initialName,
  initialValue,
  initialProvider,
  requireKey,
  savingLabel,
  existingKeys = [],
  onSave,
  onCancel,
}: KeyEditorProps) {
  const [name, setName] = useState(initialName);
  const [value, setValue] = useState(initialValue);
  const [provider, setProvider] = useState<PixelKeyProvider | "">(initialProvider);
  const needsKey = requireKey || (initialProvider !== "" && provider !== initialProvider);
  const canSave = Boolean(provider && name.trim() && (value.trim() || !needsKey));

  return (
    <form
      className="grid gap-3 rounded-xl border border-border/70 bg-background/50 p-3 sm:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1.4fr)_auto] sm:items-end"
      onSubmit={(event) => {
        event.preventDefault();
        if (!provider || !name.trim() || (needsKey && !value.trim())) return;
        onSave(name.trim(), value.trim() || undefined, provider);
      }}
    >
      <label className="grid gap-1 text-xs text-muted-foreground">
        Nhà cung cấp
        <Select
          value={provider}
          placeholder="Chọn nhà cung cấp"
          onValueChange={(next) => {
            if (isPixelKeyProvider(next)) {
              setProvider(next);
              setName(suggestKeyName(next, existingKeys));
            }
          }}
          options={PIXEL_KEY_PROVIDERS}
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        Tên
        <Input
          aria-label="Tên API key"
          autoComplete="off"
          placeholder="Tên dễ nhớ"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
        />
      </label>
      <label className="grid gap-1 text-xs text-muted-foreground">
        API key
        <Input
          aria-label={`${provider || "AI"} API key`}
          autoComplete="new-password"
          placeholder={provider ? (needsKey ? `Dán ${provider} API key` : "Để trống nếu giữ key hiện tại") : "Chọn nhà cung cấp trước"}
          type="password"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required={needsKey}
        />
      </label>
      <div className="flex h-10 items-center gap-1">
        <Button type="submit" disabled={!canSave}>
          <Check /> {savingLabel}
        </Button>
        <Button type="button" size="icon" variant="ghost" aria-label="Hủy" onClick={onCancel}>
          <X />
        </Button>
      </div>
    </form>
  );
}

function KeyRow({
  item,
  allKeys,
  onUpdate,
  onDelete,
}: {
  item: PixelKeyMetadata;
  allKeys: PixelKeyMetadata[];
  onUpdate: (id: string, name: string, value: string | undefined, provider: PixelKeyProvider) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const status = item.status === "active"
    ? { label: "Đang hoạt động", className: "text-profit", icon: <CircleCheck className="h-3.5 w-3.5" /> }
    : item.status === "inactive"
      ? { label: "Không hoạt động", className: "text-loss", icon: <CircleAlert className="h-3.5 w-3.5" /> }
      : { label: "Chưa kiểm tra", className: "text-muted-foreground", icon: <span className="h-2 w-2 rounded-full bg-muted-foreground/50" /> };

  if (editing) {
    return (
      <KeyEditor
        initialName={item.name}
        initialValue=""
        initialProvider={item.provider}
        requireKey={false}
        savingLabel="Lưu"
        existingKeys={allKeys}
        onCancel={() => setEditing(false)}
        onSave={(name, value, nextProvider) => {
          onUpdate(item.id, name, value, nextProvider);
          setEditing(false);
        }}
      />
    );
  }

  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2 ${item.status === "active" ? "border-l-2 border-l-profit" : item.status === "inactive" ? "border-l-2 border-l-loss" : ""}`}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-medium">{item.name}</span>
          <span className={`inline-flex items-center gap-1 text-[11px] ${status.className}`}>{status.icon}{status.label}</span>
        </div>
        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{item.hint}</p>
      </div>
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
  const [testingAll, setTestingAll] = useState(false);
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
          {editingSection === "api" ? (() => {
            const grouped = PIXEL_KEY_PROVIDERS.reduce<Record<string, PixelKeyMetadata[]>>((acc, p) => {
              const providerKeys = keys.filter((k) => k.provider === p.value);
              if (providerKeys.length > 0) acc[p.value] = providerKeys;
              return acc;
            }, {});
            return (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding((current) => !current)}>
                  {adding ? <X /> : <Plus />}{adding ? "Đóng" : "Thêm key"}
                </Button>
                {keys.length > 0 && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={testingAll}
                    onClick={async () => {
                      setTestingAll(true);
                      try {
                        const { results } = await testAllPixelKeys();
                        await qc.invalidateQueries({ queryKey: PIXEL_SETTINGS_QUERY_KEY });
                        const active = results.filter((r) => r.status === "active").length;
                        const inactive = results.filter((r) => r.status === "inactive").length;
                        const failed = results.filter((r) => r.status === null);
                        if (active === results.length) toast.success(`Tất cả ${active} key đều hoạt động`);
                        else {
                          const failedNames = failed.map((result) => {
                            const keyName = keys.find((key) => key.id === result.id)?.name ?? result.id;
                            return `${keyName}: ${result.error ?? "không xác định được nguyên nhân"}`;
                          });
                          toast.error(
                            `${active} hoạt động, ${inactive} không hoạt động, ${failed.length} chưa kiểm tra được`,
                            failedNames.length ? { description: failedNames.join(" · ") } : undefined,
                          );
                        }
                      } catch (error) {
                        toast.error(error instanceof Error ? error.message : "Không thể kiểm tra");
                      } finally {
                        setTestingAll(false);
                      }
                    }}
                  >
                    {testingAll ? <LoaderCircle className="animate-spin" /> : <CircleCheck />} Kiểm tra
                  </Button>
                )}
              </div>
              {adding && (
                <KeyEditor
                  initialName=""
                  initialValue=""
                  initialProvider=""
                  requireKey
                  savingLabel="Thêm"
                  existingKeys={keys}
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
              {Object.entries(grouped).map(([providerValue, providerKeys]) => {
                const providerLabel = PIXEL_KEY_PROVIDERS.find((p) => p.value === providerValue)?.label ?? providerValue;
                return (
                  <ProviderGroup key={providerValue} label={providerLabel}>
                    {providerKeys.map((item) => (
                      <KeyRow
                        key={item.id}
                        item={item}
                        allKeys={keys}
                        onUpdate={(id, name, value, provider) => saveKeyMut.mutate({ data: { id, name, key: value, provider } })}
                        onDelete={deleteKey}
                      />
                    ))}
                  </ProviderGroup>
                );
              })}
              {!isPending && keys.length === 0 && !adding && (
                <p className="rounded-xl border border-dashed border-border/70 px-4 py-6 text-center text-sm text-muted-foreground">
                  Chưa có key. Thêm Gemini/Groq/OpenRouter để chat và Tavily/Jina để Pixel tra cứu web khi cần.
                </p>
              )}
            </div>
            );
          })() : (
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