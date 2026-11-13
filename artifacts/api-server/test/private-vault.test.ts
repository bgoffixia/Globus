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
  expireVaultSubscriptions,
  hasActiveVaultSubscription,
  isVaultPasscodeSessionValid,
  isVaultSessionActive,
  resolveFutureTransferStatus,
  vaultTransferEmailAlertsEnabled,
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
import {
  buildVaultExpiryReminderEmail,
  sendVaultExpiryReminderEmail,
  sendVaultExpiryReminders,
} from "../src/lib/vault-expiry-reminders";

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
    const privateNote = encryptPrivateData(
      "Call the bank about this record",
      "vault-transaction-note",
    );
    assert.ok(!privateNote.includes("Call the bank"));
    assert.equal(
      decryptPrivateData(privateNote, "vault-transaction-note"),
      "Call the bank about this record",
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
  const [createdUser] = await db
    .insert(bankUsersTable)
    .values({ id: userId, email })
    .returning({
      transferPushEnabled: bankUsersTable.pushTransferAlertsEnabled,
      walletPushEnabled: bankUsersTable.pushWalletAlertsEnabled,
      securityPushEnabled: bankUsersTable.pushSecurityAlertsEnabled,
      transactionEmailAlertsEnabled: bankUsersTable.vaultEmailAlertsEnabled,
      autoRenewEnabled: bankUsersTable.vaultSubscriptionAutoRenew,
    });
  assert.deepEqual(createdUser, {
    transferPushEnabled: false,
    walletPushEnabled: false,
    securityPushEnabled: false,
    transactionEmailAlertsEnabled: false,
    autoRenewEnabled: false,
  });
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
  if (reopened.result !== "valid") return;

  await db
    .update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "active",
      vaultSubscriptionExpiresAt: new Date("2026-11-10T11:59:00.000Z"),
    })
    .where(eq(bankUsersTable.id, userId));
  assert.equal(
    await expireVaultSubscriptions(new Date("2026-11-10T12:00:00.000Z")),
    1,
  );
  const [expiredUser] = await db
    .select({
      status: bankUsersTable.vaultSubscriptionStatus,
    })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, userId));
  assert.equal(expiredUser?.status, "expired");
  assert.equal(
    await isVaultPasscodeSessionValid(userId, reopened.sessionToken),
    false,
  );
  assert.equal(
    await expireVaultSubscriptions(new Date("2026-11-10T12:01:00.000Z")),
    0,
  );
});

test("vault subscription states and per-wallet transfer choices preserve ledger rules", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  assert.equal(vaultSubscriptionStatus("active", null, now), "active");
  assert.equal(vaultSubscriptionStatus("active", new Date("2026-11-10T11:59:00.000Z"), now), "expired");
  assert.equal(hasActiveVaultSubscription({ vaultSubscriptionStatus: "pending", vaultSubscriptionExpiresAt: null }, now), false);
  assert.equal(vaultTransferEmailAlertsEnabled({
    vaultEmailAlertsEnabled: false,
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: null,
  }, now), false);
  assert.equal(vaultTransferEmailAlertsEnabled({
    vaultEmailAlertsEnabled: true,
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: null,
  }, now), true);
  assert.equal(vaultTransferEmailAlertsEnabled({
    vaultEmailAlertsEnabled: true,
    vaultSubscriptionStatus: "active",
    vaultSubscriptionExpiresAt: new Date("2026-11-10T11:59:00.000Z"),
  }, now), false);
  assert.equal(resolveFutureTransferStatus("successful", true), "completed");
  assert.equal(resolveFutureTransferStatus("successful", false), "pending");
  assert.equal(resolveFutureTransferStatus("pending", true), "pending");
  assert.equal(resolveFutureTransferStatus("failed", true), "failed");
  assert.equal(resolveFutureTransferStatus("reject", true), "failed");
  assert.equal(resolveFutureTransferStatus("hold", true), "pending");
  assert.equal(resolveFutureTransferStatus("normal", true), "completed");
});

