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

const STORAGE_KEY = "bap-demo-session-v3";

type DemoSessionContextValue = {
  user: DemoUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
  switchRole: (role: UserRole) => void;
  updateUser: (patch: Partial<DemoUser>) => void;
};

const DemoSessionContext = createContext<DemoSessionContextValue | null>(null);

const roleDemoUsers = (["super_admin", "account_admin", "team_lead", "petitioner", "canvasser", "validator"] as UserRole[])
  .map((role) => demoUsers.find((u) => u.role === role))
  .filter(Boolean) as DemoUser[];

function readStoredUser(): DemoUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as DemoUser;
    return demoUsers.find((u) => u.id === parsed.id) ?? parsed;
  } catch {
    return null;
  }
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setIsLoading(false);
  }, []);

  const persist = useCallback((next: DemoUser | null) => {
    setUser(next);
    if (next) localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    else localStorage.removeItem(STORAGE_KEY);
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const match = demoUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!match || password !== "demo1234") return { error: "Invalid email or password." };
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
      const match = roleDemoUsers.find((u) => u.role === role);
      if (match) persist(match);
    },
    [persist],
  );

  const updateUser = useCallback(
    (patch: Partial<DemoUser>) => {
      if (!user) return;
      persist({ ...user, ...patch });
    },
    [persist, user],
  );

  const value = useMemo(
    () => ({ user, isLoading, signIn, signOut, switchRole, updateUser }),
    [user, isLoading, signIn, signOut, switchRole, updateUser],
  );

  return <DemoSessionContext.Provider value={value}>{children}</DemoSessionContext.Provider>;
}

export function useDemoSession() {
  const ctx = useContext(DemoSessionContext);
  if (!ctx) throw new Error("useDemoSession must be used within DemoSessionProvider");
  return ctx;
}

export { roleDemoUsers };
