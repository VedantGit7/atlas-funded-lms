"use client";

import { PricingPlanFieldLabel } from "./course-pricing-plan-form-shared";
import {
  PricingPlanSearchableDropdown,
  type PricingPlanDropdownOption,
} from "./pricing-plan-searchable-dropdown";

type PricingPlanRenewalPlanPickerProps = {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
  options: PricingPlanDropdownOption[];
  disabled?: boolean;
};

export function PricingPlanRenewalPlanPicker({
  id,
  value,
  onChange,
  options,
  disabled = false,
}: PricingPlanRenewalPlanPickerProps) {
  return (
    <PricingPlanSearchableDropdown
      label={
        <PricingPlanFieldLabel
          htmlFor={id}
          tooltip="Optional follow-up plan offered when this free plan ends."
        >
          Renewal Plan
        </PricingPlanFieldLabel>
      }
      labelId={id}
      value={value ?? ""}
      onChange={(nextValue) => {
        onChange(nextValue.length > 0 ? nextValue : null);
      }}
      options={options}
      disabled={disabled}
      placeholder="Select Plan"
      emptyLabel="Select Plan"
      searchPlaceholder="Search plans…"
      panelAriaLabel="Pricing plan renewal plan"
      allowEmpty
    />
  );
}
