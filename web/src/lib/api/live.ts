import { createClient } from "@/lib/supabase/client";
import { createLodgingExpense as createLodgingExpenseRpc } from "@/lib/api/remodel";
import type {
  DemoUser,
  Expense,
  ExpenseConfig,
  ExpenseConfigType,
  ExpenseType,
  Issue,
  LedgerRow,
  LoanRequest,
  LoanStatus,
  MonthlyPayrollRecord,
  PayModel,
  PayRate,
  Petition,
  RoleCategory,
  Submission,
  UserRole,
  UserStatus,
  ValidityRecord,
  WageCurrency,
} from "@/lib/types";

export type PayrollBalance = {
  totalPay: number;
  totalUpfront: number;
  totalHold: number;
  totalExpenses: number;
  liveBalance: number;
};

function num(value: unknown, fallback = 0) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mapProfile(row: {
  id: string;
  first_name: string;
  last_name: string;
  initials: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  wage_currency: WageCurrency | null;
  hourly_wage: number | null;
  profile_tags: string[] | null;
  employee_id?: string | null;
  phone?: string | null;
  sub_account_id?: string | null;
  must_change_password?: boolean | null;
  onboarding_complete?: boolean | null;
}): DemoUser {
  return {
    id: row.id,
    authId: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    initials: row.initials,
    role: row.role,
    status: row.status,
    profileTags: row.profile_tags ?? [],
    roleCategoryIds: [],
    wageCurrency: row.wage_currency ?? undefined,
    hourlyWage: row.hourly_wage ?? undefined,
    employeeId: row.employee_id,
    phone: row.phone,
    subAccountId: row.sub_account_id,
    mustChangePassword: !!row.must_change_password,
    onboardingComplete: row.onboarding_complete !== false,
  };
}

function mapLoan(row: {
  id: string;
  user_id: string;
  amount_requested: number;
  hold_balance_snapshot: number;
  note: string | null;
  status: LoanStatus;
  created_at: string;
  reviewed_at: string | null;
  reviewed_by: string | null;
}): LoanRequest {
  return {
    id: row.id,
    userId: row.user_id,
    amount: num(row.amount_requested),
    holdSnapshot: num(row.hold_balance_snapshot),
    note: row.note,
    status: row.status,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by,
  };
}

function mapExpense(row: {
  id: string;
  user_id: string;
  issue_id: string | null;
  type: ExpenseType;
  amount: number;
  receipt_path: string | null;
  expense_date: string;
  end_date: string | null;
}): Expense {
  return {
    id: row.id,
    userId: row.user_id,
    issueId: row.issue_id,
    type: row.type,
    amount: num(row.amount),
    date: row.expense_date,
    endDate: row.end_date,
    receiptName: row.receipt_path ?? "—",
  };
}

function mapLedger(row: {
  id: string;
  user_id: string;
  issue_id: string;
  sigs: number;
  pay: number;
  estimated_pay: number;
  dups: number | null;
  usable: number | null;
  valid: number | null;
  validity_pct: number | null;
  pay_rate: number;
  payable: number | null;
  total_pay: number | null;
  upfront: number | null;
  hold: number | null;
  pay_model: PayModel;
  validity_pending: boolean;
  recalculated_at: string | null;
}): LedgerRow {
  return {
    id: row.id,
    userId: row.user_id,
    issueId: row.issue_id,
    sigs: num(row.sigs),
    pay: num(row.pay),
    estimatedPay: num(row.estimated_pay),
    dups: row.dups,
    usable: row.usable,
    valid: row.valid,
    validityPercent: row.validity_pct,
    payRate: num(row.pay_rate),
    payable: row.payable,
    totalPay: row.total_pay === null ? null : num(row.total_pay),
    upfront: row.upfront === null ? null : num(row.upfront),
    hold: row.hold === null ? null : num(row.hold),
    payModel: row.pay_model,
    validityPending: row.validity_pending,
    recalculatedAt: row.recalculated_at,
  };
}

