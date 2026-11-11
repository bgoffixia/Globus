import assert from "node:assert/strict";
import { test } from "node:test";
import { sendResendEmail } from "../src/lib/resend-email";
import {
  customerEmailSenderHeader,
  normalizeCustomerEmailSenderLocalPart,
} from "../src/lib/customer-email-sender";
import {
  isPushCategoryEnabled,
  normalizeSupportLabel,
  normalizeSupportUrl,
  renderSupportFooter,
} from "../src/lib/transfer-notifications";
import { isPrivateDataEncryptionConfigured } from "../src/lib/private-data";

const apiKeyEnv = "RESEND_API_KEY";
const encryptionKeyEnv = "BANK_DETAILS_ENCRYPTION_KEY";

test("private-data encryption readiness validates without returning the key", () => {
  const previousKey = process.env[encryptionKeyEnv];
  try {
    delete process.env[encryptionKeyEnv];
    assert.equal(isPrivateDataEncryptionConfigured(), false);
    process.env[encryptionKeyEnv] = "too-short";
    assert.equal(isPrivateDataEncryptionConfigured(), false);
    process.env[encryptionKeyEnv] = "x".repeat(32);
    assert.equal(isPrivateDataEncryptionConfigured(), true);
  } finally {
    if (previousKey === undefined) delete process.env[encryptionKeyEnv];
    else process.env[encryptionKeyEnv] = previousKey;
  }
});

test("customer transfer-email senders use a unique-safe local part and fixed identity", () => {
  assert.deepEqual(normalizeCustomerEmailSenderLocalPart("  Jane.Doe-7 "), {
    valid: true,
    value: "jane.doe-7",
  });
  assert.deepEqual(normalizeCustomerEmailSenderLocalPart("security"), {
    valid: false,
    value: null,
  });
  assert.deepEqual(normalizeCustomerEmailSenderLocalPart("bad..dots"), {
    valid: false,
    value: null,
  });
  assert.equal(
    customerEmailSenderHeader("jane.doe-7"),
    "GLOBUS BANK <jane.doe-7@globus.website>",
  );
});

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

test("custom footer labels are normalized and safely rendered", () => {
  assert.equal(normalizeSupportLabel("  Get account help  "), "Get account help");
  assert.equal(normalizeSupportLabel("   "), null);
  assert.equal(normalizeSupportLabel("x".repeat(41)), null);
  assert.equal(normalizeSupportLabel("Help\nSupport"), null);
  assert.deepEqual(
    renderSupportFooter("https://support.example.test/help", "<Help & support>"),
    {
      text: "<Help & support>: https://support.example.test/help",
      html: '<footer style="padding:16px 28px 20px;border-top:1px solid #e7ecee;text-align:center"><a href="https://support.example.test/help" style="color:#356e75;font-size:13px;font-weight:700;text-decoration:none">&lt;Help &amp; support&gt;</a></footer>',
    },
  );
  assert.equal(renderSupportFooter(null, "Help").html, "");
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
