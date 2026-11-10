import { Router, type IRouter, type RequestHandler, type Response } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  DeleteBankPushSubscriptionParams,
  DeleteBankPushSubscriptionResponse,
  CreateBankSavedPaymentMethodBody,
  CreateBankSavedPaymentMethodResponse,
  CompleteRequiredPasswordResetBody,
  CompleteRequiredPasswordResetResponse,
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
  DeleteBankSavedPaymentMethodParams,
  DeleteBankSavedPaymentMethodResponse,
  CreateIncomingExternalTransferResponse,
  CreateInternationalTransferRequestBody,
  CreateInternationalTransferRequestResponse,
  CreateLedgerRequestResponse,
  GetBankDashboardResponse,
  GetBankExchangeRateQuoteQueryParams,
  GetBankExchangeRateQuoteResponse,
  GetBankProfileResponse,
  GetBankPushConfigResponse,
  GetBankVaultStatusResponse,
  InitializeBankVaultPasscodeBody,
  InitializeBankVaultPasscodeResponse,
  ListBankNotificationsResponse,
  ListBankVaultWalletControlsHeader,
  ListBankVaultWalletControlsResponse,
  ListBankExchangeRatesResponse,
  ListInternationalTransferRequestsResponse,
  ListMyIdentityDocumentsResponse,
  ListBankTransactionsQueryParams,
  ListBankTransactionsResponse,
  ListBankWalletsResponse,
  ListBankSavedPaymentMethodsResponse,
  LookupCustomerIdBody,
  LookupCustomerIdResponse,
  SubmitIdentityDocumentsBody,
  SubmitIdentityDocumentsResponse,
  UpdateTransactionPinBody,
  UpdateTransactionPinResponse,
  UpdateBankProfileBody,
  UpdateBankProfileResponse,
  UpdateBankVaultPasscodeBody,
  UpdateBankVaultPasscodeHeader,
  UpdateBankVaultPasscodeResponse,
  UpdateBankVaultWalletControlBody,
  UpdateBankVaultWalletControlHeader,
  UpdateBankVaultWalletControlParams,
  UpdateBankVaultWalletControlResponse,
  UnlockBankVaultBody,
  UnlockBankVaultResponse,
  MarkBankNotificationReadParams,
  MarkBankNotificationReadResponse,
  SaveBankPushSubscriptionBody,
  SaveBankPushSubscriptionResponse,
} from "@workspace/api-zod";
import {
  bankAuditLogsTable,
  bankAdminSettingsTable,
  bankNotificationsTable,
  bankPushSubscriptionsTable,
  bankExchangeRatesTable,
  bankIdentityDocumentsTable,
  bankInternationalTransferRequestsTable,
  bankLedgerEntriesTable,
  bankSandboxRequestsTable,
  bankTransactionsTable,
  bankUsersTable,
  bankSavedPaymentMethodsTable,
  bankWalletsTable,
  db,
} from "@workspace/db";
import {
  balanceForWallet,
  bankOperationRestrictionError,
  convertMinorAmount,
  createReference,
  ensureBankUser,
  formatMinorAmount,
  conversionRatesMatch,
  getEffectiveBankAccountStatus,
  getBankOperationEligibility,
  getRecentTransactions,
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
import {
  updateTransactionPin as saveTransactionPin,
  verifyTransactionPin,
  type TransactionPinResult,
} from "../lib/transaction-pin";
import {
  BankDetailsEncryptionUnavailableError,
  encryptBankAccountNumber,
  normalizeBankAccountNumber,
} from "../lib/sensitive-bank-details";
import {
  isPasswordResetRequired,
  setPasswordResetCache,
} from "../lib/password-reset";
import {
  initializeVaultPasscode,
  isVaultSessionActive,
  unlockVault,
  updateVaultPasscode,
} from "../lib/bank-vault";
import { decryptPrivateData, encryptPrivateData } from "../lib/private-data";
import {
  notificationResponse,
  WebpushrSubscriberAlreadyLinkedError,
  getPushConfig,
  notifyTransferRecipient,
  savePushSubscription,
  sendPushToUser,
  storeNotification,
} from "../lib/transfer-notifications";

const router: IRouter = Router();
const DEFAULT_UNVERIFIED_DASHBOARD_MESSAGE =
  "Your identity verification is not complete. Submit a request for review to access eligible account features.";
const customerIdLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Unable to verify those details. Try again later." },
});
const exchangeRateQuoteLimiter = rateLimit({
  windowMs: 60_000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Rate quotes are temporarily limited. Please try again shortly." },
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many password updates. Try again later." },
});
const vaultAttemptLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 12,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many vault attempts. Try again later." },
});
const transferSubmissionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many transfer submissions. Try again later." },
});
const pushSubscriptionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Too many notification setup attempts. Try again later." },
});

type FrankfurterRateReply = {
  date?: unknown;
  base?: unknown;
  quote?: unknown;
  rate?: unknown;
};
type GreyRateReply = {
  status?: unknown;
  data?: {
    source_currency?: unknown;
    destination_currency?: unknown;
    source_destination_currency_rate?: unknown;
  } | null;
};
type CachedExchangeRate = {
  rate: string;
  provider: "Frankfurter" | "Grey";
  checkedAt: Date;
  expiresAt: number;
};
const exchangeRateCache = new Map<string, CachedExchangeRate>();
const exchangeRateLoads = new Map<string, Promise<CachedExchangeRate>>();
const EXCHANGE_RATE_CACHE_MS = 15 * 60 * 1000;
async function fetchFrankfurterExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
): Promise<CachedExchangeRate> {
  const response = await fetch(
    `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(sourceCurrency)}/${encodeURIComponent(destinationCurrency)}`,
    { signal: AbortSignal.timeout(10_000) },
  );
  if (!response.ok) throw new Error("Frankfurter rate provider returned an error.");

  const payload = (await response.json()) as FrankfurterRateReply;
  const numericRate = typeof payload.rate === "number" ? payload.rate : Number(payload.rate);
  if (
    payload.base !== sourceCurrency ||
    payload.quote !== destinationCurrency ||
    typeof payload.date !== "string" ||
    !Number.isFinite(Date.parse(payload.date)) ||
    !Number.isFinite(numericRate) ||
    numericRate <= 0
  ) {
    throw new Error("Frankfurter could not quote this currency pair.");
  }
  return {
    rate: numericRate.toFixed(10).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""),
    provider: "Frankfurter",
    checkedAt: new Date(),
    expiresAt: Date.now() + EXCHANGE_RATE_CACHE_MS,
  };
}

