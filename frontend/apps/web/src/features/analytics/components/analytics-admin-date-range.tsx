"use client";

import {
  analyticsDateRangeShellClassName,
  applyToolbarButtonClassName,
  fieldClassName,
  toolbarLabelClassName,
} from "../analytics-admin-shared";
import { formatDisplayDate } from "../analytics-admin-utils";

type AnalyticsAdminDateRangeProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  disabled?: boolean;
};

export function AnalyticsAdminDateRange({
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  disabled = false,
}: AnalyticsAdminDateRangeProps) {
  return (
    <fieldset className={analyticsDateRangeShellClassName} disabled={disabled}>
      <legend className="sr-only">Analytics date range</legend>
      <label className="flex flex-col gap-0.5">
        <span className={toolbarLabelClassName}>Start date</span>
        <input
          type="date"
          value={from}
          onChange={(event) => {
            onFromChange(event.target.value);
          }}
          aria-label="Analytics start date"
          className={`${fieldClassName} w-[8.5rem] border-none bg-transparent px-0 py-0 text-xs font-semibold shadow-none focus-visible:ring-0`}
        />
      </label>
      <div className="hidden h-8 w-px bg-[var(--admin-border)] sm:block" aria-hidden="true" />
      <label className="flex flex-col gap-0.5">
        <span className={toolbarLabelClassName}>End date</span>
        <input
          type="date"
          value={to}
          onChange={(event) => {
            onToChange(event.target.value);
          }}
          aria-label="Analytics end date"
          className={`${fieldClassName} w-[8.5rem] border-none bg-transparent px-0 py-0 text-xs font-semibold shadow-none focus-visible:ring-0`}
        />
      </label>
      <button type="button" className={applyToolbarButtonClassName} onClick={onApply} disabled={disabled}>
        Apply
      </button>
      <p className="sr-only" aria-live="polite">
        Selected range {formatDisplayDate(from)} to {formatDisplayDate(to)}
      </p>
    </fieldset>
  );
}
