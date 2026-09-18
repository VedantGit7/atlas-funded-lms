"use client";

import { useMemo, useState } from "react";
import { Check } from "lucide-react";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import { fieldClassName } from "../../studio/courses/create-course-dialog-shared";
import type { TimezoneOption } from "./timezone-options";

type TimezoneSearchableDropdownProps = {
  label: string;
  labelId: string;
  value: string;
  onChange: (value: string) => void;
  options: TimezoneOption[];
  disabled?: boolean;
};

export function TimezoneSearchableDropdown({
  label,
  labelId,
  value,
  onChange,
  options,
  disabled = false,
}: TimezoneSearchableDropdownProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selectedLabel = useMemo(() => {
    return options.find((option) => option.value === value)?.label ?? "Select a time zone";
  }, [options, value]);

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

  return (
    <DropdownField
      label={<span className="text-sm font-semibold text-[var(--admin-on-surface)]">{label}</span>}
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
            value ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]"
          }
        >
          {selectedLabel}
        </span>
      }
      panelAriaLabel="Time zone options"
      portalZIndex={120}
    >
      <div className="shrink-0 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-2">
        <input
          type="search"
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
          }}
          placeholder="Search time zones"
          className={`${fieldClassName} rounded-lg py-2 text-sm`}
          autoFocus
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
        {filteredOptions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-[var(--admin-on-surface-variant)]">
            No matches found.
          </p>
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
          })
        )}
      </div>
    </DropdownField>
  );
}
