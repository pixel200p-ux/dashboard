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
import { saveCorporateAction } from "@/lib/api/corporate-actions";
import { dcdsQty } from "@/engine/replay";
import { parseBrokerPrice, parseDecimal, parseVndAmount, formatQty, formatBrokerPrice, formatThousandsInput, formatPct, formatUsd, signedClass } from "@/engine/money";
import { todayYmd, formatViDate } from "@/engine/dates";
import { displayMoney, displayPrice } from "@/lib/display";
import type { AssetType, CorporateActionType, FeeProfile, TxType } from "@/engine/types";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { validateSellQuantity, validateTplusSellSelection } from "@/lib/tx-validation.js";
import { defaultSymbolForKind } from "@/lib/tx-defaults.js";
import { askEditPin } from "@/lib/edit-pin";
import type { TxEntryType } from "@/lib/ui-store";

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
  const actionMut = usePortfolioMutation(
    (d: Parameters<typeof saveCorporateAction>[0]) => saveCorporateAction(d),
    "Đã lưu sự kiện GDKHQ",
    true,
  );

  const [kind, setKind] = useState<FormKind>("STOCK");
  const [stockAccount, setStockAccount] = useState("vps");
  const [txType, setTxType] = useState<TxEntryType>("BUY");
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [date, setDate] = useState(todayYmd());
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");

  function clampSellQty(next: string) {
    setQty(formatThousandsInput(next));
  }
  const [tplus, setTplus] = useState(false);
  const [matchTplus, setMatchTplus] = useState(false);
  const autoTplusSellMatch = Boolean(prefill?.tplusSell || prefill?.matchAllOpen);
  const [fx, setFx] = useState("");
  const [divTotal, setDivTotal] = useState("");
  const [stockDivQty, setStockDivQty] = useState("");
  const [corporateActionId, setCorporateActionId] = useState<string | null>(null);
  const [corporateActionType, setCorporateActionType] =
    useState<CorporateActionType>("CASH_DIVIDEND");
  const [distributionPct, setDistributionPct] = useState("");
  const [subscriptionPrice, setSubscriptionPrice] = useState("");
  const [vpsSubscribedQty, setVpsSubscribedQty] = useState("");
  const [ssiSubscribedQty, setSsiSubscribedQty] = useState("");
  const [recordDate, setRecordDate] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [feeOverride, setFeeOverride] = useState("");
  const [taxOverride, setTaxOverride] = useState("");
  const [selectedLotIds, setSelectedLotIds] = useState<string[]>([]);

  const [bankName, setBankName] = useState("VietinBank");
  const [bankCustom, setBankCustom] = useState("");
  const [bankPrincipal, setBankPrincipal] = useState("");
  const [bankTerm, setBankTerm] = useState("");
  const [bankRate, setBankRate] = useState("");
  const [bankRollover, setBankRollover] = useState(true);
  const [saveOriginal, setSaveOriginal] = useState(false);

  const editing = Boolean(prefill?.id);
  const editingSell = editing && prefill?.txType === "SELL";
  function setGrouped(setter: (v: string) => void) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setter(formatThousandsInput(e.target.value));
  }

  useEffect(() => {
    if (!prefill) return;
    const shouldAutoMatchTplus = Boolean(prefill.tplusSell || prefill.matchAllOpen);
    setKind(prefill.formKind ?? prefill.assetType ?? "STOCK");
    setStockAccount(prefill.accountId === "ssi" ? "ssi" : "vps");
    setTxType(prefill.txType ?? "BUY");
    setSymbol(defaultSymbolForKind(prefill.formKind ?? prefill.assetType ?? "STOCK", prefill.symbol ?? ""));
    setName(prefill.name ?? "");
    setTplus(prefill.tradeTplus ?? false);
    setMatchTplus(shouldAutoMatchTplus);
    setDate(prefill.txDate ?? todayYmd());
    setFx(formatThousandsInput(prefill.fxRate != null ? String(prefill.fxRate) : data?.state.usdVnd ? String(data.state.usdVnd) : "25000"));
    setFeeOverride(prefill.id && prefill.fee != null ? formatThousandsInput(String(prefill.fee)) : "");
    setTaxOverride(prefill.id && prefill.tax != null ? formatThousandsInput(String(prefill.tax)) : "");
    setDivTotal(prefill.txType === "CASH_DIVIDEND" && prefill.amount != null ? formatThousandsInput(String(prefill.amount)) : "");
    setStockDivQty(prefill.stockDivQty != null ? formatThousandsInput(String(prefill.stockDivQty)) : "");
    setCorporateActionId(prefill.corporateActionId ?? null);
    setCorporateActionType(prefill.corporateActionType ?? "CASH_DIVIDEND");
    setDistributionPct(
      prefill.distributionPct != null ? String(prefill.distributionPct) : "",
    );
    setSubscriptionPrice(
      prefill.subscriptionPrice != null
        ? formatBrokerPrice(prefill.subscriptionPrice)
        : "",
    );
    setVpsSubscribedQty(
      prefill.vpsSubscribedQty != null
        ? formatThousandsInput(String(prefill.vpsSubscribedQty))
        : "",
    );
    setSsiSubscribedQty(
      prefill.ssiSubscribedQty != null
        ? formatThousandsInput(String(prefill.ssiSubscribedQty))
        : "",
    );
    setRecordDate(prefill.recordDate ?? "");
    setPaymentDate(prefill.paymentDate ?? "");
    setBankPrincipal("");
    setSaveOriginal(Boolean(prefill.createOriginalDeposit));

    const at = prefill.formKind ?? prefill.assetType ?? "STOCK";
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
  const isCorporateAction = txType === "EX_RIGHTS";
  const assetType: AssetType = isBank ? "STOCK" : kind;
  const isOriginalEligible = isBank || ((kind === "DCDS" || kind === "ETF") && txType === "BUY");
  const canSaveOriginal = isOriginalEligible;
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
  const coreQty = holding?.coreQty ?? 0;
  const tplusQty = holding?.openTplusQty ?? 0;
  const totalHeldQty = holding?.quantity ?? 0;
  const openLots = holding?.openLots ?? [];
  const maxSellQty = totalHeldQty;

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
  const stockSymbols = [
    ...new Set(
      (data?.ledger.assets ?? [])
        .filter((asset) => asset.assetType === "STOCK")
        .map((asset) => asset.symbol),
    ),
  ].sort();
  const eligibleCashActions = (data?.ledger.corporateActions ?? []).filter(
    (action) =>
      action.actionType === "CASH_DIVIDEND" &&
      action.symbol === symbol.trim().toUpperCase() &&
      action.exDate <= date,
  );
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

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (isCorporateAction) {
      const sym = symbol.trim().toUpperCase();
      const pct = parseDecimal(distributionPct);
      const subscribedPrice = parseBrokerPrice(subscriptionPrice);
      const vpsQty = parseDecimal(vpsSubscribedQty);
      const ssiQty = parseDecimal(ssiSubscribedQty);
      if (
        !sym ||
        pct <= 0 ||
        (corporateActionType === "RIGHTS_ISSUE" &&
          (subscribedPrice <= 0 ||
            !Number.isInteger(vpsQty) ||
            !Number.isInteger(ssiQty) ||
            vpsQty < 0 ||
            ssiQty < 0))
      ) {
        toast.error("Vui lòng kiểm tra mã và các thông số của sự kiện.");
        return;
      }
      const pin = editing ? await askEditPin() : null;
      if (editing && !pin) return;
      actionMut.mutate(
        {
          data: {
            id: prefill?.id,
            pin: editing ? pin ?? undefined : undefined,
            symbol: sym,
            exDate: date,
            recordDate: recordDate || null,
            paymentDate: paymentDate || null,
            actionType: corporateActionType,
            distributionPct: pct,
            subscriptionPrice:
              corporateActionType === "RIGHTS_ISSUE" ? subscribedPrice : null,
            vpsSubscribedQty:
              corporateActionType === "RIGHTS_ISSUE" ? vpsQty : 0,
            ssiSubscribedQty:
              corporateActionType === "RIGHTS_ISSUE" ? ssiQty : 0,
            notes: name.trim() || undefined,
          },
        },
        { onSuccess: () => close() },
      );
      return;
    }

    let createOriginalDeposit = canSaveOriginal && saveOriginal;
    if (canSaveOriginal && !createOriginalDeposit) {
      const confirmed = window.confirm(
        "Lệnh này chưa được lưu vào Original. Bạn có muốn cộng số tiền của lệnh vào Original không?",
      );
      createOriginalDeposit = confirmed;
    }

    if (isBank) {
      const name = bankName === "Khác" ? bankCustom.trim() : bankName;
      const p = parseVndAmount(bankPrincipal);
      const parsedTerm = Number(bankTerm.trim());
      const parsedRate = parseDecimal(bankRate.trim());

      if (!name || p <= 0 || !bankTerm.trim() || !Number.isFinite(parsedTerm) || parsedTerm <= 0) return;
      if (!bankRate.trim() || !Number.isFinite(parsedRate) || parsedRate < 0) return;

      const pin = editing ? await askEditPin() : null;
      if (editing && !pin) return;

      bankMut.mutate(
        {
          data: {
            bankName: name,
            id: prefill?.id,
            pin: editing ? pin ?? undefined : undefined,
            principal: p,
            startDate: date,
            termMonths: parsedTerm,
            interestRate: parsedRate,
            autoRollover: bankRollover,
            createOriginalDeposit,
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

    if (!editingSell) {
      const sellQuantityValidation = validateSellQuantity({
        txType: txType as TxType,
        qty: parsedQty,
        maxQty: maxSellQty,
      });

      if (!sellQuantityValidation.ok) {
        toast.error(sellQuantityValidation.message ?? "Số lượng bán vượt quá số lượng hiện có.");
        return;
      }

      const validation = validateTplusSellSelection({
        txType,
        matchTplus,
        selectedLotIds,
        openLots,
        parsedQty,
      });

      if (!validation.ok) {
        if (validation.needsCoreSellConfirmation) {
          const confirmed = window.confirm(
            validation.message ?? "Số lượng chọn bán hiện tại chưa đủ. Có bán thêm cổ phiếu gốc không?",
          );
          if (!confirmed) {
            toast.error(validation.message ?? "Số lượng chọn bán hiện tại chưa đủ.");
            return;
          }
        } else {
          toast.error(validation.message ?? "Bạn phải chọn lô T+ trước khi lưu giao dịch Sell.");
          return;
        }
      }
    }

    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    if (assetType === "CRYPTO" && sym === "USDT") {
      toast.error("USDT chỉ dùng để nhập số dư, không hỗ trợ giao dịch.");
      return;
    }
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

    const pin = editing ? await askEditPin() : null;
    if (editing && !pin) return;
    mut.mutate(
      {
        data: {
          id: prefill?.id,
          pin: editing ? pin ?? undefined : undefined,
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
          corporateActionId:
            txType === "CASH_DIVIDEND" ? corporateActionId : null,
          currentPrice: parsedPrice || undefined,
          matches: txType === "SELL" ? matches : undefined,
          createOriginalDeposit,
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
          { value: "EX_RIGHTS", label: "Ngày GDKHQ" },
          ...(editing && prefill?.txType === "CASH_DIVIDEND"
            ? [{ value: "CASH_DIVIDEND", label: "Cổ tức tiền mặt (dữ liệu cũ)" }]
            : []),
          ...(editing && prefill?.txType === "STOCK_DIVIDEND"
            ? [{ value: "STOCK_DIVIDEND", label: "Cổ tức cổ phiếu (dữ liệu cũ)" }]
            : []),
        ]
      : [
          { value: "BUY", label: "Buy" },
          { value: "SELL", label: "Sell" },
        ];

  const saving = mut.isPending || bankMut.isPending || actionMut.isPending;

  return (
    <Dialog open={!!prefill} onOpenChange={(o) => !o && close()}>
        <DialogContent
          title={
            isCorporateAction
              ? editing
                ? "Sửa sự kiện GDKHQ"
                : "Ghi sự kiện GDKHQ"
              : editing
                ? "Sửa giao dịch"
                : "Giao dịch"
          }
          className="max-w-xl"
        >
        <form className="space-y-3" onSubmit={submit}>
        {!editing && !prefill?.assetType && (
          <div className="flex flex-wrap gap-1">
            {TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                                onClick={() => {
                  setKind(t.value);
                  setSaveOriginal(false);
                  if (t.value !== "STOCK" && (txType === "CASH_DIVIDEND" || txType === "STOCK_DIVIDEND")) setTxType("BUY");
                  if (t.value !== "STOCK" && t.value !== "CRYPTO") setTplus(false);
                  setSymbol(defaultSymbolForKind(t.value, ""));
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
                  <Input
                    type="date"
                    value={date}
                    max={todayYmd()}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <Label>Kỳ hạn (tháng)</Label>
                  <Input value={bankTerm} onChange={(e) => setBankTerm(e.target.value)} placeholder="..." required />
                </div>
              </div>
              <div className="space-y-1">
                <Label>Lãi suất (%/năm)</Label>
                <Input value={bankRate} onChange={(e) => setBankRate(e.target.value)} placeholder="..." required />
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label>Tự động tái tục</Label>
                <Switch checked={bankRollover} onCheckedChange={setBankRollover} />
              </div>
              {canSaveOriginal && (
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={saveOriginal} onCheckedChange={(v) => setSaveOriginal(v === true)} />
                  Lưu vào Original
                </label>
              )}
            </>
          ) : (
            <>
              {kind === "STOCK" && !isCorporateAction && (
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
                  <Select
                    value={txType}
                    onValueChange={(v) => setTxType(v as TxEntryType)}
                    options={txOptions}
                    disabled={editingSell}
                  />
                </div>
                <div className="space-y-1">
                  <Label>Ngày</Label>
                  <Input
                    type="date"
                    value={date}
                    max={isCorporateAction ? undefined : todayYmd()}
                    onChange={(e) => setDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Mã</Label>
                  {txType === "SELL" ||
                  (editing &&
                    (txType === "CASH_DIVIDEND" ||
                      txType === "STOCK_DIVIDEND")) ||
                  isCorporateAction ? (
                    <Select
                      value={symbol}
                      onValueChange={(v) => {
                        setSymbol(v);
                        const h = sellHoldings.find((x) => x.symbol === v);
                        const asset = data?.ledger.assets.find(
                          (item) => item.assetType === "STOCK" && item.symbol === v,
                        );
                        if (h) setName(h.name);
                        else if (asset) setName(asset.name);
                      }}
                      placeholder={
                        isCorporateAction ||
                        (editing && txType === "CASH_DIVIDEND")
                          ? "Chọn mã cổ phiếu"
                          : "Chọn mã đang giữ"
                      }
                      options={(
                        isCorporateAction ||
                        (editing && txType === "CASH_DIVIDEND")
                          ? stockSymbols
                          : sellHoldings.map((h) => h.symbol)
                      ).map(
                        (value) => ({ value, label: value }),
                      )}
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

              {isCorporateAction && (
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <p className="text-sm text-muted-foreground">
                    {corporateActionType === "RIGHTS_ISSUE"
                      ? "Nhập lượng đăng ký riêng theo VPS/SSI. Cổ phiếu mua thêm được cộng vào danh mục theo ngày thanh toán (hoặc ngày GDKHQ nếu chưa nhập ngày thanh toán)."
                      : "Sự kiện GDKHQ là nguồn duy nhất ghi nhận cổ tức; tiền mặt được tính gộp trước thuế và cổ phiếu theo lượng đủ điều kiện trước ngày GDKHQ."}
                    {corporateActionType === "STOCK_DIVIDEND" &&
                      " Cổ phiếu thưởng được làm tròn xuống riêng theo từng broker."}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label>Loại phân phối</Label>
                      <Select
                        value={corporateActionType}
                        onValueChange={(value) =>
                          setCorporateActionType(value as CorporateActionType)
                        }
                        disabled={editing}
                        options={[
                          { value: "CASH_DIVIDEND", label: "Cổ tức tiền mặt" },
                          { value: "STOCK_DIVIDEND", label: "Cổ tức cổ phiếu" },
                          { value: "RIGHTS_ISSUE", label: "Quyền mua phát hành thêm" },
                        ]}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>
                        {corporateActionType === "RIGHTS_ISSUE"
                          ? "Tỷ lệ quyền mua (% số CP đang sở hữu)"
                          : "Tỷ lệ cổ tức (%)"}
                      </Label>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={distributionPct}
                        onChange={(e) => setDistributionPct(e.target.value)}
                        placeholder={
                          corporateActionType === "RIGHTS_ISSUE"
                            ? "Ví dụ: 50 (2 CP cũ mua 1 CP mới)"
                            : "Ví dụ: 10"
                        }
                        required
                      />
                    </div>
                    {corporateActionType === "RIGHTS_ISSUE" && (
                      <>
                        <div className="space-y-1">
                          <Label>Giá mua ưu đãi (13.5 = 13.500đ)</Label>
                          <Input
                            value={subscriptionPrice}
                            onChange={setGrouped(setSubscriptionPrice)}
                            required
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Số CP đăng ký mua — VPS</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={vpsSubscribedQty}
                            onChange={(event) =>
                              setVpsSubscribedQty(event.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Số CP đăng ký mua — SSI</Label>
                          <Input
                            type="number"
                            min="0"
                            step="1"
                            value={ssiSubscribedQty}
                            onChange={(event) =>
                              setSsiSubscribedQty(event.target.value)
                            }
                          />
                        </div>
                      </>
                    )}
                    <div className="space-y-1">
                      <Label>Ngày đăng ký cuối cùng</Label>
                      <Input
                        type="date"
                        value={recordDate}
                        onChange={(e) => setRecordDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>Ngày thanh toán</Label>
                      <Input
                        type="date"
                        value={paymentDate}
                        onChange={(e) => setPaymentDate(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              )}

              {editing && txType === "CASH_DIVIDEND" && (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <Label>Cổ tức trước thuế (VND)</Label>
                    <Input value={divTotal} onChange={setGrouped(setDivTotal)} placeholder="1,000,000" />
                    <p className="text-xs text-muted-foreground">
                      Tổng tiền.
                    </p>
                  </div>
                  <div className="space-y-1">
                    <Label>Thuế (VND)</Label>
                    <Input value={taxOverride} onChange={setGrouped(setTaxOverride)} placeholder="50,000" />
                    <p className="text-xs text-muted-foreground">
                      Sẽ được trừ vào tổng tiền.
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label>Gắn với sự kiện GDKHQ (tránh giảm vốn hai lần)</Label>
                    <Select
                      value={corporateActionId ?? "NONE"}
                      onValueChange={(value) =>
                        setCorporateActionId(value === "NONE" ? null : value)
                      }
                      options={[
                        { value: "NONE", label: "Không liên kết" },
                        ...eligibleCashActions.map((action) => ({
                          value: action.id,
                          label: `${action.symbol} · ${action.exDate} · ${action.distributionPct}%`,
                        })),
                      ]}
                    />
                    <p className="mt-2 text-xs text-muted-foreground">
                      Chỉ liên kết khi đây là khoản chi trả của sự kiện đã nhập ở trên.
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">
                      {corporateActionId
                        ? "Sự kiện GDKHQ đã điều chỉnh giá vốn; khoản nhận này chỉ ghi nhận cổ tức, không trừ vốn lần nữa."
                        : "Trừ khỏi vốn của mã (tử số). Original Capital không đổi. Nếu cổ tức lớn hơn vốn còn lại, giá vốn = 0, phần dư là lãi."}
                    </p>
                  </div>
                </div>
              )}

              {editing && txType === "STOCK_DIVIDEND" && (
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
                          readOnly={editingSell}
                          placeholder="..."
                          required
                        />
                        {editingSell && (
                          <p className="text-xs text-muted-foreground">
                            Số lượng bán đã ghi sổ không thể chỉnh sửa.
                          </p>
                        )}
                                                {txType === "SELL" && (
                          <p className="text-xs text-muted-foreground">
                            tối đa {formatQty(maxSellQty, assetType)} ({formatQty(coreQty, assetType)} gốc + {formatQty(tplusQty, assetType)} T+)
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
                  {(kind === "STOCK" || kind === "CRYPTO") &&
                    (txType === "SELL" ? coreQty : coreExcludingThis) > 1e-12 && (
                    <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-primary">Vị thế gốc (Core)</span>
                        <span className="text-xs text-muted-foreground">
                          {formatQty(txType === "BUY" ? coreExcludingThis : coreQty, assetType)} {kind === "CRYPTO" ? "Unit" : "CP"} @ {displayPrice(holding?.adjustedAvgCost ?? 0, assetType, kind === "CRYPTO" ? "USD" : currency, usdVnd)}
                        </span>
                      </div>
                      {(() => {
                        const corePositionQty = txType === "BUY" ? coreExcludingThis : coreQty;
                        const coreAvg = holding?.adjustedAvgCost ?? 0;
                        const referencePrice =
                          txType === "SELL" && parsedPrice > 0
                            ? parsedPrice
                            : holding?.currentPrice ?? 0;
                        const coreMarketValue = corePositionQty * referencePrice;
                        const estimatedSellFee =
                          txType === "SELL"
                            ? (coreMarketValue * defaultFeePct) / 100
                            : 0;
                        const estimatedSellTax =
                          txType === "SELL"
                            ? (coreMarketValue * defaultTaxPct) / 100
                            : 0;
                        const totalCostCore = corePositionQty * coreAvg;
                        const pnlCore =
                          coreMarketValue -
                          estimatedSellFee -
                          estimatedSellTax -
                          totalCostCore;
                        const pctCore = totalCostCore > 0 ? (pnlCore / totalCostCore) * 100 : 0;

                        return (
                          <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                            <span className="text-xs text-muted-foreground">
                              {txType === "BUY" ? "Lãi/lỗ hiện tại" : "Ước tính nếu bán"}
                            </span>
                            <span className={`font-mono font-medium ${signedClass(pctCore)}`}>
                              {formatPct(pctCore)}
                            </span>
                            <span className={`w-full text-lg font-mono font-bold ${signedClass(pnlCore)}`}>
                              {kind === "CRYPTO"
                                ? formatUsd(pnlCore)
                                : displayMoney(pnlCore, currency, usdVnd)}
                            </span>
                          </div>
                        );
                      })()}
                    </div>
                  )}

                                    {showTplusMatchPrompt && (
                    <>
                      <label className="flex items-center gap-2 text-sm mt-1">
                        <Checkbox
                          checked={matchTplus}
                          onCheckedChange={(v) => setMatchTplus(v === true)}
                        />
                        Khớp lệnh T+ — chọn lô BUY T+ bên dưới
                      </label>
                    </>
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
                                                // Đây là preview cho lệnh Sell đang nhập, bao gồm thuế phí
                        const previewSellPrice = parsedPrice > 0 ? parsedPrice : (holding?.currentPrice ?? 0);
                        const buyFeeAlloc = l.qtyOriginal > 0 ? (l.buyFee * l.qtyRemaining) / l.qtyOriginal : 0;
                        const sellNotional = l.qtyRemaining * previewSellPrice;
                        const estSellFee = (sellNotional * defaultFeePct) / 100;
                        const estSellTax = (sellNotional * defaultTaxPct) / 100;

                        const netGross = sellNotional - l.qtyRemaining * l.buyPrice;
                        const pnl = netGross - buyFeeAlloc - estSellFee - estSellTax;
                        const totalCost = l.qtyRemaining * l.buyPrice + buyFeeAlloc;
                        const pct = totalCost > 0 ? (pnl / totalCost) * 100 : 0;
                        return (
                          <label
                            key={l.buyTxId}
                            className={`flex items-start gap-2 text-sm ${locked ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                          >
                            <Checkbox
                              className="mt-0.5 shrink-0"
                              checked={checked}
                              disabled={locked}
                              onCheckedChange={() => toggleLot(l.buyTxId)}
                            />
                            <span className="min-w-0 flex-1 whitespace-normal break-words leading-5">
                              {formatViDate(l.buyDate)} · {formatQty(l.qtyRemaining, assetType)}/{formatQty(l.qtyOriginal, assetType)} @{" "}
                              {displayPrice(l.buyPrice, assetType, currency, usdVnd)}
                              {" · "}
                              <span className={signedClass(pnl)}>{displayMoney(pnl, currency, usdVnd)}</span>
                              {" "}
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
                  {canSaveOriginal && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={saveOriginal} onCheckedChange={(v) => setSaveOriginal(v === true)} />
                      Lưu vào Original
                    </label>
                  )}
                </>
              ) : null}
            </>
          )}

          <Button type="submit" className="w-full" disabled={saving}>
            {saving
              ? "Đang lưu..."
              : isCorporateAction
                ? editing
                  ? "Lưu sự kiện"
                  : "Lưu sự kiện GDKHQ"
                : editing
                  ? "Lưu sửa"
                  : isBank
                    ? "Lưu sổ"
                    : "Ghi sổ"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