test("Vault expiry reminders are branded, one-time per expiry, and retry after delivery failure", async () => {
  const now = new Date("2026-11-13T12:00:00.000Z");
  const expiresAt = new Date("2026-11-15T12:00:00.000Z");
  const message = buildVaultExpiryReminderEmail({
    recipient: email,
    expiresAt,
    autoRenew: true,
    senderAddress: "security@globus.website",
    origin: "https://globus.example",
  });
  assert.equal(message.subject, "Your Globus Private Vault access expires soon");
  assert.ok(message.text.includes("Paystack confirms the renewal payment"));
  assert.ok(message.html.includes("https://globus.example/private-vault"));
  assert.ok(message.html.includes("GLOBUS"));

  await db
    .update(bankUsersTable)
    .set({
      vaultSubscriptionStatus: "active",
      vaultSubscriptionExpiresAt: expiresAt,
      vaultSubscriptionAutoRenew: true,
      vaultSubscriptionExpiryReminderSentFor: null,
      vaultSubscriptionExpiryReminderClaimedAt: null,
    })
    .where(eq(bankUsersTable.id, userId));
  const delivered: Date[] = [];
  const result = await sendVaultExpiryReminders({
    now,
    onlyUserId: userId,
    sendReminder: async (input) => {
      delivered.push(input.expiresAt);
      return true;
    },
  });
  assert.deepEqual(result, { sent: 1, failed: 0 });
  assert.deepEqual(delivered, [expiresAt]);
  assert.deepEqual(
    await sendVaultExpiryReminders({
      now,
      onlyUserId: userId,
      sendReminder: async () => true,
    }),
    { sent: 0, failed: 0 },
  );

  const nextExpiry = new Date("2026-11-16T12:00:00.000Z");
  await db
    .update(bankUsersTable)
    .set({ vaultSubscriptionExpiresAt: nextExpiry })
    .where(eq(bankUsersTable.id, userId));
  assert.deepEqual(
    await sendVaultExpiryReminders({
      now,
      onlyUserId: userId,
      sendReminder: async () => false,
    }),
    { sent: 0, failed: 1 },
  );
  assert.deepEqual(
    await sendVaultExpiryReminders({
      now,
      onlyUserId: userId,
      sendReminder: async (input) =>
        input.expiresAt.getTime() === nextExpiry.getTime(),
    }),
    { sent: 1, failed: 0 },
  );
});

test("Vault expiry reminder sends through the configured Resend sender", async () => {
  const variableNames = [
    "RESEND_API_KEY",
    "GLOBUS_SECURITY_EMAIL_FROM",
    "REPLIT_DOMAINS",
  ];
  const previousValues = variableNames.map((name) => process.env[name]);
  const originalFetch = globalThis.fetch;
  let sentMessage: Record<string, unknown> | null = null;
  let sentIdempotencyKey = "";
  process.env.RESEND_API_KEY = "test-resend-key";
  process.env.GLOBUS_SECURITY_EMAIL_FROM = "security@globus.website";
  process.env.REPLIT_DOMAINS = "globus.example";
  globalThis.fetch = async (_input, init) => {
    sentMessage = JSON.parse(String(init?.body)) as Record<string, unknown>;
    sentIdempotencyKey = new Headers(init?.headers).get("Idempotency-Key") ?? "";
    return new Response(null, { status: 200 });
  };
  try {
    assert.equal(
      await sendVaultExpiryReminderEmail({
        userId,
        recipient: email,
        expiresAt: new Date("2026-11-15T12:00:00.000Z"),
        autoRenew: false,
      }),
      true,
    );
    assert.equal(sentMessage?.to, email);
    assert.equal(sentMessage?.from, "Globus Bank <security@globus.website>");
    assert.ok(String(sentMessage?.text).includes("renew before the expiry time"));
    assert.match(sentIdempotencyKey, /^vault-expiry-[a-f0-9]{24}-\d+$/);
  } finally {
    globalThis.fetch = originalFetch;
    for (const [index, name] of variableNames.entries()) {
      const previous = previousValues[index];
      if (previous === undefined) delete process.env[name];
      else process.env[name] = previous;
    }
  }
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
