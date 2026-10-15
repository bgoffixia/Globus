import { randomInt, randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { and, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import {
  bankCurrencyEnum,
  bankLedgerEntriesTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
} from "@workspace/db";

export const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"] as const;
export type BankCurrency = (typeof currencies)[number];

const customerIdAlphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export function generateCustomerId(): string {
  return Array.from(
    { length: 7 },
    () => customerIdAlphabet.charAt(randomInt(customerIdAlphabet.length)),
  ).join("");
}

export async function backfillCustomerIds(): Promise<void> {
  const missing = await db
    .select({ id: bankUsersTable.id })
    .from(bankUsersTable)
    .where(isNull(bankUsersTable.customerId));

  for (const user of missing) {
    let assigned = false;
    for (let attempt = 0; attempt < 10; attempt += 1) {
      try {
        await db
          .update(bankUsersTable)
          .set({ customerId: generateCustomerId(), updatedAt: new Date() })
          .where(
            and(
              eq(bankUsersTable.id, user.id),
              isNull(bankUsersTable.customerId),
            ),
          );
        assigned = true;
        break;
      } catch (error) {
        const uniqueConflict =
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "23505";
        if (!uniqueConflict) throw error;
      }
    }
    if (!assigned) {
      throw new Error("Could not allocate a unique Globus Customer ID.");
    }
  }
}

export function parseAmountToMinor(amount: string): bigint {
  const match = /^(\d{1,12})(?:\.(\d{1,2}))?$/.exec(amount);
  if (!match) {
    throw new Error("Enter a valid amount with up to two decimal places.");
  }

  const whole = BigInt(match[1]);
  const fraction = BigInt((match[2] ?? "").padEnd(2, "0"));
  return whole * 100n + fraction;
}

export function formatMinorAmount(amountMinor: bigint): string {
  const negative = amountMinor < 0n;
  const absolute = negative ? -amountMinor : amountMinor;
  const whole = absolute / 100n;
  const fraction = (absolute % 100n).toString().padStart(2, "0");
  return `${negative ? "-" : ""}${whole}.${fraction}`;
}

export function createReference(): string {
  return `GBS-${randomUUID().replaceAll("-", "").slice(0, 14).toUpperCase()}`;
}

export async function ensureBankUser(
  clerkUserId: string,
  loadClerkIdentity: ClerkIdentityLoader = (userId) =>
    clerkClient.users.getUser(userId),
) {
  const [existing] = await db
    .select()
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, clerkUserId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const identity = await loadClerkIdentity(clerkUserId);
  const primaryEmailRecord = identity.emailAddresses.find(
    (email) => email.id === identity.primaryEmailAddressId,
  );
  const primaryEmail = primaryEmailRecord?.emailAddress;

  if (!primaryEmail || primaryEmailRecord?.verification?.status !== "verified") {
    throw new Error("A verified email address is required for a Globus account.");
  }

  return db.transaction(async (tx) => {
    const [existingByEmail] = await tx
      .select()
      .from(bankUsersTable)
      .where(sql`lower(${bankUsersTable.email}) = ${primaryEmail.toLowerCase()}`)
      .limit(1);

    if (existingByEmail) {
      await tx
        .insert(bankWalletsTable)
        .values(
          currencies.map((currency) => ({
            userId: existingByEmail.id,
            currency,
          })),
        )
        .onConflictDoNothing();
      return existingByEmail;
    }

    const [user] = await tx
      .insert(bankUsersTable)
      .values({
        id: clerkUserId,
        email: primaryEmail,
        customerId: generateCustomerId(),
      })
      .onConflictDoNothing()
      .returning();

    // Another sign-in can create the same verified email concurrently. Reuse
    // that canonical row instead of attempting a second profile or balance.
    const [resolvedUser] = user
      ? [user]
      : await tx
          .select()
          .from(bankUsersTable)
          .where(sql`lower(${bankUsersTable.email}) = ${primaryEmail.toLowerCase()}`)
          .limit(1);
    if (!resolvedUser) {
      throw new Error("Could not resolve the Globus account for this email.");
    }

    if (!user) {
      await tx
        .insert(bankWalletsTable)
        .values(
          currencies.map((currency) => ({
            userId: resolvedUser.id,
            currency,
          })),
        )
        .onConflictDoNothing();
      return resolvedUser;
    }

    await tx
      .insert(bankWalletsTable)
      .values(
        currencies.map((currency) => ({
          userId: resolvedUser.id,
          currency,
        })),
      )
      .onConflictDoNothing();

    return resolvedUser;
  });
}

export async function getWalletsForUser(userId: string) {
  const wallets = await db
    .select()
    .from(bankWalletsTable)
    .where(eq(bankWalletsTable.userId, userId))
    .orderBy(bankWalletsTable.currency);

  const walletIds = wallets.map((wallet) => wallet.id);
  const balances =
    walletIds.length === 0
      ? []
      : await db
          .select({
            walletId: bankLedgerEntriesTable.walletId,
            balance: sql<string>`coalesce(sum(case when ${bankLedgerEntriesTable.side} = 'credit' then ${bankLedgerEntriesTable.amountMinor} else -${bankLedgerEntriesTable.amountMinor} end), 0)::text`,
          })
          .from(bankLedgerEntriesTable)
          .where(inArray(bankLedgerEntriesTable.walletId, walletIds))
          .groupBy(bankLedgerEntriesTable.walletId);

  const balanceByWallet = new Map(
    balances.map((balance) => [balance.walletId, BigInt(balance.balance)]),
  );
  const activeRequestStatuses = ["pending_review", "pending_provider_setup"];
  const [pendingDeposits, pendingWithdrawals] =
    walletIds.length === 0
      ? [[], []]
      : await Promise.all([
          db
            .select({
              walletId: bankTransactionsTable.toWalletId,
              amountMinor: sql<string>`coalesce(sum(${bankSandboxRequestsTable.amountMinor}), 0)::text`,
            })
            .from(bankSandboxRequestsTable)
            .innerJoin(
              bankTransactionsTable,
              eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
            )
            .where(
              and(
                eq(bankSandboxRequestsTable.userId, userId),
                eq(bankSandboxRequestsTable.type, "deposit"),
                inArray(bankSandboxRequestsTable.status, activeRequestStatuses),
                inArray(bankTransactionsTable.toWalletId, walletIds),
              ),
            )
            .groupBy(bankTransactionsTable.toWalletId),
          db
            .select({
              walletId: bankTransactionsTable.fromWalletId,
              amountMinor: sql<string>`coalesce(sum(${bankSandboxRequestsTable.amountMinor}), 0)::text`,
            })
            .from(bankSandboxRequestsTable)
            .innerJoin(
              bankTransactionsTable,
              eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
            )
            .where(
              and(
                eq(bankSandboxRequestsTable.userId, userId),
                eq(bankSandboxRequestsTable.type, "withdrawal"),
                inArray(bankSandboxRequestsTable.status, activeRequestStatuses),
                inArray(bankTransactionsTable.fromWalletId, walletIds),
              ),
            )
            .groupBy(bankTransactionsTable.fromWalletId),
        ]);
  const pendingByWallet = new Map(
    pendingDeposits.map((request) => [
      request.walletId,
      BigInt(request.amountMinor),
    ]),
  );
  const reservedByWallet = new Map(
    pendingWithdrawals.map((request) => [
      request.walletId,
      BigInt(request.amountMinor),
    ]),
  );

  return wallets.map((wallet) => ({
    id: wallet.id,
    currency: wallet.currency as BankCurrency,
    available: formatMinorAmount(
      (balanceByWallet.get(wallet.id) ?? 0n) -
        (reservedByWallet.get(wallet.id) ?? 0n),
    ),
    pending: formatMinorAmount(pendingByWallet.get(wallet.id) ?? 0n),
    reserved: formatMinorAmount(reservedByWallet.get(wallet.id) ?? 0n),
    status: wallet.status as "active" | "restricted",
  }));
}

export function toBankTransaction(
  transaction: typeof bankTransactionsTable.$inferSelect,
  viewerUserId: string,
) {
  let type:
    | "simulation_credit"
    | "admin_funding"
    | "admin_debit"
    | "transfer_in"
    | "transfer_out"
    | "external_transfer"
    | "external_transfer_in"
    | "deposit_request"
    | "withdrawal_request"
    | "exchange_request";

  if (transaction.type === "transfer") {
    type = transaction.toUserId === viewerUserId ? "transfer_in" : "transfer_out";
  } else if (
    transaction.type === "admin_funding" &&
    transaction.fromUserId === viewerUserId
  ) {
    type = "admin_debit";
  } else if (transaction.type === "sandbox_credit") {
    type = "simulation_credit";
  } else {
    type = transaction.type;
  }

  const isLegacyExternalEntry =
    transaction.type === "external_transfer" ||
    transaction.type === "external_transfer_in";
  const description = isLegacyExternalEntry
    ? "Prior internal ledger entry"
    : transaction.type === "sandbox_credit"
      ? "Opening ledger balance"
      : transaction.description === "Sandbox transfer"
        ? "Member ledger transfer"
        : transaction.description.replace(
            /\b(simulated|simulation|sandbox)\b/gi,
            "internal ledger",
          );

  return {
    id: transaction.id,
    reference: transaction.reference,
    type,
    status: transaction.status,
    currency: transaction.currency as BankCurrency,
    amount: formatMinorAmount(transaction.amountMinor),
    fee: formatMinorAmount(transaction.feeMinor),
    counterparty:
      isLegacyExternalEntry
        ? "Internal ledger"
        : transaction.type === "transfer" && transaction.toUserId === viewerUserId
        ? "Globus member"
        : transaction.counterparty &&
          /^(globus )?(sandbox|simulation) ledger$/i.test(transaction.counterparty)
        ? "Internal ledger"
        : transaction.counterparty,
    description,
    mode: "internal_ledger" as const,
    createdAt: transaction.createdAt.toISOString(),
  };
}

export async function getRecentTransactions(userId: string, limit = 10) {
  const rows = await db
    .select()
    .from(bankTransactionsTable)
    .where(
      or(
        eq(bankTransactionsTable.fromUserId, userId),
        eq(bankTransactionsTable.toUserId, userId),
      ),
    )
    .orderBy(desc(bankTransactionsTable.createdAt))
    .limit(limit);

  return rows.map((transaction) => toBankTransaction(transaction, userId));
}

export async function getTransactionByIdempotencyKey(idempotencyKey: string) {
  const [transaction] = await db
    .select()
    .from(bankTransactionsTable)
    .where(eq(bankTransactionsTable.idempotencyKey, idempotencyKey))
    .limit(1);

  return transaction;
}

export async function balanceForWallet(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  walletId: string,
): Promise<bigint> {
  const [result] = await tx
    .select({
      balance: sql<string>`coalesce(sum(case when ${bankLedgerEntriesTable.side} = 'credit' then ${bankLedgerEntriesTable.amountMinor} else -${bankLedgerEntriesTable.amountMinor} end), 0)::text`,
    })
    .from(bankLedgerEntriesTable)
    .where(eq(bankLedgerEntriesTable.walletId, walletId));

  return BigInt(result.balance);
}

export async function reservedForWallet(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  walletId: string,
): Promise<bigint> {
  const [result] = await tx
    .select({
      amount: sql<string>`coalesce(sum(${bankSandboxRequestsTable.amountMinor}), 0)::text`,
    })
    .from(bankSandboxRequestsTable)
    .innerJoin(
      bankTransactionsTable,
      eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
    )
    .where(
      and(
        eq(bankSandboxRequestsTable.type, "withdrawal"),
        inArray(bankSandboxRequestsTable.status, [
          "pending_review",
          "pending_provider_setup",
        ]),
        eq(bankTransactionsTable.fromWalletId, walletId),
      ),
    );

  return BigInt(result.amount);
}

export async function userWallet(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  currency: (typeof bankCurrencyEnum.enumValues)[number],
) {
  const [wallet] = await tx
    .select()
    .from(bankWalletsTable)
    .where(
      and(
        eq(bankWalletsTable.userId, userId),
        eq(bankWalletsTable.currency, currency),
      ),
    )
    .limit(1);

  return wallet;
}

export async function listUserTransactions(
  userId: string,
  filters: {
    currency?: BankCurrency;
    status?: "completed" | "pending" | "failed" | "reversed";
    search?: string;
    limit: number;
  },
) {
  const clauses = [
    or(
      eq(bankTransactionsTable.fromUserId, userId),
      eq(bankTransactionsTable.toUserId, userId),
    ),
  ];

  if (filters.currency) {
    clauses.push(eq(bankTransactionsTable.currency, filters.currency));
  }
  if (filters.status) {
    clauses.push(eq(bankTransactionsTable.status, filters.status));
  }
  if (filters.search) {
    const needle = `%${filters.search}%`;
    clauses.push(
      or(
        sql`${bankTransactionsTable.reference} ilike ${needle}`,
        sql`${bankTransactionsTable.counterparty} ilike ${needle}`,
        sql`${bankTransactionsTable.description} ilike ${needle}`,
      ),
    );
  }

  const rows = await db
    .select()
    .from(bankTransactionsTable)
    .where(and(...clauses))
    .orderBy(desc(bankTransactionsTable.createdAt))
    .limit(filters.limit);

  return rows.map((transaction) => toBankTransaction(transaction, userId));
}

export type ClerkIdentityLoader = (
  clerkUserId: string,
) => ReturnType<typeof clerkClient.users.getUser>;
