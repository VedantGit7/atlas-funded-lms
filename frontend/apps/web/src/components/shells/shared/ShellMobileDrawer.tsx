"use client";

import Link from "next/link";
import type { ShellNavItem } from "./shell-utils";
import { ShellNavBadge } from "./ShellNavBadge";

type ShellMobileDrawerProps = {
  id: string;
  open: boolean;
  onClose: () => void;
  items: readonly ShellNavItem[];
  ariaLabel: string;
  pathname: string;
  isActive: (pathname: string, href: string) => boolean;
  badgeForItem?: (href: string) => number | null;
};

export function ShellMobileDrawer({
  id,
  open,
  onClose,
  items,
  ariaLabel,
  pathname,
  isActive,
  badgeForItem,
}: ShellMobileDrawerProps) {
  if (!open || items.length === 0) {
    return null;
  }

  return (
    <nav
      id={id}
      aria-label={ariaLabel}
      className="fixed inset-x-0 top-[57px] z-20 max-h-[70vh] overflow-y-auto border-b border-border bg-background p-4 shadow-lg md:hidden"
    >
      <ul className="space-y-1 text-sm">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center rounded px-3 py-2 ${
                  active ? "font-semibold underline" : "text-muted-foreground"
                }`}
                onClick={onClose}
              >
                {item.label}
                {badgeForItem ? <ShellNavBadge count={badgeForItem(item.href)} /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
