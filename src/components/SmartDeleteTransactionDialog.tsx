import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { formatViDate } from "@/engine/dates";
import { deleteTransaction, checkTxLinks } from "@/lib/api/portfolio";
import { askEditPin } from "@/lib/edit-pin";
import { usePortfolioMutation } from "@/lib/use-portfolio";
import type { Transaction } from "@/engine/types";
import { toast } from "sonner";

type LinkedTransaction = {
  id: string;
  txType: string;
  txDate: string;
  quantity: number | null;
  symbol: string | null;
};

export function SmartDeleteTransactionDialog({
  transaction,
  symbol,
  onClose,
}: {
  transaction: Transaction | null;
  symbol: string;
  onClose: () => void;
}) {
  const [linkedTransactions, setLinkedTransactions] = useState<LinkedTransaction[] | null>(null);
  const deleteMutation = usePortfolioMutation(
    (data: Parameters<typeof deleteTransaction>[0]) => deleteTransaction(data),
    "Đã chuyển lệnh vào thùng rác",
  );

  useEffect(() => {
    if (!transaction) {
      setLinkedTransactions(null);
      return;
    }

    let current = true;
    setLinkedTransactions(null);
    void checkTxLinks({ data: { id: transaction.id } })
      .then((result) => {
        if (current) setLinkedTransactions(result.linkedTransactions);
      })
      .catch((error: Error) => {
        if (current) {
          toast.error(error.message || "Không kiểm tra được lệnh khớp");
          onClose();
        }
      });
    return () => {
      current = false;
    };
  }, [transaction, onClose]);

  async function remove(cascade: boolean) {
    if (!transaction) return;
    const pin = await askEditPin();
    if (!pin) return;
    try {
      await deleteMutation.mutateAsync({ data: { id: transaction.id, pin, cascade } });
      onClose();
    } catch {
      // The mutation reports the server error through the shared toast handler.
    }
  }

  const txTypeLabel = transaction?.txType === "BUY" ? "MUA" : "BÁN";

  return (
    <Dialog open={!!transaction} onOpenChange={(open) => !open && onClose()}>
      <DialogContent title="Xóa giao dịch">
        {transaction && (
          <div className="space-y-4">
            <div>
              <p className="font-medium">
                {txTypeLabel} {symbol} · {formatViDate(transaction.txDate)}
              </p>
              <p className="text-sm text-muted-foreground">
                {linkedTransactions === null
                  ? "Đang kiểm tra các lệnh khớp..."
                  : linkedTransactions.length > 0
                    ? `Lệnh này đang khớp với ${linkedTransactions.length} lệnh khác:`
                    : "Lệnh này không có liên kết khớp."}
              </p>
            </div>

            {linkedTransactions && linkedTransactions.length > 0 && (
              <ul className="max-h-48 space-y-2 overflow-y-auto rounded-md border border-border p-3 text-sm">
                {linkedTransactions.map((linked) => (
                  <li key={linked.id}>
                    {linked.txType === "BUY" ? "MUA" : "BÁN"} {linked.symbol ?? "Lệnh"} · {formatViDate(linked.txDate)}
                    {linked.quantity != null ? ` · SL ${linked.quantity}` : ""}
                  </li>
                ))}
              </ul>
            )}

            <p className="text-sm text-muted-foreground">
              Xóa riêng sẽ hủy liên kết và chỉ đưa lệnh này vào thùng rác. Xóa cả cụm sẽ đưa toàn bộ lệnh khớp liên quan vào thùng rác.
            </p>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={deleteMutation.isPending}>
                Hủy
              </Button>
              <Button
                variant={linkedTransactions?.length ? "secondary" : "destructive"}
                onClick={() => void remove(false)}
                disabled={linkedTransactions === null || deleteMutation.isPending}
              >
                {linkedTransactions?.length ? "Xóa riêng lệnh này" : "Xóa lệnh"}
              </Button>
              {!!linkedTransactions?.length && (
                <Button
                  variant="destructive"
                  onClick={() => void remove(true)}
                  disabled={deleteMutation.isPending}
                >
                  Xóa cả cụm ({linkedTransactions.length + 1})
                </Button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}