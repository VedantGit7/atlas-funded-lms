"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import { TenantLogo } from "@atlas/design-system";
import type { PublicTenantBranding } from "@atlas/tenant-branding";
import { ThemeModeToggle } from "../ThemeModeToggle";
import { ShellNavBadge } from "./shared/ShellNavBadge";
import { ShellSkipLink } from "./shared/ShellSkipLink";
import { createNavIsActive } from "./shared/shell-utils";

type ReviewShellClientProps = {
  branding: PublicTenantBranding;
  pendingReviewCount: number | null;
  requestId: string;
  children: ReactNode;
};

const REVIEW_NAV = [
  { href: "/review", label: "Review & Approvals" },
  { href: "/studio/courses", label: "Studio" },
  { href: "/admin", label: "Admin" },
] as const;

const navIsActive = createNavIsActive("/review");

export function ReviewShellClient({
  branding,
  pendingReviewCount,
  requestId,
  children,
}: ReviewShellClientProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="review-shell min-h-screen bg-background text-foreground">
      <ShellSkipLink />
      <header className="border-b border-border bg-background">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <Link href="/review" className="text-brand-primary">
            <TenantLogo
              publicName={branding.publicName ? `${branding.publicName} Review` : "Review"}
              logoLightUrl={branding.logoLightUrl}
              logoDarkUrl={branding.logoDarkUrl}
            />
          </Link>
          <div className="flex items-center gap-3">
            <nav
              aria-label="Review navigation"
              className="hidden items-center gap-4 text-sm md:flex"
            >
              {REVIEW_NAV.map((item) => {
                const active = navIsActive(pathname, item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center ${active ? "font-medium underline" : "text-muted-foreground"}`}
                  >
                    {item.label}
                    {item.href === "/review" ? <ShellNavBadge count={pendingReviewCount} /> : null}
                  </Link>
                );
              })}
            </nav>
            <ThemeModeToggle className="inline-flex h-10 w-10 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
            <button
              type="button"
              className="min-h-10 rounded border border-border px-3 py-1.5 text-sm md:hidden"
              aria-expanded={mobileOpen}
              aria-controls="review-mobile-nav"
              onClick={() => {
                setMobileOpen((value) => !value);
              }}
            >
              Menu
            </button>
          </div>
        </div>
        {mobileOpen ? (
          <nav
            id="review-mobile-nav"
            aria-label="Review mobile navigation"
            className="border-t border-border px-4 py-3 md:hidden"
          >
            <ul className="space-y-1 text-sm">
              {REVIEW_NAV.map((item) => {
                const active = navIsActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex min-h-11 items-center rounded px-2 py-2 ${
                        active ? "font-semibold underline" : "text-muted-foreground"
                      }`}
                      onClick={() => {
                        setMobileOpen(false);
                      }}
                    >
                      {item.label}
                      {item.href === "/review" ? (
                        <ShellNavBadge count={pendingReviewCount} />
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        ) : null}
      </header>
      <main id="main-content" className="mx-auto max-w-7xl px-4 py-6">
        {children}
      </main>
      <span className="sr-only">Request ID: {requestId}</span>
    </div>
  );
}
