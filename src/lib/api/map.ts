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
        movementDate: String(r.movement_date).slice(0, 10),
    bucket: (r.bucket as CapitalBucket) || "DCDS",
    notes: r.notes ? String(r.notes) : null,
    deletedAt: r.deleted_at ? String(r.deleted_at) : null,
    createdAt: String(r.created_at),
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
    notes: r.notes ? String(r.notes) : null,
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
