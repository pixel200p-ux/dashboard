type FmarketProduct = {
  code?: string;
  symbol?: string;
  shortName?: string;
  name?: string;
  nav?: number | string;
  price?: number | string;
  latestNav?: number | string;
  extra?: {
    currentNAV?: number | string;
    lastNAV?: number | string;
    lastNAVDate?: string | number;
  };
  productDetail?: {
    navDate?: string;
    createdAt?: string;
    updatedAt?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

export type FmarketDcdsResult =
  | { ok: true; nav: number; updatedAt: string | null; code: "DCDS" }
  | { ok: false; error: string; status?: number };

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function fetchFmarketDcdsNav(): Promise<FmarketDcdsResult> {
  try {
    const response = await fetch("https://api.fmarket.vn/res/products/filter", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: JSON.stringify({
        types: ["NEW_FUND", "TRADING_FUND"],
        issuerIds: [],
        sortOrder: "desc",
        sortField: "id",
        page: 1,
        pageSize: 25,
        isIpo: false,
        fundAssetTypes: [],
        bondRemainPeriods: [],
        searchField: "DCDS",
        isBuyByReward: false,
      }),
      signal: AbortSignal.timeout(12000),
    });

    if (!response.ok) {
      console.error("[fmarket] bad response", response.status, response.statusText);
      return { ok: false, status: response.status, error: `Fmarket HTTP ${response.status}` };
    }

    const payload = (await response.json()) as {
      data?: { rows?: FmarketProduct[] };
      rows?: FmarketProduct[];
      [key: string]: unknown;
    };

    const rows = Array.isArray(payload?.data?.rows)
      ? payload.data.rows
      : Array.isArray(payload?.rows)
        ? payload.rows
        : [];

    const product = rows.find((p) => {
      const code = String(p.code ?? p.symbol ?? "").toUpperCase();
      const shortName = String(p.shortName ?? "").toUpperCase();
      const name = String(p.name ?? "").toUpperCase();
      return shortName === "DCDS" || code === "DCDS" || name.includes("DCDS");
    });

    if (!product) return { ok: false, error: "Không tìm thấy quỹ DCDS trên Fmarket" };

    const nav =
      asNumber(product.nav) ??
      asNumber(product.extra?.currentNAV) ??
      asNumber(product.extra?.lastNAV) ??
      asNumber(product.price) ??
      asNumber(product.latestNav) ??
      asNumber((product.productDetail as { nav?: number | string } | undefined)?.nav) ??
      null;

    if (nav == null || nav <= 0) return { ok: false, error: "Fmarket không trả NAV hợp lệ cho DCDS" };

    const updatedAt =
      String(product.extra?.lastNAVDate ?? product.productDetail?.navDate ?? product.productDetail?.updatedAt ?? product.productDetail?.createdAt ?? new Date().toISOString());

    return {
      ok: true,
      nav,
      updatedAt: updatedAt || null,
      code: "DCDS",
    };
  } catch (error) {
    console.error("[fmarket] DCDS proxy failed", error);
    return {
      ok: false,
      error: error instanceof DOMException && error.name === "TimeoutError" ? "Fmarket timeout" : "Không kết nối được Fmarket",
    };
  }
}
