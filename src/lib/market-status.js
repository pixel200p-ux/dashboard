/**
 * @typedef {{ ok: boolean, label: string, detail?: string }} Status
 */

/**
 * @param {Record<string, Status>} statusMap
 * @returns {string}
 */
export function summarizeMarketStatus(statusMap) {
  return Object.values(statusMap ?? {})
    .map((status) => {
      const label = status?.label ?? "Nguồn";
      const detail = status?.detail ?? (status?.ok ? "OK" : "lỗi");
      return `${label}: ${status?.ok ? "thành công" : "thất bại"}${detail ? ` (${detail})` : ""}`;
    })
    .join(" · ");
}
