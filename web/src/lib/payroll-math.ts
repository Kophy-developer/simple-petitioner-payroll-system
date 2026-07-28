export function validityPercent(valid: number, usable: number) {
  if (!usable || usable <= 0) return 0;
  return Math.round((valid / usable) * 10000) / 100;
}

export function payRateFromBenchmark(validityPct: number, benchmarkPct: number) {
  if (!benchmarkPct || benchmarkPct <= 0) return 0;
  return Math.min(validityPct / benchmarkPct, 1);
}

export function payableFromUseable(payRate: number, usable: number) {
  return Math.floor(payRate * usable);
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function holdFraction(holdPct = 15) {
  const pct = Number.isFinite(holdPct) ? holdPct : 15;
  return Math.min(100, Math.max(0, pct)) / 100;
}

export function calculateLedgerLine(input: {
  sigs: number;
  pay: number;
  usable: number | null;
  valid: number | null;
  benchmarkPct: number;
  hasValidity: boolean;
  holdPct?: number;
}) {
  const estimatedPay = roundMoney(input.sigs * input.pay);
  if (!input.hasValidity || input.usable == null || input.valid == null) {
    return {
      estimatedPay,
      validityPct: null as number | null,
      payRate: 0,
      payable: null as number | null,
      totalPay: null as number | null,
      upfront: null as number | null,
      hold: null as number | null,
      validityPending: true,
    };
  }

  const validityPct = validityPercent(input.valid, input.usable);
  const payRate = payRateFromBenchmark(validityPct, input.benchmarkPct);
  const payable = payableFromUseable(payRate, input.usable);
  const totalPay = roundMoney(payable * input.pay);
  const holdFrac = holdFraction(input.holdPct ?? 15);
  const upfront = roundMoney(totalPay * (1 - holdFrac));
  const hold = roundMoney(totalPay * holdFrac);

  return {
    estimatedPay,
    validityPct,
    payRate,
    payable,
    totalPay,
    upfront,
    hold,
    validityPending: false,
  };
}

export function lodgingDailyShare(input: {
  kind: "airbnb" | "hotel";
  dailyTotal?: number | null;
  roomCount?: number | null;
  roomRate?: number | null;
  occupantsInRoom: number;
}) {
  const occupants = Math.max(1, input.occupantsInRoom);
  if (input.kind === "airbnb") {
    const rooms = Math.max(1, input.roomCount ?? 1);
    const total = input.dailyTotal ?? 0;
    return roundMoney(total / rooms / occupants);
  }
  return roundMoney((input.roomRate ?? 0) / occupants);
}
