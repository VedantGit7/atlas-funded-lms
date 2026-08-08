"use client";

import { useCurrency } from "./CurrencyProvider";

/**
 * Renders a monetary amount, converting from its native currency into the
 * tenant's display (home) currency using live FX rates. When rates are missing
 * or a code is unknown it degrades to the native currency so nothing breaks.
 *
 * Pass `amount` in major units (e.g. 19.99). For minor units (cents), divide
 * before passing or set `minorUnits`.
 */
export function Money({
  amount,
  currency,
  minorUnits = false,
  className,
  title,
}: {
  amount: number;
  currency: string;
  minorUnits?: boolean;
  className?: string;
  title?: string;
}) {
  const { format, displayCurrency, convert } = useCurrency();
  const value = minorUnits ? amount / 100 : amount;
  const converted = convert(value, currency);
  const nativeUpper = currency.toUpperCase();
  // Surface the original figure on hover when a conversion actually happened.
  const hoverTitle =
    title ??
    (converted != null && nativeUpper !== displayCurrency
      ? `${nativeUpper} ${value.toFixed(2)}`
      : undefined);

  return (
    <span className={className} title={hoverTitle}>
      {format(value, currency)}
    </span>
  );
}
