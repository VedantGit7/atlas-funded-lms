"use client";

import { useId, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { AccountDropdownField, accountDropdownItemClassName } from "./account-form-dropdown";
import { useAccountTheme } from "./account-theme-context";

/** Bare on/off switch matching the settings theme tokens. */
export function SettingsSwitch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  const { classes } = useAccountTheme();
  return (
    <label
      className={`relative inline-flex shrink-0 items-center ${
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"
      }`}
    >
      <input
        type="checkbox"
        className={classes.checkbox}
        checked={checked}
        disabled={disabled}
        aria-label={label}
        onChange={(event) => {
          onChange(event.target.checked);
        }}
      />
      <span
        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
          checked ? classes.toggleTrackOn : classes.toggleTrackOff
        }`}
      >
        <span
          className={`${classes.toggleKnob} ${checked ? "translate-x-4" : "translate-x-0.5"}`}
        />
      </span>
    </label>
  );
}

/** A full labeled row (title + description + trailing switch) for a panel list. */
export function SettingsToggleRow({
  title,
  description,
  checked,
  onChange,
  disabled = false,
  icon: Icon,
}: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-4">
      <div className="flex min-w-0 items-start gap-3">
        {Icon ? (
          <Icon
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--acct-on-surface-variant)]"
            aria-hidden="true"
          />
        ) : null}
        <div className="min-w-0">
          <p className="text-sm font-medium text-[var(--acct-on-surface)]">{title}</p>
          {description ? (
            <p className="mt-0.5 text-xs leading-relaxed text-[var(--acct-on-surface-variant)]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <SettingsSwitch checked={checked} onChange={onChange} label={title} disabled={disabled} />
    </div>
  );
}

export type SettingsSelectOption = { value: string; label: string };

/** Self-contained animated dropdown select built on the account dropdown portal. */
export function SettingsSelectField({
  value,
  onChange,
  options,
  ariaLabel,
  placeholder = "Select",
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly SettingsSelectOption[];
  ariaLabel: string;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const selected = options.find((option) => option.value === value);

  return (
    <AccountDropdownField
      label={ariaLabel}
      labelId={labelId}
      open={open}
      disabled={disabled}
      onToggle={() => {
        setOpen((current) => !current);
      }}
      triggerContent={selected?.label ?? placeholder}
      panelAriaLabel={ariaLabel}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="option"
          aria-selected={option.value === value}
          className={accountDropdownItemClassName}
          onClick={() => {
            onChange(option.value);
            setOpen(false);
          }}
        >
          {option.label}
        </button>
      ))}
    </AccountDropdownField>
  );
}
