"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";
import { fieldClassName } from "./course-builder-shared";
import { isPricingPlanDateTimeLocal } from "./pricing-plan-datetime-utils";

export function formatContentDripReleaseDisplay(value: string): string {
  if (!isPricingPlanDateTimeLocal(value)) return value;

  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return value;

  const [year, month, day] = datePart.split("-");
  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}, ${timePart}`;
}

type ContentDrippingDateTimeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function ContentDrippingDateTimeInput({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "Select date and time",
}: ContentDrippingDateTimeInputProps) {
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

  const displayValue = value ? formatContentDripReleaseDisplay(value) : placeholder;

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openPicker}
        className={[
          fieldClassName,
          "flex w-full items-center pr-11 text-left transition-[border-color,box-shadow] duration-200",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          value ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        <span className="truncate">{displayValue}</span>
      </button>
      <Calendar
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="datetime-local"
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
