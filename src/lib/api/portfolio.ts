import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { replayOriginalByBucket, replayPortfolio } from "@/engine/replay";
import { formatVnd } from "@/engine/money";
import { replayBank } from "@/engine/bank";
import { todayYmd } from "@/engine/dates";
import { ensureDailyPriceSnapshot } from "@/lib/api/prices";
import type { LedgerSnapshot, PortfolioState } from "@/engine/types";
import {
  mapAccount,
  mapAsset,
  mapBank,
  mapBankRate,
  mapCapital,
  mapFee,
  mapMatch,
  mapTx,
  n,
} from "./map";

async function loadSnapshot(): Promise<LedgerSnapshot> {
  const sql = await getSql();
  const [accounts, assets, capital, transactions, matches, banks, bankRates, fees, meta] =
    await Promise.all([
      sql`select * from accounts order by id`,
      sql`select * from assets order by symbol`,
      sql`select * from capital_movements where deleted_at is null order by movement_date, created_at`,
      sql`select * from transactions where deleted_at is null order by tx_date, created_at`,
      sql`select * from tplus_matches`,
      sql`select * from bank_deposits where deleted_at is null order by start_date`,
      sql`select * from bank_rate_updates`,
      sql`select * from fee_settings`,
      sql`select value from app_meta where key = 'usd_vnd'`,
    ]);
  return {
    accounts: accounts.map(mapAccount),
    assets: assets.map(mapAsset),
    capital: capital.map(mapCapital),
    transactions: transactions.map(mapTx),
    matches: matches.map(mapMatch),
    banks: banks.map(mapBank),
    bankRates: bankRates.map(mapBankRate),
    fees: fees.map(mapFee),
    usdVnd: meta[0] ? n((meta[0] as { value: string }).value) || 25000 : 25000,
  };
}

export type PortfolioPayload = {
  ledger: LedgerSnapshot;
  state: PortfolioState;
};

