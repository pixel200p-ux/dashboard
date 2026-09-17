import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useUiStore } from "@/lib/ui-store";
import { usePortfolio, usePortfolioMutation } from "@/lib/use-portfolio";
import { saveBank, saveTransaction } from "@/lib/api/portfolio";
import { dcdsQty } from "@/engine/replay";
import { parseBrokerPrice, parseDecimal, parseVndAmount, formatQty, formatBrokerPrice, formatThousandsInput, formatPct, signedClass } from "@/engine/money";
import { todayYmd, formatViDate } from "@/engine/dates";
import { displayMoney, displayPrice } from "@/lib/display";
import type { AssetType, FeeProfile, TxType } from "@/engine/types";
import { useEffect, useMemo, useState } from "react";

type FormKind = AssetType | "BANK";

const TYPES: { value: FormKind; label: string }[] = [
  { value: "DCDS", label: "DCDS" },
  { value: "ETF", label: "ETF" },
  { value: "STOCK", label: "Stock" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "BANK", label: "Bank" },
];

const BANKS = ["VietinBank", "Vietcombank", "MB", "Techcombank", "BIDV", "Agribank", "ACB", "VPBank", "TPBank", "Khác"];

function cryptoQty(amountUsd: number, priceUsd: number): number {
  if (priceUsd <= 0) return 0;
  return Math.round((amountUsd / priceUsd) * 1e8) / 1e8;
}

function accountFor(type: AssetType, stockAccount: string): { id: string; currency: string; profile: FeeProfile } {
  if (type === "STOCK") return { id: stockAccount, currency: "VND", profile: stockAccount === "ssi" ? "STOCK_SSI" : "STOCK_VPS" };
  if (type === "CRYPTO") return { id: "crypto", currency: "USD", profile: "CRYPTO" };
  if (type === "ETF") return { id: "etf", currency: "VND", profile: "ETF" };
  return { id: "dcds", currency: "VND", profile: "DCDS" };
}

