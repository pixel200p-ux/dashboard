import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateEditedSellQuantity,
  validateSellQuantity,
  validateTplusSellSelection,
} from '../src/lib/tx-validation.js';

test('rejects sell quantities above the currently held amount', () => {
  const result = validateSellQuantity({
    txType: 'SELL',
    qty: 600,
    maxQty: 500,
  });

  assert.equal(result.ok, false);
  assert.match(result.message ?? '', /vượt quá số lượng hiện có/i);
});

test('allows editing a sell while keeping its original quantity and type', () => {
  const result = validateEditedSellQuantity({
    originalTxType: 'SELL',
    txType: 'SELL',
    originalQty: 500,
    quantity: 500,
  });

  assert.equal(result.ok, true);
});

test('rejects changing the quantity or type of an existing sell', () => {
  for (const change of [
    { txType: 'SELL', quantity: 400 },
    { txType: 'BUY', quantity: 500 },
  ]) {
    const result = validateEditedSellQuantity({
      originalTxType: 'SELL',
      originalQty: 500,
      ...change,
    });

    assert.equal(result.ok, false);
    assert.match(result.message ?? '', /Không thể đổi loại hoặc số lượng/i);
  }
});

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
