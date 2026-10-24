---
name: Identity review and retention
description: Globus identity-review access, optional document uploads, and file-retention rules.
---

Members may submit an identity-review request without attaching files; an authorized admin must still make an explicit decision. When files are attached, they must stay private and be accessible only to the submitting member and authorized admins. Delete stored files and document metadata after approval or rejection. Keep documents while a review is pending or more information is required; preserve the final status and audit record after file deletion. Internal review must not be described as independent legal, bank, or government identity verification.

Each identity document must be a non-empty PDF, JPG, or PNG no larger than 10 MB; allow no more than five files per submission. Enforce the size limits both before issuing an upload URL and against the stored object after upload.

Allowlisted administrators may submit their own documents and approve their own internal identity review. Record the decision in the audit log and disclose that self-approval is not independent identity verification.

Admins can configure a shared dashboard warning for every member whose verification is not approved. The warning clears automatically after approval; account restrictions remain independent.

**Why:** The user selected private document review and deletion after a final decision, asked to allow requests without images and admin self-approval, and asked for a dashboard warning until approval.

**How to apply:** Allow zero-file requests but require an explicit admin decision. Preserve the private 0–10 MB per-file range (maximum five files), delete uploaded documents after the final decision, and retain audit history. Derive warning visibility from verification status and keep it separate from account restrictions.
