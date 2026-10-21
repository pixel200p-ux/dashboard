import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { resolve } from "node:path";
import { createServer } from "vite";

/** @typedef {import("../src/engine/types").LedgerSnapshot} LedgerSnapshot */
/** @typedef {import("../src/engine/types").BankDeposit} BankDeposit */

/** @type {import("vite").ViteDevServer | undefined} */
let vite;
/** @type {(snapshot: LedgerSnapshot, asOf?: string) => import("../src/engine/types").PortfolioState} */
let replayPortfolio = () => {
  throw new Error("Portfolio replay module was not loaded.");
};

before(async () => {
  vite = await createServer({
    configFile: false,
    root: process.cwd(),
    appType: "custom",
    resolve: { alias: { "@": resolve(process.cwd(), "src") } },
    server: { middlewareMode: true },
  });
  ({ replayPortfolio } = await vite.ssrLoadModule("/src/engine/replay.ts"));
});

after(async () => {
  await vite?.close();
});

/**
 * @param {Partial<BankDeposit>} overrides
 * @returns {BankDeposit}
 */
function bank(overrides = {}) {
  return {
    id: "bank-1",
    bankName: "Test Bank",
    principal: 1_000_000,
    startDate: "2026-10-01",
    termMonths: 12,
    interestRate: 36.5,
    autoRollover: false,
    status: "ACTIVE",
    redeemedAt: null,
    redeemedPrincipal: null,
    redeemedInterest: null,
    notes: null,
    deletedAt: null,
    createdAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * @param {{ bank?: BankDeposit, capitalDate?: string }} overrides
 * @returns {LedgerSnapshot}
 */
function ledger({ bank: deposit, capitalDate = "2026-10-01" } = {}) {
  return {
    accounts: [],
    assets: [],
    capital: [
      {
        id: "capital-1",
        kind: "DEPOSIT",
        amount: 1_000_000,
        fxRate: null,
        movementDate: capitalDate,
        bucket: "BANK",
        notes: null,
        deletedAt: null,
        createdAt: `${capitalDate}T00:00:00Z`,
        sourceType: "BANK",
        sourceId: "bank-1",
      },
    ],
    transactions: [],
    corporateActions: [],
    matches: [],
    banks: deposit ? [deposit] : [bank()],
    bankRates: [],
    fees: [],
    usdtBalance: 0,
    usdtBalanceHistory: [],
    usdVnd: 25_000,
  };
}

test("active deposits exclude current-period accrued interest from NAV", () => {
  const state = replayPortfolio(ledger(), "2026-10-21");

  assert.equal(state.originalCapital, 1_000_000);
  assert.equal(state.bankInterest, 20_000);
  assert.equal(state.bankValue, 1_000_000);
  assert.equal(state.nav, 1_000_000);
  assert.equal(state.totalPnl, 0);
});

test("auto-rollover NAV includes capitalized interest but excludes current-period interest", () => {
  const state = replayPortfolio(
    ledger({
      bank: bank({
        startDate: "2025-10-01",
        autoRollover: true,
      }),
    }),
    "2026-10-11",
  );

  assert.equal(state.bankInterest, 378_650);
  assert.equal(state.bankValue, 1_365_000);
});

test("redeemed deposits remain in historical NAV until their redemption date", () => {
  const redeemed = bank({
    status: "REDEEMED",
    redeemedAt: "2026-10-20",
    redeemedPrincipal: 1_000_000,
    redeemedInterest: 19_000,
  });
  const beforeRedemption = replayPortfolio(
    ledger({ bank: redeemed }),
    "2026-10-19",
  );
  const afterRedemption = replayPortfolio(
    ledger({ bank: redeemed }),
    "2026-10-21",
  );

  assert.equal(beforeRedemption.bankValue, 1_000_000);
  assert.equal(afterRedemption.bankValue, 0);
  assert.equal(afterRedemption.bankInterest, 19_000);
});

test("future-dated capital and deposits are excluded from historical NAV", () => {
  const state = replayPortfolio(
    ledger({
      bank: bank({ startDate: "2026-10-22" }),
      capitalDate: "2026-10-22",
    }),
    "2026-10-21",
  );

  assert.equal(state.originalCapital, 0);
  assert.equal(state.bankValue, 0);
  assert.equal(state.nav, 0);
});
