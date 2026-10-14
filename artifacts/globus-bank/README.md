# Globus Bank

Globus Bank is a sandbox-first multi-currency wallet experience. It is software for exploring account and ledger workflows—not a licensed bank, custodian, payment institution, or source of real financial balances.

## Current capabilities

- Clerk email sign-in and sign-up, with a server-side Globus profile.
- USD, EUR, GBP, NGN, CAD and AUD wallets backed by a double-entry ledger.
- Development-only sandbox credit and member-to-member sandbox transfers.
- Transaction search, user profile settings, and recorded provider-setup requests.
- Server-authorized operations summary, account status actions, and ledger review.
- Public about, help, fees, privacy, terms and contact pages.

Deposits, withdrawals and currency exchanges are **not connected to a provider**. Their forms record a pending setup request only. They do not move funds or change a wallet balance. The contact page does not invent a support email address.

## Run and configure

The managed `artifacts/globus-bank: web` and `artifacts/api-server: API Server` workflows run the app and API. PostgreSQL is the workspace's managed development database.

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/globus-bank run typecheck
```

Replit-managed Clerk provisions `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`. Do not copy their values into source files, chat, or `.env.example`. The production Clerk proxy URL is platform-managed.

### Sandbox behavior

During development, a new account receives a one-time USD sandbox ledger credit of USD 2,500.00, explicitly described in the product as simulated value with no cash value. It exists only to exercise the internal transfer flow. The credit and all test transfers use balanced ledger entries and idempotency keys.

When the API runs in production, it does not seed sandbox value and returns an unavailable response for sandbox transfers. It has no live financial provider adapter. Provider request records remain pending and never post ledger entries.

### Administrator access

Set `GLOBUS_ADMIN_CLERK_IDS` in the API server environment to a comma-separated list of authorized Clerk user IDs. Leave it unset to keep the operations API unavailable. Do not grant access based on an email address supplied by the browser. The current build has one allowlisted administrator role; privileged MFA and additional roles still need to be configured and verified before production use.

See:

- [API reference](docs/api.md)
- [Security and production-readiness checklist](docs/security.md)
- [Backup and recovery](docs/operations.md)
- [Environment example](.env.example)
