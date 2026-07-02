import assert from "node:assert/strict";
import test from "node:test";
import { calculateLedgerAmounts } from "./payroll";

test("meets benchmark regression case", () => {
  const result = calculateLedgerAmounts({
    sigs: 36,
    pay: 1,
    payRate: 1.5,
    validityPercent: 75,
    benchmarkPercent: 75,
  });

  assert.equal(result.payable, 36);
  assert.equal(result.totalPay, 54);
  assert.equal(result.upfront, 45.9);
  assert.equal(result.hold, 8.1);
});

test("below benchmark regression case", () => {
  const result = calculateLedgerAmounts({
    sigs: 36,
    pay: 1,
    payRate: 1.5,
    validityPercent: 70,
    benchmarkPercent: 75,
  });

  assert.equal(result.payable, 34);
  assert.equal(result.totalPay, 51);
  assert.equal(result.upfront, 43.35);
  assert.equal(result.hold, 7.65);
});

test("pending validity leaves payout fields empty", () => {
  const result = calculateLedgerAmounts({
    sigs: 36,
    pay: 1,
    payRate: 1.5,
    validityPercent: null,
    benchmarkPercent: 75,
  });

  assert.equal(result.estimatedPay, 36);
  assert.equal(result.payable, null);
  assert.equal(result.totalPay, null);
  assert.equal(result.validityPending, true);
});
