"use client";

import { useState, type ReactNode } from "react";
import { ThemeModeToggle } from "../../ThemeModeToggle";
import { ShellBottomNav } from "./ShellBottomNav";
import { ShellMobileDrawer } from "./ShellMobileDrawer";
import { ShellSidebarNav } from "./ShellSidebarNav";
import { ShellSkipLink } from "./ShellSkipLink";
import type { ShellNavItem } from "./shell-utils";

type OperationalShellLayoutProps = {
  shellClassName: string;
  drawerId: string;
  sidebarAriaLabel: string;
  mobileDrawerAriaLabel: string;
  bottomNavAriaLabel: string;
  headerLogo: ReactNode;
  headerActions?: ReactNode;
  banner?: ReactNode;
  navigationItems: readonly ShellNavItem[];
  pathname: string;
  isActive: (pathname: string, href: string) => boolean;
  accentColor: string;
  badgeForItem?: (href: string) => number | null;
  requestId: string;
  children: ReactNode;
  bottomNavLimit?: number;
  surfaceClassName?: string;
  headerClassName?: string;
};

export function OperationalShellLayout({
  shellClassName,
  drawerId,
  sidebarAriaLabel,
  mobileDrawerAriaLabel,
  bottomNavAriaLabel,
  headerLogo,
  headerActions,
  banner,
  navigationItems,
  pathname,
  isActive,
  accentColor,
  badgeForItem,
  requestId,
  children,
  bottomNavLimit,
  surfaceClassName = "bg-muted",
  headerClassName = "border-b border-border bg-background",
}: OperationalShellLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasNav = navigationItems.length > 0;

  return (
    <div
      className={`${shellClassName} min-h-screen ${surfaceClassName} pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0`}
    >
      <ShellSkipLink />
      <header className={headerClassName}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
          <div className="min-w-0 flex-1">{headerLogo}</div>
          <div className="flex shrink-0 items-center gap-3">
            {hasNav ? (
              <button
                type="button"
                className="min-h-10 rounded border border-border px-3 py-1.5 text-sm md:hidden"
                aria-expanded={mobileOpen}
                aria-controls={drawerId}
                onClick={() => {
                  setMobileOpen((value) => !value);
                }}
              >
                Menu
              </button>
            ) : null}
            {headerActions}
            <ThemeModeToggle className="inline-flex h-9 w-9 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground" />
          </div>
        </div>
      </header>

      {banner}

      <div className="mx-auto flex max-w-7xl gap-0 md:gap-6 md:px-4 md:py-6">
        <ShellSidebarNav
          items={navigationItems}
          ariaLabel={sidebarAriaLabel}
          pathname={pathname}
          isActive={isActive}
          accentColor={accentColor}
          {...(badgeForItem ? { badgeForItem } : {})}
        />
        <main id="main-content" className="min-w-0 flex-1 px-4 py-6 md:px-0 md:py-0">
          {children}
        </main>
      </div>

      <ShellMobileDrawer
        id={drawerId}
        open={mobileOpen}
        onClose={() => {
          setMobileOpen(false);
        }}
        items={navigationItems}
        ariaLabel={mobileDrawerAriaLabel}
        pathname={pathname}
        isActive={isActive}
        {...(badgeForItem ? { badgeForItem } : {})}
      />

      <ShellBottomNav
        items={navigationItems}
        ariaLabel={bottomNavAriaLabel}
        pathname={pathname}
        isActive={isActive}
        {...(badgeForItem ? { badgeForItem } : {})}
        {...(bottomNavLimit !== undefined ? { mobileLimit: bottomNavLimit } : {})}
      />

      <span className="sr-only">Request ID: {requestId}</span>
    </div>
  );
}
