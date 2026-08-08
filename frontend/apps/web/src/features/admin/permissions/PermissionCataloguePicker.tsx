"use client";

import { useId, useMemo, useState, type ReactNode } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
  buildTenantPermissionGroups,
  checkboxClassName,
  formatGroupLabel,
  groupIcon,
} from "../roles/role-editor-shared";

export const collapseEase = "cubic-bezier(0.4, 0, 0.2, 1)";

export function AnimatedCollapsible({
  open,
  id,
  children,
  className = "",
  noTopMargin = false,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
  className?: string;
  noTopMargin?: boolean;
}) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      style={{ transitionTimingFunction: collapseEase }}
      className={[
        "grid motion-safe:transition-[grid-template-rows,margin-top,opacity] motion-safe:duration-300",
        open
          ? noTopMargin
            ? "mt-0 grid-rows-[1fr] opacity-100"
            : "mt-3 grid-rows-[1fr] opacity-100"
          : "mt-0 grid-rows-[0fr] opacity-0",
        className,
      ].join(" ")}
    >
      <div className={["min-h-0 overflow-hidden", open ? "" : "pointer-events-none"].join(" ")}>
        <div
          style={{ transitionTimingFunction: collapseEase }}
          className={[
            "motion-safe:transition-[transform,opacity] motion-safe:duration-300",
            open ? "translate-y-0 opacity-100" : "-translate-y-1.5 opacity-0",
          ].join(" ")}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

type PermissionCataloguePickerProps = {
  selectedKeys: string[];
  onChange: (keys: string[]) => void;
  selectionMode?: "single" | "multiple";
  browseOpen?: boolean;
  onBrowseOpenChange?: (open: boolean) => void;
  showBrowseToggle?: boolean;
};

export function PermissionCataloguePicker({
  selectedKeys,
  onChange,
  selectionMode = "multiple",
  browseOpen: controlledBrowseOpen,
  onBrowseOpenChange,
  showBrowseToggle = true,
}: PermissionCataloguePickerProps) {
  const panelId = useId();
  const [internalBrowseOpen, setInternalBrowseOpen] = useState(false);
  const [search, setSearch] = useState("");

  const browseOpen = controlledBrowseOpen ?? internalBrowseOpen;

  function setBrowseOpen(next: boolean) {
    if (!next) setSearch("");
    if (onBrowseOpenChange) {
      onBrowseOpenChange(next);
    } else {
      setInternalBrowseOpen(next);
    }
  }

  const groupedPermissions = useMemo(() => buildTenantPermissionGroups(), []);
  const normalizedSearch = search.trim().toLowerCase();

  const filteredGroups = useMemo(() => {
    if (!normalizedSearch) return groupedPermissions;

    return groupedPermissions
      .map(([group, permissions]) => {
        const matches = permissions.filter(
          (permission) =>
            permission.key.toLowerCase().includes(normalizedSearch) ||
            permission.description.toLowerCase().includes(normalizedSearch),
        );
        return matches.length > 0 ? ([group, matches] as const) : null;
      })
      .filter((entry): entry is [string, (typeof groupedPermissions)[number][1]] => entry !== null);
  }, [groupedPermissions, normalizedSearch]);

  function handleSelect(key: string) {
    if (selectionMode === "single") {
      onChange(selectedKeys.includes(key) ? [] : [key]);
      return;
    }

    onChange(
      selectedKeys.includes(key)
        ? selectedKeys.filter((entry) => entry !== key)
        : [...selectedKeys, key],
    );
  }

  return (
    <div>
      {showBrowseToggle ? (
        <button
          type="button"
          onClick={() => {
            setBrowseOpen(!browseOpen);
          }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
          aria-expanded={browseOpen}
          aria-controls={panelId}
        >
          Browse available permissions
          <ChevronDown
            style={{ transitionTimingFunction: collapseEase }}
            className={[
              "h-4 w-4 motion-safe:transition-transform motion-safe:duration-300",
              browseOpen ? "rotate-180" : "rotate-0",
            ].join(" ")}
            aria-hidden="true"
          />
        </button>
      ) : null}

      <AnimatedCollapsible open={browseOpen} id={panelId}>
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/60 px-4 py-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                placeholder="Search permission keys or descriptions…"
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              />
            </div>
          </div>
          <div className="max-h-64 space-y-4 overflow-y-auto p-4">
            {filteredGroups.length === 0 ? (
              <p className="py-6 text-center text-sm text-[var(--admin-on-surface-variant)]">
                No permissions match your search.
              </p>
            ) : (
              filteredGroups.map(([group, permissions]) => {
                const Icon = groupIcon(group);
                return (
                  <div key={group}>
                    <div className="mb-2 flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                      <p className="text-xs font-bold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        {formatGroupLabel(group)}
                      </p>
                    </div>
                    <div className="space-y-1">
                      {permissions.map((permission) => {
                        const isSelected = selectedKeys.includes(permission.key);
                        const inputType = selectionMode === "single" ? "radio" : "checkbox";

                        return (
                          <label
                            key={permission.key}
                            className={[
                              "flex cursor-pointer items-start gap-3 rounded-lg px-2 py-2 transition-colors",
                              isSelected
                                ? "bg-[var(--admin-primary-container)]/30"
                                : "hover:bg-[var(--admin-surface-low)]",
                            ].join(" ")}
                          >
                            <input
                              type={inputType}
                              name={selectionMode === "single" ? "permission-picker" : undefined}
                              checked={isSelected}
                              className={
                                selectionMode === "single"
                                  ? "mt-0.5 h-4 w-4 shrink-0 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                                  : checkboxClassName
                              }
                              onChange={() => {
                                handleSelect(permission.key);
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <code className="font-mono text-xs text-[var(--admin-primary-strong)]">
                                {permission.key}
                              </code>
                              <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                                {permission.description}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </AnimatedCollapsible>
    </div>
  );
}
