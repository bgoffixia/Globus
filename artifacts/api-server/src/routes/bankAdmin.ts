import { Router, type IRouter, type RequestHandler } from "express";
import { pipeline } from "node:stream/promises";
import { clerkClient, getAuth } from "@clerk/express";
import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  gt,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateAdminFundingBody,
  CreateAdminFundingParams,
  CreateAdminFundingResponse,
  CreateAdminRestrictionBody,
  CreateAdminRestrictionResponse,
  CreateAdminTransactionCorrectionBody,
  CreateAdminTransactionCorrectionParams,
  CreateAdminTransactionCorrectionResponse,
  GetAdminIdentityDocumentContentParams,
  GetAdminAccessResponse,
  GetAdminSettingsResponse,
  GetAdminSummaryResponse,
  GetAdminTransactionDetailParams,
  GetAdminTransactionDetailResponse,
  GetAdminUserDetailParams,
  GetAdminUserDetailResponse,
  ListAdminRestrictionsQueryParams,
  ListAdminRestrictionsResponse,
  ListAdminAccountsQueryParams,
  ListAdminAccountsResponse,
  ListAdminAuditLogsQueryParams,
  ListAdminAuditLogsResponse,
  ListAdminTransactionsQueryParams,
  ListAdminTransactionsResponse,
  ListAdminLedgerRequestsResponse,
  ListAdminLedgerQueryParams,
  ListAdminLedgerResponse,
  ListAdminTransactionStatusHistoryParams,
  ListAdminTransactionStatusHistoryResponse,
  ListAdminIdentityDocumentsParams,
  ListAdminIdentityDocumentsResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  ListAdminLedgerRequestsQueryParams,
  UpdateAdminUserVerificationBody,
  UpdateAdminUserVerificationParams,
  UpdateAdminUserVerificationResponse,
  UpdateAdminUserStatusBody,
  UpdateAdminUserStatusParams,
  UpdateAdminUserStatusResponse,
  UpdateAdminUserProfileBody,
  UpdateAdminUserProfileParams,
  UpdateAdminUserProfileResponse,
  UpdateAdminUserVaultSubscriptionBody,
  UpdateAdminUserVaultSubscriptionParams,
  UpdateAdminUserVaultSubscriptionResponse,
  UpdateAdminSettingsBody,
  UpdateAdminSettingsResponse,
  UpdateAdminWalletStatusBody,
  UpdateAdminWalletStatusParams,
  UpdateAdminWalletStatusResponse,
  ReviewAdminFundingBody,
  ReviewAdminFundingParams,
  ReviewAdminFundingResponse,
  UpdateAdminTransactionStatusBody,
  UpdateAdminTransactionStatusParams,
  UpdateAdminTransactionStatusResponse,
  ProcessAdminInternalTransferBody,
  ProcessAdminInternalTransferParams,
  ProcessAdminInternalTransferResponse,
  ResetAdminUserPasswordBody,
  ResetAdminUserPasswordParams,
  ResetAdminUserPasswordResponse,
  RemoveAdminRestrictionBody,
  RemoveAdminRestrictionParams,
  RemoveAdminRestrictionResponse,
  UpsertBankExchangeRateBody,
  UpsertBankExchangeRateResponse,
  ReviewAdminLedgerRequestBody,
  ReviewAdminLedgerRequestParams,
  ReviewAdminLedgerRequestResponse,
  ResetAdminUserTransactionPinBody,
  ResetAdminUserTransactionPinParams,
  ResetAdminUserTransactionPinResponse,
} from "@workspace/api-zod";
import {
  bankAuditLogsTable,
  bankAdminSettingsTable,
  bankExchangeRatesTable,
  bankIdentityDocumentsTable,
  bankInternationalTransferRequestsTable,
  bankLedgerEntriesTable,
  bankRestrictionsTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankVaultSessionsTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  isPasswordResetRequired,
  setPasswordResetCache,
} from "../lib/password-reset";
import { sendPasswordResetEmail } from "../lib/password-reset-email";
import {
  balanceForWallet,
  bankOperationRestrictionError,
  createReference,
  ensureBankUser,
  formatMinorAmount,
  getWalletsForUser,
  listUserTransactions,
  parseAmountToMinor,
  reservedForWallet,
  toBankTransaction,
  userWallet,
} from "../lib/bank";
import {
  deleteIdentityDocumentObject,
  getIdentityDocumentFile,
} from "../lib/identityDocumentStorage";
import { verifyTransactionPin } from "../lib/transaction-pin";
import { vaultSubscriptionStatus } from "../lib/bank-vault";
import {
  notifyTransferRecipient,
  sendPushToUser,
  storeNotification,
} from "../lib/transfer-notifications";

const router: IRouter = Router();

function configuredAdminIds(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_CLERK_IDS ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function isAllowlistedAdmin(userId: string): Promise<boolean> {
  if (configuredAdminIds().has(userId)) return true;

  const allowedEmails = configuredAdminEmails();
  if (allowedEmails.size === 0) return false;

  const identity = await clerkClient.users.getUser(userId);
  const primaryEmail = identity.emailAddresses.find(
    (email) => email.id === identity.primaryEmailAddressId,
  );

  return Boolean(
    primaryEmail?.verification?.status === "verified" &&
      allowedEmails.has(primaryEmail.emailAddress.trim().toLowerCase()),
  );
}

function restrictionStatus(
  restriction: typeof bankRestrictionsTable.$inferSelect,
  now = new Date(),
): "active" | "scheduled" | "expired" | "removed" {
  if (restriction.status === "removed") return "removed";
  if (restriction.effectiveAt > now) return "scheduled";
  if (restriction.expiresAt && restriction.expiresAt <= now) return "expired";
  return "active";
}

function adminRestrictionResponse(input: {
  restriction: typeof bankRestrictionsTable.$inferSelect;
  customer: typeof bankUsersTable.$inferSelect;
  wallet?: typeof bankWalletsTable.$inferSelect;
  createdBy?: typeof bankUsersTable.$inferSelect;
  removedBy?: typeof bankUsersTable.$inferSelect;
}) {
  const { restriction, customer, wallet, createdBy, removedBy } = input;
  return {
    id: restriction.id,
    userId: restriction.userId,
    customerId: customer.customerId,
    userName:
      [customer.firstName, customer.lastName].filter(Boolean).join(" ") ||
      "Globus member",
    email: customer.email,
    walletId: restriction.walletId,
    walletCurrency: wallet?.currency ?? null,
    type: restriction.type,
    status: restrictionStatus(restriction),
    reason: restriction.reason,
    effectiveAt: restriction.effectiveAt.toISOString(),
    expiresAt: restriction.expiresAt?.toISOString() ?? null,
    internalNotes: restriction.internalNotes,
    createdByName:
      [createdBy?.firstName, createdBy?.lastName].filter(Boolean).join(" ") ||
      createdBy?.email ||
      "Unknown administrator",
    createdByEmail: createdBy?.email ?? "unknown@invalid.local",
    createdAt: restriction.createdAt.toISOString(),
    removedAt: restriction.removedAt?.toISOString() ?? null,
    removedByName: removedBy
      ? [removedBy.firstName, removedBy.lastName].filter(Boolean).join(" ") ||
        removedBy.email
      : null,
    removalReason: restriction.removalReason,
  };
}

function ledgerPostingsBalanced(
  entries: Array<{
    currency: string;
    side: string;
    amountMinor: bigint;
  }>,
): boolean {
  if (entries.length < 2) return false;
  const totals = new Map<string, { debit: bigint; credit: bigint }>();
  for (const entry of entries) {
    if (
      entry.amountMinor <= 0n ||
      (entry.side !== "debit" && entry.side !== "credit")
    ) {
      return false;
    }
    const total = totals.get(entry.currency) ?? { debit: 0n, credit: 0n };
    total[entry.side] += entry.amountMinor;
    totals.set(entry.currency, total);
  }
  return (
    totals.size > 0 &&
    [...totals.values()].every(
      ({ debit, credit }) => debit > 0n && debit === credit,
    )
  );
}

const requireSignedIn: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  next();
};

const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  try {
    if (await isPasswordResetRequired(userId)) {
      res.status(423).json({
        error: "Update your password before accessing administrator tools.",
      });
      return;
    }
  } catch {
    res.status(503).json({
      error: "Account security could not be verified right now.",
    });
    return;
  }
  let allowed: boolean;
  try {
    allowed = await isAllowlistedAdmin(userId);
  } catch {
    res.status(503).json({
      error: "Administrator access could not be verified right now.",
    });
    return;
  }
  if (!allowed) {
    res.status(403).json({ error: "Administrator access is not enabled for this account." });
    return;
  }
  next();
};

async function getOrCreateAdminSettings() {
  await db
    .insert(bankAdminSettingsTable)
    .values({ id: "operations" })
    .onConflictDoNothing();
  const [settings] = await db
    .select()
    .from(bankAdminSettingsTable)
    .where(eq(bankAdminSettingsTable.id, "operations"))
    .limit(1);
  if (!settings) throw new Error("Administrative settings are unavailable.");
  return settings;
}

function respondWithTransactionPinError(
  res: import("express").Response,
  result: Exclude<
    Awaited<ReturnType<typeof verifyTransactionPin>>,
    "valid"
  >,
): void {
  if (result === "not_configured") {
    res.status(409).json({
      error: "Set a 6-digit transaction PIN in Settings before approving transactions.",
    });
  } else if (result === "locked") {
    res.status(429).json({
      error: "Too many incorrect PIN attempts. Try again in 15 minutes.",
    });
  } else if (result === "invalid") {
    res.status(403).json({ error: "The transaction PIN is incorrect." });
  } else {
    res.status(404).json({ error: "The account for this transaction was not found." });
  }
}

async function runIdentityReview(input: {
  actorUserId: string;
  userId: string;
  verificationStatus:
    | "approved"
    | "rejected"
    | "additional_information_required";
  reason: string;
  userMessage: string | null;
}) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, input.userId))
      .for("update");
    if (!user) {
      return { notFound: true as const };
    }
    if (
      user.verificationStatus !== "pending" &&
      user.verificationStatus !== "additional_information_required"
    ) {
      return { error: "This user does not have an identity review awaiting a decision." };
    }

    const documents = await tx
      .select()
      .from(bankIdentityDocumentsTable)
      .where(eq(bankIdentityDocumentsTable.userId, input.userId))
      .for("update");
    if (documents.some((document) => document.status !== "uploaded")) {
      return {
        error:
          "Finish or remove each in-progress identity document upload before recording a decision.",
      };
    }

    const finalDecision =
      input.verificationStatus === "approved" ||
      input.verificationStatus === "rejected";
    if (finalDecision) {
      for (const document of documents) {
        await deleteIdentityDocumentObject(document.objectPath);
      }
    }

    const [updated] = await tx
      .update(bankUsersTable)
      .set({
        verificationStatus: input.verificationStatus,
        verificationNote: input.userMessage,
        updatedAt: new Date(),
      })
      .where(eq(bankUsersTable.id, input.userId))
      .returning();
    if (finalDecision) {
      await tx
        .delete(bankIdentityDocumentsTable)
        .where(eq(bankIdentityDocumentsTable.userId, input.userId));
    }
    await tx.insert(bankAuditLogsTable).values({
      actorUserId: input.actorUserId,
      targetUserId: input.userId,
      action: `identity_review_${input.verificationStatus}`,
      reason: input.reason,
    });
    const [walletCount] = await tx
      .select({ value: count() })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.userId, input.userId));
    return { user: updated, walletCount: Number(walletCount?.value ?? 0) };
  });
}

router.get("/bank/admin/access", requireSignedIn, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  let allowed = false;
  if (userId) {
    try {
      allowed = await isAllowlistedAdmin(userId);
    } catch {
      res.status(503).json({
        error: "Administrator access could not be verified right now.",
      });
      return;
    }
  }
  res.json(
    GetAdminAccessResponse.parse({
      allowed,
      roles: allowed ? ["super_administrator"] : [],
    }),
  );
});

router.put("/bank/admin/exchange-rates", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpsertBankExchangeRateBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  if (parsed.data.sourceCurrency === parsed.data.destinationCurrency) {
    res.status(400).json({ error: "Choose two different currencies." });
    return;
  }
  if (!Number.isFinite(Number(parsed.data.rate)) || Number(parsed.data.rate) <= 0) {
    res.status(400).json({ error: "The rate must be greater than zero." });
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const actor = await ensureBankUser(clerkUserId);
  const pinResult = await verifyTransactionPin(actor.id, parsed.data.transactionPin);
  if (pinResult !== "valid") {
    respondWithTransactionPinError(res, pinResult);
    return;
  }
  const reason = parsed.data.reason.trim();
  if (reason.length < 5) {
    res.status(400).json({ error: "Enter an audit reason of at least five characters." });
    return;
  }
  const rate = await db.transaction(async (tx) => {
    const now = new Date();
    const [savedRate] = await tx
      .insert(bankExchangeRatesTable)
      .values({
        sourceCurrency: parsed.data.sourceCurrency,
        destinationCurrency: parsed.data.destinationCurrency,
        rate: parsed.data.rate,
        updatedByUserId: actor.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: [
          bankExchangeRatesTable.sourceCurrency,
          bankExchangeRatesTable.destinationCurrency,
        ],
        set: {
          rate: parsed.data.rate,
          updatedByUserId: actor.id,
          updatedAt: now,
        },
      })
      .returning();
    await tx.insert(bankAuditLogsTable).values({
      actorUserId: actor.id,
      targetUserId: actor.id,
      action: "update_exchange_rate",
      reason: `${parsed.data.sourceCurrency} to ${parsed.data.destinationCurrency} rate set to ${parsed.data.rate}. ${reason}`,
    });
    return savedRate;
  });
  res.json(
    UpsertBankExchangeRateResponse.parse({
      sourceCurrency: rate.sourceCurrency,
      destinationCurrency: rate.destinationCurrency,
      rate: rate.rate,
      updatedAt: rate.updatedAt.toISOString(),
    }),
  );
});

