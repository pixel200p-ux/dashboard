import test from "node:test";
import assert from "node:assert/strict";
import { defaultSymbolForKind } from "../src/lib/tx-defaults.js";

test("DCDS and ETF default to their own code but remain editable", () => {
  assert.equal(defaultSymbolForKind("DCDS", undefined), "DCDS");
  assert.equal(defaultSymbolForKind("ETF", undefined), "ETF");
  assert.equal(defaultSymbolForKind("DCDS", "DCDS"), "DCDS");
  assert.equal(defaultSymbolForKind("ETF", "FUND-X"), "FUND-X");
  assert.equal(defaultSymbolForKind("STOCK", undefined), "");
});
