export type AccountKind = "STOCK_VPS" | "STOCK_SSI" | "CRYPTO" | "ETF" | "DCDS" | "BANK";
export type AssetType = "STOCK" | "ETF" | "DCDS" | "CRYPTO";
export type TxType = "BUY" | "SELL" | "CASH_DIVIDEND" | "STOCK_DIVIDEND";
export type CapitalKind = "DEPOSIT" | "WITHDRAW";
export const CAPITAL_BUCKETS = ["DCDS", "ETF", "VPS", "SSI", "CRYPTO", "BANK"] as const;
export type CapitalBucket = (typeof CAPITAL_BUCKETS)[number];
export type BankStatus = "ACTIVE" | "REDEEMED";
export type FeeProfile = "STOCK_VPS" | "STOCK_SSI" | "CRYPTO" | "DCDS" | "ETF";

export interface Account {
  id: string;
  name: string;
  kind: AccountKind;
  currency: string;
}

export interface Asset {
  id: string;
  accountId: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: string;
  currentPrice: number | null;
  priceUpdatedAt: string | null;
}

export interface CapitalMovement {
  id: string;
  kind: CapitalKind;
  amount: number;
  fxRate: number | null;
  movementDate: string;
  bucket: CapitalBucket;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
  sourceType: "TRANSACTION" | "BANK" | null;
  sourceId: string | null;
}

export interface Transaction {
  id: string;
  accountId: string;
  assetId: string | null;
  txType: TxType;
  txDate: string;
  quantity: number | null;
  price: number | null;
  amount: number;
  fee: number;
  tax: number;
  tradeTplus: boolean;
  fxRate: number | null;
  dividendPerShare: number | null;
  stockDivQty: number | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface TplusMatch {
  id: string;
  sellTxId: string;
  buyTxId: string;
  quantity: number;
}

export interface BankDeposit {
  id: string;
  bankName: string;
  principal: number;
  startDate: string;
  termMonths: number;
  interestRate: number;
  autoRollover: boolean;
  status: BankStatus;
  redeemedAt: string | null;
  redeemedPrincipal: number | null;
  redeemedInterest: number | null;
  notes: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export interface BankRateUpdate {
  id: string;
  depositId: string;
  periodNumber: number;
  interestRate: number;
}

export interface FeeSetting {
  profile: FeeProfile;
  buyFeePct: number;
  sellFeePct: number;
  sellTaxPct: number;
}

export interface LedgerSnapshot {
  accounts: Account[];
  assets: Asset[];
  capital: CapitalMovement[];
  transactions: Transaction[];
  matches: TplusMatch[];
  banks: BankDeposit[];
  bankRates: BankRateUpdate[];
  fees: FeeSetting[];
  usdVnd: number;
}

export interface OpenTplusLot {
  buyTxId: string;
  buyDate: string;
  qtyRemaining: number;
  qtyOriginal: number;
  buyPrice: number;
  buyFee: number;
  fxRate: number | null;
}

export interface TplusCycleRecord {
  id: string;
  assetId: string;
  symbol: string;
  accountId: string;
  accountName: string;
  buyTxId: string;
  sellTxId: string;
  buyDate: string;
  sellDate: string;
  holdingBefore: number;
  buyQuantity: number;
  buyPrice: number;
  sellQuantity: number;
  sellPrice: number;
  fees: number;
  tax: number;
  grossProfit: number;
  netProfit: number;
  avgCostBefore: number;
  avgCostAfter: number;
  costReduction: number;
  remainingHolding: number;
  remainingUnrealized: number;
  status: "COMPLETED" | "PARTIAL";
}

export interface HoldingView {
  assetId: string;
  accountId: string;
  accountName: string;
  accountKind: AccountKind;
  symbol: string;
  name: string;
  assetType: AssetType;
  currency: string;
  coreQty: number;
  openTplusQty: number;
  quantity: number;
  originalAvgCost: number;
  adjustedAvgCost: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  realizedTradePnl: number;
    cashDividend: number;
  stockDividendQty: number;
  tplusProfitCompleted: number;
  totalInvested: number;
  openLots: OpenTplusLot[];
  buyLotCosts: { buyTxId: string; remainingQty: number; adjustedPrice: number }[];
}

export interface BankView {
  id: string;
  bankName: string;
  originalPrincipal: number;
  currentPrincipal: number;
  startDate: string;
  currentPeriodStart: string;
  maturityDate: string;
  termMonths: number;
  currentRate: number;
  originalRate: number;
  autoRollover: boolean;
  renewalCount: number;
  accumulatedInterest: number;
  remainingDays: number;
  rateUnconfirmed: boolean;
  status: BankStatus;
  notes: string | null;
}

export interface TplusCard {
  assetId: string;
  accountId: string;
  accountName: string;
  symbol: string;
  name: string;
  assetType: AssetType;
  coreQty: number;
  openTplusQty: number;
  tradePrice: number;
  originalAvgCost: number;
  adjustedAvgCost: number;
  currentPrice: number;
  suggestedSell: number;
  breakEvenPrice: number;
  remainingUnrealized: number;
  tplusProfitCompleted: number;
  openLots: OpenTplusLot[];
}

export interface PortfolioState {
  asOf: string;
    originalCapital: number;
  originalByBucket: Record<CapitalBucket, number>;
  originalByBucketUsd: Record<CapitalBucket, number>;
  nav: number;
  navByBucket: Record<CapitalBucket, number>;
  tplusByBucket: { VPS: number; SSI: number; CRYPTO: number };
  totalPnl: number;
  totalReturnPct: number;
  realizedTradePnl: number;
  unrealizedPnl: number;
  cashDividend: number;
  stockDividendQty: number;
  tplusProfit: number;
  bankInterest: number;
  bankValue: number;
  usdVnd: number;
  holdings: HoldingView[];
  banks: BankView[];
  redeemedBanks: BankView[];
  tplusCards: TplusCard[];
  tplusHistory: TplusCycleRecord[];
  allocation: Record<string, { value: number; pct: number }>;
}
