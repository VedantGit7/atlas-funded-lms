"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import type { CourseAccessMode } from "./course-access-settings";
import {
  DropdownField,
  dropdownItemClassName,
} from "./admin-form-dropdown-shared";
import { accessModeLabel, builderFieldLabelClassName } from "./course-builder-shared";

const ACCESS_MODE_OPTIONS: CourseAccessMode[] = ["open", "enrollment_required", "invite_only"];

type CourseAccessModePickerProps = {
  value: CourseAccessMode;
  onChange: (value: CourseAccessMode) => void;
  disabled?: boolean;
  labelId?: string;
};

export function CourseAccessModePicker({
  value,
  onChange,
  disabled = false,
  labelId = "course-access-mode",
}: CourseAccessModePickerProps) {
  const [open, setOpen] = useState(false);

  function closeDropdown() {
    setOpen(false);
  }

  function handleSelect(mode: CourseAccessMode) {
    onChange(mode);
    closeDropdown();
  }

  return (
    <DropdownField
      label={
        <label htmlFor={labelId} className={builderFieldLabelClassName}>
          Access Mode
        </label>
      }
      labelId={labelId}
      open={open}
      disabled={disabled}
      onToggle={() => {
        if (disabled) return;
        setOpen((current) => !current);
      }}
      triggerContent={
        <span className="text-[var(--admin-on-surface)]">{accessModeLabel(value)}</span>
      }
      panelAriaLabel="Course access mode"
      portalZIndex={100}
    >
      <div className="p-1.5">
          {ACCESS_MODE_OPTIONS.map((mode) => {
            const active = mode === value;
            return (
              <button
                key={mode}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  handleSelect(mode);
                }}
                className={[
                  dropdownItemClassName,
                  active ? "bg-[var(--admin-surface-high)] font-medium" : "",
                ].join(" ")}
              >
                <span className="min-w-0 flex-1 truncate">{accessModeLabel(mode)}</span>
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
