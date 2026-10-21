import type { AssetType } from "@/engine/types";

export type PortfolioCategory = AssetType | "BANK";

type ConversationMessage = { role: "user" | "pixel"; text: string };

const PORTFOLIO_CATEGORIES: { id: PortfolioCategory; pattern: RegExp }[] = [
  { id: "STOCK", pattern: /\b(stock|co phieu|chung khoan|vps|ssi)\b/ },
  { id: "ETF", pattern: /\betf\b/ },
  { id: "DCDS", pattern: /\bdcds\b/ },
  { id: "CRYPTO", pattern: /\b(crypto|cryptocurrency|tien so|coin|usdt|bitcoin|btc)\b/ },
  { id: "BANK", pattern: /\b(bank|ngan hang|tien gui|so tiet kiem)\b/ },
];

const PORTFOLIO_REQUEST_PATTERN =
  /\b(danh muc|portfolio|tai san|tong quan|phan bo|nav|von|lai lo|lai nhuan|loi nhuan|dang giu|vi the|holding|so du|giao dich|mua ban|co tuc|dau tu|tplus)\b|\bt\+(?!\w)/;
const FINANCIAL_RESULT_PATTERN =
  /(?:^|[^\p{L}\p{N}_])(?:lãi|lỗ)(?=$|[^\p{L}\p{N}_])/iu;
const FOLLOWUP_PATTERN =
  /^(?:hay\s+)?(?:danh gia|phan tich|chi tiet|cu the|gia von|gia goc|gia hien tai|so luong|ma nao|giai thich them|con|vay|the nao|tiep)\b/;

export function normalizedPixelPrompt(prompt: string): string {
  return prompt
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLocaleLowerCase("vi");
}

export function portfolioCategoriesForPrompt(prompt: string): PortfolioCategory[] | null {
  const normalized = normalizedPixelPrompt(prompt);
  const categories = PORTFOLIO_CATEGORIES
    .filter(({ pattern }) => pattern.test(normalized))
    .map(({ id }) => id);
  if (categories.length > 0) return categories;
  return PORTFOLIO_REQUEST_PATTERN.test(normalized) || FINANCIAL_RESULT_PATTERN.test(prompt)
    ? null
    : [];
}

export function portfolioPromptForFollowup(
  prompt: string,
  messages: ConversationMessage[],
): string {
  const categories = portfolioCategoriesForPrompt(prompt);
  if (categories === null || categories.length > 0) return prompt;

  const normalized = normalizedPixelPrompt(prompt);
  if (!FOLLOWUP_PATTERN.test(normalized)) return prompt;
  return [...messages].reverse().find((message) => {
    if (message.role !== "user") return false;
    const previousCategories = portfolioCategoriesForPrompt(message.text);
    return previousCategories === null || previousCategories.length > 0;
  })?.text ?? prompt;
}
