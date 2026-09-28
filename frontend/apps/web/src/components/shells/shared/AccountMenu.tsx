"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@atlas/design-system/lib/cn";
import { dropdownPanelEnterEndClassName } from "@atlas/design-system/lib/dropdown-motion";

export type AccountMenuItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

type AccountMenuProps = {
  trigger: ReactNode;
  triggerLabel: string;
  triggerClassName: string;
  panelClassName: string;
  itemClassName: string;
  items: AccountMenuItem[];
  onSignOut?: () => void;
  signOutLabel?: string;
  signOutIcon?: LucideIcon;
  signOutItemClassName?: string;
};

/**
 * Shell-agnostic account dropdown: caller supplies the trigger markup, panel/item
 * classes (so admin and learner shells can each apply their own token system),
 * and the menu items. Handles open state, outside-click, and Escape only.
 */
export function AccountMenu({
  trigger,
  triggerLabel,
  triggerClassName,
  panelClassName,
  itemClassName,
  items,
  onSignOut,
  signOutLabel = "Sign out",
  signOutIcon: SignOutIcon,
  signOutItemClassName,
}: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={rootRef}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={triggerLabel}
        className={triggerClassName}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        {trigger}
      </button>
      {open ? (
        <div
          role="menu"
          aria-label={triggerLabel}
          className={cn(dropdownPanelEnterEndClassName, panelClassName)}
        >
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={itemClassName}
                onClick={() => {
                  setOpen(false);
                }}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
          {onSignOut ? (
            <button
              type="button"
              role="menuitem"
              className={signOutItemClassName ?? itemClassName}
              onClick={() => {
                setOpen(false);
                onSignOut();
              }}
            >
              {SignOutIcon ? (
                <SignOutIcon className="h-4 w-4 shrink-0" aria-hidden="true" strokeWidth={2} />
              ) : null}
              {signOutLabel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