router.get("/bank/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const now = new Date();
  const hasActiveRestriction = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  const hasActiveSuspension = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.restriction_type = 'suspend_user'
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  const [
    userCount,
    activeAccountCount,
    restrictedAccountCount,
    suspendedAccountCount,
    pendingCount,
    transactionCount,
    ledgerTotals,
    recentActions,
  ] = await Promise.all([
    db.select({ value: count() }).from(bankUsersTable),
    db
      .select({ value: count() })
      .from(bankUsersTable)
      .where(and(eq(bankUsersTable.accountStatus, "active"), sql`not (${hasActiveRestriction})`)),
    db
      .select({ value: count() })
      .from(bankUsersTable)
      .where(
        and(
          or(eq(bankUsersTable.accountStatus, "restricted"), hasActiveRestriction),
          sql`not (${hasActiveSuspension})`,
        ),
      ),
    db
      .select({ value: count() })
      .from(bankUsersTable)
      .where(or(eq(bankUsersTable.accountStatus, "suspended"), hasActiveSuspension)),
    db
      .select({ value: count() })
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.status, "pending")),
    db.select({ value: count() }).from(bankTransactionsTable),
    db
      .select({
        currency: bankLedgerEntriesTable.currency,
        side: bankLedgerEntriesTable.side,
        amount: sql<string>`coalesce(sum(${bankLedgerEntriesTable.amountMinor}), 0)::text`,
      })
      .from(bankLedgerEntriesTable)
      .groupBy(bankLedgerEntriesTable.currency, bankLedgerEntriesTable.side),
    db
      .select()
      .from(bankAuditLogsTable)
      .orderBy(desc(bankAuditLogsTable.createdAt))
      .limit(8),
  ]);
  const recentUserIds = [
    ...new Set(recentActions.flatMap((row) => [row.actorUserId, row.targetUserId])),
  ];
  const recentUsers = recentUserIds.length
    ? await db
        .select({
          id: bankUsersTable.id,
          email: bankUsersTable.email,
          firstName: bankUsersTable.firstName,
          lastName: bankUsersTable.lastName,
        })
        .from(bankUsersTable)
        .where(inArray(bankUsersTable.id, recentUserIds))
    : [];
  const userById = new Map(recentUsers.map((user) => [user.id, user]));
  const currencies = ["USD", "EUR", "GBP", "CAD", "AUD"] as const;
  const amountFor = (currency: (typeof currencies)[number], side: string) =>
    ledgerTotals.find((row) => row.currency === currency && row.side === side)
      ?.amount ?? "0";
  const currencyTotals = (side: "credit" | "debit") =>
    currencies.map((currency) => ({
      currency,
      amount: formatMinorAmount(BigInt(amountFor(currency, side))),
    }));
  res.json(
    GetAdminSummaryResponse.parse({
      registeredUsers: userCount[0]?.value ?? 0,
      activeAccounts: activeAccountCount[0]?.value ?? 0,
      restrictedAccounts: restrictedAccountCount[0]?.value ?? 0,
      suspendedAccounts: suspendedAccountCount[0]?.value ?? 0,
      pendingOperations: pendingCount[0]?.value ?? 0,
      ledgerTransactions: transactionCount[0]?.value ?? 0,
      creditsByCurrency: currencyTotals("credit"),
      debitsByCurrency: currencyTotals("debit"),
      recentActions: recentActions.map((row) => {
        const actor = userById.get(row.actorUserId);
        const target = userById.get(row.targetUserId);
        return {
          id: row.id,
          actorName:
            [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") ||
            actor?.email ||
            "Unknown administrator",
          actorEmail: actor?.email ?? "unknown@invalid.local",
          targetName:
            [target?.firstName, target?.lastName].filter(Boolean).join(" ") ||
            target?.email ||
            "Unknown member",
          targetEmail: target?.email ?? "unknown@invalid.local",
          action: row.action,
          reason: row.reason,
          createdAt: row.createdAt.toISOString(),
        };
      }),
    }),
  );
});

