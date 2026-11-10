import assert from "node:assert/strict";
import { test } from "node:test";
import { sendResendEmail } from "../src/lib/resend-email";
import {
  isPushCategoryEnabled,
  normalizeSupportUrl,
} from "../src/lib/transfer-notifications";

const apiKeyEnv = "RESEND_API_KEY";

const message = {
  from: "Globus Bank <alerts@example.test>",
  to: "recipient@example.test",
  subject: "Transfer update",
  text: "Test message",
  html: "<p>Test message</p>",
};

test("normalizes only safe HTTPS support URLs", () => {
  assert.equal(
    normalizeSupportUrl(" https://support.example.test/help "),
    "https://support.example.test/help",
  );
  assert.equal(normalizeSupportUrl("http://support.example.test"), null);
  assert.equal(normalizeSupportUrl("javascript:alert(1)"), null);
  assert.equal(
    normalizeSupportUrl("https://user:password@support.example.test"),
    null,
  );
  assert.equal(normalizeSupportUrl("x".repeat(501)), null);
});

test("push delivery rules honor each customer's alert category choices", () => {
  const preferences = {
    transferEnabled: true,
    walletEnabled: false,
    securityEnabled: true,
  };
  assert.equal(isPushCategoryEnabled("transfer", preferences), true);
  assert.equal(isPushCategoryEnabled("wallet", preferences), false);
  assert.equal(isPushCategoryEnabled("security", preferences), true);
});

test("sends mail through the Resend API using the server-side secret", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  process.env[apiKeyEnv] = "test-resend-secret";
  let capturedRequest: Request | undefined;
  globalThis.fetch = (async (input, init) => {
    capturedRequest = new Request(input, init);
    return new Response(JSON.stringify({ id: "test-email-id" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "test-idempotency-key"), true);
    assert.equal(capturedRequest?.url, "https://api.resend.com/emails");
    assert.equal(capturedRequest?.method, "POST");
    assert.equal(
      capturedRequest?.headers.get("authorization"),
      "Bearer test-resend-secret",
    );
    assert.equal(
      capturedRequest?.headers.get("idempotency-key"),
      "test-idempotency-key",
    );
    assert.deepEqual(await capturedRequest?.json(), message);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});

test("does not attempt delivery without a Resend API key", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  delete process.env[apiKeyEnv];
  let called = false;
  globalThis.fetch = (async () => {
    called = true;
    return new Response(null, { status: 200 });
  }) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "test-idempotency-key"), false);
    assert.equal(called, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});

test("reports Resend rejection as an unsuccessful delivery", async () => {
  const previousKey = process.env[apiKeyEnv];
  const previousFetch = globalThis.fetch;
  process.env[apiKeyEnv] = "test-resend-secret";
  globalThis.fetch = (async () =>
    new Response(JSON.stringify({ message: "Rejected" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    })) as typeof fetch;

  try {
    assert.equal(await sendResendEmail(message, "test-idempotency-key"), false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousKey === undefined) delete process.env[apiKeyEnv];
    else process.env[apiKeyEnv] = previousKey;
  }
});
