"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useState, type ReactNode } from "react";
import {
  Award,
  BarChart3,
  ClipboardList,
  Crown,
  Dumbbell,
  Gauge,
  GraduationCap,
  Home,
  LifeBuoy,
  Library,
  LogOut,
  Menu,
  Route as RouteIcon,
  Search,
  Settings,
  Sparkles,
  TrendingUp,
  Trophy,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import { TenantLogo } from "@atlas/design-system/components/tenant-logo";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import type { LearnerNavItem } from "../../features/learner/learner-navigation";
import { performAtlasLogout } from "../../lib/auth/perform-logout";
// H16. These three are not on the first-paint path -- one is a pure side
// effect, one only appears after the learner asks to sign out, and one injects
// marketing CTAs after hydration. Loading them with the shell put their whole
// dependency graph in the learner entry chunk, which every learner route pays
// for on first load. Deferring them costs nothing visible.
const DeviceSessionCapture = dynamic(
  () =>
    import("../observability/DeviceSessionCapture").then((m) => ({
      default: m.DeviceSessionCapture,
    })),
  { ssr: false },
);
const LearnerConfirmDialog = dynamic(
  () => import("./LearnerConfirmDialog").then((m) => ({ default: m.LearnerConfirmDialog })),
  { ssr: false },
);
import { ThemeModeToggle } from "../ThemeModeToggle";
import { DeferredMarketingCtaRuntime as MarketingCtaRuntime } from "../../features/marketing/DeferredMarketingCtaRuntime";
import { LearnerNotificationPopover } from "../../features/notifications/components/LearnerNotificationPopover";
import { ShellBottomNav } from "./shared/ShellBottomNav";
import { ShellSkipLink } from "./shared/ShellSkipLink";
import { isLearnerNavActive } from "./shared/shell-utils";

const NAV_ICONS: Record<string, LucideIcon> = {
  "/": Home,
  "/courses": GraduationCap,
  "/roadmap": RouteIcon,
  "/practice": Dumbbell,
  "/readiness": Gauge,
  "/progress": TrendingUp,
  "/resources": Library,
  "/diagnostic/me": ClipboardList,
  "/achievements": Trophy,
  "/leaderboards": BarChart3,
  "/community": Users,
  "/hall-of-fame": Crown,
  "/certificates": Award,
};

type LearnerShellClientProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: {
    membershipId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  navigationItems: LearnerNavItem[];
  unreadNotificationCount: number | null;
  children: ReactNode;
};

function Sidebar({
  branding,
  navigationItems,
  pathname,
  onNavigate = () => {},
  onSignOut,
  signingOut,
}: {
  branding: PublicTenantBranding;
  navigationItems: LearnerNavItem[];
  pathname: string;
  onNavigate?: () => void;
  onSignOut: () => void;
  signingOut: boolean;
}) {
  // Only surface real destinations in the sidebar; Search / Notifications live in the header.
  const items = navigationItems.filter(
    (item) => item.href !== "/search" && item.href !== "/notifications",
  );

  return (
    <div className="flex h-full flex-col">
      <div className="px-5 pb-4 pt-1">
        <Link
          href="/"
          prefetch={false}
          onClick={onNavigate}
          className="inline-flex text-brand-primary"
        >
          <TenantLogo
            publicName={branding.publicName ?? "Learn"}
            logoLightUrl={branding.logoLightUrl}
            logoDarkUrl={branding.logoDarkUrl}
          />
        </Link>
      </div>

      <nav aria-label="Learner navigation" className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        {items.map((item) => {
          const active = isLearnerNavActive(pathname, item.href);
          const Icon = NAV_ICONS[item.href] ?? Sparkles;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={[
                "group flex items-center gap-3 rounded-lg border-l-4 px-3 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary/10 pl-[calc(0.75rem-4px)] font-semibold text-primary"
                  : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
              ].join(" ")}
            >
              <Icon className="h-[18px] w-[18px] shrink-0" strokeWidth={2} aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-2 px-3 pb-1 pt-3">
        <div className="rounded-xl bg-primary p-4 text-center text-primary-foreground">
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-80">Keep it up</p>
          <p className="mt-1 text-sm font-bold leading-snug">
            A little practice every day builds mastery.
          </p>
          <Link
            href="/practice"
            prefetch={false}
            onClick={onNavigate}
            className="mt-3 block rounded-full bg-primary-foreground py-1.5 text-xs font-bold text-primary transition-opacity hover:opacity-90"
          >
            Start practice
          </Link>
        </div>

        <div className="border-t border-border pt-2">
          <Link
            href="/settings"
            prefetch={false}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Settings className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            Settings
          </Link>
          <Link
            href="/help"
            prefetch={false}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <LifeBuoy className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            Help Center
          </Link>
          <button
            type="button"
            disabled={signingOut}
            onClick={onSignOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-[var(--destructive)] transition-colors hover:bg-[color-mix(in_srgb,var(--destructive)_12%,transparent)] disabled:opacity-50"
          >
            <LogOut className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LearnerShellClient({
  branding,
  requestId,
  member,
  navigationItems,
  unreadNotificationCount,
  children,
}: LearnerShellClientProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

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

  const initials = (member.displayName?.trim() || "You").slice(0, 1).toUpperCase();

  return (
    <div className="learner-shell flex min-h-screen bg-background text-foreground">
      <DeviceSessionCapture />
      <ShellSkipLink />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-border bg-card py-5 lg:flex">
        <Sidebar
          branding={branding}
          navigationItems={navigationItems}
          pathname={pathname}
          onSignOut={() => {
            setConfirmSignOut(true);
          }}
          signingOut={signingOut}
        />
      </aside>

      {/* Mobile drawer */}
      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => {
              setDrawerOpen(false);
            }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          />
          <aside className="absolute inset-y-0 left-0 flex w-64 max-w-[85vw] flex-col border-r border-border bg-card py-5 shadow-2xl motion-safe:animate-[admin-slide-up_0.25s_cubic-bezier(0.16,1,0.3,1)]">
            <div className="flex justify-end px-4">
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => {
                  setDrawerOpen(false);
                }}
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <Sidebar
              branding={branding}
              navigationItems={navigationItems}
              pathname={pathname}
              onNavigate={() => {
                setDrawerOpen(false);
              }}
              onSignOut={() => void handleSignOut()}
              signingOut={signingOut}
            />
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col pb-[calc(4rem+env(safe-area-inset-bottom))] lg:ml-64 lg:pb-0">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background/90 px-4 backdrop-blur md:px-8">
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => {
              setDrawerOpen(true);
            }}
            className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          <Link
            href="/search"
            prefetch={false}
            className="group flex flex-1 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground transition-colors hover:border-[var(--ring)] sm:max-w-md"
          >
            <Search className="h-4 w-4" aria-hidden="true" />
            <span>Search courses, lessons, and more</span>
          </Link>

          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            <LearnerNotificationPopover initialUnreadCount={unreadNotificationCount} />
            <ThemeModeToggle className="inline-flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
            <Link
              href="/profile"
              prefetch={false}
              className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3 transition-colors hover:bg-muted"
            >
              {member.avatarUrl ? (
                <img src={member.avatarUrl} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
                >
                  {initials}
                </span>
              )}
              <span className="hidden max-w-[8rem] truncate text-sm font-semibold sm:inline">
                {member.displayName?.trim() || "Account"}
              </span>
            </Link>
          </div>
        </header>

        <main id="main-content" className="flex-1 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>

      <ShellBottomNav
        items={navigationItems}
        ariaLabel="Mobile learner navigation"
        pathname={pathname}
        isActive={isLearnerNavActive}
        mobileLimit={4}
      />

      {confirmSignOut ? (
        <LearnerConfirmDialog
          open={confirmSignOut}
          title="Sign out?"
          description="You will be returned to the sign-in screen and need to sign in again to continue learning."
          confirmLabel="Sign out"
          busyLabel="Signing out…"
          cancelLabel="Stay signed in"
          icon={LogOut}
          tone="danger"
          busy={signingOut}
          onConfirm={() => void handleSignOut()}
          onCancel={() => {
            if (!signingOut) setConfirmSignOut(false);
          }}
        />
      ) : null}

      <span className="sr-only">Request ID: {requestId}</span>
      <MarketingCtaRuntime isAuthenticated />
    </div>
  );
}
