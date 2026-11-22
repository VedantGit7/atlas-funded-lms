"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClientApiError, clientApi } from "../../../lib/client-api";

/** The consent level a proctoring level asks for. */
export function consentLevel(proctoringLevel: number): 1 | 2 | 3 {
  if (proctoringLevel >= 3) return 3;
  if (proctoringLevel >= 2) return 2;
  return 1;
}

/**
 * Starts a quiz attempt and opens it. A proctored quiz first asks for consent
 * (ProctoringConsentModal), so `start` opens that and `confirmConsent` starts.
 * Shared by the quiz page and the quiz card inside a lesson.
 */
export function useStartAttempt(args: { assessmentId: string; proctoringLevel: number }) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const proctored = args.proctoringLevel >= 1;

  async function startNow(withConsent: boolean) {
    setStarting(true);
    setError(null);
    try {
      const body = withConsent
        ? {
            consent: {
              consentedAt: new Date().toISOString(),
              level: consentLevel(args.proctoringLevel),
            },
          }
        : {};
      const response = await clientApi.post<{ data: { id: string } }>(
        `/api/v1/assessments/${encodeURIComponent(args.assessmentId)}/attempts`,
        body,
        "attempt-start",
      );
      setConsentOpen(false);
      router.push(`/attempts/${response.data.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "The quiz couldn't start. Try again.");
      setStarting(false);
    }
  }

  return {
    starting,
    error,
    consentOpen,
    consentLevel: consentLevel(args.proctoringLevel),
    // Arrow functions, so they can be passed straight to onClick.
    start: () => {
      if (proctored) {
        setConsentOpen(true);
        return;
      }
      void startNow(false);
    },
    confirmConsent: () => {
      void startNow(true);
    },
    cancelConsent: () => {
      if (!starting) setConsentOpen(false);
    },
  };
}
