import type { SearchKeyProvider } from "@/lib/pixel-store";
import { isIP } from "node:net";

export type PixelWebSource = {
  title: string;
  url: string;
  publishedDate?: string;
  content: string;
};

type TavilyResult = {
  title?: string;
  url?: string;
  published_date?: string;
  content?: string;
  raw_content?: string;
};

type TavilyResponse = {
  results?: TavilyResult[];
  message?: string;
};

export type PlainSearchKey = {
  provider: SearchKeyProvider;
  name: string;
  value: string;
};

export function isWebSearchNeeded(prompt: string): boolean {
  const normalized = prompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  const explicitlyAsksWeb = /(tim tren web|tim tren mang|tra cuu|tim kiem tren mang|tin moi nhat|thong tin moi nhat|cap nhat moi)/.test(normalized);
  const asksDividend = /(co tuc|chia co phieu|phat hanh them|chot quyen)/.test(normalized);
  const asksAboutUpcomingDividend = asksDividend && /(sap toi|thong tin|phat hanh|chia|lich|ngay|khi nao|co khong|du kien)/.test(normalized);
  const asksCurrentMarketNews = /(tin tuc|thong tin|hien nay|moi nhat|hom nay)/.test(normalized)
    && /(thi truong|co phieu|doanh nghiep|ma chung khoan|gia|kinh te)/.test(normalized);
  return explicitlyAsksWeb || asksAboutUpcomingDividend || asksCurrentMarketNews;
}

export function buildPixelSearchQuery(prompt: string, symbols: string[]): string {
  const normalized = prompt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("vi");
  const tickers = [...new Set(symbols.map((symbol) => symbol.trim().toUpperCase()).filter(Boolean))].slice(0, 40);
  if (/(co tuc|chia co phieu|phat hanh them|chot quyen)/.test(normalized)) {
    return [
      "Việt Nam thông báo cổ tức tiền mặt cổ tức cổ phiếu phát hành thêm ngày đăng ký cuối cùng ngày giao dịch không hưởng quyền sắp tới",
      tickers.length ? `Mã cổ phiếu trong danh mục: ${tickers.join(", ")}` : "",
      `Câu hỏi: ${prompt}`,
    ].filter(Boolean).join(". ").slice(0, 1200);
  }
  return `${prompt}${tickers.length ? `. Mã đang nắm giữ liên quan: ${tickers.join(", ")}` : ""}`.slice(0, 1200);
}

async function readError(response: Response): Promise<string> {
  const text = await response.text().catch(() => "");
  return text.slice(0, 500) || `HTTP ${response.status}`;
}

export async function checkSearchKey(provider: SearchKeyProvider, value: string): Promise<boolean> {
  const response = provider === "tavily"
    ? await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: value, query: "test", max_results: 1, search_depth: "fast" }),
      })
    : await fetch("https://s.jina.ai/?q=test", {
        headers: { Authorization: `Bearer ${value}`, Accept: "text/plain" },
      });
  if (response.ok) return true;
  if ([400, 401, 403].includes(response.status)) return false;
  throw new Error(`${provider} trả về lỗi ${response.status}: ${await readError(response)}`);
}

function trustedPublicUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return url.protocol === "https:"
      && Boolean(hostname)
      && isIP(hostname) === 0
      && hostname !== "localhost"
      && !hostname.endsWith(".localhost")
      && !hostname.endsWith(".local");
  } catch {
    return false;
  }
}

async function tavilySearch(key: string, query: string): Promise<PixelWebSource[]> {
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: key,
      query,
      topic: "general",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_published_date: true,
    }),
  });
  if (!response.ok) throw new Error(`Tavily Search lỗi ${response.status}: ${await readError(response)}`);
  const result = await response.json() as TavilyResponse;
  return (result.results ?? [])
    .filter((item) => trustedPublicUrl(item.url))
    .map((item) => ({
      title: item.title?.slice(0, 300) || item.url!,
      url: item.url!,
      ...(item.published_date ? { publishedDate: item.published_date } : {}),
      content: (item.content ?? "").slice(0, 1600),
    }));
}

async function jinaSearch(key: string, query: string): Promise<PixelWebSource[]> {
  const url = new URL("https://s.jina.ai/");
  url.searchParams.set("q", query);
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${key}`, Accept: "text/plain" },
  });
  if (!response.ok) throw new Error(`Jina Search lỗi ${response.status}: ${await readError(response)}`);
  const markdown = (await response.text()).slice(0, 16000);
  const results: PixelWebSource[] = [];
  const resultPattern = /^Title:\s*([^\r\n]+)\r?\n(?:URL Source|URL):\s*(https:\/\/\S+)\r?\n([\s\S]*?)(?=^Title:|\s*$)/gm;
  let match: RegExpExecArray | null;
  while ((match = resultPattern.exec(markdown)) !== null && results.length < 5) {
    if (!trustedPublicUrl(match[2])) continue;
    results.push({
      title: match[1].slice(0, 300),
      url: match[2],
      content: match[3].slice(0, 1600),
    });
  }
  if (results.length === 0 && markdown.trim()) {
    return [{ title: "Kết quả tìm kiếm Jina", url: url.href, content: markdown }];
  }
  return results;
}

async function readWithJina(key: string, source: PixelWebSource): Promise<PixelWebSource> {
  const response = await fetch(`https://r.jina.ai/${source.url}`, {
    headers: {
      Authorization: `Bearer ${key}`,
      Accept: "text/plain",
      "X-Return-Format": "markdown",
    },
  });
  if (!response.ok) throw new Error(`Jina Reader lỗi ${response.status}: ${await readError(response)}`);
  return { ...source, content: (await response.text()).slice(0, 3000) };
}

export async function searchPixelWeb(
  keys: PlainSearchKey[],
  query: string,
): Promise<PixelWebSource[]> {
  const tavily = keys.find((key) => key.provider === "tavily");
  const jina = keys.find((key) => key.provider === "jina");
  if (!tavily && !jina) {
    throw new Error("Câu hỏi cần tra cứu web. Hãy thêm API key Tavily Search hoặc Jina Reader trong Cài đặt Pixel.");
  }

  let sources: PixelWebSource[] = [];
  let tavilyFailure: string | null = null;
  if (tavily) {
    try {
      sources = await tavilySearch(tavily.value, query);
    } catch (error) {
      tavilyFailure = error instanceof Error ? error.message : "Không kết nối được Tavily.";
    }
  }
  if (sources.length === 0 && jina) {
    try {
      sources = await jinaSearch(jina.value, query);
    } catch (error) {
      const jinaFailure = error instanceof Error ? error.message : "Không kết nối được Jina.";
      throw new Error([tavilyFailure, jinaFailure].filter(Boolean).join(" · "));
    }
  }
  if (sources.length === 0) {
    if (tavilyFailure) throw new Error(tavilyFailure);
    return [];
  }

  if (jina && sources.some((source) => source.url.startsWith("https://")) && !sources[0]?.url.startsWith("https://s.jina.ai/")) {
    const pages = await Promise.allSettled(sources.slice(0, 2).map((source) => readWithJina(jina.value, source)));
    sources = sources.map((source, index) => {
      const page = pages[index];
      return index < 2 && page?.status === "fulfilled" ? page.value : source;
    });
  }
  return sources;
}
