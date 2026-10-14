# Security and production-readiness checklist

## Enabled in this sandbox-first build

- Clerk authentication and authenticated API routes.
- Server-derived user identity and server-side administrator allowlisting.
- Zod validation for generated API bodies and query parameters.
- Same-origin checks on state-changing API requests.
- Rate limiting on sandbox financial request routes.
- Parameterized database operations through Drizzle.
- Decimal-safe minor-unit storage; atomic transfer posting; idempotency keys.
- Balanced ledger entries for development credits and internal transfers.
- No database balance-edit endpoint, real payment provider, or fabricated bank account details.
- Sandbox internal transfers and seed credits are disabled for `NODE_ENV=production`.

## Required before any real-money production use

- Obtain legal advice for each market, determine licensing/authorized-partner requirements, and approve customer disclosures. Do not claim Globus is a licensed bank or that funds are insured.
- Select and contract with a provider that authorizes the intended business, geography, currencies and payment use cases. Implement its official deposit, payout and exchange APIs.
- Verify webhook signatures, replay protections, idempotency, reconciliation, provider failures, refunds/reversals, limits and settlement states end-to-end in that provider's sandbox.
- Keep live provider credentials in Replit Secrets. Never expose them to browser code or logs.
- Add verified recipient destinations, KYC document storage with access controls, KYC/AML/sanctions review, transaction monitoring and complaint/record-retention processes applicable to the markets served.
- Configure and test MFA for privileged users. Limit admin IDs in `GLOBUS_ADMIN_CLERK_IDS`, split least-privilege roles, and review the append-only audit trail.
- Review CSRF/origin handling, rate limits across multiple API instances, session policy, encryption-at-rest posture, monitoring, alerts and incident response.
- Test concurrency, insufficient funds, duplicate provider events, reversal accounting and per-currency reconciliation against the real provider.
- Have security, privacy, accounting and regulatory professionals review the system and customer-facing policies.

Until these items are complete, keep the app in sandbox mode. This checklist is not a compliance certification or legal opinion.
