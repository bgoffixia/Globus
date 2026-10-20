import { clerkClient } from "@clerk/express";

const RESET_FLAG = "globusPasswordResetRequiredAt";
const cache = new Map<string, { required: boolean; expiresAt: number }>();
const CACHE_TTL_MS = 15_000;

export async function isPasswordResetRequired(userId: string): Promise<boolean> {
  const now = Date.now();
  const cached = cache.get(userId);
  if (cached && cached.expiresAt > now) return cached.required;

  const identity = await clerkClient.users.getUser(userId);
  const required = typeof identity.publicMetadata?.[RESET_FLAG] === "string";
  cache.set(userId, { required, expiresAt: now + CACHE_TTL_MS });
  return required;
}

export function setPasswordResetCache(userId: string, required: boolean): void {
  cache.set(userId, { required, expiresAt: Date.now() + CACHE_TTL_MS });
}