router.get("/bank/admin/accounts", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminAccountsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 25;
  const filters = [];
  filters.push(sql`(
    ${bankWalletsTable.currency} <> 'NGN'
    OR coalesce((
      select sum(case when ${bankLedgerEntriesTable.side} = 'credit'
        then ${bankLedgerEntriesTable.amountMinor}
        else -${bankLedgerEntriesTable.amountMinor} end)
      from ${bankLedgerEntriesTable}
      where ${bankLedgerEntriesTable.walletId} = ${bankWalletsTable.id}
    ), 0) <> 0
  )`);
  const search = parsed.data.search?.trim();
  if (search) {
    const needle = `%${search}%`;
    filters.push(
      or(
        sql`${bankWalletsTable.id}::text ilike ${needle}`,
        ilike(bankUsersTable.customerId, needle),
        ilike(bankUsersTable.email, needle),
        ilike(bankUsersTable.firstName, needle),
        ilike(bankUsersTable.lastName, needle),
      ),
    );
  }
  if (parsed.data.currency) {
    filters.push(eq(bankWalletsTable.currency, parsed.data.currency));
  }
  const now = new Date();
  const hasEffectiveFreeze = sql`exists (
    select 1 from bank_restrictions br
    where br.wallet_id = ${bankWalletsTable.id}
      and br.user_id = ${bankUsersTable.id}
      and br.restriction_type = 'freeze_wallet'
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  if (parsed.data.status) {
    filters.push(
      parsed.data.status === "restricted"
        ? or(eq(bankWalletsTable.status, "restricted"), hasEffectiveFreeze)
        : and(
            eq(bankWalletsTable.status, "active"),
            sql`not (${hasEffectiveFreeze})`,
          ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const [totalRows] = await db
    .select({ value: count() })
    .from(bankWalletsTable)
    .innerJoin(bankUsersTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .where(where);
  const rows = await db
    .select({
      id: bankWalletsTable.id,
      userId: bankUsersTable.id,
      customerId: bankUsersTable.customerId,
      email: bankUsersTable.email,
      firstName: bankUsersTable.firstName,
      lastName: bankUsersTable.lastName,
      currency: bankWalletsTable.currency,
      status: bankWalletsTable.status,
      restrictionReason: bankWalletsTable.restrictionReason,
      restrictionNotes: bankWalletsTable.restrictionNotes,
      restrictedAt: bankWalletsTable.restrictedAt,
      createdAt: bankWalletsTable.createdAt,
      balance: sql<string>`coalesce(sum(case when ${bankLedgerEntriesTable.side} = 'credit' then ${bankLedgerEntriesTable.amountMinor} else -${bankLedgerEntriesTable.amountMinor} end), 0)::text`,
    })
    .from(bankWalletsTable)
    .innerJoin(bankUsersTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .leftJoin(
      bankLedgerEntriesTable,
      eq(bankLedgerEntriesTable.walletId, bankWalletsTable.id),
    )
    .where(where)
    .groupBy(
      bankWalletsTable.id,
      bankUsersTable.id,
      bankUsersTable.customerId,
      bankUsersTable.email,
      bankUsersTable.firstName,
      bankUsersTable.lastName,
      bankWalletsTable.currency,
      bankWalletsTable.status,
      bankWalletsTable.restrictionReason,
      bankWalletsTable.restrictionNotes,
      bankWalletsTable.restrictedAt,
      bankWalletsTable.createdAt,
    )
    .orderBy(desc(bankWalletsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const rowWalletIds = rows.map((row) => row.id);
  const activeFreezeRows = rowWalletIds.length
    ? await db
        .select()
        .from(bankRestrictionsTable)
        .where(
          and(
            inArray(bankRestrictionsTable.walletId, rowWalletIds),
            eq(bankRestrictionsTable.type, "freeze_wallet"),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        )
    : [];
  const activeFreezeByWallet = new Map(
    activeFreezeRows
      .filter((restriction) => restriction.walletId)
      .map((restriction) => [restriction.walletId!, restriction]),
  );
  res.json(
    ListAdminAccountsResponse.parse({
      items: rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        customerId: row.customerId,
        memberName:
          [row.firstName, row.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        email: row.email,
        currency: row.currency,
        balance: formatMinorAmount(BigInt(row.balance)),
        status:
          row.status === "restricted" || activeFreezeByWallet.has(row.id)
            ? "restricted"
            : "active",
        restrictionReason:
          row.restrictionReason ??
          activeFreezeByWallet.get(row.id)?.reason ??
          null,
        restrictionNotes:
          row.restrictionNotes ??
          activeFreezeByWallet.get(row.id)?.internalNotes ??
          null,
        restrictedAt:
          row.restrictedAt?.toISOString() ??
          activeFreezeByWallet.get(row.id)?.effectiveAt.toISOString() ??
          null,
        createdAt: row.createdAt.toISOString(),
      })),
      total: Number(totalRows?.value ?? 0),
      page,
      pageSize,
    }),
  );
});

router.patch(
  "/bank/admin/wallets/:walletId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminWalletStatusParams.safeParse(req.params);
    const parsed = UpdateAdminWalletStatusBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter a reason of at least five characters." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [observedWallet] = await tx
        .select({ userId: bankWalletsTable.userId })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, params.data.walletId))
        .limit(1);
      if (!observedWallet) return null;
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, observedWallet.userId))
        .for("update");
      if (!user) return null;
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, params.data.walletId))
        .for("update");
      if (!wallet) return null;
      const restricted = parsed.data.status === "restricted";
      const now = new Date();
      let activeFreeze: typeof bankRestrictionsTable.$inferSelect | undefined;
      if (restricted) {
        [activeFreeze] = await tx
          .insert(bankRestrictionsTable)
          .values({
            userId: user.id,
            walletId: wallet.id,
            type: "freeze_wallet",
            reason,
            effectiveAt: now,
            createdByUserId: actorUserId,
            internalNotes: parsed.data.notes?.trim() || null,
          })
          .returning();
      } else {
        const [freezeToRemove] = await tx
          .select()
          .from(bankRestrictionsTable)
          .where(
            and(
              eq(bankRestrictionsTable.userId, user.id),
              eq(bankRestrictionsTable.walletId, wallet.id),
              eq(bankRestrictionsTable.type, "freeze_wallet"),
              eq(bankRestrictionsTable.status, "active"),
              lte(bankRestrictionsTable.effectiveAt, now),
              or(
                isNull(bankRestrictionsTable.expiresAt),
                gt(bankRestrictionsTable.expiresAt, now),
              ),
            ),
          )
          .orderBy(desc(bankRestrictionsTable.createdAt))
          .limit(1)
          .for("update");
        if (freezeToRemove) {
          await tx
            .update(bankRestrictionsTable)
            .set({
              status: "removed",
              removedAt: now,
              removedByUserId: actorUserId,
              removalReason: reason,
            })
            .where(eq(bankRestrictionsTable.id, freezeToRemove.id));
        }
      }
      const [remainingFreeze] = restricted
        ? [activeFreeze]
        : await tx
            .select()
            .from(bankRestrictionsTable)
            .where(
              and(
                eq(bankRestrictionsTable.userId, user.id),
                eq(bankRestrictionsTable.walletId, wallet.id),
                eq(bankRestrictionsTable.type, "freeze_wallet"),
                eq(bankRestrictionsTable.status, "active"),
                lte(bankRestrictionsTable.effectiveAt, now),
                or(
                  isNull(bankRestrictionsTable.expiresAt),
                  gt(bankRestrictionsTable.expiresAt, now),
                ),
              ),
            )
            .orderBy(desc(bankRestrictionsTable.createdAt))
            .limit(1);
      const remainsFrozen = Boolean(remainingFreeze);
      const [updated] = await tx
        .update(bankWalletsTable)
        .set({
          status: remainsFrozen ? "restricted" : "active",
          restrictionReason: remainsFrozen ? remainingFreeze?.reason ?? reason : null,
          restrictionNotes: remainsFrozen
            ? remainingFreeze?.internalNotes ?? parsed.data.notes?.trim() ?? null
            : null,
          restrictedByUserId: remainsFrozen
            ? remainingFreeze?.createdByUserId ?? actorUserId
            : null,
          restrictedAt: remainsFrozen ? remainingFreeze?.effectiveAt ?? now : null,
          updatedAt: now,
        })
        .where(eq(bankWalletsTable.id, wallet.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action: restricted ? "freeze_wallet" : "unfreeze_wallet",
        reason: `${wallet.currency} wallet ${wallet.id}: ${reason}${parsed.data.notes?.trim() ? ` Notes: ${parsed.data.notes.trim()}` : ""}${!restricted && remainsFrozen ? " Other active freeze restrictions remain in effect." : ""}`,
      });
      const balance = await balanceForWallet(tx, wallet.id);
      return { wallet: updated, user, balance };
    });
    if (!result) {
      res.status(404).json({ error: "Wallet account not found." });
      return;
    }
    res.json(
      UpdateAdminWalletStatusResponse.parse({
        id: result.wallet.id,
        userId: result.user.id,
        customerId: result.user.customerId,
        memberName:
          [result.user.firstName, result.user.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        email: result.user.email,
        currency: result.wallet.currency,
        balance: formatMinorAmount(result.balance),
        status: result.wallet.status,
        restrictionReason: result.wallet.restrictionReason,
        restrictionNotes: result.wallet.restrictionNotes,
        restrictedAt: result.wallet.restrictedAt?.toISOString() ?? null,
        createdAt: result.wallet.createdAt.toISOString(),
      }),
    );
  },
);

router.get("/bank/admin/audit-logs", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminAuditLogsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.pageSize ?? 25;
  const filters = [];
  if (parsed.data.action) {
    filters.push(ilike(bankAuditLogsTable.action, `%${parsed.data.action.trim()}%`));
  }
  const search = parsed.data.search?.trim();
  if (search) {
    const needle = `%${search}%`;
    filters.push(
      or(
        ilike(bankAuditLogsTable.action, needle),
        ilike(bankAuditLogsTable.reason, needle),
        sql`${bankAuditLogsTable.actorUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle})`,
        sql`${bankAuditLogsTable.targetUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle})`,
      ),
    );
  }
  const where = filters.length ? and(...filters) : undefined;
  const [totalRows] = await db
    .select({ value: count() })
    .from(bankAuditLogsTable)
    .where(where);
  const logs = await db
    .select()
    .from(bankAuditLogsTable)
    .where(where)
    .orderBy(desc(bankAuditLogsTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const userIds = [
    ...new Set(logs.flatMap((log) => [log.actorUserId, log.targetUserId])),
  ];
  const users = userIds.length
    ? await db
        .select({
          id: bankUsersTable.id,
          email: bankUsersTable.email,
          firstName: bankUsersTable.firstName,
          lastName: bankUsersTable.lastName,
        })
        .from(bankUsersTable)
        .where(inArray(bankUsersTable.id, userIds))
    : [];
  const userById = new Map(users.map((user) => [user.id, user]));
  res.json(
    ListAdminAuditLogsResponse.parse({
      items: logs.map((log) => {
        const actor = userById.get(log.actorUserId);
        const target = userById.get(log.targetUserId);
        return {
          id: log.id,
          actorName:
            [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") ||
            actor?.email ||
            "Unknown administrator",
          actorEmail: actor?.email ?? "unknown@invalid.local",
          targetName:
            [target?.firstName, target?.lastName].filter(Boolean).join(" ") ||
            target?.email ||
            "Unknown member",
          targetEmail: target?.email ?? "unknown@invalid.local",
          action: log.action,
          reason: log.reason,
          createdAt: log.createdAt.toISOString(),
        };
      }),
      total: Number(totalRows?.value ?? 0),
      page,
      pageSize,
    }),
  );
});

router.get("/bank/admin/settings", requireAdmin, async (_req, res): Promise<void> => {
  const settings = await getOrCreateAdminSettings();
  res.json(
    GetAdminSettingsResponse.parse({
      fundingLimit: settings.fundingLimit,
      secondApprovalThreshold: settings.secondApprovalThreshold,
      frozenIncomingPolicy: "allow_frozen",
      unverifiedDashboardMessage: settings.unverifiedDashboardMessage,
      updatedAt: settings.updatedAt.toISOString(),
    }),
  );
});

router.put("/bank/admin/settings", requireAdmin, async (req, res): Promise<void> => {
  const parsed = UpdateAdminSettingsBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const clerkUserId = getAuth(req).userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const actorUserId = (await ensureBankUser(clerkUserId)).id;
  const pinResult = await verifyTransactionPin(actorUserId, parsed.data.transactionPin);
  if (pinResult !== "valid") {
    respondWithTransactionPinError(res, pinResult);
    return;
  }
  let fundingLimitMinor: bigint;
  let approvalThresholdMinor: bigint;
  try {
    fundingLimitMinor = parseAmountToMinor(parsed.data.fundingLimit);
    approvalThresholdMinor = parseAmountToMinor(parsed.data.secondApprovalThreshold);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter valid funding settings.",
    });
    return;
  }
  const hardCeilingMinor = 10_000_000_000n;
  if (
    fundingLimitMinor <= 0n ||
    fundingLimitMinor > hardCeilingMinor ||
    approvalThresholdMinor < 0n ||
    approvalThresholdMinor > fundingLimitMinor
  ) {
    res.status(400).json({
      error: "The maximum must be positive and no more than 100,000,000; the approval threshold must not exceed it.",
    });
    return;
  }
  const reason = parsed.data.reason.trim();
  if (reason.length < 5) {
    res.status(400).json({ error: "Enter an audit reason of at least five characters." });
    return;
  }
  const unverifiedDashboardMessage =
    parsed.data.unverifiedDashboardMessage.trim();
  if (!unverifiedDashboardMessage) {
    res.status(400).json({ error: "Enter a default message for unverified members." });
    return;
  }
  const [settings] = await db
    .insert(bankAdminSettingsTable)
    .values({
      id: "operations",
      fundingLimit: formatMinorAmount(fundingLimitMinor),
      secondApprovalThreshold: formatMinorAmount(approvalThresholdMinor),
      unverifiedDashboardMessage,
      updatedByUserId: actorUserId,
    })
    .onConflictDoUpdate({
      target: bankAdminSettingsTable.id,
      set: {
        fundingLimit: formatMinorAmount(fundingLimitMinor),
        secondApprovalThreshold: formatMinorAmount(approvalThresholdMinor),
        unverifiedDashboardMessage,
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      },
    })
    .returning();
  await db.insert(bankAuditLogsTable).values({
    actorUserId,
    targetUserId: actorUserId,
    action: "update_admin_settings",
    reason: `Funding cap ${settings.fundingLimit}; second approval threshold ${settings.secondApprovalThreshold}; unverified dashboard notice updated. ${reason}`,
  });
  res.json(
    UpdateAdminSettingsResponse.parse({
      fundingLimit: settings.fundingLimit,
      secondApprovalThreshold: settings.secondApprovalThreshold,
      frozenIncomingPolicy: "allow_frozen",
      unverifiedDashboardMessage: settings.unverifiedDashboardMessage,
      updatedAt: settings.updatedAt.toISOString(),
    }),
  );
});

router.get(
  "/bank/admin/restrictions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminRestrictionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const now = new Date();
    const filters = [];
    if (parsed.data.type) {
      filters.push(eq(bankRestrictionsTable.type, parsed.data.type));
    }
    if (parsed.data.search?.trim()) {
      const needle = `%${parsed.data.search.trim()}%`;
      filters.push(
        or(
          ilike(bankRestrictionsTable.reason, needle),
          ilike(bankRestrictionsTable.internalNotes, needle),
          sql`${bankRestrictionsTable.walletId}::text ilike ${needle}`,
          sql`${bankRestrictionsTable.userId} in (
            select id from bank_users
            where email ilike ${needle}
              or customer_id ilike ${needle}
              or first_name ilike ${needle}
              or last_name ilike ${needle}
          )`,
        ),
      );
    }
    if (parsed.data.status === "removed") {
      filters.push(eq(bankRestrictionsTable.status, "removed"));
    } else if (parsed.data.status === "scheduled") {
      filters.push(eq(bankRestrictionsTable.status, "active"));
      filters.push(gt(bankRestrictionsTable.effectiveAt, now));
    } else if (parsed.data.status === "expired") {
      filters.push(eq(bankRestrictionsTable.status, "active"));
      filters.push(lte(bankRestrictionsTable.expiresAt, now));
    } else if (parsed.data.status === "active") {
      filters.push(eq(bankRestrictionsTable.status, "active"));
      filters.push(lte(bankRestrictionsTable.effectiveAt, now));
      filters.push(
        or(
          isNull(bankRestrictionsTable.expiresAt),
          gt(bankRestrictionsTable.expiresAt, now),
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [total] = await db
      .select({ value: count() })
      .from(bankRestrictionsTable)
      .where(where);
    const restrictions = await db
      .select()
      .from(bankRestrictionsTable)
      .where(where)
      .orderBy(desc(bankRestrictionsTable.createdAt))
      .limit(parsed.data.pageSize)
      .offset((parsed.data.page - 1) * parsed.data.pageSize);
    const relatedUserIds = [
      ...new Set(
        restrictions.flatMap((restriction) =>
          [
            restriction.userId,
            restriction.createdByUserId,
            restriction.removedByUserId,
          ].filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const relatedUsers = relatedUserIds.length
      ? await db
          .select()
          .from(bankUsersTable)
          .where(inArray(bankUsersTable.id, relatedUserIds))
      : [];
    const usersById = new Map(relatedUsers.map((user) => [user.id, user]));
    const walletIds = [
      ...new Set(
        restrictions
          .map((restriction) => restriction.walletId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];
    const wallets = walletIds.length
      ? await db
          .select()
          .from(bankWalletsTable)
          .where(inArray(bankWalletsTable.id, walletIds))
      : [];
    const walletsById = new Map(wallets.map((wallet) => [wallet.id, wallet]));
    const items = restrictions.map((restriction) => {
      const customer = usersById.get(restriction.userId);
      if (!customer) {
        throw new Error("A restriction references a missing customer record.");
      }
      return adminRestrictionResponse({
        restriction,
        customer,
        wallet: restriction.walletId
          ? walletsById.get(restriction.walletId)
          : undefined,
        createdBy: usersById.get(restriction.createdByUserId),
        removedBy: restriction.removedByUserId
          ? usersById.get(restriction.removedByUserId)
          : undefined,
      });
    });
    res.json(
      ListAdminRestrictionsResponse.parse({
        items,
        total: Number(total?.value ?? 0),
        page: parsed.data.page,
        pageSize: parsed.data.pageSize,
      }),
    );
  },
);

router.post(
  "/bank/admin/restrictions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = CreateAdminRestrictionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const effectiveAt = parsed.data.effectiveAt;
    const expiresAt = parsed.data.expiresAt ?? null;
    if (expiresAt && expiresAt <= effectiveAt) {
      res.status(400).json({ error: "Expiry must be later than the effective date." });
      return;
    }
    if (parsed.data.type === "freeze_wallet" && !parsed.data.walletId) {
      res.status(400).json({ error: "Select a wallet to freeze." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [customer] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, parsed.data.userId))
        .for("update");
      if (!customer) return { notFound: true as const };
      const wallet = parsed.data.walletId
        ? (
            await tx
              .select()
              .from(bankWalletsTable)
              .where(
                and(
                  eq(bankWalletsTable.id, parsed.data.walletId),
                  eq(bankWalletsTable.userId, customer.id),
                ),
              )
              .for("update")
          )[0]
        : undefined;
      if (parsed.data.walletId && !wallet) {
        return { error: "The selected wallet does not belong to this customer." };
      }
      const [restriction] = await tx
        .insert(bankRestrictionsTable)
        .values({
          userId: customer.id,
          walletId: wallet?.id ?? null,
          type: parsed.data.type,
          reason: parsed.data.reason.trim(),
          effectiveAt,
          expiresAt,
          internalNotes: parsed.data.internalNotes?.trim() || null,
          createdByUserId: actorUserId,
        })
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: customer.id,
        action: "create_account_restriction",
        reason: `${parsed.data.type} restriction ${restriction.id} effective ${effectiveAt.toISOString()}${expiresAt ? ` until ${expiresAt.toISOString()}` : ""}. ${parsed.data.reason.trim()}`,
      });
      const [actor] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, actorUserId));
      return { restriction, customer, wallet, actor };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Customer account not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(
      CreateAdminRestrictionResponse.parse(
        adminRestrictionResponse({
          restriction: result.restriction,
          customer: result.customer,
          wallet: result.wallet,
          createdBy: result.actor,
        }),
      ),
    );
  },
);

router.post(
  "/bank/admin/restrictions/:restrictionId/remove",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = RemoveAdminRestrictionParams.safeParse(req.params);
    const parsed = RemoveAdminRestrictionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [observed] = await tx
        .select()
        .from(bankRestrictionsTable)
        .where(eq(bankRestrictionsTable.id, params.data.restrictionId))
        .limit(1);
      if (!observed) return { notFound: true as const };
      await tx
        .select({ id: bankUsersTable.id })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, observed.userId))
        .for("update");
      const [restriction] = await tx
        .select()
        .from(bankRestrictionsTable)
        .where(eq(bankRestrictionsTable.id, observed.id))
        .for("update");
      if (!restriction) return { notFound: true as const };
      if (restriction.status === "removed") {
        return { error: "This restriction has already been removed." };
      }
      const [customer] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, restriction.userId));
      if (!customer) return { notFound: true as const };
      const [updated] = await tx
        .update(bankRestrictionsTable)
        .set({
          status: "removed",
          removedAt: new Date(),
          removedByUserId: actorUserId,
          removalReason: parsed.data.reason.trim(),
        })
        .where(eq(bankRestrictionsTable.id, restriction.id))
        .returning();
      let wallet: typeof bankWalletsTable.$inferSelect | undefined;
      if (restriction.walletId) {
        const [savedWallet] = await tx
          .select()
          .from(bankWalletsTable)
          .where(eq(bankWalletsTable.id, restriction.walletId))
          .for("update");
        wallet = savedWallet;
        if (
          savedWallet?.status === "restricted" &&
          savedWallet.restrictionReason === restriction.reason &&
          savedWallet.restrictedByUserId === restriction.createdByUserId
        ) {
          const [remainingFreeze] = await tx
            .select({ id: bankRestrictionsTable.id })
            .from(bankRestrictionsTable)
            .where(
              and(
                eq(bankRestrictionsTable.userId, restriction.userId),
                eq(bankRestrictionsTable.walletId, restriction.walletId),
                eq(bankRestrictionsTable.type, "freeze_wallet"),
                eq(bankRestrictionsTable.status, "active"),
                lte(bankRestrictionsTable.effectiveAt, new Date()),
                or(
                  isNull(bankRestrictionsTable.expiresAt),
                  gt(bankRestrictionsTable.expiresAt, new Date()),
                ),
              ),
            )
            .limit(1);
          if (!remainingFreeze) {
            const [clearedWallet] = await tx
              .update(bankWalletsTable)
              .set({
                status: "active",
                restrictionReason: null,
                restrictionNotes: null,
                restrictedByUserId: null,
                restrictedAt: null,
                updatedAt: new Date(),
              })
              .where(eq(bankWalletsTable.id, savedWallet.id))
              .returning();
            wallet = clearedWallet;
          }
        }
      }
      const [creator] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, restriction.createdByUserId));
      const [actor] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, actorUserId));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: customer.id,
        action: "remove_account_restriction",
        reason: `Restriction ${restriction.id} (${restriction.type}) removed. ${parsed.data.reason.trim()}`,
      });
      return { restriction: updated, customer, wallet, creator, actor };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Restriction record not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      RemoveAdminRestrictionResponse.parse(
        adminRestrictionResponse({
          restriction: result.restriction,
          customer: result.customer,
          wallet: result.wallet,
          createdBy: result.creator,
          removedBy: result.actor,
        }),
      ),
    );
  },
);

router.get("/bank/admin/users", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminUsersQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const search = parsed.data.search?.trim();
  const filters = [];
  if (search) {
    const needle = `%${search}%`;
    filters.push(
      or(
        ilike(bankUsersTable.email, needle),
        ilike(bankUsersTable.id, needle),
        ilike(bankUsersTable.customerId, needle),
        ilike(bankUsersTable.firstName, needle),
        ilike(bankUsersTable.lastName, needle),
        sql`${bankUsersTable.id} in (select user_id from bank_wallets where id::text ilike ${needle})`,
      ),
    );
  }
  const now = new Date();
  const hasActiveRestriction = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  const hasActiveSuspension = sql`exists (
    select 1 from bank_restrictions br
    where br.user_id = ${bankUsersTable.id}
      and br.restriction_type = 'suspend_user'
      and br.status = 'active'
      and br.effective_at <= ${now}
      and (br.expires_at is null or br.expires_at > ${now})
  )`;
  if (parsed.data.accountStatus) {
    if (parsed.data.accountStatus === "active") {
      filters.push(
        and(eq(bankUsersTable.accountStatus, "active"), sql`not (${hasActiveRestriction})`),
      );
    } else if (parsed.data.accountStatus === "restricted") {
      filters.push(
        and(
          or(eq(bankUsersTable.accountStatus, "restricted"), hasActiveRestriction),
          sql`not (${hasActiveSuspension})`,
        ),
      );
    } else {
      filters.push(
        or(eq(bankUsersTable.accountStatus, "suspended"), hasActiveSuspension),
      );
    }
  }
  if (parsed.data.verificationStatus) {
    filters.push(
      eq(bankUsersTable.verificationStatus, parsed.data.verificationStatus),
    );
  }
  if (parsed.data.vaultSubscriptionStatus === "expired") {
    filters.push(
      and(
        eq(bankUsersTable.vaultSubscriptionStatus, "active"),
        lte(bankUsersTable.vaultSubscriptionExpiresAt, now),
      ),
    );
  } else if (parsed.data.vaultSubscriptionStatus === "active") {
    filters.push(
      and(
        eq(bankUsersTable.vaultSubscriptionStatus, "active"),
        or(
          isNull(bankUsersTable.vaultSubscriptionExpiresAt),
          gt(bankUsersTable.vaultSubscriptionExpiresAt, now),
        ),
      ),
    );
  } else if (parsed.data.vaultSubscriptionStatus) {
    filters.push(
      eq(bankUsersTable.vaultSubscriptionStatus, parsed.data.vaultSubscriptionStatus),
    );
  }
  const page = parsed.data.page ?? 1;
  const pageSize = parsed.data.limit ?? 50;
  const [totalRows] = await db
    .select({ value: count() })
    .from(bankUsersTable)
    .where(filters.length ? and(...filters) : undefined);
  const rows = await db
    .select({
      id: bankUsersTable.id,
      email: bankUsersTable.email,
      customerId: bankUsersTable.customerId,
      firstName: bankUsersTable.firstName,
      lastName: bankUsersTable.lastName,
      country: bankUsersTable.country,
      verificationStatus: bankUsersTable.verificationStatus,
      verificationNote: bankUsersTable.verificationNote,
      accountStatus: bankUsersTable.accountStatus,
      accountRestrictionReason: bankUsersTable.accountRestrictionReason,
      accountRestrictionNotes: bankUsersTable.accountRestrictionNotes,
      accountRestrictedAt: bankUsersTable.accountRestrictedAt,
      createdAt: bankUsersTable.createdAt,
      walletCount: count(bankWalletsTable.id),
    })
    .from(bankUsersTable)
    .leftJoin(bankWalletsTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .where(filters.length ? and(...filters) : undefined)
    .groupBy(
      bankUsersTable.id,
      bankUsersTable.email,
      bankUsersTable.firstName,
      bankUsersTable.lastName,
      bankUsersTable.country,
      bankUsersTable.verificationStatus,
      bankUsersTable.verificationNote,
      bankUsersTable.accountStatus,
      bankUsersTable.accountRestrictionReason,
      bankUsersTable.accountRestrictionNotes,
      bankUsersTable.accountRestrictedAt,
      bankUsersTable.createdAt,
    )
    .orderBy(desc(bankUsersTable.createdAt))
    .limit(pageSize)
    .offset((page - 1) * pageSize);
  const pageUserIds = rows.map((row) => row.id);
  const activeRestrictions = pageUserIds.length
    ? await db
        .select()
        .from(bankRestrictionsTable)
        .where(
          and(
            inArray(bankRestrictionsTable.userId, pageUserIds),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        )
        .orderBy(desc(bankRestrictionsTable.createdAt))
    : [];
  const restrictionsByUser = new Map<string, typeof activeRestrictions>();
  for (const restriction of activeRestrictions) {
    const list = restrictionsByUser.get(restriction.userId) ?? [];
    list.push(restriction);
    restrictionsByUser.set(restriction.userId, list);
  }

  res.json(
    ListAdminUsersResponse.parse(
      {
        items: rows.map((row) => ({
          ...row,
          verificationStatus: row.verificationStatus as
            | "not_started"
            | "pending"
            | "approved"
            | "rejected"
            | "additional_information_required",
          accountStatus:
            row.accountStatus === "suspended" ||
            restrictionsByUser.get(row.id)?.some((item) => item.type === "suspend_user")
              ? "suspended"
              : row.accountStatus === "restricted" || (restrictionsByUser.get(row.id)?.length ?? 0) > 0
                ? "restricted"
                : "active",
          accountRestrictionReason:
            row.accountRestrictionReason ??
            restrictionsByUser.get(row.id)?.[0]?.reason ??
            null,
          accountRestrictionNotes:
            row.accountRestrictionNotes ??
            restrictionsByUser.get(row.id)?.[0]?.internalNotes ??
            null,
          accountRestrictedAt:
            row.accountRestrictedAt?.toISOString() ??
            restrictionsByUser.get(row.id)?.[0]?.effectiveAt.toISOString() ??
            null,
          createdAt: row.createdAt.toISOString(),
          walletCount: Number(row.walletCount),
        })),
        total: Number(totalRows?.value ?? 0),
        page,
        pageSize,
      },
    ),
  );
});

router.get(
  "/bank/admin/users/:userId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetAdminUserDetailParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [user] = await db
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, params.data.userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    const now = new Date();
    const [wallets, transactions, history, transactionCountRows, activeRestrictions] = await Promise.all([
      getWalletsForUser(user.id),
      listUserTransactions(user.id, { limit: 50 }),
      db
        .select()
        .from(bankAuditLogsTable)
        .where(eq(bankAuditLogsTable.targetUserId, user.id))
        .orderBy(desc(bankAuditLogsTable.createdAt))
        .limit(50),
      db
        .select({ value: count() })
        .from(bankTransactionsTable)
        .where(
          or(
            eq(bankTransactionsTable.fromUserId, user.id),
            eq(bankTransactionsTable.toUserId, user.id),
          ),
        ),
      db
        .select()
        .from(bankRestrictionsTable)
        .where(
          and(
            eq(bankRestrictionsTable.userId, user.id),
            eq(bankRestrictionsTable.status, "active"),
            lte(bankRestrictionsTable.effectiveAt, now),
            or(
              isNull(bankRestrictionsTable.expiresAt),
              gt(bankRestrictionsTable.expiresAt, now),
            ),
          ),
        )
        .orderBy(desc(bankRestrictionsTable.createdAt)),
    ]);
    const effectiveAccountStatus =
      user.accountStatus === "suspended" ||
      activeRestrictions.some((restriction) => restriction.type === "suspend_user")
        ? "suspended"
        : user.accountStatus === "restricted" || activeRestrictions.length > 0
          ? "restricted"
          : "active";
    const primaryRestriction = activeRestrictions[0];
    const actorIds = [...new Set(history.map((entry) => entry.actorUserId))];
    const actors = actorIds.length
      ? await db
          .select({
            id: bankUsersTable.id,
            email: bankUsersTable.email,
            firstName: bankUsersTable.firstName,
            lastName: bankUsersTable.lastName,
          })
          .from(bankUsersTable)
          .where(inArray(bankUsersTable.id, actorIds))
      : [];
    const actorById = new Map(actors.map((actor) => [actor.id, actor]));
    res.json(
      GetAdminUserDetailResponse.parse({
        user: {
          id: user.id,
          email: user.email,
          customerId: user.customerId,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          verificationStatus: user.verificationStatus,
          verificationNote: user.verificationNote,
          accountStatus: effectiveAccountStatus,
          accountRestrictionReason:
            user.accountRestrictionReason ?? primaryRestriction?.reason ?? null,
          accountRestrictionNotes:
            user.accountRestrictionNotes ?? primaryRestriction?.internalNotes ?? null,
          accountRestrictedAt:
            user.accountRestrictedAt?.toISOString() ??
            primaryRestriction?.effectiveAt.toISOString() ??
            null,
          vaultSubscriptionStatus: vaultSubscriptionStatus(
            user.vaultSubscriptionStatus,
            user.vaultSubscriptionExpiresAt,
          ),
          vaultSubscriptionRequestedAt:
            user.vaultSubscriptionRequestedAt?.toISOString() ?? null,
          vaultSubscriptionExpiresAt:
            user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
          vaultSubscriptionReason: user.vaultSubscriptionReason,
          walletCount: wallets.length,
          createdAt: user.createdAt.toISOString(),
        },
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        transactionPinConfigured: !!user.transactionPinHash,
        transactionCount: Number(transactionCountRows[0]?.value ?? 0),
        wallets,
        transactions,
        administrativeHistory: history.map((entry) => {
          const actor = actorById.get(entry.actorUserId);
          return {
            id: entry.id,
            actorName:
              [actor?.firstName, actor?.lastName].filter(Boolean).join(" ") ||
              actor?.email ||
              "Unknown administrator",
            actorEmail: actor?.email ?? "unknown@invalid.local",
            targetName:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email,
            targetEmail: user.email,
            action: entry.action,
            reason: entry.reason,
            createdAt: entry.createdAt.toISOString(),
          };
        }),
      }),
    );
  },
);

router.post(
  "/bank/admin/users/:userId/transaction-pin/reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ResetAdminUserTransactionPinParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ResetAdminUserTransactionPinBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter a reset reason of at least five characters." });
      return;
    }
    const reset = await db.transaction(async (tx) => {
      const [target] = await tx
        .update(bankUsersTable)
        .set({
          transactionPinHash: null,
          transactionPinFailedAttempts: 0,
          transactionPinLockedUntil: null,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, params.data.userId))
        .returning({ id: bankUsersTable.id });
      if (!target) return false;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: "reset_transaction_pin",
        reason,
      });
      return true;
    });
    if (!reset) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    res.json(ResetAdminUserTransactionPinResponse.parse({ configured: false }));
  },
);

router.post(
  "/bank/admin/users/:userId/password-reset",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ResetAdminUserPasswordParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ResetAdminUserPasswordBody.safeParse(req.body);
    if (!parsed.success || parsed.data.confirmed !== true) {
      res.status(400).json({
        error: parsed.success ? "Confirm the password reset action." : parsed.error.message,
      });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    if (authenticatedClerkId === params.data.userId) {
      res.status(400).json({
        error: "Use the customer password recovery flow to reset your own password.",
      });
      return;
    }

    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const [target] = await db
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, params.data.userId))
      .limit(1);
    if (!target) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const reason = parsed.data.reason.trim();
    const requestedAt = new Date().toISOString();
    await db.insert(bankAuditLogsTable).values({
      actorUserId,
      targetUserId: target.id,
      action: "request_password_reset",
      reason,
    });

    let primaryEmail: string | undefined;
    try {
      const identity = await clerkClient.users.getUser(target.id);
      const primaryEmailAddress = identity.emailAddresses.find(
        (email) => email.id === identity.primaryEmailAddressId,
      );
      if (primaryEmailAddress?.verification?.status === "verified") {
        primaryEmail = primaryEmailAddress.emailAddress;
      }
      await clerkClient.users.updateUserMetadata(target.id, {
        publicMetadata: {
          globusPasswordResetRequiredAt: requestedAt,
        },
      });
      setPasswordResetCache(target.id, true);

      const sessions = [];
      let offset = 0;
      while (true) {
        const page = await clerkClient.sessions.getSessionList({
          userId: target.id,
          status: "active",
          limit: 500,
          offset,
        });
        sessions.push(...page.data);
        if (page.data.length < 500) break;
        offset += page.data.length;
      }

      let sessionsRevoked = 0;
      let revokeFailures = 0;
      for (let index = 0; index < sessions.length; index += 25) {
        const batch = sessions.slice(index, index + 25);
        const results = await Promise.allSettled(
          batch.map((session) => clerkClient.sessions.revokeSession(session.id)),
        );
        sessionsRevoked += results.filter((result) => result.status === "fulfilled").length;
        revokeFailures += results.filter((result) => result.status === "rejected").length;
      }

      await db.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: revokeFailures === 0
          ? "password_reset_required_sessions_revoked"
          : "password_reset_required_session_revocation_incomplete",
        reason,
      });

      if (revokeFailures > 0) {
        res.status(503).json({
          error: "The reset requirement is active, but not all sessions could be ended. Retry the action.",
        });
        return;
      }

      let emailSent = false;
      let signInTokenId: string | undefined;
      try {
        if (primaryEmail) {
          const token = await clerkClient.signInTokens.createSignInToken({
            userId: target.id,
            expiresInSeconds: 15 * 60,
          });
          signInTokenId = token.id;
          emailSent = await sendPasswordResetEmail({
            recipient: primaryEmail,
            ticket: token.token,
          });
        }
      } catch {
        emailSent = false;
      }
      if (!emailSent && signInTokenId) {
        await clerkClient.signInTokens
          .revokeSignInToken(signInTokenId)
          .catch(() => undefined);
      }

      await db.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: emailSent
          ? "password_reset_email_sent"
          : "password_reset_email_failed",
        reason: "Delivery status only.",
      });

      res.json(
        ResetAdminUserPasswordResponse.parse({
          resetRequired: true,
          sessionsRevoked,
          requestedAt,
          emailSent,
        }),
      );
    } catch {
      res.status(503).json({
        error: "The reset requirement could not be fully applied. Retry the action.",
      });
    }
  },
);

router.patch(
  "/bank/admin/users/:userId/status",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateAdminUserStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    if (params.data.userId === actorUserId) {
      res.status(400).json({ error: "Administrators cannot change their own account status." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const now = new Date();
      const [user] = await tx
        .update(bankUsersTable)
        .set({
          accountStatus: parsed.data.accountStatus,
          accountRestrictionReason:
            parsed.data.accountStatus === "restricted"
              ? parsed.data.reason.trim()
              : null,
          accountRestrictionNotes:
            parsed.data.accountStatus === "restricted"
              ? parsed.data.notes?.trim() || null
              : null,
          accountRestrictedByUserId:
            parsed.data.accountStatus === "restricted" ? actorUserId : null,
          accountRestrictedAt:
            parsed.data.accountStatus === "restricted" ? now : null,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, params.data.userId))
        .returning();
      if (!user) {
        return null;
      }

      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action:
          parsed.data.accountStatus === "suspended"
            ? "suspend_user"
            : parsed.data.accountStatus === "restricted"
              ? "restrict_user"
              : "restore_user",
        reason: `${parsed.data.reason.trim()}${parsed.data.notes?.trim() ? ` Notes: ${parsed.data.notes.trim()}` : ""}`,
      });

      return user;
    });

    if (!result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }

    const [walletCount] = await db
      .select({ value: count() })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.userId, result.id));

    res.json(
      UpdateAdminUserStatusResponse.parse({
        id: result.id,
        email: result.email,
        customerId: result.customerId,
        firstName: result.firstName,
        lastName: result.lastName,
        country: result.country,
        verificationStatus: result.verificationStatus,
        verificationNote: result.verificationNote,
        accountStatus: result.accountStatus,
        accountRestrictionReason: result.accountRestrictionReason,
        accountRestrictionNotes: result.accountRestrictionNotes,
        accountRestrictedAt: result.accountRestrictedAt?.toISOString() ?? null,
        walletCount: walletCount?.value ?? 0,
        createdAt: result.createdAt.toISOString(),
      }),
    );
  },
);

router.patch(
  "/bank/admin/users/:userId/profile",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserProfileParams.safeParse(req.params);
    const parsed = UpdateAdminUserProfileBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = parsed.data.reason.trim();
    const profileFields = {
      ...(parsed.data.firstName !== undefined
        ? { firstName: parsed.data.firstName?.trim() || null }
        : {}),
      ...(parsed.data.lastName !== undefined
        ? { lastName: parsed.data.lastName?.trim() || null }
        : {}),
      ...(parsed.data.phone !== undefined
        ? { phone: parsed.data.phone?.trim() || null }
        : {}),
      ...(parsed.data.country !== undefined
        ? { country: parsed.data.country?.trim() || null }
        : {}),
    };
    if (Object.keys(profileFields).length === 0 || reason.length < 5) {
      res.status(400).json({
        error: "Change at least one permitted profile field and enter a reason.",
      });
      return;
    }
    const updated = await db.transaction(async (tx) => {
      const [user] = await tx
        .update(bankUsersTable)
        .set({ ...profileFields, updatedAt: new Date() })
        .where(eq(bankUsersTable.id, params.data.userId))
        .returning();
      if (!user) return null;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action: "update_member_profile",
        reason,
      });
      const [walletCount] = await tx
        .select({ value: count() })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.userId, user.id));
      return { user, walletCount: Number(walletCount?.value ?? 0) };
    });
    if (!updated) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    res.json(
      UpdateAdminUserProfileResponse.parse({
        id: updated.user.id,
        email: updated.user.email,
        customerId: updated.user.customerId,
        firstName: updated.user.firstName,
        lastName: updated.user.lastName,
        country: updated.user.country,
        verificationStatus: updated.user.verificationStatus,
        verificationNote: updated.user.verificationNote,
        accountStatus: updated.user.accountStatus,
        accountRestrictionReason: updated.user.accountRestrictionReason,
        accountRestrictionNotes: updated.user.accountRestrictionNotes,
        accountRestrictedAt:
          updated.user.accountRestrictedAt?.toISOString() ?? null,
        walletCount: updated.walletCount,
        createdAt: updated.user.createdAt.toISOString(),
      }),
    );
  },
);

router.patch(
  "/bank/admin/users/:userId/vault-subscription",
  requireAdmin,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in with an administrator account." });
      return;
    }
    const params = UpdateAdminUserVaultSubscriptionParams.safeParse(req.params);
    const parsed = UpdateAdminUserVaultSubscriptionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid subscription decision.",
      });
      return;
    }
    const expiresAt = parsed.data.status === "active"
      ? parsed.data.expiresAt ?? null
      : null;
    if (expiresAt && expiresAt <= new Date()) {
      res.status(400).json({ error: "The access expiration must be in the future." });
      return;
    }
    const admin = await ensureBankUser(authUserId);
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, params.data.userId))
        .for("update");
      if (!user) return { notFound: true as const };
      const now = new Date();
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          vaultSubscriptionStatus: parsed.data.status,
          vaultSubscriptionReviewedAt: now,
          vaultSubscriptionReviewedByUserId: admin.id,
          vaultSubscriptionReason: parsed.data.reason.trim(),
          vaultSubscriptionExpiresAt: expiresAt,
          updatedAt: now,
        })
        .where(eq(bankUsersTable.id, user.id))
        .returning();
      await tx
        .delete(bankVaultSessionsTable)
        .where(eq(bankVaultSessionsTable.userId, user.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: admin.id,
        targetUserId: user.id,
        action:
          parsed.data.status === "active"
            ? "approve_private_vault_subscription"
            : parsed.data.status === "rejected"
              ? "reject_private_vault_subscription"
              : "revoke_private_vault_subscription",
        reason: parsed.data.reason.trim(),
      });
      const notification = await storeNotification(tx, {
        userId: user.id,
        category: "security",
        title:
          parsed.data.status === "active"
            ? "Private Vault access approved"
            : parsed.data.status === "rejected"
              ? "Private Vault access request declined"
              : "Private Vault access updated",
        body:
          parsed.data.status === "active"
            ? "Private Vault access is active. Set up or unlock your separate passcode in Profile."
            : parsed.data.status === "rejected"
              ? "Your Private Vault access request was declined. Contact Globus support if you need help."
              : "Private Vault access was removed. Existing vault sessions have been closed.",
      });
      return { user: updated, notification };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    void sendPushToUser(result.user.id, result.notification);
    res.json(
      UpdateAdminUserVaultSubscriptionResponse.parse({
        userId: result.user.id,
        status: vaultSubscriptionStatus(
          result.user.vaultSubscriptionStatus,
          result.user.vaultSubscriptionExpiresAt,
        ),
        expiresAt: result.user.vaultSubscriptionExpiresAt?.toISOString() ?? null,
      }),
    );
  },
);

router.get(
  "/bank/admin/users/:userId/verification-documents",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListAdminIdentityDocumentsParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [user] = await db
      .select({
        id: bankUsersTable.id,
        verificationStatus: bankUsersTable.verificationStatus,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, params.data.userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if (
      user.verificationStatus !== "pending" &&
      user.verificationStatus !== "additional_information_required"
    ) {
      res.json(ListAdminIdentityDocumentsResponse.parse([]));
      return;
    }
    const documents = await db
      .select()
      .from(bankIdentityDocumentsTable)
      .where(
        and(
          eq(bankIdentityDocumentsTable.userId, user.id),
          eq(bankIdentityDocumentsTable.status, "uploaded"),
        ),
      )
      .orderBy(asc(bankIdentityDocumentsTable.createdAt));
    res.json(
      ListAdminIdentityDocumentsResponse.parse(
        documents.map((document) => ({
          id: document.id,
          contentType: document.contentType as
            | "application/pdf"
            | "image/jpeg"
            | "image/png",
          sizeBytes: document.sizeBytes,
          status: document.status as "uploading" | "uploaded",
          createdAt: document.createdAt.toISOString(),
          uploadedAt: document.uploadedAt?.toISOString() ?? null,
        })),
      ),
    );
  },
);

router.get(
  "/bank/admin/identity-documents/:documentId/content",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetAdminIdentityDocumentContentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [document] = await db
      .select({
        document: bankIdentityDocumentsTable,
        verificationStatus: bankUsersTable.verificationStatus,
      })
      .from(bankIdentityDocumentsTable)
      .innerJoin(
        bankUsersTable,
        eq(bankUsersTable.id, bankIdentityDocumentsTable.userId),
      )
      .where(
        and(
          eq(bankIdentityDocumentsTable.id, params.data.documentId),
          eq(bankIdentityDocumentsTable.status, "uploaded"),
        ),
      )
      .limit(1);
    if (
      !document ||
      (document.verificationStatus !== "pending" &&
        document.verificationStatus !== "additional_information_required")
    ) {
      res.status(404).json({ error: "Identity document not found." });
      return;
    }
    try {
      const file = getIdentityDocumentFile(document.document.objectPath);
      const [exists] = await file.exists();
      if (!exists) {
        res.status(404).json({ error: "Identity document not found." });
        return;
      }
      const extension =
        document.document.contentType === "application/pdf"
          ? "pdf"
          : document.document.contentType === "image/png"
            ? "png"
            : "jpg";
      res.setHeader("Content-Type", document.document.contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="identity-document-${document.document.id}.${extension}"`,
      );
      res.setHeader("Content-Length", String(document.document.sizeBytes));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      await pipeline(file.createReadStream(), res);
    } catch (error) {
      req.log.error({ err: error }, "Could not stream a private identity document");
      if (!res.headersSent) {
        res.status(503).json({ error: "The identity document is temporarily unavailable." });
      } else {
        res.destroy(error instanceof Error ? error : undefined);
      }
    }
  },
);

