"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import type { ModerationNavItem } from "../../features/moderation/moderation-navigation";
import type { PublicTenantBranding } from "../../lib/server/public-tenant-branding";

type ModerationShellClientProps = {
  branding: PublicTenantBranding;
  requestId: string;
  member: {
    membershipId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  navigationItems: ModerationNavItem[];
  pendingReviewCount: number | null;
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

function navIsActive(pathname: string, href: string): boolean {
  if (href === "/moderate/cases") {
    return pathname === href || pathname.startsWith("/moderate/cases/");
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavBadge({ count }: { count: number | null }) {
  if (count == null || count <= 0) {
    return null;
  }
  return (
    <span className="ml-1 rounded-full bg-neutral-900 px-1.5 py-0.5 text-xs text-white">
      {count}
    </span>
  );
}

export function ModerationShellClient({
  branding,
  requestId,
  member,
  navigationItems,
  pendingReviewCount,
  children,
}: ModerationShellClientProps) {
  const pathname = usePathname();
  const primary = themeColor(branding.themeTokens, "primary", "#1a365d");
  const accent = themeColor(branding.themeTokens, "accent", "#2c5282");
  const [mobileOpen, setMobileOpen] = useState(false);

  const mobileItems = useMemo(
    () => navigationItems.filter((item) => item.mobilePrimary),
    [navigationItems],
  );

  function badgeForItem(href: string): number | null {
    if (href === "/review") return pendingReviewCount;
    return null;
  }

  return (
    <div
      className="moderation-shell min-h-screen bg-neutral-50 pb-16 md:pb-0"
      style={{ color: themeColor(branding.themeTokens, "foreground", "#101010") }}
    >
      <header className="border-b bg-white px-4 py-3">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Link
              href="/moderate/cases"
              className="truncate font-semibold"
              style={{ color: primary }}
            >
              {branding.publicName ? `${branding.publicName} Moderation` : "Moderation"}
            </Link>
          </div>
          <div className="flex items-center gap-3">
            {navigationItems.length > 0 ? (
              <button
                type="button"
                className="rounded border px-2 py-1 text-sm md:hidden"
                aria-expanded={mobileOpen}
                aria-controls="moderation-mobile-nav"
                onClick={() => {
                  setMobileOpen((value) => !value);
                }}
              >
                Menu
              </button>
            ) : null}
            <span className="hidden text-sm opacity-80 md:inline">
              {member.displayName?.trim() || "Moderator"}
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl gap-0 md:gap-6 md:px-4 md:py-6">
        {navigationItems.length > 0 ? (
          <aside className="hidden w-56 shrink-0 md:block" aria-label="Moderation sidebar">
            <nav className="sticky top-4 space-y-1 rounded-lg border bg-white p-3 text-sm">
              {navigationItems.map((item) => {
                const active = navIsActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center rounded px-3 py-2 ${
                      active
                        ? "font-medium text-white"
                        : "opacity-80 hover:bg-neutral-50 hover:opacity-100"
                    }`}
                    style={active ? { backgroundColor: accent } : undefined}
                  >
                    {item.label}
                    <NavBadge count={badgeForItem(item.href)} />
                  </Link>
                );
              })}
            </nav>
          </aside>
        ) : null}

        <div className="min-w-0 flex-1 px-4 py-6 md:px-0 md:py-0">{children}</div>
      </div>

      {mobileOpen && navigationItems.length > 0 ? (
        <nav
          id="moderation-mobile-nav"
          aria-label="Moderation mobile navigation"
          className="fixed inset-x-0 top-[57px] z-20 border-b bg-white p-4 shadow-lg md:hidden"
        >
          <ul className="space-y-1 text-sm">
            {navigationItems.map((item) => {
              const active = navIsActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center rounded px-3 py-2 ${
                      active ? "font-semibold underline" : "opacity-80"
                    }`}
                    onClick={() => {
                      setMobileOpen(false);
                    }}
                  >
                    {item.label}
                    <NavBadge count={badgeForItem(item.href)} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      {navigationItems.length > 0 ? (
        <nav
          aria-label="Mobile moderation navigation"
          className="fixed inset-x-0 bottom-0 z-10 border-t bg-white md:hidden"
        >
          <ul
            className={`grid gap-1 px-2 py-2 text-xs ${
              (mobileItems.length > 0 ? mobileItems : navigationItems.slice(0, 4)).length === 3
                ? "grid-cols-3"
                : "grid-cols-4"
            }`}
          >
            {(mobileItems.length > 0 ? mobileItems : navigationItems.slice(0, 4)).map((item) => {
              const active = navIsActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex flex-col items-center rounded px-1 py-2 ${
                      active ? "font-semibold" : "opacity-80"
                    }`}
                  >
                    {item.label}
                    <NavBadge count={badgeForItem(item.href)} />
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}

      <span className="sr-only">Request ID: {requestId}</span>
    </div>
  );
}
