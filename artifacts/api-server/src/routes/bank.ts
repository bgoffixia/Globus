import { Router, type IRouter, type RequestHandler } from "express";
import { getAuth } from "@clerk/express";
import {
  asc,
  eq,
  inArray,
  sql,
} from "drizzle-orm";
import {
  CreateBankTransferBody,
  CreateBankTransferResponse,
  CreateExternalTransferBody,
  CreateExternalTransferResponse,
  CreateIncomingExternalTransferBody,
  CreateSimulationRequestBody,
  CreateIncomingExternalTransferResponse,
  CreateSimulationRequestResponse,
  GetBankDashboardResponse,
  GetBankProfileResponse,
  ListBankTransactionsQueryParams,
  ListBankTransactionsResponse,
  ListBankWalletsResponse,
  UpdateBankProfileBody,
  UpdateBankProfileResponse,
} from "@workspace/api-zod";
import {
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
  getRecentTransactions,
  getTransactionByIdempotencyKey,
  getWalletsForUser,
  listUserTransactions,
  parseAmountToMinor,
  toBankTransaction,
  userWallet,
} from "../lib/bank";

const router: IRouter = Router();

const requireSignedIn: RequestHandler = (req, res, next) => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  next();
};

async function getOrCreateBankUser(clerkUserId: string) {
  return ensureBankUser(clerkUserId);
}

router.use("/bank", requireSignedIn);

router.get("/bank/me", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(userId);
  res.json(
    GetBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      verificationStatus: user.verificationStatus,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.get("/bank/dashboard", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const profile = await getOrCreateBankUser(userId);
  const [wallets, recentTransactions] = await Promise.all([
    getWalletsForUser(userId),
    getRecentTransactions(userId),
  ]);

  res.json(
    GetBankDashboardResponse.parse({
      profile: {
        id: profile.id,
        email: profile.email,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        country: profile.country,
        verificationStatus: profile.verificationStatus,
        accountStatus: profile.accountStatus,
        createdAt: profile.createdAt.toISOString(),
      },
      wallets,
      recentTransactions,
      referenceCurrency: "USD",
      simulationMode: true,
    }),
  );
});

router.get("/bank/wallets", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  await getOrCreateBankUser(userId);
  res.json(ListBankWalletsResponse.parse(await getWalletsForUser(userId)));
});

router.get("/bank/transactions", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  await getOrCreateBankUser(userId);
  const parsed = ListBankTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const transactions = await listUserTransactions(userId, {
    currency: parsed.data.currency,
    status: parsed.data.status,
    search: parsed.data.search,
    limit: parsed.data.limit ?? 25,
  });

  res.json(ListBankTransactionsResponse.parse(transactions));
});

router.put("/bank/profile", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = UpdateBankProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const currentUser = await getOrCreateBankUser(userId);
  const [user] = await db
    .update(bankUsersTable)
    .set({
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim(),
      phone: parsed.data.phone.trim(),
      country: parsed.data.country.trim(),
      acceptedTermsAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(bankUsersTable.id, currentUser.id))
    .returning();

  res.json(
    UpdateBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      verificationStatus: user.verificationStatus,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.post("/bank/transfers", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateBankTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sender = await getOrCreateBankUser(userId);
  if (sender.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  if (!sender.acceptedTermsAt) {
    res.status(409).json({ error: "Complete account setup before sending money." });
    return;
  }
  const existing = await getTransactionByIdempotencyKey(
    parsed.data.idempotencyKey,
  );
  if (existing) {
    if (existing.initiatedByUserId !== userId) {
      res.status(409).json({ error: "That request reference is already in use." });
      return;
    }
    res.status(201).json(
      CreateBankTransferResponse.parse(toBankTransaction(existing, userId)),
    );
    return;
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Enter a valid transfer amount.",
    });
    return;
  }

  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The transfer amount must be greater than zero." });
    return;
  }

  const normalizedEmail = parsed.data.recipientEmail.trim().toLowerCase();
  if (normalizedEmail === sender.email.toLowerCase()) {
    res.status(400).json({ error: "Choose another registered Globus user." });
    return;
  }

  const recipient = await db
    .select()
    .from(bankUsersTable)
    .where(sql`lower(${bankUsersTable.email}) = ${normalizedEmail}`)
    .limit(1);
  const receiver = recipient[0];
  if (!receiver || receiver.accountStatus !== "active") {
    res.status(404).json({
      error: "No active Globus account was found for that email address.",
    });
    return;
  }
  if (!receiver.acceptedTermsAt) {
    res.status(409).json({
      error: "The recipient has not completed their Globus account setup.",
    });
    return;
  }

  const transfer = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const duplicate = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
      .limit(1);
    if (duplicate[0]) {
      return duplicate[0].initiatedByUserId === userId
        ? { transaction: duplicate[0] }
        : { error: "That request reference is already in use." };
    }

    const senderWallet = await userWallet(tx, userId, parsed.data.currency);
    const receiverWallet = await userWallet(
      tx,
      receiver.id,
      parsed.data.currency,
    );
    if (!senderWallet || !receiverWallet) {
      return { error: "A wallet for the selected currency is unavailable." };
    }

    await tx
      .select({ id: bankWalletsTable.id })
      .from(bankWalletsTable)
      .where(
        inArray(bankWalletsTable.id, [senderWallet.id, receiverWallet.id].sort()),
      )
      .orderBy(asc(bankWalletsTable.id))
      .for("update");

    const available = await balanceForWallet(tx, senderWallet.id);
    if (available < amountMinor) {
    return { error: "There are not enough simulated funds available." };
    }

    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values({
        reference: createReference(),
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        fromUserId: userId,
        toUserId: receiver.id,
        fromWalletId: senderWallet.id,
        toWalletId: receiverWallet.id,
        type: "transfer",
        status: "completed",
        currency: parsed.data.currency,
        amountMinor,
        feeMinor: 0n,
        counterparty: receiver.email,
        description: parsed.data.description?.trim() || "Simulated member transfer",
        mode: "simulation",
      })
      .returning();

    await tx.insert(bankLedgerEntriesTable).values([
      {
        transactionId: transaction.id,
        walletId: senderWallet.id,
        accountCode: `wallet:${senderWallet.id}`,
        currency: parsed.data.currency,
        side: "debit",
        amountMinor,
      },
      {
        transactionId: transaction.id,
        walletId: receiverWallet.id,
        accountCode: `wallet:${receiverWallet.id}`,
        currency: parsed.data.currency,
        side: "credit",
        amountMinor,
      },
    ]);

    return { transaction };
  });

  if ("error" in transfer) {
    res.status(409).json({ error: transfer.error });
    return;
  }

  res.status(201).json(
    CreateBankTransferResponse.parse(
      toBankTransaction(transfer.transaction, userId),
    ),
  );
});

