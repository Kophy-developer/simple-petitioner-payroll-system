"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, LogOut, Menu, User, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Logo } from "@/components/layout/logo";
import { OffboardFab } from "@/components/layout/offboard-fab";
import { ClockPrompt } from "@/components/clock/clock-prompt";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useDemoSession } from "@/lib/demo-session";
import { getNavForRole, isNavActive, roleLabel, type NavItem } from "@/lib/navigation";
import { userDisplayName } from "@/lib/access";
import type { UserRole } from "@/lib/types";

const SIDEBAR_SCROLL_KEY = "bap-sidebar-scroll";
const NAV_OPEN_KEY = "bap-nav-open";

type NavGroup = {
  item: NavItem;
  children: NavItem[];
};

function groupNavItems(items: NavItem[]): NavGroup[] {
  const childrenByParent = new Map<string, NavItem[]>();
  for (const item of items) {
    if (!item.parentHref) continue;
    const list = childrenByParent.get(item.parentHref) ?? [];
    list.push(item);
    childrenByParent.set(item.parentHref, list);
  }

  const groups: NavGroup[] = [];
  for (const item of items) {
    if (item.parentHref) continue;
    groups.push({ item, children: childrenByParent.get(item.href) ?? [] });
  }
  return groups;
}

function childIsActive(pathname: string, children: NavItem[]) {
  return children.some((child) => isNavActive(pathname, child.href, child.matchPrefix));
}

function NavLinks({
  role,
  pathname,
  onNavigate,
}: {
  role: UserRole;
  pathname: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const groups = useMemo(() => groupNavItems(getNavForRole(role)), [role]);
  const [openParents, setOpenParents] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(NAV_OPEN_KEY);
      if (raw) setOpenParents(JSON.parse(raw) as Record<string, boolean>);
    } catch {
    }
  }, []);

  useEffect(() => {
    setOpenParents((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const group of groups) {
        if (group.children.length === 0) continue;
        if (childIsActive(pathname, group.children) && !next[group.item.href]) {
          next[group.item.href] = true;
          changed = true;
        }
      }
      if (changed) {
        try {
          sessionStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next));
        } catch {
        }
      }
      return changed ? next : prev;
    });
  }, [pathname, groups]);

  function toggleParent(href: string) {
    setOpenParents((prev) => {
      const next = { ...prev, [href]: !prev[href] };
      try {
        sessionStorage.setItem(NAV_OPEN_KEY, JSON.stringify(next));
      } catch {
      }
      return next;
    });
  }

  let lastSection = "";

  return (
    <nav className="space-y-1">
      {groups.map(({ item, children }) => {
        const showSection = item.section && item.section !== lastSection;
        if (item.section) lastSection = item.section;
        const active = isNavActive(pathname, item.href, item.matchPrefix);
        const childActive = childIsActive(pathname, children);
        const hasChildren = children.length > 0;
        const open = hasChildren && Boolean(openParents[item.href]);

        return (
          <div key={item.href}>
            {showSection ? (
              <p className="px-3 pt-4 pb-2 text-[10px] font-semibold tracking-[0.2em] text-ink/40 uppercase">
                {item.section}
              </p>
            ) : null}
            {hasChildren ? (
              <button
                type="button"
                data-nav-active={active || childActive ? "true" : undefined}
                onClick={() => {
                  const willOpen = !open;
                  toggleParent(item.href);
                  if (willOpen) {
                    router.push(item.href);
                    onNavigate?.();
                  }
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition",
                  active || childActive
                    ? "bg-brass/15 font-medium text-ink"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink",
                )}
              >
                <span>{item.label}</span>
                <ChevronDown
                  size={14}
                  className={cn("shrink-0 text-ink/40 transition", open ? "rotate-0" : "-rotate-90")}
                />
              </button>
            ) : (
              <Link
                href={item.href}
                onClick={onNavigate}
                data-nav-active={active ? "true" : undefined}
                className={cn(
                  "flex items-center rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-brass/15 font-medium text-ink"
                    : "text-ink/70 hover:bg-ink/5 hover:text-ink",
                )}
              >
                <span>{item.label}</span>
              </Link>
            )}
            {hasChildren && open ? (
              <div className="mt-1 space-y-1 border-l border-ink/10 ml-3 pl-2">
                {children.map((child) => {
                  const childActiveItem = isNavActive(pathname, child.href, child.matchPrefix);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      data-nav-active={childActiveItem ? "true" : undefined}
                      className={cn(
                        "flex items-center rounded-xl px-3 py-2 text-sm transition",
                        childActiveItem
                          ? "bg-brass/15 font-medium text-ink"
                          : "text-ink/70 hover:bg-ink/5 hover:text-ink",
                      )}
                    >
                      <span>{child.label}</span>
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useDemoSession();
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    function onScroll() {
      if (!scrollRef.current) return;
      sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(scrollRef.current.scrollTop));
    }

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const saved = sessionStorage.getItem(SIDEBAR_SCROLL_KEY);
    if (saved !== null) {
      el.scrollTop = Number(saved) || 0;
    }

    requestAnimationFrame(() => {
      const active = el.querySelector<HTMLElement>("[data-nav-active='true']");
      if (!active) return;

      const containerRect = el.getBoundingClientRect();
      const activeRect = active.getBoundingClientRect();
      const fullyVisible =
        activeRect.top >= containerRect.top + 8 &&
        activeRect.bottom <= containerRect.bottom - 8;

      if (!fullyVisible) {
        active.scrollIntoView({ block: "nearest", inline: "nearest" });
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(el.scrollTop));
      }
    });
  }, [pathname]);

  if (!user) return null;

  const onboarding = pathname.startsWith("/onboarding");

  if (onboarding) {
    return (
      <div className="min-h-screen bg-parchment/40">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink/10 bg-ink text-parchment print:hidden lg:hidden">
        <div className="flex items-center justify-between px-4 py-3">
          <Logo compact />
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </header>

      <div className="flex flex-1">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-ink/10 bg-parchment/95 backdrop-blur-md transition-transform print:hidden lg:sticky lg:top-0 lg:h-svh lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="hidden shrink-0 border-b border-ink/10 bg-ink px-5 py-5 lg:block">
            <Logo />
          </div>
          <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
            <Link
              href="/profile"
              className="mb-4 block shrink-0 rounded-2xl border border-ink/10 bg-white/70 p-4 transition hover:border-brass/30"
            >
              <p className="text-sm font-medium text-ink">{userDisplayName(user)}</p>
              <p className="text-xs text-ink/55">{user.email}</p>
              <p className="mt-2 inline-flex rounded-full bg-civic-navy/10 px-2.5 py-1 text-[11px] font-medium text-civic-navy">
                {roleLabel(user.role)}
              </p>
            </Link>
            <NavLinks
              role={user.role}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <div className="mt-auto space-y-2 border-t border-ink/10 pt-4">
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-ink/70 hover:bg-ink/5"
              >
                <User size={16} /> Profile
              </Link>
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={signOut}
              >
                <LogOut size={16} /> Sign out
              </Button>
            </div>
          </div>
        </aside>
        {mobileOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-30 bg-ink/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
        ) : null}
        <main className="min-w-0 flex-1 overflow-x-hidden">
          <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">{children}</div>
        </main>
      </div>
      <OffboardFab />
      <ClockPrompt />
    </div>
  );
}
