"use client";

import { ChevronLeft, CircleHelp, Calendar } from "lucide-react";
import { useRef, type ReactNode } from "react";
import { builderHelperClassName, builderTextareaClassName, fieldClassName } from "./course-builder-shared";
import {
  courseSettingsCounterTone,
  CourseSettingsFormFooter,
} from "./course-settings-shared";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { formatPricingPlanExpiryDate } from "./course-pricing-plan-settings";
import { inlineLessonGhostButtonClassName } from "./inline-lesson-editor/inline-lesson-editor-shared";
import { lessonInputClassName } from "../lessons/lesson-editor-shared";

type PricingPlanFormShellProps = {
  breadcrumbParentLabel: string;
  breadcrumbCurrentLabel: string;
  title: string;
  subtitle: string;
  error?: string | null;
  saving?: boolean;
  saveDisabled?: boolean;
  saveLabel?: string;
  disabled?: boolean;
  onBack: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
};

export function PricingPlanFormShell({
  breadcrumbParentLabel,
  breadcrumbCurrentLabel,
  title,
  subtitle,
  error,
  saving = false,
  saveDisabled = false,
  saveLabel = "Add pricing plan",
  disabled = false,
  onBack,
  onCancel,
  onSave,
  children,
}: PricingPlanFormShellProps) {
  return (
    <div className={`admin-theme flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
        <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-8 md:py-8">
          <button
            type="button"
            className={`${inlineLessonGhostButtonClassName} mb-5 gap-1.5 self-start px-2`}
            disabled={saving}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <nav aria-label="Breadcrumb" className="mb-4">
            <ol className="flex flex-wrap items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              <li>
                <button
                  type="button"
                  className="font-medium transition-colors hover:text-[var(--admin-on-surface)]"
                  disabled={saving}
                  onClick={onBack}
                >
                  {breadcrumbParentLabel}
                </button>
              </li>
              <li aria-hidden="true">/</li>
              <li className="font-semibold text-[var(--admin-on-surface)]">{breadcrumbCurrentLabel}</li>
            </ol>
          </nav>

          <header className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              {title}
            </h1>
            <p className={`${builderHelperClassName} mt-2 max-w-2xl text-sm md:text-[0.9375rem]`}>
              {subtitle}
            </p>
          </header>

          {error ? (
            <p
              role="alert"
              className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}

          <div className="min-h-0 flex-1">
            <div className="rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm md:p-6">
              {children}
            </div>
          </div>

          <CourseSettingsFormFooter
            onSave={onSave}
            onCancel={onCancel}
            saving={saving}
            saveDisabled={saveDisabled || disabled}
            cancelDisabled={disabled}
            saveLabel={saveLabel}
          />
        </div>
      </div>
    </div>
  );
}

type PricingPlanFieldLabelProps = {
  htmlFor?: string;
  required?: boolean;
  tooltip?: string;
  counter?: { current: number; max: number };
  children: ReactNode;
};

export function PricingPlanFieldLabel({
  htmlFor,
  required = false,
  tooltip,
  counter,
  children,
}: PricingPlanFieldLabelProps) {
  return (
    <div className="flex items-start justify-between gap-3">
      <label htmlFor={htmlFor} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--admin-on-surface)]">
        <span>
          {children}
          {required ? <span className="text-[var(--admin-danger)]">*</span> : null}
        </span>
        {tooltip ? (
          <span
            title={tooltip}
            className="inline-flex text-[var(--admin-on-surface-variant)]"
            aria-label={tooltip}
          >
            <CircleHelp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
          </span>
        ) : null}
      </label>
      {counter ? (
        <span
          className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(counter.current, counter.max)}`}
        >
          {counter.current}/{counter.max}
        </span>
      ) : null}
    </div>
  );
}

type PricingPlanRadioCardOption<T extends string> = {
  value: T;
  title: string;
  description: string;
};

