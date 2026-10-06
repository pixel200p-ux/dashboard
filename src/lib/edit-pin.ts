export const EDIT_PIN_REQUEST_EVENT = "app:request-edit-pin";

export function askEditPin(): Promise<string | null> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Không thể yêu cầu mã PIN ngoài trình duyệt"));
  }

  return new Promise((resolve) => {
    window.dispatchEvent(
      new CustomEvent(EDIT_PIN_REQUEST_EVENT, {
        detail: { resolve },
      }),
    );
  });
}