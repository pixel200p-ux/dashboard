/**
 * @typedef {{ ok: boolean, label: string, detail?: string }} Status
 */

/**
 * @param {{ label: string, hasSymbols?: boolean, count?: number, fetchFailed?: boolean, detail?: string }} input
 * @returns {Status}
 */
export function buildMarketSourceStatus({
  label,
  hasSymbols = false,
  count = 0,
  fetchFailed = false,
  detail,
}) {
  if (!hasSymbols) {
    return {
      ok: true,
      label,
      detail: detail ?? "không có mã cần cập nhật",
    };
  }

  if (fetchFailed) {
    return {
      ok: false,
      label,
      detail: detail ?? "lỗi nguồn dữ liệu",
    };
  }

  return {
    ok: true,
    label,
    detail: detail ?? `${count} mã cập nhật`,
  };
}

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
