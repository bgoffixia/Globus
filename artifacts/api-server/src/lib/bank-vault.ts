import {
  createHash,
  randomBytes,
  scrypt,
  timingSafeEqual,
} from "node:crypto";
import { and, eq, gt, lte } from "drizzle-orm";
import {
  bankUsersTable,
  bankVaultSessionsTable,
  db,
} from "@workspace/db";

const KEY_LENGTH = 64;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const SESSION_DURATION_MS = 15 * 60 * 1000;

export type VaultPasscodeResult =
  | "valid"
  | "invalid"
  | "not_configured"
  | "subscription_required"
  | "locked"
  | "missing_user";

export type VaultSubscriptionState =
  | "inactive"
  | "pending"
  | "active"
  | "rejected"
  | "expired";

export function vaultSubscriptionStatus(
  status: string,
  expiresAt: Date | null,
  now = new Date(),
): VaultSubscriptionState {
  if (status === "active" && expiresAt && expiresAt <= now) return "expired";
  if (["inactive", "pending", "active", "rejected", "expired"].includes(status)) {
    return status as VaultSubscriptionState;
  }
  return "inactive";
}

export function hasActiveVaultSubscription(user: {
  vaultSubscriptionStatus: string;
  vaultSubscriptionExpiresAt: Date | null;
}, now = new Date()): boolean {
  return vaultSubscriptionStatus(
    user.vaultSubscriptionStatus,
    user.vaultSubscriptionExpiresAt,
    now,
  ) === "active";
}

export function resolveFutureTransferStatus(
  mode: string,
  memberEligibleForImmediatePosting: boolean,
): "completed" | "pending" | "failed" {
  const normalized =
    mode === "normal" ? "successful" :
      mode === "hold" ? "pending" :
        mode === "reject" ? "failed" :
          mode;
  if (normalized === "failed") return "failed";
  if (normalized === "pending" || !memberEligibleForImmediatePosting) return "pending";
  return "completed";
}

