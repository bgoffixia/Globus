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

## Sandbox actions

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/bank/transfers` | Atomic, idempotent sandbox transfer to a registered Globus member |
| POST | `/bank/sandbox-requests` | Record a pending deposit, withdrawal or exchange request |

A transfer creates balanced debit and credit ledger entries in development. It is blocked in production. Provider requests stay `pending_provider_setup`; they do not debit, reserve or credit wallet funds.

## Administration

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/bank/admin/access` | Return whether the current session is allowlisted |
| GET | `/bank/admin/summary` | Stored user, wallet, request and ledger counts |
| GET | `/bank/admin/users` | Search users |
| PATCH | `/bank/admin/users/{userId}/status` | Suspend/reactivate with a reason and audit record |
| GET | `/bank/admin/ledger` | Review completed ledger transactions |

Admin APIs check `GLOBUS_ADMIN_CLERK_IDS` on the server. Hiding an admin screen in the browser is not the authorization boundary.

All supported money values use decimal strings at the API boundary and integer minor units in PostgreSQL. Financial mutations accept an idempotency key. API errors return `{ "error": "..." }`.