export function TxDialog() {
  const prefill = useUiStore((s) => s.txOpen);
  const close = useUiStore((s) => s.closeTx);
  const currency = useUiStore((s) => s.currency);
  const { data } = usePortfolio();
  const mut = usePortfolioMutation((d: Parameters<typeof saveTransaction>[0]) => saveTransaction(d), "Đã ghi giao dịch");
  const bankMut = usePortfolioMutation((d: Parameters<typeof saveBank>[0]) => saveBank(d), "Đã mở sổ tiết kiệm");

  const [kind, setKind] = useState<FormKind>("STOCK");
  const [stockAccount, setStockAccount] = useState("vps");
  const [txType, setTxType] = useState<TxType>("BUY");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");

  function clampSellQty(next: string) {
    const raw = parseDecimal(next);
    if ((txType === "SELL" || prefill?.txType === "SELL") && (kind === "STOCK" || kind === "CRYPTO") && raw > maxSellQty) {
      setQty(formatThousandsInput(String(maxSellQty)));
      return;
    }
    setQty(formatThousandsInput(next));
  }
  const [tplus, setTplus] = useState(false);
  const [matchTplus, setMatchTplus] = useState(false);
  const autoTplusSellMatch = Boolean(prefill?.tplusSell || prefill?.matchAllOpen);
  const [fx, setFx] = useState("");
  const [divTotal, setDivTotal] = useState("");
  const [stockDivQty, setStockDivQty] = useState("");
  const [feeOverride, setFeeOverride] = useState("");
  const [taxOverride, setTaxOverride] = useState("");
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);

  const [bankName, setBankName] = useState("VietinBank");
  const [bankCustom, setBankCustom] = useState("");
  const [bankPrincipal, setBankPrincipal] = useState("");
  const [bankTerm, setBankTerm] = useState("");
  const [bankRate, setBankRate] = useState("");
  const [bankRollover, setBankRollover] = useState(true);

    const editing = Boolean(prefill?.id);
      function setGrouped(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setter(formatThousandsInput(e.target.value));
  }

  useEffect(() => {
    if (!prefill) return;
    const shouldAutoMatchTplus = Boolean(prefill.tplusSell || prefill.matchAllOpen);
    setKind(prefill.assetType ?? "STOCK");
    setStockAccount(prefill.accountId === "ssi" ? "ssi" : "vps");
    setTxType(prefill.txType ?? "BUY");
        setSymbol(
      prefill.symbol ??
        (prefill.assetType === "DCDS" ? "DCDS" : prefill.assetType === "ETF" ? "ETF" : ""),
    );setSymbol(prefill.symbol ?? "");
    setName(prefill.name ?? "");
    setTplus(prefill.tradeTplus ?? false);
    setMatchTplus(shouldAutoMatchTplus);
    setDate(prefill.txDate ?? todayYmd());
    setFx(formatThousandsInput(prefill.fxRate != null ? String(prefill.fxRate) : data?.state.usdVnd ? String(data.state.usdVnd) : "25000"));
    setFeeOverride(prefill.id && prefill.fee != null ? formatThousandsInput(String(prefill.fee)) : "");
    setTaxOverride(prefill.id && prefill.tax != null ? formatThousandsInput(String(prefill.tax)) : "");
    setDivTotal(prefill.txType === "CASH_DIVIDEND" && prefill.amount != null ? formatThousandsInput(String(prefill.amount)) : "");
    setStockDivQty(prefill.stockDivQty != null ? formatThousandsInput(String(prefill.stockDivQty)) : "");
    setBankPrincipal("");

    const at = prefill.assetType ?? "STOCK";
    if (prefill.id && (prefill.txType === "BUY" || prefill.txType === "SELL")) {
      if (at === "DCDS" || at === "CRYPTO") {
                setAmount(prefill.amount != null ? formatThousandsInput(String(prefill.amount)) : "");
        setPrice(prefill.price != null ? formatThousandsInput(String(prefill.price)) : "");
        setQty(prefill.quantity != null ? formatThousandsInput(String(prefill.quantity)) : "");
      } else {
        setAmount("");
                setQty(prefill.quantity != null ? formatThousandsInput(String(prefill.quantity)) : "");
        setPrice(prefill.price != null ? formatBrokerPrice(prefill.price) : "");
      }
    } else {
            setQty(prefill.quantity != null ? formatThousandsInput(String(prefill.quantity)) : "");
      setPrice(
        prefill.price != null
          ? String(at === "CRYPTO" || at === "DCDS" ? prefill.price : prefill.price / 1000)
          : "",
      );
      setAmount("");
    }

    setSelectedLotIds((prefill.matches ?? []).map((m) => m.buyTxId));
  }, [prefill, data?.state.usdVnd]);

  const isBank = kind === "BANK";
  const assetType: AssetType = isBank ? "STOCK" : kind;
  const acc = accountFor(assetType, stockAccount);
  const feeRow = data?.ledger.fees.find((f) => f.profile === acc.profile);
  const usdVnd = data?.state.usdVnd ?? 25000;

  const isDcdsBuy = kind === "DCDS" && txType === "BUY";
  const isCryptoBuy = kind === "CRYPTO" && txType === "BUY";

  const parsedPrice = useMemo(() => {
    if (kind === "CRYPTO") return parseDecimal(price);
    if (kind === "DCDS") return parseVndAmount(price);
    return parseBrokerPrice(price);
  }, [price, kind]);

  const parsedQty = parseDecimal(qty);
  const parsedAmount = isDcdsBuy ? parseVndAmount(amount) : isCryptoBuy ? parseDecimal(amount) : parsedQty * parsedPrice;
  const computedQty = isDcdsBuy
    ? dcdsQty(parsedAmount, parsedPrice)
    : isCryptoBuy
      ? cryptoQty(parsedAmount, parsedPrice)
      : parsedQty;

  const notional = isDcdsBuy || isCryptoBuy ? parsedAmount : computedQty * parsedPrice;
  const defaultFeePct = txType === "SELL" ? (feeRow?.sellFeePct ?? 0) : (feeRow?.buyFeePct ?? 0);
  const defaultTaxPct = txType === "SELL" ? (feeRow?.sellTaxPct ?? 0) : 0;
  const autoFee = (notional * defaultFeePct) / 100;
  const autoTax = (notional * defaultTaxPct) / 100;
  const fee = feeOverride === "" ? autoFee : parseDecimal(feeOverride);
  const tax = taxOverride === "" ? autoTax : parseDecimal(taxOverride);

  const holding = data?.state.holdings.find(
    (h) => h.accountId === acc.id && h.symbol === symbol.trim().toUpperCase(),
  );
  const openLots = holding?.openLots ?? [];
  const maxSellQty = holding?.quantity ?? 0;

  const selectedRemaining = selectedLotIds.reduce((s, id) => {
    const lot = openLots.find((l) => l.buyTxId === id);
    return s + (lot?.qtyRemaining ?? 0);
  }, 0);
  const tplusCovered = parsedQty > 0 && selectedRemaining >= parsedQty;

  useEffect(() => {
    if (parsedQty <= 0) {
      setSelectedLotIds((prev) => (prev.length ? [] : prev));
      return;
    }
    setSelectedLotIds((prev) => {
      let accQty = 0;
      const next: string[] = [];
      for (const id of prev) {
        const lot = openLots.find((l) => l.buyTxId === id);
        if (!lot) continue;
        if (accQty >= parsedQty) break;
        next.push(id);
        accQty += lot.qtyRemaining;
      }
      if (next.length === prev.length && next.every((id, i) => id === prev[i])) return prev;
      return next;
    });
  }, [parsedQty, openLots]);

  function toggleLot(buyTxId: string) {
    if (parsedQty <= 0) return;
    setSelectedLotIds((prev) => {
      if (prev.includes(buyTxId)) return prev.filter((id) => id !== buyTxId);
      const sum = prev.reduce((s, id) => {
        const lot = openLots.find((l) => l.buyTxId === id);
        return s + (lot?.qtyRemaining ?? 0);
      }, 0);
      if (sum >= parsedQty) return prev;
      return [...prev, buyTxId];
    });
  }



  const thisBuyQty =
    editing && prefill?.txType === "BUY" && !prefill.tradeTplus ? (prefill.quantity ?? 0) : 0;
  const coreExcludingThis = Math.max(0, (holding?.coreQty ?? 0) - thisBuyQty);
    const canTplus = (kind === "STOCK" || kind === "CRYPTO") && txType === "BUY" && coreExcludingThis > 1e-12;
  const canOfferTplusSell = (kind === "STOCK" || kind === "CRYPTO") && txType === "SELL";
  const sellHoldings = (data?.state.holdings ?? []).filter(
    (h) => h.assetType === assetType && h.accountId === acc.id && h.quantity > 1e-12,
  );
  const showTplusMatchPrompt = canOfferTplusSell && openLots.length > 0 && !autoTplusSellMatch;
  const canMatch =
    canOfferTplusSell &&
    ((autoTplusSellMatch && openLots.length > 0) || (showTplusMatchPrompt && matchTplus)) &&
    (openLots.length > 0 || (editing && (prefill?.matches?.length ?? 0) > 0));

  useEffect(() => {
    if (autoTplusSellMatch) setMatchTplus(true);
  }, [autoTplusSellMatch]);

  function submit(e: React.FormEvent) {
    e.preventDefault();

    if (isBank) {
      const name = bankName === "Khác" ? bankCustom.trim() : bankName;
      const p = parseVndAmount(bankPrincipal);
      if (!name || p <= 0) return;
      bankMut.mutate(
        {
          data: {
            bankName: name,
            principal: p,
            startDate: date,
            termMonths: Number(bankTerm) || 1,
            interestRate: parseDecimal(bankRate),
            autoRollover: bankRollover,
          },
        },
        {
          onSuccess: () => {
            close();
            setBankPrincipal("");
          },
        },
      );
      return;
    }

    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    let left = computedQty;
    const matches: { buyTxId: string; quantity: number }[] = [];
    for (const id of selectedLotIds) {
      if (left <= 0) break;
      const lot = openLots.find((l) => l.buyTxId === id);
      if (!lot) continue;
      const take = Math.min(lot.qtyRemaining, left);
      if (take <= 0) continue;
      matches.push({ buyTxId: id, quantity: take });
      left -= take;
    }

    mut.mutate(
      {
        data: {
          id: prefill?.id,
          accountId: acc.id,
          symbol: sym,
          name: name || sym,
          assetType,
          currency: acc.currency,
          txType,
          txDate: date,
          quantity: txType === "CASH_DIVIDEND" ? null : computedQty,
          price: txType === "CASH_DIVIDEND" || txType === "STOCK_DIVIDEND" ? null : parsedPrice,
          amount: txType === "CASH_DIVIDEND" ? parseVndAmount(divTotal) : notional,
          fee,
          tax,
          tradeTplus: canTplus && tplus,
          fxRate: kind === "CRYPTO" ? parseDecimal(fx) || usdVnd : null,
          dividendPerShare: null,
          stockDivQty: txType === "STOCK_DIVIDEND" ? parseDecimal(stockDivQty) : null,
          currentPrice: parsedPrice || undefined,
          matches: txType === "SELL" ? matches : undefined,
        },
      },
      { onSuccess: () => close() },
    );
  }

  const txOptions =
    kind === "STOCK"
      ? [
          { value: "BUY", label: "Buy" },
          { value: "SELL", label: "Sell" },
          { value: "CASH_DIVIDEND", label: "Cổ tức tiền mặt" },
          { value: "STOCK_DIVIDEND", label: "Cổ tức cổ phiếu" },
        ]
      : [
          { value: "BUY", label: "Buy" },
          { value: "SELL", label: "Sell" },
        ];

  const saving = mut.isPending || bankMut.isPending;

  return (
    <Dialog open={!!prefill} onOpenChange={(o) => !o && close()}>
        <DialogContent title={editing ? "Sửa giao dịch" : "Giao dịch"} className="max-w-xl">
        <form className="space-y-3" onSubmit={submit}>
        {!editing && !prefill?.assetType && (
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                                onClick={() => {
                  setKind(t.value);
                  if (t.value !== "STOCK" && (txType === "CASH_DIVIDEND" || txType === "STOCK_DIVIDEND")) setTxType("BUY");
                  if (t.value !== "STOCK" && t.value !== "CRYPTO") setTplus(false);
                  if (t.value === "DCDS") setSymbol("DCDS");
                  else if (t.value === "ETF") setSymbol("ETF");
                }}
                className={`min-h-10 rounded-full border px-3 text-xs font-medium ${kind === t.value ? "border-primary bg-primary/10 text-primary" : "border-border"}`}
              >
                {t.label}
              </button>
                        ))}
          </div>
          )}

          {isBank ? (
            <>
              <p className="text-sm text-muted-foreground">
                Mở sổ tiết kiệm. Mô hình thuần tài sản: không trừ tiền mặt. NAV cộng giá trị sổ đang hiệu lực.
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
                  <Input className="mt-2" value={bankCustom} onChange={(e) => setBankCustom(e.target.value)} placeholder="Tên ngân hàng" />
                )}
              </div>
              <div className="space-y-1">
                <Label>Số tiền gửi (VND)</Label>
                <Input value={bankPrincipal} onChange={setGrouped(setBankPrincipal)} placeholder="..." required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Ngày gửi</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label>Kỳ hạn (tháng)</Label>
                  <Input value={bankTerm} onChange={(e) => setBankTerm(e.target.value)} placeholder="..." />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Lãi suất (%/năm)</Label>
                <Input value={bankRate} onChange={(e) => setBankRate(e.target.value)} placeholder="..." />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label>Tự động tái tục</Label>
                <Switch checked={bankRollover} onCheckedChange={setBankRollover} />
              </div>
            </>
          ) : (
            <>
              {kind === "STOCK" && (
                <div className="flex gap-2">
                  {(["vps", "ssi"] as const).map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setStockAccount(id)}
                      className={`min-h-10 flex-1 rounded-md border text-sm ${stockAccount === id ? "border-primary bg-primary/10" : "border-border"}`}
                    >
                      {id.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Loại</Label>
                  <Select value={txType} onValueChange={(v) => setTxType(v as TxType)} options={txOptions} />
                </div>
                <div className="space-y-1">
                  <Label>Ngày</Label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Mã</Label>
                  {txType === "SELL" || txType === "CASH_DIVIDEND" || txType === "STOCK_DIVIDEND" ? (
                    <Select
                      value={symbol}
                      onValueChange={(v) => {
                        setSymbol(v);
                        const h = sellHoldings.find((x) => x.symbol === v);
                        if (h) setName(h.name);
                      }}
                      placeholder="Chọn mã đang giữ"
                      options={sellHoldings.map((h) => ({
                        value: h.symbol,
                        label: h.symbol,
                      }))}
                    />
                  ) : (
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value)}
                      placeholder={kind === "CRYPTO" ? "BTC" : kind === "DCDS" ? "DCDS" : kind === "ETF" ? "ETF" : "MBB"}
                      required={!isBank}
                    />
                  )}
                </div>
                <div className="space-y-1">
                  <Label>Chú thích</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Tùy chọn" />
                </div>
              </div>

              {txType === "CASH_DIVIDEND" && (
                <div className="space-y-1">
                  <Label>Tổng tiền thực nhận (VND)</Label>
                  <Input value={divTotal} onChange={setGrouped(setDivTotal)} placeholder="1,000,000" />
                  <p className="text-xs text-muted-foreground">
                    Trừ khỏi vốn của mã (tử số). Original Capital không đổi. Nếu cổ tức lớn hơn vốn còn lại, giá vốn = 0, phần dư là lãi.
                  </p>
                </div>
              )}

              {txType === "STOCK_DIVIDEND" && (
                <div className="space-y-1">
                  <Label>Số lượng CP thưởng thực nhận</Label>
                  <Input value={stockDivQty} onChange={setGrouped(setStockDivQty)} />
                  <p className="text-xs text-muted-foreground">
                    Cộng vào mẫu số (số CP). Vốn không tăng → giá vốn / CP giảm.
                  </p>
                </div>
              )}

              {txType === "BUY" || txType === "SELL" ? (
                <>
                  {isDcdsBuy || isCryptoBuy ? (
                    <>
                      <div className="space-y-1">
                        <Label>{isCryptoBuy ? "Số tiền mua (USD)" : "Số tiền mua (VND)"}</Label>
                        <Input
                          value={amount}
                          onChange={setGrouped(setAmount)}
                          placeholder="..."
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{isCryptoBuy ? "Giá (USD)" : "Giá CCQ (VND)"}</Label>
                        <Input
                          value={price}
                          onChange={setGrouped(setPrice)}
                          placeholder="..."
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{isCryptoBuy ? "Khối lượng (tự tính)" : "Số CCQ (tự tính, 4 số thập phân)"}</Label>
                        <Input
                          readOnly
                          value={computedQty ? formatQty(computedQty, isCryptoBuy ? "CRYPTO" : "DCDS") : ""}
                          className="bg-muted"
                        />
                      </div>
                    </>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label>Khối lượng</Label>
                        <Input
                          value={qty}
                          onChange={(e) => clampSellQty(e.target.value)}
                          placeholder="..."
                          required
                        />
                        {txType === "SELL" && (
                          <p className="text-xs text-muted-foreground">
                            tối đa {formatQty(maxSellQty, assetType)}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1">
                        <Label>Giá {kind === "CRYPTO" ? "(USD)" : kind === "DCDS" ? "(VND)" : "(13.5 = 13.500 ₫)"}</Label>
                        <Input value={price} onChange={setGrouped(setPrice)} placeholder="..." required />
                      </div>
                    </div>
                  )}

                  {kind === "CRYPTO" && (
                    <div className="space-y-1">
                      <Label>Tỷ giá USD/VND khóa theo lệnh</Label>
                      <Input value={fx} onChange={setGrouped(setFx)} />
                    </div>
                  )}

                  {(kind === "STOCK" || kind === "CRYPTO") && txType === "BUY" && !canTplus && (
                    <p className="text-xs text-muted-foreground">
                      Lần mua đầu của mã này là vị thế gốc — không dùng Trade T+.
                    </p>
                  )}
                  {canTplus && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={tplus} onCheckedChange={(v) => setTplus(v === true)} />
                      Trade T+ — lệnh này vào phân tích T+, không cộng vào giá vốn gốc
                    </label>
                  )}
                  {showTplusMatchPrompt && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={matchTplus}
                        onCheckedChange={(v) => setMatchTplus(v === true)}
                      />
                      T+ — chọn lệnh BUY T+ đang OPEN để khớp
                    </label>
                  )}

                  {canMatch && (
                    <div className="space-y-2 rounded-lg border border-border p-3">
                      <p className="text-sm font-medium">Chọn lệnh BUY T+ đang OPEN để khớp</p>
                      <p className="text-xs text-muted-foreground">
                        {parsedQty <= 0
                          ? "Nhập khối lượng bán trước, rồi tick lô. Tick vừa đủ số bán thì không tick thêm."
                          : tplusCovered
                            ? "Đã đủ số lượng bán. Bỏ tick nếu muốn chọn lô khác."
                            : "Tick lô đến khi vừa đủ số lượng bán. Phần chưa tick (nếu còn) trừ vị thế gốc."}
                      </p>
                      {openLots.map((l) => {
                        const checked = selectedLotIds.includes(l.buyTxId);
                        const locked = parsedQty <= 0 || (!checked && tplusCovered);
                        const marketPrice = holding?.currentPrice ?? 0;
                        const pnl = (marketPrice - l.buyPrice) * l.qtyRemaining;
                        const pct = l.buyPrice > 0 ? ((marketPrice - l.buyPrice) / l.buyPrice) * 100 : 0;
                        return (
                          <label
                            key={l.buyTxId}
                            className={`flex items-center gap-2 text-sm ${locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                          >
                            <Checkbox
                              checked={checked}
                              disabled={locked}
                              onCheckedChange={() => toggleLot(l.buyTxId)}
                            />
                            <span className="min-w-0 truncate">
                              {formatViDate(l.buyDate)} · {formatQty(l.qtyRemaining, assetType)}/{formatQty(l.qtyOriginal, assetType)} @{" "}
                              {displayPrice(l.buyPrice, assetType, currency, usdVnd)}
                              {" · "}
                              {displayMoney(pnl, currency, usdVnd)}{" "}
                              <span className={signedClass(pct)}>{formatPct(pct)}</span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="space-y-1">
                      <Label>Phí (mặc định {defaultFeePct}%)</Label>
                      <Input value={feeOverride} onChange={setGrouped(setFeeOverride)} placeholder={String(Math.round(autoFee * 100) / 100)} />
                    </div>
                    <div className="space-y-1">
                      <Label>Thuế (mặc định {defaultTaxPct}%)</Label>
                      <Input value={taxOverride} onChange={setGrouped(setTaxOverride)} placeholder={String(Math.round(autoTax * 100) / 100)} />
                    </div>
                  </div>
                </>
              ) : null}
            </>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Đang lưu..." : editing ? "Lưu sửa" : isBank ? "Lưu sổ" : "Ghi sổ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}