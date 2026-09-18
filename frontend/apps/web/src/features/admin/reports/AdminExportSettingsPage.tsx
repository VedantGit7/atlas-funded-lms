"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  History,
  Info,
  Loader2,
  Minus,
  Plus,
  Shield,
  Trash2,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import {
  fetchExportSettings,
  fetchRetentionImpact,
  purgeExpiredExportFiles,
  updateExportSettings,
  type DownloadAccessPolicy,
  type ExportSettings,
  type ExportSettingsAuditEvent,
  type ExportSettingsPayload,
  type ExportSettingsRole,
  type FileRetentionUnit,
  type PersonalDataFieldMeta,
  type PiiDataType,
  type PiiTreatment,
  type RetentionImpact,
  type RunRecordRetention,
} from "./admin-export-settings-api";

const primaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 text-[13px] font-semibold text-[var(--admin-on-primary)] transition-all hover:bg-[var(--admin-primary-strong)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-[13px] font-semibold text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-low)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-[13px] text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--admin-primary)]";

const RUN_RECORD_OPTIONS: Array<{ value: RunRecordRetention; label: string }> = [
  { value: "1y", label: "1 year" },
  { value: "2y", label: "2 years" },
  { value: "5y", label: "5 years" },
  { value: "forever", label: "Forever" },
];

const DOWNLOAD_ACCESS_OPTIONS: Array<{ value: DownloadAccessPolicy; label: string; hint: string }> =
  [
    {
      value: "anyone_who_can_run",
      label: "Anyone who can run exports",
      hint: "All roles listed above can download completed files.",
    },
    {
      value: "owners_only",
      label: "Owners only",
      hint: "Only the export owner and super admins can download.",
    },
    {
      value: "requester_only",
      label: "Requester only",
      hint: "Only the member who started the run can download.",
    },
  ];

const TREATMENT_OPTIONS: Array<{ value: PiiTreatment; label: string }> = [
  { value: "include", label: "Include" },
  { value: "mask", label: "Mask" },
  { value: "exclude", label: "Exclude" },
];

function cloneSettings(value: ExportSettings): ExportSettings {
  return {
    ...value,
    runExportRoleKeys: [...value.runExportRoleKeys],
    personalDataTreatments: { ...value.personalDataTreatments },
  };
}

function settingsEqual(a: ExportSettings, b: ExportSettings): boolean {
  if (
    a.fileRetentionValue !== b.fileRetentionValue ||
    a.fileRetentionUnit !== b.fileRetentionUnit ||
    a.runRecordRetention !== b.runRecordRetention ||
    a.maxRowsPerExport !== b.maxRowsPerExport ||
    a.maxConcurrentPerAdmin !== b.maxConcurrentPerAdmin ||
    a.downloadAccess !== b.downloadAccess ||
    a.requireReasonForPii !== b.requireReasonForPii ||
    a.allowExternalDestinations !== b.allowExternalDestinations ||
    a.watermarkExports !== b.watermarkExports
  ) {
    return false;
  }
  if (a.runExportRoleKeys.length !== b.runExportRoleKeys.length) return false;
  const aRoles = [...a.runExportRoleKeys].sort();
  const bRoles = [...b.runExportRoleKeys].sort();
  for (let i = 0; i < aRoles.length; i += 1) {
    if (aRoles[i] !== bRoles[i]) return false;
  }
  const keys = Object.keys(a.personalDataTreatments) as PiiDataType[];
  for (const key of keys) {
    if (a.personalDataTreatments[key] !== b.personalDataTreatments[key]) return false;
  }
  return true;
}

function retentionMs(value: number, unit: FileRetentionUnit): number {
  return unit === "hours" ? value * 3_600_000 : value * 86_400_000;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb < 10 ? mb.toFixed(1) : Math.round(mb)} MB`;
  const gb = mb / 1024;
  return `${gb < 10 ? gb.toFixed(2) : Math.round(gb)} GB`;
}

function formatRelative(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return "Just now";
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function runRecordLabel(value: RunRecordRetention): string {
  return RUN_RECORD_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function treatmentLabel(value: PiiTreatment): string {
  return TREATMENT_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function unitLabel(unit: FileRetentionUnit): string {
  return unit === "hours" ? "Hours" : "Days";
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
      onClick={() => {
        onChange(!checked);
      }}
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
        onClick={() => {
          onChange(Math.max(min, value - 1));
        }}
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
        onClick={() => {
          onChange(Math.min(max, value + 1));
        }}
        className="flex w-10 items-center justify-center text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-primary)] disabled:opacity-40"
      >
        <Plus className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function SkeletonBar({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-[var(--admin-surface-low)] ${className ?? "h-4 w-24"}`}
    />
  );
}

function SettingsLoadingSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Loading export settings">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl space-y-3">
          <SkeletonBar className="h-3 w-40" />
          <SkeletonBar className="h-8 w-48" />
          <SkeletonBar className="h-4 w-72" />
          <div className="flex gap-5 border-b border-[var(--admin-border)] pb-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonBar key={i} className="h-4 w-16" />
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <SkeletonBar className="h-9 w-28" />
          <SkeletonBar className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="space-y-6 xl:col-span-8">
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <SkeletonBar className="mb-4 h-5 w-40" />
            <div className="grid gap-4 sm:grid-cols-2">
              <SkeletonBar className="h-20 w-full" />
              <SkeletonBar className="h-20 w-full" />
              <SkeletonBar className="h-10 w-full" />
              <SkeletonBar className="h-10 w-full" />
            </div>
          </div>
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <SkeletonBar className="mb-4 h-5 w-36" />
            <SkeletonBar className="mb-3 h-10 w-full" />
            <SkeletonBar className="mb-3 h-16 w-full" />
            <SkeletonBar className="h-12 w-full" />
          </div>
        </div>
        <div className="space-y-6 xl:col-span-4">
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <SkeletonBar className="mb-4 h-5 w-40" />
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonBar key={i} className="mb-3 h-12 w-full" />
            ))}
          </div>
          <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <SkeletonBar className="mb-4 h-5 w-32" />
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonBar key={i} className="mb-3 h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
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
            aria-label="Close unsaved changes dialog"
            onClick={onStay}
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 pt-4 pb-8">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            You have unsaved export settings. Leaving this page will discard these changes.
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

function RetentionReductionModal({
  open,
  impact,
  acknowledged,
  busy,
  onAcknowledgeChange,
  onCancel,
  onApply,
}: {
  open: boolean;
  impact: RetentionImpact | null;
  acknowledged: boolean;
  busy: boolean;
  onAcknowledgeChange: (next: boolean) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const titleId = useId();
  if (!open || !impact) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex w-full max-w-[520px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_32px_-8px_color-mix(in_srgb,var(--admin-on-surface)_20%,transparent)]"
      >
        <div className="h-1 w-full bg-[var(--admin-danger)]" aria-hidden="true" />
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] p-6 pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))]">
              <AlertTriangle className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            </div>
            <div>
              <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
                Reducing retention period
              </h2>
              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                Data loss implication
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close retention reduction dialog"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-4 bg-[var(--admin-surface-low)] px-6 pt-4 pb-6">
          <p className="text-sm text-[var(--admin-on-surface)]">
            You are reducing retention from{" "}
            <span className="font-semibold">{impact.currentRetentionLabel}</span> to{" "}
            <span className="font-semibold">{impact.nextRetentionLabel}</span>. Files outside the
            new window are deleted immediately and cannot be recovered.
          </p>
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] px-4 py-3">
            <div>
              <p className="font-mono text-[10px] font-medium tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                Immediate impact
              </p>
              <p className="mt-0.5 text-base font-semibold text-[var(--admin-danger)]">
                {impact.filesDeletedImmediately.toLocaleString()} file
                {impact.filesDeletedImmediately === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right">
              <p className="font-mono text-[10px] font-medium tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                Storage freed
              </p>
              <p className="mt-0.5 font-mono text-[13px] text-[var(--admin-on-surface)]">
                {formatBytes(impact.estimatedBytesFreed)}
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3">
            <input
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => {
                onAcknowledgeChange(event.target.checked);
              }}
              className="mt-0.5 h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-danger)] focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30"
            />
            <span className="text-sm text-[var(--admin-on-surface)]">
              I acknowledge that {impact.filesDeletedImmediately.toLocaleString()} file
              {impact.filesDeletedImmediately === 1 ? "" : "s"} will be permanently deleted.
            </span>
          </label>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={secondaryButtonClassName}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!acknowledged || busy}
            onClick={onApply}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 text-[13px] font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Apply new retention policy
          </button>
        </div>
      </div>
    </div>
  );
}

