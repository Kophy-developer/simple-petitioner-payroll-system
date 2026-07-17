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
import { createClient } from "@/lib/supabase/client";
import { demoPassword, demoUsers } from "./demo-data";
import type { DemoUser, UserRole, UserStatus, WageCurrency } from "./types";

type SessionContextValue = {
  user: DemoUser | null;
  isLoading: boolean;
  authReady: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => void;
  switchRole: (role: UserRole) => void;
  updateUser: (patch: Partial<DemoUser>) => Promise<void>;
};

type ProfileRow = {
  id: string;
  first_name: string;
  last_name: string;
  initials: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  wage_currency: WageCurrency | null;
  hourly_wage: number | null;
  profile_tags: string[] | null;
};

const SessionContext = createContext<SessionContextValue | null>(null);

const roleDemoUsers = (
  ["super_admin", "account_admin", "team_lead", "petitioner", "validator"] as UserRole[]
)
  .map((role) => demoUsers.find((u) => u.role === role))
  .filter(Boolean) as DemoUser[];

function mapProfile(
  profile: ProfileRow,
  teamMemberIds: string[] = [],
): DemoUser {
  const bridge = demoUsers.find(
    (u) => u.email.toLowerCase() === profile.email.toLowerCase(),
  );

  return {
    id: bridge?.id ?? profile.id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    initials: profile.initials,
    role: profile.role,
    status: profile.status,
    profileTags: profile.profile_tags ?? [],
    roleCategoryIds: [],
    wageCurrency: profile.wage_currency ?? undefined,
    hourlyWage: profile.hourly_wage ?? undefined,
    teamMemberIds: teamMemberIds.length ? teamMemberIds : bridge?.teamMemberIds,
    authId: profile.id,
  };
}

async function fetchSessionUser(): Promise<DemoUser | null> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const { data: profile, error } = await supabase
    .from("profiles")
    .select(
      "id, first_name, last_name, initials, email, role, status, wage_currency, hourly_wage, profile_tags",
    )
    .eq("id", session.user.id)
    .maybeSingle();

  if (error || !profile) return null;

  const { data: memberships } = await supabase
    .from("team_memberships")
    .select("member_id")
    .eq("lead_id", session.user.id);

  const memberAuthIds = (memberships ?? []).map((m) => m.member_id as string);

  return mapProfile(profile as ProfileRow, memberAuthIds);
}

export function DemoSessionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<DemoUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function boot() {
      try {
        const next = await fetchSessionUser();
        if (active) setUser(next);
      } finally {
        if (active) {
          setIsLoading(false);
          setAuthReady(true);
        }
      }
    }

    boot();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      setTimeout(async () => {
        if (!active) return;

        if (event === "SIGNED_OUT") {
          setUser(null);
          setIsLoading(false);
          setAuthReady(true);
          return;
        }

        if (
          event === "SIGNED_IN" ||
          event === "TOKEN_REFRESHED" ||
          event === "USER_UPDATED" ||
          event === "INITIAL_SESSION"
        ) {
          const next = await fetchSessionUser();
          if (!active) return;
          if (next) setUser(next);
          setIsLoading(false);
          setAuthReady(true);
        }
      }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const supabase = createClient();
      setIsLoading(true);

      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (error) {
        setIsLoading(false);
        return { error: "Invalid email or password." };
      }

      const next = await fetchSessionUser();
      if (!next) {
        await supabase.auth.signOut();
        setIsLoading(false);
        return { error: "Account profile is missing. Ask an admin to finish setup." };
      }

      setUser(next);
      setIsLoading(false);
      setAuthReady(true);
      router.replace("/dashboard");
      return {};
    },
    [router],
  );

  const signOut = useCallback(async () => {
    const supabase = createClient();
    setIsLoading(true);
    await supabase.auth.signOut();
    setUser(null);
    setIsLoading(false);
    setAuthReady(true);
    router.replace("/login");
  }, [router]);

  const switchRole = useCallback(
    async (role: UserRole) => {
      const match = roleDemoUsers.find((u) => u.role === role);
      if (!match) return;
      await signIn(match.email, demoPassword);
    },
    [signIn],
  );

  const updateUser = useCallback(
    async (patch: Partial<DemoUser>) => {
      if (!user) return;

      if (!user.authId) {
        setUser({ ...user, ...patch });
        return;
      }

      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: patch.firstName ?? user.firstName,
          last_name: patch.lastName ?? user.lastName,
          initials: patch.initials ?? user.initials,
          profile_tags: patch.profileTags ?? user.profileTags,
        })
        .eq("id", user.authId);

      if (error) throw error;

      setUser({ ...user, ...patch });
    },
    [user],
  );

  const value = useMemo(
    () => ({ user, isLoading, authReady, signIn, signOut, switchRole, updateUser }),
    [user, isLoading, authReady, signIn, signOut, switchRole, updateUser],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useDemoSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useDemoSession must be used within DemoSessionProvider");
  return ctx;
}

export { roleDemoUsers };
