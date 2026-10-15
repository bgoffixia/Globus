import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import {
  bankLedgerEntriesTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
  pool,
} from "@workspace/db";
import { clerkClient } from "@clerk/express";
import {
  ensureBankUser,
  getWalletsForUser,
  listUserTransactions,
  type ClerkIdentityLoader,
} from "../src/lib/bank";

const fixtureId = randomUUID();
const canonicalUserId = `identity-check-canonical-${fixtureId}`;
const alternateClerkUserId = `identity-check-alternate-${fixtureId}`;
const unrelatedClerkUserId = `identity-check-unrelated-${fixtureId}`;
const unverifiedClerkUserId = `identity-check-unverified-${fixtureId}`;
const verifiedEmail = `identity-check-${fixtureId}@example.test`;
const transactionKey = `identity-check-activity-${fixtureId}`;

after(async () => {
  await pool.end();
});

test("signed-in identity reuse preserves the canonical wallet and transaction history", async () => {
  const mockIdentityLoader: ClerkIdentityLoader = async (clerkUserId) => {
    const emailAddress =
      clerkUserId === unrelatedClerkUserId
        ? `unrelated-${fixtureId}@example.test`
        : clerkUserId === unverifiedClerkUserId
          ? verifiedEmail
          : verifiedEmail.toUpperCase();
    return {
      primaryEmailAddressId: `primary-${clerkUserId}`,
      emailAddresses: [
        {
          id: `primary-${clerkUserId}`,
          emailAddress,
          verification: {
            status: clerkUserId === unverifiedClerkUserId ? "unverified" : "verified",
          },
        },
      ],
    } as Awaited<ReturnType<typeof clerkClient.users.getUser>>;
  };

  try {
    await db.insert(bankUsersTable).values({
      id: canonicalUserId,
      email: verifiedEmail,
    });
    const [originalWallet] = await db
      .insert(bankWalletsTable)
      .values({ userId: canonicalUserId, currency: "USD" })
      .returning();
    const [originalTransaction] = await db
      .insert(bankTransactionsTable)
      .values({
        reference: `GBS-${fixtureId.replaceAll("-", "").slice(0, 14).toUpperCase()}`,
        idempotencyKey: transactionKey,
        initiatedByUserId: canonicalUserId,
        toUserId: canonicalUserId,
        toWalletId: originalWallet.id,
        type: "simulation_credit",
        status: "completed",
        currency: "USD",
        amountMinor: 123_456n,
        description: "Identity resolution regression fixture",
      })
      .returning();
    await db.insert(bankLedgerEntriesTable).values({
      transactionId: originalTransaction.id,
      walletId: originalWallet.id,
      accountCode: `wallet:${originalWallet.id}`,
      currency: "USD",
      side: "credit",
      amountMinor: 123_456n,
    });

    const walletsBefore = await getWalletsForUser(canonicalUserId);
    const transactionsBefore = await listUserTransactions(canonicalUserId, {
      limit: 25,
    });
    const originalUsdWallet = walletsBefore.find(
      (wallet) => wallet.currency === "USD",
    );
    assert.ok(originalUsdWallet);
    assert.equal(originalUsdWallet.available, "1234.56");

    const resolvedUser = await ensureBankUser(
      alternateClerkUserId,
      mockIdentityLoader,
    );
    assert.equal(resolvedUser.id, canonicalUserId);

    const duplicateEmailProfiles = await db
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(sql`lower(${bankUsersTable.email}) = ${verifiedEmail.toLowerCase()}`);
    assert.deepEqual(duplicateEmailProfiles, [{ id: canonicalUserId }]);

    const walletsAfter = await getWalletsForUser(canonicalUserId);
    const transactionsAfter = await listUserTransactions(canonicalUserId, {
      limit: 25,
    });
    assert.deepEqual(
      walletsAfter.find((wallet) => wallet.currency === "USD"),
      originalUsdWallet,
    );
    assert.deepEqual(transactionsAfter, transactionsBefore);
    assert.ok(
      walletsAfter.some((wallet) => wallet.id === originalWallet.id),
      "the canonical wallet remains available",
    );
    assert.equal(
      walletsAfter.filter((wallet) => wallet.currency === "USD").length,
      1,
      "identity resolution does not duplicate a currency wallet",
    );

    await assert.rejects(
      ensureBankUser(unverifiedClerkUserId, mockIdentityLoader),
      /verified email address is required/i,
    );
    const unverifiedProfile = await db
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, unverifiedClerkUserId));
    assert.deepEqual(unverifiedProfile, []);

    const unrelatedUser = await ensureBankUser(
      unrelatedClerkUserId,
      mockIdentityLoader,
    );
    assert.notEqual(unrelatedUser.id, canonicalUserId);
    assert.equal(
      unrelatedUser.id,
      unrelatedClerkUserId,
      "an unrelated verified email creates its own profile, not access to another member",
    );

    const alternateProfile = await db
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, alternateClerkUserId));
    assert.deepEqual(alternateProfile, []);
  } finally {
    const generatedUserIds = [
      canonicalUserId,
      alternateClerkUserId,
      unrelatedClerkUserId,
      unverifiedClerkUserId,
    ];
    const generatedTransactions = await db
      .select({ id: bankTransactionsTable.id })
      .from(bankTransactionsTable)
      .where(inArray(bankTransactionsTable.initiatedByUserId, generatedUserIds));
    const transactionIds = generatedTransactions.map(({ id }) => id);
    if (transactionIds.length > 0) {
      await db
        .delete(bankLedgerEntriesTable)
        .where(inArray(bankLedgerEntriesTable.transactionId, transactionIds));
      await db
        .delete(bankTransactionsTable)
        .where(inArray(bankTransactionsTable.id, transactionIds));
    }
    await db
      .delete(bankWalletsTable)
      .where(inArray(bankWalletsTable.userId, generatedUserIds));
    await db
      .delete(bankUsersTable)
      .where(inArray(bankUsersTable.id, generatedUserIds));
  }
});
