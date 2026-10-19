---
name: Flutterwave quote boundary
description: Provider-rate quotes support Globus conversion calculations without enabling external financial movement.
---

Use Flutterwave only for read-only transfer-rate quotes. Save the exact quoted rate and retrieval time with the Globus transaction and receipt. If a currency pair cannot be quoted, fail clearly; do not fall back to administrator-maintained rates or guessed values. Globus does not call payment, payout, or FX-trade endpoints. Deposit methods create requests only, and balances change only after an administrator approves them.

**Why:** The user explicitly chose Flutterwave for rates while requiring no payment gateway or real-money transfer API.

**How to apply:** Preserve this boundary in transfer calculations, receipts, provider integrations, and deposit workflows. Never describe a Globus record or rate quote as proof that an outside bank received or sent funds.
