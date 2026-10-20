---
name: Identity-document retention
description: Globus simulation identity-review access and file-retention rules.
---

For Globus identity review, uploaded documents must stay private and be accessible only to the submitting member and authorized admins. Delete the stored files and document metadata after approval or rejection. Keep documents while a review is pending or more information is required; preserve the final status and audit record after file deletion. This workflow is an internal simulation review, not legal, bank, or government identity verification.

Each identity document must be a PDF, JPG, or PNG between 5 MB and 10 MB; allow no more than five files per submission. Enforce the size limits both before issuing an upload URL and against the stored object after upload.

Allowlisted administrators may submit their own documents and approve their own internal identity review. Record the decision in the audit log and disclose that self-approval is not independent identity verification.

**Why:** The user selected document review and deletion after a final decision. Identity documents also require restricted access and a clear disclosure that the review is not external KYC.

**Why:** The user explicitly asked that admins be allowed to approve their own verification.

**Why:** The user confirmed a minimum upload size of 5 MB per file; the existing maximum and file-count rules remain in force.

**How to apply:** Preserve this lifecycle, disclosure, and 5–10 MB per-file range (maximum five files) when changing identity review or document storage. Enforce size boundaries at request time and after object upload. Permit allowlisted admin self-approval only with an audit record and clear disclosure.
