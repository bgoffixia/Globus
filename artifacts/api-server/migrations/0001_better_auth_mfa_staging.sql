-- Additive migration for the isolated globus-better-auth-mfa-staging Neon branch.
-- Never apply this migration to production or the Neon Auth staging branch.
CREATE SCHEMA IF NOT EXISTS globus_better_auth_staging;

CREATE TABLE IF NOT EXISTS globus_better_auth_staging."user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "twoFactorEnabled" boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS globus_better_auth_staging."session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now(),
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES globus_better_auth_staging."user"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "session_userId_idx"
  ON globus_better_auth_staging."session" ("userId");

CREATE TABLE IF NOT EXISTS globus_better_auth_staging."account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES globus_better_auth_staging."user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "account_userId_idx"
  ON globus_better_auth_staging."account" ("userId");

CREATE TABLE IF NOT EXISTS globus_better_auth_staging."verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp DEFAULT now(),
  "updatedAt" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "verification_identifier_idx"
  ON globus_better_auth_staging."verification" ("identifier");

CREATE TABLE IF NOT EXISTS globus_better_auth_staging."twoFactor" (
  "id" text PRIMARY KEY,
  "secret" text NOT NULL,
  "backupCodes" text NOT NULL,
  "userId" text NOT NULL REFERENCES globus_better_auth_staging."user"("id") ON DELETE CASCADE,
  "verified" boolean NOT NULL DEFAULT false,
  "failedVerificationCount" integer NOT NULL DEFAULT 0,
  "lockedUntil" timestamp
);

CREATE INDEX IF NOT EXISTS "twoFactor_userId_idx"
  ON globus_better_auth_staging."twoFactor" ("userId");