router.patch(
  "/bank/admin/users/:userId/verification",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminUserVerificationParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAdminUserVerificationBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    if (
      params.data.userId === actorUserId &&
      parsed.data.verificationStatus !== "approved"
    ) {
      res.status(400).json({
        error: "Administrators may approve their own identity, but cannot reject or request more information from themselves.",
      });
      return;
    }
    const reason = parsed.data.reason.trim();
    const userMessage = parsed.data.userMessage?.trim() ?? "";
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter an audit reason of at least five characters." });
      return;
    }
    if (
      parsed.data.verificationStatus === "additional_information_required" &&
      !userMessage
    ) {
      res.status(400).json({
        error: "Include a message telling the user what additional information is needed.",
      });
      return;
    }

    let result: Awaited<ReturnType<typeof runIdentityReview>>;
    try {
      result = await runIdentityReview({
        actorUserId,
        userId: params.data.userId,
        verificationStatus: parsed.data.verificationStatus,
        reason,
        userMessage: userMessage || null,
      });
    } catch (error) {
      req.log.error({ err: error }, "Could not complete identity verification decision");
      res.status(503).json({
        error: "Private document cleanup failed. No final verification decision was recorded; retry the review.",
      });
      return;
    }
    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      UpdateAdminUserVerificationResponse.parse({
        id: result.user.id,
        email: result.user.email,
        customerId: result.user.customerId,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        country: result.user.country,
        verificationStatus: result.user.verificationStatus,
        verificationNote: result.user.verificationNote,
        accountStatus: result.user.accountStatus,
        walletCount: result.walletCount,
        createdAt: result.user.createdAt.toISOString(),
      }),
    );
  },
);

