import { and, eq } from "drizzle-orm";
import {
  bankAuditLogsTable,
  bankCurrencyEnum,
  bankLedgerEntriesTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  bankOperationRestrictionError,
  createReference,
  formatMinorAmount,
  userWallet,
} from "./bank";
import { hasActiveVaultSubscription } from "./bank-vault";
import { storeNotification } from "./transfer-notifications";

type BankTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function createVaultSubscriberTopUp(
  tx: BankTransaction,
  input: {
    userId: string;
    currency: (typeof bankCurrencyEnum.enumValues)[number];
    amountMinor: bigint;
    idempotencyKey: string;
    description?: string;
  },
) {
  const [user] = await tx
    .select({
      vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
      vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
    })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, input.userId))
    .for("update");
  if (!user || !hasActiveVaultSubscription(user)) {
    return {
      error: "An active Private Vault subscription is required to add wallet funds.",
    } as const;
  }
  if (input.amountMinor <= 0n || input.amountMinor > 100_000_000n) {
    return { error: "Enter an amount from 0.01 to 1,000,000.00." } as const;
  }

  const wallet = await userWallet(tx, input.userId, input.currency);
  if (!wallet) return { error: "A wallet for this currency is unavailable." } as const;
  const restrictionError = await bankOperationRestrictionError(tx, {
    userId: input.userId,
    walletId: wallet.id,
    operation: "deposit",
  });
  if (restrictionError) return { error: restrictionError } as const;

  const [lockedWallet] = await tx
    .select()
    .from(bankWalletsTable)
    .where(
      and(
        eq(bankWalletsTable.id, wallet.id),
        eq(bankWalletsTable.userId, input.userId),
      ),
    )
    .for("update");
  if (!lockedWallet) return { error: "The selected wallet is unavailable." } as const;
  if (!lockedWallet.depositsEnabled) {
    return {
      error: "Adding funds is disabled for this wallet in your Private Vault settings.",
    } as const;
  }

  const commitRestrictionError = await bankOperationRestrictionError(tx, {
    userId: input.userId,
    walletId: lockedWallet.id,
    operation: "deposit",
  });
  if (commitRestrictionError) return { error: commitRestrictionError } as const;

  const reference = createReference();
  const [transaction] = await tx
    .insert(bankTransactionsTable)
    .values({
      reference,
      idempotencyKey: input.idempotencyKey,
      initiatedByUserId: input.userId,
      fromUserId: input.userId,
      toWalletId: lockedWallet.id,
      type: "deposit_request",
      status: "completed",
      currency: input.currency,
      amountMinor: input.amountMinor,
      counterparty: null,
      description: input.description?.trim() || "Private Vault wallet top-up",
      mode: "internal_ledger",
    })
    .returning();
  await tx.insert(bankLedgerEntriesTable).values([
    {
      transactionId: transaction.id,
      accountCode: `internal:deposit:${input.currency}`,
      currency: input.currency,
      side: "debit",
      amountMinor: input.amountMinor,
    },
    {
      transactionId: transaction.id,
      walletId: lockedWallet.id,
      accountCode: `wallet:${lockedWallet.id}`,
      currency: input.currency,
      side: "credit",
      amountMinor: input.amountMinor,
    },
  ]);
  const [request] = await tx
    .insert(bankSandboxRequestsTable)
    .values({
      userId: input.userId,
      transactionId: transaction.id,
      reference,
      idempotencyKey: input.idempotencyKey,
      type: "deposit",
      currency: input.currency,
      destinationCurrency: null,
      savedPaymentMethodId: null,
      paymentMethod: null,
      paymentMethodSummary: null,
      amountMinor: input.amountMinor,
      status: "approved",
    })
    .returning();
  const notification = await storeNotification(tx, {
    userId: input.userId,
    category: "wallet",
    title: "Wallet funds added",
    body: `Your ${input.currency} wallet was credited ${formatMinorAmount(input.amountMinor)} ${input.currency}.`,
    reference,
  });
  await tx.insert(bankAuditLogsTable).values({
    actorUserId: input.userId,
    targetUserId: input.userId,
    action: "customer_wallet_top_up",
    reason: `Active Private Vault subscriber added ${formatMinorAmount(input.amountMinor)} ${input.currency} to wallet ${lockedWallet.id}. Reference ${reference}.`,
  });

  return { sandboxRequest: request, transaction, notification } as const;
}
