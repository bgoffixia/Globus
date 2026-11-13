---
name: Private Vault subscription renewal
description: Customer-controlled Paystack recurring billing, supported intervals, and safe activation requirements.
---

Monthly and annual Vault plans can offer optional Paystack renewal; keep one-time checkout as the default. The three-month plan remains one-time because Paystack's supported plan intervals do not include quarterly. Automatic renewal must remain unavailable until the signed Paystack webhook is configured and tested for the environment; the server gates the option behind `PAYSTACK_VAULT_RECURRING_ENABLED=true`.

**Why:** A successful recurring charge must reliably extend access. Enabling charges before webhook delivery is working could bill a customer without updating their Vault access.

**How to apply:** Keep auto-renew unchecked by default. Configure the Paystack webhook to the app's `/api/bank/vault/paystack/webhook` endpoint and test signed subscription and renewal events before setting the recurring-enabled flag. Offer customers a Paystack management-email link to cancel or change a subscription.

Only a server-verified Paystack payment may activate Vault access. Manual proof submissions and administrator approval/rejection are disabled; administrators may revoke access, but cannot grant or approve it.

**Why:** The user explicitly requested automatic approval only after Paystack confirms the transaction and asked to disable administrator manual review.

**How to apply:** Keep customer checkout and webhook verification as the only activation paths. Treat legacy pending manual requests as inactive for customers and allow them to start Paystack checkout instead.

The server marks elapsed subscriptions as expired and deletes their Vault passcode sessions. Expiration revokes access but does not cancel Paystack auto-renewal; a later confirmed renewal can reactivate access.

**Why:** Expiry must remove access even if a customer leaves the Vault open, while an opted-in recurring payment should still be able to renew the plan.

**How to apply:** Keep expiry enforcement immediate in subscription checks and persist it through the server sweep. Preserve renewal identifiers and preferences unless Paystack confirms cancellation or the customer requests it.
