---
name: Internal ledger boundaries
description: Product rules for Globus wallet, deposit, withdrawal, transfer, and customer-facing financial disclosures.
---

Globus must not connect to external banking providers, payment gateways, or real-money transfer APIs, and must not require third-party financial services. Deposits, member transfers, withdrawals, and administrative balance adjustments are internal ledger entries synchronized with the database.

Deposits credit a wallet only after administrator approval. Pending withdrawals reserve the requested amount; approval debits the wallet, while rejection releases the reserve. Internal member transfers post to both member wallets together. Downloadable receipts must clearly identify themselves as internal ledger records, not proof of outside payment.

Customer-facing language must not use the words “Demo” or “Simulation.” It must still disclose that balances are internal Globus records and no outside funds are received, held, or sent.

International transfer requests are internal records only: they do not contact an outside bank, reserve or debit a wallet, or send funds. The conversion calculator uses administrator-maintained rates stored with each request; these are not live market quotes. Retain only the recipient account's last four characters.

**Why:** The user explicitly set these product and disclosure boundaries.

**Why:** The user requested an international transfer page with automatic currency conversion while prohibiting external banking and payment services; admin-maintained rates are the internal-only approach.

**How to apply:** Preserve these rules in any future payment, wallet, transaction, receipt, admin, or customer-facing copy changes.
