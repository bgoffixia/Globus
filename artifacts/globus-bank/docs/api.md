# API reference

The API is served under `/api`. Banking routes require a valid Clerk session cookie. The server derives the current user from that session; clients cannot choose another user's identity. Request bodies and responses are defined in `lib/api-spec/openapi.yaml`.

## Account and wallet

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Service health |
| GET | `/bank/me` | Current user's profile |
| GET | `/bank/dashboard` | Profile, wallets and recent transactions |
| GET | `/bank/wallets` | Currency wallets and ledger-derived balances |
| PUT | `/bank/profile` | Save profile details and terms acceptance |
| GET | `/bank/transactions` | Filter by currency/status/search and limit |

## Simulated actions

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/bank/transfers` | Atomic, idempotent simulated transfer to a registered Globus member |
| POST | `/bank/external-transfers` | Atomic, simulated transfer to an external recipient name and country |
| POST | `/bank/incoming-external-transfers` | Atomic, simulated incoming transfer from a source name and country |
| POST | `/bank/simulation-requests` | Record a simulated deposit, withdrawal or exchange request |

A transfer creates balanced debit and credit ledger entries. An external recipient is represented by a simulation-clearing ledger account; no bank details are collected and no external account is contacted or credited. Provider requests stay `pending_provider_setup`; they do not debit, reserve or credit wallet funds.

## Administration

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/bank/admin/access` | Return whether the current session is allowlisted |
| GET | `/bank/admin/summary` | Stored user, wallet, request and ledger counts |
| GET | `/bank/admin/users` | Search users |
| PATCH | `/bank/admin/users/{userId}/status` | Suspend/reactivate with a reason and audit record |
| POST | `/bank/admin/users/{userId}/funding` | Add a simulated wallet credit with an audit reason |
| GET | `/bank/admin/ledger` | Review completed ledger transactions |

Admin APIs check `GLOBUS_ADMIN_CLERK_IDS` or `GLOBUS_ADMIN_EMAILS` on the server. Email allowlist entries are matched against the verified primary email returned by Clerk, not a client-supplied value. Funding is limited to 1,000,000.00 per entry, requires an active user wallet, and records both a balanced simulated ledger entry and an audit reason. Hiding an admin screen in the browser is not the authorization boundary.

All supported money values use decimal strings at the API boundary and integer minor units in PostgreSQL. Financial mutations accept an idempotency key. API errors return `{ "error": "..." }`.
