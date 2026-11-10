import { randomUUID } from "node:crypto";
import { sendResendEmail } from "./resend-email";

const EMAIL_FROM_ADDRESS_PATTERN = /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/;

function appOrigin(): string | null {
  const configuredHost =
    process.env.REPLIT_DOMAINS?.split(",")[0]?.trim() ||
    process.env.REPLIT_DEV_DOMAIN?.trim();
  if (!configuredHost) return null;

  try {
    const parsed = new URL(
      configuredHost.includes("://")
        ? configuredHost
        : `https://${configuredHost}`,
    );
    if (parsed.protocol !== "https:") return null;
    return parsed.origin;
  } catch {
    return null;
  }
}

export async function sendPasswordResetEmail(input: {
  recipient: string;
  ticket: string;
}): Promise<boolean> {
  const sender = process.env.GLOBUS_SECURITY_EMAIL_FROM?.trim();
  const origin = appOrigin();
  if (!sender || !EMAIL_FROM_ADDRESS_PATTERN.test(sender) || !origin) {
    return false;
  }

  const recoveryUrl = new URL("/sign-in/recover", origin);
  recoveryUrl.hash = new URLSearchParams({ ticket: input.ticket }).toString();
  const link = recoveryUrl.toString();
  return sendResendEmail(
    {
      from: `Globus Bank Security <${sender}>`,
      to: input.recipient,
      subject: "Reset your Globus Bank password",
      text: [
        "An administrator required a password update for your Globus Bank account.",
        "Use this secure link to sign in and choose a new password:",
        link,
        "This link expires in 15 minutes and can only be used once.",
        "If you did not expect this message, contact Globus Bank support.",
      ].join("\n\n"),
      html: `<p>An administrator required a password update for your Globus Bank account.</p><p><a href="${link}">Sign in and choose a new password</a></p><p>This secure link expires in 15 minutes and can only be used once.</p><p>If you did not expect this message, contact Globus Bank support.</p>`,
    },
    `password-reset-${randomUUID()}`,
  );
}