function mapIssue(row: {
  id: string;
  issue_number: string;
  name: string;
  petition_id: string;
  state: string;
  validated_by: string | null;
  turn_in_date: string | null;
  turn_in_number: string | null;
  pay_model: PayModel;
  petitions?: { code: string } | { code: string }[] | null;
}): Issue {
  const petition = Array.isArray(row.petitions) ? row.petitions[0] : row.petitions;
  return {
    id: row.id,
    issueNumber: row.issue_number,
    name: row.name,
    petitionId: row.petition_id,
    petitionCode: petition?.code ?? "",
    state: row.state,
    validatedBy: row.validated_by ?? "",
    turnInDate: row.turn_in_date ?? "",
    turnInNumber: row.turn_in_number ?? "",
    payModel: row.pay_model,
  };
}

export function authUserId(user: Pick<DemoUser, "id" | "authId">) {
  return user.authId ?? user.id;
}

export async function listProfiles() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, initials, email, role, status, wage_currency, hourly_wage, profile_tags, employee_id, phone, sub_account_id, must_change_password, onboarding_complete",
    )
    .order("last_name");
  if (error) throw error;
  return (data ?? []).map(mapProfile);
}

export async function listTeamMemberships() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("team_memberships")
    .select("lead_id, member_id");
  if (error) throw error;
  return (data ?? []).map((row) => ({
    leadId: row.lead_id as string,
    memberId: row.member_id as string,
  }));
}

export async function setTeamMembers(leadId: string, memberIds: string[]) {
  const supabase = createClient();
  const { error } = await supabase.rpc("admin_set_team_members", {
    p_lead_id: leadId,
    p_member_ids: memberIds,
  });
  if (error) throw error;
}

export async function getProfile(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, initials, email, role, status, wage_currency, hourly_wage, profile_tags, employee_id, phone, sub_account_id, must_change_password, onboarding_complete",
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ? mapProfile(data) : null;
}

export async function listLoans() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("loan_requests")
    .select(
      "id, user_id, amount_requested, hold_balance_snapshot, note, status, created_at, reviewed_at, reviewed_by",
    )
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapLoan);
}

export async function getLoan(id: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("loan_requests")
    .select(
      "id, user_id, amount_requested, hold_balance_snapshot, note, status, created_at, reviewed_at, reviewed_by",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? mapLoan(data) : null;
}

export async function countPendingLoans() {
  const supabase = createClient();
  const { count, error } = await supabase
    .from("loan_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "pending");
  if (error) throw error;
  return count ?? 0;
}

export async function requestLoan(amount: number, note?: string) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("request_loan", {
    p_amount: amount,
    p_note: note?.trim() ? note.trim() : null,
  });
  if (error) throw error;
  return mapLoan(data);
}

export async function reviewLoan(loanId: string, approve: boolean) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("review_loan", {
    p_loan_id: loanId,
    p_approve: approve,
  });
  if (error) throw error;
  return mapLoan(data);
}

export async function getExpenseBalance(userId: string): Promise<PayrollBalance> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("expense_balance", {
    p_user_id: userId,
  });
  if (error) throw error;
  const row = data as Record<string, unknown>;
  return {
    totalPay: num(row.total_pay),
    totalUpfront: num(row.total_upfront),
    totalHold: num(row.total_hold),
    totalExpenses: num(row.total_expenses),
    liveBalance: num(row.live_balance),
  };
}

export async function listExpenses(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("expense_records")
    .select("id, user_id, issue_id, type, amount, receipt_path, expense_date, end_date")
    .eq("user_id", userId)
    .order("expense_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapExpense);
}

export async function createExpense(input: {
  type: ExpenseType;
  amount?: number | null;
  expenseDate: string;
  endDate?: string | null;
  issueId?: string | null;
  receiptPath?: string | null;
  userId?: string | null;
  tollsAmount?: number | null;
  carActive?: boolean | null;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_expense", {
    p_type: input.type,
    p_amount: input.amount ?? null,
    p_expense_date: input.expenseDate,
    p_end_date: input.endDate ?? null,
    p_issue_id: input.issueId ?? null,
    p_receipt_path: input.receiptPath ?? null,
    p_user_id: input.userId ?? null,
    p_tolls_amount: input.tollsAmount ?? 0,
    p_car_active: input.carActive ?? false,
  });
  if (error) throw error;
  return mapExpense(data);
}

