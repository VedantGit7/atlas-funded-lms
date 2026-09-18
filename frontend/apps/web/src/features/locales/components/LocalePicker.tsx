"use client";

import { useMemo, useState } from "react";
import { Select, Input } from "@atlas/design-system";
import { COMMON_BCP47_LOCALES, isValidLocaleCode } from "../locales-common-locales";
import { localesInputClassName, localesSelectTriggerClassName } from "../locales-admin-shared";
import { mergeLocaleOptions } from "../locales-admin-utils";

const CUSTOM_OPTION_VALUE = "__custom__";

type LocalePickerProps = {
  value: string;
  onChange: (value: string) => void;
  existingLocales: string[];
  disabled?: boolean;
  label?: string;
};

export function LocalePicker({
  value,
  onChange,
  existingLocales,
  disabled = false,
  label = "Locale code",
}: LocalePickerProps) {
  const [customMode, setCustomMode] = useState(
    () =>
      value.length > 0 &&
      !mergeLocaleOptions(existingLocales, COMMON_BCP47_LOCALES).some((o) => o.value === value),
  );
  const [customValue, setCustomValue] = useState(customMode ? value : "");

  const selectOptions = useMemo(() => {
    const merged = mergeLocaleOptions(existingLocales, COMMON_BCP47_LOCALES);
    return [...merged, { value: CUSTOM_OPTION_VALUE, label: "Enter custom locale code…" }];
  }, [existingLocales]);

  const selectValue =
    customMode ||
    !selectOptions.some((option) => option.value === value && option.value !== CUSTOM_OPTION_VALUE)
      ? CUSTOM_OPTION_VALUE
      : value;

  const customInvalid = customMode && customValue.length > 0 && !isValidLocaleCode(customValue);

  return (
    <div className="space-y-2">
      <label className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
        {label}
      </label>
      <Select
        value={selectValue}
        onValueChange={(next) => {
          if (next === CUSTOM_OPTION_VALUE) {
            setCustomMode(true);
            setCustomValue(value);
            return;
          }
          setCustomMode(false);
          setCustomValue("");
          onChange(next);
        }}
        options={selectOptions}
        disabled={disabled}
        className={localesSelectTriggerClassName}
        ariaLabel={label}
      />
      {customMode ? (
        <div className="space-y-1">
          <Input
            value={customValue}
            onChange={(event) => {
              const next = event.target.value.trim();
              setCustomValue(next);
              if (isValidLocaleCode(next)) {
                onChange(next);
              }
            }}
            disabled={disabled}
            placeholder="e.g. en-US"
            className={localesInputClassName}
            aria-invalid={customInvalid}
          />
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Format: two-letter language code, optional region (e.g. en, en-US, fr-FR).
          </p>
          {customInvalid ? (
            <p className="text-xs text-[var(--admin-danger)]" role="alert">
              Locale code must match ^[a-z]{"{2}"}([-_][A-Z]{"{2}"})?$
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
