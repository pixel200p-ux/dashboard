import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCollapsibleCardGroup } from "@/components/ui/collapsible-card-group-context";
import { Tooltip } from "@/components/ui/tooltip";
import { formatViDate } from "@/engine/dates";
import { formatPct, formatQty, formatUsd, signedClass } from "@/engine/money";
import { displayMoney, displayPrice } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";
import type { TplusCard } from "@/engine/types";
import { HelpCircle } from "lucide-react";
import { useState } from "react";

function InfoLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <dt className="flex items-center gap-1 text-xs text-muted-foreground">
      {label}
      <Tooltip content={tooltip}>
        <button type="button" className="inline-flex h-3 w-3 items-center justify-center rounded-full hover:text-foreground">
          <HelpCircle className="h-3 w-3" />
        </button>
      </Tooltip>
    </dt>
  );
}

export function TplusOpenCard({
  card,
  usdVnd,
}: {
  card: TplusCard;
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
  const openTx = useUiStore((s) => s.openTx);
  const group = useCollapsibleCardGroup();
  const [localDetail, setLocalDetail] = useState(false);
  const detail = group?.open ?? localDetail;
  const c = card;
  const displayCurrency = c.assetType === "CRYPTO" ? "USD" : currency;
  const formatVndProfit = (amount: number) => displayMoney(amount, displayCurrency, usdVnd);

  const costLabel =
    c.tplusProfitCompleted > 0
      ? `${displayPrice(c.adjustedAvgCost, c.assetType, displayCurrency, usdVnd)} / ${displayPrice(c.originalAvgCost, c.assetType, displayCurrency, usdVnd)}`
      : `0 / ${displayPrice(c.originalAvgCost || c.adjustedAvgCost, c.assetType, displayCurrency, usdVnd)}`;

  return (
    <Card className="flex gap-3 bg-card dark:bg-[#2b3d5b]">
      <div className="min-w-0 flex-1 space-y-2">
        <button
          type="button"
          className="w-full text-left"
          aria-expanded={detail}
          onClick={() => group ? group.toggle() : setLocalDetail((value) => !value)}
        >
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
            {c.symbol}{" "}
            <span className="text-sm font-normal text-muted-foreground">{c.accountName}</span>
            <Badge tone={c.remainingUnrealized >= 0 ? "profit" : "loss"}>
              {c.remainingUnrealized >= 0 ? "Có lãi" : "Đang lỗ"}
            </Badge>
          </p>
        </button>

        <ul className="space-y-1 text-xs text-muted-foreground">
          {c.openLots.map((l) => {
            const marketPrice = c.currentPrice ?? 0;
            const pnl =
              c.assetType === "CRYPTO"
                ? (marketPrice * usdVnd - l.buyPrice * (l.fxRate ?? usdVnd)) *
                  l.qtyRemaining /
                  usdVnd
                : (marketPrice - l.buyPrice) * l.qtyRemaining;
            const pct = l.buyPrice > 0 ? ((marketPrice - l.buyPrice) / l.buyPrice) * 100 : 0;
            return (
              <li key={l.buyTxId}>
                OPEN {formatViDate(l.buyDate)} · {formatQty(l.qtyRemaining, c.assetType)} @{" "}
                {displayPrice(l.buyPrice, c.assetType, displayCurrency, usdVnd)}
                {" · "}
                {c.assetType === "CRYPTO" ? formatUsd(pnl) : formatVndProfit(pnl)}{" "}
                <span className={signedClass(pct)}>{formatPct(pct)}</span>
              </li>
            );
          })}
        </ul>

        {detail && (
          <>
            <div className="my-1 h-px w-16 bg-border/80" />
            <dl className="grid grid-cols-2 gap-2 rounded-md border border-border/70 bg-muted/30 p-2 text-sm">
              <div>
                <InfoLabel 
                  label="Số lượng Trade" 
                  tooltip={`${formatQty(c.openTplusQty, c.assetType)}: tổng số lượng cổ phiếu/coin đang Trade T+\n${formatQty(c.coreQty, c.assetType)}: số lượng Core ban đầu.`}
                />
                <dd className="font-mono tabular-nums">
                  {formatQty(c.openTplusQty, c.assetType)} / {formatQty(c.coreQty, c.assetType)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Giá Trade" 
                  tooltip={`${displayPrice(c.tradePrice, c.assetType, displayCurrency, usdVnd)}: Mức giá trung bình của tổng T+.\n${displayPrice(c.adjustedAvgCost, c.assetType, displayCurrency, usdVnd)}: Giá vốn ban đầu của Core (trước T+)`}
                />
                <dd className="font-mono tabular-nums">
                  {displayPrice(c.tradePrice, c.assetType, displayCurrency, usdVnd)} /{" "}
                  {displayPrice(c.adjustedAvgCost, c.assetType, displayCurrency, usdVnd)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Giá vốn (mới / gốc)" 
                  tooltip={`${displayPrice(c.adjustedAvgCost, c.assetType, displayCurrency, usdVnd)}: Giá vốn sau khi đã trừ bớt lợi nhuận từ các vòng lướt T+ trước( Chưa tính vốn T+).\n${displayPrice(c.originalAvgCost || c.adjustedAvgCost, c.assetType, displayCurrency, usdVnd)}: Giá vốn ban đầu của Core (trước T+).`}
                />
                <dd className="font-mono tabular-nums">{costLabel}</dd>
              </div>
              <div>
                <InfoLabel 
                  label="Giá bán đề xuất" 
                  tooltip={`Đề xuất cp +3%/coin +5%. Form tự động điền sẵn giá này.`}
                />
                <dd className="font-mono tabular-nums">
                  {displayPrice(c.suggestedSell, c.assetType, displayCurrency, usdVnd)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Hòa vốn (bán hết gốc + T+)" 
                  tooltip={`đóng toàn bộ lệnh ở giá này sẽ hoà vốn`}
                />
                <dd className="font-mono tabular-nums">
                  {displayPrice(c.breakEvenPrice, c.assetType, displayCurrency, usdVnd)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Còn lỗ / lãi" 
                  tooltip={`Tổng số tiền tạm lỗ/lãi trên tổng vị thế (gốc + T+) dựa theo giá thị trường hiện tại.`}
                />
                <dd className={`font-mono tabular-nums ${signedClass(c.remainingUnrealized)}`}>
                  {formatVndProfit(c.remainingUnrealized)}
                </dd>
              </div>
            </dl>
          </>
        )}
      </div>

      <div className="flex w-[4.75rem] shrink-0 flex-col gap-2">
        <Button
          size="sm"
          className="w-full"
          onClick={() =>
            openTx({
              accountId: c.accountId,
              symbol: c.symbol,
              name: c.name,
              assetType: c.assetType,
              txType: "BUY",
              tradeTplus: true,
            })
          }
        >
          Buy
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() =>
            openTx({
              accountId: c.accountId,
              symbol: c.symbol,
              name: c.name,
              assetType: c.assetType,
              txType: "SELL",
              price: c.suggestedSell,
              tplusSell: true,
            })
          }
        >
          Sell
        </Button>
      </div>
    </Card>
  );
}
