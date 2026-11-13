import { createHash } from "node:crypto";
import {
  and,
  asc,
  eq,
  gt,
  isNull,
  lte,
  lt,
  ne,
  or,
} from "drizzle-orm";
import { bankUsersTable, db } from "@workspace/db";
import { sendResendEmail } from "./resend-email";

export const VAULT_EXPIRY_REMINDER_LEAD_MS = 3 * 24 * 60 * 60 * 1000;
export const VAULT_EXPIRY_REMINDER_CLAIM_LEASE_MS = 30 * 60 * 1000;
export const VAULT_EXPIRY_REMINDER_BATCH_SIZE = 100;

const EMAIL_FROM_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

type ReminderEmailInput = {
  userId: string;
  recipient: string;
  expiresAt: Date;
  autoRenew: boolean;
};

type ReminderEmailMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
  html: string;
};

type ReminderEmailSender = (input: ReminderEmailInput) => Promise<boolean>;
type ReminderSweepOptions = {
  now?: Date;
  sendReminder?: ReminderEmailSender;
  onlyUserId?: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getAppOrigin(): string | null {
  const host =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    process.env.REPLIT_DEV_DOMAIN?.trim();
  if (!host) return null;
  try {
    const url = new URL(host.includes("://") ? host : `https://${host}`);
    return url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

export function buildVaultExpiryReminderEmail(
  input: Pick<ReminderEmailInput, "recipient" | "expiresAt" | "autoRenew"> & {
    senderAddress: string;
    origin: string;
  },
): ReminderEmailMessage {
  const expiryLabel = new Intl.DateTimeFormat("en-US", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC",
  }).format(input.expiresAt);
  const vaultUrl = new URL("/private-vault", input.origin).toString();
  const renewalDetails = input.autoRenew
    ? "Automatic renewal is enabled. Access will continue only after Paystack confirms the renewal payment."
    : "To keep using the Private Vault, choose a plan and renew before the expiry time.";
  const from = `Globus Bank <${input.senderAddress}>`;
  const subject = "Your Globus Private Vault access expires soon";

  return {
    from,
    to: input.recipient,
    subject,
    text: [
      "Your Globus Private Vault access expires soon.",
      `Current access is scheduled to end on ${expiryLabel} UTC.`,
      renewalDetails,
      "If you have already renewed, you can ignore this reminder.",
      `Open your Private Vault: ${vaultUrl}`,
      "For your security, never share your password, passcode, or verification codes by email.",
    ].join("\n\n"),
    html: `<main style="margin:0;padding:32px 16px;background:#f1f6f7;font-family:Arial,sans-serif;color:#17314f"><section style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce7ea;border-radius:18px;overflow:hidden"><header style="padding:22px 28px;background:#12385d;color:#fff"><div style="font-size:19px;font-weight:700;letter-spacing:1px">GLOBUS <span style="color:#d6b45e">BANK</span></div></header><div style="padding:28px"><p style="margin:0 0 10px;color:#397b80;font-size:12px;font-weight:700;letter-spacing:1.5px">PRIVATE VAULT</p><h1 style="margin:0 0 16px;font-size:23px">Your access expires soon</h1><p style="margin:0 0 14px;line-height:1.6;color:#536a7d">Your current access is scheduled to end on <strong>${escapeHtml(expiryLabel)} UTC</strong>.</p><p style="margin:0 0 24px;line-height:1.6;color:#536a7d">${escapeHtml(renewalDetails)}</p><a href="${escapeHtml(vaultUrl)}" style="display:inline-block;padding:13px 20px;border-radius:10px;background:#173d60;color:#fff;text-decoration:none;font-weight:700">Open Private Vault</a><p style="margin:24px 0 0;font-size:12px;line-height:1.6;color:#7a8b99">If you have already renewed, you can ignore this reminder. Never share your password, passcode, or verification codes by email.</p></div></section></main>`,
  };
}

export async function sendVaultExpiryReminderEmail(
  input: ReminderEmailInput,
): Promise<boolean> {
  const senderAddress = process.env.GLOBUS_SECURITY_EMAIL_FROM?.trim();
  const origin = getAppOrigin();
  if (
    !senderAddress ||
    !EMAIL_FROM_ADDRESS_PATTERN.test(senderAddress) ||
    !origin
  ) {
    return false;
  }

  const message = buildVaultExpiryReminderEmail({
    recipient: input.recipient,
    expiresAt: input.expiresAt,
    autoRenew: input.autoRenew,
    senderAddress,
    origin,
  });
  const userDigest = createHash("sha256")
    .update(input.userId)
    .digest("hex")
    .slice(0, 24);
  return sendResendEmail(
    message,
    `vault-expiry-${userDigest}-${input.expiresAt.getTime()}`,
  );
}

export async function sendVaultExpiryReminders(
  options: ReminderSweepOptions = {},
): Promise<{ sent: number; failed: number }> {
  const now = options.now ?? new Date();
  const sendReminder = options.sendReminder ?? sendVaultExpiryReminderEmail;
  const reminderWindowEnd = new Date(
    now.getTime() + VAULT_EXPIRY_REMINDER_LEAD_MS,
  );
  const staleClaimBefore = new Date(
    now.getTime() - VAULT_EXPIRY_REMINDER_CLAIM_LEASE_MS,
  );
  const conditions = [
    eq(bankUsersTable.vaultSubscriptionStatus, "active"),
    gt(bankUsersTable.vaultSubscriptionExpiresAt, now),
    lte(bankUsersTable.vaultSubscriptionExpiresAt, reminderWindowEnd),
    or(
      isNull(bankUsersTable.vaultSubscriptionExpiryReminderSentFor),
      ne(
        bankUsersTable.vaultSubscriptionExpiryReminderSentFor,
        bankUsersTable.vaultSubscriptionExpiresAt,
      ),
    ),
    or(
      isNull(bankUsersTable.vaultSubscriptionExpiryReminderClaimedAt),
      lt(
        bankUsersTable.vaultSubscriptionExpiryReminderClaimedAt,
        staleClaimBefore,
      ),
    ),
  ];
  if (options.onlyUserId) {
    conditions.push(eq(bankUsersTable.id, options.onlyUserId));
  }
  const candidates = await db
    .select({
      id: bankUsersTable.id,
      email: bankUsersTable.email,
      expiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      autoRenew: bankUsersTable.vaultSubscriptionAutoRenew,
    })
    .from(bankUsersTable)
    .where(and(...conditions))
    .orderBy(asc(bankUsersTable.vaultSubscriptionExpiresAt))
    .limit(VAULT_EXPIRY_REMINDER_BATCH_SIZE);

  let sent = 0;
  let failed = 0;
  for (const candidate of candidates) {
    const expiresAt = candidate.expiresAt;
    if (!expiresAt) continue;
    const [claimed] = await db
      .update(bankUsersTable)
      .set({ vaultSubscriptionExpiryReminderClaimedAt: now })
      .where(
        and(
          eq(bankUsersTable.id, candidate.id),
          eq(bankUsersTable.vaultSubscriptionStatus, "active"),
          eq(bankUsersTable.vaultSubscriptionExpiresAt, expiresAt),
          or(
            isNull(bankUsersTable.vaultSubscriptionExpiryReminderSentFor),
            ne(
              bankUsersTable.vaultSubscriptionExpiryReminderSentFor,
              expiresAt,
            ),
          ),
          or(
            isNull(bankUsersTable.vaultSubscriptionExpiryReminderClaimedAt),
            lt(
              bankUsersTable.vaultSubscriptionExpiryReminderClaimedAt,
              staleClaimBefore,
            ),
          ),
        ),
      )
      .returning({ id: bankUsersTable.id });
    if (!claimed) continue;

    let delivered = false;
    try {
      delivered = await sendReminder({
        userId: candidate.id,
        recipient: candidate.email,
        expiresAt,
        autoRenew: candidate.autoRenew,
      });
    } catch {
      delivered = false;
    }

    if (delivered) {
      await db
        .update(bankUsersTable)
        .set({
          vaultSubscriptionExpiryReminderSentFor: expiresAt,
          vaultSubscriptionExpiryReminderClaimedAt: null,
        })
        .where(
          and(
            eq(bankUsersTable.id, candidate.id),
            eq(
              bankUsersTable.vaultSubscriptionExpiryReminderClaimedAt,
              now,
            ),
          ),
        );
      sent += 1;
    } else {
      await db
        .update(bankUsersTable)
        .set({ vaultSubscriptionExpiryReminderClaimedAt: null })
        .where(
          and(
            eq(bankUsersTable.id, candidate.id),
            eq(
              bankUsersTable.vaultSubscriptionExpiryReminderClaimedAt,
              now,
            ),
          ),
        );
      failed += 1;
    }
  }

  return { sent, failed };
}
