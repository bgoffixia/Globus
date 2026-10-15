import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { getAuth } from "@clerk/express";
import { and, asc, count, desc, eq, inArray, sql } from "drizzle-orm";
import {
  CreateBankTransferBody,
  CreateBankTransferResponse,
  CreateIdentityDocumentUploadUrlBody,
  CreateIdentityDocumentUploadUrlResponse,
  CreateExternalTransferBody,
  CreateExternalTransferResponse,
  CreateIncomingExternalTransferBody,
  CreateLedgerRequestBody,
  CompleteIdentityDocumentUploadParams,
  CompleteIdentityDocumentUploadResponse,
  DeleteMyIdentityDocumentParams,
  DeleteMyIdentityDocumentResponse,
  CreateIncomingExternalTransferResponse,
  CreateLedgerRequestResponse,
  GetBankDashboardResponse,
  GetBankProfileResponse,
  ListMyIdentityDocumentsResponse,
  ListBankTransactionsQueryParams,
  ListBankTransactionsResponse,
  ListBankWalletsResponse,
  SubmitIdentityDocumentsBody,
  SubmitIdentityDocumentsResponse,
  UpdateBankProfileBody,
  UpdateBankProfileResponse,
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
  formatMinorAmount,
  getRecentTransactions,
  getTransactionByIdempotencyKey,
  getWalletsForUser,
  listUserTransactions,
  parseAmountToMinor,
  reservedForWallet,
  toBankTransaction,
  userWallet,
} from "../lib/bank";
import {
  createIdentityDocumentUploadUrl,
  deleteIdentityDocumentObject,
  getIdentityDocumentFile,
  sealIdentityDocumentUpload,
  validateUploadedIdentityDocument,
} from "../lib/identityDocumentStorage";

const router: IRouter = Router();

function rejectExternalTransfer(res: Response, kind: "deposit" | "payout"): boolean {
  res.status(410).json({
    error:
      kind === "deposit"
        ? "External deposits are not available. Submit an internal ledger deposit request instead."
        : "External payouts are not available. Submit a ledger withdrawal request instead.",
  });
  return true;
}

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

function identityDocumentResponse(document: typeof bankIdentityDocumentsTable.$inferSelect) {
  return {
    id: document.id,
    contentType: document.contentType as "application/pdf" | "image/jpeg" | "image/png",
    sizeBytes: document.sizeBytes,
    status: document.status as "uploading" | "uploaded",
    createdAt: document.createdAt.toISOString(),
    uploadedAt: document.uploadedAt?.toISOString() ?? null,
  };
}

async function completeIdentityDocument(input: {
  userId: string;
  documentId: string;
  sealUpload: (uploadPath: string) => Promise<string>;
}) {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select()
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, input.userId))
      .for("update");
    const [document] = await tx
      .select()
      .from(bankIdentityDocumentsTable)
      .where(
        and(
          eq(bankIdentityDocumentsTable.id, input.documentId),
          eq(bankIdentityDocumentsTable.userId, input.userId),
        ),
      )
      .for("update");
    if (!user || !document) {
      return { notFound: true as const };
    }
    if (user.verificationStatus === "approved" || user.verificationStatus === "pending") {
      return { error: "Documents cannot be changed while verification is pending or approved." };
    }
    if (document.status === "uploaded") {
      return { document, uploadObjectPath: null };
    }
    const sealedPath = await input.sealUpload(document.objectPath);
    const [updated] = await tx
      .update(bankIdentityDocumentsTable)
      .set({
        objectPath: sealedPath,
        status: "uploaded",
        uploadedAt: new Date(),
      })
      .where(eq(bankIdentityDocumentsTable.id, document.id))
      .returning();
    await tx.insert(bankAuditLogsTable).values({
      actorUserId: input.userId,
      targetUserId: input.userId,
      action: "upload_identity_document",
      reason: "Member uploaded an identity document for review.",
    });
    return { document: updated, uploadObjectPath: document.objectPath };
  });
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
      dateOfBirth: user.dateOfBirth,
      verificationStatus: user.verificationStatus,
      verificationNote: user.verificationNote,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.get("/bank/dashboard", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const profile = await getOrCreateBankUser(authUserId);
  const [wallets, recentTransactions] = await Promise.all([
    getWalletsForUser(profile.id),
    getRecentTransactions(profile.id),
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
        dateOfBirth: profile.dateOfBirth,
        verificationStatus: profile.verificationStatus,
        verificationNote: profile.verificationNote,
        accountStatus: profile.accountStatus,
        createdAt: profile.createdAt.toISOString(),
      },
      wallets,
      recentTransactions,
      referenceCurrency: "USD",
      internalLedger: true,
    }),
  );
});

