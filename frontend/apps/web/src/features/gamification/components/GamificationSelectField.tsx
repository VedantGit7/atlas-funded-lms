"use client";

import { useId, useState, type ReactNode } from "react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { labelClassName } from "../gamification-admin-shared";

export type GamificationSelectOption = {
  value: string;
  label: string;
};

type GamificationSelectFieldProps = {
  label: ReactNode;
  value: string;
  onChange: (value: string) => void;
  options: ReadonlyArray<GamificationSelectOption>;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function GamificationSelectField({
  label,
  value,
  onChange,
  options,
  disabled = false,
  className = "",
  placeholder = "Select…",
}: GamificationSelectFieldProps) {
  const [open, setOpen] = useState(false);
  const labelId = useId();
  const selected = options.find((option) => option.value === value);

  return (
    <div className={className}>
      <DropdownField
        label={
          <label htmlFor={labelId} className={labelClassName}>
            {label}
          </label>
        }
        labelId={labelId}
        open={open}
        disabled={disabled}
        onToggle={() => {
          setOpen((current) => !current);
        }}
        triggerContent={selected?.label ?? placeholder}
        panelRole="listbox"
        {...(typeof label === "string" ? { panelAriaLabel: label } : {})}
      >
        <ul className="max-h-60 overflow-y-auto p-1" role="presentation">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <li key={option.value || "__empty"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={[
                    dropdownItemClassName,
                    isSelected
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] font-medium text-[var(--admin-primary)]"
                      : "",
                  ].join(" ")}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  {option.label}
                </button>
              </li>
            );
          })}
        </ul>
      </DropdownField>
    </div>
  );
}
