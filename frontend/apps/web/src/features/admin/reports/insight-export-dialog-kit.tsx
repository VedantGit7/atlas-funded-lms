"use client";

import { useId, useState, type ReactNode } from "react";
import { AlertTriangle, Calendar, Loader2, X } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { PolicyToggle } from "./report-exports-kit";
import type { NewExportForm } from "./use-new-export-form";

/*
 * The parts of the insights look for new-export dialogs (Live class
 * attendance, Resource usage, Super live insights, Zoom insights): dataset
 * cards, small uppercase section labels, dropdown pickers and a schedule card.
 */

export const insightFieldLabelClassName =
  "mb-1 block text-[12px] text-[var(--admin-on-surface-variant)]";

export const insightInputClassName =
  "h-10 w-full rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] px-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]";

export const insightCheckboxClassName =
  "h-4 w-4 rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]";

/** The modal around an insights new-export form. */
export function InsightDialogFrame({
  subtitle,
  saving,
  error,
  onClose,
  onSubmit,
  children,
}: {
  /** A line under the title, such as how many rows the export will produce. */
  subtitle?: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-[2px] sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[90vh] w-full max-w-[840px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_12px_48px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)] motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              New export
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-[12px] text-[var(--admin-on-surface-variant)]">
                {subtitle}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            disabled={saving}
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-8 overflow-y-auto bg-[var(--admin-bg)] p-6">
          {children}
          {error ? (
            <p className="text-sm text-[var(--admin-danger)]" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4">
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className={`${ghostButtonClassName} h-10`}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={onSubmit}
            className={`${primaryButtonClassName} h-10 gap-2`}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create export
          </button>
        </div>
      </div>
    </div>
  );
}

export function InsightDialogSection({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
          {title}
        </h3>
        {action}
      </div>
      {children}
    </section>
  );
}

/** A bordered panel inside a section, holding its fields. */
export function InsightPanel({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      {children}
    </div>
  );
}

export type InsightDatasetOption<TDataset extends string> = {
  value: TDataset;
  label: string;
  description: string;
};

const DATASET_GRID: Record<2 | 3 | 4, string> = {
  2: "md:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "md:grid-cols-4",
};

export function InsightDatasetCards<TDataset extends string>({
  options,
  value,
  onChange,
  available = () => true,
  columns,
  detail,
}: {
  options: Array<InsightDatasetOption<TDataset>>;
  value: TDataset;
  onChange: (next: TDataset) => void;
  /** False greys a card out and stops it being picked. */
  available?: (dataset: TDataset) => boolean;
  columns: 2 | 3 | 4;
  /** A line under the selected card, such as its row estimate. */
  detail?: string | null;
}) {
  return (
    <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${DATASET_GRID[columns]}`}>
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={!available(option.value)}
            onClick={() => {
              onChange(option.value);
            }}
            className={`rounded-lg border p-3 text-left transition-colors disabled:opacity-40 ${
              selected
                ? "border-2 border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)]"
            }`}
          >
            <span
              className={`block text-sm font-semibold ${
                selected ? "text-[var(--admin-primary)]" : "text-[var(--admin-on-surface)]"
              }`}
            >
              {option.label}
            </span>
            <span
              className={`mt-1 block text-[12px] ${
                selected
                  ? "text-[color-mix(in_srgb,var(--admin-primary)_80%,var(--admin-on-surface))]"
                  : "text-[var(--admin-on-surface-variant)]"
              }`}
            >
              {option.description}
            </span>
            {selected && detail ? (
              <span className="mt-2 block text-[11px] text-[var(--admin-on-surface-variant)]">
                {detail}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** A labelled dropdown picker with the shared panel motion. */
export function InsightDropdown<TValue extends string>({
  label,
  value,
  options,
  onChange,
  icon,
}: {
  label: string;
  value: TValue;
  options: ReadonlyArray<readonly [TValue, string]>;
  onChange: (next: TValue) => void;
  icon?: ReactNode;
}) {
  const labelId = useId();
  const [open, setOpen] = useState(false);
  const current = options.find(([option]) => option === value)?.[1] ?? value;
  return (
    <DropdownField
      label={<span className="text-[12px]">{label}</span>}
      labelId={labelId}
      open={open}
      onToggle={() => {
        setOpen((state) => !state);
      }}
      portalZIndex={85}
      leftIcon={icon}
      triggerContent={<span className="text-sm">{current}</span>}
      panelAriaLabel={label}
    >
      <div className="p-1.5" role="listbox">
        {options.map(([option, optionLabel]) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={value === option}
            className={dropdownItemClassName}
            onClick={() => {
              onChange(option);
              setOpen(false);
            }}
          >
            {optionLabel}
          </button>
        ))}
      </div>
    </DropdownField>
  );
}

export type InsightColumnOption<TColumn extends string> = {
  value: TColumn;
  label: string;
  pii?: boolean;
};

/** The column checklist: one grid, or titled groups side by side. */
export function InsightColumnSection<TColumn extends string>({
  groups,
  selected,
  onToggle,
  onSelectAll,
  children,
}: {
  groups: Array<{ title?: string; options: Array<InsightColumnOption<TColumn>> }>;
  selected: readonly TColumn[];
  onToggle: (column: TColumn) => void;
  onSelectAll: () => void;
  /** Notes under the checklist. */
  children?: ReactNode;
}) {
  const grouped = groups.length > 1;
  return (
    <InsightDialogSection
      title="Columns"
      action={
        <button
          type="button"
          onClick={onSelectAll}
          className="text-[12px] font-medium text-[var(--admin-primary)] hover:underline"
        >
          Select all
        </button>
      }
    >
      <InsightPanel>
        <div className={grouped ? "grid grid-cols-1 gap-6 md:grid-cols-2" : ""}>
          {groups.map((group, index) => (
            <div key={group.title ?? index}>
              {group.title ? (
                <p className="mb-3 text-[11px] font-semibold tracking-[0.06em] text-[var(--admin-on-surface-variant)] uppercase">
                  {group.title}
                </p>
              ) : null}
              <div
                className={
                  grouped
                    ? "flex flex-col gap-3"
                    : "grid grid-cols-1 gap-x-8 gap-y-3 md:grid-cols-2"
                }
              >
                {group.options.map((option) => {
                  const checked = selected.includes(option.value);
                  return (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          onToggle(option.value);
                        }}
                        className={insightCheckboxClassName}
                      />
                      <span
                        className={`font-mono text-[13px] ${
                          checked
                            ? "text-[var(--admin-on-surface)]"
                            : "text-[var(--admin-on-surface-variant)]"
                        }`}
                      >
                        {option.label}
                      </span>
                      {option.pii ? (
                        <span
                          title="Contains learner personal data"
                          className="inline-flex items-center gap-1 rounded-sm border border-[color-mix(in_srgb,var(--admin-warning)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-[var(--admin-warning)] uppercase"
                        >
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                          PII
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </InsightPanel>
      {children}
    </InsightDialogSection>
  );
}

export function InsightFormatSection<TFormat extends string>({
  formats,
  value,
  onChange,
}: {
  formats: readonly TFormat[];
  value: TFormat;
  onChange: (next: TFormat) => void;
}) {
  return (
    <InsightDialogSection title="Format">
      <div className="flex overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {formats.map((format, index) => (
          <button
            key={format}
            type="button"
            aria-pressed={value === format}
            onClick={() => {
              onChange(format);
            }}
            className={`flex-1 py-2 text-[13px] transition-colors ${
              index < formats.length - 1 ? "border-r border-[var(--admin-border)]" : ""
            } ${
              value === format
                ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] font-semibold text-[var(--admin-primary)]"
                : "text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
            }`}
          >
            {format.toUpperCase()}
          </button>
        ))}
      </div>
    </InsightDialogSection>
  );
}

type InsightDelivery = "download" | "email_me" | "send_recipients";

/** Download now, email me, or (where offered) send to recipients with an optional webhook. */
export function InsightDeliverySection<TDelivery extends InsightDelivery>({
  form,
  emailEnabled,
  recipients = true,
  webhook = false,
}: {
  form: Pick<
    NewExportForm<string, TDelivery, string>,
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
  emailEnabled: boolean;
  /** Offers sending to a list of addresses. */
  recipients?: boolean;
  /** Offers a webhook URL alongside the recipients. */
  webhook?: boolean;
}) {
  const name = useId();
  const options = [
    ["download", "Download now"],
    ["email_me", "Email me when ready"],
    ...(recipients ? [["send_recipients", "Send to recipients"]] : []),
  ] as Array<[TDelivery, string]>;
  return (
    <InsightDialogSection title="Delivery">
      <div className="flex flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        {options.map(([value, label]) => {
          const disabled = value !== "download" && !emailEnabled;
          return (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 ${disabled ? "opacity-40" : ""}`}
            >
              <input
                type="radio"
                name={name}
                checked={form.delivery === value}
                disabled={disabled}
                onChange={() => {
                  form.setDelivery(value);
                }}
                className="h-4 w-4 border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
              />
              <span className="text-sm text-[var(--admin-on-surface)]">{label}</span>
            </label>
          );
        })}
        {form.delivery === "send_recipients" ? (
          <div className="space-y-4 border-t border-[var(--admin-border)] pt-4">
            <div>
              <span className={`${insightFieldLabelClassName} mb-2`}>Recipients</span>
              <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-bg)] p-2 focus-within:border-[var(--admin-primary)]">
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
              <div>
                <label className={insightFieldLabelClassName}>Webhook URL (optional)</label>
                <input
                  type="url"
                  value={form.webhookUrl}
                  onChange={(event) => {
                    form.setWebhookUrl(event.target.value);
                  }}
                  placeholder="https://"
                  className={`${insightInputClassName} font-mono text-[13px]`}
                />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </InsightDialogSection>
  );
}

