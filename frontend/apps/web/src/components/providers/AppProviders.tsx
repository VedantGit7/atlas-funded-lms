"use client";

import type { ReactNode } from "react";

import { AppToastViewport } from "../feedback/AppToastViewport";
import { CurrencyProvider } from "../../features/currency/CurrencyProvider";
import { ThemeProvider } from "./ThemeProvider";
import { AcademyFormatProvider } from "../../lib/format/academy-format-context";
import { DEFAULT_ACADEMY_FORMAT, type AcademyFormat } from "../../lib/format/academy-format";

type AppProvidersProps = Readonly<{
  children: ReactNode;
  initialDisplayCurrency?: string | null;
  initialFxRates?: Record<string, number> | null;
  academyFormat?: AcademyFormat;
}>;

export function AppProviders({
  children,
  initialDisplayCurrency,
  initialFxRates,
  academyFormat = DEFAULT_ACADEMY_FORMAT,
}: AppProvidersProps) {
  return (
    <AcademyFormatProvider value={academyFormat}>
      <ThemeProvider>
        <CurrencyProvider
          initialDisplayCurrency={initialDisplayCurrency}
          initialFxRates={initialFxRates}
        >
          {children}
          <AppToastViewport />
        </CurrencyProvider>
      </ThemeProvider>
    </AcademyFormatProvider>
  );
}
