import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTplusSellSelection } from '../src/lib/tx-validation.js';

test('requires a selected T+ lot when matching T+ on sell', () => {
  const result = validateTplusSellSelection({
    txType: 'SELL',
    matchTplus: true,
    selectedLotIds: [],
    openLots: [{ buyTxId: 'lot-1', qtyRemaining: 5 }],
    parsedQty: 3,
  });

  assert.equal(result.ok, false);
  assert.match(result.message, /chọn.*lô/i);
});

test('allows submit when T+ is matched to a selected lot', () => {
  const result = validateTplusSellSelection({
    txType: 'SELL',
    matchTplus: true,
    selectedLotIds: ['lot-1'],
    openLots: [{ buyTxId: 'lot-1', qtyRemaining: 5 }],
    parsedQty: 3,
  });

  assert.equal(result.ok, true);
  assert.equal(result.message, undefined);
});
