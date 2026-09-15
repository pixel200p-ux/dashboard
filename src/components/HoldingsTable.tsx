import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { HoldingView } from "@/engine/types";
import { displayMoney, displayPrice } from "@/lib/display";
import { formatPct, formatQty, signedClass } from "@/engine/money";
import { useUiStore } from "@/lib/ui-store";
import { Pencil } from "lucide-react";
import { setAssetPrice } from "@/lib/api/portfolio";
import { usePortfolioMutation } from "@/lib/use-portfolio";
import { parseBrokerPrice, parseDecimal } from "@/engine/money";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export function HoldingsTable({
  rows,
  usdVnd,
}: {
  rows: HoldingView[];
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
  const openTx = useUiStore((s) => s.openTx);
  const [editId, setEditId] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [sellTplus, setSellTplus] = useState<Record<string, boolean>>({});
  const mut = usePortfolioMutation((d: Parameters<typeof setAssetPrice>[0]) => setAssetPrice(d), "Đã cập nhật giá");

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có vị thế. Ghi giao dịch Buy để mở sổ.</p>;
  }

  return (
    <div className="table-scroll">
      <table className="w-full text-left text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2 font-medium">Mã</th>
            <th className="px-2 py-2 font-medium">Account</th>
            <th className="px-2 py-2 font-medium text-right">SL</th>
            <th className="px-2 py-2 font-medium text-right">Giá vốn</th>
            <th className="px-2 py-2 font-medium text-right">Giá TT</th>
            <th className="px-2 py-2 font-medium text-right">NAV</th>
            <th className="px-2 py-2 font-medium text-right">P&L</th>
            <th className="px-2 py-2" />
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.assetId} className="border-b border-border/70">
              <td className="px-2 py-2">
                <button
                  className="font-semibold hover:underline"
                  onClick={() =>
                    openTx({
                      accountId: h.accountId,
                      symbol: h.symbol,
                      name: h.name,
                      assetType: h.assetType,
                    })
                  }
                >
                  {h.symbol}
                </button>
                {h.openTplusQty > 0 && (
                  <Badge tone="navy" className="ml-1">
                    T+ {formatQty(h.openTplusQty, h.assetType)}
                  </Badge>
                )}
              </td>
              <td className="px-2 py-2 text-muted-foreground">{h.accountName}</td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">
                {formatQty(h.quantity, h.assetType)}
                {h.openTplusQty > 0 && (
                  <div className="text-[11px] text-muted-foreground">
                    {formatQty(h.coreQty, h.assetType)} gốc + {formatQty(h.openTplusQty, h.assetType)} T+
                  </div>
                )}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">
                {displayPrice(h.adjustedAvgCost, h.assetType, currency, usdVnd)}
                {h.tplusProfitCompleted > 0 && Math.abs(h.originalAvgCost - h.adjustedAvgCost) > 0.5 && (
                  <div className="text-[11px] text-muted-foreground">
                    gốc {displayPrice(h.originalAvgCost, h.assetType, currency, usdVnd)}
                  </div>
                )}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">
                {editId === h.assetId ? (
                  <form
                    className="flex justify-end gap-1"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const px = h.assetType === "CRYPTO" ? parseDecimal(editVal) : h.assetType === "DCDS" ? parseDecimal(editVal) : parseBrokerPrice(editVal);
                      mut.mutate({ data: { assetId: h.assetId, price: px } }, { onSuccess: () => setEditId(null) });
                    }}
                  >
                    <Input className="h-8 w-24" value={editVal} onChange={(e) => setEditVal(e.target.value)} autoFocus />
                  </form>
                ) : (
                  <button
                    className="inline-flex items-center gap-1 hover:underline"
                    onClick={() => {
                      setEditId(h.assetId);
                      setEditVal(
                        h.assetType === "CRYPTO" || h.assetType === "DCDS"
                          ? String(h.currentPrice)
                          : String(h.currentPrice / 1000),
                      );
                    }}
                  >
                    {displayPrice(h.currentPrice, h.assetType, currency, usdVnd)}
                    <Pencil className="h-3 w-3 opacity-50" />
                  </button>
                )}
              </td>
              <td className="px-2 py-2 text-right font-mono tabular-nums">{displayMoney(h.marketValue, currency, usdVnd)}</td>
              <td className={`px-2 py-2 text-right font-mono tabular-nums ${signedClass(h.unrealizedPnl)}`}>
                {displayMoney(h.unrealizedPnl, currency, usdVnd)}
                <div className="text-xs">{formatPct(h.costBasis ? (h.unrealizedPnl / h.costBasis) * 100 : 0)}</div>
              </td>
              <td className="px-2 py-2">
                <div className="flex justify-end gap-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openTx({
                        accountId: h.accountId,
                        symbol: h.symbol,
                        name: h.name,
                        assetType: h.assetType,
                        txType: "BUY",
                      })
                    }
                  >
                    Buy
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      openTx({
                        accountId: h.accountId,
                        symbol: h.symbol,
                        name: h.name,
                        assetType: h.assetType,
                        txType: "SELL",
                      })
                    }
                  >
                    Sell
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
