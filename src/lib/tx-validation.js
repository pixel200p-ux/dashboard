/**
 * @typedef {{ buyTxId: string, qtyRemaining: number }} OpenLot
 */

/**
 * @param {{ txType: string, qty?: number, maxQty?: number }} params
 */
export function validateSellQuantity({ txType, qty = 0, maxQty = 0 }) {
  if (txType !== 'SELL') {
    return { ok: true };
  }

  if (qty > maxQty) {
    return {
      ok: false,
      message: `Số lượng bán vượt quá số lượng hiện có (${qty} > ${maxQty}).`,
    };
  }

  return { ok: true };
}

/**
 * @param {{
 *   txType: string,
 *   matchTplus: boolean,
 *   selectedLotIds?: string[],
 *   openLots?: OpenLot[],
 *   parsedQty?: number,
 * }} params
 */
export function validateTplusSellSelection({
  txType,
  matchTplus,
  selectedLotIds = [],
  openLots = [],
  parsedQty = 0,
}) {
  if (txType !== 'SELL' || !matchTplus) {
    return { ok: true };
  }

  const selectedQty = selectedLotIds.reduce((sum, id) => {
    const lot = openLots.find((item) => item.buyTxId === id);
    return sum + (lot?.qtyRemaining ?? 0);
  }, 0);

  if (parsedQty > 0 && selectedQty < parsedQty) {
    return {
      ok: false,
      needsCoreSellConfirmation: true,
      message:
        'Số lượng chọn bán hiện tại chưa đủ. Có bán thêm cổ phiếu gốc không?',
    };
  }

  return { ok: true };
}
