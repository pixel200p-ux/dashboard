import test from "node:test";
import assert from "node:assert/strict";
import { resolveRefreshPrice } from "../src/lib/market-refresh.js";

test("refresh uses live market prices for stock/ETF/crypto and last known value for DCDS", () => {
  const stock = { assetType: "STOCK", symbol: "VHM", currentPrice: 0 };
  const etf = { assetType: "ETF", symbol: "ETFVN", currentPrice: 0 };
  const crypto = { assetType: "CRYPTO", symbol: "BTC", currentPrice: 0 };
  const dcds = { assetType: "DCDS", symbol: "DCDS", currentPrice: 24500 };

  assert.equal(resolveRefreshPrice(stock, { VHM: 123 }, {}, {}), 123);
  assert.equal(resolveRefreshPrice(etf, { ETFVN: 42 }, {}), 42);
  assert.equal(resolveRefreshPrice(crypto, {}, { BTC: 67000 }), 67000);
  assert.equal(resolveRefreshPrice(dcds, {}, {}, {}), 24500);
});
