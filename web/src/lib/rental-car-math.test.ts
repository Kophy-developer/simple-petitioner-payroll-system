import assert from "node:assert/strict";
import {
  rentalCarAccrualDrip,
  rentalCarGuideTotal,
  rentalCarInclusiveDays,
  rentalCarTrueUpDelta,
} from "./rental-car-math";

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

const drip9 = rentalCarAccrualDrip(9);
assert.ok(drip9 < 409);
const trueUp = rentalCarTrueUpDelta({ days: 9, priorAccrued: drip9 });
assert.equal(trueUp.guide, 409);
assert.equal(roundish(trueUp.rentalDelta + drip9), 409);

function roundish(n: number) {
  return Math.round(n * 100) / 100;
}

const withFee = rentalCarTrueUpDelta({
  days: 9,
  priorAccrued: drip9,
  oneWayFee: 150,
  priorOneWayFee: 0,
});
assert.equal(withFee.feeDelta, 150);
assert.equal(withFee.finalWithFee, 559);

console.log("rental-car-math.test.ts passed");
