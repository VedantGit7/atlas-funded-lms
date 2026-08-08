"use client";

import Link from "next/link";
import { bottomNavGridClass, mobilePrimaryItems, type ShellNavItem } from "./shell-utils";
import { ShellNavBadge } from "./ShellNavBadge";

type ShellBottomNavProps = {
  items: readonly ShellNavItem[];
  ariaLabel: string;
  pathname: string;
  isActive: (pathname: string, href: string) => boolean;
  badgeForItem?: (href: string) => number | null;
  mobileLimit?: number;
};

export function ShellBottomNav({
  items,
  ariaLabel,
  pathname,
  isActive,
  badgeForItem,
  mobileLimit = 4,
}: ShellBottomNavProps) {
  if (items.length === 0) {
    return null;
  }

  const tabItems = mobilePrimaryItems(items, mobileLimit);

  return (
    <nav
      aria-label={ariaLabel}
      className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-background pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <ul className={`grid ${bottomNavGridClass(tabItems.length)} gap-1 px-2 py-2 text-xs`}>
        {tabItems.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 flex-col items-center justify-center rounded px-1 py-2 ${
                  active ? "font-semibold text-foreground" : "text-muted-foreground"
                }`}
              >
                <span>{item.label}</span>
                {badgeForItem ? <ShellNavBadge count={badgeForItem(item.href)} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
