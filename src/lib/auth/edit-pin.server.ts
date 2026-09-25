import { promisify } from "node:util";
import { randomBytes, scrypt } from "node:crypto";
import type { Sql } from "@/lib/db";

const scryptAsync = promisify(scrypt);
const PIN_PATTERN = /^\d{6}$/;

export function assertPin(pin: string) {
  if (!PIN_PATTERN.test(pin)) throw new Error("Mã bảo vệ phải gồm đúng 6 chữ số");
}

export async function hashEditPin(pin: string): Promise<string> {
  assertPin(pin);
  const salt = randomBytes(16).toString("hex");
  const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derived.toString("hex")}`;
}

export async function verifyEditPin(pin: string, encoded: string | null | undefined): Promise<boolean> {
  if (!PIN_PATTERN.test(pin) || !encoded) return false;
  const [, salt, expected] = encoded.split("$");
  if (!salt || !expected) return false;
  const derived = (await scryptAsync(pin, salt, 64)) as Buffer;
  return derived.toString("hex") === expected;
}

export async function requireEditPin(sql: Sql, pin: string): Promise<void> {
  const rows = await sql`select edit_pin_hash from app_profile where id = 'default'`;
  const hash = rows[0] ? String((rows[0] as { edit_pin_hash?: string | null }).edit_pin_hash ?? "") : "";
  if (!(await verifyEditPin(pin, hash))) throw new Error("Mã bảo vệ không đúng");
}