type PricingPlanRadioCardGroupProps<T extends string> = {
  name: string;
  value: T;
  options: PricingPlanRadioCardOption<T>[];
  disabled?: boolean;
  onChange: (value: T) => void;
};

export function PricingPlanRadioCardGroup<T extends string>({
  name,
  value,
  options,
  disabled = false,
  onChange,
}: PricingPlanRadioCardGroupProps<T>) {
  return (
    <div className="space-y-3">
      {options.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition-[border-color,background-color,box-shadow] duration-200",
              selected
                ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)]",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <span
              className={[
                "relative mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                selected ? "border-[var(--admin-primary)]" : "border-[var(--admin-outline)]",
              ].join(" ")}
              aria-hidden="true"
            >
              {selected ? (
                <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                {option.title}
              </span>
              <span className={`${builderHelperClassName} mt-1 block leading-relaxed`}>
                {option.description}
              </span>
            </span>
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              disabled={disabled}
              className="sr-only"
              onChange={() => {
                onChange(option.value);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

type PricingPlanInlineRadioGroupProps<T extends string> = {
  name: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  disabled?: boolean;
  onChange: (value: T) => void;
};

export function PricingPlanInlineRadioGroup<T extends string>({
  name,
  value,
  options,
  disabled = false,
  onChange,
}: PricingPlanInlineRadioGroupProps<T>) {
  return (
    <div className="flex flex-wrap gap-5">
      {options.map((option) => (
        <label
          key={option.value}
          className={[
            "inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-[var(--admin-on-surface)]",
            disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <span
            className={[
              "relative inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              value === option.value ? "border-[var(--admin-primary)]" : "border-[var(--admin-outline)]",
            ].join(" ")}
          >
            {value === option.value ? (
              <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
            ) : null}
          </span>
          <input
            type="radio"
            name={name}
            value={option.value}
            checked={value === option.value}
            disabled={disabled}
            className="sr-only"
            onChange={() => {
              onChange(option.value);
            }}
          />
          {option.label}
        </label>
      ))}
    </div>
  );
}

export function PricingPlanTextInput({
  id,
  value,
  onChange,
  disabled,
  maxLength,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  maxLength?: number;
  placeholder?: string;
}) {
  return (
    <input
      id={id}
      className={lessonInputClassName}
      value={value}
      maxLength={maxLength}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

export function PricingPlanTextarea({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  rows = 4,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      className={builderTextareaClassName}
      rows={rows}
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

export function PricingPlanSelect({
  id,
  value,
  onChange,
  disabled,
  placeholder,
  options,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      id={id}
      className={fieldClassName}
      value={value}
      disabled={disabled}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    >
      {placeholder ? (
        <option value="">{placeholder}</option>
      ) : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function PricingPlanValidityInput({
  id,
  value,
  onChange,
  disabled,
  min = 1,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        min={min}
        className={`${lessonInputClassName} pr-16`}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Math.max(min, Number(event.target.value) || min));
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--admin-on-surface-variant)]">
        Day(s)
      </span>
    </div>
  );
}

export function PricingPlanDaysInput({
  id,
  value,
  onChange,
  disabled,
  min = 0,
}: {
  id: string;
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  min?: number;
}) {
  return (
    <div className="relative">
      <input
        id={id}
        type="number"
        min={min}
        className={`${lessonInputClassName} pr-16`}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          onChange(Math.max(min, Number(event.target.value) || min));
        }}
      />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-[var(--admin-on-surface-variant)]">
        Day(s)
      </span>
    </div>
  );
}

export function PricingPlanMoneyInput({
  id,
  valueCents,
  onChange,
  disabled,
  placeholder,
}: {
  id: string;
  valueCents: number | null;
  onChange: (valueCents: number | null) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  const displayValue =
    valueCents != null && valueCents > 0 ? (valueCents / 100).toString() : "";

  return (
    <input
      id={id}
      type="number"
      min={0}
      step="0.01"
      className={lessonInputClassName}
      value={displayValue}
      placeholder={placeholder}
      disabled={disabled}
      onChange={(event) => {
        const raw = event.target.value.trim();
        if (!raw) {
          onChange(null);
          return;
        }
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) {
          onChange(null);
          return;
        }
        onChange(Math.max(0, Math.round(parsed * 100)));
      }}
    />
  );
}

export function PricingPlanExpiryInput({
  id,
  value,
  onChange,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function openPicker() {
    if (disabled) return;

    const input = inputRef.current;
    if (!input) return;

    if (typeof input.showPicker === "function") {
      try {
        input.showPicker();
        return;
      } catch {
        // Fall through to focus/click when showPicker is blocked.
      }
    }

    input.focus();
    input.click();
  }

  return (
    <div className="relative">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openPicker}
        className={[
          lessonInputClassName,
          "flex w-full items-center pr-10 text-left transition-[border-color,box-shadow] duration-200",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
        ].join(" ")}
      >
        <span className="truncate text-[var(--admin-on-surface)]">{formatPricingPlanExpiryDate(value)}</span>
      </button>
      <Calendar
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="date"
        value={value}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="sr-only"
        onChange={(event) => {
          if (event.target.value) {
            onChange(event.target.value);
          }
        }}
      />
    </div>
  );
}

export function PricingPlanValidityModeField({
  mode,
  validityId,
  expiryId,
  validityDays,
  expiryDate,
  disabled,
  required = false,
  radioName = "pricing-plan-validity-mode",
  onModeChange,
  onValidityDaysChange,
  onExpiryDateChange,
}: {
  mode: "VALIDITY" | "EXPIRY";
  validityId: string;
  expiryId: string;
  validityDays: number;
  expiryDate: string;
  disabled?: boolean;
  required?: boolean;
  radioName?: string;
  onModeChange: (mode: "VALIDITY" | "EXPIRY") => void;
  onValidityDaysChange: (days: number) => void;
  onExpiryDateChange: (isoDate: string) => void;
}) {
  return (
    <section>
      <PricingPlanSectionTitle
        title="Choose Type Of Validity"
        tooltip="Set validity by duration or by a fixed expiry date."
        required={required}
      />
      <PricingPlanInlineRadioGroup
        name={radioName}
        value={mode}
        disabled={disabled ?? false}
        options={[
          { value: "VALIDITY", label: "Set Validity" },
          { value: "EXPIRY", label: "Set Expiry" },
        ]}
        onChange={onModeChange}
      />

      {mode === "VALIDITY" ? (
        <div className={`mt-4 space-y-2 ${inlineExpandClassName}`}>
          <PricingPlanFieldLabel htmlFor={validityId}>Validity</PricingPlanFieldLabel>
          <PricingPlanValidityInput
            id={validityId}
            value={validityDays}
            disabled={disabled ?? false}
            onChange={onValidityDaysChange}
          />
        </div>
      ) : (
        <div className={`mt-4 space-y-2 ${inlineExpandClassName}`}>
          <PricingPlanFieldLabel htmlFor={expiryId}>Expiry</PricingPlanFieldLabel>
          <PricingPlanExpiryInput
            id={expiryId}
            value={expiryDate}
            disabled={disabled ?? false}
            onChange={onExpiryDateChange}
          />
        </div>
      )}
    </section>
  );
}

export function PricingPlanSectionTitle({
  title,
  tooltip,
  required = false,
}: {
  title: string;
  tooltip?: string;
  required?: boolean;
}) {
  return (
    <div className="mb-3 flex items-center gap-1.5">
      <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
        {title}
        {required ? <span className="text-[var(--admin-danger)]">*</span> : null}
      </p>
      {tooltip ? (
        <span title={tooltip} className="text-[var(--admin-on-surface-variant)]" aria-label={tooltip}>
          <CircleHelp className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
      ) : null}
    </div>
  );
}
