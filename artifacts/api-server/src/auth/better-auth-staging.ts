import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { twoFactor } from "better-auth/plugins/two-factor";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

const databaseUrl = process.env.BETTER_AUTH_DATABASE_URL;
const secret = process.env.BETTER_AUTH_SECRET;
const baseURL = process.env.BETTER_AUTH_URL;
const resendApiKey = process.env.RESEND_API_KEY;
const emailFrom = process.env.AUTH_EMAIL_FROM;

if (!databaseUrl || !secret || secret.length < 32 || !baseURL) {
  throw new Error(
    "Better Auth staging requires BETTER_AUTH_DATABASE_URL, a 32+ character BETTER_AUTH_SECRET, and BETTER_AUTH_URL.",
  );
}

if (!resendApiKey || !emailFrom) {
  throw new Error(
    "Better Auth staging email verification requires RESEND_API_KEY and AUTH_EMAIL_FROM.",
  );
}

const trustedOrigins = (
  process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? baseURL
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const pool = new pg.Pool({
  connectionString: databaseUrl,
  max: 5,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
});

const authDb = drizzle(pool);

async function sendVerificationEmail(userEmail: string, verificationUrl: string) {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [userEmail],
      subject: "Verify your Globus MFA staging email",
      html: `<p>Verify your email to continue with the isolated Globus MFA staging test.</p><p><a href="${verificationUrl}">Verify email address</a></p><p>If you did not request this, you can ignore this message.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Verification email delivery failed with status ${response.status}.`);
  }
}

export const betterAuthStaging = betterAuth({
  appName: "Globus MFA Staging",
  baseURL,
  basePath: "/api/better-auth",
  secret,
  trustedOrigins,
  database: drizzleAdapter(authDb, {
    provider: "pg",
    schemaName: "globus_better_auth_staging",
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 12,
    maxPasswordLength: 128,
    autoSignIn: false,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: false,
    sendVerificationEmail: async ({ user, url }) => {
      await sendVerificationEmail(user.email, url);
    },
  },
  plugins: [
    twoFactor({
      issuer: "Globus MFA Staging",
      skipVerificationOnEnable: false,
      backupCodeOptions: {
        amount: 10,
        length: 10,
        storeBackupCodes: "encrypted",
      },
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 900,
      },
    }),
  ],
  advanced: {
    defaultCookieAttributes: {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    },
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 10,
  },
});
