"use client";

import { useMemo } from "react";
import { PricingPlanFieldLabel } from "./course-pricing-plan-form-shared";
import {
  PRICING_PLAN_LOCATION_OPTIONS,
  resolvePricingPlanLocation,
} from "./pricing-plan-location-options";
import { PricingPlanSearchableDropdown } from "./pricing-plan-searchable-dropdown";

type PricingPlanLocationPickerProps = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
};

export function PricingPlanLocationPicker({
  id,
  value,
  onChange,
  disabled = false,
}: PricingPlanLocationPickerProps) {
  const options = useMemo(
    () =>
      PRICING_PLAN_LOCATION_OPTIONS.map((location) => ({
        value: location,
        label: location,
      })),
    [],
  );

  const resolvedValue = resolvePricingPlanLocation(value);

  return (
    <PricingPlanSearchableDropdown
      label={
        <PricingPlanFieldLabel htmlFor={id}>Location</PricingPlanFieldLabel>
      }
      labelId={id}
      value={resolvedValue}
      onChange={onChange}
      options={options}
      disabled={disabled}
      placeholder="Select location"
      searchPlaceholder="Search locations…"
      panelAriaLabel="Pricing plan location"
    />
  );
}