router.post("/bank/external-transfers", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateExternalTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const recipientName = parsed.data.recipientName.trim();
  const destinationCountry = parsed.data.destinationCountry.trim();
  if (!recipientName || !destinationCountry) {
    res.status(400).json({ error: "Enter the recipient name and destination country." });
    return;
  }

  const sender = await getOrCreateBankUser(userId);
  if (sender.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  if (!sender.acceptedTermsAt) {
    res.status(409).json({ error: "Complete account setup before simulating a transfer." });
    return;
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter a valid transfer amount.",
    });
    return;
  }
  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The transfer amount must be greater than zero." });
    return;
  }

  const transfer = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const [duplicate] = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
      .limit(1);
    if (duplicate) {
      return duplicate.initiatedByUserId === userId
        ? { transaction: duplicate }
        : { error: "That request reference is already in use." };
    }

    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet) {
      return { error: "A wallet for the selected currency is unavailable." };
    }
    await tx
      .select({ id: bankWalletsTable.id })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.id, wallet.id))
      .for("update");

    if ((await balanceForWallet(tx, wallet.id)) < amountMinor) {
      return { error: "There are not enough simulated funds available." };
    }

    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values({
        reference: createReference(),
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        fromUserId: userId,
        fromWalletId: wallet.id,
        type: "external_transfer",
        status: "completed",
        currency: parsed.data.currency,
        amountMinor,
        feeMinor: 0n,
        counterparty: `${recipientName} · ${destinationCountry}`,
        description: parsed.data.description?.trim() || "Simulated external transfer",
        mode: "simulation",
      })
      .returning();

    await tx.insert(bankLedgerEntriesTable).values([
      {
        transactionId: transaction.id,
        walletId: wallet.id,
        accountCode: `wallet:${wallet.id}`,
        currency: parsed.data.currency,
        side: "debit",
        amountMinor,
      },
      {
        transactionId: transaction.id,
        accountCode: `simulation:external-clearing:${parsed.data.currency}`,
        currency: parsed.data.currency,
        side: "credit",
        amountMinor,
      },
    ]);

    return { transaction };
  });

  if ("error" in transfer) {
    res.status(409).json({ error: transfer.error });
    return;
  }

  res.status(201).json(
    CreateExternalTransferResponse.parse(
      toBankTransaction(transfer.transaction, userId),
    ),
  );
});

