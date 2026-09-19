import test from "node:test";
import assert from "node:assert/strict";
import { summarizeMarketStatus } from "../src/lib/market-status.js";

test("market status summary reports each source individually", () => {
  const result = summarizeMarketStatus({
    usdVnd: { ok: true, label: "USD/VND", detail: "25.000" },
    dcds: { ok: false, label: "DCDS", detail: "Fmarket timeout" },
    stockEtf: { ok: true, label: "Stock/ETF", detail: "7 mã" },
    crypto: { ok: false, label: "Crypto", detail: "Coingecko lỗi" },
  });

  assert.match(result, /USD\/VND: thành công/);
  assert.match(result, /DCDS: thất bại/);
  assert.match(result, /Stock\/ETF: thành công/);
  assert.match(result, /Crypto: thất bại/);
});
