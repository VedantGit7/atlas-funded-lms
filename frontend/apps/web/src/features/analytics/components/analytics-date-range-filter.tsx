"use client";

type AnalyticsDateRangeFilterProps = {
  from: string;
  to: string;
  onFromChange: (value: string) => void;
  onToChange: (value: string) => void;
  onApply: () => void;
  disabled?: boolean;
};

export function AnalyticsDateRangeFilter({
  from,
  to,
  onFromChange,
  onToChange,
  onApply,
  disabled = false,
}: AnalyticsDateRangeFilterProps) {
  return (
    <fieldset className="grid gap-3 rounded border p-4 md:grid-cols-[1fr_1fr_auto]">
      <legend className="px-1 text-sm font-medium">Date range</legend>
      <label className="grid gap-1 text-sm">
        <span>From</span>
        <input
          type="date"
          value={from}
          onChange={(event) => {
            onFromChange(event.target.value);
          }}
          disabled={disabled}
          aria-label="Analytics from date"
        />
      </label>
      <label className="grid gap-1 text-sm">
        <span>To</span>
        <input
          type="date"
          value={to}
          onChange={(event) => {
            onToChange(event.target.value);
          }}
          disabled={disabled}
          aria-label="Analytics to date"
        />
      </label>
      <button
        type="button"
        onClick={onApply}
        disabled={disabled}
        className="self-end rounded border px-3 py-2"
      >
        Apply range
      </button>
    </fieldset>
  );
}
