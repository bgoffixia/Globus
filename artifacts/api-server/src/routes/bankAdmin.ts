import { Router, type IRouter, type RequestHandler } from "express";
import { pipeline } from "node:stream/promises";
import { getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  CreateAdminFundingBody,
  CreateAdminFundingParams,
  CreateAdminFundingResponse,
  DeleteAdminTransactionBody,
  DeleteAdminTransactionParams,
  DeleteAdminTransactionResponse,
  GetAdminIdentityDocumentContentParams,
  GetAdminAccessResponse,
  GetAdminSummaryResponse,
  GetAdminUserDetailParams,
  GetAdminUserDetailResponse,
  ListAdminLedgerQueryParams,
  ListAdminLedgerResponse,
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
} from "@workspace/api-zod";
import {
  bankAuditLogsTable,
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
  getWalletsForUser,
  listUserTransactions,
  parseAmountToMinor,
  toBankTransaction,
  userWallet,
} from "../lib/bank";
import {
  deleteIdentityDocumentObject,
  getIdentityDocumentFile,
} from "../lib/identityDocumentStorage";

const router: IRouter = Router();

function configuredAdminIds(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_CLERK_IDS ?? "")
      .split(",")
      .map((userId) => userId.trim())
      .filter(Boolean),
  );
}

const requireSignedIn: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  next();
};

const requireAdmin: RequestHandler = (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  if (!configuredAdminIds().has(userId)) {
    res.status(403).json({ error: "Administrator access is not enabled for this account." });
    return;
  }
  next();
};

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

router.get("/bank/admin/access", requireSignedIn, (req, res): void => {
  const userId = getAuth(req).userId;
  const allowed = userId ? configuredAdminIds().has(userId) : false;
  res.json(
    GetAdminAccessResponse.parse({
      allowed,
      roles: allowed ? ["super_administrator"] : [],
    }),
  );
});

