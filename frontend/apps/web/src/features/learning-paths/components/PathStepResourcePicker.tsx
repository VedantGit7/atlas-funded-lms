"use client";

import type { PathStepType, StepResourceOption } from "../learning-path-step-utils";
import { inputClass, labelClass } from "../learning-path-studio-shared";

type PathStepResourcePickerProps = {
  stepType: PathStepType;
  value: string;
  options: StepResourceOption[];
  loading?: boolean;
  disabled?: boolean;
  onChange: (refId: string) => void;
};

export function PathStepResourcePicker({
  stepType,
  value,
  options,
  loading = false,
  disabled = false,
  onChange,
}: PathStepResourcePickerProps) {
  const resourceLabel =
    stepType === "course" ? "Course" : stepType === "assessment" ? "Assessment" : "Nested path";

  return (
    <div>
      <label className={labelClass} htmlFor={`step-resource-${stepType}`}>
        {resourceLabel}
      </label>
      <select
        id={`step-resource-${stepType}`}
        value={value}
        disabled={disabled || loading}
        onChange={(event) => {
          onChange(event.target.value);
        }}
        className={inputClass}
      >
        <option value="">
          {loading
            ? `Loading ${resourceLabel.toLowerCase()}s...`
            : options.length === 0
              ? `No ${resourceLabel.toLowerCase()}s available`
              : `Select a ${resourceLabel.toLowerCase()}`}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
            {option.status ? ` (${option.status})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}
