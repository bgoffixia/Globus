import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import {
  createPaystackVaultPlan,
  getPaystackSecretKey,
  initializePaystackVaultCheckout,
  isValidPaystackWebhookSignature,
  isPaystackVaultRecurringEnabled,
  sendPaystackSubscriptionManagementEmail,
  verifyPaystackVaultCheckout,
} from "../src/lib/paystack-vault";

test("Paystack checkout initialization sends a server-calculated NGN plan", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedInit = init;
    return new Response(JSON.stringify({
      status: true,
      data: {
        authorization_url: "https://checkout.paystack.com/abc123",
        reference: "GBV-reference-1",
      },
    }), { status: 200 });
  };

  const result = await initializePaystackVaultCheckout({
    secretKey: "server-only-test-key",
    email: "member@example.test",
    amountMinor: "1200000",
    reference: "GBV-reference-1",
    callbackUrl: "https://globus.example/private-vault",
    userId: "member-1",
    planCode: "1m",
    fetchImpl,
  });

  assert.equal(capturedUrl, "https://api.paystack.co/transaction/initialize");
  assert.equal(capturedInit?.method, "POST");
  assert.equal(
    (capturedInit?.headers as Record<string, string>).Authorization,
    "Bearer server-only-test-key",
  );
  assert.deepEqual(JSON.parse(String(capturedInit?.body)), {
    email: "member@example.test",
    amount: 1200000,
    currency: "NGN",
    reference: "GBV-reference-1",
    callback_url: "https://globus.example/private-vault",
      metadata: { userId: "member-1", planCode: "1m", autoRenew: false },
  });
  assert.deepEqual(result, {
    authorizationUrl: "https://checkout.paystack.com/abc123",
    reference: "GBV-reference-1",
  });
});

test("recurring checkout uses the server-created Paystack plan code", async () => {
  let capturedBody: Record<string, unknown> = {};
  const fetchImpl: typeof fetch = async (_input, init) => {
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      status: true,
      data: {
        authorization_url: "https://checkout.paystack.com/auto123",
        reference: "GBV-auto-1",
      },
    }), { status: 200 });
  };
  await initializePaystackVaultCheckout({
    secretKey: "server-only-test-key",
    email: "member@example.test",
    amountMinor: "1200000",
    reference: "GBV-auto-1",
    callbackUrl: "https://globus.example/private-vault",
    userId: "member-1",
    planCode: "1m",
    recurringPlanCode: "PLN_MONTHLY1",
    fetchImpl,
  });
  assert.equal(capturedBody.plan, "PLN_MONTHLY1");
  assert.deepEqual(capturedBody.metadata, {
    userId: "member-1",
    planCode: "1m",
    autoRenew: true,
  });
});

test("Paystack creates a fixed-currency recurring plan server-side", async () => {
  let capturedUrl = "";
  let capturedBody: Record<string, unknown> = {};
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    capturedBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(JSON.stringify({
      status: true,
      data: { plan_code: "PLN_ANNUAL1" },
    }), { status: 200 });
  };
  const plan = await createPaystackVaultPlan({
    secretKey: "server-only-test-key",
    name: "Globus Private Vault annual",
    amountMinor: "7900000",
    interval: "annually",
    fetchImpl,
  });
  assert.equal(capturedUrl, "https://api.paystack.co/plan");
  assert.deepEqual(capturedBody, {
    name: "Globus Private Vault annual",
    amount: 7900000,
    interval: "annually",
    currency: "NGN",
    send_invoices: false,
    send_sms: false,
  });
  assert.deepEqual(plan, { planCode: "PLN_ANNUAL1" });
});

test("Paystack checkout rejects non-provider redirect URLs", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    status: true,
    data: {
      authorization_url: "https://attacker.example/checkout",
      reference: "GBV-reference-2",
    },
  }), { status: 200 });

  await assert.rejects(
    initializePaystackVaultCheckout({
      secretKey: "server-only-test-key",
      email: "member@example.test",
      amountMinor: "1200000",
      reference: "GBV-reference-2",
      callbackUrl: "https://globus.example/private-vault",
      userId: "member-1",
      planCode: "1m",
      fetchImpl,
    }),
    /could not be initialized/,
  );
});