router.get("/bank/wallets", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  res.json(ListBankWalletsResponse.parse(await getWalletsForUser(user.id)));
});

router.get("/bank/transactions", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  const parsed = ListBankTransactionsQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const transactions = await listUserTransactions(user.id, {
    currency: parsed.data.currency,
    status: parsed.data.status,
    search: parsed.data.search,
    limit: parsed.data.limit ?? 25,
  });

  res.json(ListBankTransactionsResponse.parse(transactions));
});

router.put("/bank/profile", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = UpdateBankProfileBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  if (
    parsed.data.dateOfBirth &&
    (!Number.isFinite(Date.parse(`${parsed.data.dateOfBirth}T00:00:00.000Z`)) ||
      new Date(`${parsed.data.dateOfBirth}T00:00:00.000Z`)
        .toISOString()
        .slice(0, 10) !== parsed.data.dateOfBirth ||
      parsed.data.dateOfBirth > new Date().toISOString().slice(0, 10))
  ) {
    res.status(400).json({ error: "Enter a valid date of birth that is not in the future." });
    return;
  }

  const currentUser = await getOrCreateBankUser(authUserId);
  const [user] = await db
    .update(bankUsersTable)
    .set({
      firstName: parsed.data.firstName.trim(),
      lastName: parsed.data.lastName.trim() || null,
      phone: parsed.data.phone.trim(),
      country: parsed.data.country.trim(),
      ...(parsed.data.dateOfBirth
        ? { dateOfBirth: parsed.data.dateOfBirth }
        : {}),
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
      dateOfBirth: user.dateOfBirth,
      verificationStatus: user.verificationStatus,
      verificationNote: user.verificationNote,
      accountStatus: user.accountStatus,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.get("/bank/verification/documents", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const documents = await db
    .select()
    .from(bankIdentityDocumentsTable)
    .where(eq(bankIdentityDocumentsTable.userId, user.id))
    .orderBy(desc(bankIdentityDocumentsTable.createdAt));
  res.json(
    ListMyIdentityDocumentsResponse.parse(
      documents.map(identityDocumentResponse),
    ),
  );
});

router.post(
  "/bank/verification/documents/upload-url",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = CreateIdentityDocumentUploadUrlBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const account = await getOrCreateBankUser(authUserId);

    let upload: { uploadUrl: string; objectPath: string };
    try {
      upload = await createIdentityDocumentUploadUrl();
    } catch (error) {
      req.log.error({ err: error }, "Could not create identity document upload URL");
      res.status(503).json({ error: "Private document storage is unavailable." });
      return;
    }

    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, account.id))
        .for("update");
      if (!user) {
        return { notFound: true as const };
      }
      if (user.verificationStatus === "approved" || user.verificationStatus === "pending") {
        return { error: "Documents cannot be changed while verification is pending or approved." };
      }
      const [documentCount] = await tx
        .select({ value: count() })
        .from(bankIdentityDocumentsTable)
        .where(eq(bankIdentityDocumentsTable.userId, user.id));
      if ((documentCount?.value ?? 0) >= 5) {
        return { error: "Remove an existing document before uploading another. You can upload up to five." };
      }
      const [document] = await tx
        .insert(bankIdentityDocumentsTable)
        .values({
          userId: user.id,
          objectPath: upload.objectPath,
          contentType: parsed.data.contentType,
          sizeBytes: parsed.data.sizeBytes,
          status: "uploading",
        })
        .returning();
      return { document };
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
      CreateIdentityDocumentUploadUrlResponse.parse({
        documentId: result.document.id,
        uploadUrl: upload.uploadUrl,
      }),
    );
  },
);

