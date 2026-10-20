---
name: Authentication diagnostics
description: Interpret production sign-in failures without resetting customer identities or exposing credentials.
---

Do not interpret a Clerk HTTP 422 or the app's generic sign-in error as proof of an incorrect password. Distinguish credential rejection, password security policies, rate limits, existing sessions, and required verification using Clerk's error code and current sign-in state.

**Why:** Generic errors previously hid the difference between credential rejection and other authentication failures, leading to speculative fixes without confirming the production cause.

**How to apply:** Handle returned errors before advancing a verification state. Public diagnostics may include only validated provider error codes, never provider messages, request payloads, passwords, codes, tokens, or identity metadata. Keep unknown identifiers and incorrect passwords indistinguishable. Confirm production behavior separately from preview and do not erase profiles or change managed credentials to troubleshoot.
