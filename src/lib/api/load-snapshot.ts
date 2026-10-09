import type { LedgerSnapshot } from "@/engine/types";
import { getSql } from "@/lib/db";
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

export async function loadLedgerSnapshot(): Promise<LedgerSnapshot> {
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
