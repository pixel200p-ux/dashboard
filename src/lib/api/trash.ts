import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { mapBank, mapCapital, mapTx } from "./map";

const trashItemSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(["TRANSACTION", "CAPITAL", "BANK"]),
  pin: z.string(),
});

async function requireTrashPin(pin: string) {
  const sql = await getSql();
  await (await import("@/lib/auth/edit-pin.server")).requireEditPin(sql, pin);
  return sql;
}

export const fetchTrash = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ pin: z.string() }))
  .handler(async ({ data }) => {
    const sql = await requireTrashPin(data.pin);
    const [transactions, capitalMovements, bankDeposits] = await Promise.all([
      sql`select t.*, a.symbol from transactions t left join assets a on a.id = t.asset_id where t.deleted_at is not null order by t.deleted_at desc, t.created_at desc`,
      sql`select * from capital_movements where deleted_at is not null order by deleted_at desc, created_at desc`,
      sql`select * from bank_deposits where deleted_at is not null order by deleted_at desc, created_at desc`,
    ]);

    return {
      transactions: transactions.map((transaction) => ({
        ...mapTx(transaction),
        symbol: transaction.symbol == null ? null : String(transaction.symbol),
      })),
      capitalMovements: capitalMovements.map(mapCapital),
      bankDeposits: bankDeposits.map(mapBank),
    };
  });

export const restoreTrashItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(trashItemSchema)
  .handler(async ({ data }) => {
    const sql = await requireTrashPin(data.pin);
    if (data.kind === "TRANSACTION") {
      const rows = await sql`update transactions set deleted_at = null where id = ${data.id} and deleted_at is not null returning id`;
      if (rows.length === 0) throw new Error("Không tìm thấy giao dịch trong thùng rác");
    } else if (data.kind === "CAPITAL") {
      const rows = await sql`update capital_movements set deleted_at = null where id = ${data.id} and deleted_at is not null returning id`;
      if (rows.length === 0) throw new Error("Không tìm thấy dòng vốn trong thùng rác");
    } else {
      const rows = await sql`update bank_deposits set deleted_at = null where id = ${data.id} and deleted_at is not null returning id`;
      if (rows.length === 0) throw new Error("Không tìm thấy sổ tiết kiệm trong thùng rác");
    }
    return { restored: true };
  });

export const permanentlyDeleteTrashItem = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(trashItemSchema)
  .handler(async ({ data }) => {
    const sql = await requireTrashPin(data.pin);

    if (data.kind === "TRANSACTION") {
      const rows = await sql`select id from transactions where id = ${data.id} and deleted_at is not null`;
      if (rows.length === 0) throw new Error("Không tìm thấy giao dịch trong thùng rác");
      await sql`delete from tplus_matches where sell_tx_id = ${data.id} or buy_tx_id = ${data.id}`;
      await sql`delete from transactions where id = ${data.id} and deleted_at is not null`;
    } else if (data.kind === "CAPITAL") {
      const rows = await sql`select id from capital_movements where id = ${data.id} and deleted_at is not null`;
      if (rows.length === 0) throw new Error("Không tìm thấy dòng vốn trong thùng rác");
      await sql`delete from capital_movements where id = ${data.id} and deleted_at is not null`;
    } else {
      const rows = await sql`select id from bank_deposits where id = ${data.id} and deleted_at is not null`;
      if (rows.length === 0) throw new Error("Không tìm thấy sổ tiết kiệm trong thùng rác");
      await sql`delete from bank_deposits where id = ${data.id} and deleted_at is not null`;
    }

    return { deleted: true };
  });