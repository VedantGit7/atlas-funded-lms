"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Bell, LogOut, Menu, Search, ShieldCheck, X } from "lucide-react";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import type { StudioNavItem } from "../../../features/studio/studio-navigation";
import { performAtlasLogout } from "../../../lib/auth/perform-logout";
import { resolveTenantLogoUrl } from "../../../lib/brand";
import { TenantBrandMark } from "../../patterns/TenantBrandMark";
import { ADMIN_DASHBOARD_HREF } from "../../../lib/branding/document-title";
import { ThemeModeToggle } from "../../ThemeModeToggle";
import { AdminConfirmDialog } from "../admin/AdminConfirmDialog";
import { createNavIsActive } from "../shared/shell-utils";
import { groupStudioNavigation, type StudioNavGroup } from "./studio-nav-groups";

type StudioShellMember = {
  membershipId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type StudioShellProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: StudioShellMember;
  navigationItems: StudioNavItem[];
  pendingReviewCount: number | null;
  pendingGradingCount: number | null;
  mfaEnabled: boolean;
  children: ReactNode;
};

const isActive = createNavIsActive("/studio");

function initialsOf(name: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "IN";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "IN";
}

function badgeForHref(
  href: string,
  pendingReviewCount: number | null,
  pendingGradingCount: number | null,
): number | null {
  if (href === "/studio/review") return pendingReviewCount;
  if (href === "/studio/grading") return pendingGradingCount;
  return null;
}

function SidebarFooter({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="space-y-1 border-t border-[var(--admin-border)] px-3 pb-1 pt-4">
      <Link
        href={ADMIN_DASHBOARD_HREF}
        prefetch={false}
        className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
      >
        <ArrowLeft className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Admin panel
      </Link>
      <button
        type="button"
        onClick={onSignOut}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
      >
        <LogOut className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Sign out
      </button>
    </div>
  );
}

