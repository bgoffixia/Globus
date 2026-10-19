---
name: Exchange-rate quote boundary
description: Frankfurter is the primary reference-rate source and Grey is a read-only fallback; all Globus balance activity stays internal.
---

Use Frankfurter's published reference-rate endpoint first, with Grey's dedicated currency-rate quote endpoint as fallback. Never call Grey's swap, charge, payout, or transfer endpoints. Save the exact quoted rate and retrieval time with Globus records. If neither source can quote a currency pair, fail clearly rather than using administrator-maintained or guessed values. Quotes are not proof that an outside bank received or sent funds.

**Why:** The user asked to add Frankfurter after selecting Grey, while requiring Globus to keep all financial activity internal and avoid real-money transfer APIs.

**How to apply:** Prefer Frankfurter for transfer calculations; use Grey only if Frankfurter is unavailable. Preserve the read-only boundary in receipts and customer-facing explanations.
