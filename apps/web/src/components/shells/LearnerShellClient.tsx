"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { PublicTenantBranding } from "../../lib/server/public-tenant-branding";
import type { LearnerNavItem } from "../../features/learner/learner-navigation";

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

function themeColor(tokens: unknown, key: string, fallback: string): string {
  if (tokens && typeof tokens === "object" && key in tokens) {
    const value = (tokens as Record<string, unknown>)[key];
    if (typeof value === "string") {
      return value;
    }
  }
  return fallback;
}

function ProfileMenu({
  displayName,
  avatarUrl,
}: {
  displayName: string | null;
  avatarUrl: string | null;
}) {
  const [open, setOpen] = useState(false);
  const label = displayName?.trim() || "Account";

  return (
    <div className="relative">
      <button
        type="button"
        className="flex items-center gap-2 rounded border px-2 py-1 text-sm"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Profile menu"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
        ) : (
          <span
            aria-hidden="true"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-xs"
          >
            {label.slice(0, 1).toUpperCase()}
          </span>
        )}
        <span>{label}</span>
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 min-w-[10rem] rounded border bg-white py-1 shadow-lg"
        >
          <Link
            href="/profile"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Profile
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            className="block px-3 py-2 text-sm hover:bg-neutral-50"
          >
            Settings
          </Link>
        </div>
      ) : null}
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
  const primary = themeColor(branding.themeTokens, "primary", "#224466");
  const mobileItems = useMemo(
    () => navigationItems.filter((item) => item.mobilePrimary),
    [navigationItems],
  );

  return (
    <div
      className="learner-shell min-h-screen pb-16 md:pb-0"
      style={{ color: themeColor(branding.themeTokens, "foreground", "#101010") }}
    >
      <header className="border-b px-4 py-3">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="truncate font-semibold" style={{ color: primary }}>
              {branding.publicName ?? "Learn"}
            </Link>
            <Link
              href="/search"
              className="hidden text-sm underline-offset-2 hover:underline sm:inline"
            >
              Search
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/search"
              className="text-sm underline-offset-2 hover:underline sm:hidden"
              aria-label="Search"
            >
              Search
            </Link>
            <Link href="/notifications" className="relative text-sm" aria-label="Notifications">
              Notifications
              {unreadNotificationCount != null && unreadNotificationCount > 0 ? (
                <span className="ml-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-xs text-white">
                  {unreadNotificationCount}
                </span>
              ) : null}
            </Link>
            <ProfileMenu displayName={member.displayName} avatarUrl={member.avatarUrl} />
          </div>
        </div>
        <nav
          aria-label="Learner navigation"
          className="mx-auto mt-3 hidden max-w-6xl flex-wrap items-center gap-3 text-sm md:flex"
        >
          {navigationItems.map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={active ? "font-medium underline" : "opacity-80 hover:opacity-100"}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <div className="mx-auto max-w-6xl px-4 py-6">{children}</div>
      <nav
        aria-label="Mobile learner navigation"
        className="fixed inset-x-0 bottom-0 z-10 border-t bg-white md:hidden"
      >
        <ul className="grid grid-cols-4 gap-1 px-2 py-2 text-xs">
          {(mobileItems.length > 0 ? mobileItems : navigationItems.slice(0, 4)).map((item) => {
            const active =
              pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex flex-col items-center rounded px-1 py-2 ${active ? "font-semibold" : "opacity-80"}`}
                >
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <span className="sr-only">Request ID: {requestId}</span>
    </div>
  );
}