export async function createLodgingExpense(input: {
  kind: "airbnb" | "hotel";
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
  const data = await createLodgingExpenseRpc(input);
  return mapExpense(
    data as {
      id: string;
      user_id: string;
      issue_id: string | null;
      type: ExpenseType;
      amount: number;
      receipt_path: string | null;
      expense_date: string;
      end_date: string | null;
    },
  );
}

export async function suggestedExpenseAmount(type: ExpenseType, issueId?: string | null) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("suggested_expense_amount", {
    p_type: type,
    p_issue_id: issueId ?? null,
  });
  if (error) throw error;
  return data === null || data === undefined ? undefined : num(data);
}

export async function listLedger(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("ledger_rows")
    .select(
      "id, user_id, issue_id, sigs, pay, estimated_pay, dups, usable, valid, validity_pct, pay_rate, payable, total_pay, upfront, hold, pay_model, validity_pending, recalculated_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map(mapLedger);
}

export type LedgerOverviewRow = {
  userId: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: UserRole;
  issueCount: number;
  pendingValidityCount: number;
  totalSigs: number;
  totalEstimatedPay: number;
  totalPay: number;
  totalUpfront: number;
  totalHold: number;
};

export type LedgerOverviewResult = {
  rows: LedgerOverviewRow[];
  totalCount: number;
};

export async function listLedgerOverview(input?: {
  q?: string;
  issueId?: string | null;
  pendingOnly?: boolean;
  limit?: number;
  offset?: number;
}): Promise<LedgerOverviewResult> {
  const supabase = createClient();
  const limit = Math.min(Math.max(input?.limit ?? 50, 1), 100);
  const offset = Math.max(input?.offset ?? 0, 0);
  const { data, error } = await supabase.rpc("ledger_overview", {
    p_q: input?.q?.trim() ? input.q.trim() : null,
    p_issue_id: input?.issueId || null,
    p_pending_only: input?.pendingOnly ?? false,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  const rows = (data ?? []) as Array<{
    user_id: string;
    first_name: string;
    last_name: string;
    initials: string;
    role: UserRole;
    issue_count: number;
    pending_validity_count: number;
    total_sigs: number;
    total_estimated_pay: number;
    total_pay: number;
    total_upfront: number;
    total_hold: number;
    total_count: number;
  }>;
  return {
    totalCount: rows[0] ? num(rows[0].total_count) : 0,
    rows: rows.map((row) => ({
      userId: row.user_id,
      firstName: row.first_name,
      lastName: row.last_name,
      initials: row.initials,
      role: row.role,
      issueCount: num(row.issue_count),
      pendingValidityCount: num(row.pending_validity_count),
      totalSigs: num(row.total_sigs),
      totalEstimatedPay: num(row.total_estimated_pay),
      totalPay: num(row.total_pay),
      totalUpfront: num(row.total_upfront),
      totalHold: num(row.total_hold),
    })),
  };
}

export async function listIssues() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("issues")
    .select(
      "id, issue_number, name, petition_id, state, validated_by, turn_in_date, turn_in_number, pay_model, petitions(code)",
    )
    .order("issue_number");
  if (error) throw error;
  return (data ?? []).map(mapIssue);
}

export async function listNegativeBalanceUsers() {
  const profiles = await listProfiles();
  const results: { user: DemoUser; balance: PayrollBalance }[] = [];
  for (const profile of profiles) {
    if (!["petitioner", "canvasser"].includes(profile.role)) continue;
    const balance = await getExpenseBalance(profile.id);
    if (balance.liveBalance < 0) results.push({ user: profile, balance });
  }
  return results;
}

function mapPetition(row: {
  id: string;
  name: string;
  code: string;
  pay: number;
  lotus: string | null;
}): Petition {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    pay: num(row.pay),
    lotus: row.lotus ?? "",
  };
}

function mapPayRate(row: {
  petition_id: string;
  issue_id: string;
  pay_rate: number;
}): PayRate {
  return {
    petitionId: row.petition_id,
    issueId: row.issue_id,
    rate: num(row.pay_rate),
  };
}

function mapSubmission(row: {
  id: string;
  user_id: string;
  issue_id: string;
  raw_signatures: number;
  page_numbers: number;
  pooled_signatures: number;
  pooled_pages: number;
  last_edited_by: string | null;
  last_edited_at: string | null;
}): Submission {
  return {
    id: row.id,
    userId: row.user_id,
    issueId: row.issue_id,
    rawSignatures: num(row.raw_signatures),
    pageNumbers: num(row.page_numbers),
    pooledSignatures: num(row.pooled_signatures),
    pooledPages: num(row.pooled_pages),
    lastEditedBy: row.last_edited_by,
    lastEditedAt: row.last_edited_at,
  };
}

function mapValidity(row: {
  id: string;
  issue_id: string;
  user_id: string;
  dups: number;
  usable: number;
  valid: number;
  validity_pct: number;
  entry_method: "upload" | "manual";
}): ValidityRecord {
  return {
    id: row.id,
    issueId: row.issue_id,
    userId: row.user_id,
    dups: num(row.dups),
    usable: num(row.usable),
    valid: num(row.valid),
    validityPercent: num(row.validity_pct),
    entryMethod: row.entry_method,
  };
}

export async function listPetitions() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("petitions")
    .select("id, name, code, pay, lotus")
    .order("code");
  if (error) throw error;
  return (data ?? []).map(mapPetition);
}

