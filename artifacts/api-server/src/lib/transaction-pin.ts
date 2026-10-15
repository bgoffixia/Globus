import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { bankUsersTable, db } from "@workspace/db";

const KEY_LENGTH = 64;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

export type TransactionPinResult =
  | "valid"
  | "invalid"
  | "not_configured"
  | "locked"
  | "missing_user";

export type TransactionPinUpdateResult =
  | "updated"
  | "current_pin_required"
  | "invalid"
  | "locked"
  | "missing_user";

function derivePinKey(pin: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(pin, salt, KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashTransactionPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derivePinKey(pin, salt);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function matchesTransactionPin(pin: string, encodedHash: string): Promise<boolean> {
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
  const actual = await derivePinKey(pin, Buffer.from(parts[1], "hex"));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

async function recordFailure(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  userId: string,
  failedAttempts: number,
): Promise<TransactionPinResult> {
  const nextAttempts = failedAttempts + 1;
  const locked = nextAttempts >= MAX_FAILED_ATTEMPTS;
  await tx
    .update(bankUsersTable)
    .set({
      transactionPinFailedAttempts: locked ? 0 : nextAttempts,
      transactionPinLockedUntil: locked
        ? new Date(Date.now() + LOCK_DURATION_MS)
        : null,
      updatedAt: new Date(),
    })
    .where(eq(bankUsersTable.id, userId));
  return locked ? "locked" : "invalid";
}

export async function verifyTransactionPin(
  userId: string,
  pin: string,
): Promise<TransactionPinResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        transactionPinHash: bankUsersTable.transactionPinHash,
        failedAttempts: bankUsersTable.transactionPinFailedAttempts,
        lockedUntil: bankUsersTable.transactionPinLockedUntil,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user) return "missing_user";
    if (!user.transactionPinHash) return "not_configured";
    if (user.lockedUntil && user.lockedUntil > new Date()) return "locked";
    if (!(await matchesTransactionPin(pin, user.transactionPinHash))) {
      return recordFailure(tx, userId, user.failedAttempts);
    }
    await tx
      .update(bankUsersTable)
      .set({
        transactionPinFailedAttempts: 0,
        transactionPinLockedUntil: null,
      })
      .where(eq(bankUsersTable.id, userId));
    return "valid";
  });
}

export async function updateTransactionPin(
  userId: string,
  newPin: string,
  currentPin?: string,
): Promise<TransactionPinUpdateResult> {
  return db.transaction(async (tx) => {
    const [user] = await tx
      .select({
        transactionPinHash: bankUsersTable.transactionPinHash,
        failedAttempts: bankUsersTable.transactionPinFailedAttempts,
        lockedUntil: bankUsersTable.transactionPinLockedUntil,
      })
      .from(bankUsersTable)
      .where(eq(bankUsersTable.id, userId))
      .for("update");
    if (!user) return "missing_user";

    if (user.transactionPinHash) {
      if (!currentPin) return "current_pin_required";
      if (user.lockedUntil && user.lockedUntil > new Date()) return "locked";
      if (!(await matchesTransactionPin(currentPin, user.transactionPinHash))) {
        return recordFailure(tx, userId, user.failedAttempts) === "locked"
          ? "locked"
          : "invalid";
      }
    }

    const transactionPinHash = await hashTransactionPin(newPin);
    await tx
      .update(bankUsersTable)
      .set({
        transactionPinHash,
        transactionPinFailedAttempts: 0,
        transactionPinLockedUntil: null,
        updatedAt: new Date(),
      })
      .where(eq(bankUsersTable.id, userId));
    return "updated";
  });
}
