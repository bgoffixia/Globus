import { createHmac, timingSafeEqual } from "node:crypto";

const PAYSTACK_API = "https://api.paystack.co";

export interface PaystackInitialization {
  authorizationUrl: string;
  reference: string;
}

export interface PaystackPlan {
  planCode: string;
}

export interface PaystackVerification {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown> | null;
  customerCode: string | null;
  subscriptionCode: string | null;
  planCode: string | null;
}

type FetchLike = typeof fetch;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null;
}

export function getPaystackSecretKey(): string | null {
  return (
    process.env.PAYSTACK_SECRET_KEY?.trim() ||
    process.env.PAYSTACK_SCRET_KEY?.trim() ||
    null
  );
}

export function isPaystackVaultRecurringEnabled(): boolean {
  return (
    process.env.PAYSTACK_VAULT_RECURRING_ENABLED?.trim().toLowerCase() ===
    "true"
  );
}

export async function createPaystackVaultPlan(input: {
  secretKey: string;
  name: string;
  amountMinor: string;
  interval: "monthly" | "annually";
  fetchImpl?: FetchLike;
}): Promise<PaystackPlan> {
  const amount = Number(input.amountMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Paystack plan amount is invalid.");
  }
  const request = input.fetchImpl ?? fetch;
  const response = await request(`${PAYSTACK_API}/plan`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: input.name,
      amount,
      interval: input.interval,
      currency: "NGN",
      send_invoices: false,
      send_sms: false,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const envelope = asRecord(payload);
  const data = asRecord(envelope?.data);
  const planCode = typeof data?.plan_code === "string" ? data.plan_code : "";
  if (!response.ok || envelope?.status !== true || !/^PLN_[A-Za-z0-9]+$/.test(planCode)) {
    throw new Error("Paystack renewal plan could not be created.");
  }
  return { planCode };
}

export async function initializePaystackVaultCheckout(input: {
  secretKey: string;
  email: string;
  amountMinor: string;
  reference: string;
  callbackUrl: string;
  userId: string;
  planCode: string;
  recurringPlanCode?: string | null;
  fetchImpl?: FetchLike;
}): Promise<PaystackInitialization> {
  const amount = Number(input.amountMinor);
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new Error("Paystack checkout amount is invalid.");
  }
  const request = input.fetchImpl ?? fetch;
  const response = await request(`${PAYSTACK_API}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secretKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: input.email,
      amount,
      currency: "NGN",
      reference: input.reference,
      callback_url: input.callbackUrl,
      metadata: {
        userId: input.userId,
        planCode: input.planCode,
        autoRenew: Boolean(input.recurringPlanCode),
      },
      ...(input.recurringPlanCode ? { plan: input.recurringPlanCode } : {}),
    }),
    signal: AbortSignal.timeout(15_000),
  });
  const payload: unknown = await response.json().catch(() => null);
  const envelope = asRecord(payload);
  const data = asRecord(envelope?.data);
  const authorizationUrl =
    typeof data?.authorization_url === "string" ? data.authorization_url : "";
  const returnedReference =
    typeof data?.reference === "string" ? data.reference : "";

  if (
    !response.ok ||
    envelope?.status !== true ||
    returnedReference !== input.reference ||
    !isSafePaystackCheckoutUrl(authorizationUrl)
  ) {
    throw new Error("Paystack checkout could not be initialized.");
  }
  return { authorizationUrl, reference: returnedReference };
}

export async function verifyPaystackVaultCheckout(input: {
  secretKey: string;
  reference: string;
  fetchImpl?: FetchLike;
}): Promise<PaystackVerification> {
  const request = input.fetchImpl ?? fetch;
  const response = await request(
    `${PAYSTACK_API}/transaction/verify/${encodeURIComponent(input.reference)}`,
    {
      method: "GET",
      headers: { Authorization: `Bearer ${input.secretKey}` },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  const envelope = asRecord(payload);
  const data = asRecord(envelope?.data);
  const metadata = asRecord(data?.metadata);
  const customer = asRecord(data?.customer);
  const subscription = asRecord(data?.subscription);
  const plan = asRecord(data?.plan_object);
  const directPlan = asRecord(data?.plan);
  const amount = data?.amount;
  const reference =
    typeof data?.reference === "string" ? data.reference : "";
  const status = typeof data?.status === "string" ? data.status : "";
  const currency = typeof data?.currency === "string" ? data.currency : "";
  const customerCode =
    typeof customer?.customer_code === "string" ? customer.customer_code : null;
  const subscriptionCode =
    typeof data?.subscription_code === "string"
      ? data.subscription_code
      : typeof subscription?.subscription_code === "string"
        ? subscription.subscription_code
        : null;
  const planCode =
    typeof plan?.plan_code === "string"
      ? plan.plan_code
      : typeof directPlan?.plan_code === "string"
        ? directPlan.plan_code
        : typeof data?.plan === "string"
          ? data.plan
          : null;

  if (
    !response.ok ||
    envelope?.status !== true ||
    reference !== input.reference ||
    typeof amount !== "number" ||
    !Number.isSafeInteger(amount) ||
    !status ||
    !currency
  ) {
    throw new Error("Paystack payment could not be verified.");
  }
  return {
    reference,
    status,
    amount,
    currency,
    metadata,
    customerCode,
    subscriptionCode,
    planCode,
  };
}

export function isValidPaystackWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secretKey: string,
): boolean {
  if (!/^[a-f0-9]{128}$/i.test(signature)) return false;
  const expected = createHmac("sha512", secretKey).update(rawBody).digest();
  const provided = Buffer.from(signature, "hex");
  return provided.length === expected.length && timingSafeEqual(provided, expected);
}

export async function sendPaystackSubscriptionManagementEmail(input: {
  secretKey: string;
  subscriptionCode: string;
  fetchImpl?: FetchLike;
}): Promise<void> {
  if (!/^SUB_[A-Za-z0-9]+$/.test(input.subscriptionCode)) {
    throw new Error("Paystack subscription code is invalid.");
  }
  const request = input.fetchImpl ?? fetch;
  const response = await request(
    `${PAYSTACK_API}/subscription/${encodeURIComponent(input.subscriptionCode)}/manage/email`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.secretKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15_000),
    },
  );
  const payload: unknown = await response.json().catch(() => null);
  const envelope = asRecord(payload);
  if (!response.ok || envelope?.status !== true) {
    throw new Error("Paystack could not send the subscription management link.");
  }
}

function isSafePaystackCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com";
  } catch {
    return false;
  }
}
