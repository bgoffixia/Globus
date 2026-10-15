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
  ilike,
  inArray,
  lte,
  or,
  sql,
} from "drizzle-orm";
import {
  CreateAdminFundingBody,
  CreateAdminFundingParams,
  CreateAdminFundingResponse,
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
  UpdateAdminUserVerificationBody,
  UpdateAdminUserVerificationParams,
  UpdateAdminUserVerificationResponse,
  UpdateAdminUserStatusBody,
  UpdateAdminUserStatusParams,
  UpdateAdminUserStatusResponse,
  UpdateAdminUserProfileBody,
  UpdateAdminUserProfileParams,
  UpdateAdminUserProfileResponse,
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
  bankLedgerEntriesTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  balanceForWallet,
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
    if (
      documents.length === 0 ||
      documents.some((document) => document.status !== "uploaded")
    ) {
      return { error: "At least one fully uploaded identity document is required." };
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
  const [
    userCount,
    accountStates,
    pendingCount,
    transactionCount,
    ledgerTotals,
    recentActions,
  ] = await Promise.all([
    db.select({ value: count() }).from(bankUsersTable),
    db
      .select({ status: bankUsersTable.accountStatus, value: count() })
      .from(bankUsersTable)
      .groupBy(bankUsersTable.accountStatus),
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
  const stateCount = new Map(
    accountStates.map((row) => [row.status, Number(row.value)]),
  );
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
  const currencies = ["USD", "EUR", "GBP", "NGN", "CAD", "AUD"] as const;
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
      activeAccounts: stateCount.get("active") ?? 0,
      restrictedAccounts: stateCount.get("restricted") ?? 0,
      suspendedAccounts: stateCount.get("suspended") ?? 0,
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
  if (parsed.data.status) {
    filters.push(eq(bankWalletsTable.status, parsed.data.status));
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
        status: row.status as "active" | "restricted",
        restrictionReason: row.restrictionReason,
        restrictionNotes: row.restrictionNotes,
        restrictedAt: row.restrictedAt?.toISOString() ?? null,
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
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, params.data.walletId))
        .for("update");
      if (!wallet) return null;
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, wallet.userId));
      if (!user) return null;
      const restricted = parsed.data.status === "restricted";
      const [updated] = await tx
        .update(bankWalletsTable)
        .set({
          status: parsed.data.status,
          restrictionReason: restricted ? reason : null,
          restrictionNotes: restricted ? parsed.data.notes?.trim() || null : null,
          restrictedByUserId: restricted ? actorUserId : null,
          restrictedAt: restricted ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(bankWalletsTable.id, wallet.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: user.id,
        action: restricted ? "freeze_wallet" : "unfreeze_wallet",
        reason: `${wallet.currency} wallet ${wallet.id}: ${reason}${parsed.data.notes?.trim() ? ` Notes: ${parsed.data.notes.trim()}` : ""}`,
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
  const [settings] = await db
    .insert(bankAdminSettingsTable)
    .values({
      id: "operations",
      fundingLimit: formatMinorAmount(fundingLimitMinor),
      secondApprovalThreshold: formatMinorAmount(approvalThresholdMinor),
      updatedByUserId: actorUserId,
    })
    .onConflictDoUpdate({
      target: bankAdminSettingsTable.id,
      set: {
        fundingLimit: formatMinorAmount(fundingLimitMinor),
        secondApprovalThreshold: formatMinorAmount(approvalThresholdMinor),
        updatedByUserId: actorUserId,
        updatedAt: new Date(),
      },
    })
    .returning();
  await db.insert(bankAuditLogsTable).values({
    actorUserId,
    targetUserId: actorUserId,
    action: "update_admin_settings",
    reason: `Funding cap ${settings.fundingLimit}; second approval threshold ${settings.secondApprovalThreshold}. ${reason}`,
  });
  res.json(
    UpdateAdminSettingsResponse.parse({
      fundingLimit: settings.fundingLimit,
      secondApprovalThreshold: settings.secondApprovalThreshold,
      frozenIncomingPolicy: "allow_frozen",
      updatedAt: settings.updatedAt.toISOString(),
    }),
  );
});

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
  if (parsed.data.accountStatus) {
    filters.push(eq(bankUsersTable.accountStatus, parsed.data.accountStatus));
  }
  if (parsed.data.verificationStatus) {
    filters.push(
      eq(bankUsersTable.verificationStatus, parsed.data.verificationStatus),
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
          accountStatus: row.accountStatus as "active" | "restricted" | "suspended",
          accountRestrictedAt: row.accountRestrictedAt?.toISOString() ?? null,
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
    const [wallets, transactions, history, transactionCountRows] = await Promise.all([
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
    ]);
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
          accountStatus: user.accountStatus,
          accountRestrictionReason: user.accountRestrictionReason,
          accountRestrictionNotes: user.accountRestrictionNotes,
          accountRestrictedAt: user.accountRestrictedAt?.toISOString() ?? null,
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
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, walletId))
        .for("update");
      const targetUserId = transaction.fromUserId ?? transaction.toUserId;
      if (!targetUserId) {
        return { error: "The funding request is missing its target customer." };
      }
      const [target] = targetUserId
        ? await tx
            .select()
            .from(bankUsersTable)
            .where(eq(bankUsersTable.id, targetUserId))
            .for("update")
        : [];
      if (!wallet || !target) {
        return { error: "The funding wallet or customer account is unavailable." };
      }
      const isDebit = Boolean(transaction.fromWalletId);
      if (target.accountStatus !== "active") {
        return { error: "Funding cannot be approved for a restricted or suspended account." };
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
  async (_req, res): Promise<void> => {
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
      if (walletIds.length) {
        await tx
          .select({ id: bankWalletsTable.id })
          .from(bankWalletsTable)
          .where(inArray(bankWalletsTable.id, walletIds))
          .orderBy(asc(bankWalletsTable.id))
          .for("update");
      }

      if (parsed.data.kind === "reversal") {
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
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, parsed.data.walletId))
        .limit(1);
      if (!wallet) return { error: "The affected wallet is unavailable." };
      const [target] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, wallet.userId))
        .limit(1);
      if (!target || target.accountStatus !== "active") {
        return { error: "Only active customer accounts can receive adjustments." };
      }
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
          eq(bankAuditLogsTable.action, "override_transaction_status"),
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
        /^(pending|completed|failed|reversed) → (pending|completed|failed|reversed)\. ([\s\S]*)$/.exec(
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
      if (
        transaction.type === "external_transfer" &&
        parsed.data.status === "completed"
      ) {
        return {
          error:
            "International transfer requests cannot be marked completed because Globus does not send funds to outside accounts.",
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
      if (transaction.status === parsed.data.status) {
        return { transaction };
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
      return { transaction: updated };
    });

    if ("notFound" in result) {
      res.status(404).json({ error: "Transaction not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
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
