---
name: Transaction PIN security
description: Security rule for member transaction PINs and administrator reset access.
---

Store transaction PINs only as secure hashes. Administrators may reset a member's PIN, but must not view or assign the member's PIN; the member sets a new PIN after reset.

**Why:** A transaction PIN authorizes ledger activity, so administrator access to its value would weaken member control and auditability.

**How to apply:** Keep PIN values out of responses, logs, and admin screens. Require a member-configured PIN for ledger actions, and make admin reset clear the hash and require member re-enrollment.