router.post(
  "/bank/verification/documents/:documentId/complete",
  async (req, res): Promise<void> => {
    const params = CompleteIdentityDocumentUploadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [document] = await db
      .select()
      .from(bankIdentityDocumentsTable)
      .where(
        and(
          eq(bankIdentityDocumentsTable.id, params.data.documentId),
          eq(bankIdentityDocumentsTable.userId, user.id),
        ),
      )
      .limit(1);
    if (!document) {
      res.status(404).json({ error: "Identity document not found." });
      return;
    }
    if (document.status === "uploaded") {
      res.json(CompleteIdentityDocumentUploadResponse.parse(identityDocumentResponse(document)));
      return;
    }

    if (user.verificationStatus === "approved" || user.verificationStatus === "pending") {
      res.status(409).json({ error: "Documents cannot be changed while verification is pending or approved." });
      return;
    }
    let valid = false;
    try {
      valid = await validateUploadedIdentityDocument(
        getIdentityDocumentFile(document.objectPath),
        document.contentType,
        document.sizeBytes,
      );
    } catch (error) {
      req.log.warn({ err: error }, "Identity document upload is not available for validation");
    }
    if (!valid) {
      try {
        await deleteIdentityDocumentObject(document.objectPath);
        await db
          .delete(bankIdentityDocumentsTable)
          .where(
            and(
              eq(bankIdentityDocumentsTable.id, document.id),
              eq(bankIdentityDocumentsTable.userId, user.id),
              eq(bankIdentityDocumentsTable.status, "uploading"),
            ),
          );
      } catch (error) {
        req.log.warn({ err: error }, "Invalid identity upload could not be cleaned up");
      }
      res.status(409).json({
        error: "The upload is missing, incomplete, or does not match the selected PDF, JPG, or PNG file type.",
      });
      return;
    }

    let sealedObjectPath: string | null = null;
    let result: Awaited<ReturnType<typeof completeIdentityDocument>>;
    try {
      result = await completeIdentityDocument({
        userId: user.id,
        documentId: document.id,
        sealUpload: async (uploadPath) => {
          sealedObjectPath = await sealIdentityDocumentUpload(uploadPath);
          return sealedObjectPath;
        },
      });
    } catch (error) {
      if (sealedObjectPath) {
        await deleteIdentityDocumentObject(sealedObjectPath).catch(() => undefined);
      }
      req.log.error({ err: error }, "Could not finalize a private identity document");
      res.status(503).json({ error: "The document could not be finalized. Please try again." });
      return;
    }

    if ("notFound" in result) {
      res.status(404).json({ error: "Identity document not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    if (result.uploadObjectPath) {
      try {
        await deleteIdentityDocumentObject(result.uploadObjectPath);
      } catch (error) {
        req.log.warn({ err: error }, "Temporary identity upload could not be removed");
      }
    }
    res.json(
      CompleteIdentityDocumentUploadResponse.parse(
        identityDocumentResponse(result.document),
      ),
    );
  },
);

router.delete(
  "/bank/verification/documents/:documentId",
  async (req, res): Promise<void> => {
    const params = DeleteMyIdentityDocumentParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const profile = await getOrCreateBankUser(authUserId);
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, profile.id))
        .for("update");
      const [document] = await tx
        .select()
        .from(bankIdentityDocumentsTable)
        .where(
          and(
            eq(bankIdentityDocumentsTable.id, params.data.documentId),
            eq(bankIdentityDocumentsTable.userId, profile.id),
          ),
        )
        .for("update");
      if (!user || !document) {
        return { notFound: true as const };
      }
      if (user.verificationStatus === "pending" || user.verificationStatus === "approved") {
        return { error: "Documents cannot be removed while verification is pending or approved." };
      }
      try {
        await deleteIdentityDocumentObject(document.objectPath);
      } catch (error) {
        req.log.error({ err: error }, "Could not remove identity document");
        return { error: "The document could not be removed from private storage." };
      }
      await tx
        .delete(bankIdentityDocumentsTable)
        .where(eq(bankIdentityDocumentsTable.id, document.id));
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: profile.id,
        targetUserId: profile.id,
        action: "remove_identity_document",
        reason: "Member removed an identity document before review.",
      });
      return { deleted: true as const };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Identity document not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.status(204).send();
    DeleteMyIdentityDocumentResponse.parse(undefined);
  },
);

