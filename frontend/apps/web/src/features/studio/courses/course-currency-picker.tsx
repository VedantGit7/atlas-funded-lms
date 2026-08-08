"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import { findCurrencyOption, getSupportedCurrencyOptions } from "../../courses/supported-currencies";
import {
  DropdownField,
  dropdownItemClassName,
} from "./admin-form-dropdown-shared";
import { builderFieldLabelClassName } from "./course-builder-shared";
import { fieldClassName } from "./create-course-dialog-shared";

type CourseCurrencyPickerProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  labelId?: string;
};

export function CourseCurrencyPicker({
  value,
  onChange,
  disabled = false,
  labelId = "course-currency",
}: CourseCurrencyPickerProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const options = useMemo(() => getSupportedCurrencyOptions(), []);
  const selected = findCurrencyOption(value) ?? options.find((option) => option.code === "USD");

  const filteredOptions = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return options;
    return options.filter(
      (option) =>
        option.code.toLowerCase().includes(query) || option.label.toLowerCase().includes(query),
    );
  }, [options, search]);

  function closeDropdown() {
    setOpen(false);
    setSearch("");
  }

  function handleSelect(code: string) {
    onChange(code);
    closeDropdown();
  }

  return (
    <DropdownField
      label={
        <label htmlFor={labelId} className={builderFieldLabelClassName}>
          Currency
        </label>
      }
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
        <span className="text-[var(--admin-on-surface)]">{selected?.label ?? value}</span>
      }
      panelAriaLabel="Course currency"
      portalZIndex={100}
    >
      <div className="shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
          <input
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search currencies…"
            className={`${fieldClassName} rounded-lg py-2 text-sm`}
            autoFocus
          />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {filteredOptions.length === 0 ? (
            <p className="px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
              No currencies match your search.
            </p>
          ) : (
            filteredOptions.map((option) => {
              const active = option.code === value;
              return (
                <button
                  key={option.code}
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    handleSelect(option.code);
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
