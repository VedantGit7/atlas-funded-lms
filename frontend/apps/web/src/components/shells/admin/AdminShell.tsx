"use client";

import { MfaStepUpProvider } from "../../security/MfaStepUpProvider";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import {
  ExternalLink,
  GraduationCap,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import type { AdminNavItem } from "../../../features/admin/admin-navigation";
import { AdminNotificationPopover } from "../../../features/notifications/components/AdminNotificationPopover";
import { performAtlasLogout } from "../../../lib/auth/perform-logout";
import { DeviceSessionCapture } from "../../observability/DeviceSessionCapture";
import { resolveTenantLogoUrl } from "../../../lib/brand";
import { TenantBrandMark } from "../../patterns/TenantBrandMark";
import { ADMIN_DASHBOARD_HREF } from "../../../lib/branding/document-title";
import { ThemeModeToggle } from "../../ThemeModeToggle";
import { AccountMenu, type AccountMenuItem } from "../shared/AccountMenu";
import { AdminConfirmDialog } from "./AdminConfirmDialog";
import { createNavIsActive } from "../shared/shell-utils";
import {
  AdminNavChevronDownIcon,
  AdminNavChevronIcon,
  groupAdminNavigation,
  type AdminNavGroup,
} from "./admin-nav-groups";
import { ADMIN_INSIGHTS_HREF } from "../../../features/admin/insights/admin-insights-catalog";
import { ADMIN_MANAGE_HREF } from "../../../features/admin/manage/admin-manage-catalog";
import {
  ADMIN_MARKETING_HREF,
  isAdminMarketingPath,
} from "../../../features/admin/grow/admin-marketing-catalog";
import {
  ADMIN_SALES_HREF,
  isAdminSalesPath,
} from "../../../features/admin/grow/admin-sales-catalog";
import { ADMIN_REPORTS_HREF } from "../../../features/admin/reports/admin-reports-catalog";

const ACCOUNT_MENU_ITEMS: AccountMenuItem[] = [
  { href: "/profile", label: "Profile", icon: UserRound },
];

type AdminShellMember = {
  membershipId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

type AdminShellProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: AdminShellMember;
  navigationItems: AdminNavItem[];
  pendingReviewCount: number | null;
  mfaEnabled: boolean;
  children: ReactNode;
};

const isActive = createNavIsActive(ADMIN_DASHBOARD_HREF);

function initialsOf(name: string | null): string {
  const trimmed = name?.trim();
  if (!trimmed) return "AD";
  const parts = trimmed.split(/\s+/).slice(0, 2);
  return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "AD";
}

function SidebarFooter({ pathname, onSignOut }: { pathname: string; onSignOut: () => void }) {
  const trashActive = pathname === "/admin/trash" || pathname.startsWith("/admin/trash/");
  const settingsActive = pathname === "/admin/settings" || pathname.startsWith("/admin/settings/");

  return (
    <div className="space-y-1 border-t border-[var(--admin-border)] px-3 pb-1 pt-4">
      <Link
        href="/admin/trash"
        prefetch={false}
        aria-current={trashActive ? "page" : undefined}
        className={[
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          trashActive
            ? "bg-[var(--admin-success)]/15 text-[var(--admin-success)]"
            : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-success)]/10 hover:text-[var(--admin-success)]",
        ].join(" ")}
      >
        <Trash2
          className={["h-[18px] w-[18px]", trashActive ? "fill-current" : ""].join(" ")}
          strokeWidth={2}
          aria-hidden="true"
        />
        Trash
      </Link>
      <Link
        href="/admin/settings"
        prefetch={false}
        aria-current={settingsActive ? "page" : undefined}
        className={[
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          settingsActive
            ? "border-l-4 border-[var(--admin-primary)] bg-[var(--admin-primary-container)] pl-[calc(0.75rem-4px)] text-[var(--admin-on-primary-container)]"
            : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
        ].join(" ")}
      >
        <Settings className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
        Settings
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
  onNavigate,
}: {
  groups: AdminNavGroup[];
  pathname: string;
  pendingReviewCount: number | null;
  onNavigate?: () => void;
}) {
  const managePathActive =
    pathname === ADMIN_MANAGE_HREF || pathname.startsWith(`${ADMIN_MANAGE_HREF}/`);
  const marketingPathActive = isAdminMarketingPath(pathname);
  const salesPathActive = isAdminSalesPath(pathname);
  const reportsPathActive =
    pathname === ADMIN_REPORTS_HREF || pathname.startsWith(`${ADMIN_REPORTS_HREF}/`);
  const insightsPathActive =
    pathname === ADMIN_INSIGHTS_HREF || pathname.startsWith(`${ADMIN_INSIGHTS_HREF}/`);
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    [ADMIN_MANAGE_HREF]: managePathActive,
    [ADMIN_MARKETING_HREF]: marketingPathActive,
    [ADMIN_SALES_HREF]: salesPathActive,
    [ADMIN_REPORTS_HREF]: reportsPathActive,
    [ADMIN_INSIGHTS_HREF]: insightsPathActive,
  });

  useEffect(() => {
    setOpenSections((prev) => {
      const next = { ...prev };
      let changed = false;
      if (managePathActive && !prev[ADMIN_MANAGE_HREF]) {
        next[ADMIN_MANAGE_HREF] = true;
        changed = true;
      }
      if (marketingPathActive && !prev[ADMIN_MARKETING_HREF]) {
        next[ADMIN_MARKETING_HREF] = true;
        changed = true;
      }
      if (salesPathActive && !prev[ADMIN_SALES_HREF]) {
        next[ADMIN_SALES_HREF] = true;
        changed = true;
      }
      if (reportsPathActive && !prev[ADMIN_REPORTS_HREF]) {
        next[ADMIN_REPORTS_HREF] = true;
        changed = true;
      }
      if (insightsPathActive && !prev[ADMIN_INSIGHTS_HREF]) {
        next[ADMIN_INSIGHTS_HREF] = true;
        changed = true;
      }
      return changed ? next : prev;
    });
  }, [
    managePathActive,
    marketingPathActive,
    salesPathActive,
    reportsPathActive,
    insightsPathActive,
  ]);

  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-2" aria-label="Admin sections">
      {groups.map((group) => (
        <div key={group.id} className="space-y-1">
          <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--admin-on-surface-variant)]/70">
            {group.label}
          </p>
          {group.items.map((item) => {
            const Icon = item.icon;
            const active = isActive(pathname, item.href);
            const badge = item.href === "/admin/review" ? pendingReviewCount : null;
            const hasChildren = Boolean(item.children && item.children.length > 0);
            const childActive = item.children?.some(
              (child) => pathname === child.href || pathname.startsWith(`${child.href}/`),
            );
            const expanded =
              hasChildren && item.expandable ? Boolean(openSections[item.href]) : false;
            const parentActive = active || Boolean(childActive);

            if (hasChildren && item.expandable) {
              return (
                <div key={item.href} className="space-y-1">
                  <button
                    type="button"
                    aria-expanded={expanded}
                    onClick={() => {
                      setOpenSections((prev) => ({
                        ...prev,
                        [item.href]: !prev[item.href],
                      }));
                    }}
                    className={[
                      "group flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all",
                      parentActive
                        ? "border-l-4 border-[var(--admin-primary)] bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                        : "border-l-4 border-transparent text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                    ].join(" ")}
                  >
                    <Icon
                      className="h-[18px] w-[18px] shrink-0"
                      strokeWidth={2}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {expanded ? (
                      <AdminNavChevronDownIcon
                        className="h-4 w-4 shrink-0 opacity-60"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    ) : (
                      <AdminNavChevronIcon
                        className="h-4 w-4 shrink-0 opacity-50"
                        strokeWidth={2}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {expanded ? (
                    <div className="relative ml-5 space-y-0.5 border-l border-[var(--admin-border)] pl-3">
                      {item.children?.map((child) => {
                        const childIsActive =
                          pathname === child.href || pathname.startsWith(`${child.href}/`);
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            prefetch={false}
                            {...(onNavigate ? { onClick: onNavigate } : {})}
                            aria-current={childIsActive ? "page" : undefined}
                            className={[
                              "flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                              childIsActive
                                ? "bg-[var(--admin-primary-container)] text-[var(--admin-on-primary-container)]"
                                : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                            {child.badge === "new" ? (
                              <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--admin-success)_18%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-success)]">
                                New
                              </span>
                            ) : null}
                            {child.badge === "beta" ? (
                              <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-primary)]">
                                Beta
                              </span>
                            ) : null}
                          </Link>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            }

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
                ) : item.expandable ? (
                  <AdminNavChevronIcon
                    className="h-4 w-4 shrink-0 opacity-50"
                    strokeWidth={2}
                    aria-hidden="true"
                  />
                ) : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function AdminShell({
  branding,
  requestId,
  member,
  navigationItems,
  pendingReviewCount,
  mfaEnabled,
  children,
}: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const groups = groupAdminNavigation(navigationItems);

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

  const publicName = branding.publicName?.trim() || branding.issuerName?.trim() || "Academy";
  const displayName = member.displayName?.trim() || "Admin";

  const sidebarHeader = (
    <div className="px-5 pb-6 pt-1">
      <Link
        href={ADMIN_DASHBOARD_HREF}
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
            Academy Admin
          </p>
        </div>
      </Link>
    </div>
  );

  const sidebarFooter = (
    <SidebarFooter
      pathname={pathname}
      onSignOut={() => {
        setConfirmSignOut(true);
      }}
    />
  );

  return (
    <div className="admin-theme flex min-h-screen bg-[var(--admin-bg)] text-[var(--admin-on-surface)]">
      <DeviceSessionCapture />
      <MfaStepUpProvider />
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-lg focus:bg-[var(--admin-primary)] focus:px-4 focus:py-2 focus:text-[var(--admin-on-primary)]"
      >
        Skip to content
      </a>

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[280px] flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] py-6 lg:flex">
        {sidebarHeader}
        <SidebarContent
          groups={groups}
          pathname={pathname}
          pendingReviewCount={pendingReviewCount}
        />
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
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
              onNavigate={() => {
                setMobileOpen(false);
              }}
            />
            {sidebarFooter}
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col lg:ml-[280px]">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-bg)]/95 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileOpen}
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
            <label className="sr-only" htmlFor="admin-shell-search">
              Search admin
            </label>
            <input
              id="admin-shell-search"
              type="search"
              placeholder="Search members, content, or settings"
              className="w-full rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--admin-primary)]/40"
            />
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Link
              href="/?view=learner"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="View as learner (opens in a new tab)"
              className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
            >
              <GraduationCap className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">View as learner</span>
              <ExternalLink className="hidden h-3 w-3 opacity-60 sm:inline" aria-hidden="true" />
            </Link>

            <span
              className={[
                "hidden items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold md:inline-flex",
                mfaEnabled
                  ? "bg-[var(--admin-success)]/15 text-[var(--admin-success)]"
                  : "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]",
              ].join(" ")}
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {mfaEnabled ? "MFA enrolled" : "MFA not enrolled"}
            </span>

            <ThemeModeToggle className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]" />

            <AdminNotificationPopover />

            <div className="hidden h-8 w-px bg-[var(--admin-border)] sm:block" />

            <AccountMenu
              triggerLabel="Account menu"
              triggerClassName="flex items-center gap-3 rounded-full transition-opacity hover:opacity-80"
              trigger={
                <>
                  <div className="hidden text-right sm:block">
                    <p className="text-sm font-bold leading-tight text-[var(--admin-on-surface)]">
                      {displayName}
                    </p>
                    <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      Administrator
                    </p>
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
                </>
              }
              panelClassName="absolute right-0 top-[calc(100%+10px)] z-50 w-56 overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1.5 shadow-2xl"
              itemClassName="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
              items={ACCOUNT_MENU_ITEMS}
              onSignOut={() => {
                setConfirmSignOut(true);
              }}
              signOutLabel="Sign out"
              signOutIcon={LogOut}
              signOutItemClassName="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]"
            />
          </div>
        </header>

        <main id="admin-main" className="flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>

        <footer className="flex flex-col gap-2 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4 text-xs sm:flex-row sm:items-center sm:justify-between md:px-8">
          <span className="font-semibold text-[var(--admin-on-surface-variant)]">
            {publicName} Academy Admin
          </span>
          <span className="text-[var(--admin-on-surface-variant)]/70">
            &copy; {new Date().getFullYear()} {publicName}. All rights reserved.
          </span>
        </footer>
      </div>

      <AdminConfirmDialog
        open={confirmSignOut}
        title="Sign out of the admin console?"
        description={`You will be returned to the sign-in screen and need to sign in again to manage ${publicName}.`}
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
