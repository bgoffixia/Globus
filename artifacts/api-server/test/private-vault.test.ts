import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  bankUsersTable,
  db,
  pool,
} from "@workspace/db";
import {
  initializeVaultPasscode,
  isVaultSessionActive,
  unlockVault,
  updateVaultPasscode,
} from "../src/lib/bank-vault";
import {
  decryptPrivateData,
  encryptPrivateData,
  hashPrivateToken,
} from "../src/lib/private-data";

const encryptionKeyEnv = "BANK_DETAILS_ENCRYPTION_KEY";
const sessionSecretEnv = "SESSION_SECRET";
const userId = `private-vault-${randomUUID()}`;
const email = `${userId}@example.test`;
const originalSessionSecret = process.env[sessionSecretEnv];
process.env[sessionSecretEnv] = randomBytes(32).toString("base64url");

after(async () => {
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, userId));
  await pool.end();
  if (originalSessionSecret === undefined) delete process.env[sessionSecretEnv];
  else process.env[sessionSecretEnv] = originalSessionSecret;
});

test("private data encryption is authenticated and purpose-specific", () => {
  const previousKey = process.env[encryptionKeyEnv];
  const key = randomBytes(32);
  process.env[encryptionKeyEnv] = key.toString("base64url");
  try {
    const encrypted = encryptPrivateData("recipient@example.test", "recipient-email");
    assert.notEqual(encrypted, "recipient@example.test");
    assert.equal(
      decryptPrivateData(encrypted, "recipient-email"),
      "recipient@example.test",
    );
    assert.throws(
      () => decryptPrivateData(encrypted, "push-subscription"),
      /could not be decrypted/i,
    );
    const [version, iv, tag, ciphertext] = encrypted.split(".");
    const tamperedTag = `${tag[0] === "A" ? "B" : "A"}${tag.slice(1)}`;
    const changed = `${version}.${iv}.${tamperedTag}.${ciphertext}`;
    assert.throws(
      () => decryptPrivateData(changed, "recipient-email"),
      /could not be decrypted/i,
    );
    assert.equal(hashPrivateToken("subscription-endpoint").length, 64);
  } finally {
    if (previousKey === undefined) delete process.env[encryptionKeyEnv];
    else process.env[encryptionKeyEnv] = previousKey;
    key.fill(0);
  }
});

test("private vault passcodes unlock a short session and revoke it when changed", async () => {
  await db.insert(bankUsersTable).values({ id: userId, email });
  assert.equal(await initializeVaultPasscode(userId, "1357"), true);
  assert.equal(await initializeVaultPasscode(userId, "2468"), false);

  const [storedUser] = await db
    .select({ hash: bankUsersTable.vaultPasscodeHash })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, userId));
  assert.ok(storedUser?.hash);
  assert.ok(!storedUser.hash.includes("1357"));

  assert.deepEqual(await unlockVault(userId, "9999"), { result: "invalid" });
  const opened = await unlockVault(userId, "1357");
  assert.equal(opened.result, "valid");
  if (opened.result !== "valid") return;
  assert.equal(await isVaultSessionActive(userId, opened.sessionToken), true);

  assert.equal(
    await updateVaultPasscode(userId, opened.sessionToken, "2468"),
    true,
  );
  assert.equal(await isVaultSessionActive(userId, opened.sessionToken), false);
  assert.notEqual((await unlockVault(userId, "1357")).result, "valid");
  const reopened = await unlockVault(userId, "2468");
  assert.equal(reopened.result, "valid");
});