router.post(
  "/bank/admin/users/:userId/funding",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = CreateAdminFundingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = CreateAdminFundingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }

    const reason = parsed.data.reason.trim();
    const senderName = parsed.data.senderName.trim();
    const description = parsed.data.description.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter a funding reason of at least five characters." });
      return;
    }
    if (!senderName || !description) {
      res.status(400).json({ error: "Enter a sender name and transaction description." });
      return;
    }

    let amountMinor: bigint;
    try {
      amountMinor = parseAmountToMinor(parsed.data.amount);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Enter a valid funding amount.",
      });
      return;
    }

    const settings = await getOrCreateAdminSettings();
    const fundingLimitMinor = parseAmountToMinor(settings.fundingLimit);
    const secondApprovalThresholdMinor = parseAmountToMinor(
      settings.secondApprovalThreshold,
    );
    if (amountMinor <= 0n || amountMinor > fundingLimitMinor) {
      res.status(400).json({
        error: `Funding must be greater than zero and no more than ${settings.fundingLimit}.`,
      });
      return;
    }
    const requiresSecondApproval = amountMinor >= secondApprovalThresholdMinor;

    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
      );

      const [duplicate] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
        .limit(1);
      if (duplicate) {
        const sameRequest =
          duplicate.initiatedByUserId === actorUserId &&
          (parsed.data.direction === "credit"
            ? duplicate.toUserId === params.data.userId &&
              duplicate.fromUserId === null
            : duplicate.fromUserId === params.data.userId &&
              duplicate.toUserId === null) &&
          duplicate.type === "admin_funding" &&
          duplicate.currency === parsed.data.currency &&
          duplicate.amountMinor === amountMinor &&
          duplicate.counterparty === senderName &&
          duplicate.description === description &&
          duplicate.adminReference === (parsed.data.internalReference?.trim() || null) &&
          duplicate.adminNotes === (parsed.data.adminNotes?.trim() || null);
        return sameRequest
          ? { transaction: duplicate }
          : { error: "That request reference is already in use." };
      }

      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, params.data.userId))
        .for("update");
      if (!target) {
        return { notFound: true as const };
      }
      if (target.accountStatus !== "active") {
        return { error: "Only active user accounts can receive balance adjustments." };
      }

      const wallet = await userWallet(tx, target.id, parsed.data.currency);
      if (
        !wallet ||
        (parsed.data.direction === "debit" && wallet.status !== "active")
      ) {
        return {
          error:
            parsed.data.direction === "debit"
              ? "A frozen wallet cannot be debited."
              : "A wallet for the selected currency is unavailable.",
        };
      }
      const restrictionError = await bankOperationRestrictionError(tx, {
        userId: target.id,
        walletId: wallet.id,
        operation:
          parsed.data.direction === "credit" ? "admin_credit" : "admin_debit",
      });
      if (restrictionError) return { error: restrictionError };
      await tx
        .select({ id: bankWalletsTable.id })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, wallet.id))
        .for("update");
      if (parsed.data.direction === "debit") {
        const balance = await balanceForWallet(tx, wallet.id);
        const reserved = await reservedForWallet(tx, wallet.id);
        if (balance - reserved < amountMinor) {
          return { error: "The adjustment exceeds the member's available ledger balance." };
        }
      }

      const [transaction] = await tx
        .insert(bankTransactionsTable)
        .values({
          reference: createReference(),
          idempotencyKey: parsed.data.idempotencyKey,
          initiatedByUserId: actorUserId,
          fromUserId: parsed.data.direction === "debit" ? target.id : null,
          toUserId: parsed.data.direction === "credit" ? target.id : null,
          fromWalletId: parsed.data.direction === "debit" ? wallet.id : null,
          toWalletId: parsed.data.direction === "credit" ? wallet.id : null,
          type: "admin_funding",
          status: requiresSecondApproval ? "pending" : "completed",
          currency: parsed.data.currency,
          amountMinor,
          feeMinor: 0n,
          counterparty: senderName,
          description,
          adminReference: parsed.data.internalReference?.trim() || null,
          adminNotes: parsed.data.adminNotes?.trim() || null,
          mode: "internal_ledger",
        })
        .returning();

      if (!requiresSecondApproval) {
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: transaction.id,
            accountCode: `internal:balance-adjustment:${parsed.data.currency}`,
            currency: parsed.data.currency,
            side: parsed.data.direction === "credit" ? "debit" : "credit",
            amountMinor,
          },
          {
            transactionId: transaction.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: parsed.data.currency,
            side: parsed.data.direction === "credit" ? "credit" : "debit",
            amountMinor,
          },
        ]);
      }

      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: requiresSecondApproval
          ? "request_admin_funding"
          : "adjust_user_balance",
        reason: `${requiresSecondApproval ? "Awaiting second-admin approval. " : ""}${parsed.data.direction} ${formatMinorAmount(amountMinor)} ${parsed.data.currency}: ${reason}`,
      });

      return { transaction };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }

    res.status(201).json(
      CreateAdminFundingResponse.parse(
        toBankTransaction(result.transaction, params.data.userId),
      ),
    );
  },
);

