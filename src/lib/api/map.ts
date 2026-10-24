import { num } from "@/engine/money";
import type {
  Account,
  AccountKind,
  Asset,
  AssetType,
  BankDeposit,
  BankRateUpdate,
  BankStatus,
  CapitalBucket,
  CapitalKind,
  CapitalMovement,
  CorporateAction,
  CorporateActionType,
  FeeProfile,
  FeeSetting,
  TplusMatch,
  Transaction,
  TxType,
} from "@/engine/types";

export function n(v: unknown): number {
  return num(v);
}

export function mapAccount(r: Record<string, unknown>): Account {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: r.kind as AccountKind,
    currency: String(r.currency),
  };
}

export function mapAsset(r: Record<string, unknown>): Asset {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    symbol: String(r.symbol),
    name: String(r.name ?? ""),
    assetType: r.asset_type as AssetType,
    currency: String(r.currency),
    currentPrice: r.current_price == null ? null : n(r.current_price),
    priceUpdatedAt: r.price_updated_at ? String(r.price_updated_at) : null,
  };
}

export function mapCapital(r: Record<string, unknown>): CapitalMovement {
  return {
    id: String(r.id),
    kind: r.kind as CapitalKind,
    amount: n(r.amount),
    fxRate: r.fx_rate == null ? null : n(r.fx_rate),
        movementDate: String(r.movement_date).slice(0, 10),
    bucket: (r.bucket as CapitalBucket) || "DCDS",
    notes: r.notes ? String(r.notes) : null,
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at),
    sourceType: r.source_type === "TRANSACTION" || r.source_type === "BANK" ? r.source_type : null,
    sourceId: r.source_id ? String(r.source_id) : null,
  };
}

export function mapTx(r: Record<string, unknown>): Transaction {
  return {
    id: String(r.id),
    accountId: String(r.account_id),
    assetId: r.asset_id ? String(r.asset_id) : null,
    txType: r.tx_type as TxType,
    txDate: String(r.tx_date).slice(0, 10),
    quantity: r.quantity == null ? null : n(r.quantity),
    price: r.price == null ? null : n(r.price),
    amount: n(r.amount),
    fee: n(r.fee),
    tax: n(r.tax),
    tradeTplus: Boolean(r.trade_tplus),
    fxRate: r.fx_rate == null ? null : n(r.fx_rate),
    dividendPerShare: r.dividend_per_share == null ? null : n(r.dividend_per_share),
    stockDivQty: r.stock_div_qty == null ? null : n(r.stock_div_qty),
    corporateActionId: r.corporate_action_id ? String(r.corporate_action_id) : null,
    notes: r.notes ? String(r.notes) : null,
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at),
  };
}

export function mapCorporateAction(r: Record<string, unknown>): CorporateAction {
  return {
    id: String(r.id),
    symbol: String(r.symbol),
    exDate: String(r.ex_date).slice(0, 10),
    recordDate: r.record_date ? String(r.record_date).slice(0, 10) : null,
    paymentDate: r.payment_date ? String(r.payment_date).slice(0, 10) : null,
    actionType: r.action_type as CorporateActionType,
    distributionPct: n(r.distribution_pct),
    referencePrice: r.reference_price == null ? null : n(r.reference_price),
    subscriptionPrice:
      r.subscription_price == null ? null : n(r.subscription_price),
    vpsSubscribedQty: n(r.vps_subscribed_qty),
    ssiSubscribedQty: n(r.ssi_subscribed_qty),
    notes: r.notes ? String(r.notes) : null,
    source: r.source === "AUTO" ? "AUTO" : "MANUAL",
    sourceKey: r.source_key ? String(r.source_key) : null,
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at),
  };
}

export function mapMatch(r: Record<string, unknown>): TplusMatch {
  return {
    id: String(r.id),
    sellTxId: String(r.sell_tx_id),
    buyTxId: String(r.buy_tx_id),
    quantity: n(r.quantity),
  };
}

export function mapBank(r: Record<string, unknown>): BankDeposit {
  return {
    id: String(r.id),
    bankName: String(r.bank_name),
    principal: n(r.principal),
    startDate: String(r.start_date).slice(0, 10),
    termMonths: n(r.term_months),
    interestRate: n(r.interest_rate),
    autoRollover: Boolean(r.auto_rollover),
    status: r.status as BankStatus,
    redeemedAt: r.redeemed_at ? String(r.redeemed_at).slice(0, 10) : null,
    redeemedPrincipal: r.redeemed_principal == null ? null : n(r.redeemed_principal),
    redeemedInterest: r.redeemed_interest == null ? null : n(r.redeemed_interest),
    notes: r.notes ? String(r.notes) : null,
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at),
  };
}

export function mapBankRate(r: Record<string, unknown>): BankRateUpdate {
  return {
    id: String(r.id),
    depositId: String(r.deposit_id),
    periodNumber: n(r.period_number),
    interestRate: n(r.interest_rate),
  };
}

export function mapFee(r: Record<string, unknown>): FeeSetting {
  return {
    profile: r.profile as FeeProfile,
    buyFeePct: n(r.buy_fee_pct),
    sellFeePct: n(r.sell_fee_pct),
    sellTaxPct: n(r.sell_tax_pct),
  };
}