async function fetchGreyExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
): Promise<CachedExchangeRate> {
  const secretKey = process.env.GREY_API_SECRET_KEY;
  if (!secretKey) throw new Error("Grey rate fallback is not configured.");

  const response = await fetch("https://businessapi.grey.co/v1/currency/rate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source_amount: 1000,
      source_currency: sourceCurrency,
      destination_currency: destinationCurrency,
      transaction_type: "swap",
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("Grey rate provider returned an error.");

  const payload = (await response.json()) as GreyRateReply;
  const rawRate = payload.data?.source_destination_currency_rate;
  const numericRate = typeof rawRate === "number" ? rawRate : Number(rawRate);
  if (
    payload.status !== "success" ||
    !Number.isFinite(numericRate) ||
    numericRate <= 0 ||
    payload.data?.source_currency !== sourceCurrency ||
    payload.data?.destination_currency !== destinationCurrency
  ) {
    throw new Error("Grey could not quote this currency pair.");
  }
  return {
    rate: numericRate.toFixed(10).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, ""),
    provider: "Grey",
    checkedAt: new Date(),
    expiresAt: Date.now() + EXCHANGE_RATE_CACHE_MS,
  };
}

async function getExchangeRate(
  sourceCurrency: string,
  destinationCurrency: string,
): Promise<CachedExchangeRate> {
  const cacheKey = `${sourceCurrency}:${destinationCurrency}`;
  const cached = exchangeRateCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached;
  const inflight = exchangeRateLoads.get(cacheKey);
  if (inflight) return inflight;

  const request = (async () => {
    let frankfurterError: unknown;
    try {
      const result = await fetchFrankfurterExchangeRate(sourceCurrency, destinationCurrency);
      exchangeRateCache.set(cacheKey, result);
      return result;
    } catch (error) {
      frankfurterError = error;
    }
    try {
      const result = await fetchGreyExchangeRate(sourceCurrency, destinationCurrency);
      exchangeRateCache.set(cacheKey, result);
      return result;
    } catch (greyError) {
      throw new AggregateError(
        [frankfurterError, greyError],
        "Neither exchange-rate source could quote this currency pair.",
      );
    }
  })();
  exchangeRateLoads.set(cacheKey, request);
  try {
    return await request;
  } finally {
    exchangeRateLoads.delete(cacheKey);
  }
}

function rejectExternalTransfer(res: Response, kind: "deposit" | "payout"): boolean {
  res.status(410).json({
    error:
      kind === "deposit"
        ? "External deposits are not available. Submit an internal ledger deposit request instead."
        : "External payouts are not available. Submit a ledger withdrawal request instead.",
  });
  return true;
}

function respondWithTransactionPinError(
  res: Response,
  result: Exclude<TransactionPinResult, "valid">,
): void {
  if (result === "not_configured") {
    res.status(409).json({
      error: "Set a 6-digit transaction PIN in Settings before making transactions.",
    });
    return;
  }
  if (result === "locked") {
    res.status(429).json({
      error: "Too many incorrect PIN attempts. Try again in 15 minutes.",
    });
    return;
  }
  if (result === "invalid") {
    res.status(403).json({ error: "The transaction PIN is incorrect." });
    return;
  }
  res.status(404).json({ error: "The account for this transaction was not found." });
}

const requireSignedIn: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  if (req.originalUrl.split("?")[0] === "/bank/me/password-reset/complete") {
    next();
    return;
  }
  try {
    if (await isPasswordResetRequired(userId)) {
      res.status(423).json({
        error: "Update your password before accessing your Globus account.",
      });
      return;
    }
  } catch {
    res.status(503).json({
      error: "Account security could not be verified right now.",
    });
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

function internationalTransferRequestResponse(
  request: typeof bankInternationalTransferRequestsTable.$inferSelect,
  transaction: typeof bankTransactionsTable.$inferSelect,
) {
  let recipientEmail: string | null = null;
  if (request.recipientEmailEncrypted) {
    try {
      recipientEmail = decryptPrivateData(
        request.recipientEmailEncrypted,
        "transfer-recipient-email",
      );
    } catch {
      recipientEmail = null;
    }
  }
  return {
    id: transaction.id,
    reference: transaction.reference,
    status: transaction.status,
    transferType: request.transferType as "local_routing" | "international_wire",
    destinationCountry: request.destinationCountry,
    recipientBank: request.recipientBank,
    routingCode: request.routingCode,
    swiftBic: request.swiftBic,
    recipientAccountName: request.recipientAccountName,
    recipientEmail,
    recipientAccountLast4: request.recipientAccountLast4,
    sourceCurrency: request.sourceCurrency,
    sourceAmount: formatMinorAmount(request.sourceAmountMinor),
    destinationCurrency: request.destinationCurrency,
    destinationAmount: formatMinorAmount(request.destinationAmountMinor, request.destinationCurrency),
    exchangeRate: request.exchangeRate,
    rateUpdatedAt: request.rateUpdatedAt.toISOString(),
    remark: request.remark,
    createdAt: request.createdAt.toISOString(),
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

router.post(
  "/bank/customer-id/lookup",
  customerIdLookupLimiter,
  async (req, res): Promise<void> => {
    const parsed = LookupCustomerIdBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: "Enter a valid seven-character Customer ID." });
      return;
    }

    const [user] = await db
      .select({ email: bankUsersTable.email })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.customerId, parsed.data.customerId.toUpperCase()))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "Customer ID or password could not be verified." });
      return;
    }

    res.setHeader("Cache-Control", "no-store");
    res.json(LookupCustomerIdResponse.parse({ email: user.email }));
  },
);

router.use("/bank", requireSignedIn);

router.post("/bank/me/password-reset/complete", passwordResetLimiter, async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = CompleteRequiredPasswordResetBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  let identity;
  try {
    identity = await clerkClient.users.getUser(userId);
  } catch {
    res.status(404).json({ error: "The account could not be verified." });
    return;
  }
  const resetRequiredAt = identity.publicMetadata?.globusPasswordResetRequiredAt;
  if (typeof resetRequiredAt !== "string" || !resetRequiredAt) {
    res.json(CompleteRequiredPasswordResetResponse.parse({ completed: false }));
    return;
  }

  try {
    await clerkClient.users.updateUser(userId, {
      password: parsed.data.newPassword,
      signOutOfOtherSessions: true,
    });
    await clerkClient.users.updateUserMetadata(userId, {
      publicMetadata: { globusPasswordResetRequiredAt: null },
    });
    setPasswordResetCache(userId, false);
  } catch {
    res.status(400).json({
      error: "The new password could not be saved. Choose a different password and try again.",
    });
    return;
  }

  res.json(CompleteRequiredPasswordResetResponse.parse({ completed: true }));
});

