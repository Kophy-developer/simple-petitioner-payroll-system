export type LaterFeatureId =
  | "lotus_firm_ledger"
  | "housing_room_moves"
  | "issues_spreadsheet_import"
  | "co_validity_drop_watcher"
  | "per_door_knock_pay";

export type LaterFeatureSpec = {
  id: LaterFeatureId;
  title: string;
  summary: string;
  dropletSafeNow: false;
  dependsOn: string[];
};

export const laterPhase2Features: LaterFeatureSpec[] = [
  {
    id: "per_door_knock_pay",
    title: "Pay per door knock",
    summary:
      "Issue pay model for door-knock campaigns: rate × confirmed doors from validity/confirmation import, with no validity-percent benchmark.",
    dropletSafeNow: false,
    dependsOn: [
      "pay_model enum per_door_knock",
      "confirmation import columns",
      "ledger recalculation for door units",
    ],
  },
  {
    id: "lotus_firm_ledger",
    title: "Lotus firm ledger",
    summary: "Full firm-side Lotus ledger and accounting beyond Phase 1 tag-only/hidden surfaces.",
    dropletSafeNow: false,
    dependsOn: ["Phase 1 testing sign-off", "ledger ACL review"],
  },
  {
    id: "housing_room_moves",
    title: "Housing room moves",
    summary: "Move occupants between properties/rooms with correct rates and accrual continuity.",
    dropletSafeNow: false,
    dependsOn: ["Phase 1 Field Ops stable", "additive lodging RPCs"],
  },
  {
    id: "issues_spreadsheet_import",
    title: "Issues spreadsheet import",
    summary: "Import issues from workbook instead of deep-link-only Imports hub cards.",
    dropletSafeNow: false,
    dependsOn: ["sample workbook from client"],
  },
  {
    id: "co_validity_drop_watcher",
    title: "CO validity drop-folder watcher",
    summary: "Auto-ingest validity files from drop folder into Validity Records.",
    dropletSafeNow: false,
    dependsOn: ["storage watcher host", "parser fixtures"],
  },
];

export function laterFeaturesStatusPayload() {
  return {
    features: laterPhase2Features,
    status: "specified_deferred",
    note: "Next pay wave: per_door_knock. Clock in/out with GPS shipped separately. No chat/MFA login in this wave.",
    buildOrderHint: [
      "per_door_knock_pay",
      "lotus_firm_ledger",
      "housing_room_moves",
      "issues_spreadsheet_import",
      "co_validity_drop_watcher",
    ] as LaterFeatureId[],
  };
}