router.post("/bank/incoming-external-transfers", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateIncomingExternalTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sourceName = parsed.data.sourceName.trim();
  const sourceCountry = parsed.data.sourceCountry.trim();
  if (!sourceName || sourceCountry.length < 2) {
    res.status(400).json({ error: "Enter the source name and country." });
    return;
  }

  const user = await getOrCreateBankUser(userId);
  if (user.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  if (!user.acceptedTermsAt) {
    res.status(409).json({ error: "Complete account setup before simulating a transfer." });
    return;
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error: error instanceof Error ? error.message : "Enter a valid transfer amount.",
    });
    return;
  }
  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The transfer amount must be greater than zero." });
    return;
  }

  const transfer = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const [duplicate] = await tx
      .select()
      .from(bankTransactionsTable)
      .where(eq(bankTransactionsTable.idempotencyKey, parsed.data.idempotencyKey))
      .limit(1);
    if (duplicate) {
      return duplicate.initiatedByUserId === userId &&
        duplicate.type === "external_transfer_in"
        ? { transaction: duplicate }
        : { error: "That request reference is already in use." };
    }

    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet) {
      return { error: "A wallet for the selected currency is unavailable." };
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
        initiatedByUserId: userId,
        toUserId: userId,
        toWalletId: wallet.id,
        type: "external_transfer_in",
        status: "completed",
        currency: parsed.data.currency,
        amountMinor,
        feeMinor: 0n,
        counterparty: `${sourceName} · ${sourceCountry} (simulated source)`,
        description: parsed.data.description?.trim() || "Simulated incoming external transfer",
        mode: "simulation",
      })
      .returning();

    await tx.insert(bankLedgerEntriesTable).values([
      {
        transactionId: transaction.id,
        accountCode: `simulation:external-source:${parsed.data.currency}`,
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

    return { transaction };
  });

  if ("error" in transfer) {
    res.status(409).json({ error: transfer.error });
    return;
  }

  res.status(201).json(
    CreateIncomingExternalTransferResponse.parse(
      toBankTransaction(transfer.transaction, userId),
    ),
  );
});

router.post("/bank/simulation-requests", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateSimulationRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getOrCreateBankUser(userId);
  if (user.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  if (!user.acceptedTermsAt) {
    res.status(409).json({ error: "Complete account setup before continuing." });
    return;
  }

  if (
    parsed.data.type === "exchange" &&
    (!parsed.data.destinationCurrency ||
      parsed.data.destinationCurrency === parsed.data.currency)
  ) {
    res.status(400).json({
      error: "Choose a different destination currency for the simulated quote.",
    });
    return;
  }

  let amountMinor: bigint;
  try {
    amountMinor = parseAmountToMinor(parsed.data.amount);
  } catch (error) {
    res.status(400).json({
      error:
        error instanceof Error ? error.message : "Enter a valid amount.",
    });
    return;
  }

  if (amountMinor <= 0n) {
    res.status(400).json({ error: "The amount must be greater than zero." });
    return;
  }

  const existing = await db
    .select()
    .from(bankSandboxRequestsTable)
    .where(eq(bankSandboxRequestsTable.idempotencyKey, parsed.data.idempotencyKey))
    .limit(1);

  if (existing[0]) {
    if (existing[0].userId !== userId) {
      res.status(409).json({ error: "That request reference is already in use." });
      return;
    }
    res.status(201).json(
      CreateSimulationRequestResponse.parse({
        id: existing[0].id,
        reference: existing[0].reference,
        type: existing[0].type,
        currency: existing[0].currency,
        destinationCurrency: existing[0].destinationCurrency,
        amount: formatMinorAmount(existing[0].amountMinor),
        status: existing[0].status,
        message:
          "This simulated request is recorded only. No provider is connected and no funds move.",
        createdAt: existing[0].createdAt.toISOString(),
      }),
    );
    return;
  }

  const request = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${parsed.data.idempotencyKey})::bigint)`,
    );
    const [duplicate] = await tx
      .select()
      .from(bankSandboxRequestsTable)
      .where(
        eq(bankSandboxRequestsTable.idempotencyKey, parsed.data.idempotencyKey),
      )
      .limit(1);

    if (duplicate) {
      return duplicate.userId === userId
        ? { sandboxRequest: duplicate }
        : { error: "That request reference is already in use." };
    }

    const reference = createReference();
    const transactionType = `${parsed.data.type}_request` as
      | "deposit_request"
      | "withdrawal_request"
      | "exchange_request";
    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values({
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        fromUserId: userId,
        type: transactionType,
        status: "pending",
        currency: parsed.data.currency,
        amountMinor,
        counterparty: null,
        description: `${parsed.data.type} request awaiting provider setup`,
        mode: "simulation",
      })
      .returning();

    const [sandboxRequest] = await tx
      .insert(bankSandboxRequestsTable)
      .values({
        userId,
        transactionId: transaction.id,
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        type: parsed.data.type,
        currency: parsed.data.currency,
        destinationCurrency: parsed.data.destinationCurrency ?? null,
        amountMinor,
      })
      .returning();

    return { sandboxRequest, transaction };
  });

  if ("error" in request) {
    res.status(409).json({ error: request.error });
    return;
  }

  res.status(201).json(
    CreateSimulationRequestResponse.parse({
      id: request.sandboxRequest.id,
      reference: request.sandboxRequest.reference,
      type: request.sandboxRequest.type,
      currency: request.sandboxRequest.currency,
      destinationCurrency: request.sandboxRequest.destinationCurrency,
      amount: formatMinorAmount(request.sandboxRequest.amountMinor),
      status: request.sandboxRequest.status,
      message:
        "This simulated request is recorded only. No provider is connected and no funds move.",
      createdAt: request.sandboxRequest.createdAt.toISOString(),
    }),
  );
});

export default router;
