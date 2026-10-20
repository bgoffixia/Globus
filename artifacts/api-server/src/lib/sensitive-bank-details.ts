import { createCipheriv, randomBytes } from "node:crypto";

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

  const key = Buffer.from(encodedKey, "base64url");
  if (key.length !== 32 || key.toString("base64url") !== encodedKey) {
    key.fill(0);
    throw new BankDetailsEncryptionUnavailableError(
      `${KEY_ENV_NAME} must contain a 32-byte base64url key.`,
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
