import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { TplusOpenCard } from "@/components/TplusOpenCard";
import { formatViDate } from "@/engine/dates";
import { displayMoney, displayPrice } from "@/lib/display";
import { signedClass } from "@/engine/money";
import { usePortfolio } from "@/lib/use-portfolio";
import { useUiStore } from "@/lib/ui-store";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { TplusCard } from "@/engine/types";

function exportHistory(rows: ReturnType<typeof usePortfolio>["data"]) {
  if (!rows) return;
  const h = rows.state.tplusHistory;
  const headers = [
    "Code","Account","Buy Date","Sell Date","Holding before T+","Buy Quantity","Buy Price","Sell Quantity","Sell Price","Fees","Tax","Gross Profit","Net Profit","Average Cost Before","Average Cost After","Cost Reduction","Remaining Holding","Remaining Unrealized P/L","Status",
  ];
  const lines = [
    headers.join(","),
    ...h.map((c) =>
      [
        c.symbol,
        c.accountName,
        c.buyDate,
        c.sellDate,
        c.holdingBefore,
        c.buyQuantity,
        c.buyPrice,
        c.sellQuantity,
        c.sellPrice,
        c.fees,
        c.tax,
        c.grossProfit,
        c.netProfit,
        c.avgCostBefore,
        c.avgCostAfter,
        c.costReduction,
        c.remainingHolding,
        c.remainingUnrealized,
        c.status,
      ].join(","),
    ),
  ];
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "lich-su-T+.csv";
  a.click();
}

export function TplusPage() {
  const { data, isPending } = usePortfolio();
  const currency = useUiStore((s) => s.currency);
  const [history, setHistory] = useState(false);
  const [openStock, setOpenStock] = useState(true);
  const [openCrypto, setOpenCrypto] = useState(true);

  if (isPending || !data) return <Skeleton className="h-64" />;
  const usd = data.state.usdVnd;
  const cards = data.state.tplusCards;
  const stockCards = cards.filter((c) => c.assetType === "STOCK");
  const cryptoCards = cards.filter((c) => c.assetType === "CRYPTO");
  const vpsCards = stockCards.filter((c) => c.accountId === "vps");
  const ssiCards = stockCards.filter((c) => c.accountId === "ssi");

  function Group({
    title,
    count,
    open,
    onToggle,
    children,
  }: {
    title: string;
    count: number;
    open: boolean;
    onToggle: () => void;
    children: React.ReactNode;
  }) {
    return (
      <Card className="space-y-3">
        <button type="button" className="flex w-full items-center justify-between gap-2 text-left" onClick={onToggle}>
          <CardTitle>
            {title}{" "}
            <span className="text-sm font-normal text-muted-foreground">· {count} mã</span>
          </CardTitle>
          <ChevronDown className={`h-4 w-4 transition ${open ? "rotate-180" : ""}`} />
        </button>
        {open ? children : null}
      </Card>
    );
  }

  function CardGrid({ list }: { list: TplusCard[] }) {
    if (list.length === 0) {
      return <p className="text-sm text-muted-foreground">Không có lệnh T+ đang mở.</p>;
    }
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        {list.map((c) => (
          <TplusOpenCard key={c.assetId} card={c} usdVnd={usd} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-semibold">Trade T+</h1>
          <p className="text-sm text-muted-foreground">
            Chỉ hiện mã đang có lệnh T+ OPEN. Khớp bán chọn tay. Lãi COMPLETED mới hạ giá vốn gốc.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={history ? "default" : "outline"} onClick={() => setHistory((v) => !v)}>
            Lịch sử T+
          </Button>
          <Button variant="outline" onClick={() => exportHistory(data)}>
            Xuất Excel
          </Button>
        </div>
      </div>

      {!history && (
        <div className="space-y-3">
          <Group title="Stock" count={stockCards.length} open={openStock} onToggle={() => setOpenStock((v) => !v)}>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">VPS</p>
                <CardGrid list={vpsCards} />
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">SSI</p>
                <CardGrid list={ssiCards} />
              </div>
            </div>
          </Group>
          <Group title="Crypto" count={cryptoCards.length} open={openCrypto} onToggle={() => setOpenCrypto((v) => !v)}>
            <CardGrid list={cryptoCards} />
          </Group>
        </div>
      )}

      {history && (
        <Card>
          <CardTitle>Lịch sử T+</CardTitle>
          <div className="table-scroll mt-3">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="px-2 py-2">Mã</th>
                  <th className="px-2 py-2">Account</th>
                  <th className="px-2 py-2">Mua</th>
                  <th className="px-2 py-2">Bán</th>
                  <th className="px-2 py-2 text-right">SL</th>
                  <th className="px-2 py-2 text-right">Lãi ròng</th>
                  <th className="px-2 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.state.tplusHistory.map((c) => (
                  <tr key={c.id} className="border-b border-border/70">
                    <td className="px-2 py-2 font-medium">{c.symbol}</td>
                    <td className="px-2 py-2">{c.accountName}</td>
                    <td className="px-2 py-2">
                      {formatViDate(c.buyDate)} · {displayPrice(c.buyPrice, "STOCK", currency, usd)}
                    </td>
                    <td className="px-2 py-2">
                      {formatViDate(c.sellDate)} · {displayPrice(c.sellPrice, "STOCK", currency, usd)}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">{c.sellQuantity}</td>
                    <td className={`px-2 py-2 text-right font-mono ${signedClass(c.netProfit)}`}>
                      {displayMoney(c.netProfit, currency, usd)}
                    </td>
                    <td className="px-2 py-2">
                      <Badge tone={c.status === "COMPLETED" ? "profit" : "warn"}>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.state.tplusHistory.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">Chưa có cycle T+ hoàn tất.</p>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
