export type UserRole =
  | "super_admin"
  | "account_admin"
  | "team_lead"
  | "petitioner"
  | "canvasser"
  | "validator";

export type PayModel = "validity_standard" | "per_valid_sig";
export type WageCurrency = "USD" | "PHP";
export type UserStatus = "active" | "inactive" | "offboarded";
export type LoanStatus = "pending" | "approved" | "rejected" | "auto_rejected";
export type ExpenseType =
  | "upfront_draw"
  | "chargeback"
  | "hotel_travel"
  | "health"
  | "car_rental"
  | "housing"
  | "flight"
  | "gas"
  | "other";
export type PayrollRecordStatus = "draft" | "locked";
export type ExpenseConfigType = "standard" | "per_issue";
export type PaymentBucket =
  | "payroll"
  | "chargebacks"
  | "loans_advances"
  | "hotel_expense"
  | "reimburse"
  | "paid";
export type PaymentEventType =
  | "onpay"
  | "cashapp"
  | "full_pay"
  | "upfront"
  | "validity_hold"
  | "expenses"
  | "housing"
  | "lodging"
  | "bonus"
  | "advances"
  | "flight_advance"
  | "paid"
  | "other";
export type LodgingKind = "airbnb" | "hotel";

export type DemoUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  initials: string;
  role: UserRole;
  status: UserStatus;
  profileTags: string[];
  roleCategoryIds: string[];
  wageCurrency?: WageCurrency;
  hourlyWage?: number;
  teamMemberIds?: string[];
  authId?: string;
  employeeId?: string | null;
  brexUserId?: string | null;
  phone?: string | null;
  subAccountId?: string | null;
  subAccountCode?: string | null;
  mustChangePassword?: boolean;
  onboardingComplete?: boolean;
  inviteSentAt?: string | null;
  isLotus?: boolean;
};

export type HousingShareKind = "full" | "half" | "skip";

export type RentalCarAssignment = {
  id: string;
  userId: string;
  pickupAt: string;
  returnAt: string | null;
  agreementNumber: string | null;
  pickupLocation: string | null;
  dropoffLocation: string | null;
  oneWayFee: number;
  monthlyAccrualAmount: number;
  active: boolean;
  lastAccruedOn: string | null;
  truedUpAt: string | null;
};

export type BrexMatchMethod =
  | "email"
  | "card_owner_email"
  | "brex_user_id"
  | "name_exact"
  | "name_similar";

export type BrexTransaction = {
  id: string;
  brexId: string;
  cardholderName: string | null;
  amount: number;
  occurredAt: string | null;
  merchantName: string | null;
  description: string | null;
  memo: string | null;
  expenseStatus: string | null;
  paymentStatus: string | null;
  brexUserEmail: string | null;
  matchMethod: BrexMatchMethod | null;
  matchConfidence: number | null;
  matchedUserId: string | null;
  disputedAt: string | null;
  disputeNote: string | null;
  reimbursementRequested: boolean;
  reimbursementStatus: "none" | "pending" | "approved" | "rejected" | "disputed";
};

export type Petition = {
  id: string;
  name: string;
  code: string;
  pay: number;
  lotus: string;
};

export type Issue = {
  id: string;
  issueNumber: string;
  name: string;
  petitionId: string;
  petitionCode: string;
  state: string;
  validatedBy: string;
  turnInDate: string;
  turnInNumber: string;
  payModel: PayModel;
};

export type Submission = {
  id: string;
  userId: string;
  issueId: string;
  rawSignatures: number;
  pageNumbers: number;
  pooledSignatures: number;
  pooledPages: number;
  lastEditedBy?: string | null;
  lastEditedAt?: string | null;
};

export type ValidityRecord = {
  id: string;
  issueId: string;
  userId: string;
  dups: number;
  usable: number;
  valid: number;
  validityPercent: number;
  entryMethod: "upload" | "manual";
};

