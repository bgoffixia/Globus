import { Router, type IRouter, type RequestHandler } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { rateLimit } from "express-rate-limit";
import { isNotNull } from "drizzle-orm";
import {
  bankInternationalTransferRequestsTable,
  db,
} from "@workspace/db";
import { isPasswordResetRequired } from "../lib/password-reset";
import {
  decryptPrivateData,
  isPrivateDataEncryptionConfigured,
} from "../lib/private-data";

const router: IRouter = Router();

const diagnosticLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 3,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "Encryption diagnostics are temporarily rate limited." },
});

function configuredAdminIds(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_CLERK_IDS ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
  );
}

function configuredAdminEmails(): Set<string> {
  return new Set(
    (process.env.GLOBUS_ADMIN_EMAILS ?? "")
      .split(",")
      .map((value) => value.trim().toLowerCase())
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

const requireAdmin: RequestHandler = async (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) {
    res.status(401).json({ error: "Sign in to access administrator tools." });
    return;
  }

  try {
    if (await isPasswordResetRequired(userId)) {
      res.status(423).json({ error: "Update your password before accessing administrator tools." });
      return;
    }
    if (!(await isAllowlistedAdmin(userId))) {
      res.status(403).json({ error: "Administrator access is not enabled for this account." });
      return;
    }
  } catch {
    res.status(503).json({ error: "Administrator access could not be verified right now." });
    return;
  }

  next();
};

// Temporary, read-only diagnostic. Never returns the key, ciphertext, or plaintext.
router.get(
  "/bank/admin/diagnostics/private-data-encryption",
  diagnosticLimiter,
  requireAdmin,
  async (_req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");

    const keyConfigured = isPrivateDataEncryptionConfigured();
    if (!keyConfigured) {
      res.json({
        keyConfigured: false,
        ciphertextFound: null,
        decryptionPassed: null,
        checkedPurpose: "transfer-recipient-email",
      });
      return;
    }

    try {
      const [record] = await db
        .select({
          ciphertext: bankInternationalTransferRequestsTable.recipientEmailEncrypted,
        })
        .from(bankInternationalTransferRequestsTable)
        .where(isNotNull(bankInternationalTransferRequestsTable.recipientEmailEncrypted))
        .limit(1);

      if (!record?.ciphertext) {
        res.json({
          keyConfigured: true,
          ciphertextFound: false,
          decryptionPassed: null,
          checkedPurpose: "transfer-recipient-email",
        });
        return;
      }

      try {
        // Decrypt only to validate the authentication tag/AAD; discard immediately.
        const plaintext = decryptPrivateData(record.ciphertext, "transfer-recipient-email");
        const decryptionPassed = typeof plaintext === "string";
        res.json({
          keyConfigured: true,
          ciphertextFound: true,
          decryptionPassed,
          checkedPurpose: "transfer-recipient-email",
        });
      } catch {
        res.json({
          keyConfigured: true,
          ciphertextFound: true,
          decryptionPassed: false,
          checkedPurpose: "transfer-recipient-email",
        });
      }
    } catch {
      res.status(503).json({
        keyConfigured: true,
        ciphertextFound: null,
        decryptionPassed: null,
        diagnosticError: "The encrypted record could not be checked.",
      });
    }
  },
);

export default router;
