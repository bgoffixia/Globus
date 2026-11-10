import { createCipheriv, randomBytes } from "node:crypto";
import { decodeAes256Key } from "./encryption-key";

const KEY_ENV_NAME = "BANK_DETAILS_ENCRYPTION_KEY";
const BANK_ACCOUNT_AAD = Buffer.from("globus-bank-saved-account:v1", "utf8");

export class BankDetailsEncryptionUnavailableError extends Error {
  constructor(message = "Bank account encryption is not configured.") {
    super(message);
    this.name = "BankDetailsEncryptionUnavailableError";
  }
}

export function normalizeBankAccountNumber(value: string): string {
  const normalized = value.replace(/[\s-]/g, "").toUpperCase();
  if (!/^[A-Z0-9]{5,34}$/.test(normalized)) {
    throw new Error("Enter a valid full bank account number or IBAN.");
  }
  return normalized;
}

export function encryptBankAccountNumber(value: string): string {
  const encodedKey = process.env[KEY_ENV_NAME];
  if (!encodedKey) throw new BankDetailsEncryptionUnavailableError();

  const key = decodeAes256Key(encodedKey);
  if (!key) {
    throw new BankDetailsEncryptionUnavailableError(
      `${KEY_ENV_NAME} must encode exactly 32 bytes as base64url, base64, or hex.`,
    );
  }

  const iv = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(BANK_ACCOUNT_AAD);
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();
    return [
      "v1",
      iv.toString("base64url"),
      authTag.toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  } finally {
    key.fill(0);
  }
}
