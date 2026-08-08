"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { dropdownPanelEnterClassName } from "@atlas/design-system";

export const accountDropdownTriggerClassName =
  "flex w-full items-center gap-2 rounded-lg border border-[var(--acct-border)] bg-[var(--acct-surface)] px-3 py-2 text-left text-sm text-[var(--acct-on-surface)] outline-none transition-all duration-200 hover:border-[var(--acct-outline)] focus:border-[var(--acct-primary-container)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--acct-primary-container)_20%,transparent)] disabled:cursor-not-allowed disabled:opacity-50";

export const accountDropdownPanelSurfaceClassName =
  `account-settings-theme account-dropdown-panel overflow-hidden rounded-lg border border-[var(--acct-border)] ${dropdownPanelEnterClassName}`;

export const accountDropdownItemClassName =
  "account-dropdown-item flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors duration-150";

type AccountDropdownFieldProps = {
  label: ReactNode;
  labelId: string;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  triggerContent: ReactNode;
  panelAriaLabel?: string;
  portalZIndex?: number;
  children: ReactNode;
};

function computePanelPosition(trigger: HTMLElement, portalZIndex: number): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  const viewportPadding = 12;
  const gap = 8;
  const maxPanelHeight = 320;
  const minVisibleHeight = 180;

  const spaceBelow = window.innerHeight - rect.bottom - gap - viewportPadding;
  const spaceAbove = rect.top - gap - viewportPadding;
  const openUpward = spaceBelow < minVisibleHeight && spaceAbove > spaceBelow;

  const maxHeight = Math.min(
    maxPanelHeight,
    openUpward ? Math.max(spaceAbove, minVisibleHeight) : Math.max(spaceBelow, minVisibleHeight),
  );

  return {
    position: "fixed",
    left: rect.left,
    width: rect.width,
    maxHeight,
    zIndex: portalZIndex,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + gap }
      : { top: rect.bottom + gap }),
  };
}

export function AccountDropdownField({
  label,
  labelId,
  open,
  disabled = false,
  onToggle,
  triggerContent,
  panelAriaLabel,
  portalZIndex = 100,
  children,
}: AccountDropdownFieldProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePosition = useCallback(() => {
    if (!triggerRef.current || !open) return;
    setPanelStyle(computePanelPosition(triggerRef.current, portalZIndex));
  }, [open, portalZIndex]);

  useEffect(() => {
    updatePosition();
    if (!open) return;

    const onScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      onToggle();
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onToggle();
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onToggle]);

  return (
    <div className="relative">
      <span id={labelId} className="sr-only">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        aria-labelledby={labelId}
        aria-expanded={open}
        aria-haspopup="listbox"
        disabled={disabled}
        onClick={onToggle}
        className={accountDropdownTriggerClassName}
      >
        <span className="min-w-0 flex-1 truncate text-left">{triggerContent}</span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-[var(--acct-on-surface-variant)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {mounted && open && panelStyle
        ? createPortal(
            <div
              ref={panelRef}
              role="listbox"
              aria-label={panelAriaLabel}
              className={accountDropdownPanelSurfaceClassName}
              style={panelStyle}
            >
              <div className="max-h-[inherit] overflow-y-auto p-1">{children}</div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
