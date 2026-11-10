import { eq } from "drizzle-orm";
import { ReplitConnectors } from "@replit/connectors-sdk";
import {
  bankNotificationsTable,
  bankPushSubscriptionsTable,
  db,
} from "@workspace/db";
import { decryptPrivateData, encryptPrivateData, hashPrivateToken } from "./private-data";

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

export async function sendTransferAlertEmail(input: {
  notificationId?: string;
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
  const sender = process.env.GLOBUS_SECURITY_EMAIL_FROM?.trim();
  if (
    !sender ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(sender) ||
    !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(input.recipientEmail)
  ) {
    return false;
  }
  const connectors = new ReplitConnectors();
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
    const response = await connectors.proxy("resend", "/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        from: `Globus Bank Alerts <${sender}>`,
        to: input.recipientEmail,
        subject: `Globus transfer update · ${input.reference}`,
        text: [
          "Globus transfer update",
          "",
          statusText,
          "",
          ...details,
          "",
          "This notice reports a Globus account record. It does not confirm that an outside bank received, paid, or settled funds.",
          "If you do not recognize this message, you can ignore it. Do not reply with account credentials or verification codes.",
        ].join("\n"),
        html: `<main style="margin:0;padding:32px 16px;background:#f1f6f7;font-family:Arial,sans-serif;color:#17314f"><section style="max-width:560px;margin:auto;background:#fff;border:1px solid #dce7ea;border-radius:18px;overflow:hidden"><header style="padding:22px 28px;background:#12385d;color:#fff"><div style="font-size:19px;font-weight:700;letter-spacing:1px">GLOBUS <span style="color:#d6b45e">BANK</span></div><div style="margin-top:8px;font-size:11px;color:#d8e4ed">TRANSFER ALERT</div></header><div style="padding:26px 28px"><h1 style="margin:0 0 12px;font-size:21px">Transfer update</h1><p style="margin:0 0 20px;line-height:1.55;color:#536a7d">${htmlEscape(statusText)}</p><ul style="padding:0 0 0 18px;line-height:1.9;color:#334b62">${htmlDetails}</ul><div style="margin-top:24px;padding:14px;border:1px solid #e7dfc6;border-radius:12px;background:#fbf8ef;color:#766943;font-size:12px;line-height:1.55">This notice reports a Globus account record. It does not confirm that an outside bank received, paid, or settled funds.</div><p style="margin:20px 0 0;font-size:11px;color:#7a8b99">If you do not recognize this message, ignore it. Never reply with account credentials or verification codes.</p></div></section></main>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendPushToUser(
  userId: string,
  notification: Pick<StoredNotification, "title" | "body" | "reference" | "id">,
): Promise<void> {
  const credentials = webpushrCredentials();
  const origin = appOrigin();
  if (!credentials || !origin) return;

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
        await fetch("https://api.webpushr.com/v1/notification/send/sid", {
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

