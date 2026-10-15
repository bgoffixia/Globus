---
name: Internal ledger boundaries
description: Product rules for Globus wallet, deposit, withdrawal, transfer, and customer-facing financial disclosures.
---

Globus must not connect to external banking providers, payment gateways, or real-money transfer APIs, and must not require third-party financial services. Deposits, member transfers, withdrawals, and administrative balance adjustments are internal ledger entries synchronized with the database.

Deposits credit a wallet only after administrator approval. Pending withdrawals reserve the requested amount; approval debits the wallet, while rejection releases the reserve. Internal member transfers post to both member wallets together. Downloadable receipts must clearly identify themselves as internal ledger records, not proof of outside payment.

Customer-facing language must not use the words “Demo” or “Simulation.” It must still disclose that balances are internal Globus records and no outside funds are received, held, or sent.

International transfer requests are internal records only: they do not contact an outside bank, reserve or debit a wallet, or send funds. The conversion calculator uses administrator-maintained rates stored with each request; these are not live market quotes. Retain only the recipient account's last four characters.

Globus member-to-member transfers are retired; keep historical entries readable. Customer routing offers separate local-routing and international-wire forms. Verified members can complete a routed transfer as a source-wallet debit balanced against an internal clearing entry; unverified members create a pending request for administrator review. Completion is never evidence of outside settlement, and receipts must state that clearly. New wallets and financial inputs exclude NGN. Preserve historical NGN records; convert any nonzero NGN balance to USD through an audited, balanced ledger operation before hiding or retiring that wallet.

Admin funding and correction adjustments share a maximum of 100,000,000 per currency. The second-approval threshold defaults to that maximum to minimize extra approvals; admins can change it. Credits to frozen wallets are allowed, and the wallet remains frozen.

**Why:** The user explicitly set these product and disclosure boundaries.

**Why:** The user requested an international transfer page with automatic currency conversion while prohibiting external banking and payment services; admin-maintained rates are the internal-only approach.

**Why:** The user chose one limit across currencies, a 100,000,000 maximum, minimal second approvals, and incoming credits to frozen wallets.

**Why:** The user chose to remove member transfers, retire NGN after conversion to USD, separate local routing from international wires, and allow verified members to complete transfers internally while sending unverified requests for admin review. Development and production balance checks found no current NGN balances to convert.

**How to apply:** Preserve these rules in future payment, wallet, transaction, receipt, admin, and customer-facing changes. Never hide a nonzero NGN balance; require a configured rate and an auditable ledger conversion first.
