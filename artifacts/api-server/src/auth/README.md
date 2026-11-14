# Globus self-managed Better Auth MFA staging

This module is deliberately isolated from production Clerk authentication.

## Required environment variables

Configure these only in the separate MFA staging API deployment:

- `BETTER_AUTH_STAGING_ENABLED=true`
- `BETTER_AUTH_DATABASE_URL`: connection string for Neon branch `globus-better-auth-mfa-staging` (branch ID `br-floral-salad-b9lk3aae`), database `globus_auth_mfa` on the isolated branch `globus-better-auth-mfa-staging` (`br-floral-salad-b9lk3aae`). This is a newly created empty database within that branch; it does not contain the inherited Globus banking tables.
- `BETTER_AUTH_SECRET`: independently generated random secret with at least 32 characters.
- `BETTER_AUTH_URL`: origin of the staging API, without the `/api/better-auth` path.
- `BETTER_AUTH_TRUSTED_ORIGINS`: comma-separated exact staging frontend origins.

Set these variables only on the separate staging frontend deployment:

- `VITE_AUTH_PROVIDER=better-auth-mfa-staging`
- `VITE_BETTER_AUTH_BASE_URL`: the staging API origin, without a trailing slash or path.
- `RESEND_API_KEY` and `AUTH_EMAIL_FROM`: staging-only email verification delivery.

Never reuse the production Clerk secret, production database URL, or production mail credentials.

## Database

Apply `migrations/0001_better_auth_mfa_staging.sql` only to the isolated Neon branch above. All Better Auth tables live in the dedicated `globus_better_auth_staging` schema. The app's existing `public` and `neon_auth` schemas are not modified.

## MFA policy

- Only email/password sign-in is enabled; no social, magic-link, passkey, or email-OTP sign-in route is configured.
- Email verification is required before sign-in.
- TOTP enrollment requires a successful first-factor session and a valid enrollment code.
- Backup codes are generated during enrollment and stored encrypted.
- The two-factor plugin challenges subsequent password sign-ins.
- The staging access-check endpoint refuses access until `twoFactorEnabled` is true.
- Do not enable trusted-device bypass during the parity test.
- This is not production-ready authentication and does not authorize any access to real customer or banking data.
