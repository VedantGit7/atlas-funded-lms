"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "./admin-form-dropdown-shared";
import { fieldClassName } from "./create-course-dialog-shared";

export type PricingPlanDropdownOption = {
  value: string;
  label: string;
};

type PricingPlanSearchableDropdownProps = {
  label: ReactNode;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  options: PricingPlanDropdownOption[];
  disabled?: boolean;
  placeholder?: string;
  emptyLabel?: string;
  searchPlaceholder?: string;
  panelAriaLabel: string;
  allowEmpty?: boolean;
  emptyValue?: string;
  leftIcon?: ReactNode;
};

export function PricingPlanSearchableDropdown({
  label,
  labelId,
  value,
  onChange,
  options,
  disabled = false,
  placeholder = "Select an option",
  emptyLabel = "None",
  searchPlaceholder = "Search…",
  panelAriaLabel,
  allowEmpty = false,
  emptyValue = "",
  leftIcon,
}: PricingPlanSearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    if (allowEmpty && value === emptyValue) return emptyLabel;
    return options.find((option) => option.value === value)?.label ?? placeholder;
  }, [allowEmpty, emptyLabel, emptyValue, options, placeholder, value]);

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(query) || option.value.toLowerCase().includes(query),
    );
  }, [options, search]);

  function closeDropdown() {
    setOpen(false);
    setSearch("");
  }

  function handleSelect(nextValue: string) {
    onChange(nextValue);
    closeDropdown();
  }

  return (
    <DropdownField
      label={label}
      labelId={labelId}
      open={open}
      disabled={disabled}
      onToggle={() => {
        if (disabled) return;
        setOpen((current) => {
          if (current) setSearch("");
          return !current;
        });
      }}
      triggerContent={
        <span
          className={
            value.length > 0 || (allowEmpty && value === emptyValue)
              ? "text-[var(--admin-on-surface)]"
              : "text-[var(--admin-on-surface-variant)]"
          }
        >
          {selectedLabel}
        </span>
      }
      panelAriaLabel={panelAriaLabel}
      portalZIndex={100}
      leftIcon={leftIcon}
    >
      <div className="shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder={searchPlaceholder}
          className={`${fieldClassName} rounded-lg py-2 text-sm`}
          autoFocus
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {allowEmpty ? (
          <button
            type="button"
            role="option"
            aria-selected={value === emptyValue}
            onClick={() => {
              handleSelect(emptyValue);
            }}
            className={[
              dropdownItemClassName,
              value === emptyValue ? "bg-[var(--admin-surface-high)] font-semibold" : "",
            ].join(" ")}
          >
            <span className="min-w-0 flex-1 truncate text-[var(--admin-on-surface)]">{emptyLabel}</span>
            {value === emptyValue ? (
              <Check className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
            ) : (
              <span className="h-4 w-4 shrink-0" aria-hidden="true" />
            )}
          </button>
        ) : null}

        {filteredOptions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">No matches found.</p>
        ) : (
          filteredOptions.map((option) => {
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
                  active ? "bg-[var(--admin-surface-high)] font-semibold" : "",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate text-[var(--admin-on-surface)]">
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
          })
        )}
      </div>
    </DropdownField>
  );
}
