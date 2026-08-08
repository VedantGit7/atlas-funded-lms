"use client";

import Link from "next/link";
import type { ShellNavItem } from "./shell-utils";
import { ShellNavBadge } from "./ShellNavBadge";

type ShellSidebarNavProps = {
  items: readonly ShellNavItem[];
  ariaLabel: string;
  pathname: string;
  isActive: (pathname: string, href: string) => boolean;
  accentColor: string;
  badgeForItem?: (href: string) => number | null;
};

export function ShellSidebarNav({
  items,
  ariaLabel,
  pathname,
  isActive,
  accentColor,
  badgeForItem,
}: ShellSidebarNavProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <aside className="hidden w-56 shrink-0 md:block" aria-label={ariaLabel}>
      <nav className="sticky top-4 max-h-[calc(100vh-2rem)] space-y-1 overflow-y-auto rounded-lg border border-border bg-card p-3 text-sm">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={`flex min-h-10 items-center rounded px-3 py-2 ${
                active
                  ? "font-medium text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              style={active ? { backgroundColor: accentColor } : undefined}
            >
              {item.label}
              {badgeForItem ? <ShellNavBadge count={badgeForItem(item.href)} /> : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
