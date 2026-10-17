import assert from "node:assert/strict";
import test from "node:test";
import { conversionRatesMatch, convertMinorAmount, formatMinorAmount } from "../src/lib/bank";

test("converts minor units using the administrator-maintained rate", () => {
  assert.equal(convertMinorAmount(10_000n, "0.9200000000"), 9_200n);
  assert.equal(convertMinorAmount(100_000n, "1500.25"), 150_025_000n);
});

test("rounds destination minor units half up", () => {
  assert.equal(convertMinorAmount(1n, "0.5"), 1n);
  assert.equal(convertMinorAmount(3n, "0.5"), 2n);
});

test("respects zero, three, and four decimal destination currencies", () => {
  const yen = convertMinorAmount(10_000n, "150.12345", "JPY");
  assert.equal(yen, 15_012n);
  assert.equal(formatMinorAmount(yen, "JPY"), "15012");
  const dinar = convertMinorAmount(10_000n, "0.307155", "KWD");
  assert.equal(dinar, 30_716n);
  assert.equal(formatMinorAmount(dinar, "KWD"), "30.716");
  const indexed = convertMinorAmount(10_000n, "0.0256785", "CLF");
  assert.equal(indexed, 25_679n);
  assert.equal(formatMinorAmount(indexed, "CLF"), "2.5679");
  assert.equal(formatMinorAmount(-1n, "JPY"), "-1");
});

test("rate review detects changes without floating point rounding", () => {
  assert.equal(conversionRatesMatch("0001.25", "1.2500000000"), true);
  assert.equal(conversionRatesMatch("999999999999.0000000001", "999999999999.0000000002"), false);
  assert.equal(conversionRatesMatch("0.9", "0.9000000001"), false);
  assert.equal(conversionRatesMatch("1e2", "100"), false);
});

test("rejects invalid, zero, and overflowing conversion rates", () => {
  assert.throws(() => convertMinorAmount(100n, "0"), /greater than zero/);
  assert.throws(() => convertMinorAmount(100n, "1e2"), /invalid/);
  assert.throws(
    () => convertMinorAmount(100_000_000_000_000n, "100000000000"),
    /supported limit/,
  );
});
