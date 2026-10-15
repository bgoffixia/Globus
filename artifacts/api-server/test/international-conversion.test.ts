import assert from "node:assert/strict";
import test from "node:test";
import { convertMinorAmount } from "../src/lib/bank";

test("converts minor units using the administrator-maintained rate", () => {
  assert.equal(convertMinorAmount(10_000n, "0.9200000000"), 9_200n);
  assert.equal(convertMinorAmount(100_000n, "1500.25"), 150_025_000n);
});

test("rounds destination minor units half up", () => {
  assert.equal(convertMinorAmount(1n, "0.5"), 1n);
  assert.equal(convertMinorAmount(3n, "0.5"), 2n);
});

test("rejects invalid, zero, and overflowing conversion rates", () => {
  assert.throws(() => convertMinorAmount(100n, "0"), /greater than zero/);
  assert.throws(() => convertMinorAmount(100n, "1e2"), /invalid/);
  assert.throws(
    () => convertMinorAmount(100_000_000_000_000n, "100000000000"),
    /supported limit/,
  );
});