router.get("/bank/me", async (req, res): Promise<void> => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }

  const user = await getOrCreateBankUser(userId);
  const [accountStatus, operationEligibility] = await Promise.all([
    getEffectiveBankAccountStatus(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
      user.verificationStatus,
    ),
  ]);
  res.json(
    GetBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      customerId: user.customerId,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      dateOfBirth: user.dateOfBirth,
      transactionPinConfigured: !!user.transactionPinHash,
      verificationStatus: user.verificationStatus,
      verificationNote: user.verificationNote,
      accountStatus,
      ...operationEligibility,
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
  const verificationNoticePromise =
    profile.verificationStatus === "approved"
      ? Promise.resolve(null)
      : (async () => {
          await db
            .insert(bankAdminSettingsTable)
            .values({ id: "operations" })
            .onConflictDoNothing();
          const [settings] = await db
            .select({
              message: bankAdminSettingsTable.unverifiedDashboardMessage,
            })
            .from(bankAdminSettingsTable)
            .where(eq(bankAdminSettingsTable.id, "operations"))
            .limit(1);
          return settings?.message || DEFAULT_UNVERIFIED_DASHBOARD_MESSAGE;
        })();
  const [wallets, recentTransactions, accountStatus, operationEligibility, verificationNotice] = await Promise.all([
    getWalletsForUser(profile.id),
    getRecentTransactions(profile.id),
    getEffectiveBankAccountStatus(
      profile.id,
      profile.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      profile.id,
      profile.accountStatus as "active" | "restricted" | "suspended",
      profile.verificationStatus,
    ),
    verificationNoticePromise,
  ]);

  res.json(
    GetBankDashboardResponse.parse({
      profile: {
        id: profile.id,
        email: profile.email,
        customerId: profile.customerId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        phone: profile.phone,
        country: profile.country,
        dateOfBirth: profile.dateOfBirth,
        transactionPinConfigured: !!profile.transactionPinHash,
        verificationStatus: profile.verificationStatus,
        verificationNote: profile.verificationNote,
        accountStatus,
        ...operationEligibility,
        createdAt: profile.createdAt.toISOString(),
      },
      wallets,
      recentTransactions,
      referenceCurrency: "USD",
      internalLedger: true,
      verificationNotice,
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

router.get("/bank/saved-payment-methods", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const destinations = await db
    .select()
    .from(bankSavedPaymentMethodsTable)
    .where(
      and(
        eq(bankSavedPaymentMethodsTable.userId, user.id),
        isNull(bankSavedPaymentMethodsTable.deletedAt),
      ),
    )
    .orderBy(desc(bankSavedPaymentMethodsTable.createdAt))
    .limit(20);
  res.json(
    ListBankSavedPaymentMethodsResponse.parse(
      destinations.map((destination) => ({
        id: destination.id,
        method: destination.method,
        ...(destination.cardBrand ? { cardBrand: destination.cardBrand } : {}),
        ...(destination.bankName ? { bankName: destination.bankName } : {}),
        ...(destination.accountHolder
          ? { accountHolder: destination.accountHolder }
          : {}),
        ...(destination.country ? { country: destination.country } : {}),
        lastFour: destination.lastFour,
        createdAt: destination.createdAt.toISOString(),
      })),
    ),
  );
});

router.post(
  "/bank/saved-payment-methods",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = CreateBankSavedPaymentMethodBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (user.accountStatus !== "active" || !user.acceptedTermsAt) {
      res.status(409).json({ error: "Complete account setup before saving a payment method." });
      return;
    }
    if (user.verificationStatus !== "approved") {
      res.status(403).json({ error: "Complete identity verification before saving payment methods." });
      return;
    }

    const method = parsed.data.method;
    let lastFour = "";
    let accountNumberEncrypted: string | null = null;
    if (
      method === "bank_card" &&
      (!parsed.data.cardBrand ||
        !parsed.data.lastFour ||
        !/^[0-9]{4}$/.test(parsed.data.lastFour.trim()))
    ) {
      res.status(400).json({
        error: "Choose a card brand and enter only the card's last four digits.",
      });
      return;
    }
    if (method === "bank_card") {
      lastFour = parsed.data.lastFour!.trim();
    } else {
      if (
        !parsed.data.bankName?.trim() ||
        !parsed.data.accountHolder?.trim() ||
        !parsed.data.bankAccountNumber?.trim()
      ) {
        res.status(400).json({
          error: "Enter the bank, account holder, and full account number or IBAN.",
        });
        return;
      }
      let normalizedAccountNumber: string;
      try {
        normalizedAccountNumber = normalizeBankAccountNumber(
          parsed.data.bankAccountNumber,
        );
      } catch (error) {
        res.status(400).json({
          error:
            error instanceof Error
              ? error.message
              : "Enter a valid full bank account number or IBAN.",
        });
        return;
      }
      try {
        accountNumberEncrypted = encryptBankAccountNumber(
          normalizedAccountNumber,
        );
      } catch (error) {
        if (error instanceof BankDetailsEncryptionUnavailableError) {
          req.log.error({ error: error.message }, "Bank account encryption is unavailable");
          res.status(503).json({
            error: "Secure bank-account storage is temporarily unavailable.",
          });
          return;
        }
        throw error;
      }
      lastFour = normalizedAccountNumber.slice(-4);
    }
    const saved = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`saved-payment-methods:${user.id}`})::bigint)`,
      );
      const [activeCount] = await tx
        .select({ total: count() })
        .from(bankSavedPaymentMethodsTable)
        .where(
          and(
            eq(bankSavedPaymentMethodsTable.userId, user.id),
            isNull(bankSavedPaymentMethodsTable.deletedAt),
          ),
        );
      if ((activeCount?.total ?? 0) >= 10) return null;

      const [row] = await tx
        .insert(bankSavedPaymentMethodsTable)
        .values({
          userId: user.id,
          method,
          cardBrand: method === "bank_card" ? parsed.data.cardBrand ?? null : null,
          bankName:
            method === "bank_transfer" ? parsed.data.bankName?.trim() ?? null : null,
          accountHolder:
            method === "bank_transfer"
              ? parsed.data.accountHolder?.trim() ?? null
              : null,
          accountNumberEncrypted,
          country:
            method === "bank_transfer" ? parsed.data.country?.trim() || null : null,
          lastFour,
        })
        .returning();
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "save_payment_method",
        reason:
          method === "bank_card"
            ? `Member saved a masked card reference ending ${lastFour}.`
            : `Member saved an encrypted bank-account reference ending ${lastFour}.`,
      });
      return row;
    });
    if (!saved) {
      res.status(409).json({ error: "You can save up to 10 payment methods." });
      return;
    }

    res.status(201).json(
      CreateBankSavedPaymentMethodResponse.parse({
        id: saved.id,
        method: saved.method,
        ...(saved.cardBrand ? { cardBrand: saved.cardBrand } : {}),
        ...(saved.bankName ? { bankName: saved.bankName } : {}),
        ...(saved.accountHolder ? { accountHolder: saved.accountHolder } : {}),
        ...(saved.country ? { country: saved.country } : {}),
        lastFour: saved.lastFour,
        createdAt: saved.createdAt.toISOString(),
      }),
    );
  },
);

router.delete(
  "/bank/saved-payment-methods/:paymentMethodId",
  async (req, res): Promise<void> => {
    const params = DeleteBankSavedPaymentMethodParams.safeParse(req.params);
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
    const removed = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(bankSavedPaymentMethodsTable)
        .set({ deletedAt: new Date() })
        .where(
          and(
            eq(bankSavedPaymentMethodsTable.id, params.data.paymentMethodId),
            eq(bankSavedPaymentMethodsTable.userId, user.id),
            isNull(bankSavedPaymentMethodsTable.deletedAt),
          ),
        )
        .returning({
          id: bankSavedPaymentMethodsTable.id,
          lastFour: bankSavedPaymentMethodsTable.lastFour,
        });
      if (!row) return null;
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "remove_payment_method",
        reason: `Member removed a saved masked payment method ending ${row.lastFour}.`,
      });
      return row;
    });
    if (!removed) {
      res.status(404).json({ error: "Saved payment method not found." });
      return;
    }
    res.json(DeleteBankSavedPaymentMethodResponse.parse({ id: removed.id, deleted: true }));
  },
);

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

  const [accountStatus, operationEligibility] = await Promise.all([
    getEffectiveBankAccountStatus(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
    ),
    getBankOperationEligibility(
      user.id,
      user.accountStatus as "active" | "restricted" | "suspended",
      user.verificationStatus,
    ),
  ]);

  res.json(
    UpdateBankProfileResponse.parse({
      id: user.id,
      email: user.email,
      customerId: user.customerId,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      country: user.country,
      dateOfBirth: user.dateOfBirth,
      transactionPinConfigured: !!user.transactionPinHash,
      verificationStatus: user.verificationStatus,
      verificationNote: user.verificationNote,
      accountStatus,
      ...operationEligibility,
      createdAt: user.createdAt.toISOString(),
    }),
  );
});

router.put("/bank/transaction-pin", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = UpdateTransactionPinBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const result = await saveTransactionPin(
    user.id,
    parsed.data.pin,
    parsed.data.currentPin,
  );
  if (result === "updated") {
    res.json(UpdateTransactionPinResponse.parse({ configured: true }));
    return;
  }
  if (result === "current_pin_required") {
    res.status(400).json({ error: "Enter your current transaction PIN to change it." });
    return;
  }
  if (result === "locked") {
    res.status(429).json({
      error: "Too many incorrect PIN attempts. Try again in 15 minutes.",
    });
    return;
  }
  if (result === "invalid") {
    res.status(403).json({ error: "The current transaction PIN is incorrect." });
    return;
  }
  res.status(404).json({ error: "The account for this transaction was not found." });
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
        reason: `Member submitted an identity verification request with ${uploadedCount} uploaded document(s).`,
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

router.post("/bank/transfers", (_req, res): void => {
  res.status(410).json({
    error: "Member-to-member transfers are no longer available.",
  });
});

router.get(
  "/bank/exchange-rates/quote",
  requireSignedIn,
  exchangeRateQuoteLimiter,
  async (req, res): Promise<void> => {
    const parsed = GetBankExchangeRateQuoteQueryParams.safeParse({
      sourceCurrency: req.query.sourceCurrency,
      destinationCurrency: req.query.destinationCurrency,
    });
    if (!parsed.success) {
      res.status(400).json({ error: "Choose valid source and destination currencies." });
      return;
    }

    const { sourceCurrency, destinationCurrency } = parsed.data;
    if (sourceCurrency === destinationCurrency) {
      res.json(
        GetBankExchangeRateQuoteResponse.parse({
          sourceCurrency,
          destinationCurrency,
          rate: "1.0000000000",
          provider: "Globus",
          checkedAt: new Date().toISOString(),
        }),
      );
      return;
    }

    try {
      const quote = await getExchangeRate(sourceCurrency, destinationCurrency);
      res.json(
        GetBankExchangeRateQuoteResponse.parse({
          sourceCurrency,
          destinationCurrency,
          rate: quote.rate,
          provider: quote.provider,
          checkedAt: quote.checkedAt.toISOString(),
        }),
      );
    } catch {
      req.log.warn(
        { sourceCurrency, destinationCurrency },
        "Frankfurter and Grey rate quotes unavailable",
      );
      res.status(503).json({
        error: `No rate source could provide a ${sourceCurrency} to ${destinationCurrency} quote. Choose another supported currency pair.`,
      });
    }
  },
);

router.get("/bank/exchange-rates", async (req, res): Promise<void> => {
  if (!getAuth(req).userId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const rates = await db
    .select()
    .from(bankExchangeRatesTable)
    .orderBy(
      asc(bankExchangeRatesTable.sourceCurrency),
      asc(bankExchangeRatesTable.destinationCurrency),
    );
  res.json(
    ListBankExchangeRatesResponse.parse(
      rates.map((rate) => ({
        sourceCurrency: rate.sourceCurrency,
        destinationCurrency: rate.destinationCurrency,
        rate: rate.rate,
        updatedAt: rate.updatedAt.toISOString(),
      })),
    ),
  );
});

router.get("/bank/international-transfer-requests", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const records = await db
    .select({
      request: bankInternationalTransferRequestsTable,
      transaction: bankTransactionsTable,
    })
    .from(bankInternationalTransferRequestsTable)
    .innerJoin(
      bankTransactionsTable,
      eq(
        bankTransactionsTable.id,
        bankInternationalTransferRequestsTable.transactionId,
      ),
    )
    .where(eq(bankInternationalTransferRequestsTable.userId, user.id))
    .orderBy(desc(bankInternationalTransferRequestsTable.createdAt))
    .limit(50);
  res.json(
    ListInternationalTransferRequestsResponse.parse(
      records.map(({ request, transaction }) =>
        internationalTransferRequestResponse(request, transaction),
      ),
    ),
  );
});

router.post(
  "/bank/international-transfer-requests",
  transferSubmissionLimiter,
  async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const parsed = CreateInternationalTransferRequestBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const sender = await getOrCreateBankUser(authUserId);
  if (sender.accountStatus !== "active") {
    res.status(409).json({ error: "This account is currently restricted." });
    return;
  }
  if (!sender.acceptedTermsAt) {
    res.status(409).json({ error: "Complete account setup before requesting a transfer." });
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
  if (parsed.data.transferType === "local_routing" && !parsed.data.routingCode?.trim()) {
    res.status(400).json({ error: "Enter the local bank routing code." });
    return;
  }
  if (
    parsed.data.transferType === "international_wire" &&
    !/^[A-Za-z0-9]{8}(?:[A-Za-z0-9]{3})?$/.test(parsed.data.swiftBic?.trim() ?? "")
  ) {
    res.status(400).json({ error: "Enter a valid 8- or 11-character SWIFT/BIC code." });
    return;
  }
  const accountNumber = parsed.data.recipientAccountNumber
    .replace(/\s+/g, "")
    .toUpperCase();
  const recipientEmail = parsed.data.recipientEmail.trim().toLowerCase();
  let recipientEmailEncrypted: string;
  try {
    recipientEmailEncrypted = encryptPrivateData(
      recipientEmail,
      "transfer-recipient-email",
    );
  } catch {
    res.status(503).json({
      error: "Recipient notification storage is temporarily unavailable. The transfer was not submitted.",
    });
    return;
  }
  const transactionPinResult = await verifyTransactionPin(
    sender.id,
    parsed.data.transactionPin,
  );
  if (transactionPinResult !== "valid") {
    respondWithTransactionPinError(res, transactionPinResult);
    return;
  }

  let rate = "1.0000000000";
  let rateUpdatedAt = new Date();
  if (parsed.data.sourceCurrency !== parsed.data.destinationCurrency) {
    try {
      const quote = await getExchangeRate(
        parsed.data.sourceCurrency,
        parsed.data.destinationCurrency,
      );
      rate = quote.rate;
      rateUpdatedAt = quote.checkedAt;
    } catch {
      res.status(503).json({
        error: `No rate source could provide a ${parsed.data.sourceCurrency} to ${parsed.data.destinationCurrency} quote. The transfer was not submitted.`,
      });
      return;
    }
  }
  if (
    parsed.data.expectedExchangeRate !== undefined &&
    !conversionRatesMatch(parsed.data.expectedExchangeRate, rate)
  ) {
    res.status(409).json({
      error: "The conversion rate changed. Review the updated quote and confirm again.",
    });
    return;
  }

  const completedByMember = sender.verificationStatus === "approved";
  const routingCode = parsed.data.routingCode?.trim().toUpperCase() || null;
  const swiftBic = parsed.data.swiftBic?.trim().toUpperCase() || null;
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
      if (
        duplicate.initiatedByUserId !== sender.id ||
        duplicate.type !== "external_transfer"
      ) {
        return { error: "That request reference is already in use." };
      }
      const [existingRequest] = await tx
        .select()
        .from(bankInternationalTransferRequestsTable)
        .where(
          eq(
            bankInternationalTransferRequestsTable.transactionId,
            duplicate.id,
          ),
        )
        .limit(1);
      return existingRequest
        ? { request: existingRequest, transaction: duplicate, notifications: [] }
        : { error: "The existing request record could not be loaded." };
    }

    let destinationAmountMinor: bigint;
    try {
      destinationAmountMinor = convertMinorAmount(amountMinor, rate, parsed.data.destinationCurrency);
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "The destination amount could not be calculated.",
      };
    }
    if (destinationAmountMinor <= 0n) {
      return { error: "The converted amount is below the minimum supported amount." };
    }

    const wallet = await userWallet(tx, sender.id, parsed.data.sourceCurrency);
    if (!wallet || wallet.status !== "active") {
      return { error: "An active wallet for the selected source currency is unavailable." };
    }
    const restrictionError = await bankOperationRestrictionError(tx, {
      userId: sender.id,
      walletId: wallet.id,
      operation: "outgoing_transfer",
    });
    if (restrictionError) return { error: restrictionError };
    if (!wallet.transfersEnabled) {
      return { error: "Outgoing transfers are disabled for this wallet in your private vault." };
    }
    const [lockedWallet] = await tx
      .select()
      .from(bankWalletsTable)
      .where(and(
        eq(bankWalletsTable.id, wallet.id),
        eq(bankWalletsTable.userId, sender.id),
      ))
      .for("update");
    if (!lockedWallet || lockedWallet.status !== "active") {
      return { error: "The selected wallet is unavailable or frozen." };
    }
    if (!lockedWallet.transfersEnabled) {
      return { error: "Outgoing transfers are disabled for this wallet in your private vault." };
    }
    const commitRestrictionError = await bankOperationRestrictionError(tx, {
      userId: sender.id,
      walletId: lockedWallet.id,
      operation: "outgoing_transfer",
    });
    if (commitRestrictionError) return { error: commitRestrictionError };
    const available = await balanceForWallet(tx, lockedWallet.id);
    const reserved = await reservedForWallet(tx, lockedWallet.id);
    if (available - reserved < amountMinor) {
      return { error: "There is not enough available ledger balance for this request." };
    }

    const status =
      lockedWallet.futureTransferMode === "reject"
        ? "failed"
        : lockedWallet.futureTransferMode === "hold" || !completedByMember
          ? "pending"
          : "completed";
    const reference = createReference();
    const conversionSummary = `${formatMinorAmount(amountMinor)} ${parsed.data.sourceCurrency} converted to ${formatMinorAmount(destinationAmountMinor, parsed.data.destinationCurrency)} ${parsed.data.destinationCurrency} at ${rate}`;
    const [transaction] = await tx
      .insert(bankTransactionsTable)
      .values({
        reference,
        idempotencyKey: parsed.data.idempotencyKey,
        initiatedByUserId: sender.id,
        fromUserId: sender.id,
        fromWalletId: lockedWallet.id,
        type: "external_transfer",
        status,
        currency: parsed.data.sourceCurrency,
        amountMinor,
        feeMinor: 0n,
        counterparty: `${parsed.data.recipientAccountName.trim()} · ${parsed.data.recipientBank.trim()} · ****${accountNumber.slice(-4)} · ${parsed.data.destinationCountry.trim()}${routingCode ? ` · Routing ${routingCode}` : ""}${swiftBic ? ` · SWIFT/BIC ${swiftBic}` : ""}`,
        description: `${parsed.data.transferType === "local_routing" ? "Local routing" : "International wire"} transfer${parsed.data.remark?.trim() ? ` · ${parsed.data.remark.trim()}` : ""} · ${conversionSummary}`,
        mode: "internal_ledger",
      })
      .returning();
    const [request] = await tx
      .insert(bankInternationalTransferRequestsTable)
      .values({
        transactionId: transaction.id,
        transferType: parsed.data.transferType,
        userId: sender.id,
        sourceWalletId: wallet.id,
        sourceCurrency: parsed.data.sourceCurrency,
        sourceAmountMinor: amountMinor,
        destinationCurrency: parsed.data.destinationCurrency,
        destinationAmountMinor,
        exchangeRate: rate,
        rateUpdatedAt,
        destinationCountry: parsed.data.destinationCountry.trim(),
        recipientBank: parsed.data.recipientBank.trim(),
        routingCode,
        swiftBic,
        recipientAccountName: parsed.data.recipientAccountName.trim(),
        recipientAccountLast4: accountNumber.slice(-4),
        recipientEmailEncrypted,
        remark: parsed.data.remark?.trim() ?? "",
      })
      .returning();
    if (completedByMember) {
      await tx.insert(bankLedgerEntriesTable).values([
        {
          transactionId: transaction.id,
          walletId: lockedWallet.id,
          accountCode: `wallet:${lockedWallet.id}`,
          currency: parsed.data.sourceCurrency,
          side: "debit",
          amountMinor,
        },
        {
          transactionId: transaction.id,
          accountCode: `internal:transfer-clearing:${parsed.data.sourceCurrency}`,
          currency: parsed.data.sourceCurrency,
          side: "credit",
          amountMinor,
        },
      ]);
    }
    const notificationTitle =
      status === "completed"
        ? "Transfer recorded"
        : status === "failed"
          ? "Transfer not processed"
          : "Transfer sent for review";
    const notificationBody =
      status === "completed"
        ? `${formatMinorAmount(amountMinor, parsed.data.sourceCurrency)} ${parsed.data.sourceCurrency} was recorded in Globus.`
        : status === "failed"
          ? "This wallet is set to reject new transfers. No wallet balance changed."
          : "Your transfer is pending review. No wallet balance has changed.";
    const senderNotification = await storeNotification(tx, {
      userId: sender.id,
      category: "transfer",
      title: notificationTitle,
      body: notificationBody,
      reference,
    });
    const recipientUsers = await tx
      .select({ id: bankUsersTable.id })
      .from(bankUsersTable)
      .where(sql`lower(${bankUsersTable.email}) = ${recipientEmail}`)
      .limit(1);
    const notifications = [senderNotification];
    if (recipientUsers[0] && recipientUsers[0].id !== sender.id) {
      notifications.push(
        await storeNotification(tx, {
          userId: recipientUsers[0].id,
          category: "transfer",
          title: "Transfer notice",
          body: `${formatMinorAmount(destinationAmountMinor, parsed.data.destinationCurrency)} ${parsed.data.destinationCurrency} was referenced for you in a Globus transfer record. This is not confirmation of an outside bank payment.`,
          reference,
        }),
      );
    }
    return { request, transaction, notifications };
  });

  if ("error" in result) {
    res.status(409).json({ error: result.error });
    return;
  }
  for (const notification of result.notifications) {
    void sendPushToUser(notification.userId, notification);
  }
  if (result.notifications.length) {
    const emailSent = await notifyTransferRecipient({
      notificationId: result.notifications[0]?.id,
      encryptedEmail: result.request.recipientEmailEncrypted,
      recipientName: result.request.recipientAccountName,
      bankName: result.request.recipientBank,
      destinationCountry: result.request.destinationCountry,
      amount: formatMinorAmount(result.request.destinationAmountMinor, result.request.destinationCurrency),
      currency: result.request.destinationCurrency,
      reference: result.transaction.reference,
      status: result.transaction.status,
      createdAt: result.transaction.createdAt,
    });
    if (!emailSent) {
      req.log.warn({ reference: result.transaction.reference }, "Transfer alert email could not be delivered");
    }
  }
  res.status(201).json(
    CreateInternationalTransferRequestResponse.parse(
      internationalTransferRequestResponse(result.request, result.transaction),
    ),
  );
  },
);

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
  const requiresSavedMethod =
    parsed.data.type === "withdrawal" ||
    (parsed.data.type === "deposit" && parsed.data.paymentMethod === "bank_card");
  if (
    (requiresSavedMethod &&
      (!parsed.data.savedPaymentMethodId || !parsed.data.paymentMethod)) ||
    (!!parsed.data.savedPaymentMethodId !== !!parsed.data.paymentMethod)
  ) {
    res.status(400).json({
      error:
        parsed.data.type === "withdrawal"
          ? "Choose a saved withdrawal destination before submitting."
          : "Choose a saved card before submitting a card deposit request.",
    });
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
      existing[0].amountMinor !== amountMinor ||
      existing[0].savedPaymentMethodId !==
        (parsed.data.savedPaymentMethodId ?? null) ||
      existing[0].paymentMethod !== (parsed.data.paymentMethod ?? null)
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

  const pinResult = await verifyTransactionPin(userId, parsed.data.transactionPin);
  if (pinResult !== "valid") {
    respondWithTransactionPinError(res, pinResult);
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
      return duplicate.userId === userId &&
        duplicate.type === parsed.data.type &&
        duplicate.currency === parsed.data.currency &&
        duplicate.amountMinor === amountMinor &&
        duplicate.savedPaymentMethodId ===
          (parsed.data.savedPaymentMethodId ?? null) &&
        duplicate.paymentMethod === (parsed.data.paymentMethod ?? null)
        ? { sandboxRequest: duplicate }
        : { error: "That request reference is already in use." };
    }

    const reference = createReference();
    let destinationSummary: string | null = null;
    let savedPaymentMethodId: string | null = null;
    let paymentMethod: string | null = null;
    if (
      parsed.data.savedPaymentMethodId &&
      parsed.data.paymentMethod
    ) {
      const [destination] = await tx
        .select()
        .from(bankSavedPaymentMethodsTable)
        .where(
          and(
            eq(
              bankSavedPaymentMethodsTable.id,
              parsed.data.savedPaymentMethodId,
            ),
            eq(bankSavedPaymentMethodsTable.userId, userId),
            eq(bankSavedPaymentMethodsTable.method, parsed.data.paymentMethod),
            isNull(bankSavedPaymentMethodsTable.deletedAt),
          ),
        )
        .for("update")
        .limit(1);
      if (!destination) {
        return { error: "Choose an active saved payment method." };
      }
      savedPaymentMethodId = destination.id;
      paymentMethod = destination.method;
      destinationSummary =
        destination.method === "bank_card"
          ? `${(destination.cardBrand ?? "Card").toUpperCase()} card ·••• ${destination.lastFour}`
          : `${destination.bankName ?? "Bank"} · ${destination.accountHolder ?? "Account holder"} · •••• ${destination.lastFour}${destination.country ? ` · ${destination.country}` : ""}`;
    }
    const wallet = await userWallet(tx, userId, parsed.data.currency);
    if (!wallet || (parsed.data.type === "withdrawal" && wallet.status !== "active")) {
      return {
        error:
          parsed.data.type === "withdrawal"
            ? "A frozen wallet cannot be used for a withdrawal."
            : "A wallet for the selected currency is unavailable.",
      };
    }
    const restrictionError = await bankOperationRestrictionError(tx, {
      userId,
      walletId: wallet.id,
      operation: parsed.data.type,
    });
    if (restrictionError) return { error: restrictionError };
    const [lockedWallet] = await tx
      .select()
      .from(bankWalletsTable)
      .where(and(
        eq(bankWalletsTable.id, wallet.id),
        eq(bankWalletsTable.userId, userId),
      ))
      .for("update");
    if (!lockedWallet) return { error: "The selected wallet is unavailable." };
    if (parsed.data.type === "withdrawal" && lockedWallet.status !== "active") {
      return { error: "A frozen wallet cannot be used for a withdrawal." };
    }
    if (
      (parsed.data.type === "deposit" && !lockedWallet.depositsEnabled) ||
      (parsed.data.type === "withdrawal" && !lockedWallet.withdrawalsEnabled)
    ) {
      return {
        error: `New ${parsed.data.type} requests are disabled for this wallet in your private vault.`,
      };
    }
    const commitRestrictionError = await bankOperationRestrictionError(tx, {
      userId,
      walletId: lockedWallet.id,
      operation: parsed.data.type,
    });
    if (commitRestrictionError) return { error: commitRestrictionError };
    if (parsed.data.type === "withdrawal") {
      const balance = await balanceForWallet(tx, lockedWallet.id);
      const reserved = await reservedForWallet(tx, lockedWallet.id);
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
          parsed.data.type === "withdrawal" ? lockedWallet.id : null,
        toWalletId: parsed.data.type === "deposit" ? lockedWallet.id : null,
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
        savedPaymentMethodId,
        paymentMethod,
        paymentMethodSummary: destinationSummary,
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

router.get("/bank/vault/status", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  res.json(
    GetBankVaultStatusResponse.parse({
      configured: Boolean(user.vaultPasscodeHash),
    }),
  );
});

router.post(
  "/bank/vault/status",
  vaultAttemptLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = InitializeBankVaultPasscodeBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const initialized = await initializeVaultPasscode(
      user.id,
      parsed.data.passcode,
    );
    if (!initialized) {
      res.status(409).json({
        error: "The private vault is already set up. Unlock it to change the passcode.",
      });
      return;
    }
    await db.insert(bankAuditLogsTable).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "initialize_private_vault",
      reason: "Member initialized their separate four-digit private vault passcode.",
    });
    res.json(InitializeBankVaultPasscodeResponse.parse({ configured: true }));
  },
);

router.post(
  "/bank/vault/unlock",
  vaultAttemptLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = UnlockBankVaultBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const result = await unlockVault(user.id, parsed.data.passcode);
    if (result.result !== "valid") {
      if (result.result === "not_configured") {
        res.status(409).json({ error: "Set up a private vault passcode first." });
      } else if (result.result === "locked") {
        res.status(429).json({ error: "Too many incorrect passcodes. Try again in 15 minutes." });
      } else if (result.result === "invalid") {
        res.status(403).json({ error: "The private vault passcode is incorrect." });
      } else {
        res.status(404).json({ error: "The Globus account could not be found." });
      }
      return;
    }
    res.json(
      UnlockBankVaultResponse.parse({
        sessionToken: result.sessionToken,
        expiresAt: result.expiresAt.toISOString(),
      }),
    );
  },
);

router.patch(
  "/bank/vault/passcode",
  vaultAttemptLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultPasscodeHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const parsed = UpdateBankVaultPasscodeBody.safeParse(req.body);
    if (!parsedHeader.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : parsed.error?.message ?? "Invalid passcode.",
      });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await updateVaultPasscode(user.id, sessionToken, parsed.data.newPasscode))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    await db.insert(bankAuditLogsTable).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "update_private_vault_passcode",
      reason: "Member changed their private vault passcode. Previous vault sessions were revoked.",
    });
    res.json(UpdateBankVaultPasscodeResponse.parse({ configured: true }));
  },
);

router.get(
  "/bank/vault/wallet-controls",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = ListBankVaultWalletControlsHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    if (!parsedHeader.success) {
      res.status(403).json({ error: "Unlock your private vault to manage wallet controls." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const wallets = await db
      .select({
        walletId: bankWalletsTable.id,
        currency: bankWalletsTable.currency,
        transfersEnabled: bankWalletsTable.transfersEnabled,
        depositsEnabled: bankWalletsTable.depositsEnabled,
        withdrawalsEnabled: bankWalletsTable.withdrawalsEnabled,
        futureTransferMode: bankWalletsTable.futureTransferMode,
      })
      .from(bankWalletsTable)
      .where(eq(bankWalletsTable.userId, user.id))
      .orderBy(asc(bankWalletsTable.currency));
    res.json(ListBankVaultWalletControlsResponse.parse(wallets));
  },
);

router.patch(
  "/bank/vault/wallet-controls/:walletId",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const sessionToken = req.get("X-Globus-Vault-Session") ?? "";
    const parsedHeader = UpdateBankVaultWalletControlHeader.safeParse({
      "X-Globus-Vault-Session": sessionToken,
    });
    const params = UpdateBankVaultWalletControlParams.safeParse(req.params);
    const parsed = UpdateBankVaultWalletControlBody.safeParse(req.body);
    if (!parsedHeader.success || !params.success || !parsed.success) {
      res.status(400).json({
        error: !parsedHeader.success
          ? parsedHeader.error.message
          : !params.success
            ? params.error.message
            : parsed.error?.message ?? "Invalid wallet-control request.",
      });
      return;
    }
    if (!Object.keys(parsed.data).length) {
      res.status(400).json({ error: "Choose at least one wallet control to update." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    if (!(await isVaultSessionActive(user.id, sessionToken))) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [wallet] = await tx
        .select()
        .from(bankWalletsTable)
        .where(
          and(
            eq(bankWalletsTable.id, params.data.walletId),
            eq(bankWalletsTable.userId, user.id),
          ),
        )
        .for("update");
      if (!wallet) return { notFound: true as const };
      if (!(await isVaultSessionActive(user.id, sessionToken))) {
        return { expired: true as const };
      }
      const changes = {
        ...(parsed.data.transfersEnabled !== undefined
          ? { transfersEnabled: parsed.data.transfersEnabled }
          : {}),
        ...(parsed.data.depositsEnabled !== undefined
          ? { depositsEnabled: parsed.data.depositsEnabled }
          : {}),
        ...(parsed.data.withdrawalsEnabled !== undefined
          ? { withdrawalsEnabled: parsed.data.withdrawalsEnabled }
          : {}),
        ...(parsed.data.futureTransferMode !== undefined
          ? { futureTransferMode: parsed.data.futureTransferMode }
          : {}),
        updatedAt: new Date(),
      };
      const [updated] = await tx
        .update(bankWalletsTable)
        .set(changes)
        .where(eq(bankWalletsTable.id, wallet.id))
        .returning();
      const changedFields = Object.keys(parsed.data).join(", ");
      await tx.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "update_private_vault_wallet_controls",
        reason: `Member updated ${wallet.currency} wallet controls: ${changedFields}.`,
      });
      const notification = await storeNotification(tx, {
        userId: user.id,
        category: "wallet",
        title: `${wallet.currency} wallet controls updated`,
        body: "Your new controls apply to future wallet requests only. Existing transaction records were not changed.",
      });
      return { wallet: updated, notification };
    });
    if ("notFound" in result) {
      res.status(404).json({ error: "Wallet not found." });
      return;
    }
    if ("expired" in result) {
      res.status(403).json({ error: "Your private vault session expired. Unlock it again." });
      return;
    }
    void sendPushToUser(user.id, result.notification);
    res.json(
      UpdateBankVaultWalletControlResponse.parse({
        walletId: result.wallet.id,
        currency: result.wallet.currency,
        transfersEnabled: result.wallet.transfersEnabled,
        depositsEnabled: result.wallet.depositsEnabled,
        withdrawalsEnabled: result.wallet.withdrawalsEnabled,
        futureTransferMode: result.wallet.futureTransferMode,
      }),
    );
  },
);

router.get("/bank/notifications", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  const user = await getOrCreateBankUser(authUserId);
  const notifications = await db
    .select()
    .from(bankNotificationsTable)
    .where(eq(bankNotificationsTable.userId, user.id))
    .orderBy(desc(bankNotificationsTable.createdAt))
    .limit(50);
  res.json(
    ListBankNotificationsResponse.parse(
      notifications.map(notificationResponse),
    ),
  );
});

router.patch(
  "/bank/notifications/:notificationId/read",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const params = MarkBankNotificationReadParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [notification] = await db
      .update(bankNotificationsTable)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(bankNotificationsTable.id, params.data.notificationId),
          eq(bankNotificationsTable.userId, user.id),
        ),
      )
      .returning();
    if (!notification) {
      res.status(404).json({ error: "Notification not found." });
      return;
    }
    res.json(
      MarkBankNotificationReadResponse.parse(
        notificationResponse(notification),
      ),
    );
  },
);

router.get("/bank/push/config", async (req, res): Promise<void> => {
  const authUserId = getAuth(req).userId;
  if (!authUserId) {
    res.status(401).json({ error: "Sign in to access your Globus account." });
    return;
  }
  res.json(GetBankPushConfigResponse.parse(getPushConfig()));
});

router.put(
  "/bank/push/subscriptions",
  pushSubscriptionLimiter,
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const parsed = SaveBankPushSubscriptionBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (!getPushConfig().configured) {
      res.status(503).json({ error: "Browser push is not configured yet." });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    try {
      const id = await savePushSubscription(user.id, parsed.data.subscriberId);
      await db.insert(bankAuditLogsTable).values({
        actorUserId: user.id,
        targetUserId: user.id,
        action: "link_webpushr_notifications",
        reason: "Member linked a Webpushr subscriber to their account.",
      });
      res.json(SaveBankPushSubscriptionResponse.parse({ id, saved: true }));
    } catch (error) {
      if (error instanceof WebpushrSubscriberAlreadyLinkedError) {
        res.status(409).json({ error: error.message });
        return;
      }
      req.log.error("Encrypted push subscription storage is unavailable");
      res.status(503).json({ error: "Secure notification storage is temporarily unavailable." });
    }
  },
);

router.delete(
  "/bank/push/subscriptions/:subscriptionId",
  async (req, res): Promise<void> => {
    const authUserId = getAuth(req).userId;
    if (!authUserId) {
      res.status(401).json({ error: "Sign in to access your Globus account." });
      return;
    }
    const params = DeleteBankPushSubscriptionParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    const user = await getOrCreateBankUser(authUserId);
    const [deleted] = await db
      .delete(bankPushSubscriptionsTable)
      .where(
        and(
          eq(bankPushSubscriptionsTable.id, params.data.subscriptionId),
          eq(bankPushSubscriptionsTable.userId, user.id),
        ),
      )
      .returning({ id: bankPushSubscriptionsTable.id });
    if (!deleted) {
      res.status(404).json({ error: "Push subscription not found." });
      return;
    }
    await db.insert(bankAuditLogsTable).values({
      actorUserId: user.id,
      targetUserId: user.id,
      action: "unlink_webpushr_notifications",
      reason: "Member disconnected a Webpushr subscriber from their account.",
    });
    res.json(DeleteBankPushSubscriptionResponse.parse({ id: deleted.id, saved: false }));
  },
);

export default router;
