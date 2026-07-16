export type UserRole =
  | "super_admin"
  | "account_admin"
  | "team_lead"
  | "petitioner"
  | "canvasser"
  | "validator";

export type PayModel = "validity_standard" | "per_valid_sig";
export type WageCurrency = "USD" | "PHP";
export type UserStatus = "active" | "inactive";
export type LoanStatus = "pending" | "approved" | "rejected" | "auto_rejected";
export type ExpenseType =
  | "upfront_draw"
  | "chargeback"
  | "hotel_travel"
  | "health"
  | "car_rental"
  | "housing"
  | "other";
export type PayrollRecordStatus = "draft" | "locked";
export type ExpenseConfigType = "standard" | "per_issue";

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
