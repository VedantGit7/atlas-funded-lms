"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { platformReasonSchema } from "../platform-reason-schema";
import { invalidatePlatformCaches } from "../platform-query-keys";

type PlatformReasonContextValue = {
  reason: string | null;
  isValid: boolean;
  setReason: (value: string) => void;
  clearReason: () => void;
};

const PlatformReasonContext = createContext<PlatformReasonContextValue | null>(null);

export function PlatformReasonProvider({ children }: { children: ReactNode }) {
  const [reason, setReasonState] = useState<string | null>(null);

  const isValid = useMemo(() => platformReasonSchema.safeParse(reason ?? "").success, [reason]);

  const setReason = useCallback((value: string) => {
    setReasonState(value.trim());
  }, []);

  const clearReason = useCallback(() => {
    setReasonState(null);
    invalidatePlatformCaches("reason_expiry");
  }, []);

  const value = useMemo(
    () => ({
      reason,
      isValid,
      setReason,
      clearReason,
    }),
    [reason, isValid, setReason, clearReason],
  );

  return <PlatformReasonContext.Provider value={value}>{children}</PlatformReasonContext.Provider>;
}

export function usePlatformReason(): PlatformReasonContextValue {
  const context = useContext(PlatformReasonContext);
  if (!context) {
    throw new Error("usePlatformReason must be used within PlatformReasonProvider");
  }
  return context;
}
