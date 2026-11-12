import assert from "node:assert/strict";
import { test } from "node:test";
import {
  getPaystackSecretKey,
  initializePaystackVaultCheckout,
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
    metadata: { userId: "member-1", planCode: "1m" },
  });
  assert.deepEqual(result, {
    authorizationUrl: "https://checkout.paystack.com/abc123",
    reference: "GBV-reference-1",
  });
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
        metadata: { userId: "member-1", planCode: "3m" },
        customer: { email: "member@example.test" },
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
    metadata: { userId: "member-1", planCode: "3m" },
  });
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
