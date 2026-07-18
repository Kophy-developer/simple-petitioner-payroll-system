import { createClient } from "@/lib/supabase/client";
import type {
  LedgerLine,
  LodgingKind,
  LodgingOccupancy,
  LodgingProperty,
  PaymentBucket,
  PaymentEvent,
  PaymentEventType,
  PricedPetitionLine,
  SubAccount,
  TurnIn,
  TurnInColumn,
  TurnInEntry,
} from "@/lib/types";

function num(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export async function listSubAccounts() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sub_accounts")
    .select("id, code, name, is_primary")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(
    (row): SubAccount => ({
      id: row.id,
      code: row.code,
      name: row.name,
      isPrimary: !!row.is_primary,
    }),
  );
}

export async function listPricedPetitionLines() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("priced_petition_lines")
    .select("id, petition_id, name, code, pay, lotus_pay")
    .order("code");
  if (error) throw error;
  return (data ?? []).map(
    (row): PricedPetitionLine => ({
      id: row.id,
      petitionId: row.petition_id,
      name: row.name,
      code: row.code,
      pay: num(row.pay),
      lotusPay: num(row.lotus_pay),
    }),
  );
}

export async function savePricedPetitionLine(input: {
  id?: string;
  name: string;
  code: string;
  pay: number;
  lotusPay: number;
  petitionId?: string | null;
}) {
  const supabase = createClient();
  const payload = {
    name: input.name,
    code: input.code.trim(),
    pay: input.pay,
    lotus_pay: input.lotusPay,
    petition_id: input.petitionId ?? null,
    updated_at: new Date().toISOString(),
  };
  if (input.id) {
    const { error } = await supabase.from("priced_petition_lines").update(payload).eq("id", input.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from("priced_petition_lines").insert(payload);
  if (error) throw error;
}

export async function listTurnIns() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turn_ins")
    .select("id, turn_in_number, name, state, turn_in_date, benchmark_pct")
    .order("turn_in_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (row): TurnIn => ({
      id: row.id,
      turnInNumber: row.turn_in_number,
      name: row.name,
      state: row.state,
      turnInDate: row.turn_in_date,
      benchmarkPct: num(row.benchmark_pct, 75),
    }),
  );
}

