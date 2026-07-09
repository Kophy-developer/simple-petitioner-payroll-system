import assert from "node:assert/strict";
import test from "node:test";
import { calculateLedgerAmounts } from "./payroll";

test("validity standard meets benchmark", () => {
  const result = calculateLedgerAmounts({
    sigs: 36,
    pay: 1,
    payRate: 1.5,
    valid: 27,
    validityPercent: 75,
    benchmarkPercent: 75,
    payModel: "validity_standard",
  });
  assert.equal(result.payable, 36);
  assert.equal(result.totalPay, 54);
});

test("validity standard below benchmark", () => {
  const result = calculateLedgerAmounts({
    sigs: 36,
    pay: 1,
    payRate: 1.5,
    valid: 27,
    validityPercent: 70,
    benchmarkPercent: 75,
    payModel: "validity_standard",
  });
  assert.equal(result.payable, 34);
  assert.equal(result.totalPay, 51);
});

test("per valid signature model", () => {
  const result = calculateLedgerAmounts({
    sigs: 33,
    pay: 0.85,
    payRate: 1.25,
    valid: 24,
    validityPercent: 73,
    benchmarkPercent: 75,
    payModel: "per_valid_sig",
  });
  assert.equal(result.payable, 24);
  assert.equal(result.totalPay, 30);
});

test("pending validity", () => {
  const result = calculateLedgerAmounts({
    sigs: 36,
    pay: 1,
    payRate: 1.5,
    valid: null,
    validityPercent: null,
    benchmarkPercent: 75,
    payModel: "validity_standard",
  });
  assert.equal(result.validityPending, true);
  assert.equal(result.totalPay, null);
});
