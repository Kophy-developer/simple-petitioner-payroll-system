import { redirect } from "next/navigation";

export default function ColoradoImporterPage() {
  redirect("/imports?tab=validity");
}
