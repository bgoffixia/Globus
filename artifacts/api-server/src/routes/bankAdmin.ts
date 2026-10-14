import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import { and, count, desc, eq, ilike, or } from "drizzle-orm";
import {
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
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import { toBankTransaction } from "../lib/bank";

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

router.get("/bank/admin/ledger", requireAdmin, async (req, res): Promise<void> => {
  const parsed = ListAdminLedgerQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const clauses = [eq(bankTransactionsTable.status, "completed")];
  if (parsed.data.currency) {
    clauses.push(eq(bankTransactionsTable.currency, parsed.data.currency));
  }

  const rows = await db
    .select()
    .from(bankTransactionsTable)
    .where(and(...clauses))
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

export default router;