router.post(
  "/bank/verification/submit",
  async (req, res): Promise<void> => {
    const parsed = SubmitIdentityDocumentsBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const profile = await getOrCreateBankUser(authUserId);
    const result = await db.transaction(async (tx) => {
      const [user] = await tx
        .select()
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, profile.id))
        .for("update");
      if (!user) {
        return { notFound: true as const };
      }
      if (user.verificationStatus === "pending" || user.verificationStatus === "approved") {
        return { error: "This verification is already pending or approved." };
      }
      const documents = await tx
        .select({ status: bankIdentityDocumentsTable.status })
        .from(bankIdentityDocumentsTable)
        .where(eq(bankIdentityDocumentsTable.userId, user.id));
      if (documents.some((document) => document.status === "uploading")) {
        return { error: "Finish or remove each in-progress upload before submitting for review." };
      }
      const uploadedCount = documents.filter((document) => document.status === "uploaded").length;
      if (uploadedCount === 0) {
        return { error: "Upload at least one identity document before submitting." };
      }
      const [updated] = await tx
        .update(bankUsersTable)
        .set({
          verificationStatus: "pending",
          verificationNote: null,
          updatedAt: new Date(),
        })
        .where(eq(bankUsersTable.id, profile.id))
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: profile.id,
        targetUserId: profile.id,
        action: "submit_identity_documents",
        reason: `Member submitted ${uploadedCount} identity document(s) for review.`,
      });
      return { user: updated };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "User record not found." });
      return;
    }
    if ("error" in result) {
      res.status(409).json({ error: result.error });
      return;
    }
    res.json(
      SubmitIdentityDocumentsResponse.parse({
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        phone: result.user.phone,
        country: result.user.country,
        verificationStatus: result.user.verificationStatus,
        verificationNote: result.user.verificationNote,
        accountStatus: result.user.accountStatus,
        createdAt: result.user.createdAt.toISOString(),
      }),
    );
  },
);

