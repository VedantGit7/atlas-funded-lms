"use client";

import { useRef } from "react";
import { Calendar } from "lucide-react";
import { lessonInputClassName } from "../lessons/lesson-editor-shared";
import { formatPricingPlanOfferDate } from "./pricing-plan-datetime-utils";

type PricingPlanOfferDateInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
};

export function PricingPlanOfferDateInput({
  id,
  value,
  onChange,
  disabled = false,
  placeholder = "Select date",
}: PricingPlanOfferDateInputProps) {
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

  const displayValue = value ? formatPricingPlanOfferDate(value) : placeholder;

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        id={id}
        disabled={disabled}
        onClick={openPicker}
        className={[
          lessonInputClassName,
          "flex w-full items-center pr-10 text-left transition-[border-color,box-shadow] duration-200",
          disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
          value ? "text-[var(--admin-on-surface)]" : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        <span className="truncate">{displayValue}</span>
      </button>
      <Calendar
        className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="date"
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

type PricingPlanOfferTimeInputProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function PricingPlanOfferTimeInput({
  id,
  value,
  onChange,
  disabled = false,
}: PricingPlanOfferTimeInputProps) {
  return (
    <input
      id={id}
      type="time"
      value={value}
      disabled={disabled}
      className={`${lessonInputClassName} px-3`}
      onChange={(event) => {
        onChange(event.target.value);
      }}
    />
  );
}

type PricingPlanDateTimeRowProps = {
  dateId: string;
  timeId: string;
  dateValue: string;
  timeValue: string;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  disabled?: boolean;
  datePlaceholder?: string;
};

export function PricingPlanDateTimeRow({
  dateId,
  timeId,
  dateValue,
  timeValue,
  onDateChange,
  onTimeChange,
  disabled = false,
  datePlaceholder = "Select date",
}: PricingPlanDateTimeRowProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
      <PricingPlanOfferDateInput
        id={dateId}
        value={dateValue}
        disabled={disabled}
        placeholder={datePlaceholder}
        onChange={onDateChange}
      />
      <PricingPlanOfferTimeInput
        id={timeId}
        value={timeValue}
        disabled={disabled}
        onChange={onTimeChange}
      />
    </div>
  );
}
