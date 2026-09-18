"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { labelClassName } from "../readiness-admin-shared";

export type AdminSelectOption = {
  value: string;
  label: string;
};

type AdminSelectDropdownProps = {
  id: string;
  value: string;
  options: AdminSelectOption[];
  disabled?: boolean;
  onChange: (value: string) => void;
  /** Visible label above the trigger. Pass `null` to use screen-reader-only labeling. */
  label?: string | null;
  ariaLabel: string;
};

export function AdminSelectDropdown({
  id,
  value,
  options,
  disabled = false,
  onChange,
  label,
  ariaLabel,
}: AdminSelectDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  function closeDropdown() {
    setOpen(false);
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    closeDropdown();
  }

  const labelNode =
    label === null ? (
      <label htmlFor={id} className="sr-only">
        {ariaLabel}
      </label>
    ) : (
      <label htmlFor={id} className={labelClassName}>
        {label ?? ariaLabel}
      </label>
    );

  return (
    <DropdownField
      label={labelNode}
      labelId={id}
      open={open}
      disabled={disabled}
      onToggle={() => {
        if (disabled) return;
        setOpen((current) => !current);
      }}
      triggerContent={
        <span className="text-[var(--admin-on-surface)]">{selected?.label ?? "Select…"}</span>
      }
      panelAriaLabel={ariaLabel}
      portalZIndex={120}
    >
      <div className="max-h-60 overflow-y-auto overscroll-contain p-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                handleSelect(option.value);
              }}
              className={[
                dropdownItemClassName,
                active ? "bg-[var(--admin-surface-high)] font-medium" : "",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate text-left">{option.label}</span>
              {active ? (
                <Check
                  className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
              ) : (
                <span className="h-4 w-4 shrink-0" aria-hidden="true" />
              )}
            </button>
          );
        })}
      </div>
    </DropdownField>
  );
}
