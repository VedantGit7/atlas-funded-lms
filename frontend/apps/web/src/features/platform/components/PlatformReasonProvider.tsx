"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { platformReasonSchema } from "../platform-reason-schema";
import { invalidatePlatformCaches } from "../platform-query-keys";
import { PlatformReasonDialog } from "./PlatformReasonDialog";

type PlatformReasonContextValue = {
  reason: string | null;
  isValid: boolean;
  setReason: (value: string) => void;
  clearReason: () => void;
  promptForReason: () => void;
};

const PlatformReasonContext = createContext<PlatformReasonContextValue | null>(null);

export function PlatformReasonProvider({ children }: { children: ReactNode }) {
  const [reason, setReasonState] = useState<string | null>(null);
  const [promptOpen, setPromptOpen] = useState(false);
  const [draftReason, setDraftReason] = useState("");

  const isValid = useMemo(() => platformReasonSchema.safeParse(reason ?? "").success, [reason]);

  const setReason = useCallback((value: string) => {
    setReasonState(value.trim());
  }, []);

  const clearReason = useCallback(() => {
    setReasonState(null);
    invalidatePlatformCaches("reason_expiry");
  }, []);

  const promptForReason = useCallback(() => {
    setDraftReason(reason ?? "");
    setPromptOpen(true);
  }, [reason]);

  const value = useMemo(
    () => ({
      reason,
      isValid,
      setReason,
      clearReason,
      promptForReason,
    }),
    [reason, isValid, setReason, clearReason, promptForReason],
  );

  return (
    <PlatformReasonContext.Provider value={value}>
      {children}
      <PlatformReasonDialog
        open={promptOpen}
        title="Platform operational reason"
        description="Every platform read and action requires a reason of at least 10 characters."
        value={draftReason}
        onChange={setDraftReason}
        onConfirm={() => {
          setReason(draftReason);
          setPromptOpen(false);
        }}
        onCancel={() => {
          setPromptOpen(false);
        }}
      />
    </PlatformReasonContext.Provider>
  );
}

export function usePlatformReason(): PlatformReasonContextValue {
  const context = useContext(PlatformReasonContext);
  if (!context) {
    throw new Error("usePlatformReason must be used within PlatformReasonProvider");
  }
  return context;
}