export type LedgerRow = {
  id: string;
  userId: string;
  issueId: string;
  sigs: number;
  pay: number;
  estimatedPay: number;
  dups: number | null;
  usable: number | null;
  valid: number | null;
  validityPercent: number | null;
  payRate: number;
  payable: number | null;
  totalPay: number | null;
  upfront: number | null;
  hold: number | null;
  payModel: PayModel;
  validityPending: boolean;
  recalculatedAt: string | null;
};

export type Expense = {
  id: string;
  userId: string;
  issueId: string | null;
  type: ExpenseType;
  amount: number;
  date: string;
  endDate?: string | null;
  receiptName: string;
};

export type LoanRequest = {
  id: string;
  userId: string;
  amount: number;
  holdSnapshot: number;
  note?: string | null;
  status: LoanStatus;
  createdAt: string;
  reviewedAt?: string | null;
  reviewedBy?: string | null;
};

export type PayRate = {
  petitionId: string;
  issueId: string;
  rate: number;
};

export type RoleCategory = {
  id: string;
  name: string;
  description: string;
  memberIds: string[];
};

export type MonthlyPayrollRecord = {
  id: string;
  userId: string;
  month: number;
  year: number;
  totalPay: number;
  totalExpenses: number;
  netPayable: number;
  upfrontPaid: number;
  holdBalance: number;
  status: PayrollRecordStatus;
  generatedOn: string;
};

export type ExpenseConfig = {
  carRental: { type: ExpenseConfigType; rate: number; issueRates: { issueId: string; rate: number }[] };
  housing: { type: ExpenseConfigType; rate: number; issueRates: { issueId: string; rate: number }[] };
};

export type SubAccount = {
  id: string;
  code: string;
  name: string;
  isPrimary: boolean;
};

export type PricedPetitionLine = {
  id: string;
  petitionId: string | null;
  name: string;
  code: string;
  pay: number;
  lotusPay: number;
  officialNumber: string | null;
  officialName: string | null;
  ontargetName: string | null;
  clientReportName: string | null;
};

export type TurnIn = {
  id: string;
  turnInNumber: string;
  name: string;
  state: string;
  turnInDate: string | null;
  benchmarkPct: number;
};

export type TurnInColumn = {
  id: string;
  turnInId: string;
  pricedLineId: string;
  code: string;
  pay: number;
  lotusPay: number;
  sortOrder: number;
  benchmarkPct: number | null;
};

export type TurnInEntry = {
  id: string;
  turnInId: string;
  columnId: string;
  userId: string;
  sigs: number;
  books: number;
};

export type LedgerLine = {
  id: string;
  userId: string;
  turnInId: string;
  columnId: string;
  sigs: number;
  pay: number;
  estimatedPay: number;
  dups: number | null;
  usable: number | null;
  valid: number | null;
  validityPercent: number | null;
  payRate: number;
  payable: number | null;
  totalPay: number | null;
  upfront: number | null;
  hold: number | null;
  benchmarkPct: number;
  validityPending: boolean;
};

export type PaymentEvent = {
  id: string;
  userId: string;
  bucket: PaymentBucket;
  eventType: PaymentEventType;
  amount: number;
  notes: string | null;
  receiptPath: string | null;
  eventDate: string;
  paidAt: string | null;
  fundsHitAt: string | null;
  loanId: string | null;
};

export type LodgingProperty = {
  id: string;
  kind: LodgingKind;
  name: string;
  address: string | null;
  dailyTotal: number | null;
  roomCount: number | null;
  roomRate: number | null;
  fullRate?: number | null;
  halfRate?: number | null;
};

export type LodgingOccupancy = {
  id: string;
  propertyId: string;
  userId: string;
  roomNumber: string;
  occupantsInRoom: number;
  checkInAt: string;
  checkOutAt: string | null;
  checkOutDate: string | null;
  checkOutBackdated: boolean;
  dailyAmount: number | null;
  shareKind?: HousingShareKind;
  checkoutRequestedAt?: string | null;
  checkoutApprovedAt?: string | null;
};
