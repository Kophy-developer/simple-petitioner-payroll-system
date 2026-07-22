import { redirect } from "next/navigation";

export default function PayRatesPage() {
  redirect("/admin?tab=pay-rates");
}
