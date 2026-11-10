import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { test } from "node:test";
import {
  BankDetailsEncryptionUnavailableError,
  encryptBankAccountNumber,
  normalizeBankAccountNumber,
} from "../src/lib/sensitive-bank-details";

const encryptionKeyEnv = "BANK_DETAILS_ENCRYPTION_KEY";
const aad = Buffer.from("globus-bank-saved-account:v1", "utf8");

test("normalizes and encrypts a bank account number without exposing plaintext", () => {
  const previousKey = process.env[encryptionKeyEnv];
  const key = Buffer.alloc(32, 0x4b);
  try {
    const normalized = normalizeBankAccountNumber("GB29 NWBK 6016-1331 9268 19");
    assert.equal(normalized, "GB29NWBK60161331926819");

    const encodedKeys = [
      key.toString("base64url"),
      key.toString("base64"),
      key.toString("base64").replace(/=+$/, ""),
      key.toString("hex"),
    ];
    for (const encodedKey of encodedKeys) {
      process.env[encryptionKeyEnv] = encodedKey;
      const encrypted = encryptBankAccountNumber(normalized);
      assert.ok(!encrypted.includes(normalized));
      const [version, encodedIv, encodedTag, encodedCiphertext] = encrypted.split(".");
      assert.equal(version, "v1");
      assert.ok(encodedIv && encodedTag && encodedCiphertext);

      const decipher = createDecipheriv(
        "aes-256-gcm",
        key,
        Buffer.from(encodedIv, "base64url"),
      );
      decipher.setAAD(aad);
      decipher.setAuthTag(Buffer.from(encodedTag, "base64url"));
      const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encodedCiphertext, "base64url")),
        decipher.final(),
      ]).toString("utf8");
      assert.equal(decrypted, normalized);
    }
  } finally {
    if (previousKey === undefined) delete process.env[encryptionKeyEnv];
    else process.env[encryptionKeyEnv] = previousKey;
    key.fill(0);
  }
});

test("rejects malformed bank account numbers and missing encryption keys", () => {
  assert.throws(
    () => normalizeBankAccountNumber("1234"),
    /valid full bank account number or IBAN/i,
  );
  assert.throws(
    () => normalizeBankAccountNumber("ACCT-12!45"),
    /valid full bank account number or IBAN/i,
  );

  const previousKey = process.env[encryptionKeyEnv];
  delete process.env[encryptionKeyEnv];
  try {
    assert.throws(
      () => encryptBankAccountNumber("ACCOUNT12345"),
      BankDetailsEncryptionUnavailableError,
    );
  } finally {
    if (previousKey !== undefined) process.env[encryptionKeyEnv] = previousKey;
  }
});
