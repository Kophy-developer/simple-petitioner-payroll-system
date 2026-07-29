import { createClient } from "@/lib/supabase/client";
import { matchProfile } from "@/lib/profile-match";
import type {
  BrexTransaction,
  HousingShareKind,
  LedgerLine,
  LodgingKind,
  LodgingOccupancy,
  LodgingProperty,
  PaymentBucket,
  PaymentEvent,
  PaymentEventType,
  PricedPetitionLine,
  RentalCarAssignment,
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
    .select(
      "id, petition_id, name, code, pay, lotus_pay, official_number, official_name, ontarget_name, client_report_name",
    )
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
      officialNumber: row.official_number ?? null,
      officialName: row.official_name ?? null,
      ontargetName: row.ontarget_name ?? null,
      clientReportName: row.client_report_name ?? null,
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
  officialNumber?: string | null;
  officialName?: string | null;
  ontargetName?: string | null;
  clientReportName?: string | null;
}) {
  const supabase = createClient();
  const payload = {
    name: input.name,
    code: input.code.trim(),
    pay: input.pay,
    lotus_pay: input.lotusPay,
    petition_id: input.petitionId ?? null,
    official_number: input.officialNumber?.trim() || null,
    official_name: input.officialName?.trim() || null,
    ontarget_name: input.ontargetName?.trim() || null,
    client_report_name: input.clientReportName?.trim() || null,
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
  name?: string;
  state: string;
  turnInDate?: string | null;
  benchmarkPct: number;
  pricedLineIds: string[];
  exposeToSubmissions?: boolean;
}) {
  const supabase = createClient();
  const turnInNumber = input.turnInNumber.trim().toUpperCase();
  const { data, error } = await supabase
    .from("turn_ins")
    .insert({
      turn_in_number: turnInNumber,
      name: turnInNumber,
      state: input.state.trim().toUpperCase(),
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

  if (input.exposeToSubmissions !== false) {
    await linkTurnInToSubmissionIssue({
      turnInId: data.id as string,
      turnInNumber,
      name: turnInNumber,
      state: input.state.trim().toUpperCase(),
      turnInDate: input.turnInDate || null,
      pricedLineIds: input.pricedLineIds,
    });
  }

  return data.id as string;
}

async function linkTurnInToSubmissionIssue(input: {
  turnInId: string;
  turnInNumber: string;
  name: string;
  state: string;
  turnInDate: string | null;
  pricedLineIds: string[];
}) {
  const supabase = createClient();
  const { data: existingIssue } = await supabase
    .from("issues")
    .select("id")
    .eq("issue_number", input.turnInNumber)
    .maybeSingle();

  let issueId = existingIssue?.id as string | undefined;

  if (!issueId) {
    let petitionId: string | null = null;
    if (input.pricedLineIds[0]) {
      const { data: line } = await supabase
        .from("priced_petition_lines")
        .select("petition_id")
        .eq("id", input.pricedLineIds[0])
        .maybeSingle();
      petitionId = (line?.petition_id as string | null) ?? null;
    }
    if (!petitionId) {
      const { data: petition } = await supabase
        .from("petitions")
        .select("id")
        .order("code")
        .limit(1)
        .maybeSingle();
      petitionId = (petition?.id as string | undefined) ?? null;
    }
    if (!petitionId) {
      const { data: createdPetition, error: petitionError } = await supabase
        .from("petitions")
        .insert({
          name: "General petition",
          code: "GENERAL",
          pay: 0,
          lotus: "0",
        })
        .select("id")
        .single();
      if (petitionError) throw petitionError;
      petitionId = createdPetition.id as string;
    }

    const { data: issue, error: issueError } = await supabase
      .from("issues")
      .insert({
        issue_number: input.turnInNumber,
        name: input.name,
        petition_id: petitionId,
        state: input.state,
        turn_in_date: input.turnInDate,
        turn_in_number: input.turnInNumber,
        pay_model: "validity_standard",
      })
      .select("id")
      .single();
    if (issueError) throw issueError;
    issueId = issue.id as string;
  }

  await supabase
    .from("turn_ins")
    .update({ legacy_issue_id: issueId, updated_at: new Date().toISOString() })
    .eq("id", input.turnInId);
}

export async function exposeAllTurnInsToSubmissions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("turn_ins")
    .select("id, turn_in_number, name, state, turn_in_date, legacy_issue_id")
    .is("legacy_issue_id", null);
  if (error) throw error;

  let linked = 0;
  for (const row of data ?? []) {
    const columns = await listTurnInColumns(row.id as string);
    await linkTurnInToSubmissionIssue({
      turnInId: row.id as string,
      turnInNumber: String(row.turn_in_number),
      name: String(row.name || row.turn_in_number),
      state: String(row.state || ""),
      turnInDate: (row.turn_in_date as string | null) ?? null,
      pricedLineIds: columns.map((c) => c.pricedLineId),
    });
    linked += 1;
  }
  return { linked };
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
      "id, user_id, bucket, event_type, amount, notes, receipt_path, event_date, paid_at, funds_hit_at, loan_id, voided, voided_at, void_reason",
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
      voided: !!row.voided,
      voidedAt: row.voided_at ?? null,
      voidReason: row.void_reason ?? null,
    }),
  );
}