export const fetchPortfolio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<PortfolioPayload> => {
    await ensureDailyPriceSnapshot();
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

const capitalSchema = z.object({
  kind: z.enum(["DEPOSIT", "WITHDRAW"]),
  amount: z.number().positive(),
  movementDate: z.string(),
  notes: z.string().optional(),
  bucket: z.enum(["DCDS", "ETF", "VPS", "SSI", "CRYPTO", "BANK"]),
});

export const saveCapital = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(capitalSchema)
    .handler(async ({ data }) => {
    const sql = await getSql();
    const id = crypto.randomUUID();
    let notes = data.notes?.trim() ? data.notes.trim() : null;
    if (data.kind === "WITHDRAW") {
      const current = await loadSnapshot();
      const originalBefore = replayOriginalByBucket(current.capital)[data.bucket] ?? 0;
      const excess = data.amount - originalBefore;
      if (excess > 0) {
        const core = `đã chốt lãi ${formatVnd(excess)}`;
        notes = notes ? `${core} · ${notes}` : core;
      }
    }
    await sql`
      insert into capital_movements (id, kind, amount, movement_date, notes, bucket)
      values (${id}, ${data.kind}, ${data.amount}, ${data.movementDate}, ${notes}, ${data.bucket})
    `;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const deleteCapital = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update capital_movements set deleted_at = now() where id = ${data.id}`;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

const updateCapitalSchema = z.object({
  id: z.string(),
  amount: z.number().positive(),
  movementDate: z.string(),
  notes: z.string().optional(),
  bucket: z.enum(["DCDS", "ETF", "VPS", "SSI", "CRYPTO", "BANK"]),
});

/** Sửa số tiền / ngày / ghi chú / danh mục. Không đổi Nạp ↔ Rút. */
export const updateCapital = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(updateCapitalSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const notes = data.notes?.trim() ? data.notes.trim() : null;
    await sql`
      update capital_movements set
        amount = ${data.amount},
        movement_date = ${data.movementDate},
        notes = ${notes},
        bucket = ${data.bucket}
      where id = ${data.id} and deleted_at is null
    `;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

const assetSchema = z.object({
  accountId: z.string(),
  symbol: z.string().min(1),
  name: z.string().optional(),
  assetType: z.enum(["STOCK", "ETF", "DCDS", "CRYPTO"]),
  currency: z.string(),
  currentPrice: z.number().optional(),
});

export const upsertAsset = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(assetSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const symbol = data.symbol.trim().toUpperCase();
    const id = `${data.accountId}:${symbol}`;
    await sql`
      insert into assets (id, account_id, symbol, name, asset_type, currency, current_price, price_updated_at)
      values (
        ${id}, ${data.accountId}, ${symbol}, ${data.name?.trim() || symbol},
        ${data.assetType}, ${data.currency}, ${data.currentPrice ?? null},
        ${data.currentPrice != null ? new Date().toISOString() : null}
      )
      on conflict (id) do update set
        name = excluded.name,
        current_price = coalesce(excluded.current_price, assets.current_price),
        price_updated_at = coalesce(excluded.price_updated_at, assets.price_updated_at)
    `;
    return { id, symbol };
  });

const txSchema = z.object({
  id: z.string().optional(),
  accountId: z.string(),
  symbol: z.string().min(1),
  name: z.string().optional(),
  assetType: z.enum(["STOCK", "ETF", "DCDS", "CRYPTO"]),
  currency: z.string(),
  txType: z.enum(["BUY", "SELL", "CASH_DIVIDEND", "STOCK_DIVIDEND"]),
  txDate: z.string(),
  quantity: z.number().nullable(),
  price: z.number().nullable(),
  amount: z.number(),
  fee: z.number(),
  tax: z.number(),
  tradeTplus: z.boolean(),
  fxRate: z.number().nullable(),
  dividendPerShare: z.number().nullable(),
  stockDivQty: z.number().nullable(),
  notes: z.string().optional(),
  currentPrice: z.number().optional(),
  matches: z
    .array(z.object({ buyTxId: z.string(), quantity: z.number().positive() }))
    .optional(),
});

export const saveTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(txSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const symbol = data.symbol.trim().toUpperCase();
    const assetId = `${data.accountId}:${symbol}`;
    await sql`
      insert into assets (id, account_id, symbol, name, asset_type, currency, current_price, price_updated_at)
      values (
        ${assetId}, ${data.accountId}, ${symbol}, ${data.name?.trim() || symbol},
        ${data.assetType}, ${data.currency}, ${data.currentPrice ?? data.price},
        ${new Date().toISOString()}
      )
      on conflict (id) do update set
        name = case when excluded.name <> excluded.symbol then excluded.name else assets.name end,
        current_price = coalesce(excluded.current_price, assets.current_price)
    `;
    const id = data.id ?? crypto.randomUUID();
    if (data.id) {
      await sql`delete from tplus_matches where sell_tx_id = ${id}`;
      await sql`
        update transactions set
          account_id = ${data.accountId},
          asset_id = ${assetId},
          tx_type = ${data.txType},
          tx_date = ${data.txDate},
          quantity = ${data.quantity},
          price = ${data.price},
          amount = ${data.amount},
          fee = ${data.fee},
          tax = ${data.tax},
          trade_tplus = ${data.tradeTplus},
          fx_rate = ${data.fxRate},
          dividend_per_share = ${data.dividendPerShare},
          stock_div_qty = ${data.stockDivQty},
          notes = ${data.notes ?? null}
        where id = ${id}
      `;
    } else {
      await sql`
        insert into transactions (
          id, account_id, asset_id, tx_type, tx_date, quantity, price, amount,
          fee, tax, trade_tplus, fx_rate, dividend_per_share, stock_div_qty, notes
        ) values (
          ${id}, ${data.accountId}, ${assetId}, ${data.txType}, ${data.txDate},
          ${data.quantity}, ${data.price}, ${data.amount}, ${data.fee}, ${data.tax},
          ${data.tradeTplus}, ${data.fxRate}, ${data.dividendPerShare}, ${data.stockDivQty},
          ${data.notes ?? null}
        )
      `;
    }
    for (const m of data.matches ?? []) {
      await sql`
        insert into tplus_matches (id, sell_tx_id, buy_tx_id, quantity)
        values (${crypto.randomUUID()}, ${id}, ${m.buyTxId}, ${m.quantity})
      `;
    }
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`delete from tplus_matches where sell_tx_id = ${data.id}`;
    await sql`update transactions set deleted_at = now() where id = ${data.id}`;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

const bankSchema = z.object({
  id: z.string().optional(),
  bankName: z.string().min(1),
  principal: z.number().positive(),
  startDate: z.string(),
  termMonths: z.number().int().positive(),
  interestRate: z.number().nonnegative(),
  autoRollover: z.boolean(),
  notes: z.string().optional(),
});

export const saveBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(bankSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const id = data.id ?? crypto.randomUUID();
    if (data.id) {
      await sql`
        update bank_deposits set
          bank_name = ${data.bankName},
          principal = ${data.principal},
          start_date = ${data.startDate},
          term_months = ${data.termMonths},
          interest_rate = ${data.interestRate},
          auto_rollover = ${data.autoRollover},
          notes = ${data.notes ?? null}
        where id = ${id} and status = 'ACTIVE'
      `;
    } else {
      await sql`
        insert into bank_deposits (
          id, bank_name, principal, start_date, term_months, interest_rate, auto_rollover, notes
        ) values (
          ${id}, ${data.bankName}, ${data.principal}, ${data.startDate}, ${data.termMonths},
          ${data.interestRate}, ${data.autoRollover}, ${data.notes ?? null}
        )
      `;
    }
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const confirmBankRate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ depositId: z.string(), periodNumber: z.number().int(), interestRate: z.number() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into bank_rate_updates (id, deposit_id, period_number, interest_rate)
      values (${crypto.randomUUID()}, ${data.depositId}, ${data.periodNumber}, ${data.interestRate})
      on conflict (deposit_id, period_number) do update set interest_rate = excluded.interest_rate, confirmed_at = now()
    `;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const redeemBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const ledger = await loadSnapshot();
    const dep = ledger.banks.find((b) => b.id === data.id);
    if (!dep) throw new Error("Không tìm thấy sổ");
    const view = replayBank(
      dep,
      ledger.bankRates.filter((r) => r.depositId === dep.id),
      todayYmd(),
    );
    await sql`
      update bank_deposits set
        status = 'REDEEMED',
        redeemed_at = ${todayYmd()},
        redeemed_principal = ${view.currentPrincipal},
        redeemed_interest = ${view.accumulatedInterest}
      where id = ${data.id}
    `;
    const next = await loadSnapshot();
    return { ledger: next, state: replayPortfolio(next) };
  });

export const deleteBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`update bank_deposits set deleted_at = now() where id = ${data.id}`;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const saveFees = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      profile: z.enum(["STOCK_VPS", "STOCK_SSI", "CRYPTO", "DCDS", "ETF"]),
      buyFeePct: z.number(),
      sellFeePct: z.number(),
      sellTaxPct: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update fee_settings set
        buy_fee_pct = ${data.buyFeePct},
        sell_fee_pct = ${data.sellFeePct},
        sell_tax_pct = ${data.sellTaxPct},
        updated_at = now()
      where profile = ${data.profile}
    `;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const setAssetPrice = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ assetId: z.string(), price: z.number().nonnegative() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      update assets set current_price = ${data.price}, price_updated_at = now()
      where id = ${data.assetId}
    `;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const setUsdVnd = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ rate: z.number().positive() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into app_meta (key, value, updated_at) values ('usd_vnd', ${String(data.rate)}, now())
      on conflict (key) do update set value = excluded.value, updated_at = now()
    `;
    const ledger = await loadSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });
