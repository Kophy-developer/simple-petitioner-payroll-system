"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { demoUsers } from "./demo-data";
import type { DemoUser, UserRole } from "./types";

const STORAGE_KEY = "bap-demo-session";

type DemoSessionContextValue = {
  user: DemoUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
  switchRole: (role: UserRole) => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

function readStoredUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as DemoUser;
  } catch {
    return null;
  }
}

export function DemoSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  const persist = useCallback((next: DemoUser | null) => {
    setUser(next);
    if (next) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const match = demoUsers.find(
        (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
      );

      if (!match || password !== "demo1234") {
        return { error: "Invalid email or password." };
      }

      persist(match);
      router.push("/dashboard");
      return {};
    },
    [persist, router],
  );

  const signOut = useCallback(() => {
    persist(null);
    router.push("/login");
  }, [persist, router]);

  const switchRole = useCallback(
    (role: UserRole) => {
      const match = demoUsers.find((u) => u.role === role);
      if (match) {
        persist(match);
      }
    },
    [persist],
  );

  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut, switchRole }),
    [user, isLoading, signIn, signOut, switchRole],
  );

  return (
    <DemoSessionContext.Provider value={value}>
      {children}
    </DemoSessionContext.Provider>
  );
}

export function useDemoSession() {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) {
    throw new Error("useDemoSession must be used within DemoSessionProvider");
  }
  return ctx;
}