export async function voidPaymentEvent(paymentId: string, reason: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("void_payment_event", {
    p_payment_id: paymentId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
}

export async function voidBrexReimbursement(brexId: string, reason: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("void_brex_reimbursement", {
    p_brex_id: brexId,
    p_reason: reason,
  });
  if (error) throw error;
  return data;
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
  const { error } = await supabase.rpc("admin_set_user_sub_account", {
    p_user_id: userId,
    p_sub_account_id: subAccountId,
  });
  if (error) throw error;
}

function mapLodgingProperty(row: {
  id: string;
  kind: string;
  name: string;
  address: string | null;
  daily_total: number | string | null;
  room_count: number | null;
  room_rate: number | string | null;
  full_rate?: number | string | null;
  half_rate?: number | string | null;
}): LodgingProperty {
  return {
    id: row.id,
    kind: row.kind as LodgingKind,
    name: row.name,
    address: row.address,
    dailyTotal: row.daily_total == null ? null : num(row.daily_total),
    roomCount: row.room_count,
    roomRate: row.room_rate == null ? null : num(row.room_rate),
    fullRate: row.full_rate == null ? null : num(row.full_rate),
    halfRate: row.half_rate == null ? null : num(row.half_rate),
  };
}

function mapLodgingOccupancy(row: {
  id: string;
  property_id: string;
  user_id: string;
  room_number: string;
  occupants_in_room: number;
  check_in_at: string;
  check_out_at: string | null;
  check_out_date: string | null;
  check_out_backdated: boolean;
  daily_amount: number | string | null;
  share_kind?: string | null;
  planned_check_out_date?: string | null;
  checkout_requested_at?: string | null;
  checkout_approved_at?: string | null;
}): LodgingOccupancy {
  return {
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
    shareKind: (row.share_kind as LodgingOccupancy["shareKind"]) ?? "full",
    plannedCheckOutDate: row.planned_check_out_date ?? null,
    checkoutRequestedAt: row.checkout_requested_at ?? null,
    checkoutApprovedAt: row.checkout_approved_at ?? null,
  };
}

export async function listLodgingProperties(kind?: LodgingKind) {
  const supabase = createClient();
  let query = supabase
    .from("lodging_properties")
    .select("id, kind, name, address, daily_total, room_count, room_rate, full_rate, half_rate")
    .order("name");
  if (kind) query = query.eq("kind", kind);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapLodgingProperty);
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
  const { data, error } = await supabase.rpc("find_or_create_lodging_property", {
    p_kind: input.kind,
    p_name: input.name,
    p_daily_total: input.dailyTotal ?? null,
    p_room_count: input.roomCount ?? null,
    p_room_rate: input.roomRate ?? null,
    p_address: input.address ?? null,
  });
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function mergeLodgingProperties(keepId: string, mergeId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("merge_lodging_properties", {
    p_keep_id: keepId,
    p_merge_id: mergeId,
  });
  if (error) throw error;
}

export async function listOpenLodgingOccupancies(userId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("lodging_occupancies")
    .select(
      "id, property_id, user_id, room_number, occupants_in_room, check_in_at, check_out_at, check_out_date, check_out_backdated, daily_amount, share_kind, planned_check_out_date, checkout_requested_at, checkout_approved_at",
    )
    .is("check_out_at", null)
    .is("check_out_date", null)
    .order("check_in_at", { ascending: false });
  if (userId) query = query.eq("user_id", userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapLodgingOccupancy);
}

export async function createLodgingExpense(input: {
  kind: LodgingKind;
  propertyId?: string | null;
  propertyName?: string | null;
  dailyTotal?: number | null;
  roomCount?: number | null;
  roomRate?: number | null;
  roomNumber: string;
  occupantsInRoom: number;
  checkInDate: string;
  checkOutDate?: string | null;
  amount?: number | null;
  issueId?: string | null;
  receiptPath?: string | null;
  userId?: string | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_lodging_expense", {
    p_kind: input.kind,
    p_property_id: input.propertyId ?? null,
    p_property_name: input.propertyName ?? null,
    p_daily_total: input.dailyTotal ?? null,
    p_room_count: input.roomCount ?? null,
    p_room_rate: input.roomRate ?? null,
    p_room_number: input.roomNumber,
    p_occupants_in_room: input.occupantsInRoom,
    p_check_in_date: input.checkInDate,
    p_check_out_date: input.checkOutDate ?? null,
    p_amount: input.amount ?? null,
    p_issue_id: input.issueId ?? null,
    p_receipt_path: input.receiptPath ?? null,
    p_user_id: input.userId ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function checkOutLodging(input: {
  occupancyId: string;
  checkOutAt?: string | null;
  checkOutDate?: string | null;
  backdated?: boolean;
}) {
  const supabase = createClient();
  const { error } = await supabase.rpc("checkout_lodging_stay", {
    p_occupancy_id: input.occupancyId,
    p_check_out_date:
      input.checkOutDate ??
      (input.checkOutAt ? input.checkOutAt.slice(0, 10) : new Date().toISOString().slice(0, 10)),
    p_backdated: !!input.backdated,
  });
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
  profiles: {
    id: string;
    initials: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string | null;
  }[],
  nameMap: { initials: string; reportName: string }[],
) {
  const key = nameOrInitials.trim().toLowerCase();
  if (!key) return null;
  const mapped = nameMap.find(
    (m) =>
      m.initials.toLowerCase() === key || m.reportName.toLowerCase() === key,
  );
  const search = (mapped?.reportName ?? nameOrInitials).trim();
  const looksLikeEmail = search.includes("@");
  const digits = search.replace(/\D/g, "");
  const looksLikePhone =
    !looksLikeEmail &&
    digits.length >= 7 &&
    /^[\d\s().+-]+$/.test(search);
  const result = matchProfile(
    {
      name: looksLikeEmail || looksLikePhone ? undefined : search,
      email: looksLikeEmail ? search : undefined,
      phone: looksLikePhone ? search : undefined,
      initials: looksLikeEmail || looksLikePhone ? undefined : search,
    },
    profiles.map((p) => ({
      id: p.id,
      initials: p.initials,
      email: p.email ?? "",
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
    })),
  );
  if (result.status === "matched") return result.profile.id;
  return null;
}

export function resolveCirculatorFromReportRow(
  row: { firstName: string; lastName: string; initials: string },
  profiles: {
    id: string;
    initials: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string | null;
  }[],
) {
  const result = matchProfile(
    {
      name: `${row.firstName} ${row.lastName}`.trim(),
      firstName: row.firstName,
      lastName: row.lastName,
      initials: row.initials,
    },
    profiles.map((p) => ({
      id: p.id,
      initials: p.initials,
      email: p.email ?? "",
      firstName: p.firstName,
      lastName: p.lastName,
      phone: p.phone,
    })),
  );
  return result.status === "matched" ? result.profile.id : null;
}

export async function ensureTurnInColumns(turnInId: string, pricedLineIds: string[]) {
  const existing = await listTurnInColumns(turnInId);
  const have = new Set(existing.map((c) => c.pricedLineId));
  const missing = pricedLineIds.filter((id) => !have.has(id));
  if (!missing.length) return existing;
  const supabase = createClient();
  const start = existing.length;
  const { error } = await supabase.from("turn_in_petition_columns").insert(
    missing.map((pricedLineId, index) => ({
      turn_in_id: turnInId,
      priced_line_id: pricedLineId,
      sort_order: start + index,
    })),
  );
  if (error) throw error;
  return listTurnInColumns(turnInId);
}

export async function importTurnInReport(input: {
  parsed: import("@/lib/turn-in-report-excel").TurnInReportParseResult;
  benchmarkPct?: number;
  profiles: { id: string; initials: string; firstName: string; lastName: string }[];
  overrides?: Record<
    string,
    {
      turnInNumber?: string;
      turnInDate?: string | null;
    }
  >;
}) {
  const benchmarkPct = input.benchmarkPct ?? 75;
  let lines = await listPricedPetitionLines();
  const lineByCode = new Map(lines.map((l) => [l.code.toUpperCase(), l]));

  const neededCodes = new Map<
    string,
    { code: string; pay: number; name: string; officialName: string | null }
  >();
  for (const issue of input.parsed.issues) {
    for (const col of issue.columns) {
      const key = col.code.toUpperCase();
      if (!neededCodes.has(key)) {
        const official =
          col.legalName || input.parsed.codeNames[key] || input.parsed.codeNames[key.replace(/\s*\$\s*\d+(?:\.\d+)?$/, "").trim()] || null;
        neededCodes.set(key, {
          code: col.code,
          pay: col.pay,
          name: official || col.code,
          officialName: official,
        });
      }
    }
  }

  for (const needed of neededCodes.values()) {
    if (lineByCode.has(needed.code.toUpperCase())) continue;
    await savePricedPetitionLine({
      name: needed.name,
      code: needed.code,
      pay: needed.pay,
      lotusPay: needed.pay,
      officialName: needed.officialName,
    });
  }

  lines = await listPricedPetitionLines();
  for (const line of lines) lineByCode.set(line.code.toUpperCase(), line);

  const turnIns = await listTurnIns();
  const turnInByNumber = new Map(turnIns.map((t) => [t.turnInNumber.toUpperCase(), t]));

  let createdTurnIns = 0;
  let updatedEntries = 0;
  const unmatched: string[] = [];
  const unmatchedSet = new Set<string>();

  for (const issue of input.parsed.issues) {
    const override = input.overrides?.[issue.sheetName] ?? input.overrides?.[issue.turnInNumber];
    const turnInNumber = (override?.turnInNumber || issue.turnInNumber).trim().toUpperCase();
    const turnInDate = override?.turnInDate || null;
    const pricedIds = issue.columns
      .map((c) => lineByCode.get(c.code.toUpperCase())?.id)
      .filter((id): id is string => !!id);

    let turnIn = turnInByNumber.get(turnInNumber);
    if (!turnIn) {
      const id = await createTurnIn({
        turnInNumber,
        name: turnInNumber,
        state: input.parsed.state,
        turnInDate,
        benchmarkPct,
        pricedLineIds: pricedIds,
      });
      createdTurnIns += 1;
      turnIn = {
        id,
        turnInNumber,
        name: turnInNumber,
        state: input.parsed.state,
        turnInDate,
        benchmarkPct,
      };
      turnInByNumber.set(turnInNumber, turnIn);
    } else {
      await linkTurnInToSubmissionIssue({
        turnInId: turnIn.id,
        turnInNumber,
        name: turnIn.name || turnInNumber,
        state: turnIn.state || input.parsed.state,
        turnInDate: turnInDate || turnIn.turnInDate,
        pricedLineIds: pricedIds,
      });
    }

    const columns = await ensureTurnInColumns(turnIn.id, pricedIds);
    const columnByCode = new Map(columns.map((c) => [c.code.toUpperCase(), c]));

    for (const entry of issue.entries) {
      const userId = resolveCirculatorFromReportRow(entry, input.profiles);
      if (!userId) {
        const label = `${entry.firstName} ${entry.lastName}`.trim() || entry.initials;
        if (!unmatchedSet.has(label)) {
          unmatchedSet.add(label);
          unmatched.push(label);
        }
        continue;
      }
      const column = columnByCode.get(entry.code.toUpperCase());
      if (!column) continue;
      await upsertTurnInEntry({
        columnId: column.id,
        userId,
        sigs: entry.sigs,
        books: entry.books,
      });
      updatedEntries += 1;
    }
  }

  return {
    createdTurnIns,
    updatedEntries,
    unmatched,
    issueCount: input.parsed.issues.length,
  };
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
  profiles: {
    id: string;
    initials: string;
    firstName: string;
    lastName: string;
    email?: string;
    phone?: string | null;
  }[];
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

export async function bulkAssignHousing(input: {
  propertyId: string;
  checkIn: string;
  fullRate: number;
  halfRate: number;
  plannedCheckOut?: string | null;
  assignments: { userId: string; shareKind: HousingShareKind; roomNumber?: string }[];
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("bulk_assign_housing", {
    p_property_id: input.propertyId,
    p_check_in: input.checkIn,
    p_full_rate: input.fullRate,
    p_half_rate: input.halfRate,
    p_assignments: input.assignments.map((a) => ({
      user_id: a.userId,
      share_kind: a.shareKind,
      room_number: a.roomNumber ?? "",
    })),
    p_planned_check_out: input.plannedCheckOut || null,
  });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function requestHousingCheckout(occupancyId: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("request_housing_checkout", {
    p_occupancy_id: occupancyId,
  });
  if (error) throw error;
}

export async function approveHousingCheckout(occupancyId: string, checkoutDate?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("approve_housing_checkout", {
    p_occupancy_id: occupancyId,
    p_checkout_date: checkoutDate ?? new Date().toISOString().slice(0, 10),
  });
  if (error) throw error;
}

export async function updateHousingRates(propertyId: string, fullRate: number, halfRate: number) {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_housing_rates", {
    p_property_id: propertyId,
    p_full_rate: fullRate,
    p_half_rate: halfRate,
  });
  if (error) throw error;
}

export async function listRentalCarAssignments(activeOnly = true) {
  const supabase = createClient();
  let query = supabase
    .from("rental_car_assignments")
    .select(
      "id, user_id, pickup_at, return_at, agreement_number, pickup_location, dropoff_location, one_way_fee, monthly_accrual_amount, active, last_accrued_on, trued_up_at",
    )
    .order("pickup_at", { ascending: false });
  if (activeOnly) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(
    (row): RentalCarAssignment => ({
      id: row.id,
      userId: row.user_id,
      pickupAt: row.pickup_at,
      returnAt: row.return_at,
      agreementNumber: row.agreement_number,
      pickupLocation: row.pickup_location,
      dropoffLocation: row.dropoff_location,
      oneWayFee: num(row.one_way_fee),
      monthlyAccrualAmount: num(row.monthly_accrual_amount),
      active: !!row.active,
      lastAccruedOn: row.last_accrued_on,
      truedUpAt: row.trued_up_at,
    }),
  );
}

export async function assignRentalCar(input: {
  userId: string;
  pickupAt: string;
  returnAt?: string | null;
  agreementNumber?: string;
  pickupLocation?: string;
  dropoffLocation?: string;
  oneWayFee?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("assign_rental_car", {
    p_user_id: input.userId,
    p_pickup_at: input.pickupAt,
    p_return_at: input.returnAt ?? null,
    p_agreement_number: input.agreementNumber ?? null,
    p_pickup_location: input.pickupLocation ?? null,
    p_dropoff_location: input.dropoffLocation ?? null,
    p_one_way_fee: input.oneWayFee ?? 0,
  });
  if (error) throw error;
  return data;
}

export async function returnRentalCar(assignmentId: string, returnAt?: string, oneWayFee?: number) {
  const supabase = createClient();
  const { error } = await supabase.rpc("return_rental_car", {
    p_assignment_id: assignmentId,
    p_return_at: returnAt ?? new Date().toISOString().slice(0, 10),
    p_one_way_fee: oneWayFee ?? null,
  });
  if (error) throw error;
}

export async function listBrexTransactions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("brex_transactions")
    .select(
      "id, brex_id, cardholder_name, amount, occurred_at, merchant_name, description, memo, expense_status, payment_status, brex_user_email, match_method, match_confidence, matched_user_id, disputed_at, dispute_note, reimbursement_requested, reimbursement_requested_by, reimbursement_requested_at, reimbursement_status, reviewed_by, reviewed_at",
    )
    .order("occurred_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(
    (row): BrexTransaction => ({
      id: row.id,
      brexId: row.brex_id,
      cardholderName: row.cardholder_name,
      amount: num(row.amount),
      occurredAt: row.occurred_at,
      merchantName: row.merchant_name,
      description: row.description,
      memo: row.memo,
      expenseStatus: row.expense_status,
      paymentStatus: row.payment_status,
      brexUserEmail: row.brex_user_email,
      matchMethod: row.match_method as BrexTransaction["matchMethod"],
      matchConfidence: row.match_confidence == null ? null : num(row.match_confidence),
      matchedUserId: row.matched_user_id,
      disputedAt: row.disputed_at,
      disputeNote: row.dispute_note,
      reimbursementRequested: !!row.reimbursement_requested,
      reimbursementRequestedBy: row.reimbursement_requested_by,
      reimbursementRequestedAt: row.reimbursement_requested_at,
      reimbursementStatus: row.reimbursement_status as BrexTransaction["reimbursementStatus"],
      reviewedBy: row.reviewed_by,
      reviewedAt: row.reviewed_at,
    }),
  );
}

export async function markBrexForReimbursement(id: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("mark_brex_for_reimbursement", { p_brex_id: id });
  if (error) throw error;
}

export async function reviewBrexReimbursement(id: string, approve: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("review_brex_reimbursement", {
    p_brex_id: id,
    p_approve: approve,
  });
  if (error) throw error;
}

export async function disputeBrexTransaction(id: string, note?: string) {
  const supabase = createClient();
  const { error } = await supabase.rpc("dispute_brex_transaction", {
    p_brex_id: id,
    p_note: note?.trim() || null,
  });
  if (error) throw error;
}

export async function resolveBrexDispute(id: string, confirm: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("resolve_brex_dispute", {
    p_brex_id: id,
    p_confirm: confirm,
  });
  if (error) throw error;
}

export async function setUserLotus(userId: string, isLotus: boolean) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_user_lotus", {
    p_user_id: userId,
    p_is_lotus: isLotus,
  });
  if (error) throw error;
}
