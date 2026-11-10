import { createHash, randomUUID } from "node:crypto";
import type { File } from "@google-cloud/storage";
import { identityDocumentStorage } from "./identityDocumentStorage";

const sidecarEndpoint = "http://127.0.0.1:1106";
export const VAULT_PROOF_MAX_BYTES = 10 * 1024 * 1024;
export const VAULT_PROOF_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
] as const;

function privateObjectDirectory(): string {
  const directory = process.env.PRIVATE_OBJECT_DIR?.replace(/\/+$/, "");
  if (!directory) {
    throw new Error("Private App Storage is not configured.");
  }
  return directory;
}

function parseBucketObjectPath(fullPath: string): {
  bucketName: string;
  objectName: string;
} {
  const parts = fullPath.split("/").filter(Boolean);
  if (parts.length < 2) {
    throw new Error("Invalid private object path.");
  }
  return {
    bucketName: parts[0],
    objectName: parts.slice(1).join("/"),
  };
}

function ownerDirectory(userId: string): string {
  return createHash("sha256").update(userId).digest("hex");
}

export async function createVaultSubscriptionProofUploadUrl(
  userId: string,
): Promise<{ uploadUrl: string; objectPath: string }> {
  const objectId = randomUUID();
  const directory = ownerDirectory(userId);
  const objectName = `vault-subscription-proofs/${directory}/${objectId}`;
  const { bucketName, objectName: privateObjectName } = parseBucketObjectPath(
    `${privateObjectDirectory()}/${objectName}`,
  );
  const response = await fetch(`${sidecarEndpoint}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: privateObjectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to create payment proof upload URL (${response.status}).`);
  }
  const signed = (await response.json()) as { signed_url?: unknown };
  if (typeof signed.signed_url !== "string") {
    throw new Error("Payment proof upload URL response was invalid.");
  }
  return {
    uploadUrl: signed.signed_url,
    objectPath: `/objects/${objectName}`,
  };
}

export function getVaultSubscriptionProofFile(
  objectPath: string,
  userId: string,
): File {
  const match = objectPath.match(
    /^\/objects\/vault-subscription-proofs\/([a-f0-9]{64})\/([0-9a-f-]{36})$/i,
  );
  if (!match || match[1] !== ownerDirectory(userId)) {
    throw new Error("Invalid private payment proof path.");
  }
  const { bucketName, objectName } = parseBucketObjectPath(
    `${privateObjectDirectory()}/${objectPath.slice("/objects/".length)}`,
  );
  return identityDocumentStorage.bucket(bucketName).file(objectName);
}

export async function validateVaultSubscriptionProof(
  file: File,
  contentType: string,
  expectedSize: number,
): Promise<boolean> {
  if (
    !VAULT_PROOF_CONTENT_TYPES.includes(
      contentType as (typeof VAULT_PROOF_CONTENT_TYPES)[number],
    ) ||
    !Number.isSafeInteger(expectedSize) ||
    expectedSize < 1 ||
    expectedSize > VAULT_PROOF_MAX_BYTES
  ) {
    return false;
  }
  const [metadata] = await file.getMetadata();
  const actualSize = Number(metadata.size);
  if (
    !Number.isSafeInteger(actualSize) ||
    actualSize !== expectedSize ||
    (metadata.contentType && metadata.contentType !== contentType)
  ) {
    return false;
  }
  const [header] = await file.download({ start: 0, end: 7 });
  if (contentType === "application/pdf") {
    return header.subarray(0, 5).toString("ascii") === "%PDF-";
  }
  if (contentType === "image/jpeg") {
    return header[0] === 0xff && header[1] === 0xd8 && header[2] === 0xff;
  }
  return header.subarray(0, 8).equals(
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  );
}

export async function deleteVaultSubscriptionProof(
  objectPath: string,
  userId: string,
): Promise<void> {
  await getVaultSubscriptionProofFile(objectPath, userId).delete({
    ignoreNotFound: true,
  });
}
