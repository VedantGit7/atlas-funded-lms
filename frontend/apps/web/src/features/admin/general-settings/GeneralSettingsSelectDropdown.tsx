"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";

export type GeneralSettingsSelectOption = {
  value: string;
  label: string;
};

type GeneralSettingsSelectDropdownProps = {
  label: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  options: readonly GeneralSettingsSelectOption[];
  disabled?: boolean;
  panelAriaLabel: string;
};

export function GeneralSettingsSelectDropdown({
  label,
  labelId,
  value,
  onChange,
  options,
  disabled = false,
  panelAriaLabel,
}: GeneralSettingsSelectDropdownProps) {
  const [open, setOpen] = useState(false);

  const selectedLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label ?? "Select an option";
  }, [options, value]);

  function closeDropdown() {
    setOpen(false);
  }

  return (
    <DropdownField
      label={<span className="text-sm font-semibold text-[var(--admin-on-surface)]">{label}</span>}
      labelId={labelId}
      open={open}
      disabled={disabled}
      onToggle={() => {
        if (disabled) return;
        setOpen((current) => !current);
      }}
      triggerContent={
        <span className={value ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]"}>
          {selectedLabel}
        </span>
      }
      panelAriaLabel={panelAriaLabel}
      portalZIndex={120}
    >
      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {options.map((option) => {
          const active = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={active}
              onClick={() => {
                onChange(option.value);
                closeDropdown();
              }}
              className={[
                dropdownItemClassName,
                active ? "bg-[var(--admin-surface-high)] font-semibold" : "",
              ].join(" ")}
            >
              <span className="min-w-0 flex-1 truncate text-left text-[var(--admin-on-surface)]">
                {option.label}
              </span>
              {active ? (
                <Check
                  className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
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