router.post("/bank/transfers", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateBankTransferBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sender = await getOrCreateBankUser(authUserId);
  const userId = sender.id;
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
    const reserved = await reservedForWallet(tx, senderWallet.id);
    if (available - reserved < amountMinor) {
      return { error: "There is not enough available ledger balance." };
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
        description: parsed.data.description?.trim() || "Internal member transfer",
        mode: "internal_ledger",
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
  if (rejectExternalTransfer(res, "payout")) return;
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
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
  const bankName = parsed.data.bankName.trim();
  const accountNumberLast4 = parsed.data.accountNumberLast4.trim().toUpperCase();
  if (
    !recipientName ||
    !destinationCountry ||
    !bankName ||
    !/^[A-Z0-9]{4}$/.test(accountNumberLast4)
  ) {
    res.status(400).json({
      error: "Enter the recipient, destination country, bank name, and last four account characters.",
    });
    return;
  }

  const sender = await getOrCreateBankUser(authUserId);
  const userId = sender.id;
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
        counterparty: `${recipientName} · ${bankName} · ****${accountNumberLast4} · ${destinationCountry}`,
        description: parsed.data.description?.trim() || "Simulated external transfer",
        mode: "internal_ledger",
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
  if (rejectExternalTransfer(res, "deposit")) return;
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
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

  const user = await getOrCreateBankUser(authUserId);
  const userId = user.id;
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
        mode: "internal_ledger",
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

router.post("/bank/ledger-requests", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const parsed = CreateLedgerRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const user = await getOrCreateBankUser(authUserId);
  const userId = user.id;
  if (user.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  if (!user.acceptedTermsAt) {
    res.status(409).json({ error: "Complete account setup before continuing." });
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
  if (amountMinor > 100_000_000n) {
    res.status(400).json({ error: "Requests cannot exceed 1,000,000.00." });
    return;
  }

  const existing = await db
    .select()
    .from(bankSandboxRequestsTable)
    .where(eq(bankSandboxRequestsTable.idempotencyKey, parsed.data.idempotencyKey))
    .limit(1);

  if (existing[0]) {
    if (
      existing[0].userId !== userId ||
      existing[0].type !== parsed.data.type ||
      existing[0].currency !== parsed.data.currency ||
      existing[0].amountMinor !== amountMinor
    ) {
      res.status(409).json({ error: "That request reference is already in use." });
      return;
    }
    const existingStatus =
      existing[0].status === "approved" || existing[0].status === "rejected"
        ? existing[0].status
        : "pending_review";
    res.status(201).json(
      CreateLedgerRequestResponse.parse({
        id: existing[0].id,
        reference: existing[0].reference,
        type: existing[0].type,
        currency: existing[0].currency,
        amount: formatMinorAmount(existing[0].amountMinor),
        status: existingStatus,
        message:
          existingStatus === "pending_review"
            ? "Your request is waiting for an administrator to review it."
            : `Your request was ${existingStatus}.`,
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
    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet || wallet.status !== "active") {
      return { error: "An active wallet for the selected currency is unavailable." };
    }
    await tx
      .select({ id: bankWalletsTable.id })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.id, wallet.id))
      .for("update");
    if (parsed.data.type === "withdrawal") {
      const balance = await balanceForWallet(tx, wallet.id);
      const reserved = await reservedForWallet(tx, wallet.id);
      if (balance - reserved < amountMinor) {
        return {
          error: "The available ledger balance is not enough for this withdrawal request.",
        };
      }
    }
    const transactionType =
      parsed.data.type === "deposit" ? "deposit_request" : "withdrawal_request";
    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values({
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: userId,
        fromUserId: userId,
        fromWalletId:
          parsed.data.type === "withdrawal" ? wallet.id : null,
        toWalletId: parsed.data.type === "deposit" ? wallet.id : null,
        type: transactionType,
        status: "pending",
        currency: parsed.data.currency,
        amountMinor,
        counterparty: null,
        description:
          parsed.data.description?.trim() ||
          `${parsed.data.type === "deposit" ? "Deposit" : "Withdrawal"} request awaiting administrator review`,
        mode: "internal_ledger",
      })
      .returning();

    const [sandboxRequest] = await tx
      .insert(bankSandboxRequestsTable)
      .values({
          userId: user.id,
        transactionId: transaction.id,
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        type: parsed.data.type,
        currency: parsed.data.currency,
        destinationCurrency: null,
        amountMinor,
        status: "pending_review",
      })
      .returning();

    return { sandboxRequest, transaction };
  });

  if ("error" in request) {
    res.status(409).json({ error: request.error });
    return;
  }

  res.status(201).json(
    CreateLedgerRequestResponse.parse({
      id: request.sandboxRequest.id,
      reference: request.sandboxRequest.reference,
      type: request.sandboxRequest.type,
      currency: request.sandboxRequest.currency,
      amount: formatMinorAmount(request.sandboxRequest.amountMinor),
      status: "pending_review",
      message:
        parsed.data.type === "deposit"
          ? "Your request is waiting for admin approval. Approval posts an internal ledger credit; no outside funds are received."
          : "Your available ledger balance is reserved while an administrator reviews this request. Approval posts a ledger debit; no outside payout is made.",
      createdAt: request.sandboxRequest.createdAt.toISOString(),
    }),
  );
});

export default router;