function SidebarContent({
  groups,
  pathname,
  pendingReviewCount,
  pendingGradingCount,
  onNavigate,
}: {
  groups: StudioNavGroup[];
  pathname: string;
  pendingReviewCount: number | null;
  pendingGradingCount: number | null;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Studio sections">
      {groups.map((group) => (
        <div key={group.id} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const badge = badgeForHref(item.href, pendingReviewCount, pendingGradingCount);
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                {...(onNavigate ? { onClick: onNavigate } : {})}
                aria-current={active ? "page" : undefined}
                className={[
                  "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all",
                  active
                    ? "border-l-4 border-[var(--admin-primary)] bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                    : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                {typeof badge === "number" && badge > 0 ? (
                  <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[var(--admin-warning)]/20 px-1.5 text-[11px] font-bold text-[var(--admin-warning)]">
                    {badge > 99 ? "99+" : badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function StudioShell({
  branding,
  requestId,
  member,
  navigationItems,
  pendingReviewCount,
  pendingGradingCount,
  mfaEnabled,
  children,
}: StudioShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const groups = groupStudioNavigation(navigationItems);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      const destination = await performAtlasLogout();
      router.push(destination);
      router.refresh();
    } catch {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  }

  const publicName = branding.publicName?.trim() || "Academy";
  const displayName = member.displayName?.trim() || "Instructor";

  const sidebarHeader = (
    <div className="px-5 pb-6 pt-1">
      <Link
        href={ADMIN_DASHBOARD_HREF}
        prefetch={false}
        className="flex items-center gap-3 rounded-lg outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2"
        aria-label={`${publicName} admin dashboard`}
      >
        <TenantBrandMark
          logoUrl={resolveTenantLogoUrl(branding)}
          name={publicName}
          size={40}
          className="h-10 w-10 shrink-0 rounded-full"
        />
        <div className="min-w-0">
          <p className="truncate text-base font-extrabold leading-tight text-[var(--admin-primary)]">
            {publicName}
          </p>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Studio
          </p>
        </div>
      </Link>
    </div>
  );

  const sidebarFooter = (
    <SidebarFooter
      onSignOut={() => {
        setConfirmSignOut(true);
      }}
    />
  );

  return (
    <div className="admin-theme flex min-h-screen bg-[var(--admin-bg)] text-[var(--admin-on-surface)]">
      <a
        href="#studio-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--admin-primary)] focus:px-4 focus:py-2 focus:text-[var(--admin-on-primary)]"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] py-6 lg:flex">
        {sidebarHeader}
        <SidebarContent
          groups={groups}
          pathname={pathname}
          pendingReviewCount={pendingReviewCount}
          pendingGradingCount={pendingGradingCount}
        />
        {sidebarFooter}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden" id="studio-mobile-nav">
          <button
            type="button"
            aria-label="Close navigation"
            className="absolute inset-0 bg-[var(--admin-scrim)]"
            onClick={() => {
              setMobileOpen(false);
            }}
          />
          <aside className="absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] py-6 shadow-2xl">
            <div className="flex items-center justify-between pr-4">
              {sidebarHeader}
              <button
                type="button"
                aria-label="Close navigation"
                className="mb-6 rounded-lg p-2 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setMobileOpen(false);
                }}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <SidebarContent
              groups={groups}
              pathname={pathname}
              pendingReviewCount={pendingReviewCount}
              pendingGradingCount={pendingGradingCount}
              onNavigate={() => {
                setMobileOpen(false);
              }}
            />
            {sidebarFooter}
          </aside>
        </div>
      ) : null}

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-[280px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/95 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
            aria-controls="studio-mobile-nav"
            className="rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)] lg:hidden"
            onClick={() => {
              setMobileOpen(true);
            }}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <div className="relative hidden max-w-md flex-1 sm:block">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <label className="sr-only" htmlFor="studio-shell-search">
              Search studio
            </label>
            <input
              id="studio-shell-search"
              type="search"
              placeholder="Search courses, items, or assessments"
              className="w-full rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/40"
            />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <span
              className={[
                "hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold md:inline-flex",
                mfaEnabled
                  ? "bg-[var(--admin-success)]/15 text-[var(--admin-success)]"
                  : "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]",
              ].join(" ")}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {mfaEnabled ? "MFA verified" : "Assurance pending"}
            </span>

            <ThemeModeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]" />

            <Link
              href="/studio/review"
              prefetch={false}
              aria-label="Review notifications"
              className="relative rounded-full p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
            >
              <Bell className="h-5 w-5" aria-hidden="true" />
              {typeof pendingReviewCount === "number" && pendingReviewCount > 0 ? (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[var(--admin-danger)] ring-2 ring-[var(--admin-bg)]" />
              ) : null}
            </Link>

            <div className="hidden h-8 w-px bg-[var(--admin-border)] sm:block" />

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-bold leading-tight text-[var(--admin-on-surface)]">
                  {displayName}
                </p>
                <p className="text-[11px] text-[var(--admin-on-surface-variant)]">Instructor</p>
              </div>
              {member.avatarUrl ? (
                <img
                  src={member.avatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border-2 border-[var(--admin-primary)] object-cover"
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[var(--admin-primary)] bg-[var(--admin-surface-high)] text-sm font-bold text-[var(--admin-on-surface)]">
                  {initialsOf(member.displayName)}
                </div>
              )}
            </div>
          </div>
        </header>

        <main id="studio-main" className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>

        <footer className="flex flex-col gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span className="font-semibold text-[var(--admin-on-surface-variant)]">
            {publicName} Academy Studio
          </span>
          <span className="text-[var(--admin-on-surface-variant)]/70">
            &copy; {new Date().getFullYear()} {publicName}. All rights reserved.
          </span>
        </footer>
      </div>

      <AdminConfirmDialog
        open={confirmSignOut}
        title="Sign out of instructor studio?"
        description={`You will be returned to the sign-in screen and need to sign in again to manage content for ${publicName}.`}
        confirmLabel="Sign out"
        busyLabel="Signing out..."
        cancelLabel="Stay signed in"
        icon={LogOut}
        tone="danger"
        busy={signingOut}
        onConfirm={() => void handleSignOut()}
        onCancel={() => {
          if (!signingOut) setConfirmSignOut(false);
        }}
      />

      <span className="sr-only">Request ID: {requestId}</span>
    </div>
  );
}
