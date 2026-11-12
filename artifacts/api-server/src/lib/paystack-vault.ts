const PAYSTACK_API = "https://api.paystack.co";

export interface PaystackInitialization {
  authorizationUrl: string;
  reference: string;
}

export interface PaystackVerification {
  reference: string;
  status: string;
  amount: number;
  currency: string;
  metadata: Record<string, unknown> | null;
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

export async function initializePaystackVaultCheckout(input: {
  secretKey: string;
  email: string;
  amountMinor: string;
  reference: string;
  callbackUrl: string;
  userId: string;
  planCode: string;
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
      },
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
  const amount = data?.amount;
  const reference =
    typeof data?.reference === "string" ? data.reference : "";
  const status = typeof data?.status === "string" ? data.status : "";
  const currency = typeof data?.currency === "string" ? data.currency : "";

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
  return { reference, status, amount, currency, metadata };
}

function isSafePaystackCheckoutUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "checkout.paystack.com";
  } catch {
    return false;
  }
}
