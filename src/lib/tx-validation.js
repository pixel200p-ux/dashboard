/**
 * @typedef {{ buyTxId: string, qtyRemaining: number }} OpenLot
 */

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

  if (selectedLotIds.length === 0) {
    return {
      ok: false,
      message: 'Bạn phải chọn ít nhất 1 lô T+ trước khi lưu giao dịch Sell.',
    };
  }

  const selectedQty = selectedLotIds.reduce((sum, id) => {
    const lot = openLots.find((item) => item.buyTxId === id);
    return sum + (lot?.qtyRemaining ?? 0);
  }, 0);

  if (parsedQty > 0 && selectedQty < parsedQty) {
    return {
      ok: false,
      message: 'Số lượng lô T+ đã chọn chưa đủ cho khối lượng bán.',
    };
  }

  return { ok: true };
}
