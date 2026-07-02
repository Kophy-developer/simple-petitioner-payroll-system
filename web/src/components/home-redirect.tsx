"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDemoSession } from "@/lib/demo-session";

export function HomeRedirect() {
  const { user, isLoading } = useDemoSession();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(user ? "/dashboard" : "/login");
  }, [user, isLoading, router]);

  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="h-8 w-8 animate-pulse rounded-full bg-brass/40" />
    </div>
  );
}
