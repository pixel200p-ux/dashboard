import { replayPortfolio } from "./replay";
import type { LedgerSnapshot, Transaction } from "./types";

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "txType" | "txDate">): Transaction {
  return {
    accountId: "vps",
    assetId: "vps:TEST",
    quantity: null,
    price: null,
    amount: 0,
    fee: 0,
    tax: 0,
    tradeTplus: false,
    fxRate: null,
    dividendPerShare: null,
    stockDivQty: null,
    notes: null,
    deletedAt: null,
    createdAt: `${partial.txDate}T00:00:00Z`,
    ...partial,
  };
}

/** Spec v3 three-state T+ cycle: 1000 @ 30k → T+ 200 @ 25k → sell 200 @ 26k → new T+ 150 @ 24k. */
export function runTplusSpecExample(): string[] {
  const errors: string[] = [];
  const ledger: LedgerSnapshot = {
    accounts: [{ id: "vps", name: "VPS", kind: "STOCK_VPS", currency: "VND" }],
    assets: [
      {
        id: "vps:TEST",
        accountId: "vps",
        symbol: "TEST",
        name: "Test",
        assetType: "STOCK",
        currency: "VND",
        currentPrice: 26000,
        priceUpdatedAt: null,
      },
    ],
    capital: [
      {
        id: "c1",
        kind: "DEPOSIT",
        amount: 30_000_000,
        fxRate: null,
        movementDate: "2026-01-01",
        bucket: "VPS",
        notes: null,
        deletedAt: null,
        createdAt: "2026-01-01T00:00:00Z",
        sourceType: null,
        sourceId: null,
      },
    ],
    transactions: [
      tx({
        id: "b0",
        txType: "BUY",
        txDate: "2026-01-02",
        quantity: 1000,
        price: 30000,
        amount: 30_000_000,
      }),
      tx({
        id: "b1",
        txType: "BUY",
        txDate: "2026-01-10",
        quantity: 200,
        price: 25000,
        amount: 5_000_000,
        fee: 10000,
        tradeTplus: true,
      }),
    ],
    matches: [],
    banks: [],
    bankRates: [],
    fees: [{ profile: "STOCK_VPS", buyFeePct: 0.15, sellFeePct: 0.15, sellTaxPct: 0.1 }],
    usdVnd: 25000,
  };

  const open = replayPortfolio(ledger, "2026-01-11");
  const card = open.tplusCards[0];
  if (!card) errors.push("open T+ card missing");
  else {
    if (card.openTplusQty !== 200) errors.push(`open qty ${card.openTplusQty} != 200`);
    if (card.coreQty !== 1000) errors.push(`core qty ${card.coreQty} != 1000`);
    if (Math.abs(card.tradePrice - 25000) > 0.5) errors.push(`trade price ${card.tradePrice}`);
    if (Math.abs(card.adjustedAvgCost - 30000) > 0.5) errors.push(`open adj cost ${card.adjustedAvgCost} (must stay 30000 while OPEN)`);
    if (open.holdings[0]?.quantity !== 1200) errors.push(`holdings qty ${open.holdings[0]?.quantity} != 1200`);
  }

  ledger.transactions.push(
    tx({
      id: "s1",
      txType: "SELL",
      txDate: "2026-01-12",
      quantity: 200,
      price: 26000,
      amount: 5_200_000,
      fee: 10000,
      tradeTplus: true,
    }),
  );
  ledger.matches.push({ id: "m1", sellTxId: "s1", buyTxId: "b1", quantity: 200 });

  const closed = replayPortfolio(ledger, "2026-01-13");
  if (closed.tplusCards.length !== 0) errors.push("closed T+ still showing card");
  const h = closed.holdings[0];
  if (!h) errors.push("holding missing after close");
  else {
    if (h.quantity !== 1000) errors.push(`closed qty ${h.quantity}`);
    if (h.openTplusQty !== 0) errors.push(`closed open T+ ${h.openTplusQty}`);
    if (Math.abs(h.adjustedAvgCost - 29820) > 0.51) errors.push(`closed adj ${h.adjustedAvgCost} != 29820`);
    if (Math.abs(h.originalAvgCost - 30000) > 0.51) errors.push(`original avg mutated ${h.originalAvgCost}`);
    if (Math.abs(h.tplusProfitCompleted - 180000) > 0.51) errors.push(`tplus profit ${h.tplusProfitCompleted}`);
  }
  if (closed.originalCapital !== 30_000_000) errors.push("original capital mutated");

  const cryptoOriginal = replayPortfolio(
    {
      ...ledger,
      capital: [
        {
          ...ledger.capital[0],
          id: "crypto-capital",
          amount: 2_000_000,
          fxRate: 20_000,
          bucket: "CRYPTO",
        },
      ],
    },
    "2026-01-13",
  );
  if (cryptoOriginal.originalByBucketUsd.CRYPTO !== 100) {
    errors.push(`crypto original USD ${cryptoOriginal.originalByBucketUsd.CRYPTO} != 100`);
  }

  ledger.transactions.push(
    tx({
      id: "b2",
      txType: "BUY",
      txDate: "2026-01-20",
      quantity: 150,
      price: 24000,
      amount: 3_600_000,
      tradeTplus: true,
    }),
  );
  const cycle3 = replayPortfolio(ledger, "2026-01-21");
  const c3 = cycle3.tplusCards[0];
  if (!c3) errors.push("cycle-3 T+ card missing");
  else {
    if (c3.openTplusQty !== 150) errors.push(`cycle3 open qty ${c3.openTplusQty} != 150`);
    if (c3.coreQty !== 1000) errors.push(`cycle3 core qty ${c3.coreQty} != 1000`);
    if (Math.abs(c3.tradePrice - 24000) > 0.5) errors.push(`cycle3 trade ${c3.tradePrice}`);
    if (Math.abs(c3.adjustedAvgCost - 29820) > 0.51) {
      errors.push(`cycle3 adj ${c3.adjustedAvgCost} != 29820 (prior T+ must keep reducing cost)`);
    }
    if (cycle3.holdings[0]?.quantity !== 1150) errors.push(`cycle3 holdings ${cycle3.holdings[0]?.quantity} != 1150`);
  }

  const dividendLedger: LedgerSnapshot = {
    ...ledger,
    transactions: [
      tx({
        id: "old-buy",
        txType: "BUY",
        txDate: "2026-02-01",
        quantity: 50,
        price: 10000,
      }),
      tx({
        id: "old-sell",
        txType: "SELL",
        txDate: "2026-02-02",
        quantity: 50,
        price: 12000,
      }),
      tx({
        id: "current-buy",
        txType: "BUY",
        txDate: "2026-02-03",
        quantity: 60,
        price: 15000,
      }),
      tx({
        id: "cash-dividend",
        txType: "CASH_DIVIDEND",
        txDate: "2026-02-04",
        amount: 250000,
        tax: 10000,
      }),
    ],
    matches: [],
  };
  const afterCashDividend = replayPortfolio(dividendLedger, "2026-02-05").holdings[0];
  if (!afterCashDividend) errors.push("holding missing after cash dividend");
  else {
    if (afterCashDividend.buyLotCosts.length !== 1) {
      errors.push(`open buy lots ${afterCashDividend.buyLotCosts.length} != 1 after earlier lot was sold`);
    } else {
      const currentLot = afterCashDividend.buyLotCosts[0];
      if (currentLot.buyTxId !== "current-buy") errors.push(`adjusted lot id ${currentLot.buyTxId} != current-buy`);
      if (Math.abs(currentLot.adjustedPrice - 11000) > 0.5) {
        errors.push(`cash dividend adjusted price ${currentLot.adjustedPrice} != 11000`);
      }
    }
  }

  const stockDividendLedger: LedgerSnapshot = {
    ...dividendLedger,
    transactions: [
      tx({
        id: "stock-buy",
        txType: "BUY",
        txDate: "2026-03-01",
        quantity: 60,
        price: 15000,
      }),
      tx({
        id: "stock-dividend",
        txType: "STOCK_DIVIDEND",
        txDate: "2026-03-02",
        stockDivQty: 60,
      }),
      tx({
        id: "paid-issuance",
        txType: "BUY",
        txDate: "2026-03-03",
        quantity: 10,
        price: 8000,
      }),
    ],
  };
  const afterStockDividend = replayPortfolio(stockDividendLedger, "2026-03-04").holdings[0];
  if (!afterStockDividend) errors.push("holding missing after stock dividend");
  else {
    const stockLot = afterStockDividend.buyLotCosts.find((lot) => lot.buyTxId === "stock-buy");
    const paidIssueLot = afterStockDividend.buyLotCosts.find((lot) => lot.buyTxId === "paid-issuance");
    if (!stockLot || Math.abs(stockLot.adjustedPrice - 7500) > 0.5) {
      errors.push(`stock dividend adjusted price ${stockLot?.adjustedPrice} != 7500`);
    }
    if (!paidIssueLot || Math.abs(paidIssueLot.adjustedPrice - 8000) > 0.5) {
      errors.push(`paid issuance price ${paidIssueLot?.adjustedPrice} != 8000`);
    }
  }

  return errors;
}
