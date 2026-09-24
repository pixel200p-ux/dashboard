import test from 'node:test';
import assert from 'node:assert/strict';
import { validateTplusSellSelection } from '../src/lib/tx-validation.js';

test('prompts to sell additional core shares when selected T+ lots are insufficient', () => {
  const result = validateTplusSellSelection({
    txType: 'SELL',
    matchTplus: true,
    selectedLotIds: ['lot-1'],
    openLots: [{ buyTxId: 'lot-1', qtyRemaining: 400 }],
    parsedQty: 600,
  });

  assert.equal(result.ok, false);
  assert.equal(result.needsCoreSellConfirmation, true);
  assert.match(result.message, /Có bán thêm cổ phiếu gốc không\?/i);
});

test('allows submit when selected T+ lots fully cover the sell quantity', () => {
  const result = validateTplusSellSelection({
    txType: 'SELL',
    matchTplus: true,
    selectedLotIds: ['lot-1', 'lot-2'],
    openLots: [
      { buyTxId: 'lot-1', qtyRemaining: 400 },
      { buyTxId: 'lot-2', qtyRemaining: 200 },
    ],
    parsedQty: 600,
  });

  assert.equal(result.ok, true);
  assert.equal(result.message, undefined);
});
