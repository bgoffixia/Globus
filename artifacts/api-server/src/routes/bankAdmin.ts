import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import {
  CreateAdminFundingBody,
  CreateAdminFundingParams,
  CreateAdminFundingResponse,
  DeleteAdminTransactionBody,
  DeleteAdminTransactionParams,
  DeleteAdminTransactionResponse,
  GetAdminAccessResponse,
  GetAdminSummaryResponse,
  ListAdminLedgerQueryParams,
  ListAdminLedgerResponse,
  ListAdminUsersQueryParams,
  ListAdminUsersResponse,
  UpdateAdminUserStatusBody,
  UpdateAdminUserStatusParams,
  UpdateAdminUserStatusResponse,
} from "@workspace/api-zod";
import {
  bankAuditLogsTable,
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
  parseAmountToMinor,
  toBankTransaction,
  userWallet,
} from "../lib/bank";

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
        accountStatus: row.accountStatus as "active" | "suspended",
        createdAt: row.createdAt.toISOString(),
        walletCount: Number(row.walletCount),
      })),
    ),
  );
});

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

    const actorUserId = getAuth(req).userId;
    if (!actorUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
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
        accountStatus: result.accountStatus,
        walletCount: walletCount?.value ?? 0,
        createdAt: result.createdAt.toISOString(),
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

    const actorUserId = getAuth(req).userId;
    if (!actorUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
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

    if (amountMinor <= 0n || amountMinor > 100_000_000n) {
      res.status(400).json({ error: "Funding must be greater than zero and no more than 1,000,000.00." });
      return;
    }

    await ensureBankUser(actorUserId);
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

    const actorUserId = getAuth(req).userId;
    if (!actorUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const reason = parsed.data.reason.trim();
    if (reason.length < 5) {
      res.status(400).json({ error: "Enter a deletion reason of at least five characters." });
      return;
    }

    await ensureBankUser(actorUserId);
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
