import { eq } from "drizzle-orm";
import {
  bankNotificationsTable,
  bankPushSubscriptionsTable,
  bankUsersTable,
  db,
} from "@workspace/db";
import { decryptPrivateData, encryptPrivateData, hashPrivateToken } from "./private-data";
import { sendResendEmail } from "./resend-email";
import {
  CUSTOMER_EMAIL_SENDER_DISPLAY_NAME,
  customerEmailSenderHeader,
} from "./customer-email-sender";

type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
type NotificationCategory = "transfer" | "wallet" | "security";

export type StoredNotification = typeof bankNotificationsTable.$inferSelect;

export class WebpushrSubscriberAlreadyLinkedError extends Error {
  constructor() {
    super("This Webpushr subscriber is already linked to another Globus account.");
    this.name = "WebpushrSubscriberAlreadyLinkedError";
  }
}

function webpushrCredentials() {
  const siteKey = process.env.WEBPUSHR_SITE_KEY?.trim();
  const apiKey = process.env.WEBPUSHR_REST_API_KEY?.trim();
  const authToken = process.env.WEBPUSHR_AUTH_TOKEN?.trim();
  return siteKey && apiKey && authToken
    ? { siteKey, apiKey, authToken }
    : null;
}

function appOrigin(): string | null {
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

export function getPushConfig(): { configured: boolean; siteKey: string | null } {
  const credentials = webpushrCredentials();
  return {
    configured: Boolean(credentials),
    siteKey: credentials?.siteKey ?? null,
  };
}

export function isPushCategoryEnabled(
  category: string,
  preferences: {
    transferEnabled: boolean;
    walletEnabled: boolean;
    securityEnabled: boolean;
  },
): boolean {
  switch (category) {
    case "transfer":
      return preferences.transferEnabled;
    case "wallet":
      return preferences.walletEnabled;
    case "security":
      return preferences.securityEnabled;
    default:
      return false;
  }
}

export async function storeNotification(
  tx: DbTransaction,
  input: {
    userId: string;
    category: NotificationCategory;
    title: string;
    body: string;
    reference?: string | null;
  },
): Promise<StoredNotification> {
  const [notification] = await tx
    .insert(bankNotificationsTable)
    .values({
      userId: input.userId,
      category: input.category,
      title: input.title,
      body: input.body,
      reference: input.reference ?? null,
    })
    .returning();
  return notification;
}

export function notificationResponse(notification: StoredNotification) {
  return {
    id: notification.id,
    category: notification.category as NotificationCategory,
    title: notification.title,
    body: notification.body,
    reference: notification.reference,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

function htmlEscape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}

export function normalizeSupportUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length > 500) return null;
  try {
    const url = new URL(value.trim());
    if (
      url.protocol !== "https:" ||
      !url.hostname ||
      url.username ||
      url.password
    ) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

export async function sendTransferAlertEmail(input: {
  notificationId?: string;
  senderUserId?: string;
  recipientEmail: string;
  recipientName: string;
  bankName: string;
  destinationCountry: string;
  amount: string;
  currency: string;
  reference: string;
  status: string;
  createdAt: Date;
}): Promise<boolean> {
  const senderAddress = process.env.GLOBUS_SECURITY_EMAIL_FROM?.trim();
  const validFallbackAddress =
    senderAddress && /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(senderAddress)
      ? senderAddress
      : null;
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(input.recipientEmail)) {
    return false;
  }
  let senderPreferences:
    | {
        senderLocalPart: string | null;
        theme: string;
        headline: string;
        backgroundColor: string;
        includeSupportLink: boolean;
        supportUrl: string | null;
      }
    | undefined;
  if (input.senderUserId) {
    try {
      [senderPreferences] = await db
        .select({
          senderLocalPart: bankUsersTable.vaultEmailSenderLocalPart,
          theme: bankUsersTable.vaultEmailBannerTheme,
          headline: bankUsersTable.vaultEmailBannerHeadline,
          backgroundColor: bankUsersTable.vaultEmailBannerBackgroundColor,
          includeSupportLink: bankUsersTable.vaultEmailIncludeSupportLink,
          supportUrl: bankUsersTable.vaultEmailSupportUrl,
        })
        .from(bankUsersTable)
        .where(eq(bankUsersTable.id, input.senderUserId))
        .limit(1);
    } catch {
      return false;
    }
  }
  const senderHeader =
    customerEmailSenderHeader(senderPreferences?.senderLocalPart ?? null) ??
    (validFallbackAddress
      ? `${CUSTOMER_EMAIL_SENDER_DISPLAY_NAME} <${validFallbackAddress}>`
      : null);
  if (!senderHeader) return false;
  const emailThemes = {
    navy: { background: "#12385d", accent: "#d6b45e" },
    teal: { background: "#174b52", accent: "#8ad1c7" },
    gold: { background: "#40391f", accent: "#e3c66d" },
  } as const;
  const theme =
    emailThemes[senderPreferences?.theme as keyof typeof emailThemes] ?? emailThemes.navy;
  const requestedBackgroundColor = senderPreferences?.backgroundColor ?? "";
  const bannerBackgroundColor = /^#[0-9a-f]{6}$/i.test(requestedBackgroundColor)
    ? requestedBackgroundColor
    : theme.background;
  const backgroundRgb = bannerBackgroundColor
    .slice(1)
    .match(/.{2}/g)
    ?.map((component) => Number.parseInt(component, 16)) ?? [18, 56, 93];
  const backgroundLuminance =
    (0.2126 * backgroundRgb[0] +
      0.7152 * backgroundRgb[1] +
      0.0722 * backgroundRgb[2]) /
    255;
  const bannerTextColor = backgroundLuminance > 0.62 ? "#17314f" : "#ffffff";
  const headline = senderPreferences?.headline?.trim() || "A Globus transfer notice";
  const supportUrl =
    senderPreferences?.includeSupportLink
      ? normalizeSupportUrl(senderPreferences.supportUrl)
      : null;
  const supportText = supportUrl ? `Support: ${supportUrl}` : "";
  const supportHtml = supportUrl
    ? `<footer style="padding:16px 28px 20px;border-top:1px solid #e7ecee;text-align:center"><a href="${htmlEscape(supportUrl)}" style="color:#356e75;font-size:13px;font-weight:700;text-decoration:none">Sender-provided support link</a></footer>`
    : "";
  const statusText =
    input.status === "completed"
      ? "The sender’s Globus account recorded this transfer."
      : input.status === "pending"
        ? "The transfer is pending review in Globus."
        : input.status === "failed" || input.status === "rejected"
          ? "The transfer was not posted to the sender’s Globus wallet."
          : `The Globus record status is ${input.status}.`;
  const details = [
    `Recipient: ${input.recipientName}`,
    `Destination: ${input.bankName}, ${input.destinationCountry}`,
    `Amount: ${input.amount} ${input.currency}`,
    `Reference: ${input.reference}`,
    `Status: ${input.status}`,
    `Recorded: ${input.createdAt.toISOString()}`,
  ];
  const htmlDetails = details
    .map((line) => `<li>${htmlEscape(line)}</li>`)
    .join("");
  const idempotencyKey = `globus-transfer-${input.notificationId ?? `${input.reference}-${input.status}`}`;
  try {
    return await sendResendEmail(
      {
        from: senderHeader,
        to: input.recipientEmail,
        subject: `Globus transfer update · ${input.reference}`,
        text: [
          "Globus transfer update",
          "",
          statusText,
          "",
          ...details,
          ...(supportText ? [supportText] : []),
          "",
          "This notice reports a Globus account record. It does not confirm that an outside bank received, paid, or settled funds.",
          "If you do not recognize this message, you can ignore it. Do not reply with account credentials or verification codes.",
        ].join("\n"),
        html: `<main style="margin:0;padding:32px 16px;background:#f1f6f7;font-family:Arial,sans-serif;color:#17314f"><section style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce7ea;border-radius:18px;overflow:hidden"><header style="padding:22px 28px;background:${bannerBackgroundColor};color:${bannerTextColor}"><div style="font-size:19px;font-weight:700;letter-spacing:1px">GLOBUS <span style="color:${theme.accent}">BANK</span></div><div style="margin-top:8px;font-size:13px;font-weight:700;color:${bannerTextColor}">${htmlEscape(headline)}</div></header><div style="padding:26px 28px"><h1 style="margin:0 0 12px;font-size:21px">Transfer update</h1><p style="margin:0 0 20px;line-height:1.55;color:#536a7d">${htmlEscape(statusText)}</p><ul style="padding:0 0 0 18px;line-height:1.9;color:#334b62">${htmlDetails}</ul><div style="margin-top:24px;padding:14px;border:1px solid #e7dfc6;border-radius:12px;background:#fbf8ef;color:#766943;font-size:12px;line-height:1.55">This notice reports a Globus account record. It does not confirm that an outside bank received, paid, or settled funds.</div><p style="margin:20px 0 0;font-size:11px;color:#7a8b99">If you do not recognize this message, ignore it. Never reply with account credentials or verification codes.</p></div>${supportHtml}</section></main>`,
      },
      idempotencyKey,
    );
  } catch {
    return false;
  }
}

export async function sendPushToUser(
  userId: string,
  notification: Pick<
    StoredNotification,
    "title" | "body" | "reference" | "id" | "category"
  >,
): Promise<void> {
  const credentials = webpushrCredentials();
  const origin = appOrigin();
  if (!credentials || !origin) return;

  let preferences:
    | {
        transferEnabled: boolean;
        walletEnabled: boolean;
        securityEnabled: boolean;
      }
    | undefined;
  try {
    const [user] = await db
      .select({
        transferEnabled: bankUsersTable.pushTransferAlertsEnabled,
        walletEnabled: bankUsersTable.pushWalletAlertsEnabled,
        securityEnabled: bankUsersTable.pushSecurityAlertsEnabled,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .limit(1);
    preferences = user;
  } catch {
    return;
  }
  if (
    !preferences ||
    !isPushCategoryEnabled(notification.category, preferences)
  ) {
    return;
  }

  let subscriptions: typeof bankPushSubscriptionsTable.$inferSelect[];
  try {
    subscriptions = await db
      .select()
      .from(bankPushSubscriptionsTable)
      .where(eq(bankPushSubscriptionsTable.userId, userId));
  } catch {
    return;
  }
  await Promise.all(
    subscriptions.map(async (row) => {
      let subscriberId: string;
      try {
        subscriberId = decryptPrivateData(
          row.subscriptionEncrypted,
          "webpushr-subscriber-id",
        );
        if (!/^[A-Za-z0-9._:-]{1,160}$/.test(subscriberId)) return;
      } catch {
        return;
      }
      try {
        const response = await fetch("https://api.webpushr.com/v1/notification/send/sid", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            webpushrKey: credentials.apiKey,
            webpushrAuthToken: credentials.authToken,
          },
          body: JSON.stringify({
            title: notification.title.slice(0, 100),
            message: "You have a new account activity update. Open Globus to review it.",
            target_url: new URL("/notifications", origin).toString(),
            sid: subscriberId,
            icon: new URL("/globus-mark-transparent.png", origin).toString(),
            auto_hide: 1,
            expire_push: "1d",
          }),
          signal: AbortSignal.timeout(8000),
        });
        if (response.status === 404) {
          await db
            .delete(bankPushSubscriptionsTable)
            .where(eq(bankPushSubscriptionsTable.id, row.id));
        }
      } catch {
        // Push delivery is best-effort; in-app notifications remain available.
      }
    }),
  );
}

export async function savePushSubscription(
  userId: string,
  subscriberId: string,
): Promise<string> {
  if (!/^[A-Za-z0-9._:-]{1,160}$/.test(subscriberId)) {
    throw new Error("Invalid Webpushr subscriber ID.");
  }
  const endpointHash = hashPrivateToken(subscriberId);
  const encrypted = encryptPrivateData(
    subscriberId,
    "webpushr-subscriber-id",
  );
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({
        id: bankPushSubscriptionsTable.id,
        userId: bankPushSubscriptionsTable.userId,
      })
      .from(bankPushSubscriptionsTable)
      .where(eq(bankPushSubscriptionsTable.endpointHash, endpointHash))
      .limit(1)
      .for("update");
    if (existing) {
      if (existing.userId !== userId) {
        throw new WebpushrSubscriberAlreadyLinkedError();
      }
      await tx
        .update(bankPushSubscriptionsTable)
        .set({ userId, subscriptionEncrypted: encrypted, updatedAt: new Date() })
        .where(eq(bankPushSubscriptionsTable.id, existing.id));
      return existing.id;
    }
    const [created] = await tx
      .insert(bankPushSubscriptionsTable)
      .values({
        userId,
        endpointHash,
        subscriptionEncrypted: encrypted,
      })
      .returning({ id: bankPushSubscriptionsTable.id });
    return created.id;
  });
}

export async function notifyTransferRecipient(input: {
  notificationId?: string;
  senderUserId?: string;
  encryptedEmail: string | null;
  recipientName: string;
  bankName: string;
  destinationCountry: string;
  amount: string;
  currency: string;
  reference: string;
  status: string;
  createdAt: Date;
}): Promise<boolean> {
  if (!input.encryptedEmail) return false;
  try {
    const recipientEmail = decryptPrivateData(
      input.encryptedEmail,
      "transfer-recipient-email",
    );
    return await sendTransferAlertEmail({ ...input, recipientEmail });
  } catch {
    return false;
  }
}

