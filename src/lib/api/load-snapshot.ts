import type { LedgerSnapshot } from "@/engine/types";
import { getSql } from "@/lib/db";
import {
  mapAccount,
  mapAsset,
  mapBank,
  mapBankRate,
  mapCapital,
  mapCorporateAction,
  mapFee,
  mapMatch,
  mapTx,
  n,
} from "./map";

export async function loadLedgerSnapshot(): Promise<LedgerSnapshot> {
  const sql = await getSql();
  const [accounts, assets, capital, transactions, corporateActions, matches, banks, bankRates, fees, meta, usdtMeta, usdtHistory] =
    await Promise.all([
      sql`select * from accounts order by id`,
      sql`select * from assets order by symbol`,
      sql`select * from capital_movements where deleted_at is null order by movement_date, created_at`,
      sql`select * from transactions where deleted_at is null order by tx_date, created_at`,
      sql`select * from corporate_actions where deleted_at is null order by ex_date, created_at`,
      sql`select * from tplus_matches`,
      sql`select * from bank_deposits where deleted_at is null order by start_date`,
      sql`select * from bank_rate_updates`,
      sql`select * from fee_settings`,
      sql`select value from app_meta where key = 'usd_vnd'`,
      sql`select value from app_meta where key = 'crypto_usdt_balance'`,
      sql`select effective_date::text as effective_date, amount from crypto_usdt_balance_history order by effective_date`,
    ]);
  return {
    accounts: accounts.map(mapAccount),
    assets: assets.map(mapAsset),
    usdtBalance: usdtMeta[0] ? n((usdtMeta[0] as { value: string }).value) : 0,
    usdtBalanceHistory: usdtHistory.map((row) => ({
      effectiveDate: String((row as { effective_date: string }).effective_date).slice(0, 10),
      amount: n((row as { amount: unknown }).amount),
    })),
    capital: capital.map(mapCapital),
    transactions: transactions.map(mapTx),
    corporateActions: corporateActions.map(mapCorporateAction),
    matches: matches.map(mapMatch),
    banks: banks.map(mapBank),
    bankRates: bankRates.map(mapBankRate),
    fees: fees.map(mapFee),
    usdVnd: meta[0] ? n((meta[0] as { value: string }).value) || 25000 : 25000,
  };
}