export async function createTurnIn(input: {
  turnInNumber: string;
  name: string;
  state: string;
  turnInDate?: string | null;
  benchmarkPct: number;
  pricedLineIds: string[];
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turn_ins")
    .insert({
      turn_in_number: input.turnInNumber.trim(),
      name: input.name.trim(),
      state: input.state.trim(),
      turn_in_date: input.turnInDate || null,
      benchmark_pct: input.benchmarkPct,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (input.pricedLineIds.length) {
    const { error: colErr } = await supabase.from("turn_in_petition_columns").insert(
      input.pricedLineIds.map((pricedLineId, index) => ({
        turn_in_id: data.id,
        priced_line_id: pricedLineId,
        sort_order: index,
      })),
    );
    if (colErr) throw colErr;
  }
  return data.id as string;
}

export async function listTurnInColumns(turnInId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turn_in_petition_columns")
    .select(
      "id, turn_in_id, priced_line_id, sort_order, benchmark_pct, priced_petition_lines(code, pay, lotus_pay)",
    )
    .eq("turn_in_id", turnInId)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []).map((row): TurnInColumn => {
    const line = row.priced_petition_lines as
      | { code: string; pay: number; lotus_pay: number }
      | { code: string; pay: number; lotus_pay: number }[]
      | null;
    const priced = Array.isArray(line) ? line[0] : line;
    return {
      id: row.id,
      turnInId: row.turn_in_id,
      pricedLineId: row.priced_line_id,
      code: priced?.code ?? "",
      pay: num(priced?.pay),
      lotusPay: num(priced?.lotus_pay),
      sortOrder: row.sort_order,
      benchmarkPct: row.benchmark_pct == null ? null : num(row.benchmark_pct),
    };
  });
}

export async function listTurnInEntries(turnInId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turn_in_entries")
    .select("id, turn_in_id, column_id, user_id, sigs, books")
    .eq("turn_in_id", turnInId);
  if (error) throw error;
  return (data ?? []).map(
    (row): TurnInEntry => ({
      id: row.id,
      turnInId: row.turn_in_id,
      columnId: row.column_id,
      userId: row.user_id,
      sigs: row.sigs,
      books: row.books,
    }),
  );
}

export async function upsertTurnInEntry(input: {
  columnId: string;
  userId: string;
  sigs: number;
  books: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("upsert_turn_in_entry", {
    p_column_id: input.columnId,
    p_user_id: input.userId,
    p_sigs: input.sigs,
    p_books: input.books,
  });
  if (error) throw error;
  return data;
}

export async function upsertTurnInValidity(input: {
  columnId: string;
  userId: string;
  dups: number;
  usable: number;
  valid: number;
  failed?: number;
  wrongCounty?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("upsert_turn_in_validity", {
    p_column_id: input.columnId,
    p_user_id: input.userId,
    p_dups: input.dups,
    p_usable: input.usable,
    p_valid: input.valid,
    p_failed: input.failed ?? 0,
    p_wrong_county: input.wrongCounty ?? 0,
  });
  if (error) throw error;
  return data;
}

export async function listLedgerLines(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ledger_lines")
    .select(
      "id, user_id, turn_in_id, column_id, sigs, pay, estimated_pay, dups, usable, valid, validity_pct, pay_rate, payable, total_pay, upfront, hold, benchmark_pct, validity_pending",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (row): LedgerLine => ({
      id: row.id,
      userId: row.user_id,
      turnInId: row.turn_in_id,
      columnId: row.column_id,
      sigs: row.sigs,
      pay: num(row.pay),
      estimatedPay: num(row.estimated_pay),
      dups: row.dups,
      usable: row.usable,
      valid: row.valid,
      validityPercent: row.validity_pct == null ? null : num(row.validity_pct),
      payRate: num(row.pay_rate),
      payable: row.payable,
      totalPay: row.total_pay == null ? null : num(row.total_pay),
      upfront: row.upfront == null ? null : num(row.upfront),
      hold: row.hold == null ? null : num(row.hold),
      benchmarkPct: num(row.benchmark_pct, 75),
      validityPending: !!row.validity_pending,
    }),
  );
}

export async function listLotusTeamLedger() {
  const supabase = createClient();
  const { data: lotus, error: saErr } = await supabase
    .from("sub_accounts")
    .select("id")
    .eq("code", "LOTUS")
    .maybeSingle();
  if (saErr) throw saErr;
  if (!lotus) return [];

  const { data: people, error: pErr } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, initials")
    .eq("sub_account_id", lotus.id)
    .neq("status", "offboarded");
  if (pErr) throw pErr;

  const rows = [];
  for (const person of people ?? []) {
    const lines = await listLedgerLines(person.id);
    const totalPay = lines.reduce((sum, line) => sum + (line.totalPay ?? line.estimatedPay), 0);
    const upfront = lines.reduce((sum, line) => sum + (line.upfront ?? 0), 0);
    const hold = lines.reduce((sum, line) => sum + (line.hold ?? 0), 0);
    rows.push({
      userId: person.id,
      firstName: person.first_name as string,
      lastName: person.last_name as string,
      initials: person.initials as string,
      lineCount: lines.length,
      totalPay,
      upfront,
      hold,
    });
  }
  return rows;
}

export async function listPaymentEvents(userId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("payment_events")
    .select(
      "id, user_id, bucket, event_type, amount, notes, receipt_path, event_date, paid_at, funds_hit_at, loan_id",
    )
    .order("event_date", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(
    (row): PaymentEvent => ({
      id: row.id,
      userId: row.user_id,
      bucket: row.bucket as PaymentBucket,
      eventType: row.event_type as PaymentEventType,
      amount: num(row.amount),
      notes: row.notes,
      receiptPath: row.receipt_path,
      eventDate: row.event_date,
      paidAt: row.paid_at,
      fundsHitAt: row.funds_hit_at,
      loanId: row.loan_id,
    }),
  );
}

export async function createPaymentEvent(input: {
  userId: string;
  bucket: PaymentBucket;
  eventType: PaymentEventType;
  amount: number;
  notes?: string;
  receiptPath?: string | null;
  eventDate?: string;
  fundsHitAt?: string | null;
  loanId?: string | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_payment_event", {
    p_user_id: input.userId,
    p_bucket: input.bucket,
    p_event_type: input.eventType,
    p_amount: input.amount,
    p_notes: input.notes ?? null,
    p_receipt_path: input.receiptPath ?? null,
    p_event_date: input.eventDate ?? null,
    p_funds_hit_at: input.fundsHitAt ?? null,
    p_loan_id: input.loanId ?? null,
  });
  if (error) throw error;
  return data;
}

export async function uploadPaymentReceipt(userId: string, file: File) {
  const supabase = createClient();
  const path = `${userId}/payments/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file);
  if (error) throw error;
  return path;
}

export async function offboardUser(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("offboard_user", { p_user_id: userId });
  if (error) throw error;
  return data;
}

export async function setUserSubAccount(userId: string, subAccountId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("profiles")
    .update({ sub_account_id: subAccountId })
    .eq("id", userId);
  if (error) throw error;
}

export async function listLodgingProperties() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lodging_properties")
    .select("id, kind, name, address, daily_total, room_count, room_rate")
    .order("name");
  if (error) throw error;
  return (data ?? []).map(
    (row): LodgingProperty => ({
      id: row.id,
      kind: row.kind as LodgingKind,
      name: row.name,
      address: row.address,
      dailyTotal: row.daily_total == null ? null : num(row.daily_total),
      roomCount: row.room_count,
      roomRate: row.room_rate == null ? null : num(row.room_rate),
    }),
  );
}

export async function createLodgingProperty(input: {
  kind: LodgingKind;
  name: string;
  address?: string;
  dailyTotal?: number | null;
  roomCount?: number | null;
  roomRate?: number | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lodging_properties")
    .insert({
      kind: input.kind,
      name: input.name,
      address: input.address ?? null,
      daily_total: input.dailyTotal ?? null,
      room_count: input.roomCount ?? null,
      room_rate: input.roomRate ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function listOpenLodgingOccupancies() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lodging_occupancies")
    .select(
      "id, property_id, user_id, room_number, occupants_in_room, check_in_at, check_out_at, check_out_date, check_out_backdated, daily_amount",
    )
    .is("check_out_at", null)
    .is("check_out_date", null)
    .order("check_in_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (row): LodgingOccupancy => ({
      id: row.id,
      propertyId: row.property_id,
      userId: row.user_id,
      roomNumber: row.room_number,
      occupantsInRoom: row.occupants_in_room,
      checkInAt: row.check_in_at,
      checkOutAt: row.check_out_at,
      checkOutDate: row.check_out_date,
      checkOutBackdated: !!row.check_out_backdated,
      dailyAmount: row.daily_amount == null ? null : num(row.daily_amount),
    }),
  );
}

export async function checkInLodging(input: {
  propertyId: string;
  userId: string;
  roomNumber: string;
  occupantsInRoom: number;
  checkInAt: string;
  dailyAmount: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("lodging_occupancies")
    .insert({
      property_id: input.propertyId,
      user_id: input.userId,
      room_number: input.roomNumber,
      occupants_in_room: input.occupantsInRoom,
      check_in_at: input.checkInAt,
      daily_amount: input.dailyAmount,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function checkOutLodging(input: {
  occupancyId: string;
  checkOutAt?: string | null;
  checkOutDate?: string | null;
  backdated?: boolean;
}) {
  const supabase = createClient();
  const { error } = await supabase
    .from("lodging_occupancies")
    .update({
      check_out_at: input.backdated ? null : input.checkOutAt ?? new Date().toISOString(),
      check_out_date: input.backdated ? input.checkOutDate : null,
      check_out_backdated: !!input.backdated,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.occupancyId);
  if (error) throw error;
}

export async function listActiveCarExpenses() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expense_records")
    .select("id, user_id, amount, tolls_amount, expense_date, end_date, receipt_path, car_active")
    .eq("type", "car_rental")
    .eq("car_active", true)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateExpenseTolls(expenseId: string, tollsAmount: number) {
  const supabase = createClient();
  const { error } = await supabase
    .from("expense_records")
    .update({ tolls_amount: tollsAmount, updated_at: new Date().toISOString() })
    .eq("id", expenseId);
  if (error) throw error;
}

export async function listValidityNameMap() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("validity_name_map")
    .select("initials, report_name");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    initials: row.initials as string,
    reportName: row.report_name as string,
  }));
}

export function resolveCirculatorUserId(
  nameOrInitials: string,
  profiles: { id: string; initials: string; firstName: string; lastName: string }[],
  nameMap: { initials: string; reportName: string }[],
) {
  const key = nameOrInitials.trim().toLowerCase();
  if (!key) return null;
  const mapped = nameMap.find(
    (m) =>
      m.initials.toLowerCase() === key || m.reportName.toLowerCase() === key,
  );
  const search = (mapped?.reportName ?? nameOrInitials).trim().toLowerCase();
  const byInitials = profiles.find((p) => p.initials.toLowerCase() === key);
  if (byInitials) return byInitials.id;
  const byFull = profiles.find(
    (p) => `${p.firstName} ${p.lastName}`.toLowerCase() === search,
  );
  if (byFull) return byFull.id;
  const byLast = profiles.find((p) => p.lastName.toLowerCase() === search);
  return byLast?.id ?? null;
}

export async function importTurnInValidityRows(input: {
  columnId: string;
  rows: {
    name: string;
    dups: number;
    usable: number;
    valid: number;
    failed?: number;
    wrongCounty?: number;
  }[];
  profiles: { id: string; initials: string; firstName: string; lastName: string }[];
}) {
  const nameMap = await listValidityNameMap();
  let matched = 0;
  for (const row of input.rows) {
    const userId = resolveCirculatorUserId(row.name, input.profiles, nameMap);
    if (!userId) continue;
    await upsertTurnInValidity({
      columnId: input.columnId,
      userId,
      dups: row.dups,
      usable: row.usable,
      valid: row.valid,
      failed: row.failed,
      wrongCounty: row.wrongCounty,
    });
    matched += 1;
  }
  return matched;
}
