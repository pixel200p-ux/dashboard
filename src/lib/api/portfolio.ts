import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql, type SqlQuery } from "@/lib/db";
import { replayOriginalByBucket, replayPortfolio } from "@/engine/replay";
import { formatVnd } from "@/engine/money";
import { replayBank } from "@/engine/bank";
import { todayYmd } from "@/engine/dates";
import { ensureDailyPriceSnapshot } from "@/lib/api/prices";
import { loadLedgerSnapshot } from "@/lib/api/load-snapshot";
import type { LedgerSnapshot, PortfolioState } from "@/engine/types";

export type PortfolioPayload = {
  ledger: LedgerSnapshot;
  state: PortfolioState;
};

async function getTransactionMatchGroup(
  sql: SqlQuery,
  transactionId: string,
): Promise<string[]> {
  const matches = await sql<{ buy_tx_id: string; sell_tx_id: string }>`
    select buy_tx_id, sell_tx_id from tplus_matches
  `;
  const linkedById = new Map<string, Set<string>>();
  for (const match of matches) {
    linkedById.set(
      match.buy_tx_id,
      (linkedById.get(match.buy_tx_id) ?? new Set()).add(match.sell_tx_id),
    );
    linkedById.set(
      match.sell_tx_id,
      (linkedById.get(match.sell_tx_id) ?? new Set()).add(match.buy_tx_id),
    );
  }

  const group = new Set([transactionId]);
  const pending = [transactionId];
  while (pending.length > 0) {
    const current = pending.pop()!;
    for (const linkedId of linkedById.get(current) ?? []) {
      if (group.has(linkedId)) continue;
      group.add(linkedId);
      pending.push(linkedId);
    }
  }
  return [...group];
}

export const fetchPortfolio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async (): Promise<PortfolioPayload> => {
    await ensureDailyPriceSnapshot();
    const ledger = await loadLedgerSnapshot();
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
      const current = await loadLedgerSnapshot();
      const originalBefore =
        replayOriginalByBucket(current.capital)[data.bucket] ?? 0;
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
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const deleteCapital = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), pin: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);
    await sql`update capital_movements set deleted_at = now() where id = ${data.id}`;
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

const updateCapitalSchema = z.object({
  id: z.string(),
  pin: z.string(),
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
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);
    const notes = data.notes?.trim() ? data.notes.trim() : null;
    await sql`
      update capital_movements set
        amount = ${data.amount},
        movement_date = ${data.movementDate},
        notes = ${notes},
        bucket = ${data.bucket}
      where id = ${data.id} and deleted_at is null
    `;
    const ledger = await loadLedgerSnapshot();
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
  pin: z.string().optional(),
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
  createOriginalDeposit: z.boolean().optional(),
});

