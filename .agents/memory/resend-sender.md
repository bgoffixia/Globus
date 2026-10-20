---
name: Resend sender configuration
description: Sending-only Resend access requires an explicitly configured verified sender.
---

Use the shared `GLOBUS_SECURITY_EMAIL_FROM` setting for transactional email, and set it only to a Resend-verified sender address. The connected key can send email but cannot list or verify domains.

**Why:** Domain-list access was denied under the active Resend connection, while the send endpoint is separately supported. Inferring an address can fail delivery or cause a sender mismatch.

**How to apply:** For new transactional email paths, read the sender from this shared variable and handle provider failures without exposing payloads or credentials.
