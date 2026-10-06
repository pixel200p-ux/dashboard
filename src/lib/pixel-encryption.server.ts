import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export type EncryptedSecret = {
  ciphertext: string;
  nonce: string;
  authTag: string;
};

function encryptionKey(): Buffer {
  const encoded = process.env.PIXEL_KEY_ENCRYPTION_SECRET;
  if (!encoded) {
    throw new Error("Thiếu PIXEL_KEY_ENCRYPTION_SECRET; hãy cấu hình secret chỉ ở môi trường server.");
  }
  const key = Buffer.from(encoded, "base64");
  if (key.length !== 32) {
    throw new Error("PIXEL_KEY_ENCRYPTION_SECRET phải là base64 của đúng 32 byte ngẫu nhiên.");
  }
  return key;
}

export function encryptSecret(value: string): EncryptedSecret {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return {
    ciphertext: ciphertext.toString("base64"),
    nonce: nonce.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
  };
}

export function decryptSecret(secret: EncryptedSecret): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(secret.nonce, "base64"));
  decipher.setAuthTag(Buffer.from(secret.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(secret.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}
