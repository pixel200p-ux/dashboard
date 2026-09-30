import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tooltip } from "@/components/ui/tooltip";
import { formatViDate } from "@/engine/dates";
import { formatPct, formatQty, signedClass } from "@/engine/money";
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
  const [detail, setDetail] = useState(false);
  const c = card;

  const costLabel =
    c.tplusProfitCompleted > 0
      ? `${displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)} / ${displayPrice(c.originalAvgCost, c.assetType, currency, usdVnd)}`
      : `0 / ${displayPrice(c.originalAvgCost || c.adjustedAvgCost, c.assetType, currency, usdVnd)}`;

  return (
    <Card className="flex gap-3 bg-card dark:bg-[#2b3d5b]">
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
          {c.openLots.map((l) => {
            const marketPrice = c.currentPrice ?? 0;
            const pnl = (marketPrice - l.buyPrice) * l.qtyRemaining;
            const pct = l.buyPrice > 0 ? ((marketPrice - l.buyPrice) / l.buyPrice) * 100 : 0;
            return (
              <li key={l.buyTxId}>
                OPEN {formatViDate(l.buyDate)} · {formatQty(l.qtyRemaining, c.assetType)} @{" "}
                {displayPrice(l.buyPrice, c.assetType, currency, usdVnd)}
                {" · "}
                {displayMoney(pnl, currency, usdVnd)}{" "}
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
                  tooltip={`${formatQty(c.openTplusQty, c.assetType)} (Số lượng T+): Là khối lượng cổ phiếu/coin bạn đã mua thêm (Trade T+) và hiện vẫn đang nắm giữ (chưa bán).\n${formatQty(c.coreQty, c.assetType)} (Số lượng Gốc): Là khối lượng vị thế cốt lõi (Core) ban đầu của bạn.`}
                />
                <dd className="font-mono tabular-nums">
                  {formatQty(c.openTplusQty, c.assetType)} / {formatQty(c.coreQty, c.assetType)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Giá Trade" 
                  tooltip={`${displayPrice(c.tradePrice, c.assetType, currency, usdVnd)}: Là mức giá mua trung bình của phần khối lượng T+ (${formatQty(c.openTplusQty, c.assetType)} đơn vị) đang mở.\n${displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)}: Là mức giá vốn hiện tại của phần khối lượng Gốc (${formatQty(c.coreQty, c.assetType)} đơn vị). So sánh 2 số này giúp bạn biết bạn đã "bắt đáy" (mua T+) rẻ hơn giá vốn gốc bao nhiêu.`}
                />
                <dd className="font-mono tabular-nums">
                  {displayPrice(c.tradePrice, c.assetType, currency, usdVnd)} /{" "}
                  {displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Giá vốn (mới / gốc)" 
                  tooltip={`${displayPrice(c.adjustedAvgCost, c.assetType, currency, usdVnd)} (Giá vốn mới): Giá vốn thực tế của phần Gốc sau khi đã được trừ bớt lợi nhuận từ các vòng lướt T+ thành công trước đó (nếu có).\n${displayPrice(c.originalAvgCost || c.adjustedAvgCost, c.assetType, currency, usdVnd)} (Giá vốn gốc): Giá vốn ban đầu của phần Gốc (trước khi thực hiện bất kỳ vòng lướt hạ vốn T+ nào).`}
                />
                <dd className="font-mono tabular-nums">{costLabel}</dd>
              </div>
              <div>
                <InfoLabel 
                  label="Giá bán đề xuất" 
                  tooltip={`Là mức giá bán tối ưu (thường được hệ thống tự tính cộng thêm +3% với cổ phiếu hoặc +5% với Crypto so với Giá mua T+ là ${displayPrice(c.tradePrice, c.assetType, currency, usdVnd)}). Bán T+ ở giá này sẽ đạt kỳ vọng lợi nhuận hạ vốn cho vòng lướt hiện tại. Khi bạn ấn nút "Sell" trên card này, form bán sẽ tự động điền sẵn mức giá ${displayPrice(c.suggestedSell, c.assetType, currency, usdVnd)} này.`}
                />
                <dd className="font-mono tabular-nums">
                  {displayPrice(c.suggestedSell, c.assetType, currency, usdVnd)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Hòa vốn (bán hết gốc + T+)" 
                  tooltip={`Là mức giá hòa vốn trung bình của tổng vị thế (bao gồm cả ${formatQty(c.coreQty, c.assetType)} Gốc + ${formatQty(c.openTplusQty, c.assetType)} T+). Nếu lúc này bạn quyết định đóng toàn bộ vị thế và bán hết sạch ở mức giá ${displayPrice(c.breakEvenPrice, c.assetType, currency, usdVnd)}, bạn sẽ hòa vốn (thu về đúng bằng tổng số tiền đã bỏ ra, đã bao gồm cả thuế/phí dự tính).`}
                />
                <dd className="font-mono tabular-nums">
                  {displayPrice(c.breakEvenPrice, c.assetType, currency, usdVnd)}
                </dd>
              </div>
              <div>
                <InfoLabel 
                  label="Còn lỗ / lãi" 
                  tooltip={`Là tổng số tiền (P&L Unrealized) bạn đang tạm lỗ hoặc tạm lãi tính trên tổng vị thế (gốc + T+) dựa theo giá thị trường hiện tại. Ở đây, bạn đang tạm ${c.remainingUnrealized < 0 ? 'âm' : 'dương'} ${displayMoney(Math.abs(c.remainingUnrealized), currency, usdVnd)}.`}
                />
                <dd className={`font-mono tabular-nums ${signedClass(c.remainingUnrealized)}`}>
                  {displayMoney(c.remainingUnrealized, currency, usdVnd)}
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
