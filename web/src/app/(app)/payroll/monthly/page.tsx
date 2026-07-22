"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MonthlyPayrollRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/payroll?tab=payments");
  }, [router]);
  return (
    <p className="p-8 text-sm text-ink/55">
      Monthly locked payroll has been replaced by Payments. Redirecting…
    </p>
  );
}
