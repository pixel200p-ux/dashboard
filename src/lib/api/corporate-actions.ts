import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { replayPortfolio } from "@/engine/replay";
import type { CorporateActionType, LedgerSnapshot, PortfolioState } from "@/engine/types";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { loadLedgerSnapshot } from "@/lib/api/load-snapshot";

const actionSchema = z.object({
  id: z.string().optional(),
  pin: z.string().optional(),
  symbol: z.string().min(1),
  exDate: z.string().date(),
  recordDate: z.string().date().nullable(),
  paymentDate: z.string().date().nullable(),
  actionType: z.enum(["CASH_DIVIDEND", "STOCK_DIVIDEND"]),
  distributionPct: z.number().positive(),
  referencePrice: z.number().positive(),
  notes: z.string().optional(),
});

type CorporateActionResult = {
  ledger: LedgerSnapshot;
  state: PortfolioState;
};

export const saveCorporateAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(actionSchema)
  .handler(async ({ data }): Promise<CorporateActionResult> => {
    const sql = await getSql();
    const symbol = data.symbol.trim().toUpperCase();
    if (data.id) {
      await (
        await import("@/lib/auth/edit-pin.server")
      ).requireEditPin(sql, data.pin ?? "");
    }
    const assets = await sql`
      select id from assets
      where symbol = ${symbol} and asset_type = 'STOCK'
      limit 1
    `;
    if (assets.length === 0) {
      throw new Error(`Không tìm thấy mã cổ phiếu ${symbol} trong danh mục.`);
    }
    if (data.actionType === "CASH_DIVIDEND") {
      const cashPerShare = 10_000 * (data.distributionPct / 100);
      if (cashPerShare >= data.referencePrice) {
        throw new Error("Cổ tức tiền mặt phải thấp hơn giá tham chiếu trước GDKHQ.");
      }
    }
    const id = data.id ?? crypto.randomUUID();
    await sql.transaction(async (tx) => {
      if (data.id) {
        const existing = await tx<{
          action_type: CorporateActionType;
          symbol: string;
        }>`
          select action_type, symbol
          from corporate_actions
          where id = ${data.id} and deleted_at is null
          for update
        `;
        if (existing.length === 0) throw new Error("Không tìm thấy sự kiện cần sửa.");
        if (existing[0].action_type !== data.actionType) {
          throw new Error("Không thể đổi loại của sự kiện GDKHQ đã lưu.");
        }
        if (existing[0].symbol !== symbol) {
          const linkedDividends = await tx`
            select t.id
            from transactions t
            join assets a on a.id = t.asset_id
            where t.corporate_action_id = ${data.id}
              and t.deleted_at is null
              and a.symbol <> ${symbol}
            limit 1
          `;
          if (linkedDividends.length > 0) {
            throw new Error("Không thể đổi mã khi sự kiện đang liên kết với giao dịch cổ tức.");
          }
        }
        const invalidLinkedDividend = await tx`
          select t.id
          from transactions t
          where t.corporate_action_id = ${data.id}
            and t.deleted_at is null
            and t.tx_date < ${data.exDate}
          limit 1
        `;
        if (invalidLinkedDividend.length > 0) {
          throw new Error("Ngày GDKHQ không thể sau ngày ghi nhận khoản cổ tức đã liên kết.");
        }
      }
      const duplicate = await tx`
        select id
        from corporate_actions
        where symbol = ${symbol}
          and ex_date = ${data.exDate}
          and action_type = ${data.actionType}
          and deleted_at is null
          and id <> ${id}
        limit 1
      `;
      if (duplicate.length > 0) {
        throw new Error("Mã này đã có sự kiện cùng loại trong ngày GDKHQ đó.");
      }
      const notes = data.notes?.trim() || null;
      if (data.id) {
        await tx`
          update corporate_actions set
            symbol = ${symbol},
            ex_date = ${data.exDate},
            record_date = ${data.recordDate},
            payment_date = ${data.paymentDate},
            distribution_pct = ${data.distributionPct},
            reference_price = ${data.referencePrice},
            notes = ${notes},
            updated_at = now()
          where id = ${id} and deleted_at is null
        `;
      } else {
        await tx`
          insert into corporate_actions (
            id, symbol, ex_date, record_date, payment_date, action_type,
            distribution_pct, reference_price, notes, source
          ) values (
            ${id}, ${symbol}, ${data.exDate}, ${data.recordDate}, ${data.paymentDate},
            ${data.actionType}, ${data.distributionPct}, ${data.referencePrice},
            ${notes}, 'MANUAL'
          )
        `;
      }
    });
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });

export const deleteCorporateAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(z.object({ id: z.string(), pin: z.string() }))
  .handler(async ({ data }): Promise<CorporateActionResult> => {
    const sql = await getSql();
    await (
      await import("@/lib/auth/edit-pin.server")
    ).requireEditPin(sql, data.pin);
    await sql.transaction(async (tx) => {
      await tx`
        update transactions
        set corporate_action_id = null
        where corporate_action_id = ${data.id}
      `;
      const deleted = await tx`
        update corporate_actions
        set deleted_at = now(), updated_at = now()
        where id = ${data.id} and deleted_at is null
        returning id
      `;
      if (deleted.length === 0) throw new Error("Không tìm thấy sự kiện cần xóa.");
    });
    const ledger = await loadLedgerSnapshot();
    return { ledger, state: replayPortfolio(ledger) };
  });
