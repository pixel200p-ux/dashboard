import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { useUiStore } from "@/lib/ui-store";
import { usePortfolioMutation } from "@/lib/use-portfolio";
import { saveCapital, updateCapital } from "@/lib/api/portfolio";
import { formatUsd, parseDecimal, parseVndAmount, formatThousandsInput } from "@/engine/money";
import { todayYmd } from "@/engine/dates";
import type { CapitalBucket } from "@/engine/types";
import { useEffect, useState } from "react";
import { askEditPin } from "@/lib/edit-pin";
import { usePortfolio } from "@/lib/use-portfolio";

const BUCKETS: { value: CapitalBucket; label: string }[] = [
  { value: "DCDS", label: "DCDS" },
  { value: "ETF", label: "ETF" },
  { value: "VPS", label: "VPS" },
  { value: "SSI", label: "SSI" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "BANK", label: "Bank" },
];

export function CapitalDialog() {
  const kind = useUiStore((s) => s.capitalOpen);
  const edit = useUiStore((s) => s.capitalEdit);
  const close = useUiStore((s) => s.closeCapital);
  const openTx = useUiStore((s) => s.openTx);
  const { data } = usePortfolio();
  const [amount, setAmount] = useState("");
  const [fxRate, setFxRate] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [notes, setNotes] = useState("");
  const [bucket, setBucket] = useState<CapitalBucket | "">("");

  const isEdit = Boolean(edit?.id);
  const parsedFxRate = parseDecimal(fxRate);

  const createMut = usePortfolioMutation(
    (d: Parameters<typeof saveCapital>[0]) => saveCapital(d),
    "Đã ghi vốn gốc",
  );
  const updateMut = usePortfolioMutation(
    (d: Parameters<typeof updateCapital>[0]) => updateCapital(d),
    "Đã cập nhật vốn gốc",
  );
  const pending = createMut.isPending || updateMut.isPending;

  useEffect(() => {
    if (!kind) return;
    if (edit) {
      setAmount(String(Math.round(edit.amount)));
      setFxRate(edit.fxRate != null ? String(edit.fxRate) : String(data?.state.usdVnd ?? 25000));
      setDate(edit.movementDate);
      setNotes(edit.notes ?? "");
      setBucket(edit.bucket);
    } else {
      setAmount("");
      setFxRate(String(data?.state.usdVnd ?? 25000));
      setNotes("");
      setDate(todayYmd());
      setBucket("");
    }
  }, [kind, edit, data?.state.usdVnd]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!kind) return;
    const v = parseVndAmount(amount);
    if (v <= 0) return;

    if (!bucket) return;
    if (bucket === "CRYPTO" && parsedFxRate <= 0) return;
    if (isEdit && edit) {
      const pin = await askEditPin();
      if (!pin) return;
      updateMut.mutate(
        {
          data: {
            id: edit.id,
            pin,
            amount: v,
            fxRate: bucket === "CRYPTO" ? parsedFxRate : null,
            movementDate: date,
            notes: notes || undefined,
            bucket,
          },
        },
        { onSuccess: () => close() },
      );
      return;
    }

    createMut.mutate(
      { data: { kind, amount: v, fxRate: bucket === "CRYPTO" ? parsedFxRate : null, movementDate: date, notes: notes || undefined, bucket } },
      { onSuccess: () => close() },
    );
  }

  function selectBucket(next: CapitalBucket) {
    if (!isEdit && kind === "DEPOSIT" && (next === "DCDS" || next === "ETF" || next === "BANK")) {
      close();
      openTx({ formKind: next, assetType: next === "BANK" ? undefined : next, txType: "BUY", createOriginalDeposit: true });
      return;
    }
    setBucket(next);
    if (next === "CRYPTO" && !fxRate) setFxRate(String(data?.state.usdVnd ?? 25000));
  }

  const title = isEdit
    ? kind === "WITHDRAW"
      ? "Sửa rút vốn gốc"
      : "Sửa nạp vốn gốc"
    : kind === "WITHDRAW"
      ? "Rút vốn gốc"
      : "Nạp vốn gốc";

  return (
    <Dialog open={!!kind} onOpenChange={(o) => !o && close()}>
      <DialogContent title={title}>
        <form className="space-y-3" onSubmit={submit}>
          <p className="text-sm text-muted-foreground">
            Original Capital = tổng Original 6 ô. Chọn DCDS, ETF hoặc Bank để mở lệnh mua/mở sổ; hệ thống sẽ ghi thêm Original bằng đúng số tiền của lệnh đó.
            {isEdit ? " · Đang sửa: không đổi loại Nạp/Rút." : null}
          </p>
          <div className="space-y-1">
            <Label>Danh mục</Label>
            <Select value={bucket} onValueChange={(v) => selectBucket(v as CapitalBucket)} options={BUCKETS} placeholder="Chọn danh mục" />
          </div>
          <div className="space-y-1">
            <Label>Số tiền (VND)</Label>
            <Input
              value={amount}
              onChange={(e) => setAmount(formatThousandsInput(e.target.value))}
              placeholder="50,000,000"
              required
            />
          </div>
          {bucket === "CRYPTO" && (
            <>
              <div className="space-y-1">
                <Label>Tỷ giá (VND/USD)</Label>
                <Input
                  value={fxRate}
                  onChange={(e) => setFxRate(formatThousandsInput(e.target.value))}
                  placeholder="25,000"
                  required
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Tương đương {formatUsd(parsedFxRate > 0 ? parseVndAmount(amount) / parsedFxRate : 0)} · tỷ giá được lưu cùng giao dịch vốn gốc.
              </p>
            </>
          )}
          <div className="space-y-1">
            <Label>Ngày</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          </div>
          <div className="space-y-1">
            <Label>Ghi chú</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? "Đang lưu..." : "Lưu"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
