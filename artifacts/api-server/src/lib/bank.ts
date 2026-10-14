import { randomUUID } from "node:crypto";
import { clerkClient } from "@clerk/express";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import {
  bankCurrencyEnum,
  bankLedgerEntriesTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
} from "@workspace/db";

export const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"] as const;
export type BankCurrency = (typeof currencies)[number];

const welcomeSimulationAmount = 250_000n;

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

export async function ensureBankUser(clerkUserId: string) {
  const [existing] = await db
    .select()
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, clerkUserId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const clerk = clerkClient;
  const identity = await clerk.users.getUser(clerkUserId);
  const primaryEmail = identity.emailAddresses.find(
    (email) => email.id === identity.primaryEmailAddressId,
  )?.emailAddress;

  if (!primaryEmail) {
    throw new Error("A verified email address is required for a Globus account.");
  }

  return db.transaction(async (tx) => {
    const [user] = await tx
      .insert(bankUsersTable)
      .values({ id: clerkUserId, email: primaryEmail })
      .onConflictDoUpdate({
        target: bankUsersTable.id,
        set: { email: primaryEmail, updatedAt: new Date() },
      })
      .returning();

    await tx
      .insert(bankWalletsTable)
      .values(
        currencies.map((currency) => ({
          userId: clerkUserId,
          currency,
        })),
      )
      .onConflictDoNothing();

    const [usdWallet] = await tx
      .select()
      .from(bankWalletsTable)
      .where(
        and(
          eq(bankWalletsTable.userId, clerkUserId),
          eq(bankWalletsTable.currency, "USD"),
        ),
      )
      .limit(1);

    const [welcomeTransaction] = await tx
      .insert(bankTransactionsTable)
      .values({
        reference: createReference(),
        idempotencyKey: `sandbox-welcome:${clerkUserId}`,
        initiatedByUserId: clerkUserId,
        toUserId: clerkUserId,
        toWalletId: usdWallet.id,
        type: "simulation_credit",
        status: "completed",
        currency: "USD",
        amountMinor: welcomeSimulationAmount,
        counterparty: "Simulation ledger",
        description: "Starting simulated balance — no real funds.",
        mode: "simulation",
      })
      .onConflictDoNothing({
        target: bankTransactionsTable.idempotencyKey,
      })
      .returning();

    if (welcomeTransaction) {
      await tx.insert(bankLedgerEntriesTable).values([
        {
          transactionId: welcomeTransaction.id,
          accountCode: "simulation:clearing:USD",
          currency: "USD",
          side: "debit",
          amountMinor: welcomeSimulationAmount,
        },
        {
          transactionId: welcomeTransaction.id,
          walletId: usdWallet.id,
          accountCode: `wallet:${usdWallet.id}`,
          currency: "USD",
          side: "credit",
          amountMinor: welcomeSimulationAmount,
        },
      ]);
    }

    return user;
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

  return wallets.map((wallet) => ({
    id: wallet.id,
    currency: wallet.currency as BankCurrency,
    available: formatMinorAmount(balanceByWallet.get(wallet.id) ?? 0n),
    pending: "0.00",
    reserved: "0.00",
    status: wallet.status as "active" | "restricted",
  }));
}

export function toBankTransaction(
  transaction: typeof bankTransactionsTable.$inferSelect,
  viewerUserId: string,
) {
  let type:
    | "simulation_credit"
    | "transfer_in"
    | "transfer_out"
    | "external_transfer"
    | "deposit_request"
    | "withdrawal_request"
    | "exchange_request";

  if (transaction.type === "transfer") {
    type = transaction.toUserId === viewerUserId ? "transfer_in" : "transfer_out";
  } else if (transaction.type === "sandbox_credit") {
    type = "simulation_credit";
  } else {
    type = transaction.type;
  }

  const description =
    transaction.type === "sandbox_credit"
      ? "Starting simulated balance — no real funds."
      : transaction.description === "Sandbox transfer"
        ? "Simulated member transfer"
        : transaction.description;

  return {
    id: transaction.id,
    reference: transaction.reference,
    type,
    status: transaction.status,
    currency: transaction.currency as BankCurrency,
    amount: formatMinorAmount(transaction.amountMinor),
    fee: formatMinorAmount(transaction.feeMinor),
    counterparty:
      transaction.counterparty === "Globus sandbox ledger"
        ? "Simulation ledger"
        : transaction.counterparty,
    description,
    mode: "simulation" as const,
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
