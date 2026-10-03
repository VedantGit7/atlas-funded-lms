"use client";

import { useId, type ReactNode } from "react";
import { Check, Loader2 } from "lucide-react";
import { generalSettingsFooterClassName } from "../general-settings/general-settings-shared";

const sectionTitleClassName = "text-base font-bold text-[var(--admin-on-surface)]";
const sectionDescClassName = "mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]";
const fieldLabelClassName = "text-sm font-bold text-[var(--admin-on-surface)]";
const inputClassName =
  "w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3.5 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-all placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30";

export function SettingsSectionHeading({
  title,
  description,
}: {
  title: string;
  description?: ReactNode;
}) {
  return (
    <div>
      <h2 className={sectionTitleClassName}>{title}</h2>
      {description ? <p className={sectionDescClassName}>{description}</p> : null}
    </div>
  );
}

/** Small green check box reused by checkbox controls (matches the security screens). */
function CheckBox({ checked }: { checked: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border motion-safe:transition-colors motion-safe:duration-200",
        "peer-focus-visible:ring-2 peer-focus-visible:ring-[var(--admin-primary)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[var(--admin-bg)]",
        checked
          ? "border-[var(--admin-success)] bg-[var(--admin-success)] text-[var(--admin-on-success)]"
          : "border-[var(--admin-success)] bg-transparent",
      ].join(" ")}
    >
      {checked ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" /> : null}
    </span>
  );
}

export function SettingCheckbox({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  variant = "card",
}: {
  title: string;
  description: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  variant?: "card" | "bare";
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-start gap-3.5",
        variant === "card"
          ? "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm motion-safe:transition-colors motion-safe:duration-200 hover:border-[var(--admin-outline)]"
          : "",
        disabled ? "cursor-not-allowed opacity-60" : "",
      ].join(" ")}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
        className="peer sr-only"
      />
      <CheckBox checked={checked} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">{title}</span>
        <span className="mt-1 block text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </span>
      </span>
    </label>
  );
}

export function SettingToggleCard({
  title,
  description,
  checked,
  onChange,
  disabled = false,
}: {
  title: string;
  description: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--admin-on-surface)]">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {description}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={() => {
          onChange(!checked);
        }}
        className={[
          "relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)] disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-[var(--admin-success)]" : "bg-[var(--admin-surface-high)]",
        ].join(" ")}
      >
        <span
          aria-hidden="true"
          className={[
            "inline-block h-5 w-5 transform rounded-full bg-[var(--admin-surface)] shadow-sm motion-safe:transition-transform motion-safe:duration-200",
            checked ? "translate-x-[22px]" : "translate-x-0.5",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export function SettingNumberField({
  value,
  onChange,
  suffix,
  min = 0,
  max,
  disabled = false,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  min?: number;
  max?: number;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="numeric"
        value={Number.isNaN(value) ? "" : value}
        min={min}
        max={max}
        disabled={disabled}
        aria-label={ariaLabel}
        onChange={(event) => {
          const next = event.target.value === "" ? min : Number(event.target.value);
          onChange(Number.isNaN(next) ? min : next);
        }}
        className={`${inputClassName} pr-24 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none`}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-on-surface-variant)]">
        {suffix}
      </span>
    </div>
  );
}

export function SettingTextField({
  label,
  value,
  onChange,
  required = false,
  placeholder,
  type = "text",
  disabled = false,
  error,
  suffix,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: "text" | "email";
  disabled?: boolean;
  error?: string | null;
  suffix?: string;
}) {
  const id = useId();
  return (
    <div className="space-y-2">
      <label htmlFor={id} className={fieldLabelClassName}>
        {label}
        {required ? <span className="text-[var(--admin-danger)]">*</span> : null}
      </label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={error ? true : undefined}
          onChange={(event) => {
            onChange(event.target.value);
          }}
          className={[
            inputClassName,
            suffix ? "pr-28" : "",
            error
              ? "border-[var(--admin-danger)] focus:border-[var(--admin-danger)] focus:ring-[var(--admin-danger)]/30"
              : "",
          ].join(" ")}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-[var(--admin-on-surface-variant)]">
            {suffix}
          </span>
        ) : null}
      </div>
      {error ? <p className="text-xs font-medium text-[var(--admin-danger)]">{error}</p> : null}
    </div>
  );
}

export function SettingsNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-xs leading-relaxed text-[var(--admin-on-surface-variant)]">
      {children}
    </p>
  );
}

export function SettingsSaveFooter({
  dirty,
  saving,
  onSave,
  onCancel,
  status,
  error,
}: {
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  status?: string | null;
  error?: string | null;
}) {
  return (
    <>
      {status ? (
        <p role="status" className="mt-6 text-sm font-medium text-[var(--admin-success)]">
          {status}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-6 text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}
      <div className={generalSettingsFooterClassName}>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={onSave}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-6 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-md transition-all hover:opacity-90 motion-safe:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[var(--admin-surface-high)] disabled:text-[var(--admin-on-surface-variant)] disabled:opacity-100 disabled:shadow-none"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          Save
        </button>
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={onCancel}
          className="rounded-lg border border-[var(--admin-border)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </>
  );
}
