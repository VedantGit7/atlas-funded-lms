"use client";

import { useId, type ReactNode } from "react";
import { AlertTriangle, Download, Info, Loader2, X } from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { PolicyToggle } from "./report-exports-kit";
import type { NewExportForm } from "./use-new-export-form";

/*
 * The parts the standard new-export dialog is built from: the frame, sections,
 * dataset pills, column checklist, filters, grouping, format, delivery and
 * schedule fields. Each report's dialog arranges them around its own scope.
 */

export const exportFieldLabelClassName =
  "text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase";

export const exportInputClassName =
  "h-10 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 font-mono text-[13px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)]";

export const exportSelectTriggerClassName =
  "h-10 w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

export const exportCheckboxClassName =
  "h-4 w-4 rounded-sm border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:cursor-not-allowed";

export const EXPORT_CADENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

export const EXPORT_TIMEZONE_OPTIONS = [
  { value: "UTC", label: "UTC" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
  { value: "America/New_York", label: "America/New_York" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles" },
  { value: "Europe/London", label: "Europe/London" },
];

/** "Weekly Batch summary export": the name a schedule gets when the dialog does not ask for one. */
export function defaultScheduleName(cadence: string, subject: string): string {
  const prefix = cadence === "daily" ? "Daily" : cadence === "weekly" ? "Weekly" : "Monthly";
  return `${prefix} ${subject} export`;
}

/** The modal around a new-export form, with its Cancel and create buttons. */
export function ExportDialogFrame({
  title = "New export",
  submitLabel = "Create export",
  saving,
  submitDisabled = false,
  error,
  onClose,
  onSubmit,
  children,
}: {
  title?: string;
  submitLabel?: string;
  saving: boolean;
  submitDisabled?: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[800px] flex-col overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6">
          <h2
            id={titleId}
            className="text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]"
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-8 overflow-y-auto p-6">
          {children}
          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex h-[72px] shrink-0 items-center justify-end gap-4 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
          <button type="button" onClick={onClose} className={`${ghostButtonClassName} h-10`}>
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={saving || submitDisabled}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <Download className="h-4 w-4" aria-hidden="true" />
            )}
            {submitLabel}
          </button>
        </footer>
      </div>
    </div>
  );
}

