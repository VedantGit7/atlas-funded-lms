"use client";

import { useMemo } from "react";
import { PricingPlanFieldLabel } from "./course-pricing-plan-form-shared";
import {
  PRICING_PLAN_PAYMENT_GATEWAY_OPTIONS,
  resolvePricingPlanPaymentGateway,
} from "./pricing-plan-payment-gateway-options";
import { PricingPlanSearchableDropdown } from "./pricing-plan-searchable-dropdown";

type PricingPlanPaymentGatewayPickerProps = {
  id: string;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
};

export function PricingPlanPaymentGatewayPicker({
  id,
  value,
  onChange,
  disabled = false,
}: PricingPlanPaymentGatewayPickerProps) {
  const options = useMemo(
    () =>
      PRICING_PLAN_PAYMENT_GATEWAY_OPTIONS.map((gateway) => ({
        value: gateway,
        label: gateway,
      })),
    [],
  );

  const resolvedValue = resolvePricingPlanPaymentGateway(value) ?? "";

  return (
    <PricingPlanSearchableDropdown
      label={
        <PricingPlanFieldLabel
          htmlFor={id}
          required
          tooltip="Select the payment provider used to collect one-time purchases for this plan."
        >
          Payment Gateway
        </PricingPlanFieldLabel>
      }
      labelId={id}
      value={resolvedValue}
      onChange={(nextValue) => {
        onChange(nextValue.length > 0 ? nextValue : null);
      }}
      options={options}
      disabled={disabled}
      placeholder="Select a payment gateway"
      searchPlaceholder="Search gateways…"
      panelAriaLabel="Pricing plan payment gateway"
    />
  );
}
