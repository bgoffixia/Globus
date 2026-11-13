# Deploy Globus on Vercel

Globus is configured as a **Vercel multi-service project** from the repository root.

## Services and public routing

| Service | Root | Framework | Public route |
|---|---|---|---|
| `api-server` | `artifacts/api-server` | Express | `/api` and `/api/*` |
| `globus-bank` | `artifacts/globus-bank` | Vite | All remaining paths (`/*`) |
| `mockup-sandbox` | — | — | Excluded from this Vercel project |

The API rewrites are listed before the frontend catch-all. Both services receive the original path; the API app already mounts its router at `/api`.

## Vercel import

1. Import GitHub repository `bgoffixia/Globus`.
2. Use the repository root as the project configuration directory so Vercel reads the root `vercel.json`.
3. Select the multi-service project import option. Do not import only `artifacts/globus-bank` as a standalone project.
4. The root `vercel.json` defines each service root and build command. The mockup sandbox is intentionally omitted.

The repository is a pnpm workspace. Ensure Vercel installs dependencies from the workspace lockfile at the repository root and uses a Node.js version compatible with the repository (Node 24 is the intended version). If the import UI asks for a single root directory or a single framework, return to the multi-service import flow rather than choosing one service.

## Environment variables

Configure the required variables for the services that use them. Shared project variables may be available to both services; keep secrets server-side.

- `DATABASE_URL`: PostgreSQL connection string.
- `CLERK_SECRET_KEY`: Clerk server secret.
- `CLERK_PUBLISHABLE_KEY`: Clerk publishable key used by the API.
- `VITE_CLERK_PUBLISHABLE_KEY`: Clerk publishable key exposed to the Vite client.
- `BANK_DETAILS_ENCRYPTION_KEY`: 32-byte encryption key in the exact encoding expected by the application's key decoder.
- `GLOBUS_ADMIN_CLERK_IDS`: authorized administrator Clerk user IDs, if configured by the application.
- `GLOBUS_ADMIN_EMAILS`: authorized administrator email addresses, if configured by the application.

Use separate Preview and Production database credentials where possible. Never put private credentials in variables prefixed with `VITE_`. Add any additional provider credentials required by enabled integrations.

## Database and authentication

1. Provision PostgreSQL and set `DATABASE_URL` for Preview and Production.
2. Apply the repository's Drizzle migrations using the project's migration workflow before sending production traffic.
3. Configure Clerk's allowed application domains, sign-in/sign-up URLs, and redirect URLs for the Vercel preview and production domains.
4. Back up the encryption key securely. Losing it may make previously encrypted bank-detail data unreadable.
5. Verify connection pooling and database connection limits for serverless/elastic compute.

## Service communication and bindings

The browser frontend currently calls the API through same-origin relative `/api` paths. The public Vercel rewrites route those requests to `api-server`, so no service binding is currently necessary. No API-to-frontend or sandbox-to-other-service call was identified in the inspected source. If server-side service-to-service calls are added later, declare a binding on the calling service and read the injected environment variable at runtime.

## Runtime considerations

- The Express entrypoint currently performs customer-ID backfill on startup and starts interval-based Private Vault expiration and expiry-reminder jobs. Serverless/elastic service instances are not guaranteed to remain alive, so interval jobs will not run reliably. Move scheduled work to Vercel Cron or a dedicated persistent worker and protect scheduled endpoints.
- Confirm the customer-ID backfill is idempotent and safe if more than one instance starts concurrently.
- Review Replit-specific object storage and connector integrations. They may need a Vercel-compatible object-storage service or another replacement.
- The mockup sandbox is excluded and will not be deployed as part of this project.

## Post-deployment checks

- Open `/api/healthz` and confirm it reports healthy.
- Load the frontend and refresh nested client-side routes.
- Test Clerk sign-in/sign-out and session persistence.
- Test database-backed and simulated wallet/transfer flows.
- Verify administrator authorization.
- Review service-specific Vercel logs for startup, database, and authentication errors.

## Financial product scope

The repository's current product documentation describes Globus as **simulation-only**: balances and transfers are fictional, and no real money is moved. Deploying the application does not authorize real-money banking or payment activity. Real-money services require appropriate licensing or an authorized partner, regulated payment integrations, KYC/AML controls, webhook verification, reconciliation, security review, and operational safeguards.
