export const RENTAL_DAILY_RATE = 50;
export const RENTAL_WEEKLY_RATE = 309;
export const RENTAL_MONTHLY_RATE = 1146;

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function rentalCarGuideTotal(days: number) {
  const d = Math.max(0, Math.floor(days));
  const months = Math.floor(d / 30);
  let rem = d % 30;
  const weeks = Math.floor(rem / 7);
  rem = rem % 7;
  return roundMoney(months * RENTAL_MONTHLY_RATE + weeks * RENTAL_WEEKLY_RATE + rem * RENTAL_DAILY_RATE);
}

export function rentalCarInclusiveDays(pickupAt: string | Date, asOf: string | Date = new Date()) {
  const pickup = typeof pickupAt === "string" ? new Date(`${pickupAt.slice(0, 10)}T12:00:00`) : pickupAt;
  const end = typeof asOf === "string" ? new Date(`${asOf.slice(0, 10)}T12:00:00`) : asOf;
  const ms = end.getTime() - pickup.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export type RentalChargeKind = "daily" | "weekly" | "monthly";

export type RentalProgressiveCharge = {
  kind: RentalChargeKind;
  amount: number;
  dayIndex: number;
  periodStart: number;
  periodEnd: number;
  voided: boolean;
};

function coversDay(charge: RentalProgressiveCharge, dayIndex: number) {
  return !charge.voided && dayIndex >= charge.periodStart && dayIndex <= charge.periodEnd;
}

export function rentalCarProgressiveCharges(days: number): RentalProgressiveCharge[] {
  const n = Math.max(0, Math.floor(days));
  const charges: RentalProgressiveCharge[] = [];

  for (let day = 1; day <= n; day += 1) {
    const covered = charges.some((c) => coversDay(c, day));
    if (!covered) {
      charges.push({
        kind: "daily",
        amount: RENTAL_DAILY_RATE,
        dayIndex: day,
        periodStart: day,
        periodEnd: day,
        voided: false,
      });
    }

    const monthStart = Math.floor((day - 1) / 30) * 30 + 1;
    const localDay = ((day - 1) % 30) + 1;

    if (localDay === 7 || localDay === 14 || localDay === 21) {
      const weekStart = monthStart + localDay - 7;
      const weekEnd = monthStart + localDay - 1;
      for (const c of charges) {
        if (
          !c.voided &&
          c.kind === "daily" &&
          c.periodStart >= weekStart &&
          c.periodEnd <= weekEnd
        ) {
          c.voided = true;
        }
      }
      charges.push({
        kind: "weekly",
        amount: RENTAL_WEEKLY_RATE,
        dayIndex: day,
        periodStart: weekStart,
        periodEnd: weekEnd,
        voided: false,
      });
    }

    if (localDay === 30) {
      const monthEnd = monthStart + 29;
      for (const c of charges) {
        if (
          !c.voided &&
          c.periodStart >= monthStart &&
          c.periodEnd <= monthEnd
        ) {
          c.voided = true;
        }
      }
      charges.push({
        kind: "monthly",
        amount: RENTAL_MONTHLY_RATE,
        dayIndex: day,
        periodStart: monthStart,
        periodEnd: monthEnd,
        voided: false,
      });
    }
  }

  return charges;
}

export function rentalCarProgressiveTotal(days: number) {
  return roundMoney(
    rentalCarProgressiveCharges(days)
      .filter((c) => !c.voided)
      .reduce((sum, c) => sum + c.amount, 0),
  );
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
