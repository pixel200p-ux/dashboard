import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatViDate } from "@/engine/dates";
import { formatPct, formatQty, signedClass } from "@/engine/money";
import { displayMoney, displayPrice } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";
import type { TplusCard } from "@/engine/types";
import { useState } from "react";

export function TplusOpenCard({
  card,
  usdVnd,
}: {
  card: TplusCard;
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
  const openTx = useUiStore((s) => s.openTx);
  const [detail, setDetail] = useState(false);
  const c = card;
  const costLabel =
    c.tplusProfitCompleted > 0
      ? `${displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)} / ${displayPrice(c.originalAvgCost, c.assetType, currency, usdVnd)}`
      : `0 / ${displayPrice(c.originalAvgCost || c.adjustedAvgCost, c.assetType, currency, usdVnd)}`;

      return (
    <Card className="flex gap-3">
      <div className="min-w-0 flex-1 space-y-2">
        <button type="button" className="w-full text-left" onClick={() => setDetail((v) => !v)}>
          <p className="flex flex-wrap items-center gap-2 text-lg font-semibold leading-tight">
            {c.symbol}{" "}
            <span className="text-sm font-normal text-muted-foreground">{c.accountName}</span>
            <Badge tone={c.remainingUnrealized >= 0 ? "profit" : "loss"}>
              {c.remainingUnrealized >= 0 ? "Có lãi" : "Đang lỗ"}
            </Badge>
          </p>
        </button>

        <ul className="space-y-1 text-xs text-muted-foreground">
          {c.openLots.map((l) => (
            <li key={l.buyTxId}>
              OPEN {formatViDate(l.buyDate)} · {formatQty(l.qtyRemaining, c.assetType)} @{" "}
              {displayPrice(l.buyPrice, c.assetType, currency, usdVnd)}
              {(() => {
                const pnl = (c.currentPrice - l.buyPrice) * l.qtyRemaining;
                const pct = l.buyPrice > 0 ? ((c.currentPrice - l.buyPrice) / l.buyPrice) * 100 : 0;
                return (
                  <>
                    {" · "}
                    {displayMoney(pnl, currency, usdVnd)}{" "}
                    <span className={signedClass(pct)}>{formatPct(pct)}</span>
                  </>
                );
              })()}
            </li>
          ))}
        </ul>

        {detail && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Số lượng Trade</dt>
              <dd className="font-mono tabular-nums">
                {formatQty(c.openTplusQty, c.assetType)} / {formatQty(c.coreQty, c.assetType)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Giá Trade</dt>
              <dd className="font-mono tabular-nums">
                {displayPrice(c.tradePrice, c.assetType, currency, usdVnd)} /{" "}
                {displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Giá vốn (mới / gốc)</dt>
              <dd className="font-mono tabular-nums">{costLabel}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Giá bán đề xuất</dt>
              <dd className="font-mono tabular-nums">
                {displayPrice(c.suggestedSell, c.assetType, currency, usdVnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Hòa vốn (bán hết gốc + T+)</dt>
              <dd className="font-mono tabular-nums">
                {displayPrice(c.breakEvenPrice, c.assetType, currency, usdVnd)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Còn lỗ / lãi</dt>
              <dd className={`font-mono tabular-nums ${signedClass(c.remainingUnrealized)}`}>
                {displayMoney(c.remainingUnrealized, currency, usdVnd)}
              </dd>
            </div>
          </dl>
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
