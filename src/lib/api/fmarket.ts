type FmarketProduct = {
  code?: string;
  symbol?: string;
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

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export async function fetchFmarketDcdsNav(): Promise<{ nav: number; updatedAt: string | null; code: string | null } | null> {
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
      return null;
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
      return code === "DCDS" || String(p.name ?? "").toUpperCase().includes("DCDS");
    });

    if (!product) return null;

    const nav =
      asNumber(product.nav) ??
      asNumber(product.extra?.currentNAV) ??
      asNumber(product.extra?.lastNAV) ??
      asNumber(product.price) ??
      asNumber(product.latestNav) ??
      asNumber((product.productDetail as { nav?: number | string } | undefined)?.nav) ??
      null;

    if (nav == null || nav <= 0) return null;

    const updatedAt =
      String(product.extra?.lastNAVDate ?? product.productDetail?.navDate ?? product.productDetail?.updatedAt ?? product.productDetail?.createdAt ?? new Date().toISOString());

    return {
      nav,
      updatedAt: updatedAt || null,
      code: String(product.code ?? product.symbol ?? "DCDS"),
    };
  } catch (error) {
    console.error("[fmarket] DCDS proxy failed", error);
    return null;
  }
}