function PurgeExpiredModal({
  open,
  expiredCount,
  freesBytes,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  expiredCount: number;
  freesBytes: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
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
              <Trash2 className="h-5 w-5 text-[var(--admin-danger)]" aria-hidden="true" />
            </div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Delete expired files
            </h2>
          </div>
          <button
            type="button"
            aria-label="Close delete expired files dialog"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>
        <div className="px-6 pt-4 pb-8">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            This will permanently delete{" "}
            <span className="font-semibold text-[var(--admin-on-surface)]">
              {expiredCount.toLocaleString()}
            </span>{" "}
            expired export file
            {expiredCount === 1 ? "" : "s"}
            {freesBytes > 0 ? ` and free about ${formatBytes(freesBytes)}` : ""}. This does not
            change your retention policy.
          </p>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className={secondaryButtonClassName}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-4 text-[13px] font-semibold text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Delete expired files
          </button>
        </div>
      </div>
    </div>
  );
}

function ModuleTabNav({
  dirty,
  onNavigate,
}: {
  dirty: boolean;
  onNavigate: (href: string) => void;
}) {
  const tabs: Array<{ key: string; label: string; href: string; active?: boolean }> = [
    { key: "history", label: "History", href: "/admin/reports/exports" },
    { key: "new", label: "New export", href: "/admin/reports/exports/new" },
    { key: "schedules", label: "Schedules", href: "/admin/reports/exports/schedules" },
    { key: "destinations", label: "Destinations", href: "/admin/reports/exports/destinations" },
    {
      key: "settings",
      label: "Settings",
      href: "/admin/reports/exports/settings",
      active: true,
    },
  ];

  return (
    <nav
      className="mt-4 flex items-end gap-5 border-b border-[var(--admin-border)]"
      aria-label="Exports module"
    >
      {tabs.map((tab) => {
        const className = `-mb-px border-b-2 pb-2 text-sm transition-colors ${
          tab.active
            ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
            : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
        }`;
        if (tab.active) {
          return (
            <span key={tab.key} className={className} aria-current="page">
              {tab.label}
            </span>
          );
        }
        if (dirty) {
          return (
            <button
              key={tab.key}
              type="button"
              className={className}
              onClick={() => {
                onNavigate(tab.href);
              }}
            >
              {tab.label}
            </button>
          );
        }
        return (
          <Link key={tab.key} href={tab.href} className={className}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminExportSettingsPage() {
  const unitLabelId = useId();
  const runRecordLabelId = useId();
  const addRoleLabelId = useId();
  const reasonToggleId = useId();
  const externalToggleId = useId();
  const watermarkToggleId = useId();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [purging, setPurging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ExportSettings | null>(null);
  const [saved, setSaved] = useState<ExportSettings | null>(null);
  const [storage, setStorage] = useState<ExportSettingsPayload["storage"] | null>(null);
  const [availableRoles, setAvailableRoles] = useState<ExportSettingsRole[]>([]);
  const [externalDestinationCount, setExternalDestinationCount] = useState(0);
  const [personalDataFields, setPersonalDataFields] = useState<PersonalDataFieldMeta[]>([]);
  const [recentAudit, setRecentAudit] = useState<ExportSettingsAuditEvent[]>([]);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [updatedByName, setUpdatedByName] = useState<string | null>(null);

  const [unitOpen, setUnitOpen] = useState(false);
  const [runRecordOpen, setRunRecordOpen] = useState(false);
  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [treatmentOpenKey, setTreatmentOpenKey] = useState<PiiDataType | null>(null);

  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const allowLeaveRef = useRef(false);

  const [retentionModalOpen, setRetentionModalOpen] = useState(false);
  const [retentionImpact, setRetentionImpact] = useState<RetentionImpact | null>(null);
  const [retentionAck, setRetentionAck] = useState(false);

  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);

  const dirty = useMemo(() => {
    if (!draft || !saved) return false;
    return !settingsEqual(draft, saved);
  }, [draft, saved]);

  useEffect(() => {
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => {
      setIsNarrow(media.matches);
    };
    sync();
    media.addEventListener("change", sync);
    return () => {
      media.removeEventListener("change", sync);
    };
  }, []);

  const applyPayload = useCallback((payload: ExportSettingsPayload) => {
    const next = cloneSettings(payload.settings);
    setDraft(next);
    setSaved(cloneSettings(next));
    setStorage(payload.storage);
    setAvailableRoles(payload.availableRoles);
    setExternalDestinationCount(payload.externalDestinationCount);
    setPersonalDataFields(payload.personalDataFields);
    setRecentAudit(payload.recentAudit);
    setUpdatedAt(payload.updatedAt);
    setUpdatedByName(payload.updatedByName);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchExportSettings();
      applyPayload(response.data);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not load export settings.",
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
      // Chrome still requires returnValue for the unload prompt.
      // eslint-disable-next-line @typescript-eslint/no-deprecated -- required for beforeunload dialog UX
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  function requestNavigate(href: string) {
    if (!dirty) {
      window.location.assign(href);
      return;
    }
    setPendingHref(href);
    setUnsavedOpen(true);
  }

  function patchDraft(patch: Partial<ExportSettings>) {
    setDraft((current) => (current ? { ...current, ...patch } : current));
  }

  function setTreatment(key: PiiDataType, treatment: PiiTreatment) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        personalDataTreatments: {
          ...current.personalDataTreatments,
          [key]: treatment,
        },
      };
    });
    setTreatmentOpenKey(null);
  }

  function removeRole(key: string) {
    setDraft((current) => {
      if (!current) return current;
      return {
        ...current,
        runExportRoleKeys: current.runExportRoleKeys.filter((role) => role !== key),
      };
    });
  }

  function addRole(key: string) {
    setDraft((current) => {
      if (!current) return current;
      if (current.runExportRoleKeys.includes(key)) return current;
      return {
        ...current,
        runExportRoleKeys: [...current.runExportRoleKeys, key],
      };
    });
    setAddRoleOpen(false);
  }

  async function persistSettings(acknowledgeRetentionPurge: boolean) {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const response = await updateExportSettings({
        settings: draft,
        ...(acknowledgeRetentionPurge ? { acknowledgeRetentionPurge: true } : {}),
      });
      applyPayload(response.data);
      setRetentionModalOpen(false);
      setRetentionImpact(null);
      setRetentionAck(false);
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not save export settings.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onSave() {
    if (!draft || !saved) return;
    const reducing =
      retentionMs(draft.fileRetentionValue, draft.fileRetentionUnit) <
      retentionMs(saved.fileRetentionValue, saved.fileRetentionUnit);

    if (reducing) {
      setSaving(true);
      setError(null);
      try {
        const impactResponse = await fetchRetentionImpact({
          fileRetentionValue: draft.fileRetentionValue,
          fileRetentionUnit: draft.fileRetentionUnit,
        });
        if (impactResponse.data.filesDeletedImmediately > 0) {
          setRetentionImpact(impactResponse.data);
          setRetentionAck(false);
          setRetentionModalOpen(true);
          setSaving(false);
          return;
        }
        await persistSettings(false);
      } catch (caught) {
        setError(
          caught instanceof ClientApiError
            ? caught.message
            : caught instanceof Error
              ? caught.message
              : "Could not check retention impact.",
        );
        setSaving(false);
      }
      return;
    }

    await persistSettings(false);
  }

  function onDiscardDraft() {
    if (!saved) return;
    setDraft(cloneSettings(saved));
    setError(null);
  }

  function onRequestPurge() {
    if (!storage || storage.expiredCount <= 0) return;
    setPurgeModalOpen(true);
  }

  async function onConfirmPurge() {
    setPurging(true);
    setError(null);
    try {
      await purgeExpiredExportFiles();
      setPurgeModalOpen(false);
      await load();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not purge expired files.",
      );
    } finally {
      setPurging(false);
    }
  }

  const roleNameByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const role of availableRoles) map.set(role.key, role.name);
    return map;
  }, [availableRoles]);

  const addableRoles = useMemo(() => {
    if (!draft) return [];
    const selected = new Set(draft.runExportRoleKeys);
    return availableRoles.filter((role) => !selected.has(role.key));
  }, [availableRoles, draft]);

  if (loading) {
    return <SettingsLoadingSkeleton />;
  }

  if (error && !draft) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
        <AlertTriangle className="h-10 w-10 text-[var(--admin-danger)]" aria-hidden="true" />
        <div>
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            Could not load settings
          </h2>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
        </div>
        <button type="button" className={primaryButtonClassName} onClick={() => void load()}>
          Retry
        </button>
      </div>
    );
  }

  if (!draft || !saved || !storage) {
    return null;
  }

  const updatedCaption =
    updatedAt != null
      ? `Last updated ${formatRelative(updatedAt)}${updatedByName ? ` by ${updatedByName}` : ""}`
      : "No settings saved yet";

  return (
    <div className="relative flex flex-col gap-6 pb-28">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-medium tracking-wide text-[var(--admin-on-surface-variant)]">
            Admin / Reports / Exports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Settings
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Retention, access, and personal-data rules for every export across reports.
          </p>
          <ModuleTabNav dirty={dirty} onNavigate={requestNavigate} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href="/admin/audit" className={secondaryButtonClassName}>
            <History className="h-4 w-4" aria-hidden="true" />
            View audit log
          </Link>
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void onSave()}
            className={primaryButtonClassName}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Save changes
          </button>
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="flex-1">{error}</div>
          <button
            type="button"
            aria-label="Dismiss error"
            onClick={() => {
              setError(null);
            }}
            className="rounded p-0.5 hover:bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <p className="text-xs text-[var(--admin-on-surface-variant)]">{updatedCaption}</p>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
        <div className="flex flex-col gap-6 xl:col-span-8">
          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                <Info className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Retention and storage
                </h2>
                <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                  How long export files and run records stay available.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  File retention
                </p>
                <div className="flex flex-wrap items-end gap-3">
                  <NumberStepper
                    value={draft.fileRetentionValue}
                    min={1}
                    max={3650}
                    ariaLabel="File retention value"
                    onChange={(next) => {
                      patchDraft({ fileRetentionValue: next });
                    }}
                  />
                  <div className="min-w-[120px] flex-1">
                    <DropdownField
                      label={<span className="sr-only">Retention unit</span>}
                      labelId={unitLabelId}
                      open={unitOpen}
                      onToggle={() => {
                        setUnitOpen((open) => !open);
                      }}
                      triggerContent={
                        <span className="flex w-full items-center gap-2 text-[13px]">
                          <span className="flex-1 text-left">
                            {unitLabel(draft.fileRetentionUnit)}
                          </span>
                        </span>
                      }
                      panelAriaLabel="Retention unit options"
                    >
                      <div className="p-1.5" role="listbox">
                        {(
                          [
                            ["days", "Days"],
                            ["hours", "Hours"],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            role="option"
                            aria-selected={draft.fileRetentionUnit === value}
                            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                            onClick={() => {
                              patchDraft({ fileRetentionUnit: value });
                              setUnitOpen(false);
                            }}
                          >
                            {draft.fileRetentionUnit === value ? (
                              <Check className="h-3.5 w-3.5" aria-hidden="true" />
                            ) : (
                              <span className="w-3.5" />
                            )}
                            {label}
                          </button>
                        ))}
                      </div>
                    </DropdownField>
                  </div>
                </div>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  After this, the file is deleted. The run record and its parameters stay for audit.
                </p>
              </div>

              <div className="space-y-2">
                <DropdownField
                  label={
                    <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                      Run record retention
                    </span>
                  }
                  labelId={runRecordLabelId}
                  open={runRecordOpen}
                  onToggle={() => {
                    setRunRecordOpen((open) => !open);
                  }}
                  triggerContent={
                    <span className="flex w-full items-center gap-2 text-[13px]">
                      <span className="flex-1 text-left">
                        {runRecordLabel(draft.runRecordRetention)}
                      </span>
                    </span>
                  }
                  panelAriaLabel="Run record retention options"
                >
                  <div className="p-1.5" role="listbox">
                    {RUN_RECORD_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        role="option"
                        aria-selected={draft.runRecordRetention === option.value}
                        className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                        onClick={() => {
                          patchDraft({ runRecordRetention: option.value });
                          setRunRecordOpen(false);
                        }}
                      >
                        {draft.runRecordRetention === option.value ? (
                          <Check className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : (
                          <span className="w-3.5" />
                        )}
                        {option.label}
                      </button>
                    ))}
                  </div>
                </DropdownField>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="max-rows-per-export"
                  className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase"
                >
                  Max rows per export
                </label>
                <input
                  id="max-rows-per-export"
                  type="number"
                  min={1000}
                  max={10_000_000}
                  step={1000}
                  className={`${fieldClassName} font-mono`}
                  value={draft.maxRowsPerExport}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (!Number.isFinite(next)) return;
                    patchDraft({
                      maxRowsPerExport: Math.min(10_000_000, Math.max(1000, Math.trunc(next))),
                    });
                  }}
                />
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  Exports that would exceed this limit fail before writing a file.
                </p>
              </div>

              <div className="space-y-2">
                <p className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Max concurrent per admin
                </p>
                <NumberStepper
                  value={draft.maxConcurrentPerAdmin}
                  min={1}
                  max={20}
                  ariaLabel="Max concurrent exports per admin"
                  onChange={(next) => {
                    patchDraft({ maxConcurrentPerAdmin: next });
                  }}
                />
              </div>
            </div>

            <div className="mt-5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
              <p className="text-sm text-[var(--admin-on-surface)]">
                {storage.filesStoredCount.toLocaleString()} file
                {storage.filesStoredCount === 1 ? "" : "s"} stored (
                {formatBytes(storage.estimatedBytes)}).{" "}
                {storage.expiringSoonCount > 0
                  ? `${storage.expiringSoonCount.toLocaleString()} expiring soon. `
                  : null}
                {storage.expiredCount > 0
                  ? `${storage.expiredCount.toLocaleString()} already expired.`
                  : "No expired files waiting for purge."}
              </p>
              <div className="mt-3">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  disabled={storage.expiredCount <= 0 || purging}
                  onClick={onRequestPurge}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Delete expired files now
                </button>
                {storage.expiredCount > 0 ? (
                  <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                    Frees about{" "}
                    <span className="font-mono text-[var(--admin-on-surface)]">
                      {formatBytes(storage.purgeFreesEstimatedBytes)}
                    </span>{" "}
                    of storage.
                  </p>
                ) : null}
              </div>
            </div>
          </section>

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                <Shield className="h-4 w-4" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Access and behavior
                </h2>
                <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                  Who can run and download exports, and how sensitive delivery behaves.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <p className="mb-2 font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Roles that can run exports
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {draft.runExportRoleKeys.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-1 pr-1.5 pl-3 text-[12px] font-medium text-[var(--admin-on-surface)]"
                    >
                      {roleNameByKey.get(key) ?? key}
                      <button
                        type="button"
                        aria-label={`Remove ${roleNameByKey.get(key) ?? key}`}
                        onClick={() => {
                          removeRole(key);
                        }}
                        className="rounded-full p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </span>
                  ))}
                  {addableRoles.length > 0 ? (
                    <div className="min-w-[160px]">
                      <DropdownField
                        label={<span className="sr-only">Add role</span>}
                        labelId={addRoleLabelId}
                        open={addRoleOpen}
                        onToggle={() => {
                          setAddRoleOpen((open) => !open);
                        }}
                        triggerContent={
                          <span className="flex w-full items-center gap-2 text-[13px]">
                            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                            <span className="flex-1 text-left">Add role</span>
                          </span>
                        }
                        panelAriaLabel="Available roles"
                      >
                        <div className="p-1.5" role="listbox">
                          {addableRoles.map((role) => (
                            <button
                              key={role.key}
                              type="button"
                              role="option"
                              aria-selected={false}
                              className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                              onClick={() => {
                                addRole(role.key);
                              }}
                            >
                              {role.name}
                            </button>
                          ))}
                        </div>
                      </DropdownField>
                    </div>
                  ) : null}
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                  Download access
                </legend>
                <div className="space-y-2">
                  {DOWNLOAD_ACCESS_OPTIONS.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
                        draft.downloadAccess === option.value
                          ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                          : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:bg-[var(--admin-surface-low)]"
                      }`}
                    >
                      <input
                        type="radio"
                        name="downloadAccess"
                        className="mt-1"
                        checked={draft.downloadAccess === option.value}
                        onChange={() => {
                          patchDraft({ downloadAccess: option.value });
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          {option.label}
                        </span>
                        <span className="mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                          {option.hint}
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div className="divide-y divide-[var(--admin-border)] rounded-lg border border-[var(--admin-border)]">
                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Require reason for PII exports
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      Ask operators to document why personal data is included.
                    </p>
                  </div>
                  <PolicyToggle
                    id={reasonToggleId}
                    label="Require reason for PII exports"
                    checked={draft.requireReasonForPii}
                    onChange={(next) => {
                      patchDraft({ requireReasonForPii: next });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Allow external destinations
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      Permit scheduling exports to external email, webhook, or storage targets.
                    </p>
                    {draft.allowExternalDestinations ? (
                      <p className="mt-1 inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] px-2 py-1 text-xs text-[var(--admin-warning)]">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Data can leave the protected console boundary
                        {externalDestinationCount > 0
                          ? ` (${externalDestinationCount.toLocaleString()} active destination${externalDestinationCount === 1 ? "" : "s"})`
                          : ""}
                        .
                      </p>
                    ) : externalDestinationCount > 0 ? (
                      <p className="mt-1 text-xs text-[var(--admin-warning)]">
                        {externalDestinationCount.toLocaleString()} existing external destination
                        {externalDestinationCount === 1 ? "" : "s"} may stop receiving new
                        deliveries while this is off.
                      </p>
                    ) : null}
                  </div>
                  <PolicyToggle
                    id={externalToggleId}
                    label="Allow external destinations"
                    checked={draft.allowExternalDestinations}
                    onChange={(next) => {
                      patchDraft({ allowExternalDestinations: next });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between gap-4 px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      Watermark exports
                    </p>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      Embed requester identity into generated files when supported.
                    </p>
                  </div>
                  <PolicyToggle
                    id={watermarkToggleId}
                    label="Watermark exports"
                    checked={draft.watermarkExports}
                    onChange={(next) => {
                      patchDraft({ watermarkExports: next });
                    }}
                  />
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6 xl:col-span-4">
          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-4">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Personal data masking
              </h2>
              <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                Default treatment when a report exposes personal fields.
              </p>
            </div>

            {!isNarrow ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[320px] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] text-[10px] font-medium tracking-wide text-[var(--admin-on-surface-variant)] uppercase">
                      <th className="pb-2 pr-2 font-medium">Field</th>
                      <th className="pb-2 pr-2 font-medium">Treatment</th>
                      <th className="pb-2 font-medium">Example</th>
                    </tr>
                  </thead>
                  <tbody>
                    {personalDataFields.map((field) => {
                      const treatment = draft.personalDataTreatments[field.key];
                      const open = treatmentOpenKey === field.key;
                      return (
                        <tr key={field.key} className="border-b border-[var(--admin-border)]">
                          <td className="py-3 pr-2 align-top">
                            <p className="font-medium text-[var(--admin-on-surface)]">
                              {field.label}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {field.exposedByReports.map((report) => (
                                <span
                                  key={report}
                                  className="rounded bg-[var(--admin-surface-low)] px-1.5 py-0.5 text-[10px] text-[var(--admin-on-surface-variant)]"
                                >
                                  {report}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="py-3 pr-2 align-top">
                            <DropdownField
                              label={<span className="sr-only">{field.label} treatment</span>}
                              labelId={`treatment-${field.key}`}
                              open={open}
                              onToggle={() => {
                                setTreatmentOpenKey((current) =>
                                  current === field.key ? null : field.key,
                                );
                              }}
                              triggerContent={
                                <span className="flex w-full items-center gap-2 text-[13px]">
                                  <span className="flex-1 text-left">
                                    {treatmentLabel(treatment)}
                                  </span>
                                </span>
                              }
                              panelAriaLabel={`${field.label} treatment options`}
                              portalZIndex={90}
                            >
                              <div className="p-1.5" role="listbox">
                                {TREATMENT_OPTIONS.map((option) => (
                                  <button
                                    key={option.value}
                                    type="button"
                                    role="option"
                                    aria-selected={treatment === option.value}
                                    className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                                    onClick={() => {
                                      setTreatment(field.key, option.value);
                                    }}
                                  >
                                    {treatment === option.value ? (
                                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                    ) : (
                                      <span className="w-3.5" />
                                    )}
                                    {option.label}
                                  </button>
                                ))}
                              </div>
                            </DropdownField>
                          </td>
                          <td className="py-3 align-top font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                            {treatment === "exclude"
                              ? "-"
                              : treatment === "include"
                                ? "As stored"
                                : (field.maskExample ?? "-")}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {personalDataFields.map((field) => {
                  const treatment = draft.personalDataTreatments[field.key];
                  const open = treatmentOpenKey === field.key;
                  return (
                    <div
                      key={field.key}
                      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
                    >
                      <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                        {field.label}
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {field.exposedByReports.map((report) => (
                          <span
                            key={report}
                            className="rounded bg-[var(--admin-surface)] px-1.5 py-0.5 text-[10px] text-[var(--admin-on-surface-variant)]"
                          >
                            {report}
                          </span>
                        ))}
                      </div>
                      <div className="mt-3">
                        <DropdownField
                          label={
                            <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                              Treatment
                            </span>
                          }
                          labelId={`treatment-mobile-${field.key}`}
                          open={open}
                          onToggle={() => {
                            setTreatmentOpenKey((current) =>
                              current === field.key ? null : field.key,
                            );
                          }}
                          triggerContent={
                            <span className="flex w-full items-center gap-2 text-[13px]">
                              <span className="flex-1 text-left">{treatmentLabel(treatment)}</span>
                            </span>
                          }
                          panelAriaLabel={`${field.label} treatment options`}
                          portalZIndex={90}
                        >
                          <div className="p-1.5" role="listbox">
                            {TREATMENT_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="option"
                                aria-selected={treatment === option.value}
                                className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                                onClick={() => {
                                  setTreatment(field.key, option.value);
                                }}
                              >
                                {treatment === option.value ? (
                                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                                ) : (
                                  <span className="w-3.5" />
                                )}
                                {option.label}
                              </button>
                            ))}
                          </div>
                        </DropdownField>
                      </div>
                      <p className="mt-2 font-mono text-[12px] text-[var(--admin-on-surface-variant)]">
                        {treatment === "exclude"
                          ? "Excluded from exports"
                          : treatment === "include"
                            ? "Included as stored"
                            : `Mask example: ${field.maskExample ?? "-"}`}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Recent changes
                </h2>
                <p className="mt-0.5 text-sm text-[var(--admin-on-surface-variant)]">
                  Latest export settings activity.
                </p>
              </div>
              <Link
                href="/admin/audit"
                className="text-[12px] font-medium text-[var(--admin-primary)] hover:underline"
              >
                Full audit log
              </Link>
            </div>

            {recentAudit.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-8 text-center">
                <History
                  className="mx-auto mb-2 h-8 w-8 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                  No settings changes yet
                </p>
                <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Saves and expired-file purges will appear here.
                </p>
              </div>
            ) : (
              <ol className="relative space-y-0 border-l border-[var(--admin-border)] pl-4">
                {recentAudit.map((event) => (
                  <li key={event.id} className="relative pb-5 last:pb-0">
                    <span
                      className="absolute top-1.5 -left-[1.15rem] h-2.5 w-2.5 rounded-full border-2 border-[var(--admin-surface)] bg-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-[var(--admin-on-surface)]">{event.summary}</p>
                    <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                      {formatRelative(event.occurredAt)}
                      {event.actorName ? ` - ${event.actorName}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>

      {dirty ? (
        <div className="fixed right-0 bottom-0 left-0 z-40 border-t border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-4 py-3 backdrop-blur-sm md:left-[var(--admin-sidebar-width,0px)]">
          <div className="mx-auto flex max-w-[1600px] flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--admin-warning)]">You have unsaved export settings.</p>
            <div className="flex items-center gap-3">
              <button type="button" onClick={onDiscardDraft} className={secondaryButtonClassName}>
                Discard
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void onSave()}
                className={primaryButtonClassName}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                Save changes
              </button>
            </div>
          </div>
        </div>
      ) : null}

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

      <RetentionReductionModal
        open={retentionModalOpen}
        impact={retentionImpact}
        acknowledged={retentionAck}
        busy={saving}
        onAcknowledgeChange={setRetentionAck}
        onCancel={() => {
          if (saving) return;
          setRetentionModalOpen(false);
          setRetentionImpact(null);
          setRetentionAck(false);
        }}
        onApply={() => void persistSettings(true)}
      />

      <PurgeExpiredModal
        open={purgeModalOpen}
        expiredCount={storage.expiredCount}
        freesBytes={storage.purgeFreesEstimatedBytes}
        busy={purging}
        onCancel={() => {
          if (purging) return;
          setPurgeModalOpen(false);
        }}
        onConfirm={() => void onConfirmPurge()}
      />
    </div>
  );
}