const CADENCE_OPTIONS = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["monthly", "Monthly"],
] as const;

/** The schedule card: the switch, and when on, a name, cadence, time and timezone. */
export function InsightScheduleSection<TCadence extends "daily" | "weekly" | "monthly">({
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
  namePlaceholder: string;
}) {
  return (
    <section className="flex flex-col gap-3 pb-2">
      <div className="flex items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
        <div className="flex items-center gap-3">
          <Calendar className="h-5 w-5 text-[var(--admin-on-surface-variant)]" />
          <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
            Schedule this export
          </span>
        </div>
        <PolicyToggle
          checked={form.scheduleEnabled}
          onChange={form.setScheduleEnabled}
          label="Schedule this export"
        />
      </div>
      {form.scheduleEnabled ? (
        <div className="grid gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 sm:grid-cols-3">
          <div className="sm:col-span-3">
            <label className={insightFieldLabelClassName}>Schedule name</label>
            <input
              type="text"
              value={form.scheduleName}
              onChange={(event) => {
                form.setScheduleName(event.target.value);
              }}
              placeholder={namePlaceholder}
              className={insightInputClassName}
            />
          </div>
          <InsightDropdown
            label="Cadence"
            value={form.cadence}
            options={CADENCE_OPTIONS as unknown as ReadonlyArray<readonly [TCadence, string]>}
            onChange={form.setCadence}
          />
          <div>
            <label className={insightFieldLabelClassName}>Time</label>
            <input
              type="time"
              value={form.time}
              onChange={(event) => {
                form.setTime(event.target.value);
              }}
              className={insightInputClassName}
            />
          </div>
          <div>
            <label className={insightFieldLabelClassName}>Timezone</label>
            <input
              type="text"
              value={form.timezone}
              onChange={(event) => {
                form.setTimezone(event.target.value);
              }}
              className={insightInputClassName}
            />
          </div>
        </div>
      ) : null}
    </section>
  );
}
