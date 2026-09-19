/**
 * Resolve the price used during a single button-triggered market refresh.
 * Stock / ETF / Crypto use the live market fetch result if available.
 * DCDS uses the latest stored value, because there is no realtime public feed in this app.
 *
 * @param {{ assetType?: string, symbol?: string | null, currentPrice?: number | null }} asset
 * @param {Record<string, number> | undefined} stockPx
 * @param {Record<string, number> | undefined} cryptoPx
 * @returns {number | undefined}
 */
export function resolveRefreshPrice(asset, stockPx, cryptoPx) {
  if (!asset) return undefined;

  const assetSymbol = typeof asset.symbol === "string" ? asset.symbol.toUpperCase() : "";

  if (asset.assetType === "CRYPTO") {
    if (!assetSymbol || !cryptoPx) return undefined;
    const value = cryptoPx[assetSymbol];
    return typeof value === "number" && value > 0 ? value : undefined;
  }

  if (asset.assetType === "STOCK" || asset.assetType === "ETF") {
    if (!assetSymbol || !stockPx) return undefined;
    const value = stockPx[assetSymbol];
    return typeof value === "number" && value > 0 ? value : undefined;
  }

  if (asset.assetType === "DCDS") {
    return typeof asset.currentPrice === "number" && asset.currentPrice > 0 ? asset.currentPrice : undefined;
  }

  return undefined;
}
