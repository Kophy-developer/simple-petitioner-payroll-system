import { redirect } from "next/navigation";

export default function ExpenseConfigRedirect() {
  redirect("/admin");
}