router.post(
  "/bank/admin/transactions/:transactionId/funding-review",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ReviewAdminFundingParams.safeParse(req.params);
    const parsed = ReviewAdminFundingBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter an audit reason of at least five characters." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      if (
        (transaction.type !== "admin_funding" &&
          transaction.type !== "admin_adjustment") ||
        transaction.status !== "pending"
      ) {
        return { error: "This adjustment is not awaiting a second-admin decision." };
      }
      if (transaction.initiatedByUserId === actorUserId) {
        return { error: "A different administrator must review this funding request." };
      }
      const walletId = transaction.fromWalletId ?? transaction.toWalletId;
      if (!walletId) {
        return { error: "The funding request does not reference a wallet." };
      }
      const targetUserId = transaction.fromUserId ?? transaction.toUserId;
      if (!targetUserId) {
        return { error: "The funding request is missing its target customer." };
      }
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, targetUserId))
        .for("update");
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, walletId))
        .for("update");
      if (!wallet || !target) {
        return { error: "The funding wallet or customer account is unavailable." };
      }
      const isDebit = Boolean(transaction.fromWalletId);
      if (target.accountStatus !== "active") {
        return { error: "Funding cannot be approved for a restricted or suspended account." };
      }
      if (parsed.data.decision === "approve") {
        const restrictionError = await bankOperationRestrictionError(tx, {
          userId: target.id,
          walletId: wallet.id,
          operation: isDebit ? "admin_debit" : "admin_credit",
        });
        if (restrictionError) return { error: restrictionError };
      }
      if (isDebit && wallet.status !== "active") {
        return { error: "A frozen wallet cannot be debited." };
      }
      if (parsed.data.decision === "approve" && isDebit) {
        const balance = await balanceForWallet(tx, wallet.id);
        const allReserved = await reservedForWallet(tx, wallet.id);
        const otherReserved = allReserved - transaction.amountMinor;
        if (otherReserved < 0n || balance - otherReserved < transaction.amountMinor) {
          return { error: "The reserved balance is no longer available for this adjustment." };
        }
      }
      if (parsed.data.decision === "approve") {
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: transaction.id,
            accountCode: `internal:balance-adjustment:${transaction.currency}`,
            currency: transaction.currency,
            side: isDebit ? "credit" : "debit",
            amountMinor: transaction.amountMinor,
          },
          {
            transactionId: transaction.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: transaction.currency,
            side: isDebit ? "debit" : "credit",
            amountMinor: transaction.amountMinor,
          },
        ]);
      }
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({
          status: parsed.data.decision === "approve" ? "completed" : "failed",
        })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId,
        action:
          transaction.type === "admin_adjustment"
            ? parsed.data.decision === "approve"
              ? "approve_admin_adjustment"
              : "reject_admin_adjustment"
            : parsed.data.decision === "approve"
              ? "approve_admin_funding"
              : "reject_admin_funding",
        reason: `Funding ${transaction.reference}: ${parsed.data.decision}. ${reason}`,
      });
      return { transaction: updated, targetUserId };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Funding request not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      ReviewAdminFundingResponse.parse(
        toBankTransaction(result.transaction, result.targetUserId),
      ),
    );
  },
);

router.get(
  "/bank/admin/ledger-requests",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminLedgerRequestsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const rows = await db
      .select({
        request: bankSandboxRequestsTable,
        transaction: bankTransactionsTable,
        user: bankUsersTable,
      })
      .from(bankSandboxRequestsTable)
      .innerJoin(
        bankTransactionsTable,
        eq(bankSandboxRequestsTable.transactionId, bankTransactionsTable.id),
      )
      .innerJoin(
        bankUsersTable,
        eq(bankSandboxRequestsTable.userId, bankUsersTable.id),
      )
      .where(
        and(
          inArray(bankSandboxRequestsTable.status, [
            "pending_review",
            "pending_provider_setup",
          ]),
          inArray(bankSandboxRequestsTable.type, ["deposit", "withdrawal"]),
          ...(parsed.data.userId
            ? [eq(bankSandboxRequestsTable.userId, parsed.data.userId)]
            : []),
        ),
      )
      .orderBy(desc(bankSandboxRequestsTable.createdAt))
      .limit(100);

    res.json(
      ListAdminLedgerRequestsResponse.parse(
        rows.map(({ request, transaction, user }) => ({
          id: request.id,
          transactionId: transaction.id,
          reference: request.reference,
          userId: user.id,
          memberName:
            [user.firstName, user.lastName].filter(Boolean).join(" ") ||
            "Globus member",
          email: user.email,
          type: request.type,
          currency: request.currency,
          amount: formatMinorAmount(request.amountMinor),
          description: transaction.description,
          ...(request.paymentMethod ? { paymentMethod: request.paymentMethod } : {}),
          ...(request.paymentMethodSummary
            ? { paymentMethodSummary: request.paymentMethodSummary }
            : {}),
          status:
            request.status === "pending_provider_setup"
              ? "pending_review"
              : request.status,
          createdAt: request.createdAt.toISOString(),
        })),
      ),
    );
  },
);

router.patch(
  "/bank/admin/ledger-requests/:requestId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ReviewAdminLedgerRequestParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = ReviewAdminLedgerRequestBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access operations." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter an audit reason of at least five characters." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [request] = await tx
        .select()
        .from(bankSandboxRequestsTable)
        .where(eq(bankSandboxRequestsTable.id, params.data.requestId))
        .for("update");
      if (!request) return { notFound: true as const };
      if (request.type !== "deposit" && request.type !== "withdrawal") {
        return { error: "Only deposit and withdrawal requests can be reviewed here." };
      }
      if (
        request.status !== "pending_review" &&
        request.status !== "pending_provider_setup"
      ) {
        return { error: "This request has already been reviewed." };
      }

      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, request.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, request.userId))
        .for("update");
      if (!target) return { notFound: true as const };
      if (parsed.data.decision === "approve" && target.accountStatus !== "active") {
        return { error: "Only active accounts can receive approved ledger requests." };
      }
      if (
        parsed.data.decision === "approve" &&
        target.verificationStatus !== "approved"
      ) {
        return {
          error:
            "Identity verification must be approved before this deposit or withdrawal can be completed.",
        };
      }

      const savedWallet =
        request.type === "deposit"
          ? transaction.toWalletId
          : transaction.fromWalletId;
      const wallet = savedWallet
        ? (
            await tx
              .select()
              .from(bankWalletsTable)
              .where(eq(bankWalletsTable.id, savedWallet))
              .limit(1)
          )[0]
        : await userWallet(tx, target.id, request.currency);
      if (
        !wallet ||
        (request.type === "withdrawal" && wallet.status !== "active")
      ) {
        return {
          error:
            request.type === "withdrawal"
              ? "A frozen wallet cannot be used for a withdrawal."
              : "A wallet for this request is unavailable.",
        };
      }
      if (parsed.data.decision === "approve") {
        const restrictionError = await bankOperationRestrictionError(tx, {
          userId: target.id,
          walletId: wallet.id,
          operation: request.type,
        });
        if (restrictionError) return { error: restrictionError };
      }
      await tx
        .select({ id: bankWalletsTable.id })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, wallet.id))
        .for("update");

      if (parsed.data.decision === "approve") {
        if (request.type === "withdrawal") {
          const balance = await balanceForWallet(tx, wallet.id);
          const reserved = await reservedForWallet(tx, wallet.id);
          if (balance < request.amountMinor || balance < reserved) {
            return {
              error:
                "The reserved ledger balance is no longer available. Resolve other balance changes before approving.",
            };
          }
        }

        await tx.insert(bankLedgerEntriesTable).values(
          request.type === "deposit"
            ? [
                {
                  transactionId: transaction.id,
                  accountCode: `internal:deposit:${request.currency}`,
                  currency: request.currency,
                  side: "debit",
                  amountMinor: request.amountMinor,
                },
                {
                  transactionId: transaction.id,
                  walletId: wallet.id,
                  accountCode: `wallet:${wallet.id}`,
                  currency: request.currency,
                  side: "credit",
                  amountMinor: request.amountMinor,
                },
              ]
            : [
                {
                  transactionId: transaction.id,
                  walletId: wallet.id,
                  accountCode: `wallet:${wallet.id}`,
                  currency: request.currency,
                  side: "debit",
                  amountMinor: request.amountMinor,
                },
                {
                  transactionId: transaction.id,
                  accountCode: `internal:withdrawal:${request.currency}`,
                  currency: request.currency,
                  side: "credit",
                  amountMinor: request.amountMinor,
                },
              ],
        );
      }

      const requestStatus =
        parsed.data.decision === "approve" ? "approved" : "rejected";
      const [updatedRequest] = await tx
        .update(bankSandboxRequestsTable)
        .set({ status: requestStatus })
        .where(eq(bankSandboxRequestsTable.id, request.id))
        .returning();
      const [updatedTransaction] = await tx
        .update(bankTransactionsTable)
        .set({
          status: parsed.data.decision === "approve" ? "completed" : "failed",
          fromWalletId:
            request.type === "withdrawal" ? wallet.id : transaction.fromWalletId,
          toWalletId:
            request.type === "deposit" ? wallet.id : transaction.toWalletId,
        })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action:
          parsed.data.decision === "approve"
            ? "approve_ledger_request"
            : "reject_ledger_request",
        reason: `${request.type} ${request.reference}: ${parsed.data.decision}. ${reason}`,
      });
      return {
        request: updatedRequest,
        transaction: updatedTransaction,
        user: target,
      };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Ledger request not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      ReviewAdminLedgerRequestResponse.parse({
        id: result.request.id,
        transactionId: result.transaction.id,
        reference: result.request.reference,
        userId: result.user.id,
        memberName:
          [result.user.firstName, result.user.lastName].filter(Boolean).join(" ") ||
          "Globus member",
        email: result.user.email,
        type: result.request.type,
        currency: result.request.currency,
        amount: formatMinorAmount(result.request.amountMinor),
        description: result.transaction.description,
        status: result.request.status,
        createdAt: result.request.createdAt.toISOString(),
      }),
    );
  },
);

