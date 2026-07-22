import { redirect } from "next/navigation";

export default function LotusLedgerPage() {
  redirect("/ledger?view=lotus");
}
