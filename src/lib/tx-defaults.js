/**
 * @param {"DCDS" | "ETF" | string | undefined} kind
 * @param {string | undefined} explicitSymbol
 * @returns {string}
 */
export function defaultSymbolForKind(kind, explicitSymbol) {
  const value = typeof explicitSymbol === "string" ? explicitSymbol.trim() : "";
  if (value) return value.toUpperCase();
  if (kind === "DCDS" || kind === "ETF") return kind;
  return "";
}
