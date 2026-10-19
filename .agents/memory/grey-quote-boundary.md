---
name: Grey quote boundary
description: Grey may provide read-only exchange-rate quotes, but all Globus balance activity stays internal.
---

Use Grey only for its dedicated currency-rate quote endpoint. Never call Grey's swap, charge, payout, or transfer endpoints. Save the exact quoted rate and retrieval time with Globus records. If a currency pair cannot be quoted, fail clearly rather than using administrator-maintained or guessed values. Grey quotes are not proof that an outside bank received or sent funds.

**Why:** The user chose Grey as the rate source while requiring Globus to keep all financial activity internal and avoid real-money transfer APIs.

**How to apply:** Preserve this boundary in transfer calculations, receipts, provider integrations, and customer-facing explanations.