router.get("/bank/admin/summary", requireAdmin, async (_req, res): Promise<void> => {
  const [userCount, walletCount, requestCount, transactionCount] =
    await Promise.all([
      db.select({ value: count() }).from(bankUsersTable),
      db
        .select({ value: count() })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.status, "active")),
      db
        .select({ value: count() })
        .from(bankSandboxRequestsTable)
        .where(eq(bankSandboxRequestsTable.status, "pending_provider_setup")),
      db
        .select({ value: count() })
        .from(bankTransactionsTable)
        .where(eq(bankTransactionsTable.status, "completed")),
    ]);

  res.json(
    GetAdminSummaryResponse.parse({
      registeredUsers: userCount[0]?.value ?? 0,
      activeWallets: walletCount[0]?.value ?? 0,
      pendingProviderRequests: requestCount[0]?.value ?? 0,
      ledgerTransactions: transactionCount[0]?.value ?? 0,
      simulationMode: true,
      providerStatus: "not_configured",
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
  const rows = await db
    .select({
      id: bankUsersTable.id,
      email: bankUsersTable.email,
      firstName: bankUsersTable.firstName,
      lastName: bankUsersTable.lastName,
      country: bankUsersTable.country,
      verificationStatus: bankUsersTable.verificationStatus,
      verificationNote: bankUsersTable.verificationNote,
      accountStatus: bankUsersTable.accountStatus,
      createdAt: bankUsersTable.createdAt,
      walletCount: count(bankWalletsTable.id),
    })
    .from(bankUsersTable)
    .leftJoin(bankWalletsTable, eq(bankWalletsTable.userId, bankUsersTable.id))
    .where(
      search
        ? or(
            ilike(bankUsersTable.email, `%${search}%`),
            ilike(bankUsersTable.id, `%${search}%`),
          )
        : undefined,
    )
    .groupBy(
      bankUsersTable.id,
      bankUsersTable.email,
      bankUsersTable.firstName,
      bankUsersTable.lastName,
      bankUsersTable.country,
      bankUsersTable.verificationStatus,
      bankUsersTable.verificationNote,
      bankUsersTable.accountStatus,
      bankUsersTable.createdAt,
    )
    .orderBy(desc(bankUsersTable.createdAt))
    .limit(parsed.data.limit ?? 50);

  res.json(
    ListAdminUsersResponse.parse(
      rows.map((row) => ({
        ...row,
        verificationStatus: row.verificationStatus as
          | "not_started"
          | "pending"
          | "approved"
          | "rejected"
          | "additional_information_required",
        verificationNote: row.verificationNote,
        accountStatus: row.accountStatus as "active" | "suspended",
        createdAt: row.createdAt.toISOString(),
        walletCount: Number(row.walletCount),
      })),
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
    const [wallets, transactions] = await Promise.all([
      getWalletsForUser(user.id),
      listUserTransactions(user.id, { limit: 50 }),
    ]);
    res.json(
      GetAdminUserDetailResponse.parse({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          country: user.country,
          verificationStatus: user.verificationStatus,
          verificationNote: user.verificationNote,
          accountStatus: user.accountStatus,
          walletCount: wallets.length,
          createdAt: user.createdAt.toISOString(),
        },
        phone: user.phone,
        wallets,
        transactions,
      }),
    );
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
      const [user] = await tx
        .update(bankUsersTable)
        .set({
          accountStatus: parsed.data.accountStatus,
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
            : "reactivate_user",
        reason: parsed.data.reason.trim(),
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
        firstName: result.firstName,
        lastName: result.lastName,
        country: result.country,
        verificationStatus: result.verificationStatus,
        verificationNote: result.verificationNote,
        accountStatus: result.accountStatus,
        walletCount: walletCount?.value ?? 0,
        createdAt: result.createdAt.toISOString(),
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
    if (params.data.userId === actorUserId) {
      res.status(400).json({ error: "Administrators cannot review their own identity." });
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

    if (amountMinor <= 0n || amountMinor > 100_000_000n) {
      res.status(400).json({ error: "Funding must be greater than zero and no more than 1,000,000.00." });
      return;
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
        const sameRequest =
          duplicate.initiatedByUserId === actorUserId &&
          duplicate.toUserId === params.data.userId &&
          duplicate.type === "admin_funding" &&
          duplicate.currency === parsed.data.currency &&
          duplicate.amountMinor === amountMinor &&
          duplicate.counterparty === senderName &&
          duplicate.description === description;
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
        return { error: "Only active user accounts can receive simulated funding." };
      }

      const wallet = await userWallet(tx, target.id, parsed.data.currency);
      if (!wallet || wallet.status !== "active") {
        return { error: "An active wallet for the selected currency is unavailable." };
      }
      await tx
        .select({ id: bankWalletsTable.id })
        .from(bankWalletsTable)
        .where(eq(bankWalletsTable.id, wallet.id))
        .for("update");

      const [transaction] = await tx
        .insert(bankTransactionsTable)
        .values({
          reference: createReference(),
          idempotencyKey: parsed.data.idempotencyKey,
          initiatedByUserId: actorUserId,
          toUserId: target.id,
          toWalletId: wallet.id,
          type: "admin_funding",
          status: "completed",
          currency: parsed.data.currency,
          amountMinor,
          feeMinor: 0n,
          counterparty: senderName,
          description,
          mode: "simulation",
        })
        .returning();

      await tx.insert(bankLedgerEntriesTable).values([
        {
          transactionId: transaction.id,
          accountCode: `simulation:admin-funding:${parsed.data.currency}`,
          currency: parsed.data.currency,
          side: "debit",
          amountMinor,
        },
        {
          transactionId: transaction.id,
          walletId: wallet.id,
          accountCode: `wallet:${wallet.id}`,
          currency: parsed.data.currency,
          side: "credit",
          amountMinor,
        },
      ]);

      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId: target.id,
        action: "fund_user",
        reason,
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

router.delete(
  "/bank/admin/transactions/:transactionId",
  requireAdmin,
  async (req, res): Promise<void> => {
    const params = DeleteAdminTransactionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = DeleteAdminTransactionBody.safeParse(req.body);
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
      res.status(400).json({ error: "Enter a deletion reason of at least five characters." });
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
      const entries = await tx
        .select()
        .from(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, transaction.id));
      const walletIds = [
        ...new Set(
          entries.flatMap((entry) => (entry.walletId ? [entry.walletId] : [])),
        ),
      ].sort();
      if (walletIds.length > 0) {
        await tx
          .select({ id: bankWalletsTable.id })
          .from(bankWalletsTable)
          .where(inArray(bankWalletsTable.id, walletIds))
          .orderBy(asc(bankWalletsTable.id))
          .for("update");
      }

      const creditsToRemove = new Map<string, bigint>();
      for (const entry of entries) {
        if (entry.walletId && entry.side === "credit") {
          creditsToRemove.set(
            entry.walletId,
            (creditsToRemove.get(entry.walletId) ?? 0n) + entry.amountMinor,
          );
        }
      }
      for (const [walletId, amountMinor] of creditsToRemove) {
        if ((await balanceForWallet(tx, walletId)) < amountMinor) {
          return {
            error:
              "This transaction has already been spent from an affected wallet. Delete later activity first to avoid a negative simulated balance.",
          };
        }
      }

      await tx
        .delete(bankSandboxRequestsTable)
        .where(eq(bankSandboxRequestsTable.transactionId, transaction.id));
      await tx
        .delete(bankLedgerEntriesTable)
        .where(eq(bankLedgerEntriesTable.transactionId, transaction.id));
      await tx
        .delete(bankTransactionsTable)
        .where(eq(bankTransactionsTable.id, transaction.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId,
        targetUserId:
          transaction.fromUserId ??
          transaction.toUserId ??
          transaction.initiatedByUserId,
        action: "delete_transaction",
        reason: `Transaction ${transaction.reference}: ${reason}`,
      });

      return { deleted: true as const, reference: transaction.reference };
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
      DeleteAdminTransactionResponse.parse({
        transactionId: params.data.transactionId,
        reference: result.reference,
        deleted: result.deleted,
      }),
    );
  },
);

export default router;
