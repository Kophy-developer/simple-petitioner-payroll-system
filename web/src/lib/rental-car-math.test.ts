import assert from "node:assert/strict";
import {
  RENTAL_DAILY_RATE,
  RENTAL_MONTHLY_RATE,
  RENTAL_WEEKLY_RATE,
  rentalCarGuideTotal,
  rentalCarInclusiveDays,
  rentalCarProgressiveCharges,
  rentalCarProgressiveTotal,
  rentalCarTrueUpDelta,
} from "./rental-car-math";

assert.equal(RENTAL_DAILY_RATE, 50);
assert.equal(RENTAL_WEEKLY_RATE, 309);
assert.equal(RENTAL_MONTHLY_RATE, 1146);

assert.equal(rentalCarGuideTotal(9), 409);
assert.equal(rentalCarGuideTotal(17), 768);
assert.equal(rentalCarGuideTotal(38), 1505);
assert.equal(rentalCarGuideTotal(1), 50);
assert.equal(rentalCarGuideTotal(7), 309);
assert.equal(rentalCarGuideTotal(30), 1146);
assert.equal(rentalCarGuideTotal(0), 0);

assert.equal(rentalCarInclusiveDays("2026-01-01", "2026-01-01"), 1);
assert.equal(rentalCarInclusiveDays("2026-01-01", "2026-01-09"), 9);
assert.equal(rentalCarInclusiveDays("2026-01-01", "2026-02-07"), 38);

assert.equal(rentalCarProgressiveTotal(1), 50);
assert.equal(rentalCarProgressiveTotal(6), 300);

const day7 = rentalCarProgressiveCharges(7);
assert.equal(rentalCarProgressiveTotal(7), 309);
assert.ok(day7.some((c) => c.kind === "weekly" && !c.voided && c.amount === 309));
assert.equal(day7.filter((c) => c.kind === "daily" && !c.voided).length, 0);
assert.equal(day7.filter((c) => c.kind === "daily" && c.voided).length, 7);

const day14 = rentalCarProgressiveCharges(14);
assert.equal(rentalCarProgressiveTotal(14), 618);
assert.equal(day14.filter((c) => c.kind === "weekly" && !c.voided).length, 2);

const day21 = rentalCarProgressiveCharges(21);
assert.equal(rentalCarProgressiveTotal(21), 927);
assert.equal(day21.filter((c) => c.kind === "weekly" && !c.voided).length, 3);

const day30 = rentalCarProgressiveCharges(30);
assert.equal(rentalCarProgressiveTotal(30), 1146);
assert.ok(day30.some((c) => c.kind === "monthly" && !c.voided && c.amount === 1146));
assert.equal(day30.filter((c) => !c.voided && c.kind !== "monthly").length, 0);

assert.equal(rentalCarProgressiveTotal(9), 409);
assert.equal(rentalCarProgressiveTotal(17), 768);
assert.equal(rentalCarProgressiveTotal(38), 1505);

assert.equal(rentalCarProgressiveTotal(9), rentalCarGuideTotal(9));
assert.equal(rentalCarProgressiveTotal(17), rentalCarGuideTotal(17));
assert.equal(rentalCarProgressiveTotal(38), rentalCarGuideTotal(38));
assert.equal(rentalCarProgressiveTotal(45), rentalCarGuideTotal(45));
assert.equal(rentalCarProgressiveTotal(60), rentalCarGuideTotal(60));

const trueUp = rentalCarTrueUpDelta({ days: 9, priorAccrued: rentalCarProgressiveTotal(9) });
assert.equal(trueUp.guide, 409);
assert.equal(trueUp.rentalDelta, 0);

const withFee = rentalCarTrueUpDelta({
  days: 9,
  priorAccrued: 409,
  oneWayFee: 150,
  priorOneWayFee: 0,
});
assert.equal(withFee.feeDelta, 150);
assert.equal(withFee.finalWithFee, 559);

console.log("rental-car-math.test.ts passed");
