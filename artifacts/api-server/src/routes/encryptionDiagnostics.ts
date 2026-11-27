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


// One-time server-side transfer. The encryption key is never returned to the caller.
const migrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 2,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { error: "The migration endpoint is temporarily rate limited." },
});

const CLOUDFLARE_ACCOUNT_ID = "334a20d5ead9d330d85ab713876e1faf";
const CLOUDFLARE_STORE_ID = "720e333dd3124a3db83aba3388e4a15b";
const CLOUDFLARE_SECRET_NAME = "BANK_DETAILS_ENCRYPTION_KEY";

router.get(
  "/bank/admin/diagnostics/migrate-encryption-key-to-cloudflare/run",
  diagnosticLimiter,
  requireAdmin,
  (_req, res): void => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");
    res.type("html").send(`<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GLOBUS BANK secure key migration</title>
<style>body{font:16px system-ui;max-width:620px;margin:48px auto;padding:0 18px;color:#172033}button{padding:14px 18px;border:0;border-radius:8px;background:#173b72;color:#fff;font-weight:600}pre{white-space:pre-wrap;overflow-wrap:anywhere}</style></head>
<body><h1>Secure encryption-key migration</h1>
<p>This action transfers the existing production encryption key from the Vercel server directly to the Cloudflare Secrets Store. The key will not be displayed.</p>
<p>Do not run this if you have already added this secret manually.</p>
<button id="run">Transfer existing key securely</button><pre id="result" aria-live="polite"></pre>
<script>
document.getElementById("run").addEventListener("click",async function(){
 const b=this, out=document.getElementById("result");
 if(!confirm("Transfer the existing GLOBUS BANK production encryption key to Cloudflare now?"))return;
 b.disabled=true;out.textContent="Transferring securely…";
 try{
  const r=await fetch("/api/bank/admin/diagnostics/migrate-encryption-key-to-cloudflare",{method:"POST",credentials:"same-origin",headers:{"X-Globus-Migration":"confirm"}});
  const j=await r.json();
  out.textContent=JSON.stringify(j,null,2);
 }catch(e){out.textContent="Request failed. No key was displayed.";}
 b.disabled=false;
});
</script></body></html>`);
  },
);

router.post(
  "/bank/admin/diagnostics/migrate-encryption-key-to-cloudflare",
  migrationLimiter,
  requireAdmin,
  async (req, res): Promise<void> => {
    res.setHeader("Cache-Control", "no-store, max-age=0");
    res.setHeader("Pragma", "no-cache");

    if (req.get("x-globus-migration") !== "confirm") {
      res.status(403).json({ success: false, error: "Migration confirmation is required." });
      return;
    }

    const encryptionKey = process.env.BANK_DETAILS_ENCRYPTION_KEY;
    const cloudflareToken = process.env.CLOUDFLARE_SECRETS_STORE_MIGRATION_TOKEN;
    if (!encryptionKey || !cloudflareToken) {
      res.status(503).json({
        success: false,
        error: "Required server-side migration configuration is missing.",
        keyConfigured: Boolean(encryptionKey),
        migrationCredentialConfigured: Boolean(cloudflareToken),
      });
      return;
    }

    const endpoint = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/secrets_store/stores/${CLOUDFLARE_STORE_ID}/secrets`;
    const headers = {
      Authorization: `Bearer ${cloudflareToken}`,
      "Content-Type": "application/json",
    };

    try {
      const listResponse = await fetch(endpoint, { method: "GET", headers, cache: "no-store" });
      const listBody = await listResponse.json() as { success?: boolean; result?: Array<{ id?: string; name?: string; scopes?: string[] }> };
      if (!listResponse.ok || !listBody.success) {
        res.status(502).json({ success: false, error: "Cloudflare could not be checked. The key was not transferred." });
        return;
      }

      const existing = (listBody.result ?? []).find((item) => item.name === CLOUDFLARE_SECRET_NAME);
      if (existing) {
        res.status(409).json({
          success: false,
          alreadyExists: true,
          secretName: CLOUDFLARE_SECRET_NAME,
          secretId: existing.id ?? null,
          message: "A secret with this name already exists. It was not overwritten.",
        });
        return;
      }

      const createResponse = await fetch(endpoint, {
        method: "POST",
        headers,
        cache: "no-store",
        body: JSON.stringify([{
          name: CLOUDFLARE_SECRET_NAME,
          value: encryptionKey,
          comment: "Existing GLOBUS BANK production encryption key transferred from Vercel; preserve for decrypting existing data.",
          scopes: ["workers"],
        }]),
      });
      const createBody = await createResponse.json() as {
        success?: boolean;
        result?: Array<{ id?: string; name?: string; scopes?: string[] }>;
      };

      if (!createResponse.ok || !createBody.success) {
        res.status(502).json({ success: false, error: "Cloudflare rejected the secret creation. The key was not returned." });
        return;
      }

      const created = createBody.result?.[0];
      res.status(201).json({
        success: true,
        transferred: true,
        secretName: created?.name ?? CLOUDFLARE_SECRET_NAME,
        secretId: created?.id ?? null,
        scopes: created?.scopes ?? ["workers"],
        keyDisplayed: false,
        message: "The existing encryption key was sent directly from the Vercel server to Cloudflare Secrets Store.",
      });
    } catch {
      res.status(502).json({ success: false, error: "Migration failed. The key was not returned or logged." });
    }
  },
);

export default router;
