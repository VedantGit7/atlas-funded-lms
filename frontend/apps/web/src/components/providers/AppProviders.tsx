"use client";

import type { ReactNode } from "react";

import { AppToastViewport } from "../feedback/AppToastViewport";
import { CurrencyProvider } from "../../features/currency/CurrencyProvider";
import { ThemeProvider } from "./ThemeProvider";

type AppProvidersProps = Readonly<{
  children: ReactNode;
  initialDisplayCurrency?: string | null;
  initialFxRates?: Record<string, number> | null;
}>;

export function AppProviders({
  children,
  initialDisplayCurrency,
  initialFxRates,
}: AppProvidersProps) {
  return (
    <ThemeProvider>
      <CurrencyProvider
        initialDisplayCurrency={initialDisplayCurrency}
        initialFxRates={initialFxRates}
      >
        {children}
        <AppToastViewport />
      </CurrencyProvider>
    </ThemeProvider>
  );
}
