export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function rentalCarGuideTotal(days: number) {
  const d = Math.max(0, Math.floor(days));
  const months = Math.floor(d / 30);
  let rem = d % 30;
  const weeks = Math.floor(rem / 7);
  rem = rem % 7;
  return roundMoney(months * 1146 + weeks * 309 + rem * 50);
}

export function rentalCarInclusiveDays(pickupAt: string | Date, asOf: string | Date = new Date()) {
  const pickup = typeof pickupAt === "string" ? new Date(`${pickupAt.slice(0, 10)}T12:00:00`) : pickupAt;
  const end = typeof asOf === "string" ? new Date(`${asOf.slice(0, 10)}T12:00:00`) : asOf;
  const ms = end.getTime() - pickup.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function rentalCarAccrualDrip(days: number, monthlyAmount = 1146) {
  return roundMoney((Math.max(0, Math.floor(days)) / 30) * monthlyAmount);
}

export function rentalCarTrueUpDelta(input: {
  days: number;
  priorAccrued: number;
  oneWayFee?: number;
  priorOneWayFee?: number;
}) {
  const guide = rentalCarGuideTotal(input.days);
  const fee = Math.max(0, input.oneWayFee ?? input.priorOneWayFee ?? 0);
  const priorFee = Math.max(0, input.priorOneWayFee ?? 0);
  const rentalDelta = roundMoney(guide - input.priorAccrued);
  const feeDelta = roundMoney(Math.max(0, fee - priorFee));
  return {
    guide,
    rentalDelta,
    feeDelta,
    finalRentalTotal: guide,
    finalWithFee: roundMoney(guide + fee),
  };
}
