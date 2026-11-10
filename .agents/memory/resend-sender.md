---
name: Resend sender configuration
description: Sending-only Resend access requires an explicitly configured verified sender.
---

Use the shared `GLOBUS_SECURITY_EMAIL_FROM` setting for password and security messages, and as the transfer-alert fallback; set it only to a Resend-verified sender address. Transfer alerts may use a customer's validated, unique local-part on the fixed `globus.website` domain with the fixed `GLOBUS BANK` display name. Keep that identity server-controlled and verify the domain with Resend before relying on delivery. The connected key can send email but cannot list or verify domains.

**Why:** Domain-list access was denied under the active Resend connection, while the send endpoint is separately supported. Inferring an address can fail delivery or cause a sender mismatch.

**How to apply:** Keep password/security messages on the shared verified sender. Only transfer-alert messages may use customer local-parts, and only on the fixed Globus domain; handle provider failures without exposing payloads or credentials.
