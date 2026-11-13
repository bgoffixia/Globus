# Deploy Globus on Vercel

This repository is a pnpm monorepo. Deploy it from the **repository root**, not from `artifacts/globus-bank`.

## Vercel project settings

- Framework preset: Other (the repository includes `vercel.json`)
- Root directory: `./`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `PORT=24083 BASE_PATH=/ NODE_ENV=production pnpm run build`
- Output directory: `artifacts/globus-bank/dist/public`
- Node.js version: 24

The Vercel configuration routes API requests through `api/[...path].ts` and serves the Vite frontend as a static build.

## Environment variables

Configure these in Vercel for Preview and Production as appropriate:

- `DATABASE_URL`: PostgreSQL connection string for the matching environment.
- `CLERK_SECRET_KEY`: Clerk server secret. Keep it server-side.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key used by the API.
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key exposed to the Vite client.
- `BANK_DETAILS_ENCRYPTION_KEY`: the 32-byte encryption key in the exact encoding expected by the application's key decoder.
- `GLOBUS_ADMIN_CLERK_IDS`: authorized administrator Clerk user IDs, if configured by the application.
- `GLOBUS_ADMIN_EMAILS`: authorized administrator email addresses, if configured by the application.

Add any other integration credentials required by enabled features. Never put private credentials in variables prefixed with `VITE_`.

## Database and authentication

1. Provision PostgreSQL and use separate databases for Preview and Production.
2. Set `DATABASE_URL` for each Vercel environment.
3. Apply the repository's Drizzle migrations using the project's documented migration workflow before directing users to the deployment.
4. Configure Clerk's allowed application domains, sign-in/sign-up URLs, and redirect URLs for the Vercel deployment domain and any custom domain.
5. Confirm the encryption key is backed up securely. Losing it may make previously encrypted bank-detail data unreadable.

## Important runtime differences

- The API entrypoint performs a customer-ID backfill during a serverless instance's initialization. Confirm this operation is safe and idempotent for your production database.
- The API currently starts interval-based background jobs from its long-running server entrypoint. Vercel serverless functions are not persistent processes, so those intervals will not run reliably. Move those jobs to Vercel Cron or a separate persistent worker, and protect any scheduled endpoint with an authentication secret.
- Review any Replit-specific object storage, connector, or filesystem integrations. They may need a Vercel-compatible object-storage service or another replacement.
- Use a pooled PostgreSQL connection option suitable for serverless workloads and verify connection limits.

## Post-deployment checks

- Open `/api/healthz` and confirm it reports healthy.
- Load the frontend and verify client-side routes refresh correctly.
- Test Clerk sign-in and sign-out.
- Test database-backed flows and simulated wallet/transfer workflows.
- Verify administrator access controls.
- Review Vercel function logs for startup, database, and authentication errors.

## Financial product scope and safety

The repository's current product documentation describes Globus as **simulation-only**: balances and transfers are fictional, and no real money is moved. Do not present it as a live bank or enable real-money use merely by deploying it. Real-money services require the appropriate licensing or authorized banking partner, regulated payment integrations, KYC/AML controls, webhook verification, reconciliation, security review, and operational safeguards.