export async function createPetition(input: {
  name: string;
  code: string;
  pay: number;
  lotus?: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("petitions")
    .insert({
      name: input.name.trim(),
      code: input.code.trim().toUpperCase(),
      pay: input.pay,
      lotus: input.lotus?.trim() || null,
    })
    .select("id, name, code, pay, lotus")
    .single();
  if (error) throw error;
  return mapPetition(data);
}

export async function createIssue(input: {
  issueNumber: string;
  name: string;
  petitionId: string;
  state: string;
  validatedBy?: string;
  turnInDate?: string;
  turnInNumber?: string;
  payModel: PayModel;
  payRate?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("issues")
    .insert({
      issue_number: input.issueNumber.trim(),
      name: input.name.trim(),
      petition_id: input.petitionId,
      state: input.state.trim().toUpperCase(),
      validated_by: input.validatedBy?.trim() || null,
      turn_in_date: input.turnInDate || null,
      turn_in_number: input.turnInNumber?.trim() || null,
      pay_model: input.payModel,
    })
    .select(
      "id, issue_number, name, petition_id, state, validated_by, turn_in_date, turn_in_number, pay_model, petitions(code)",
    )
    .single();
  if (error) throw error;

  if (input.payRate !== undefined && Number.isFinite(input.payRate)) {
    const { error: rateError } = await supabase.from("pay_rate_configs").insert({
      petition_id: input.petitionId,
      issue_id: data.id,
      pay_rate: input.payRate,
    });
    if (rateError) throw rateError;
  }

  return mapIssue(data);
}

export async function listPayRates() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("pay_rate_configs")
    .select("petition_id, issue_id, pay_rate");
  if (error) throw error;
  return (data ?? []).map(mapPayRate);
}

export async function listSubmissions(issueId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("submission_records")
    .select(
      "id, user_id, issue_id, raw_signatures, page_numbers, pooled_signatures, pooled_pages, last_edited_by, last_edited_at",
    )
    .order("updated_at", { ascending: false });
  if (issueId) query = query.eq("issue_id", issueId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapSubmission);
}

export async function createSubmission(input: {
  issueId: string;
  rawSignatures: number;
  pageNumbers: number;
  pooledSignatures?: number;
  pooledPages?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("create_submission", {
    p_issue_id: input.issueId,
    p_raw_signatures: input.rawSignatures,
    p_page_numbers: input.pageNumbers,
    p_pooled_signatures: input.pooledSignatures ?? null,
    p_pooled_pages: input.pooledPages ?? null,
  });
  if (error) throw error;
  return mapSubmission(data);
}

export async function previewSubmissionEdit(input: {
  submissionId: string;
  rawSignatures: number;
  pageNumbers?: number;
  pooledSignatures?: number;
  pooledPages?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("preview_submission_edit", {
    p_submission_id: input.submissionId,
    p_raw_signatures: input.rawSignatures,
    p_page_numbers: input.pageNumbers ?? null,
    p_pooled_signatures: input.pooledSignatures ?? null,
    p_pooled_pages: input.pooledPages ?? null,
  });
  if (error) throw error;
  return data as Record<string, unknown>;
}

export async function confirmSubmissionEdit(input: {
  submissionId: string;
  rawSignatures: number;
  pageNumbers?: number;
  pooledSignatures?: number;
  pooledPages?: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("confirm_submission_edit", {
    p_submission_id: input.submissionId,
    p_raw_signatures: input.rawSignatures,
    p_page_numbers: input.pageNumbers ?? null,
    p_pooled_signatures: input.pooledSignatures ?? null,
    p_pooled_pages: input.pooledPages ?? null,
  });
  if (error) throw error;
  return mapLedger(data);
}

export async function listValidity(issueId?: string) {
  const supabase = createClient();
  let query = supabase
    .from("validity_records")
    .select("id, issue_id, user_id, dups, usable, valid, validity_pct, entry_method")
    .order("entered_at", { ascending: false });
  if (issueId) query = query.eq("issue_id", issueId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(mapValidity);
}

export async function upsertValidityManual(input: {
  issueId: string;
  userId: string;
  dups: number;
  usable: number;
  valid: number;
  validityPct: number;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("upsert_validity_manual", {
    p_issue_id: input.issueId,
    p_user_id: input.userId,
    p_dups: input.dups,
    p_usable: input.usable,
    p_valid: input.valid,
    p_validity_pct: input.validityPct,
  });
  if (error) throw error;
  return mapLedger(data);
}

export async function applyValidityUpload(
  issueId: string,
  rows: Array<{
    userId: string;
    dups: number;
    usable: number;
    valid: number;
    validityPct: number;
  }>,
) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("apply_validity_upload", {
    p_issue_id: issueId,
    p_rows: rows.map((row) => ({
      user_id: row.userId,
      dups: row.dups,
      usable: row.usable,
      valid: row.valid,
      validity_pct: row.validityPct,
    })),
  });
  if (error) throw error;
  return num(data);
}

export async function uploadValidityFile(issueId: string, file: File) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "xlsx";
  const path = `${issueId}/${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("validity-uploads").upload(path, file, {
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function uploadReceipt(file: File) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in");
  const ext = file.name.split(".").pop() || "bin";
  const path = `${user.id}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });
  if (error) throw error;
  return path;
}

export async function updateIssue(input: {
  issueId: string;
  issueNumber?: string;
  name?: string;
  state?: string;
  validatedBy?: string | null;
  turnInDate?: string | null;
  turnInNumber?: string | null;
  payModel?: PayModel;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_issue", {
    p_issue_id: input.issueId,
    p_issue_number: input.issueNumber ?? null,
    p_name: input.name ?? null,
    p_state: input.state ?? null,
    p_validated_by: input.validatedBy ?? null,
    p_turn_in_date: input.turnInDate ?? null,
    p_turn_in_number: input.turnInNumber ?? null,
    p_pay_model: input.payModel ?? null,
  });
  if (error) throw error;
  const { data: full, error: fullErr } = await supabase
    .from("issues")
    .select(
      "id, issue_number, name, petition_id, state, validated_by, turn_in_date, turn_in_number, pay_model, petitions(code)",
    )
    .eq("id", (data as { id: string }).id)
    .single();
  if (fullErr) throw fullErr;
  return mapIssue(full);
}

export async function getBenchmark() {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("app_config")
    .select("value")
    .eq("key", "benchmark_pct")
    .maybeSingle();
  if (error) throw error;
  return num(data?.value, 75);
}

export async function setBenchmark(pct: number) {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_benchmark", { p_pct: pct });
  if (error) throw error;
}

export async function updatePayRate(issueId: string, rate: number) {
  const supabase = createClient();
  const { error } = await supabase.rpc("update_pay_rate", {
    p_issue_id: issueId,
    p_pay_rate: rate,
  });
  if (error) throw error;
}

export async function listMonthlyPayroll(month?: number, year?: number) {
  const supabase = createClient();
  let query = supabase
    .from("monthly_payroll_records")
    .select(
      "id, user_id, month, year, total_pay, total_expenses, net_payable, upfront_paid, hold_balance, status, generated_on",
    )
    .order("generated_on", { ascending: false });
  if (month) query = query.eq("month", month);
  if (year) query = query.eq("year", year);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(
    (row): MonthlyPayrollRecord => ({
      id: row.id,
      userId: row.user_id,
      month: num(row.month),
      year: num(row.year),
      totalPay: num(row.total_pay),
      totalExpenses: num(row.total_expenses),
      netPayable: num(row.net_payable),
      upfrontPaid: num(row.upfront_paid),
      holdBalance: num(row.hold_balance),
      status: row.status,
      generatedOn: row.generated_on,
    }),
  );
}

export async function runMonthlyPayroll(month: number, year: number, lock = true) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("run_monthly_payroll", {
    p_month: month,
    p_year: year,
    p_lock: lock,
  });
  if (error) throw error;
  return (data ?? []).map(
    (row: {
      id: string;
      user_id: string;
      month: number;
      year: number;
      total_pay: number;
      total_expenses: number;
      net_payable: number;
      upfront_paid: number;
      hold_balance: number;
      status: "draft" | "locked";
      generated_on: string;
    }): MonthlyPayrollRecord => ({
      id: row.id,
      userId: row.user_id,
      month: num(row.month),
      year: num(row.year),
      totalPay: num(row.total_pay),
      totalExpenses: num(row.total_expenses),
      netPayable: num(row.net_payable),
      upfrontPaid: num(row.upfront_paid),
      holdBalance: num(row.hold_balance),
      status: row.status,
      generatedOn: row.generated_on,
    }),
  );
}

