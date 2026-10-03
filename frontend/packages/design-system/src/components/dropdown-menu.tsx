"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { cn } from "../lib/cn";
import {
  dropdownPanelEnterClassName,
  dropdownPanelEnterEndClassName,
} from "../lib/dropdown-motion";

export type DropdownMenuItem = {
  key: string;
  label: ReactNode;
  onSelect: () => void;
  icon?: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
};

export type DropdownMenuProps = {
  /** Accessible label for the trigger button. */
  label: string;
  /** Visual content rendered inside the trigger (e.g. an icon). */
  trigger: ReactNode;
  items: DropdownMenuItem[];
  align?: "start" | "end";
  triggerClassName?: string;
  contentClassName?: string;
  itemClassName?: string;
};

type MenuPosition = { top: number; left: number; minWidth: number };

/**
 * The menu surface renders in a portal with fixed positioning so it escapes
 * overflow/scroll containers (e.g. virtualized tables) instead of being clipped.
 */
export function DropdownMenu({
  label,
  trigger,
  items,
  align = "end",
  triggerClassName,
  contentClassName,
  itemClassName,
}: DropdownMenuProps) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const minWidth = 176;
    const estimatedHeight = Math.min(280, Math.max(120, items.length * 40 + 16));
    const gap = 4;
    const spaceBelow = window.innerHeight - rect.bottom - 8;
    const spaceAbove = rect.top - 8;
    const openUpward = spaceBelow < estimatedHeight && spaceAbove > spaceBelow;
    const left = align === "end" ? rect.right - minWidth : rect.left;
    setPosition({
      top: openUpward ? Math.max(8, rect.top - estimatedHeight - gap) : rect.bottom + gap,
      left: Math.max(8, Math.min(left, window.innerWidth - minWidth - 8)),
      minWidth,
    });
  }, [align, items.length]);

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (!triggerRef.current?.contains(target) && !menuRef.current?.contains(target)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    function onScroll(event: Event) {
      const target = event.target;
      if (target instanceof Node && menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    }

    function onResize() {
      setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        onClick={() => {
          setOpen((value) => !value);
        }}
        className={cn(
          "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary,#6366f1)]/40 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100",
          triggerClassName,
        )}
      >
        {trigger}
      </button>

      {mounted && open && position
        ? createPortal(
            <div
              ref={menuRef}
              role="menu"
              aria-label={label}
              style={{ top: position.top, left: position.left, minWidth: position.minWidth }}
              className={cn(
                "fixed z-[80] overflow-hidden rounded-lg border border-border bg-card py-1 text-card-foreground shadow-lg",
                align === "end" ? dropdownPanelEnterEndClassName : dropdownPanelEnterClassName,
                contentClassName,
              )}
            >
              {items.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={() => {
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-40",
                    item.destructive
                      ? "text-destructive hover:bg-destructive/10"
                      : "text-foreground hover:bg-muted",
                    itemClassName,
                  )}
                >
                  {item.icon ? <span className="shrink-0">{item.icon}</span> : null}
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                </button>
              ))}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