router.get(
  "/bank/admin/transactions",
  requireAdmin,
  async (req, res): Promise<void> => {
    const parsed = ListAdminTransactionsQueryParams.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const page = parsed.data.page ?? 1;
    const pageSize = parsed.data.pageSize ?? 25;
    const filters = [];
    const search = parsed.data.search?.trim();
    const customer = parsed.data.customer?.trim();
    if (search) {
      const needle = `%${search}%`;
      filters.push(
        or(
          ilike(bankTransactionsTable.reference, needle),
          ilike(bankTransactionsTable.description, needle),
          ilike(bankTransactionsTable.counterparty, needle),
          sql`(${bankTransactionsTable.fromUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}) or ${bankTransactionsTable.toUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}))`,
        ),
      );
    }
    if (customer) {
      const needle = `%${customer}%`;
      filters.push(
        sql`(${bankTransactionsTable.fromUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}) or ${bankTransactionsTable.toUserId} in (select id from bank_users where email ilike ${needle} or customer_id ilike ${needle} or id ilike ${needle} or first_name ilike ${needle} or last_name ilike ${needle}))`,
      );
    }
    if (parsed.data.currency) {
      filters.push(eq(bankTransactionsTable.currency, parsed.data.currency));
    }
    if (parsed.data.status) {
      filters.push(eq(bankTransactionsTable.status, parsed.data.status));
    }
    const type = parsed.data.type;
    if (type === "transfer_in" || type === "transfer_out") {
      filters.push(eq(bankTransactionsTable.type, "transfer"));
      filters.push(
        type === "transfer_in"
          ? sql`${bankTransactionsTable.toUserId} is not null`
          : sql`${bankTransactionsTable.fromUserId} is not null`,
      );
    } else if (type === "admin_debit") {
      filters.push(eq(bankTransactionsTable.type, "admin_funding"));
      filters.push(sql`${bankTransactionsTable.fromUserId} is not null`);
    } else if (type === "admin_funding") {
      filters.push(eq(bankTransactionsTable.type, "admin_funding"));
      filters.push(sql`${bankTransactionsTable.toUserId} is not null`);
    } else if (type === "simulation_credit") {
      filters.push(
        or(
          eq(bankTransactionsTable.type, "simulation_credit"),
          eq(bankTransactionsTable.type, "sandbox_credit"),
        ),
      );
    } else if (type) {
      filters.push(eq(bankTransactionsTable.type, type));
    }
    if (parsed.data.fromDate) {
      filters.push(
        gte(
          bankTransactionsTable.createdAt,
          new Date(`${parsed.data.fromDate}T00:00:00.000Z`),
        ),
      );
    }
    if (parsed.data.toDate) {
      filters.push(
        lte(
          bankTransactionsTable.createdAt,
          new Date(`${parsed.data.toDate}T23:59:59.999Z`),
        ),
      );
    }
    if (parsed.data.minimumAmount) {
      filters.push(
        gte(
          bankTransactionsTable.amountMinor,
          parseAmountToMinor(parsed.data.minimumAmount),
        ),
      );
    }
    if (parsed.data.maximumAmount) {
      filters.push(
        lte(
          bankTransactionsTable.amountMinor,
          parseAmountToMinor(parsed.data.maximumAmount),
        ),
      );
    }
    const where = filters.length ? and(...filters) : undefined;
    const [totalRows] = await db
      .select({ value: count() })
      .from(bankTransactionsTable)
      .where(where);
    const transactions = await db
      .select()
      .from(bankTransactionsTable)
      .where(where)
      .orderBy(desc(bankTransactionsTable.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    res.json(
      ListAdminTransactionsResponse.parse({
        items: transactions.map((transaction) =>
          toBankTransaction(
            transaction,
            transaction.fromUserId ?? transaction.toUserId ?? "",
          ),
        ),
        total: Number(totalRows?.value ?? 0),
        page,
        pageSize,
      }),
    );
  },
);

router.get(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = GetAdminTransactionDetailParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const [transaction] = await db
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, params.data.transactionId))
      .limit(1);
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    const [initiator] = await db
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, transaction.initiatedByUserId))
      .limit(1);
    const customerId = transaction.fromUserId ?? transaction.toUserId;
    const [customer] = customerId
      ? await db
          .select()
          .from(bankUsersTable)
          .where(eq(bankUsersTable.id, customerId))
          .limit(1)
      : [];
    const entries = await db
      .select()
      .from(bankLedgerEntriesTable)
      .where(eq(bankLedgerEntriesTable.transactionId, transaction.id))
      .orderBy(asc(bankLedgerEntriesTable.createdAt));
    res.json(
      GetAdminTransactionDetailResponse.parse({
        transaction: toBankTransaction(
          transaction,
          transaction.fromUserId ?? transaction.toUserId ?? "",
        ),
        initiatorName:
          [initiator?.firstName, initiator?.lastName].filter(Boolean).join(" ") ||
          initiator?.email ||
          "Unknown administrator",
        initiatorEmail: initiator?.email ?? "unknown@invalid.local",
        customerName:
          [customer?.firstName, customer?.lastName].filter(Boolean).join(" ") ||
          customer?.email ||
          "Internal ledger",
        customerEmail: customer?.email ?? "unknown@invalid.local",
        ledgerEntries: entries.map((entry) => ({
          id: entry.id,
          walletId: entry.walletId,
          accountCode: entry.accountCode,
          currency: entry.currency,
          side: entry.side,
          amount: formatMinorAmount(entry.amountMinor),
          createdAt: entry.createdAt.toISOString(),
        })),
        correctionOfTransactionId: transaction.correctionOfTransactionId,
        reversalOfTransactionId: transaction.reversalOfTransactionId,
        correctionReason: transaction.correctionReason,
        adminReference: transaction.adminReference,
        adminNotes: transaction.adminNotes,
        statusHistory: [],
      }),
    );
  },
);

router.post(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = CreateAdminTransactionCorrectionParams.safeParse(req.params);
    const parsed = CreateAdminTransactionCorrectionBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter a correction reason of at least five characters." });
      return;
    }
    let adjustmentMinor: bigint | null = null;
    if (parsed.data.kind === "adjustment") {
      if (!parsed.data.walletId || !parsed.data.direction || !parsed.data.amount) {
        res.status(400).json({
          error: "Choose an original transaction wallet, adjustment direction, and amount.",
        });
        return;
      }
      try {
        adjustmentMinor = parseAmountToMinor(parsed.data.amount);
      } catch (error) {
        res.status(400).json({
          error: error instanceof Error ? error.message : "Enter a valid amount.",
        });
        return;
      }
      if (adjustmentMinor <= 0n) {
        res.status(400).json({ error: "Adjustment amount must be greater than zero." });
        return;
      }
    }
    const result = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
      );
      const [duplicate] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
        .limit(1);
      if (duplicate) {
        return duplicate.correctionOfTransactionId === params.data.transactionId &&
          duplicate.initiatedByUserId === actorUserId
          ? { transaction: duplicate }
          : { error: "That correction reference is already in use." };
      }
      const [original] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!original) return { notFound: true as const };
      if (original.status !== "completed") {
        return { error: "Only a completed transaction with posted ledger entries can be corrected." };
      }
      const originalEntries = await tx
        .select()
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, original.id));
      if (originalEntries.length === 0) {
        return { error: "This record has no posted ledger entries to correct." };
      }
      const walletIds = [
        ...new Set(
          originalEntries.flatMap((entry) => (entry.walletId ? [entry.walletId] : [])),
        ),
      ].sort();

      if (parsed.data.kind === "reversal") {
        if (walletIds.length) {
          await tx
            .select({ id: bankWalletsTable.id })
            .from(bankWalletsTable)
            .where(inArray(bankWalletsTable.id, walletIds))
            .orderBy(asc(bankWalletsTable.id))
            .for("update");
        }
        const [priorReversal] = await tx
          .select({ id: bankTransactionsTable.id })
          .from(bankTransactionsTable)
          .where(eq(bankTransactionsTable.reversalOfTransactionId, original.id))
          .limit(1);
        if (priorReversal) {
          return { error: "This transaction already has a recorded reversal." };
        }
        const debitByWallet = new Map<string, bigint>();
        for (const entry of originalEntries) {
          if (entry.walletId && entry.side === "credit") {
            debitByWallet.set(
              entry.walletId,
              (debitByWallet.get(entry.walletId) ?? 0n) + entry.amountMinor,
            );
          }
        }
        for (const [walletId, debitAmount] of debitByWallet) {
          const balance = await balanceForWallet(tx, walletId);
          const reserved = await reservedForWallet(tx, walletId);
          if (balance - debitAmount < reserved) {
            return {
              error:
                "This transaction's credited balance has already been spent or reserved. Resolve later activity before reversal.",
            };
          }
        }
        const [reversal] = await tx
          .insert(bankTransactionsTable)
          .values({
            reference: createReference(),
            idempotencyKey: parsed.data.idempotencyKey,
            initiatedByUserId: actorUserId,
            fromUserId: original.toUserId,
            toUserId: original.fromUserId,
            fromWalletId: original.toWalletId,
            toWalletId: original.fromWalletId,
            type: "reversal",
            status: "completed",
            currency: original.currency,
            amountMinor: original.amountMinor,
            feeMinor: original.feeMinor,
            counterparty: original.reference,
            description: `Reversal of ${original.reference}`,
            correctionOfTransactionId: original.id,
            reversalOfTransactionId: original.id,
            correctionReason: reason,
            mode: "internal_ledger",
          })
          .returning();
        await tx.insert(bankLedgerEntriesTable).values(
          originalEntries.map((entry) => ({
            transactionId: reversal.id,
            walletId: entry.walletId,
            accountCode: entry.accountCode,
            currency: entry.currency,
            side: entry.side === "credit" ? "debit" : "credit",
            amountMinor: entry.amountMinor,
          })),
        );
        await tx
          .update(bankTransactionsTable)
          .set({ status: "reversed" })
          .where(eq(bankTransactionsTable.id, original.id));
        const targetUserId =
          original.fromUserId ?? original.toUserId ?? actorUserId;
        await tx.insert(bankAuditLogsTable).values({
          actorUserId,
          targetUserId,
          action: "reverse_transaction",
          reason: `Transaction ${original.reference} reversed by ${reversal.reference}. ${reason}`,
        });
        return { transaction: reversal };
      }

      if (!parsed.data.walletId || !parsed.data.direction || !adjustmentMinor) {
        return { error: "An adjustment wallet, direction, and amount are required." };
      }
      const walletEntry = originalEntries.find(
        (entry) => entry.walletId === parsed.data.walletId,
      );
      if (!walletEntry) {
        return { error: "Choose a wallet affected by the original transaction." };
      }
      const correctionSettings = await getOrCreateAdminSettings();
      const correctionLimitMinor = parseAmountToMinor(
        correctionSettings.fundingLimit,
      );
      const correctionApprovalThreshold = parseAmountToMinor(
        correctionSettings.secondApprovalThreshold,
      );
      if (adjustmentMinor > correctionLimitMinor) {
        return { error: "Adjustment exceeds the configured per-currency funding cap." };
      }
      const requiresSecondApproval =
        adjustmentMinor >= correctionApprovalThreshold;
      const [walletSnapshot] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, parsed.data.walletId))
        .limit(1);
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, walletSnapshot?.userId ?? ""))
        .for("update");
      const [wallet] = walletSnapshot
        ? await tx
            .select()
            .from(bankWalletsTable)
            .where(eq(bankWalletsTable.id, walletSnapshot.id))
            .for("update")
        : [];
      if (!wallet) return { error: "The affected wallet is unavailable." };
      if (!target || target.accountStatus !== "active") {
        return { error: "Only active customer accounts can receive adjustments." };
      }
      const restrictionError = await bankOperationRestrictionError(tx, {
        userId: target.id,
        walletId: wallet.id,
        operation: parsed.data.direction === "debit" ? "admin_debit" : "admin_credit",
      });
      if (restrictionError) return { error: restrictionError };
      if (parsed.data.direction === "debit") {
        if (wallet.status !== "active") {
          return { error: "A frozen wallet cannot be debited." };
        }
        const balance = await balanceForWallet(tx, wallet.id);
        const reserved = await reservedForWallet(tx, wallet.id);
        if (balance - reserved < adjustmentMinor) {
          return { error: "The adjustment exceeds the available wallet balance." };
        }
      }
      const isCredit = parsed.data.direction === "credit";
      const [adjustment] = await tx
        .insert(bankTransactionsTable)
        .values({
          reference: createReference(),
          idempotencyKey: parsed.data.idempotencyKey,
          initiatedByUserId: actorUserId,
          fromUserId: isCredit ? null : target.id,
          toUserId: isCredit ? target.id : null,
          fromWalletId: isCredit ? null : wallet.id,
          toWalletId: isCredit ? wallet.id : null,
          type: "admin_adjustment",
          status: requiresSecondApproval ? "pending" : "completed",
          currency: wallet.currency,
          amountMinor: adjustmentMinor,
          feeMinor: 0n,
          counterparty: original.reference,
          description: `Adjustment for ${original.reference}`,
          correctionOfTransactionId: original.id,
          correctionReason: reason,
          mode: "internal_ledger",
        })
        .returning();
      if (!requiresSecondApproval) {
        await tx.insert(bankLedgerEntriesTable).values([
          {
            transactionId: adjustment.id,
            accountCode: `internal:balance-adjustment:${wallet.currency}`,
            currency: wallet.currency,
            side: isCredit ? "debit" : "credit",
            amountMinor: adjustmentMinor,
          },
          {
            transactionId: adjustment.id,
            walletId: wallet.id,
            accountCode: `wallet:${wallet.id}`,
            currency: wallet.currency,
            side: isCredit ? "credit" : "debit",
            amountMinor: adjustmentMinor,
          },
        ]);
      }
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: requiresSecondApproval
          ? "request_admin_adjustment"
          : "adjust_transaction",
        reason: `${requiresSecondApproval ? "Awaiting second-admin approval. " : ""}Adjustment ${adjustment.reference} references transaction ${original.reference}: ${parsed.data.direction} ${formatMinorAmount(adjustmentMinor)} ${wallet.currency}. ${reason}`,
      });
      return { transaction: adjustment };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Original transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(201).json(
      CreateAdminTransactionCorrectionResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

router.get("/bank/admin/ledger", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminLedgerQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const rows = await db
    .select()
    .from(bankTransactionsTable)
    .where(
      parsed.data.currency
        ? eq(bankTransactionsTable.currency, parsed.data.currency)
        : undefined,
    )
    .orderBy(desc(bankTransactionsTable.createdAt))
    .limit(parsed.data.limit ?? 50);

  res.json(
    ListAdminLedgerResponse.parse(
      rows.map((transaction) =>
        toBankTransaction(
          transaction,
          transaction.fromUserId ?? transaction.toUserId ?? "",
        ),
      ),
    ),
  );
});