export async function lockMonthlyPayroll(month: number, year: number) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("lock_monthly_payroll", {
    p_month: month,
    p_year: year,
  });
  if (error) throw error;
  return (data ?? []).map(
    (row: {
      id: string;
      user_id: string;
      month: number;
      year: number;
      total_pay: number;
      total_expenses: number;
      net_payable: number;
      upfront_paid: number;
      hold_balance: number;
      status: "draft" | "locked";
      generated_on: string;
    }): MonthlyPayrollRecord => ({
      id: row.id,
      userId: row.user_id,
      month: num(row.month),
      year: num(row.year),
      totalPay: num(row.total_pay),
      totalExpenses: num(row.total_expenses),
      netPayable: num(row.net_payable),
      upfrontPaid: num(row.upfront_paid),
      holdBalance: num(row.hold_balance),
      status: row.status,
      generatedOn: row.generated_on,
    }),
  );
}

export async function getExpenseConfig(): Promise<ExpenseConfig> {
  const supabase = createClient();
  const [{ data: cars, error: carErr }, { data: homes, error: homeErr }] = await Promise.all([
    supabase.from("car_rental_configs").select("config_type, rate, issue_id"),
    supabase.from("housing_configs").select("config_type, rate, issue_id"),
  ]);
  if (carErr) throw carErr;
  if (homeErr) throw homeErr;

  const carRows = cars ?? [];
  const homeRows = homes ?? [];
  const carStandard = carRows.find((r) => r.config_type === "standard");
  const homeStandard = homeRows.find((r) => r.config_type === "standard");
  const carPerIssue = carRows.filter((r) => r.config_type === "per_issue" && r.issue_id);

  return {
    carRental: {
      type: (carPerIssue.length ? "per_issue" : "standard") as ExpenseConfigType,
      rate: num(carStandard?.rate),
      issueRates: carPerIssue.map((r) => ({
        issueId: r.issue_id as string,
        rate: num(r.rate),
      })),
    },
    housing: {
      type: (homeStandard ? "standard" : homeRows.some((r) => r.config_type === "per_issue") ? "per_issue" : "standard") as ExpenseConfigType,
      rate: num(homeStandard?.rate ?? homeRows[0]?.rate),
      issueRates: homeRows
        .filter((r) => r.config_type === "per_issue" && r.issue_id)
        .map((r) => ({ issueId: r.issue_id as string, rate: num(r.rate) })),
    },
  };
}

