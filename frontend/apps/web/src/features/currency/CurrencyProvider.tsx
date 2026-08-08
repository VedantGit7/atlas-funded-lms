"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

type CurrencyContextValue = {
  /** Tenant-wide display currency (home currency); every amount converts to it. */
  displayCurrency: string;
  /** USD-based rate map, empty until seeded. */
  rates: Record<string, number>;
  ready: boolean;
  /** Convert an amount from its native currency into the display currency. */
  convert: (amount: number, from: string) => number | null;
  /** Format a converted amount in the display currency. */
  format: (amount: number, from: string) => string;
  /** Optimistically switch the display currency (e.g. right after an admin saves it). */
  setDisplayCurrency: (code: string) => void;
};

const FALLBACK_CURRENCY = "USD";

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

function formatIn(currency: string, amount: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      currencyDisplay: "narrowSymbol",
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function convertWith(
  rates: Record<string, number>,
  amount: number,
  from: string,
  to: string,
): number | null {
  const source = from.toUpperCase();
  if (source === to) return amount;
  const fromRate = rates[source];
  const toRate = rates[to];
  if (fromRate == null || toRate == null || fromRate === 0) return null;
  return (amount * toRate) / fromRate;
}

/**
 * Provides live FX conversion to the whole app. Seeded server-side from the
 * public bootstrap (home currency + cached rates), so it works for anonymous
 * learners and admins alike without any client-side, permission-gated fetch.
 */
export function CurrencyProvider({
  children,
  initialDisplayCurrency,
  initialFxRates,
}: {
  children: React.ReactNode;
  initialDisplayCurrency?: string | null | undefined;
  initialFxRates?: Record<string, number> | null | undefined;
}) {
  const [displayCurrency, setDisplayCurrency] = useState(
    initialDisplayCurrency ?? FALLBACK_CURRENCY,
  );
  const [rates, setRates] = useState<Record<string, number>>(initialFxRates ?? {});

  // Re-sync when the server passes fresh values (e.g. after a navigation that
  // re-ran the root layout with an updated home currency or rate snapshot).
  useEffect(() => {
    if (initialDisplayCurrency) setDisplayCurrency(initialDisplayCurrency);
  }, [initialDisplayCurrency]);

  useEffect(() => {
    if (initialFxRates) setRates(initialFxRates);
  }, [initialFxRates]);

  const convert = useCallback(
    (amount: number, from: string): number | null =>
      convertWith(rates, amount, from, displayCurrency),
    [rates, displayCurrency],
  );

  const format = useCallback(
    (amount: number, from: string): string => {
      const converted = convert(amount, from);
      if (converted == null) return formatIn(from.toUpperCase(), amount);
      return formatIn(displayCurrency, converted);
    },
    [convert, displayCurrency],
  );

  const value = useMemo<CurrencyContextValue>(
    () => ({
      displayCurrency,
      rates,
      ready: Object.keys(rates).length > 0,
      convert,
      format,
      setDisplayCurrency,
    }),
    [displayCurrency, rates, convert, format],
  );

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

/** Access currency conversion. Safe to call outside a provider (identity formatting). */
export function useCurrency(): CurrencyContextValue {
  const context = useContext(CurrencyContext);
  if (context) return context;
  return {
    displayCurrency: FALLBACK_CURRENCY,
    rates: {},
    ready: false,
    convert: (amount) => amount,
    format: (amount, from) => formatIn(from.toUpperCase(), amount),
    setDisplayCurrency: () => {},
  };
}