export const saveTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(txSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (
      data.createOriginalDeposit &&
      (data.txType !== "BUY" ||
        (data.assetType !== "DCDS" && data.assetType !== "ETF"))
    ) {
      throw new Error("Nạp vốn gốc chỉ áp dụng cho lệnh Buy DCDS hoặc ETF.");
    }
    if (data.id)
      await (
        await import("@/lib/auth/edit-pin.server")
      ).requireEditPin(sql, data.pin ?? "");
    const symbol = data.symbol.trim().toUpperCase();
    const assetId = `${data.accountId}:${symbol}`;
    const id = data.id ?? crypto.randomUUID();
    await sql.transaction(async (tx) => {
      await tx`
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
      if (data.id) {
        await tx`delete from tplus_matches where sell_tx_id = ${id}`;
        await tx`
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
        await tx`
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
        await tx`
          insert into tplus_matches (id, sell_tx_id, buy_tx_id, quantity)
          values (${crypto.randomUUID()}, ${id}, ${m.buyTxId}, ${m.quantity})
        `;
      }
      if (data.createOriginalDeposit) {
        await tx`
          insert into capital_movements (id, kind, amount, movement_date, notes, bucket)
          values (${crypto.randomUUID()}, 'DEPOSIT', ${data.amount}, ${data.txDate}, ${null}, ${data.assetType})
        `;
      }
    });
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const deleteTransaction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      id: z.string(),
      pin: z.string(),
      cascade: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);

    await sql.transaction(async (tx) => {
      const matchGroup = data.cascade
        ? await getTransactionMatchGroup(tx, data.id)
        : [data.id];
      await tx.query(
        "delete from tplus_matches where sell_tx_id = any($1::text[]) or buy_tx_id = any($1::text[])",
        [matchGroup],
      );
      await tx.query(
        "update transactions set deleted_at = now() where id = any($1::text[]) and deleted_at is null",
        [matchGroup],
      );
    });

    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const checkTxLinks = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    const matchGroup = await getTransactionMatchGroup(sql, data.id);
    const linkedIds = matchGroup.filter((id) => id !== data.id);
    if (linkedIds.length === 0)
      return { linkedCount: 0, linkedTransactions: [] };

    const linkedTransactions = await sql.query<{
      id: string;
      tx_type: string;
      tx_date: string;
      quantity: number | string | null;
      symbol: string | null;
    }>(
      `
      select t.id, t.tx_type, t.tx_date::text as tx_date, t.quantity, a.symbol
      from transactions t
      left join assets a on a.id = t.asset_id
      where t.id = any($1::text[]) and t.deleted_at is null
      order by t.tx_date, t.created_at
    `,
      [linkedIds],
    );
    return {
      linkedCount: linkedTransactions.length,
      linkedTransactions: linkedTransactions.map((transaction) => ({
        id: transaction.id,
        txType: transaction.tx_type,
        txDate: transaction.tx_date,
        quantity:
          transaction.quantity == null ? null : Number(transaction.quantity),
        symbol: transaction.symbol,
      })),
    };
  });

const bankSchema = z.object({
  id: z.string().optional(),
  pin: z.string().optional(),
  bankName: z.string().min(1),
  principal: z.number().positive(),
  startDate: z.string(),
  termMonths: z.number().int().positive(),
  interestRate: z.number().nonnegative(),
  autoRollover: z.boolean(),
  notes: z.string().optional(),
  createOriginalDeposit: z.boolean().optional(),
});

export const saveBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(bankSchema)
  .handler(async ({ data }) => {
    const sql = await getSql();
    if (data.id)
      await (
        await import("@/lib/auth/edit-pin.server")
      ).requireEditPin(sql, data.pin ?? "");
    const id = data.id ?? crypto.randomUUID();
    await sql.transaction(async (tx) => {
      if (data.id) {
        await tx`
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
        await tx`
          insert into bank_deposits (
            id, bank_name, principal, start_date, term_months, interest_rate, auto_rollover, notes
          ) values (
            ${id}, ${data.bankName}, ${data.principal}, ${data.startDate}, ${data.termMonths},
            ${data.interestRate}, ${data.autoRollover}, ${data.notes ?? null}
          )
        `;
      }
      if (data.createOriginalDeposit) {
        await tx`
          insert into capital_movements (id, kind, amount, movement_date, notes, bucket)
          values (${crypto.randomUUID()}, 'DEPOSIT', ${data.principal}, ${data.startDate}, ${null}, 'BANK')
        `;
      }
    });
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const confirmBankRate = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    z.object({
      depositId: z.string(),
      periodNumber: z.number().int(),
      interestRate: z.number(),
      pin: z.string(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);
    await sql`
      insert into bank_rate_updates (id, deposit_id, period_number, interest_rate)
      values (${crypto.randomUUID()}, ${data.depositId}, ${data.periodNumber}, ${data.interestRate})
      on conflict (deposit_id, period_number) do update set interest_rate = excluded.interest_rate, confirmed_at = now()
    `;
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

/** Xác nhận lãi suất từ nhắc việc: đã đăng nhập nhưng không yêu cầu PIN. */
export const confirmBankRateFromNotification = createServerFn({
  method: "POST",
})
  .middleware([authMiddleware])
  .validator(
    z.object({
      depositId: z.string(),
      periodNumber: z.number().int(),
      interestRate: z.number(),
    }),
  )
  .handler(async ({ data }) => {
    const sql = await getSql();
    await sql`
      insert into bank_rate_updates (id, deposit_id, period_number, interest_rate)
      values (${crypto.randomUUID()}, ${data.depositId}, ${data.periodNumber}, ${data.interestRate})
      on conflict (deposit_id, period_number) do update set interest_rate = excluded.interest_rate, confirmed_at = now()
    `;
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const redeemBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), pin: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);
    const ledger = await loadLedgerSnapshot();
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
    const next = await loadLedgerSnapshot();
    return { ledger: next, state: replayPortfolio(next) };
  });

export const deleteBank = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), pin: z.string() }))
  .handler(async ({ data }) => {
    const sql = await getSql();
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);
    await sql`update bank_deposits set deleted_at = now() where id = ${data.id}`;
    const ledger = await loadLedgerSnapshot();
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
    const ledger = await loadLedgerSnapshot();
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
    const ledger = await loadLedgerSnapshot();
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
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });
