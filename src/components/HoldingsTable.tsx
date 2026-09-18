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
import { cn } from "@/lib/utils";

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
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const mut = usePortfolioMutation((d: Parameters<typeof setAssetPrice>[0]) => setAssetPrice(d), "Đã cập nhật giá");

  if (rows.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Chưa có vị thế. Ghi giao dịch Buy để mở sổ.</p>;
  }

  const hasBrokerGroups = rows.some((h) => h.accountId === "vps" || h.accountId === "ssi");
  const groups = hasBrokerGroups
    ? [
        { key: "vps", label: "VPS", rows: rows.filter((h) => h.accountId === "vps") },
        { key: "ssi", label: "SSI", rows: rows.filter((h) => h.accountId === "ssi") },
      ].filter((group) => group.rows.length > 0)
    : [{ key: "all", label: rows[0]?.accountName?.toUpperCase() || "CRYPTO", rows }];

  return (
    <div className="space-y-8">
      {groups.map((group) => {
        const isCollapsed = collapsed[group.key] ?? false;
        const panelTone = "border-[#789ACA] bg-[#789ACA]/12 dark:border-[#2b3d5b] dark:bg-[#2b3d5b]/70";

        return (
          <div key={group.key} className={cn(`space-y-3 rounded-xl border p-3 shadow-sm ${panelTone}`, "sm:p-3.5")}>
            <div
              className="flex cursor-pointer items-center justify-between gap-2 text-base font-bold uppercase tracking-[0.16em] text-[#0F172A] dark:text-white"
              onDoubleClick={() => setCollapsed((prev) => ({ ...prev, [group.key]: !isCollapsed }))}
            >
              <span>{group.label}</span>
              <span className="text-[10px] font-medium tracking-[0.14em] text-muted-foreground">
                {group.rows.length} mã
              </span>
            </div>

            {!isCollapsed && (
              <div className="table-scroll">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[11px] uppercase text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="px-2 py-2 font-medium">Mã</th>
                      <th className="px-2 py-2 font-medium text-right">SL</th>
                      <th className="px-2 py-2 font-medium text-right">Giá vốn</th>
                      <th className="px-2 py-2 font-medium text-right">Giá TT</th>
                      <th className="px-2 py-2 font-medium text-right">NAV</th>
                      <th className="px-2 py-2 font-medium text-right">P&L</th>
                      <th className="px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {group.rows.map((h) => (
                      <tr key={h.assetId} className="border-b border-border/70">
                        <td className="px-2 py-1.5">
                          <button
                            className="text-[12px] font-semibold hover:underline"
                            onClick={() =>
                              openTx({
                                accountId: h.accountId,
                                symbol: h.symbol,
                                name: h.name,
                                assetType: h.assetType,
                              })
                            }
                          >
                            <span className="relative inline-block pl-2.5">
                              {h.openLots.length > 0 ? (
                                <span className="absolute left-0 top-0 -translate-y-0.5 text-[10px] font-semibold leading-none text-primary">
                                  {h.openLots.length}
                                </span>
                              ) : null}
                              {h.symbol}
                            </span>
                          </button>
                          {h.openTplusQty > 0 && (
                            <Badge tone="navy" className="ml-1">
                              T+ {formatQty(h.openTplusQty, h.assetType)}
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[12px]">
                          {formatQty(h.quantity, h.assetType)}
                          {h.openTplusQty > 0 && (
                            <div className="text-[10px] text-muted-foreground">
                              {formatQty(h.coreQty, h.assetType)} gốc + {formatQty(h.openTplusQty, h.assetType)} T+
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[12px]">
                          {displayPrice(h.adjustedAvgCost, h.assetType, currency, usdVnd)}
                          {h.tplusProfitCompleted > 0 && Math.abs(h.originalAvgCost - h.adjustedAvgCost) > 0.5 && (
                            <div className="text-[10px] text-muted-foreground">
                              gốc {displayPrice(h.originalAvgCost, h.assetType, currency, usdVnd)}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[12px]">
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
                        <td className="px-2 py-1.5 text-right font-mono tabular-nums text-[12px]">{displayMoney(h.marketValue, currency, usdVnd)}</td>
                        <td className={`px-2 py-1.5 text-right font-mono tabular-nums text-[12px] ${signedClass(h.unrealizedPnl)}`}>
                          {displayMoney(h.unrealizedPnl, currency, usdVnd)}
                          <div className="text-[10px]">{formatPct(h.costBasis ? (h.unrealizedPnl / h.costBasis) * 100 : 0)}</div>
                        </td>
                        <td className="px-2 py-1.5">
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
            )}
          </div>
        );
      })}
    </div>
  );
}