export function ExportDialogSection({
  title,
  action,
  children,
}: {
  title: string;
  /** Shown at the right of the heading, such as a Select all link. */
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A labelled field in a dialog: the small uppercase label over its control. */
export function ExportField({
  label,
  className = "",
  children,
}: {
  label: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-2 ${className}`}>
      <span className={exportFieldLabelClassName}>{label}</span>
      {children}
    </label>
  );
}

export function ExportDatasetPills<TDataset extends string>({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: TDataset; label: string }>;
  value: TDataset;
  onChange: (next: TDataset) => void;
}) {
  return (
    <ExportDialogSection title="Dataset">
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => {
              onChange(option.value);
            }}
            className={`rounded-sm border px-3 py-2 text-sm font-medium transition-colors ${
              value === option.value
                ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-outline)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </ExportDialogSection>
  );
}

export type ExportColumnBadge = "pii" | "sensitive" | null;

/** The column checklist, with a Select all link and badges for personal or sensitive data. */
export function ExportColumnChecklist({
  columns,
  selected,
  onToggle,
  onSelectAll,
  badgeFor,
  warning,
}: {
  columns: Array<{ key: string; label: string }>;
  selected: ReadonlySet<string>;
  onToggle: (key: string) => void;
  onSelectAll: () => void;
  badgeFor: (key: string) => ExportColumnBadge;
  /** A note above the list, shown while a column that needs care is selected. */
  warning?: string | null;
}) {
  return (
    <ExportDialogSection
      title="Columns"
      action={
        <button
          type="button"
          className="text-sm text-[var(--admin-primary)] hover:underline"
          onClick={onSelectAll}
        >
          Select all
        </button>
      }
    >
      {warning ? (
        <div className="mb-3 flex items-start gap-2 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-warning)]">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{warning}</span>
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-x-8 gap-y-3 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:grid-cols-2">
        {columns.map((column) => {
          const badge = badgeFor(column.key);
          return (
            <label
              key={column.key}
              className="group flex cursor-pointer items-start justify-between gap-3"
              title={badge === "pii" ? "Contains learner personal data" : undefined}
            >
              <span className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={selected.has(column.key)}
                  onChange={() => {
                    onToggle(column.key);
                  }}
                  className={exportCheckboxClassName}
                />
                <span className="text-sm text-[var(--admin-on-surface)] group-hover:text-[var(--admin-primary)]">
                  {column.label}
                </span>
              </span>
              {badge === "pii" ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-warning)] uppercase">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  PII
                </span>
              ) : badge === "sensitive" ? (
                <span className="inline-flex items-center gap-1 rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 text-[11px] font-semibold tracking-wide text-[var(--admin-danger)] uppercase">
                  <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
                  Sensitive
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
    </ExportDialogSection>
  );
}

/** The Filters section: what the export will be scoped to, and the switch to apply it. */
export function ExportFiltersSection({
  summary,
  useCurrentFilters,
  onUseCurrentFiltersChange,
  children,
}: {
  summary: string;
  useCurrentFilters: boolean;
  onUseCurrentFiltersChange: (next: boolean) => void;
  /** Further filter fields under the summary. */
  children?: ReactNode;
}) {
  return (
    <ExportDialogSection title="Filters">
      <div className="flex flex-col gap-4 rounded-sm border border-[var(--admin-border)] p-4 sm:flex-row sm:items-center sm:justify-between">
        {useCurrentFilters ? (
          <div>
            <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">{summary}</div>
            <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              Export will be scoped to these filters.
            </p>
          </div>
        ) : (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Export will include all rows for the selected dataset.
          </p>
        )}
        <label className="flex shrink-0 items-center gap-3">
          <span className="text-sm text-[var(--admin-on-surface)]">Use current filters</span>
          <PolicyToggle
            checked={useCurrentFilters}
            onChange={onUseCurrentFiltersChange}
            label="Use current filters"
          />
        </label>
      </div>
      {children}
    </ExportDialogSection>
  );
}

export function ExportGroupingSection<TGrouping extends string>({
  options,
  grouping,
  onGroupingChange,
  includeSubtotals,
  onIncludeSubtotalsChange,
}: {
  options: Array<{ value: TGrouping; label: string }>;
  grouping: TGrouping;
  onGroupingChange: (next: TGrouping) => void;
  includeSubtotals: boolean;
  onIncludeSubtotalsChange: (next: boolean) => void;
}) {
  const ungrouped = grouping === "none";
  return (
    <ExportDialogSection title="Grouping">
      <div className="space-y-3 rounded-sm border border-[var(--admin-border)] p-4">
        <ExportField label="Group by">
          <Select
            value={grouping}
            onValueChange={(value) => {
              const next = value as TGrouping;
              onGroupingChange(next);
              if (next === "none") onIncludeSubtotalsChange(false);
            }}
            options={options}
            className={exportSelectTriggerClassName}
          />
        </ExportField>
        <label className={`flex items-center gap-3 ${ungrouped ? "opacity-50" : ""}`}>
          <input
            type="checkbox"
            checked={includeSubtotals}
            disabled={ungrouped}
            onChange={(event) => {
              onIncludeSubtotalsChange(event.target.checked);
            }}
            className={exportCheckboxClassName}
          />
          <span className="text-sm text-[var(--admin-on-surface)]">
            Include per-group subtotals
          </span>
        </label>
      </div>
    </ExportDialogSection>
  );
}

export function ExportFormatSection<TFormat extends string>({
  formats,
  value,
  onChange,
}: {
  formats: readonly TFormat[];
  value: TFormat;
  onChange: (next: TFormat) => void;
}) {
  return (
    <ExportDialogSection title="Format">
      <div className="inline-flex rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-1">
        {formats.map((format) => (
          <button
            key={format}
            type="button"
            aria-pressed={value === format}
            onClick={() => {
              onChange(format);
            }}
            className={`rounded-sm px-5 py-2 text-[12px] font-semibold tracking-[0.06em] uppercase transition-all ${
              value === format
                ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                : "text-[var(--admin-on-surface-variant)]"
            }`}
          >
            {format}
          </button>
        ))}
      </div>
    </ExportDialogSection>
  );
}

type ChipDelivery = "download" | "email_me" | "recipients";

/** Download now, email me, or send to recipients (with an optional webhook). */
export function ExportDeliverySection({
  form,
  emailEnabled = true,
  webhook,
}: {
  form: Pick<
    NewExportForm<string, ChipDelivery, string>,
    | "delivery"
    | "setDelivery"
    | "recipients"
    | "recipientInput"
    | "setRecipientInput"
    | "addRecipient"
    | "removeRecipient"
    | "webhookUrl"
    | "setWebhookUrl"
  >;
  /** False when the tenant cannot send email, which disables both email options. */
  emailEnabled?: boolean;
  /** Offers a webhook URL alongside the recipients. */
  webhook: boolean;
}) {
  const name = useId();
  return (
    <ExportDialogSection title="Delivery">
      <div className="space-y-3">
        {(
          [
            ["download", "Download now"],
            ["email_me", "Email me when ready"],
            ["recipients", "Send to recipients"],
          ] as const
        ).map(([value, label]) => (
          <label key={value} className="flex cursor-pointer items-center gap-3">
            <input
              type="radio"
              name={name}
              checked={form.delivery === value}
              disabled={value !== "download" && !emailEnabled}
              onChange={() => {
                form.setDelivery(value);
              }}
              className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)] disabled:opacity-50"
            />
            <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
          </label>
        ))}
        {form.delivery === "recipients" ? (
          <div className="space-y-4 pt-2 pl-7">
            <div>
              <span className={`mb-2 block ${exportFieldLabelClassName}`}>Recipients</span>
              <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2 focus-within:border-[var(--admin-primary)]">
                {form.recipients.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-1 text-xs text-[var(--admin-on-surface)]"
                  >
                    {email}
                    <button
                      type="button"
                      aria-label={`Remove ${email}`}
                      className="ml-2 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-danger)]"
                      onClick={() => {
                        form.removeRecipient(email);
                      }}
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  value={form.recipientInput}
                  onChange={(event) => {
                    form.setRecipientInput(event.target.value);
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      form.addRecipient();
                    }
                  }}
                  onBlur={form.addRecipient}
                  aria-label="Add recipient email"
                  placeholder="Add email…"
                  className="min-w-[120px] flex-1 border-none bg-transparent p-0 text-sm text-[var(--admin-on-surface)] outline-none"
                />
              </div>
            </div>
            {webhook ? (
              <ExportField label="Webhook URL (optional)">
                <input
                  value={form.webhookUrl}
                  onChange={(event) => {
                    form.setWebhookUrl(event.target.value);
                  }}
                  placeholder="https://"
                  className={`w-full ${exportInputClassName}`}
                />
              </ExportField>
            ) : null}
          </div>
        ) : null}
      </div>
    </ExportDialogSection>
  );
}

/** The Schedule section: the switch, and when on, an optional name, cadence, time and timezone. */
export function ExportScheduleSection<TCadence extends string>({
  form,
  namePlaceholder,
}: {
  form: Pick<
    NewExportForm<string, string, TCadence>,
    | "scheduleEnabled"
    | "setScheduleEnabled"
    | "scheduleName"
    | "setScheduleName"
    | "cadence"
    | "setCadence"
    | "time"
    | "setTime"
    | "timezone"
    | "setTimezone"
  >;
  /** Asks for a schedule name with this example; otherwise the name is generated. */
  namePlaceholder?: string;
}) {
  return (
    <ExportDialogSection
      title="Schedule"
      action={
        <label className="flex items-center gap-3">
          <span className="text-sm text-[var(--admin-on-surface-variant)]">
            Schedule this export
          </span>
          <PolicyToggle
            checked={form.scheduleEnabled}
            onChange={form.setScheduleEnabled}
            label="Schedule this export"
          />
        </label>
      }
    >
      {form.scheduleEnabled ? (
        <div className="space-y-4">
          {namePlaceholder ? (
            <ExportField label="Name">
              <input
                value={form.scheduleName}
                onChange={(event) => {
                  form.setScheduleName(event.target.value);
                }}
                placeholder={namePlaceholder}
                className={`${exportInputClassName} font-sans text-sm`}
              />
            </ExportField>
          ) : null}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <ExportField label="Cadence">
              <Select
                value={form.cadence}
                onValueChange={(value) => {
                  form.setCadence(value as TCadence);
                }}
                options={EXPORT_CADENCE_OPTIONS}
                className={exportSelectTriggerClassName}
              />
            </ExportField>
            <ExportField label="Time">
              <input
                type="time"
                value={form.time}
                onChange={(event) => {
                  form.setTime(event.target.value);
                }}
                className={exportInputClassName}
              />
            </ExportField>
            <ExportField label="Timezone">
              <Select
                value={form.timezone}
                onValueChange={form.setTimezone}
                options={EXPORT_TIMEZONE_OPTIONS}
                className={exportSelectTriggerClassName}
              />
            </ExportField>
          </div>
        </div>
      ) : null}
    </ExportDialogSection>
  );
}

/** The capabilities note at the foot of a dialog. */
export function ExportDialogNote({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
      <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
      <span>{children}</span>
    </div>
  );
}
