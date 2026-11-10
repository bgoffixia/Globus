export const CUSTOMER_EMAIL_SENDER_DOMAIN = "globus.website";
export const CUSTOMER_EMAIL_SENDER_DISPLAY_NAME = "GLOBUS BANK";

const RESERVED_LOCAL_PARTS = new Set([
  "abuse",
  "admin",
  "alerts",
  "billing",
  "contact",
  "globus",
  "globusbank",
  "help",
  "mailer-daemon",
  "no-reply",
  "noreply",
  "notifications",
  "postmaster",
  "privacy",
  "root",
  "security",
  "service",
  "support",
  "webmaster",
]);

export function normalizeCustomerEmailSenderLocalPart(
  value: string | null | undefined,
): { valid: true; value: string | null } | { valid: false; value: null } {
  if (value == null || value.trim() === "") return { valid: true, value: null };
  const normalized = value.trim().toLowerCase();
  if (
    normalized.length > 64 ||
    !/^[a-z0-9](?:[a-z0-9._-]{0,62}[a-z0-9])?$/.test(normalized) ||
    normalized.includes("..") ||
    RESERVED_LOCAL_PARTS.has(normalized)
  ) {
    return { valid: false, value: null };
  }
  return { valid: true, value: normalized };
}

export function customerEmailSenderAddress(localPart: string | null): string | null {
  const normalized = normalizeCustomerEmailSenderLocalPart(localPart);
  if (!normalized.valid || !normalized.value) return null;
  return `${normalized.value}@${CUSTOMER_EMAIL_SENDER_DOMAIN}`;
}

export function customerEmailSenderHeader(localPart: string | null): string | null {
  const address = customerEmailSenderAddress(localPart);
  return address ? `${CUSTOMER_EMAIL_SENDER_DISPLAY_NAME} <${address}>` : null;
}
