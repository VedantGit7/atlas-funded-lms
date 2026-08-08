"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  Copy,
  Fingerprint,
  Filter,
  Info,
  Loader2,
  Minus,
  Plus,
  Search,
  Trash2,
  Ban,
  X,
  AlertTriangle,
} from "lucide-react";
import { Select, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { ActiveDevicesReportTabs } from "./ActiveDevicesReportTabs";
import {
  createBlockedFingerprint,
  createDevicePolicyOverride,
  deleteDevicePolicyOverride,
  fetchDevicePolicies,
  searchDevicePolicyTargets,
  unblockFingerprint,
  updateDevicePolicies,
  type DeviceBlockedFingerprint,
  type DevicePolicyOnLimit,
  type DevicePolicyOverride,
  type DevicePolicyOverrideOnLimit,
  type DevicePolicyScopeType,
  type DevicePolicyTarget,
  type DevicePolicyTenantDefaults,
  type DevicePoliciesPayload,
} from "./admin-active-devices-policies-api";

const IDLE_OPTIONS = [
  { value: "7", label: "7 days" },
  { value: "14", label: "14 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "never", label: "Never" },
] as const;

const ON_LIMIT_OPTIONS: Array<{ value: DevicePolicyOnLimit; label: string }> = [
  { value: "block", label: "Block the new sign-in" },
  { value: "sign_out_oldest", label: "Sign out the oldest device" },
  { value: "allow_and_alert", label: "Allow and raise an alert" },
];

const OVERRIDE_ON_LIMIT_OPTIONS: Array<{ value: DevicePolicyOverrideOnLimit; label: string }> = [
  { value: "inherit", label: "Default" },
  { value: "block", label: "Block login" },
  { value: "sign_out_oldest", label: "Force logout oldest" },
  { value: "allow_and_alert", label: "Notify admin" },
];

const selectTriggerClassName =
  "h-10 w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function cloneDefaults(value: DevicePolicyTenantDefaults): DevicePolicyTenantDefaults {
  return { ...value };
}

function defaultsEqual(a: DevicePolicyTenantDefaults, b: DevicePolicyTenantDefaults): boolean {
  return (
    a.restrictionsEnabled === b.restrictionsEnabled &&
    a.devicesAllowed === b.devicesAllowed &&
    a.restrictParallelLogins === b.restrictParallelLogins &&
    a.idleSessionExpiryDays === b.idleSessionExpiryDays &&
    a.onLimitReached === b.onLimitReached &&
    a.requireReverificationOnNewDevice === b.requireReverificationOnNewDevice &&
    a.notifyLearnerOnNewDevice === b.notifyLearnerOnNewDevice &&
    a.sharedFingerprintAlertEnabled === b.sharedFingerprintAlertEnabled &&
    a.sharedFingerprintThreshold === b.sharedFingerprintThreshold
  );
}

function onLimitLabel(value: DevicePolicyOverrideOnLimit): string {
  return OVERRIDE_ON_LIMIT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function scopeBadgeClass(scopeType: DevicePolicyScopeType): string {
  if (scopeType === "learner") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  if (scopeType === "batch") {
    return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
  return "bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]";
}

function PolicyToggle({
  id,
  checked,
  onChange,
  disabled,
  label,
}: {
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/40 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-[var(--admin-surface)] shadow transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function NumberStepper({
  value,
  onChange,
  min,
  max,
  disabled,
  ariaLabel,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="flex h-10 w-fit overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <button
        type="button"
        aria-label={`Decrease ${ariaLabel}`}
        disabled={disabled || value <= min}
        onClick={() => onChange(Math.max(min, value - 1))}
        className="flex w-10 items-center justify-center text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary)] disabled:opacity-40"
      >
        <Minus className="h-4 w-4" aria-hidden="true" />
      </button>
      <input
        type="number"
        aria-label={ariaLabel}
        min={min}
        max={max}
        disabled={disabled}
        value={value}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (!Number.isFinite(next)) return;
          onChange(Math.min(max, Math.max(min, Math.trunc(next))));
        }}
        className="w-14 border-x border-[var(--admin-border)] bg-transparent text-center font-mono text-[13px] text-[var(--admin-on-surface)] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      />
      <button
        type="button"
        aria-label={`Increase ${ariaLabel}`}
        disabled={disabled || value >= max}
        onClick={() => onChange(Math.min(max, value + 1))}
        className="flex w-10 items-center justify-center text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary)] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function UnsavedChangesModal({
  open,
  onStay,
  onDiscard,
}: {
  open: boolean;
  onStay: () => void;
  onDiscard: () => void;
}) {
  const titleId = useId();
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)]"
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))]">
              <AlertTriangle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            </div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Unsaved changes
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onStay}
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 pt-4 pb-8">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            You have unsaved changes to the tenant device policies. Leaving this page will discard
            these changes.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <button
            type="button"
            onClick={onDiscard}
            className="h-10 rounded-md border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))]"
          >
            Discard changes
          </button>
          <button type="button" onClick={onStay} className={`${primaryButtonClassName} h-10`}>
            Stay on page
          </button>
        </div>
      </div>
    </div>
  );
}

function AddOverrideModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (item: DevicePolicyOverride) => void;
}) {
  const titleId = useId();
  const [scopeType, setScopeType] = useState<DevicePolicyScopeType>("role");
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<DevicePolicyTarget[]>([]);
  const [selected, setSelected] = useState<DevicePolicyTarget | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [devicesAllowed, setDevicesAllowed] = useState(2);
  const [onLimitReached, setOnLimitReached] = useState<DevicePolicyOverrideOnLimit>("inherit");
  const [expiryDate, setExpiryDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    setScopeType("role");
    setQuery("");
    setTargets([]);
    setSelected(null);
    setMenuOpen(false);
    setDevicesAllowed(2);
    setOnLimitReached("inherit");
    setExpiryDate("");
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const response = await searchDevicePolicyTargets(scopeType, query);
          setTargets(response.data.items);
        } catch {
          setTargets([]);
        } finally {
          setSearching(false);
        }
      })();
    }, 200);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [open, scopeType, query]);

  if (!open) return null;

  const placeholder =
    scopeType === "role"
      ? "Select role..."
      : scopeType === "batch"
        ? "Select batch..."
        : "Search learner...";

  async function onSubmit() {
    if (!selected) {
      setError("Select a target for this override.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const expiresAt = expiryDate
        ? new Date(`${expiryDate}T23:59:59.000Z`).toISOString()
        : null;
      const response = await createDevicePolicyOverride({
        scopeType,
        scopeId: selected.id,
        devicesAllowed,
        onLimitReached,
        expiresAt,
      });
      onCreated(response.data);
      onClose();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not create override.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[600px] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <header className="sticky top-0 flex h-11 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
          <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
            Add override
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex max-h-[70vh] flex-col gap-6 overflow-y-auto p-6">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Scope type
            </legend>
            <div className="flex flex-wrap gap-6">
              {(
                [
                  ["role", "Role"],
                  ["batch", "Batch"],
                  ["learner", "Individual learner"],
                ] as const
              ).map(([value, label]) => (
                <label key={value} className="group flex cursor-pointer items-center gap-2">
                  <input
                    type="radio"
                    name="scope_type"
                    value={value}
                    checked={scopeType === value}
                    onChange={() => {
                      setScopeType(value);
                      setSelected(null);
                      setQuery("");
                    }}
                    className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span className="text-sm text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
                    {label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="relative flex flex-col gap-2">
            <label className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Target
            </label>
            <div className="relative">
              <Search
                className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                value={selected ? selected.label : query}
                onChange={(event) => {
                  setSelected(null);
                  setQuery(event.target.value);
                  setMenuOpen(true);
                }}
                onFocus={() => setMenuOpen(true)}
                placeholder={placeholder}
                className="h-10 w-full border border-[var(--admin-outline)] bg-[var(--admin-surface)] pr-10 pl-10 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)]"
              />
              <ChevronDown
                className="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
                aria-hidden="true"
              />
            </div>
            {menuOpen ? (
              <div
                className={`absolute top-full right-0 left-0 z-20 mt-1 max-h-48 overflow-y-auto border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg ${dropdownPanelEnterEndClassName}`}
              >
                {searching ? (
                  <div className="flex items-center gap-2 px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Searching…
                  </div>
                ) : targets.length === 0 ? (
                  <div className="px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
                    No matches.
                  </div>
                ) : (
                  targets.map((target) => (
                    <button
                      key={target.id}
                      type="button"
                      onClick={() => {
                        setSelected(target);
                        setQuery(target.label);
                        setMenuOpen(false);
                      }}
                      className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-[var(--admin-surface-low)]"
                    >
                      <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                        {target.label}
                      </span>
                      {target.secondary ? (
                        <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {target.secondary}
                        </span>
                      ) : null}
                    </button>
                  ))
                )}
              </div>
            ) : null}
            <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              Start typing to filter available targets.
            </p>
          </div>

          <div className="flex w-full flex-col gap-6 sm:flex-row">
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                Devices allowed
              </label>
              <NumberStepper
                value={devicesAllowed}
                onChange={setDevicesAllowed}
                min={1}
                max={99}
                disabled={saving}
                ariaLabel="Devices allowed"
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <label className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                On limit reached
              </label>
              <Select
                value={onLimitReached}
                onValueChange={(value) => setOnLimitReached(value as DevicePolicyOverrideOnLimit)}
                options={OVERRIDE_ON_LIMIT_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                className={selectTriggerClassName}
                disabled={saving}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Override expiry{" "}
              <span className="ml-1 font-mono text-[11px] font-normal normal-case text-[var(--admin-outline)]">
                (Optional)
              </span>
            </label>
            <input
              type="date"
              value={expiryDate}
              onChange={(event) => setExpiryDate(event.target.value)}
              disabled={saving}
              className="h-10 w-full max-w-[50%] border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
            />
          </div>

          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="sticky bottom-0 flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${ghostButtonClassName} h-10`}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Create override
          </button>
        </footer>
      </div>
    </div>
  );
}

function AddBlockModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (item: DeviceBlockedFingerprint) => void;
}) {
  const titleId = useId();
  const [fingerprint, setFingerprint] = useState("");
  const [reason, setReason] = useState("Manual block");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFingerprint("");
    setReason("Manual block");
    setError(null);
  }, [open]);

  if (!open) return null;

  async function onSubmit() {
    setSaving(true);
    setError(null);
    try {
      const response = await createBlockedFingerprint({ fingerprint, reason });
      onCreated(response.data);
      onClose();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not block fingerprint.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[480px] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)]"
      >
        <header className="flex h-11 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
          <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
            Block fingerprint
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>
        <div className="flex flex-col gap-4 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Fingerprint
            </label>
            <input
              value={fingerprint}
              onChange={(event) => setFingerprint(event.target.value)}
              className="h-10 border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
              placeholder="Paste device fingerprint"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
              Reason
            </label>
            <input
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="h-10 border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
            />
          </div>
          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
        <footer className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-3">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onSubmit()}
            disabled={saving || fingerprint.trim().length < 4}
            className={`${primaryButtonClassName} h-10 gap-2 disabled:opacity-50`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Add block
          </button>
        </footer>
      </div>
    </div>
  );
}

export function AdminActiveDevicesPoliciesPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [capabilitiesNote, setCapabilitiesNote] = useState("");
  const [draft, setDraft] = useState<DevicePolicyTenantDefaults | null>(null);
  const [saved, setSaved] = useState<DevicePolicyTenantDefaults | null>(null);
  const [overrides, setOverrides] = useState<DevicePolicyOverride[]>([]);
  const [blocked, setBlocked] = useState<DeviceBlockedFingerprint[]>([]);
  const [blockFilter, setBlockFilter] = useState("");
  const [showBlockFilter, setShowBlockFilter] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [overrideModalOpen, setOverrideModalOpen] = useState(false);
  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const allowLeaveRef = useRef(false);

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return !defaultsEqual(draft, saved);
  }, [draft, saved]);

  const applyPayload = useCallback((payload: DevicePoliciesPayload) => {
    const defaults = cloneDefaults(payload.tenantDefaults);
    setDraft(defaults);
    setSaved(cloneDefaults(defaults));
    setOverrides(payload.overrides);
    setBlocked(payload.blockedFingerprints);
    setCapabilitiesNote(payload.capabilities.enforcementNote);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchDevicePolicies();
      applyPayload(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not load device policies.",
      );
    } finally {
      setLoading(false);
    }
  }, [applyPayload]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!dirty || allowLeaveRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  function requestNavigate(href: string) {
    if (!dirty) {
      window.location.assign(href);
      return;
    }
    setPendingHref(href);
    setUnsavedOpen(true);
  }

  async function onSave() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateDevicePolicies(draft);
      applyPayload(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not save device policies.",
      );
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    if (!saved) return;
    setDraft(cloneDefaults(saved));
    setError(null);
  }

  async function onDeleteOverride(id: string) {
    try {
      await deleteDevicePolicyOverride(id);
      setOverrides((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not delete override.",
      );
    }
  }

  async function onUnblock(id: string) {
    try {
      await unblockFingerprint(id);
      setBlocked((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not unblock fingerprint.",
      );
    }
  }

  async function copyFingerprint(item: DeviceBlockedFingerprint) {
    try {
      await navigator.clipboard.writeText(item.fingerprint);
      setCopiedId(item.id);
      window.setTimeout(() => setCopiedId(null), 1500);
    } catch {
      setError("Could not copy fingerprint.");
    }
  }

  const filteredBlocked = useMemo(() => {
    const q = blockFilter.trim().toLowerCase();
    if (!q) return blocked;
    return blocked.filter(
      (item) =>
        item.fingerprint.toLowerCase().includes(q) || item.reason.toLowerCase().includes(q),
    );
  }, [blocked, blockFilter]);

  if (loading || !draft) {
    return (
      <div className="space-y-6 p-4 md:p-8">
        <div className="h-8 w-64 animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="h-10 w-full animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="grid gap-6 xl:grid-cols-12">
          <div className="h-80 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:col-span-8" />
          <div className="h-80 animate-pulse rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:col-span-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6 p-4 pb-28 md:p-8 md:pb-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <nav className="mb-2 flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
            <span aria-hidden="true">/</span>
            <Link href="/admin/reports/active-devices" className="hover:text-[var(--admin-primary)]">
              Active Devices
            </Link>
            <span aria-hidden="true">/</span>
            <span className="font-medium text-[var(--admin-on-surface)]">Policies</span>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Device policies
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Set how many devices a learner may keep signed in and what happens when they exceed it.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link
            href="/admin/audit"
            className={`${ghostButtonClassName} h-10`}
            onClick={(event) => {
              if (!dirty) return;
              event.preventDefault();
              requestNavigate("/admin/audit");
            }}
          >
            View audit log
          </Link>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void onSave()}
            className={`${primaryButtonClassName} h-10 gap-2 disabled:cursor-not-allowed disabled:opacity-50`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save changes
          </button>
        </div>
      </div>

      <ActiveDevicesReportTabs active="policies" />

      {error ? (
        <div
          className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {error}
        </div>
      ) : null}

      {capabilitiesNote ? (
        <div className="flex items-start gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
          <span>{capabilitiesNote}</span>
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <section className="flex flex-col border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:col-span-8">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">Tenant default</h2>
          </div>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 p-6 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Devices allowed per learner
              </label>
              <NumberStepper
                value={draft.devicesAllowed}
                onChange={(devicesAllowed) =>
                  setDraft((current) => (current ? { ...current, devicesAllowed } : current))
                }
                min={1}
                max={10}
                disabled={saving || !draft.restrictionsEnabled}
                ariaLabel="Devices allowed per learner"
              />
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Maximum active sessions permitted concurrently.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Idle session expiry
              </label>
              <Select
                value={draft.idleSessionExpiryDays == null ? "never" : String(draft.idleSessionExpiryDays)}
                onValueChange={(value) =>
                  setDraft((current) =>
                    current
                      ? {
                          ...current,
                          idleSessionExpiryDays:
                            value === "never" ? null : (Number(value) as 7 | 14 | 30 | 90),
                        }
                      : current,
                  )
                }
                options={IDLE_OPTIONS.map((option) => ({
                  value: option.value,
                  label: option.label,
                }))}
                className={selectTriggerClassName}
                disabled={saving}
              />
            </div>

            <div className="col-span-1 flex flex-col gap-1.5 md:col-span-2">
              <label className="text-sm font-semibold text-[var(--admin-on-surface)]">
                When the limit is reached
              </label>
              <div
                role="radiogroup"
                aria-label="When the limit is reached"
                className="mt-1 flex flex-col overflow-hidden rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] sm:flex-row"
              >
                {ON_LIMIT_OPTIONS.map((option, index) => {
                  const selected = draft.onLimitReached === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      disabled={saving}
                      onClick={() =>
                        setDraft((current) =>
                          current ? { ...current, onLimitReached: option.value } : current,
                        )
                      }
                      className={`flex-1 px-4 py-2 text-sm transition-colors ${
                        selected
                          ? "bg-[var(--admin-surface-high)] font-semibold text-[var(--admin-on-surface)]"
                          : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                      } ${index < ON_LIMIT_OPTIONS.length - 1 ? "border-b border-[var(--admin-border)] sm:border-r sm:border-b-0" : ""}`}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="col-span-1 mt-2 flex flex-col gap-5 border-t border-[var(--admin-border)] pt-6 md:col-span-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 pr-4">
                  <label
                    htmlFor="toggle-restrictions"
                    className="text-sm font-semibold text-[var(--admin-on-surface)]"
                  >
                    Enable device restrictions
                  </label>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Limits registered devices for learners when enabled.
                  </p>
                </div>
                <PolicyToggle
                  id="toggle-restrictions"
                  label="Enable device restrictions"
                  checked={draft.restrictionsEnabled}
                  disabled={saving}
                  onChange={(restrictionsEnabled) =>
                    setDraft((current) => (current ? { ...current, restrictionsEnabled } : current))
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 pr-4">
                  <label
                    htmlFor="toggle-parallel"
                    className="text-sm font-semibold text-[var(--admin-on-surface)]"
                  >
                    Restrict parallel logins
                  </label>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Prevent concurrent sessions on registered mobile devices.
                  </p>
                </div>
                <PolicyToggle
                  id="toggle-parallel"
                  label="Restrict parallel logins"
                  checked={draft.restrictParallelLogins}
                  disabled={saving || !draft.restrictionsEnabled}
                  onChange={(restrictParallelLogins) =>
                    setDraft((current) =>
                      current ? { ...current, restrictParallelLogins } : current,
                    )
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 pr-4">
                  <label
                    htmlFor="toggle-reverify"
                    className="text-sm font-semibold text-[var(--admin-on-surface)]"
                  >
                    Require re-verification on a new device
                  </label>
                  <p className="text-xs text-[var(--admin-on-surface-variant)]">
                    Forces MFA or email verification for unrecognized hardware.
                  </p>
                </div>
                <PolicyToggle
                  id="toggle-reverify"
                  label="Require re-verification on a new device"
                  checked={draft.requireReverificationOnNewDevice}
                  disabled={saving}
                  onChange={(requireReverificationOnNewDevice) =>
                    setDraft((current) =>
                      current ? { ...current, requireReverificationOnNewDevice } : current,
                    )
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4">
                <div className="flex flex-col gap-1 pr-4">
                  <label
                    htmlFor="toggle-notify"
                    className="text-sm font-semibold text-[var(--admin-on-surface)]"
                  >
                    Notify the learner on new device sign-in
                  </label>
                </div>
                <PolicyToggle
                  id="toggle-notify"
                  label="Notify the learner on new device sign-in"
                  checked={draft.notifyLearnerOnNewDevice}
                  disabled={saving}
                  onChange={(notifyLearnerOnNewDevice) =>
                    setDraft((current) =>
                      current ? { ...current, notifyLearnerOnNewDevice } : current,
                    )
                  }
                />
              </div>

              <div className="flex items-start justify-between gap-4 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <div className="flex flex-1 flex-col gap-2 pr-4">
                  <label
                    htmlFor="toggle-shared-fp"
                    className="text-sm font-semibold text-[var(--admin-on-surface)]"
                  >
                    Alert admins when a fingerprint appears on multiple accounts
                  </label>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-sm text-[var(--admin-on-surface-variant)]">Threshold:</span>
                    <input
                      type="number"
                      min={2}
                      max={50}
                      disabled={saving || !draft.sharedFingerprintAlertEnabled}
                      value={draft.sharedFingerprintThreshold}
                      onChange={(event) => {
                        const next = Number(event.target.value);
                        if (!Number.isFinite(next)) return;
                        setDraft((current) =>
                          current
                            ? {
                                ...current,
                                sharedFingerprintThreshold: Math.min(
                                  50,
                                  Math.max(2, Math.trunc(next)),
                                ),
                              }
                            : current,
                        );
                      }}
                      className="h-8 w-16 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] text-center font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                    <span className="text-sm text-[var(--admin-on-surface-variant)]">accounts</span>
                  </div>
                </div>
                <PolicyToggle
                  id="toggle-shared-fp"
                  label="Alert admins when a fingerprint appears on multiple accounts"
                  checked={draft.sharedFingerprintAlertEnabled}
                  disabled={saving}
                  onChange={(sharedFingerprintAlertEnabled) =>
                    setDraft((current) =>
                      current ? { ...current, sharedFingerprintAlertEnabled } : current,
                    )
                  }
                />
              </div>
            </div>
          </div>
        </section>

        <section className="flex h-full flex-col overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:col-span-4">
          <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
              <Fingerprint className="h-4 w-4 text-[var(--admin-outline)]" aria-hidden="true" />
              Blocked fingerprints
            </h2>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Filter blocked fingerprints"
                onClick={() => setShowBlockFilter((value) => !value)}
                className="p-1 text-[var(--admin-primary)] transition-colors hover:opacity-80"
              >
                <Filter className="h-5 w-5" aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => setBlockModalOpen(true)}
                className="p-1 text-[var(--admin-primary)] transition-colors hover:opacity-80"
                aria-label="Add block"
              >
                <Plus className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>

          {showBlockFilter ? (
            <div className="border-b border-[var(--admin-border)] px-4 py-2">
              <input
                value={blockFilter}
                onChange={(event) => setBlockFilter(event.target.value)}
                placeholder="Filter by fingerprint or reason"
                className="h-9 w-full border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]"
              />
            </div>
          ) : null}

          {filteredBlocked.length === 0 ? (
            <div className="flex min-h-[300px] flex-1 flex-col items-center justify-center px-4 py-16">
              <div className="relative mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                <Fingerprint className="h-9 w-9 text-[var(--admin-outline)]" aria-hidden="true" />
                <div className="absolute -right-1 -bottom-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[var(--admin-surface)] bg-[var(--admin-surface-high)]">
                  <Ban className="h-3.5 w-3.5 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
                </div>
              </div>
              <h3 className="mb-2 text-center text-base font-semibold text-[var(--admin-on-surface)]">
                No fingerprints are blocked.
              </h3>
              <p className="mb-4 max-w-md text-center text-sm text-[var(--admin-on-surface-variant)]">
                Fingerprints manually blocked from session detail or flagged by security rules will
                appear here.
              </p>
              <button
                type="button"
                onClick={() => setBlockModalOpen(true)}
                className={`${primaryButtonClassName} h-10 gap-2`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add block
              </button>
            </div>
          ) : (
            <div className="flex-1 overflow-x-auto">
              <table className="w-full min-w-[360px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                    <th className="px-4 py-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Fingerprint
                    </th>
                    <th className="px-4 py-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Reason
                    </th>
                    <th className="px-4 py-2 text-right text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBlocked.map((item) => (
                    <tr
                      key={item.id}
                      className="group h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-low)]"
                    >
                      <td className="px-4 py-1">
                        <div className="flex items-center gap-2">
                          <span className="max-w-[100px] truncate font-mono text-[13px] text-[var(--admin-on-surface)]">
                            {item.fingerprintShort}
                          </span>
                          <button
                            type="button"
                            aria-label="Copy fingerprint"
                            onClick={() => void copyFingerprint(item)}
                            className="text-[var(--admin-outline)] opacity-0 transition-opacity group-hover:opacity-100 hover:text-[var(--admin-primary)]"
                          >
                            {copiedId === item.id ? (
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                          </button>
                        </div>
                      </td>
                      <td className="max-w-[120px] truncate px-4 py-1 text-sm text-[var(--admin-on-surface-variant)]">
                        {item.reason}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <button
                          type="button"
                          onClick={() => void onUnblock(item.id)}
                          className="text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:opacity-80"
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="flex flex-col overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:col-span-12">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-[var(--admin-on-surface)]">
                Role and cohort overrides
                <span className="rounded-full bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {overrides.length}
                </span>
              </h2>
              <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                Precedence: Learner override &gt; Batch &gt; Role &gt; Tenant default.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOverrideModalOpen(true)}
              className={`${ghostButtonClassName} h-9 gap-2`}
            >
              <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
              Add override
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="h-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  {(
                    [
                      "Scope",
                      "Devices allowed",
                      "On limit reached",
                      "Applies to",
                      "Updated by",
                      "Actions",
                    ] as const
                  ).map((heading) => (
                    <th
                      key={heading}
                      className={`px-4 py-2 text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase ${
                        heading === "Actions" ? "text-right" : ""
                      } ${heading === "Scope" ? "sticky left-0 z-10 bg-[var(--admin-surface-low)]" : ""}`}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {overrides.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                    >
                      No overrides yet. Add a role, batch, or learner override to diverge from the
                      tenant default.
                    </td>
                  </tr>
                ) : (
                  overrides.map((item) => (
                    <tr
                      key={item.id}
                      className={`h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-low)] ${
                        item.scopeType === "learner"
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                          : ""
                      }`}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-4 py-1">
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold capitalize ${scopeBadgeClass(item.scopeType)}`}
                          >
                            {item.scopeType === "learner" ? "Learner" : item.scopeType === "batch" ? "Batch" : "Role"}
                          </span>
                          <span className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                            {item.scopeLabel}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-1 font-mono text-[13px] text-[var(--admin-on-surface)]">
                        {item.devicesAllowed}
                      </td>
                      <td className="px-4 py-1 text-sm text-[var(--admin-on-surface-variant)]">
                        {onLimitLabel(item.onLimitReached)}
                      </td>
                      <td className="px-4 py-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                        {item.appliesToCount}
                      </td>
                      <td className="px-4 py-1 text-sm text-[var(--admin-on-surface-variant)]">
                        {item.updatedByLabel ?? "System"}
                      </td>
                      <td className="px-4 py-1 text-right">
                        <div className="flex items-center justify-end gap-2 text-[var(--admin-outline)]">
                          <button
                            type="button"
                            aria-label={`Delete override for ${item.scopeLabel}`}
                            onClick={() => void onDeleteOverride(item.id)}
                            className="transition-colors hover:text-[var(--admin-danger)]"
                          >
                            <Trash2 className="h-[18px] w-[18px]" aria-hidden="true" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {dirty ? (
        <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-4 py-3 backdrop-blur-sm md:left-[var(--admin-sidebar-width,0px)]">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              You have unsaved policy changes.
            </p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onCancel} className={`${ghostButtonClassName} h-10`}>
                Discard
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className={`${primaryButtonClassName} h-10 gap-2`}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AddOverrideModal
        open={overrideModalOpen}
        onClose={() => setOverrideModalOpen(false)}
        onCreated={(item) => {
          setOverrides((current) => {
            const without = current.filter(
              (row) => !(row.scopeType === item.scopeType && row.scopeId === item.scopeId),
            );
            return [item, ...without];
          });
        }}
      />
      <AddBlockModal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        onCreated={(item) => {
          setBlocked((current) => {
            const without = current.filter((row) => row.fingerprint !== item.fingerprint);
            return [item, ...without];
          });
        }}
      />
      <UnsavedChangesModal
        open={unsavedOpen}
        onStay={() => {
          setUnsavedOpen(false);
          setPendingHref(null);
        }}
        onDiscard={() => {
          allowLeaveRef.current = true;
          setUnsavedOpen(false);
          if (pendingHref) window.location.assign(pendingHref);
        }}
      />
    </div>
  );
}