test("Paystack verification returns only the verified transaction facts", async () => {
  let capturedUrl = "";
  const fetchImpl: typeof fetch = async (input, init) => {
    capturedUrl = String(input);
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer server-only-test-key");
    return new Response(JSON.stringify({
      status: true,
      data: {
        reference: "GBV-reference-3",
        status: "success",
        amount: 2200000,
        currency: "NGN",
        metadata: { userId: "member-1", planCode: "3m", autoRenew: false },
        customer: { email: "member@example.test", customer_code: "CUS_123" },
        subscription_code: "SUB_456",
        plan_object: { plan_code: "PLN_789" },
      },
    }), { status: 200 });
  };

  const result = await verifyPaystackVaultCheckout({
    secretKey: "server-only-test-key",
    reference: "GBV-reference-3",
    fetchImpl,
  });
  assert.equal(capturedUrl, "https://api.paystack.co/transaction/verify/GBV-reference-3");
  assert.deepEqual(result, {
    reference: "GBV-reference-3",
    status: "success",
    amount: 2200000,
    currency: "NGN",
    metadata: { userId: "member-1", planCode: "3m", autoRenew: false },
    customerCode: "CUS_123",
    subscriptionCode: "SUB_456",
    planCode: "PLN_789",
  });
});

test("Paystack webhook signatures authenticate the exact raw body", () => {
  const body = Buffer.from('{"event":"charge.success"}');
  const signature = createHmac("sha512", "test-webhook-key")
    .update(body)
    .digest("hex");
  assert.equal(isValidPaystackWebhookSignature(body, signature, "test-webhook-key"), true);
  assert.equal(isValidPaystackWebhookSignature(body, signature, "wrong-key"), false);
  assert.equal(isValidPaystackWebhookSignature(body, "bad-signature", "test-webhook-key"), false);
});

test("renewal management emails are requested for the stored subscription only", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  await sendPaystackSubscriptionManagementEmail({
    secretKey: "server-only-test-key",
    subscriptionCode: "SUB_456",
    fetchImpl: async (input, init) => {
      capturedUrl = String(input);
      capturedMethod = String(init?.method);
      return new Response(JSON.stringify({ status: true, message: "sent" }), { status: 200 });
    },
  });
  assert.equal(
    capturedUrl,
    "https://api.paystack.co/subscription/SUB_456/manage/email",
  );
  assert.equal(capturedMethod, "POST");
  await assert.rejects(
    sendPaystackSubscriptionManagementEmail({
      secretKey: "server-only-test-key",
      subscriptionCode: "not-a-code",
      fetchImpl: async () => new Response(JSON.stringify({ status: true }), { status: 200 }),
    }),
    /invalid/,
  );
});

test("Paystack verification rejects malformed or mismatched references", async () => {
  const fetchImpl: typeof fetch = async () => new Response(JSON.stringify({
    status: true,
    data: {
      reference: "different-reference",
      status: "success",
      amount: 2200000,
      currency: "NGN",
    },
  }), { status: 200 });
  await assert.rejects(
    verifyPaystackVaultCheckout({
      secretKey: "server-only-test-key",
      reference: "GBV-reference-4",
      fetchImpl,
    }),
    /could not be verified/,
  );
});

test("Paystack secret lookup supports the existing secret name without exposing it", () => {
  const previousCorrect = process.env.PAYSTACK_SECRET_KEY;
  const previousLegacy = process.env.PAYSTACK_SCRET_KEY;
  try {
    delete process.env.PAYSTACK_SECRET_KEY;
    process.env.PAYSTACK_SCRET_KEY = "existing-secret";
    assert.equal(getPaystackSecretKey(), "existing-secret");
    process.env.PAYSTACK_SECRET_KEY = "preferred-secret";
    assert.equal(getPaystackSecretKey(), "preferred-secret");
  } finally {
    if (previousCorrect === undefined) delete process.env.PAYSTACK_SECRET_KEY;
    else process.env.PAYSTACK_SECRET_KEY = previousCorrect;
    if (previousLegacy === undefined) delete process.env.PAYSTACK_SCRET_KEY;
    else process.env.PAYSTACK_SCRET_KEY = previousLegacy;
  }
});

test("recurring checkout remains off until its Paystack webhook is configured", () => {
  const previous = process.env.PAYSTACK_VAULT_RECURRING_ENABLED;
  try {
    delete process.env.PAYSTACK_VAULT_RECURRING_ENABLED;
    assert.equal(isPaystackVaultRecurringEnabled(), false);
    process.env.PAYSTACK_VAULT_RECURRING_ENABLED = "TRUE";
    assert.equal(isPaystackVaultRecurringEnabled(), true);
  } finally {
    if (previous === undefined) delete process.env.PAYSTACK_VAULT_RECURRING_ENABLED;
    else process.env.PAYSTACK_VAULT_RECURRING_ENABLED = previous;
  }
});