export async function saveHousingStandard(rate: number) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("housing_configs")
    .select("id")
    .eq("config_type", "standard")
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from("housing_configs")
      .update({ rate })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("housing_configs").insert({
      config_type: "standard",
      rate,
      issue_id: null,
    });
    if (error) throw error;
  }
}

export async function saveCarRentalStandard(rate: number) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("car_rental_configs")
    .select("id")
    .eq("config_type", "standard")
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from("car_rental_configs")
      .update({ rate })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("car_rental_configs").insert({
      config_type: "standard",
      rate,
      issue_id: null,
    });
    if (error) throw error;
  }
}

export async function saveHousingIssueRate(issueId: string, rate: number) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("housing_configs")
    .select("id")
    .eq("config_type", "per_issue")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from("housing_configs")
      .update({ rate })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("housing_configs").insert({
      config_type: "per_issue",
      rate,
      issue_id: issueId,
    });
    if (error) throw error;
  }
}

export async function saveCarRentalIssueRate(issueId: string, rate: number) {
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("car_rental_configs")
    .select("id")
    .eq("config_type", "per_issue")
    .eq("issue_id", issueId)
    .maybeSingle();
  if (existing?.id) {
    const { error } = await supabase
      .from("car_rental_configs")
      .update({ rate })
      .eq("id", existing.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("car_rental_configs").insert({
      config_type: "per_issue",
      rate,
      issue_id: issueId,
    });
    if (error) throw error;
  }
}

export async function updateRoleCategory(
  categoryId: string,
  name: string,
  description: string,
) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("role_categories")
    .update({ name: name.trim(), description: description.trim() })
    .eq("id", categoryId)
    .select("id, name, description")
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRoleCategory(categoryId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("role_categories").delete().eq("id", categoryId);
  if (error) throw error;
}

export async function listRoleCategories(): Promise<RoleCategory[]> {
  const supabase = createClient();
  const [{ data: cats, error: catErr }, { data: members, error: memErr }] = await Promise.all([
    supabase.from("role_categories").select("id, name, description").order("name"),
    supabase.from("role_category_members").select("category_id, user_id"),
  ]);
  if (catErr) throw catErr;
  if (memErr) throw memErr;
  return (cats ?? []).map((cat) => ({
    id: cat.id,
    name: cat.name,
    description: cat.description,
    memberIds: (members ?? [])
      .filter((m) => m.category_id === cat.id)
      .map((m) => m.user_id),
  }));
}

export async function createRoleCategory(name: string, description: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("role_categories")
    .insert({ name, description })
    .select("id, name, description")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    memberIds: [] as string[],
  };
}

export async function addRoleCategoryMember(categoryId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("role_category_members").insert({
    category_id: categoryId,
    user_id: userId,
  });
  if (error) throw error;
}

export async function removeRoleCategoryMember(categoryId: string, userId: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from("role_category_members")
    .delete()
    .eq("category_id", categoryId)
    .eq("user_id", userId);
  if (error) throw error;
}

export async function updateUserAdmin(input: {
  userId: string;
  role: UserRole;
  hourlyWage?: number | null;
  wageCurrency?: WageCurrency | null;
  status?: UserStatus;
}) {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("update_user_admin", {
    p_user_id: input.userId,
    p_role: input.role,
    p_hourly_wage: input.hourlyWage ?? null,
    p_wage_currency: input.wageCurrency ?? null,
    p_status: input.status ?? "active",
  });
  if (error) throw error;
  return mapProfile(data);
}

export async function listRoleCategoryIdsForUser(userId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("role_category_members")
    .select("category_id")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []).map((row) => row.category_id as string);
}
