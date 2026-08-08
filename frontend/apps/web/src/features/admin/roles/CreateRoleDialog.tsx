"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  buildTenantPermissionGroups,
  checkboxClassName,
  formatGroupLabel,
  groupIcon,
} from "./role-editor-shared";

const ROLE_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const fieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const monoFieldClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 pr-14 font-mono text-sm lowercase text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

const labelClassName =
  "text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

const DEFAULT_PERMISSIONS = ["profile.read", "membership.read"];

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function slugifyRoleName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/_+/g, "_")
    .slice(0, 64);
}

function parsePermissions(value: string): string[] {
  return [...new Set(value.split(",").map((entry) => entry.trim()).filter(Boolean))];
}

function permissionsToString(permissions: string[]): string {
  return permissions.join(", ");
}

const collapseEase = "cubic-bezier(0.4, 0, 0.2, 1)";

function AnimatedCollapsible({
  open,
  id,
  children,
}: {
  open: boolean;
  id: string;
  children: ReactNode;
}) {
  return (
    <div
      id={id}
      aria-hidden={!open}
      style={{ transitionTimingFunction: collapseEase }}
      className={[
        "grid motion-safe:transition-[grid-template-rows,margin-top,opacity] motion-safe:duration-300",
        open ? "mt-3 grid-rows-[1fr] opacity-100" : "mt-0 grid-rows-[0fr] opacity-0",
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

function PermissionBrowser({
  selected,
  search,
  onSearchChange,
  onToggle,
}: {
  selected: string[];
  search: string;
  onSearchChange: (value: string) => void;
  onToggle: (key: string) => void;
}) {
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

  return (
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
              onSearchChange(event.target.value);
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
                <div className="space-y-2">
                  {permissions.map((permission) => {
                    const isChecked = selected.includes(permission.key);
                    return (
                      <label
                        key={permission.key}
                        className="flex cursor-pointer items-start gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--admin-surface-low)]"
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          className={checkboxClassName}
                          onChange={() => {
                            onToggle(permission.key);
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
  );
}

export function CreateRoleDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [keyManuallyEdited, setKeyManuallyEdited] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(DEFAULT_PERMISSIONS);
  const [permissionsText, setPermissionsText] = useState(permissionsToString(DEFAULT_PERMISSIONS));
  const [permissionBrowserOpen, setPermissionBrowserOpen] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const titleId = useId();
  const permissionBrowserPanelId = useId();
  const keyRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const trimmedKey = key.trim();
  const trimmedName = name.trim();
  const keyIsValid = trimmedKey.length >= 2 && ROLE_KEY_PATTERN.test(trimmedKey);
  const keyHasError = trimmedKey.length > 0 && !keyIsValid;
  const canSubmit =
    keyIsValid && trimmedName.length > 0 && selectedPermissions.length > 0 && !busy;

  function resetForm() {
    setKey("");
    setName("");
    setKeyManuallyEdited(false);
    setSelectedPermissions(DEFAULT_PERMISSIONS);
    setPermissionsText(permissionsToString(DEFAULT_PERMISSIONS));
    setPermissionBrowserOpen(false);
    setPermissionSearch("");
    setErrorMessage(null);
  }

  function closeDialog() {
    if (busy) return;
    setOpen(false);
    resetForm();
  }

  function syncPermissions(next: string[]) {
    setSelectedPermissions(next);
    setPermissionsText(permissionsToString(next));
  }

  function togglePermission(permissionKey: string) {
    syncPermissions(
      selectedPermissions.includes(permissionKey)
        ? selectedPermissions.filter((entry) => entry !== permissionKey)
        : [...selectedPermissions, permissionKey],
    );
  }

  function removePermission(permission: string) {
    syncPermissions(selectedPermissions.filter((entry) => entry !== permission));
  }

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    keyRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        closeDialog();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [open, busy]);

  async function submitRole() {
    if (!canSubmit) return;

    setBusy(true);
    setErrorMessage(null);

    try {
      await clientApi.post(
        "/api/v1/roles",
        {
          key: trimmedKey,
          name: trimmedName,
          permissions: selectedPermissions,
        },
        "role-create",
      );
      setOpen(false);
      resetForm();
      router.refresh();
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
        }}
        className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-[15px] font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:opacity-90 active:scale-[0.98]"
      >
        <Plus className="h-[18px] w-[18px]" strokeWidth={2.5} aria-hidden="true" />
        Create role
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm"
            onClick={closeDialog}
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative flex max-h-[min(92vh,820px)] w-full max-w-[540px] flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
              <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
                Create custom role
              </h2>
              <button
                type="button"
                aria-label="Close"
                disabled={busy}
                onClick={closeDialog}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
              >
                <X className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>

            <form
              className="flex min-h-0 flex-1 flex-col"
              onSubmit={(event) => {
                event.preventDefault();
                void submitRole();
              }}
            >
              <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <div>
                  <label htmlFor="create-role-key" className={labelClassName}>
                    Role key <span className="text-[var(--admin-danger)]">*</span>
                  </label>
                  <p className="mb-2 mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    A unique slug used internally for system logic and API calls.
                  </p>
                  <div className="relative">
                    <input
                      id="create-role-key"
                      ref={keyRef}
                      type="text"
                      required
                      value={key}
                      onChange={(event) => {
                        setKeyManuallyEdited(true);
                        setKey(event.target.value.toLowerCase());
                      }}
                      placeholder="e.g. instructor"
                      aria-invalid={keyHasError}
                      className={[
                        monoFieldClassName,
                        keyHasError
                          ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/30"
                          : keyIsValid
                            ? "border-[var(--admin-success)]/50"
                            : "",
                      ].join(" ")}
                    />
                    <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase tracking-wide text-[var(--admin-on-surface-variant)] opacity-60">
                      slug
                    </span>
                  </div>
                  {keyHasError ? (
                    <p className="mt-2 text-xs text-[var(--admin-danger)]">
                      Use lowercase snake_case starting with a letter (e.g.{" "}
                      <code className="font-mono">content_manager</code>).
                    </p>
                  ) : keyIsValid ? (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-[var(--admin-success)]">
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      Valid role key format
                    </p>
                  ) : null}
                </div>

                <div>
                  <label htmlFor="create-role-name" className={labelClassName}>
                    Role name <span className="text-[var(--admin-danger)]">*</span>
                  </label>
                  <p className="mb-2 mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    The display name shown across the admin panel and dashboard.
                  </p>
                  <input
                    id="create-role-name"
                    type="text"
                    required
                    value={name}
                    onChange={(event) => {
                      const nextName = event.target.value;
                      setName(nextName);
                      if (!keyManuallyEdited) {
                        const generated = slugifyRoleName(nextName);
                        if (generated) setKey(generated);
                      }
                    }}
                    placeholder="e.g. Instructor"
                    className={fieldClassName}
                  />
                </div>

                <div>
                  <label htmlFor="create-role-permissions" className={labelClassName}>
                    Initial permissions <span className="font-medium normal-case">(optional)</span>
                  </label>
                  <p className="mb-3 mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                    Comma-separated internal permission keys to assign immediately. At least one
                    permission is required to create the role.
                  </p>

                  {selectedPermissions.length > 0 ? (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {selectedPermissions.map((permission) => (
                        <span
                          key={permission}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-primary-container)] px-3 py-1 text-xs font-medium text-[var(--admin-on-primary-container)]"
                        >
                          <code className="font-mono">{permission}</code>
                          <button
                            type="button"
                            aria-label={`Remove ${permission}`}
                            className="rounded-full text-[var(--admin-on-primary-container)] transition-colors hover:text-[var(--admin-danger)]"
                            onClick={() => {
                              removePermission(permission);
                            }}
                          >
                            <X className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </span>
                      ))}
                    </div>
                  ) : null}

                  <textarea
                    id="create-role-permissions"
                    rows={3}
                    value={permissionsText}
                    onChange={(event) => {
                      const nextText = event.target.value;
                      setPermissionsText(nextText);
                      syncPermissions(parsePermissions(nextText));
                    }}
                    placeholder="profile.read, membership.read"
                    className={`${fieldClassName} resize-none font-mono text-xs`}
                  />

                  <button
                    type="button"
                    onClick={() => {
                      setPermissionBrowserOpen((current) => {
                        if (current) setPermissionSearch("");
                        return !current;
                      });
                    }}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
                    aria-expanded={permissionBrowserOpen}
                    aria-controls={permissionBrowserPanelId}
                  >
                    Browse available permissions
                    <ChevronDown
                      style={{ transitionTimingFunction: collapseEase }}
                      className={[
                        "h-4 w-4 motion-safe:transition-transform motion-safe:duration-300",
                        permissionBrowserOpen ? "rotate-180" : "rotate-0",
                      ].join(" ")}
                      aria-hidden="true"
                    />
                  </button>

                  <AnimatedCollapsible open={permissionBrowserOpen} id={permissionBrowserPanelId}>
                    <PermissionBrowser
                      selected={selectedPermissions}
                      search={permissionSearch}
                      onSearchChange={setPermissionSearch}
                      onToggle={togglePermission}
                    />
                  </AnimatedCollapsible>

                  {selectedPermissions.length === 0 ? (
                    <p className="mt-2 text-xs text-[var(--admin-warning)]">
                      Select at least one permission before creating this role.
                    </p>
                  ) : null}
                </div>

                {errorMessage ? (
                  <p
                    role="alert"
                    className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
                  >
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-5">
                <button
                  type="button"
                  disabled={busy}
                  onClick={closeDialog}
                  className="px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-on-surface)] disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--admin-on-primary)]/20">
                    <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden="true" />
                  </span>
                  {busy ? "Creating…" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
