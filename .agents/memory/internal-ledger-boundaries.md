---
name: Internal ledger boundaries
description: Product rules for Globus wallet, deposit, withdrawal, transfer, and customer-facing financial disclosures.
---

Globus must not connect to external banking providers, payment gateways, or real-money transfer APIs, and must not require third-party financial services. Deposits, member transfers, withdrawals, and administrative balance adjustments are internal ledger entries synchronized with the database.

Only identity-verified members who pass the applicable account and operation restrictions may use deposit or withdrawal features. Active Private Vault subscribers' wallet top-ups are credited immediately after PIN, subscription, account, wallet, and restriction checks; deposit requests are not sent to administrators for review. Withdrawals remain administrator-approved. Pending withdrawals reserve the requested amount; approval debits the wallet, while rejection releases the reserve. Internal member transfers post to both member wallets together. Downloadable receipts must clearly identify themselves as internal ledger records, not proof of outside payment.

Customer-facing language must not use the words “Demo” or “Simulation.” It must still disclose that balances are internal Globus records and no outside funds are received, held, or sent.

International transfer requests are internal records only: they do not contact an outside bank, reserve or debit a wallet, or send funds. The conversion calculator uses administrator-maintained rates stored with each request; these are not live market quotes. Retain only the recipient account's last four characters.

Saved card references retain only card brand and last four digits; never collect or store full card numbers or security codes. Saved bank account numbers/IBANs may be stored only as AES-256-GCM ciphertext protected by `BANK_DETAILS_ENCRYPTION_KEY`; expose only bank metadata and the last four characters to users, administrators, APIs, and audit records. If the key is missing or invalid, fail closed and do not save the account number. Subscriber top-ups never collect card/bank details or charge externally; withdrawal requests remain administrator-reviewed and must not pay out externally.

Globus member-to-member transfers are retired; keep historical entries readable. Customer routing uses one Transfer entry point and a five-step wizard with explicit local-routing and international-wire tabs: route/wallet/country/bank/currency, recipient details, amount/conversion, review/confirmation, and keypad PIN authorisation with a receipt modal. The country search opens directly below its picker. Verified members can complete a routed transfer as a source-wallet debit balanced against an internal clearing entry; unverified members create a pending request for administrator review. Completion is never evidence of outside settlement, and receipts must state that clearly. Destination currencies are independent of the supported source wallets; support standard currencies and suggest the country's currency while allowing another account currency. An administrator-configured conversion rate is still required. New wallets and source-wallet inputs exclude NGN, but NGN is permitted as a destination currency. Preserve historical NGN records; convert any nonzero NGN balance to USD through an audited, balanced ledger operation before hiding or retiring that wallet.

Admin funding and correction adjustments share a maximum of 100,000,000 per currency. The second-approval threshold defaults to that maximum to minimize extra approvals; admins can change it. Credits to frozen wallets are allowed, and the wallet remains frozen.

Customer private-vault controls are per wallet and prospective: they may enable/disable future transfers, deposits, and withdrawals, and choose future transfer handling. New wallets default to rejecting new transfer requests; vault controls never rewrite existing transaction status or ledger history.

**Why:** The user explicitly set these product and disclosure boundaries.

**Why:** The user requested an international transfer page with automatic currency conversion while prohibiting external banking and payment services; admin-maintained rates are the internal-only approach.

**Why:** The user chose one limit across currencies, a 100,000,000 maximum, minimal second approvals, and incoming credits to frozen wallets.

**Why:** The user chose “Reject new transactions” as the private vault’s future-request behavior.

**Why:** The user requested saved cards without enabling real-money services, then chose encrypted full bank-account storage while requiring card details to remain masked in administrator views.

**Why:** The user requires verified customers to pass separate deposit and withdrawal restrictions before those request forms are enabled.

**Why:** The user chose automatic wallet credit for subscribed customers' deposits and later asked that deposit review be removed from the admin workflow.

**Why:** The user chose to remove member transfers, retire the NGN wallet after conversion to USD, and allow verified members to complete transfers internally while sending unverified requests for admin review. The user subsequently requested one five-step Transfer workflow with route tabs, a below-picker country search, an on-screen PIN keypad, and destination currencies beyond supported source-wallet currencies.

**How to apply:** Preserve these rules in future payment, wallet, transaction, receipt, admin, and customer-facing changes. Never hide a nonzero NGN balance; require a configured rate and an auditable ledger conversion first.

**How to apply:** Never collect full card numbers or CVV. Bank account numbers require the dedicated encryption secret, stable key retention, and masked-only responses; never send plaintext into logs or audit records. Keep deposit credits and withdrawal debits administrator-reviewed, with verification and restrictions checked on the server at submission and commit.

**How to apply:** Enforce each wallet toggle on the backend at submission and before commit. Require active Vault subscription for deposits, credit them in the same balanced ledger transaction, and keep them out of admin review queues. Keep customer controls separate from administrator restrictions, and treat all customer policy changes as forward-only.
