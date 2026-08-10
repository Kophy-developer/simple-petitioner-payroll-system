export type LaterFeatureId =
  | "lotus_firm_ledger"
  | "housing_room_moves"
  | "issues_spreadsheet_import"
  | "co_validity_drop_watcher"
  | "clock_in_out";

export type LaterFeatureSpec = {
  id: LaterFeatureId;
  title: string;
  summary: string;
  dropletSafeNow: false;
  dependsOn: string[];
};

export const laterPhase2Features: LaterFeatureSpec[] = [
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
  {
    id: "clock_in_out",
    title: "Clock in / out",
    summary: "Web time tracking for field staff (no GPS in Phase 2 scope).",
    dropletSafeNow: false,
    dependsOn: ["time entry schema", "team lead visibility rules"],
  },
];

export function laterFeaturesStatusPayload() {
  return {
    features: laterPhase2Features,
    status: "specified_deferred",
    note: "Specs only — shown on /phase2. No Phase 1 droplet migrations for these until approved.",
    buildOrderHint: [
      "lotus_firm_ledger",
      "housing_room_moves",
      "issues_spreadsheet_import",
      "co_validity_drop_watcher",
      "clock_in_out",
    ] as LaterFeatureId[],
  };
}