router.get(
  "/bank/admin/transactions/:transactionId/status-history",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ListAdminTransactionStatusHistoryParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [transaction] = await db
      .select({
        id: bankTransactionsTable.id,
        reference: bankTransactionsTable.reference,
      })
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.id, params.data.transactionId));
    if (!transaction) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }

    const reasonPrefix = `Transaction ${transaction.reference}: `;
    const auditRows = await db
      .select()
      .from(bankAuditLogsTable)
      .where(
        and(
            inArray(bankAuditLogsTable.action, [
              "override_transaction_status",
              "process_internal_transfer",
            ]),
          sql`left(${bankAuditLogsTable.reason}, ${reasonPrefix.length}) = ${reasonPrefix}`,
        ),
      )
      .orderBy(asc(bankAuditLogsTable.createdAt), asc(bankAuditLogsTable.id));

    const userIds = [
      ...new Set(
        auditRows.flatMap((row) => [row.actorUserId, row.targetUserId]),
      ),
    ];
    const users = userIds.length
      ? await db
          .select({
            id: bankUsersTable.id,
            email: bankUsersTable.email,
            firstName: bankUsersTable.firstName,
            lastName: bankUsersTable.lastName,
          })
          .from(bankUsersTable)
          .where(inArray(bankUsersTable.id, userIds))
      : [];
    const usersById = new Map(users.map((user) => [user.id, user]));
    const history = new Map<
      string,
      {
        actor: NonNullable<ReturnType<typeof usersById.get>>;
        timestamp: Date;
        previousStatus: string;
        newStatus: string;
        reason: string;
        affectedMembers: Map<string, NonNullable<ReturnType<typeof usersById.get>>>;
      }
    >();

    for (const row of auditRows) {
      const actor = usersById.get(row.actorUserId);
      const affectedMember = usersById.get(row.targetUserId);
      const details = row.reason.slice(reasonPrefix.length);
      const match =
        /^(pending|completed|failed|rejected|reversed) → (pending|completed|failed|rejected|reversed)\. ([\s\S]*)$/.exec(
          details,
        );
      if (!actor || !affectedMember || !match) {
        req.log.error(
          { transactionId: transaction.id, auditLogId: row.id },
          "Could not read transaction status audit entry",
        );
        res.status(500).json({ error: "Transaction status history is unavailable." });
        return;
      }

      const eventKey = `${row.createdAt.toISOString()}|${row.actorUserId}|${row.reason}`;
      let event = history.get(eventKey);
      if (!event) {
        event = {
          actor,
          timestamp: row.createdAt,
          previousStatus: match[1],
          newStatus: match[2],
          reason: match[3],
          affectedMembers: new Map(),
        };
        history.set(eventKey, event);
      }
      event.affectedMembers.set(affectedMember.id, affectedMember);
    }

    res.json(
      ListAdminTransactionStatusHistoryResponse.parse(
        [...history.values()].map((event) => ({
          actorName:
            [event.actor.firstName, event.actor.lastName].filter(Boolean).join(" ") ||
            event.actor.email,
          actorEmail: event.actor.email,
          timestamp: event.timestamp.toISOString(),
          previousStatus: event.previousStatus,
          newStatus: event.newStatus,
          reason: event.reason,
          affectedMembers: [...event.affectedMembers.values()].map((user) => ({
            name:
              [user.firstName, user.lastName].filter(Boolean).join(" ") ||
              user.email,
            email: user.email,
          })),
        })),
      ),
    );
  },
);

router.post(
  "/bank/admin/transactions/:transactionId/process",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = ProcessAdminInternalTransferParams.safeParse(req.params);
    const parsed = ProcessAdminInternalTransferBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({
        error: !params.success
          ? params.error.message
          : parsed.error?.message ?? "Invalid request.",
      });
      return;
    }
    const clerkUserId = getAuth(req).userId;
    if (!clerkUserId) {
      res.status(401).json({ error: "Sign in to access administrative controls." });
      return;
    }
    const actorUserId = (await ensureBankUser(clerkUserId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) return { notFound: true as const };
      if (transaction.type !== "external_transfer" || transaction.status !== "pending") {
        return { error: "Only pending internal transfer requests can be processed." };
      }
      const [request] = await tx
        .select()
        .from(bankInternationalTransferRequestsTable)
        .where(eq(bankInternationalTransferRequestsTable.transactionId, transaction.id))
        .for("update");
      if (!request) {
        return { error: "The internal transfer request details are unavailable." };
      }
      const restrictionError = await bankOperationRestrictionError(tx, {
        userId: request.userId,
        walletId: request.sourceWalletId,
        operation: "outgoing_transfer",
      });
      if (restrictionError) return { error: restrictionError };
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, request.sourceWalletId))
        .for("update");
      if (!wallet || wallet.userId !== request.userId || wallet.status !== "active") {
        return { error: "The source wallet is unavailable or frozen." };
      }
      if (!wallet.transfersEnabled) {
        return { error: "Outgoing transfers are disabled for this wallet in the member’s private vault." };
      }
      const finalRestrictionError = await bankOperationRestrictionError(tx, {
        userId: request.userId,
        walletId: wallet.id,
        operation: "outgoing_transfer",
      });
      if (finalRestrictionError) return { error: finalRestrictionError };
      const existingEntries = await tx
        .select({ id: bankLedgerEntriesTable.id })
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, transaction.id))
        .limit(1);
      if (existingEntries.length) {
        return { error: "This transfer already has ledger entries and cannot be posted again." };
      }
      const balance = await balanceForWallet(tx, wallet.id);
      const reserved = await reservedForWallet(tx, wallet.id);
      if (balance - reserved < request.sourceAmountMinor) {
        return { error: "The customer no longer has enough available balance to process this request." };
      }
      await tx.insert(bankLedgerEntriesTable).values([
        {
          transactionId: transaction.id,
          walletId: wallet.id,
          accountCode: `wallet:${wallet.id}`,
          currency: request.sourceCurrency,
          side: "debit",
          amountMinor: request.sourceAmountMinor,
        },
        {
          transactionId: transaction.id,
          accountCode: `internal:transfer-clearing:${request.sourceCurrency}`,
          currency: request.sourceCurrency,
          side: "credit",
          amountMinor: request.sourceAmountMinor,
        },
      ]);
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({ status: "completed" })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values(
        [...new Set([request.userId, actorUserId])].map((targetUserId) => ({
          actorUserId,
          targetUserId,
          action: "process_internal_transfer",
          reason: `Transaction ${transaction.reference}: pending → completed. ${parsed.data.reason.trim()}`,
        })),
      );
      const notification = await storeNotification(tx, {
        userId: request.userId,
        category: "transfer",
        title: "Transfer recorded",
        body: `${formatMinorAmount(request.sourceAmountMinor, request.sourceCurrency)} ${request.sourceCurrency} was recorded in Globus after review.`,
        reference: transaction.reference,
      });
      return { transaction: updated, request, notification };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    if (result.notification) {
      void sendPushToUser(result.request.userId, result.notification);
      const emailSent = await notifyTransferRecipient({
        notificationId: result.notification.id,
        senderUserId: result.request.userId,
        encryptedEmail: result.request.recipientEmailEncrypted,
        recipientName: result.request.recipientAccountName,
        bankName: result.request.recipientBank,
        destinationCountry: result.request.destinationCountry,
        amount: formatMinorAmount(
          result.request.destinationAmountMinor,
          result.request.destinationCurrency,
        ),
        currency: result.request.destinationCurrency,
        reference: result.transaction.reference,
        status: result.transaction.status,
        createdAt: result.transaction.createdAt,
      });
      if (!emailSent) {
        req.log.warn({ reference: result.transaction.reference }, "Transfer alert email could not be delivered");
      }
    }
    res.json(
      ProcessAdminInternalTransferResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

router.patch(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = UpdateAdminTransactionStatusParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const parsed = UpdateAdminTransactionStatusBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authenticatedClerkId = getAuth(req).userId;
    if (!authenticatedClerkId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const actorUserId = (await ensureBankUser(authenticatedClerkId)).id;
    const pinResult = await verifyTransactionPin(
      actorUserId,
      parsed.data.transactionPin,
    );
    if (pinResult !== "valid") {
      respondWithTransactionPinError(res, pinResult);
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter an audit reason of at least five characters." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [transaction] = await tx
        .select()
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, params.data.transactionId))
        .for("update");
      if (!transaction) {
        return { notFound: true as const };
      }
      const ledgerEntries = await tx
        .select({
          currency: bankLedgerEntriesTable.currency,
          side: bankLedgerEntriesTable.side,
          amountMinor: bankLedgerEntriesTable.amountMinor,
        })
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, transaction.id))
        .for("update");
      const ledgerPosted = ledgerPostingsBalanced(ledgerEntries);
      if (transaction.status === parsed.data.status) {
        return { transaction, notification: null, transferRequest: null };
      }
      if (transaction.status === "completed" || transaction.status === "reversed") {
        return {
          error:
            "Completed and reversed transaction history is immutable. Use the compensating reversal workflow for corrections.",
        };
      }
      if (parsed.data.status === "completed" && !ledgerPosted) {
        return {
          error:
            "A transaction can be marked completed only when its existing ledger entries are balanced and posted. Status overrides never post entries.",
        };
      }
      if (
        ledgerEntries.length > 0 &&
        parsed.data.status !== "completed"
      ) {
        return {
          error:
            "A transaction with ledger entries cannot be changed to a non-completed state. Use a compensating reversal if the posting was incorrect.",
        };
      }
      const permittedTransition =
        (transaction.status === "pending" &&
          ["failed", "rejected"].includes(parsed.data.status)) ||
        (transaction.status === "failed" && parsed.data.status === "pending") ||
        (parsed.data.status === "completed" && ledgerPosted);
      if (!permittedTransition) {
        return {
          error:
            "This status transition is not permitted. Pending operations may fail or be rejected; failed operations may be reopened only when no ledger entries exist.",
        };
      }
      if (
        transaction.type === "deposit_request" ||
        transaction.type === "withdrawal_request"
      ) {
        const [request] = await tx
          .select()
          .from(bankSandboxRequestsTable)
          .where(eq(bankSandboxRequestsTable.transactionId, transaction.id))
          .for("update");
        if (
          request &&
          (request.status === "pending_review" ||
            request.status === "pending_provider_setup")
        ) {
          return {
            error:
              "Pending deposits and withdrawals must be approved or rejected in the ledger request queue.",
          };
        }
      }
      const [updated] = await tx
        .update(bankTransactionsTable)
        .set({ status: parsed.data.status })
        .where(eq(bankTransactionsTable.id, transaction.id))
        .returning();
      const targetUserIds = [
        ...new Set(
          [
            transaction.fromUserId,
            transaction.toUserId,
            transaction.initiatedByUserId,
          ].filter((userId): userId is string => Boolean(userId)),
        ),
      ];
      await tx.insert(bankAuditLogsTable).values(
        targetUserIds.map((targetUserId) => ({
          actorUserId,
          targetUserId,
          action: "override_transaction_status",
          reason: `Transaction ${transaction.reference}: ${transaction.status} → ${parsed.data.status}. ${reason}`,
        })),
      );
      let notification: Awaited<ReturnType<typeof storeNotification>> | null = null;
      let transferRequest: typeof bankInternationalTransferRequestsTable.$inferSelect | null = null;
      if (transaction.type === "external_transfer" && transaction.fromUserId) {
        const [request] = await tx
          .select()
          .from(bankInternationalTransferRequestsTable)
          .where(eq(bankInternationalTransferRequestsTable.transactionId, transaction.id))
          .for("update");
        if (request) {
          transferRequest = request;
          const statusMessage =
            parsed.data.status === "pending"
              ? "The transfer was reopened for review. No wallet balance changed."
              : parsed.data.status === "failed" || parsed.data.status === "rejected"
                ? "The transfer was not posted to the Globus wallet."
                : "The transfer status was updated in Globus.";
          notification = await storeNotification(tx, {
            userId: transaction.fromUserId,
            category: "transfer",
            title: `Transfer status: ${parsed.data.status}`,
            body: statusMessage,
            reference: transaction.reference,
          });
        }
      }
      return { transaction: updated, notification, transferRequest };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    if ("notification" in result && result.notification && result.transferRequest) {
      void sendPushToUser(result.transferRequest.userId, result.notification);
      const emailSent = await notifyTransferRecipient({
        notificationId: result.notification.id,
        senderUserId: result.transferRequest.userId,
        encryptedEmail: result.transferRequest.recipientEmailEncrypted,
        recipientName: result.transferRequest.recipientAccountName,
        bankName: result.transferRequest.recipientBank,
        destinationCountry: result.transferRequest.destinationCountry,
        amount: formatMinorAmount(
          result.transferRequest.destinationAmountMinor,
          result.transferRequest.destinationCurrency,
        ),
        currency: result.transferRequest.destinationCurrency,
        reference: result.transaction.reference,
        status: result.transaction.status,
        createdAt: result.transaction.createdAt,
      });
      if (!emailSent) {
        req.log.warn({ reference: result.transaction.reference }, "Transfer alert email could not be delivered");
      }
    }
    res.json(
      UpdateAdminTransactionStatusResponse.parse(
        toBankTransaction(
          result.transaction,
          result.transaction.fromUserId ??
            result.transaction.toUserId ??
            actorUserId,
        ),
      ),
    );
  },
);

export default router;
