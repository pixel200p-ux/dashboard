import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createServer } from "vite";

/** @typedef {import("../src/engine/types").LedgerSnapshot} LedgerSnapshot */
/** @typedef {import("../src/engine/types").Transaction} Transaction */
/** @typedef {import("../src/engine/types").CorporateAction} CorporateAction */
/** @typedef {import("../src/engine/types").CorporateActionType} CorporateActionType */
/** @typedef {import("../src/engine/types").PortfolioState} PortfolioState */

/** @type {import("vite").ViteDevServer | undefined} */
let vite;
/** @type {((snapshot: LedgerSnapshot, asOf?: string) => PortfolioState) | undefined} */
let replayPortfolio;

before(async () => {
  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    server: { middlewareMode: true },
  });
  ({ replayPortfolio } = await vite.ssrLoadModule("/src/engine/replay.ts"));
});

after(async () => {
  await vite?.close();
});

/**
 * @param {LedgerSnapshot} snapshot
 * @param {string} asOf
 * @returns {PortfolioState}
 */
function replay(snapshot, asOf) {
  if (!replayPortfolio) throw new Error("Replay module was not loaded.");
  return replayPortfolio(snapshot, asOf);
}

/**
 * @param {Transaction[]} transactions
 * @param {CorporateAction} action
 * @returns {LedgerSnapshot}
 */
function ledger(transactions, action) {
  return {
    accounts: [
      { id: "vps", name: "VPS", kind: "STOCK_VPS", currency: "VND" },
    ],
    assets: [
      {
        id: "vps:ABC",
        accountId: "vps",
        symbol: "ABC",
        name: "ABC",
        assetType: "STOCK",
        currency: "VND",
        currentPrice: 19_000,
        priceUpdatedAt: null,
      },
    ],
    usdtBalance: 0,
    usdtBalanceHistory: [],
    capital: [],
    transactions,
    corporateActions: [action],
    matches: [],
    banks: [],
    bankRates: [],
    fees: [],
    usdVnd: 25_000,
  };
}

/**
 * @param {string} id
 * @param {Transaction["txType"]} txType
 * @param {string} txDate
 * @param {number | null} quantity
 * @param {number | null} price
 * @param {Partial<Transaction>} [extra]
 * @returns {Transaction}
 */
function tx(id, txType, txDate, quantity, price, extra = {}) {
  return {
    id,
    accountId: "vps",
    assetId: "vps:ABC",
    txType,
    txDate,
    quantity,
    price,
    amount: 0,
    fee: 0,
    tax: 0,
    tradeTplus: false,
    fxRate: null,
    dividendPerShare: null,
    stockDivQty: null,
    corporateActionId: null,
    notes: null,
    deletedAt: null,
    createdAt: `${txDate}T01:00:00Z`,
    ...extra,
  };
}

/**
 * @param {CorporateActionType} actionType
 * @param {number} distributionPct
 * @param {number} [referencePrice]
 * @returns {CorporateAction}
 */
function action(actionType, distributionPct, referencePrice = 20_000) {
  return {
    id: "ca-1",
    symbol: "ABC",
    exDate: "2026-01-03",
    recordDate: null,
    paymentDate: null,
    actionType,
    distributionPct,
    referencePrice,
    notes: null,
    source: "MANUAL",
    sourceKey: null,
    deletedAt: null,
    createdAt: "2026-01-01T00:00:00Z",
  };
}

/**
 * @param {PortfolioState} state
 */
function holdingFrom(state) {
  const holding = state.holdings[0];
  if (!holding) throw new Error("Expected a stock holding.");
  return holding;
}

/**
 * @param {PortfolioState["holdings"][number]} holding
 * @param {string} buyTxId
 */
function adjustedLotPrice(holding, buyTxId) {
  const lot = holding.buyLotCosts.find((item) => item.buyTxId === buyTxId);
  if (!lot) throw new Error(`Expected adjusted buy lot ${buyTxId}.`);
  return lot.adjustedPrice;
}

test("cash action adjusts eligible holdings, not ex-date buys, and replays later sells", () => {
  const snapshot = ledger(
    [
      tx("buy-before", "BUY", "2026-01-01", 100, 20_000),
      tx("sell-before", "SELL", "2026-01-02", 25, 21_000),
      tx("buy-on-ex-date", "BUY", "2026-01-03", 100, 20_000),
      tx("sell-after", "SELL", "2026-01-04", 50, 18_000),
    ],
    action("CASH_DIVIDEND", 10),
  );

  const state = replay(snapshot, "2026-01-05");
  const holding = holdingFrom(state);

  assert.equal(holding.quantity, 125);
  assert.equal(adjustedLotPrice(holding, "buy-before"), 19_000);
  assert.equal(adjustedLotPrice(holding, "buy-on-ex-date"), 20_000);
  assert.ok(Math.abs(holding.realizedTradePnl - -53_571.42857142858) < 1);
});

test("linked cash payment does not reduce cost basis a second time", () => {
  const transactions = [
    tx("buy-before", "BUY", "2026-01-01", 100, 20_000),
    tx("cash-payment", "CASH_DIVIDEND", "2026-01-04", null, null, {
      amount: 100_000,
      corporateActionId: "ca-1",
    }),
  ];
  const state = replay(
    ledger(transactions, action("CASH_DIVIDEND", 10)),
    "2026-01-05",
  );

  const holding = holdingFrom(state);
  assert.equal(holding.adjustedAvgCost, 19_000);
  assert.equal(holding.cashDividend, 100_000);
});

test("stock action increases only shares held before ex-date", () => {
  const snapshot = ledger(
    [
      tx("buy-before", "BUY", "2026-01-01", 15, 10_000),
      tx("buy-on-ex-date", "BUY", "2026-01-03", 10, 10_000),
    ],
    action("STOCK_DIVIDEND", 10, 10_000),
  );
  const asset = snapshot.assets[0];
  if (!asset) throw new Error("Expected the test stock asset.");
  asset.currentPrice = 9_000;

  const holding = holdingFrom(replay(snapshot, "2026-01-04"));

  assert.ok(Math.abs(holding.quantity - 26) < 1e-8);
  assert.equal(holding.stockDividendQty, 1);
  assert.ok(
    Math.abs(
      adjustedLotPrice(holding, "buy-before") -
        9_375,
    ) < 1e-8,
  );
  assert.equal(adjustedLotPrice(holding, "buy-on-ex-date"), 10_000);
});

test("stock entitlement is rounded down separately for each broker account", () => {
  const snapshot = ledger(
    [
      tx("vps-buy", "BUY", "2026-01-01", 9, 10_000),
      tx("ssi-buy", "BUY", "2026-01-01", 9, 10_000, {
        accountId: "ssi",
        assetId: "ssi:ABC",
      }),
    ],
    action("STOCK_DIVIDEND", 10, 10_000),
  );
  snapshot.accounts.push({
    id: "ssi",
    name: "SSI",
    kind: "STOCK_SSI",
    currency: "VND",
  });
  const vpsAsset = snapshot.assets[0];
  if (!vpsAsset) throw new Error("Expected the VPS test stock asset.");
  snapshot.assets.push({
    ...vpsAsset,
    id: "ssi:ABC",
    accountId: "ssi",
  });

  const holdings = replay(snapshot, "2026-01-04").holdings;

  assert.equal(holdings.length, 2);
  assert.ok(holdings.every((holding) => holding.quantity === 9));
  assert.ok(holdings.every((holding) => holding.stockDividendQty === 0));
});
