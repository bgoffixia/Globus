# Globus Bank

A sandbox-first multi-currency wallet experience for exploring ledger-backed account activity without implying that test records are real money or that Globus is a licensed bank.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/globus-bank/` — responsive web app and public information pages
- `artifacts/api-server/` — Clerk-authenticated API, user operations, ledger posting and restricted admin routes
- `lib/db/src/schema/bank.ts` — PostgreSQL banking tables and enums
- `lib/api-spec/openapi.yaml` — source of truth for typed API contracts
- `artifacts/globus-bank/docs/` — API reference, security checklist and recovery instructions

## Architecture decisions

- Clerk handles sign-in; the API creates a Globus profile and currency wallets on first account access.
- Sandbox account value is ledger-posted only in development. Sandbox transfers are blocked when `NODE_ENV=production`.
- Deposits, withdrawals and exchanges create provider-setup requests only; they never change wallet balances.
- Administrator API access is controlled by the server-side `GLOBUS_ADMIN_CLERK_IDS` allowlist.
- Money values are stored in integer minor units, and balances are derived from double-entry ledger entries.

## Product

Public Globus information pages, Clerk sign-in, a multi-currency account dashboard, wallet and transaction views, member-to-member sandbox transfers, recorded provider-setup requests, account settings, and an allowlisted operations area.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

_Populate as you build — sharp edges, "always run X before Y" rules._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
