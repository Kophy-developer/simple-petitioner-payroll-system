import assert from "node:assert/strict";
import {
  calculateLedgerLine,
  lodgingDailyShare,
  normalizeValidityPercent,
  payRateFromBenchmark,
  payableFromUseable,
  resolveImportedValidityPercent,
  validityPercent,
} from "./payroll-math";

assert.equal(validityPercent(512, 733), 69.85);
assert.equal(normalizeValidityPercent(0.61), 61);
assert.equal(normalizeValidityPercent(74.8), 74.8);
assert.equal(normalizeValidityPercent(1), 1);
assert.equal(resolveImportedValidityPercent(0.61, 61, 100), 61);
assert.equal(resolveImportedValidityPercent(0.748, 0, 0), 74.8);
assert.equal(resolveImportedValidityPercent(1, 100, 100), 100);
assert.equal(resolveImportedValidityPercent(1, 0, 0), 1);
assert.equal(resolveImportedValidityPercent(61, 61, 100), 61);
assert.equal(resolveImportedValidityPercent(NaN, 30, 40), 75);
assert.equal(payRateFromBenchmark(86.11, 75), 1);
assert.equal(payableFromUseable(1, 148), 148);
assert.equal(payableFromUseable(0.718, 100), 71);

const below = calculateLedgerLine({
  sigs: 733,
  pay: 15,
  usable: 733,
  valid: 512,
  benchmarkPct: 70,
  hasValidity: true,
});
assert.equal(below.estimatedPay, 10995);
assert.equal(below.validityPct, 69.85);
assert.ok(below.payRate! < 1);
assert.equal(below.payable, 731);
assert.equal(below.totalPay, 10965);
assert.equal(below.upfront, 9320.25);
assert.equal(below.hold, 1644.75);
assert.equal(below.validityPending, false);

const full = calculateLedgerLine({
  sigs: 148,
  pay: 3,
  usable: 148,
  valid: 113,
  benchmarkPct: 75,
  hasValidity: true,
});
assert.equal(full.payRate, 1);
assert.equal(full.payable, 148);
assert.equal(full.totalPay, 444);
assert.equal(full.upfront, 377.4);
assert.equal(full.hold, 66.6);

const airbnb = lodgingDailyShare({
  kind: "airbnb",
  dailyTotal: 100,
  roomCount: 5,
  occupantsInRoom: 2,
});
assert.equal(airbnb, 10);

const hotel = lodgingDailyShare({
  kind: "hotel",
  roomRate: 120,
  occupantsInRoom: 2,
});
assert.equal(hotel, 60);

console.log("payroll-math.test.ts passed");
