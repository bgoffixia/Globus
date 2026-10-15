---
name: Clerk user identity reconciliation
description: Safe resolution of Globus profiles when Clerk IDs differ between app environments.
---

When a signed-in user arrives with a different Clerk ID in another app environment, resolve their server-verified primary email to the existing canonical Globus profile. Use the canonical database user ID for wallet ownership, transactions, and audit foreign keys. Keep authorization decisions based on the authenticated Clerk identity; do not trust a client-supplied email to select a profile.

**Why:** Separate Clerk environments can assign different IDs to the same email. Creating a second profile can collide with the unique email constraint or split a member’s existing wallet history.

**How to apply:** In authenticated bank routes, verify the primary email through Clerk, resolve the existing profile before loading or mutating records, and preserve that database identity across all related operations.
