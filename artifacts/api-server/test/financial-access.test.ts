import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { eq } from "drizzle-orm";
import {
  bankRestrictionsTable,
  bankUsersTable,
  db,
  pool,
} from "@workspace/db";
import {
  bankOperationRestrictionError,
  getBankOperationEligibility,
} from "../src/lib/bank";

const userId = `financial-access-${randomUUID()}`;
const email = `${userId}@example.test`;

after(async () => {
  await db.delete(bankRestrictionsTable).where(eq(bankRestrictionsTable.userId, userId));
  await db.delete(bankUsersTable).where(eq(bankUsersTable.id, userId));
  await pool.end();
});

test("verification and operation-specific restrictions gate deposits and withdrawals independently", async () => {
  await db.insert(bankUsersTable).values({
    id: userId,
    email,
    verificationStatus: "pending",
  });

  assert.deepEqual(
    await getBankOperationEligibility(userId, "active", "pending"),
    { depositAllowed: false, withdrawalAllowed: false },
  );

  await db
    .update(bankUsersTable)
    .set({ verificationStatus: "approved" })
    .where(eq(bankUsersTable.id, userId));
  assert.deepEqual(
    await getBankOperationEligibility(userId, "active", "approved"),
    { depositAllowed: true, withdrawalAllowed: true },
  );

  await db.insert(bankRestrictionsTable).values({
    userId,
    type: "restrict_deposits",
    reason: "Test deposit-only restriction",
    createdByUserId: userId,
  });

  assert.deepEqual(
    await getBankOperationEligibility(userId, "active", "approved"),
    { depositAllowed: false, withdrawalAllowed: true },
  );
  const [depositError, withdrawalError] = await db.transaction(async (tx) => [
    await bankOperationRestrictionError(tx, { userId, operation: "deposit" }),
    await bankOperationRestrictionError(tx, { userId, operation: "withdrawal" }),
  ]);
  assert.match(depositError ?? "", /deposits are restricted/i);
  assert.equal(withdrawalError, null);
});
