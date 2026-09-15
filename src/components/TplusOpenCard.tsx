import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatViDate } from "@/engine/dates";
import { formatPct, formatQty, signedClass } from "@/engine/money";
import { displayMoney, displayPrice } from "@/lib/display";
import { useUiStore } from "@/lib/ui-store";
import type { TplusCard } from "@/engine/types";

export function TplusOpenCard({
  card,
  usdVnd,
}: {
  card: TplusCard;
  usdVnd: number;
}) {
  const currency = useUiStore((s) => s.currency);
  const openTx = useUiStore((s) => s.openTx);
  const c = card;
  const costLabel =
    c.tplusProfitCompleted > 0
      ? `${displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)} / ${displayPrice(c.originalAvgCost, c.assetType, currency, usdVnd)}`
      : `0 / ${displayPrice(c.originalAvgCost || c.adjustedAvgCost, c.assetType, currency, usdVnd)}`;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-semibold">
            {c.symbol} <span className="text-sm font-normal text-muted-foreground">{c.accountName}</span>
          </p>
          <p className="text-xs text-muted-foreground">{c.name}</p>
        </div>
        <Badge tone={c.remainingUnrealized >= 0 ? "profit" : "loss"}>
          {c.remainingUnrealized >= 0 ? "Có lãi / gần hòa" : "Đang lỗ"}
        </Badge>
      </div>
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
          <dd className="font-mono tabular-nums">{displayPrice(c.suggestedSell, c.assetType, currency, usdVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Hòa vốn (bán hết gốc + T+)</dt>
          <dd className="font-mono tabular-nums">{displayPrice(c.breakEvenPrice, c.assetType, currency, usdVnd)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Còn lỗ / lãi</dt>
          <dd className={`font-mono tabular-nums ${signedClass(c.remainingUnrealized)}`}>
            {displayMoney(c.remainingUnrealized, currency, usdVnd)}
          </dd>
        </div>
      </dl>
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
      <div className="flex gap-2">
        <Button
          className="flex-1"
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
          className="flex-1"
          variant="outline"
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