function derive(passcode: string, salt: Buffer): Promise<Buffer> {
  const pepper = process.env.SESSION_SECRET;
  if (!pepper) throw new Error("Vault passcode security is unavailable.");
  return new Promise((resolve, reject) => {
    scrypt(`${passcode}:${pepper}`, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

async function hashPasscode(passcode: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(passcode, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function comparePasscode(
  passcode: string,
  encodedHash: string,
): Promise<boolean> {
  const parts = encodedHash.split("$");
  if (
    parts.length !== 3 ||
    parts[0] !== "scrypt" ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !/^[a-f0-9]{128}$/.test(parts[2])
  ) {
    return false;
  }
  const expected = Buffer.from(parts[2], "hex");
  const actual = await derive(passcode, Buffer.from(parts[1], "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function initializeVaultPasscode(
  userId: string,
  passcode: string,
): Promise<boolean> {
  const encodedHash = await hashPasscode(passcode);
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        id: bankUsersTable.id,
        configured: bankUsersTable.vaultPasscodeHash,
        subscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
        subscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user) return false;
    if (!hasActiveVaultSubscription({
      vaultSubscriptionStatus: user.subscriptionStatus,
      vaultSubscriptionExpiresAt: user.subscriptionExpiresAt,
    })) return false;
    if (user.configured) return false;
    await tx
      .update(bankUsersTable)
      .set({
        vaultPasscodeHash: encodedHash,
        vaultPasscodeFailedAttempts: 0,
        vaultPasscodeLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(bankUsersTable.id, userId));
    return true;
  });
}

export async function unlockVault(
  userId: string,
  passcode: string,
): Promise<
  | { result: "valid"; sessionToken: string; expiresAt: Date }
  | { result: Exclude<VaultPasscodeResult, "valid"> }
> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        hash: bankUsersTable.vaultPasscodeHash,
        attempts: bankUsersTable.vaultPasscodeFailedAttempts,
        lockedUntil: bankUsersTable.vaultPasscodeLockedUntil,
        subscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
        subscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user) return { result: "missing_user" as const };
    if (!hasActiveVaultSubscription({
      vaultSubscriptionStatus: user.subscriptionStatus,
      vaultSubscriptionExpiresAt: user.subscriptionExpiresAt,
    })) return { result: "subscription_required" as const };
    if (!user.hash) return { result: "not_configured" as const };
    const now = new Date();
    if (user.lockedUntil && user.lockedUntil > now) {
      return { result: "locked" as const };
    }
    if (!(await comparePasscode(passcode, user.hash))) {
      const attempts = user.attempts + 1;
      const locked = attempts >= MAX_FAILED_ATTEMPTS;
      await tx
        .update(bankUsersTable)
        .set({
          vaultPasscodeFailedAttempts: locked ? 0 : attempts,
          vaultPasscodeLockedUntil: locked
            ? new Date(now.getTime() + LOCK_DURATION_MS)
            : null,
        })
        .where(eq(bankUsersTable.id, userId));
      return { result: locked ? "locked" as const : "invalid" as const };
    }
    await tx
      .update(bankUsersTable)
      .set({
        vaultPasscodeFailedAttempts: 0,
        vaultPasscodeLockedUntil: null,
      })
      .where(eq(bankUsersTable.id, userId));
    await tx
      .delete(bankVaultSessionsTable)
      .where(
        and(
          eq(bankVaultSessionsTable.userId, userId),
          lte(bankVaultSessionsTable.expiresAt, now),
        ),
      );
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + SESSION_DURATION_MS);
    await tx.insert(bankVaultSessionsTable).values({
      userId,
      tokenHash: createHash("sha256").update(sessionToken).digest("hex"),
      expiresAt,
    });
    return { result: "valid" as const, sessionToken, expiresAt };
  });
}

export async function isVaultSessionActive(
  userId: string,
  sessionToken: string,
): Promise<boolean> {
  const [user] = await db
    .select({
      vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
      vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
    })
    .from(bankUsersTable)
    .where(eq(bankUsersTable.id, userId))
    .limit(1);
  if (!user || !hasActiveVaultSubscription(user)) return false;
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  const [session] = await db
    .select({ id: bankVaultSessionsTable.id })
    .from(bankVaultSessionsTable)
    .where(
      and(
        eq(bankVaultSessionsTable.userId, userId),
        eq(bankVaultSessionsTable.tokenHash, tokenHash),
        gt(bankVaultSessionsTable.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return !!session;
}

export async function updateVaultPasscode(
  userId: string,
  sessionToken: string,
  newPasscode: string,
): Promise<boolean> {
  const newHash = await hashPasscode(newPasscode);
  const tokenHash = createHash("sha256").update(sessionToken).digest("hex");
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        vaultSubscriptionStatus: bankUsersTable.vaultSubscriptionStatus,
        vaultSubscriptionExpiresAt: bankUsersTable.vaultSubscriptionExpiresAt,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user || !hasActiveVaultSubscription(user)) return false;
    const [session] = await tx
      .select({ id: bankVaultSessionsTable.id })
      .from(bankVaultSessionsTable)
      .where(
        and(
          eq(bankVaultSessionsTable.userId, userId),
          eq(bankVaultSessionsTable.tokenHash, tokenHash),
          gt(bankVaultSessionsTable.expiresAt, new Date()),
        ),
      )
      .limit(1)
      .for("update");
    if (!session) return false;
    await tx
      .update(bankUsersTable)
      .set({
        vaultPasscodeHash: newHash,
        vaultPasscodeFailedAttempts: 0,
        vaultPasscodeLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(bankUsersTable.id, userId));
    await tx
      .delete(bankVaultSessionsTable)
      .where(eq(bankVaultSessionsTable.userId, userId));
    return true;
  });
}
