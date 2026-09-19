import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/lib/ui-store";
import { saveBank } from "@/lib/api/portfolio";
import { usePortfolio, usePortfolioMutation } from "@/lib/use-portfolio";
import { parseDecimal, parseVndAmount, formatThousandsInput } from "@/engine/money";
import { todayYmd } from "@/engine/dates";
import { useEffect, useState } from "react";

const BANKS = ["VietinBank", "Vietcombank", "MB", "Techcombank", "BIDV", "Agribank", "ACB", "VPBank", "TPBank", "Khác"];

export function BankDialog() {
  const open = useUiStore((s) => s.bankOpen);
  const editId = useUiStore((s) => s.bankEditId);
  const close = useUiStore((s) => s.closeBank);
  const { data } = usePortfolio();
  const [bankName, setBankName] = useState("VietinBank");
  const [custom, setCustom] = useState("");
  const [principal, setPrincipal] = useState("");
  const [startDate, setStartDate] = useState(todayYmd());
  const [term, setTerm] = useState("");
  const [rate, setRate] = useState("");
  const [rollover, setRollover] = useState(true);
    useEffect(() => {
    if (!open) return;
    if (editId && data) {
      const b = data.ledger.banks.find((x) => x.id === editId);
      if (!b) return;
      const known = BANKS.includes(b.bankName);
      setBankName(known ? b.bankName : "Khác");
      setCustom(known ? "" : b.bankName);
      setPrincipal(formatThousandsInput(String(Math.round(b.principal))));
      setStartDate(b.startDate);
      setTerm(String(b.termMonths));
      setRate(String(b.interestRate));
      setRollover(b.autoRollover);
      return;
    }
    setBankName("VietinBank");
    setCustom("");
    setPrincipal("");
    setStartDate(todayYmd());
    setTerm("");
    setRate("");
    setRollover(true);
  }, [open, editId, data]);
  const mut = usePortfolioMutation((d: Parameters<typeof saveBank>[0]) => saveBank(d), "Đã mở sổ tiết kiệm");
  

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const name = bankName === "Khác" ? custom.trim() : bankName;
    const p = parseVndAmount(principal);
    const parsedTerm = Number(term.trim());
    const parsedRate = parseDecimal(rate.trim());

    if (!name || p <= 0 || !term.trim() || !Number.isFinite(parsedTerm) || parsedTerm <= 0) return;
    if (!rate.trim() || !Number.isFinite(parsedRate) || parsedRate < 0) return;

    mut.mutate(
      {
        data: {
          id: editId ?? undefined,
          bankName: name,
          principal: p,
          startDate,
          termMonths: parsedTerm,
          interestRate: parsedRate,
          autoRollover: rollover,
        },
      },
      {
        onSuccess: () => {
          close();
          setPrincipal("");
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
        <DialogContent title={editId ? "Sửa sổ tiết kiệm" : "Mở sổ tiết kiệm"}>
        <form className="space-y-3" onSubmit={submit}>
          <p className="text-sm text-muted-foreground">
            Mô hình thuần tài sản: mở sổ không trừ tiền mặt. NAV cộng giá trị sổ đang hiệu lực.
          </p>
          <div className="space-y-1">
            <Label>Ngân hàng</Label>
            <div className="flex flex-wrap gap-1.5">
              {BANKS.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBankName(b)}
                  className={`min-h-10 rounded-full border px-3 text-xs ${bankName === b ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
                >
                  {b}
                </button>
              ))}
            </div>
            {bankName === "Khác" && (
              <Input className="mt-2" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Tên ngân hàng" />
            )}
          </div>
          <div className="space-y-1">
            <Label>Số tiền gửi (VND)</Label>
            <Input
              value={principal}
              onChange={(e) => setPrincipal(formatThousandsInput(e.target.value))}
              placeholder="..."
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Ngày gửi</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Kỳ hạn (tháng)</Label>
              <Input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="..." required />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Lãi suất (%/năm)</Label>
            <Input value={rate} onChange={(e) => setRate(e.target.value)} placeholder="..." required />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Label>Tự động tái tục</Label>
            <Switch checked={rollover} onCheckedChange={setRollover} />
          </div>
          <Button type="submit" className="w-full" disabled={mut.isPending}>
          {mut.isPending ? "Đang lưu..." : editId ? "Lưu sửa" : "Lưu sổ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
