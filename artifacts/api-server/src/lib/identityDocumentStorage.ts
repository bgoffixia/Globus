import { randomUUID } from "node:crypto";
import { Storage, type File } from "@google-cloud/storage";

const sidecarEndpoint = "http://127.0.0.1:1106";
const identityDocumentMaxBytes = 10 * 1024 * 1024;

export const identityDocumentStorage = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${sidecarEndpoint}/token`,
    type: "external_account",
    credential_source: {
      url: `${sidecarEndpoint}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

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

export async function createIdentityDocumentUploadUrl(): Promise<{
  uploadUrl: string;
  objectPath: string;
}> {
  const objectId = randomUUID();
  const { bucketName, objectName } = parseBucketObjectPath(
    `${privateObjectDirectory()}/uploads/${objectId}`,
  );
  const response = await fetch(`${sidecarEndpoint}/object-storage/signed-object-url`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      bucket_name: bucketName,
      object_name: objectName,
      method: "PUT",
      expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    }),
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to create private upload URL (${response.status}).`);
  }
  const signed = (await response.json()) as { signed_url?: unknown };
  if (typeof signed.signed_url !== "string") {
    throw new Error("Private upload URL response was invalid.");
  }
  return {
    uploadUrl: signed.signed_url,
    objectPath: `/objects/uploads/${objectId}`,
  };
}

export function getIdentityDocumentFile(objectPath: string): File {
  if (!/^\/objects\/(?:uploads|identity)\/[0-9a-f-]{36}$/i.test(objectPath)) {
    throw new Error("Invalid identity document path.");
  }
  const { bucketName, objectName } = parseBucketObjectPath(
    `${privateObjectDirectory()}/${objectPath.slice("/objects/".length)}`,
  );
  return identityDocumentStorage.bucket(bucketName).file(objectName);
}

export async function sealIdentityDocumentUpload(
  uploadPath: string,
): Promise<string> {
  if (!/^\/objects\/uploads\/[0-9a-f-]{36}$/i.test(uploadPath)) {
    throw new Error("Invalid identity document upload path.");
  }
  const identityPath = `/objects/identity/${randomUUID()}`;
  await getIdentityDocumentFile(uploadPath).copy(
    getIdentityDocumentFile(identityPath),
  );
  return identityPath;
}

export async function validateUploadedIdentityDocument(
  file: File,
  contentType: string,
  expectedSize: number,
): Promise<boolean> {
  const [metadata] = await file.getMetadata();
  const actualSize = Number(metadata.size);
  if (
    !Number.isSafeInteger(actualSize) ||
    actualSize !== expectedSize ||
    actualSize < 8 ||
    actualSize > identityDocumentMaxBytes
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
  if (contentType === "image/png") {
    return header.subarray(0, 8).equals(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
  }
  return false;
}

export async function deleteIdentityDocumentObject(
  objectPath: string,
): Promise<void> {
  const file = getIdentityDocumentFile(objectPath);
  await file.delete({ ignoreNotFound: true });
}
