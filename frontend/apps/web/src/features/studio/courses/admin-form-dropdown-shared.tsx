"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { dropdownPanelEnterClassName } from "@atlas/design-system";

export const dropdownTriggerClassName =
  "flex w-full items-center gap-2 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-left text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:border-[var(--admin-outline)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

export const dropdownPanelSurfaceClassName =
  `overflow-hidden rounded-xl border border-[var(--admin-border)] ${dropdownPanelEnterClassName}`;

/** @deprecated Prefer DropdownField portaled panel; kept for non-portaled menus. */
export const dropdownPanelClassName = `absolute left-0 right-0 top-[calc(100%+6px)] z-20 bg-[var(--admin-surface)] shadow-lg ${dropdownPanelSurfaceClassName}`;

export const inlineExpandClassName = dropdownPanelEnterClassName;

export const dropdownFooterClassName =
  "flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5";

export const dropdownFooterButtonClassName =
  "rounded-md px-2 py-1 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40";

export const dropdownItemClassName =
  "admin-dropdown-item flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-on-surface)] transition-colors duration-150 hover:bg-[var(--admin-surface-high)] focus-visible:bg-[var(--admin-surface-high)] focus-visible:outline-none";

export function slugifyCategoryLabel(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function memberInitials(displayName: string | null, email: string | null): string {
  const trimmed = displayName?.trim();
  if (trimmed) {
    const parts = trimmed.split(/\s+/).slice(0, 2);
    return parts.map((part) => part.charAt(0).toUpperCase()).join("") || "M";
  }
  const local = email?.split("@")[0]?.trim();
  return local ? local.slice(0, 2).toUpperCase() : "M";
}

type PanelPosition = {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
  maxHeight: number;
};

type DropdownFieldProps = {
  label: ReactNode;
  labelId: string;
  open: boolean;
  disabled?: boolean;
  onToggle: () => void;
  triggerContent: ReactNode;
  leftIcon?: ReactNode;
  panelRole?: string;
  panelAriaLabel?: string;
  portalZIndex?: number;
  children: ReactNode;
};

function computePanelPosition(trigger: HTMLElement, portalZIndex: number): {
  style: CSSProperties;
  position: PanelPosition;
} {
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

  const position: PanelPosition = {
    left: rect.left,
    width: rect.width,
    maxHeight,
    ...(openUpward
      ? { bottom: window.innerHeight - rect.top + gap }
      : { top: rect.bottom + gap }),
  };

  const style: CSSProperties = {
    position: "fixed",
    left: position.left,
    width: position.width,
    maxHeight: position.maxHeight,
    zIndex: portalZIndex,
    ...(position.top != null ? { top: position.top } : {}),
    ...(position.bottom != null ? { bottom: position.bottom } : {}),
  };

  return { style, position };
}

export function DropdownField({
  label,
  labelId,
  open,
  disabled = false,
  onToggle,
  triggerContent,
  leftIcon,
  panelRole = "listbox",
  panelAriaLabel,
  portalZIndex = 100,
  children,
}: DropdownFieldProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const updatePanelPosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    setPanelStyle(computePanelPosition(trigger, portalZIndex).style);
  }, [portalZIndex]);

  useEffect(() => {
    if (!open) return;

    updatePanelPosition();

    window.addEventListener("resize", updatePanelPosition);
    window.addEventListener("scroll", updatePanelPosition, true);

    return () => {
      window.removeEventListener("resize", updatePanelPosition);
      window.removeEventListener("scroll", updatePanelPosition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (rootRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      onToggle();
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open, onToggle]);

  const portaledPanel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            role={panelRole}
            aria-label={panelAriaLabel}
            style={panelStyle}
            className={`admin-theme admin-dropdown-panel ${dropdownPanelSurfaceClassName} flex flex-col`}
          >
            {children}
          </div>,
          document.body,
        )
      : null;

  return (
    <div ref={rootRef} className="relative">
      <div className="mb-2">{label}</div>
      <button
        ref={triggerRef}
        type="button"
        id={labelId}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={onToggle}
        className={dropdownTriggerClassName}
      >
        {leftIcon ? (
          <span className="shrink-0 text-[var(--admin-on-surface-variant)]">{leftIcon}</span>
        ) : null}
        <span className="min-w-0 flex-1 truncate">{triggerContent}</span>
        <ChevronDown
          className={[
            "h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200",
            open ? "rotate-180" : "rotate-0",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>
      {portaledPanel}
    </div>
  );
}

type RoleToggleProps = {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
};

export function RoleToggle({ label, checked, disabled = false, onChange }: RoleToggleProps) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-1 py-1",
        disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
      onClick={(event) => {
        event.preventDefault();
        if (!disabled) onChange(!checked);
      }}
    >
      <span className="text-sm font-medium text-[var(--admin-on-surface)]">{label}</span>
      <span
        role="switch"
        aria-checked={checked}
        className={[
          "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200",
          checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-surface-high)]",
        ].join(" ")}
      >
        <span
          className={[
            "inline-block h-5 w-5 rounded-full bg-[var(--admin-surface)] shadow-sm transition-transform duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </span>
    </label>
  );
}
