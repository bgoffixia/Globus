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
  hasActiveVaultSubscription,
  isVaultPasscodeSessionValid,
  isVaultSessionActive,
  resolveFutureTransferStatus,
  unlockVault,
  updateVaultPasscode,
  vaultSubscriptionStatus,
} from "../src/lib/bank-vault";
import {
  decryptPrivateData,
  encryptPrivateData,
  hashPrivateToken,
} from "../src/lib/private-data";
import { getPushConfig } from "../src/lib/transfer-notifications";
import {
  addVaultSubscriptionMonths,
  getVaultPlanPriceMinor,
  getVaultSubscriptionPlan,
  minorAmountToDecimal,
} from "../src/lib/vault-subscription";

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
  try {
    const encodedKeys = [
      key.toString("base64url"),
      key.toString("base64"),
      key.toString("base64").replace(/=+$/, ""),
      key.toString("hex"),
    ];
    for (const encodedKey of encodedKeys) {
      process.env[encryptionKeyEnv] = encodedKey;
      const roundTrip = encryptPrivateData(
        "encoding-check",
        "recipient-email",
      );
      assert.equal(
        decryptPrivateData(roundTrip, "recipient-email"),
        "encoding-check",
      );
    }
    process.env[encryptionKeyEnv] = "a-long-literal-secret-value-for-key-derivation";
    const literalKeyEncrypted = encryptPrivateData(
      "literal-key-check",
      "recipient-email",
    );
    assert.equal(
      decryptPrivateData(literalKeyEncrypted, "recipient-email"),
      "literal-key-check",
    );
    process.env[encryptionKeyEnv] = "short-secret";
    assert.throws(() => encryptPrivateData("rejected", "recipient-email"));

    process.env[encryptionKeyEnv] = key.toString("base64url");
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
  assert.equal(await isVaultPasscodeSessionValid(userId, opened.sessionToken), true);
  assert.equal(await isVaultSessionActive(userId, opened.sessionToken), false);
  await db.update(bankUsersTable).set({ vaultSubscriptionStatus: "active" }).where(eq(bankUsersTable.id, userId));
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

test("vault subscription states and per-wallet transfer choices preserve ledger rules", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  assert.equal(vaultSubscriptionStatus("active", null, now), "active");
  assert.equal(vaultSubscriptionStatus("active", new Date("2026-11-10T11:59:00.000Z"), now), "expired");
  assert.equal(hasActiveVaultSubscription({ vaultSubscriptionStatus: "pending", vaultSubscriptionExpiresAt: null }, now), false);
  assert.equal(resolveFutureTransferStatus("successful", true), "completed");
  assert.equal(resolveFutureTransferStatus("successful", false), "pending");
  assert.equal(resolveFutureTransferStatus("pending", true), "pending");
  assert.equal(resolveFutureTransferStatus("failed", true), "failed");
  assert.equal(resolveFutureTransferStatus("reject", true), "failed");
  assert.equal(resolveFutureTransferStatus("hold", true), "pending");
  assert.equal(resolveFutureTransferStatus("normal", true), "completed");
});

test("manual Vault plans keep their configured NGN prices and fixed calendar terms", () => {
  const prices = {
    vaultPlan1mPriceMinor: "1200000",
    vaultPlan3mPriceMinor: "2200000",
    vaultPlan1yPriceMinor: "7900000",
  };
  assert.equal(getVaultPlanPriceMinor(prices, "1m"), "1200000");
  assert.equal(getVaultPlanPriceMinor(prices, "3m"), "2200000");
  assert.equal(getVaultPlanPriceMinor(prices, "1y"), "7900000");
  assert.equal(minorAmountToDecimal("7900000"), "79000.00");
  assert.equal(getVaultSubscriptionPlan("1y")?.durationMonths, 12);

  const monthEnd = addVaultSubscriptionMonths(
    new Date("2026-01-31T12:00:00.000Z"),
    1,
  );
  assert.equal(monthEnd.toISOString(), "2026-02-28T12:00:00.000Z");
});

test("Webpushr exposes only the site key after all server secrets are configured", () => {
  const keys = ["WEBPUSHR_SITE_KEY", "WEBPUSHR_REST_API_KEY", "WEBPUSHR_AUTH_TOKEN"];
  const previous = keys.map((key) => process.env[key]);
  process.env.WEBPUSHR_SITE_KEY = "public-site-key";
  process.env.WEBPUSHR_REST_API_KEY = "server-api-key";
  process.env.WEBPUSHR_AUTH_TOKEN = "server-auth-token";
  try {
    assert.deepEqual(getPushConfig(), { configured: true, siteKey: "public-site-key" });
    delete process.env.WEBPUSHR_AUTH_TOKEN;
    assert.deepEqual(getPushConfig(), { configured: false, siteKey: null });
  } finally {
    keys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
});
