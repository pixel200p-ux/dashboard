export function askEditPin(): string | null {
  const pin = window.prompt("Nhập mã bảo vệ 6 số để tiếp tục");
  if (pin === null) return null;
  const normalized = pin.trim();
  if (!/^\d{6}$/.test(normalized)) {
    window.alert("Mã bảo vệ phải gồm đúng 6 chữ số");
    return null;
  }
  return normalized;
}