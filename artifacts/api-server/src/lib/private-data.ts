import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { decodeAes256Key } from "./encryption-key";

const KEY_ENV_NAME = "BANK_DETAILS_ENCRYPTION_KEY";

function encryptionKey(): Buffer {
  const encodedKey = process.env[KEY_ENV_NAME];
  if (!encodedKey) throw new Error("Private data encryption is not configured.");
  const key = decodeAes256Key(encodedKey);
  if (!key) {
    throw new Error("Private data encryption is not configured.");
  }
  return key;
}

export function encryptPrivateData(value: string, purpose: string): string {
  const key = encryptionKey();
  const iv = randomBytes(12);
  try {
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    cipher.setAAD(Buffer.from(`globus-private:${purpose}:v1`, "utf8"));
    const ciphertext = Buffer.concat([
      cipher.update(value, "utf8"),
      cipher.final(),
    ]);
    return [
      "v1",
      iv.toString("base64url"),
      cipher.getAuthTag().toString("base64url"),
      ciphertext.toString("base64url"),
    ].join(".");
  } finally {
    key.fill(0);
  }
}

export function decryptPrivateData(value: string, purpose: string): string {
  const [version, encodedIv, encodedTag, encodedCiphertext, extra] =
    value.split(".");
  if (
    version !== "v1" ||
    !encodedIv ||
    !encodedTag ||
    !encodedCiphertext ||
    extra !== undefined
  ) {
    throw new Error("Private data could not be decrypted.");
  }
  const key = encryptionKey();
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key,
      Buffer.from(encodedIv, "base64url"),
    );
    decipher.setAAD(Buffer.from(`globus-private:${purpose}:v1`, "utf8"));
    decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encodedCiphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new Error("Private data could not be decrypted.");
  } finally {
    key.fill(0);
  }
}

export function hashPrivateToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
