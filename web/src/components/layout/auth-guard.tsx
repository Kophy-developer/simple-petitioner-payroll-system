"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDemoSession } from "@/lib/demo-session";
import { canAccess } from "@/lib/navigation";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useDemoSession();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!canAccess(user.role, pathname)) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, pathname, router]);

  if (isLoading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <div className="h-8 w-8 animate-pulse rounded-full bg-brass/40" />
      </div>
    );
  }

  if (!canAccess(user.role, pathname)) {
    return null;
  }

  return children;
}
