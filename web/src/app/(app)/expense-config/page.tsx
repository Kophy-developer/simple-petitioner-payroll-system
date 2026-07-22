import { redirect } from "next/navigation";

export default function ExpenseConfigPage() {
  redirect("/admin?tab=expense-config");
}
