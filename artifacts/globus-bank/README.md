# Globus Bank

Globus Bank is a simulation-only multi-currency wallet experience. It is software for exploring account and ledger workflows—not a licensed bank, custodian, payment institution, or source of real financial balances.

## Current capabilities

- Clerk email sign-in and sign-up, with a server-side Globus profile.
- USD, EUR, GBP, NGN, CAD and AUD wallets backed by a double-entry ledger.
- Simulated starting value and member-to-member or external-recipient transfers.
- Transaction search, user profile settings, and recorded provider-setup requests.
- Server-authorized operations summary, account status actions, and ledger review.
- Public about, help, fees, privacy, terms and contact pages.

Member and external-recipient transfers update fictional ledger records only. External recipient name and country are labels; no bank details are collected, and no outside account is credited. Deposits, withdrawals and currency exchanges are **not connected to a provider**; their forms record simulated requests only.

## Run and configure

The managed `artifacts/globus-bank: web` and `artifacts/api-server: API Server` workflows run the app and API. PostgreSQL is the workspace's managed development database.

```sh
pnpm --filter @workspace/api-spec run codegen
pnpm --filter @workspace/db run push
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/globus-bank run typecheck
```

Replit-managed Clerk provisions `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY` and `VITE_CLERK_PUBLISHABLE_KEY`. Do not copy their values into source files, chat, or `.env.example`. The production Clerk proxy URL is platform-managed.

### Simulation behavior

Each new account receives a one-time USD 2,500.00 simulated ledger credit. It is fictional and has no cash value. The credit and simulated transfers use balanced ledger entries and idempotency keys.

Simulated transfers are available in the published app and only alter fictional ledger entries. The app has no live financial provider adapter, and no simulated transaction contacts or credits an external account. Provider request records remain pending and never post to a real payment network.

### Administrator access

Set `GLOBUS_ADMIN_CLERK_IDS` in the API server environment to a comma-separated list of authorized Clerk user IDs. Leave it unset to keep the operations API unavailable. Do not grant access based on an email address supplied by the browser. The current build has one allowlisted administrator role; privileged MFA and additional roles still need to be configured and verified before production use.

See:

- [API reference](docs/api.md)
- [Security and production-readiness checklist](docs/security.md)
- [Backup and recovery](docs/operations.md)
- [Environment example](.env.example)
