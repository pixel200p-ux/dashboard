import type { GeminiKey } from "@/lib/pixel-store";

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash";

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

async function requestGemini(key: string, path: string, body?: unknown): Promise<Response> {
  return fetch(`${GEMINI_API}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "x-goog-api-key": key,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

export async function checkGeminiKey(value: string): Promise<boolean> {
  const response = await requestGemini(value, "models?pageSize=1");
  if (response.ok) return true;
  if ([400, 401, 403].includes(response.status)) return false;
  const body = (await response.json().catch(() => null)) as GeminiResponse | null;
  throw new Error(body?.error?.message || `Google Gemini trả về lỗi ${response.status}`);
}

export async function askGemini(
  keys: GeminiKey[],
  prompt: string,
  portfolioSummary: string,
  assetSummary: string,
  onKeyStatus: (keyId: string, active: boolean) => void,
): Promise<string> {
  const candidates = keys.filter((key) => key.status !== "inactive");
  if (candidates.length === 0) {
    throw new Error("Chưa có API key Gemini dùng được. Hãy thêm key trong Cài đặt.");
  }

  const errors: string[] = [];
  for (const key of candidates) {
    try {
      const response = await requestGemini(key.value, `models/${GEMINI_MODEL}:generateContent`, {
        contents: [
          {
            role: "user",
            parts: [
              {
                text: [
                  "Bạn là Pixel, trợ lý thân thiện nói tiếng Việt trong ứng dụng quản lý danh mục đầu tư.",
                  "Trả lời ngắn gọn, dễ hiểu; chỉ phân tích dữ liệu được cung cấp, không bịa giá mới và không đưa ra cam kết lợi nhuận.",
                  `Tổng quan danh mục: ${portfolioSummary}`,
                  `Mã tài sản và giá gần nhất trong sổ: ${assetSummary || "Chưa có dữ liệu mã tài sản."}`,
                  `Người dùng hỏi: ${prompt}`,
                ].join("\n\n"),
              },
            ],
          },
        ],
        generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
      });
      const result = (await response.json()) as GeminiResponse;
      if (response.ok) {
        onKeyStatus(key.id, true);
        const text = result.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
        if (text) return text;
        throw new Error("Gemini không trả về nội dung.");
      }

      const message = result.error?.message || `Google Gemini trả về lỗi ${response.status}`;
      if ([400, 401, 403].includes(response.status)) {
        onKeyStatus(key.id, false);
        errors.push(`${key.name}: API key không hợp lệ`);
        continue;
      }
      errors.push(`${key.name}: ${message}`);
    } catch (error) {
      if (error instanceof Error && error.message === "Gemini không trả về nội dung.") throw error;
      errors.push(`${key.name}: ${error instanceof Error ? error.message : "Không kết nối được Gemini"}`);
    }
  }

  throw new Error(errors.join(" · ") || "Không gửi được yêu cầu tới Gemini.");
}
