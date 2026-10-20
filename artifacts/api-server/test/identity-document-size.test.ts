import assert from "node:assert/strict";
import { test } from "node:test";
import type { File } from "@google-cloud/storage";
import { CreateIdentityDocumentUploadUrlBody } from "@workspace/api-zod";
import { validateUploadedIdentityDocument } from "../src/lib/identityDocumentStorage";

const maxSizeBytes = 10 * 1024 * 1024;

function mockPdf(size: number): File {
  return {
    getMetadata: async () => [{ size: String(size) }],
    download: async () => [Buffer.from("%PDF-1.7")],
  } as unknown as File;
}

test("identity upload contract accepts non-empty files up to 10 MB without a 5 MB minimum", () => {
  for (const sizeBytes of [1, 5, maxSizeBytes]) {
    assert.equal(
      CreateIdentityDocumentUploadUrlBody.safeParse({
        contentType: "application/pdf",
        sizeBytes,
      }).success,
      true,
    );
  }

  for (const sizeBytes of [0, maxSizeBytes + 1]) {
    assert.equal(
      CreateIdentityDocumentUploadUrlBody.safeParse({
        contentType: "application/pdf",
        sizeBytes,
      }).success,
      false,
    );
  }
});

test("stored identity documents accept small valid PDFs and the exact 10 MB limit", async () => {
  assert.equal(
    await validateUploadedIdentityDocument(mockPdf(8), "application/pdf", 8),
    true,
  );
  assert.equal(
    await validateUploadedIdentityDocument(
      mockPdf(maxSizeBytes),
      "application/pdf",
      maxSizeBytes,
    ),
    true,
  );
});

test("stored identity documents reject empty and over-limit files", async () => {
  assert.equal(
    await validateUploadedIdentityDocument(mockPdf(0), "application/pdf", 0),
    false,
  );
  assert.equal(
    await validateUploadedIdentityDocument(
      mockPdf(maxSizeBytes + 1),
      "application/pdf",
      maxSizeBytes + 1,
    ),
    false,
  );
});
