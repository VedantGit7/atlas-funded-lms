"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { learnerAssessmentOverviewSchema } from "../assessment-response-schemas";
import { ProctoringConsentModal } from "./proctoring-consent-modal";

type Overview = z.infer<typeof learnerAssessmentOverviewSchema>;

type AssessmentOverviewProps = {
  overview: Overview;
};

function consentLevel(proctoringLevel: number): 1 | 2 | 3 {
  if (proctoringLevel >= 3) return 3;
  if (proctoringLevel >= 2) return 2;
  return 1;
}

export function AssessmentOverviewPanel({ overview }: AssessmentOverviewProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const level = overview.config.proctoringLevel;
  const proctoringEnabled = level >= 1 || overview.config.l1ProctoringEnabled;

  async function startAttempt(withConsent: boolean) {
    setStarting(true);
    setError(null);
    try {
      const body = withConsent
        ? {
            consent: {
              consentedAt: new Date().toISOString(),
              level: consentLevel(level >= 1 ? level : 1),
            },
          }
        : {};
      const response = await clientApi.post<{ data: { id: string } }>(
        `/api/v1/assessments/${overview.id}/attempts`,
        body,
        "attempt-start",
      );
      setConsentOpen(false);
      router.push(`/attempts/${response.data.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to start attempt.");
      setStarting(false);
    }
  }

  function handleStartClick() {
    if (proctoringEnabled) {
      setConsentOpen(true);
      return;
    }
    void startAttempt(false);
  }

  const canStart = overview.attemptsRemaining == null || overview.attemptsRemaining > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{overview.title}</h1>
        {overview.description ? <p className="mt-2 text-gray-700">{overview.description}</p> : null}
      </header>

      <section className="rounded border p-4">
        <h2 className="font-medium">Rules</h2>
        <ul className="mt-3 space-y-2 text-sm">
          <li>Pass mark: {overview.config.passMarkPercent}%</li>
          <li>Attempts allowed: {overview.config.attemptsAllowed}</li>
          <li>Attempts used: {overview.attemptsUsed}</li>
          <li>
            Attempts remaining:{" "}
            {overview.attemptsRemaining == null ? "Unlimited" : overview.attemptsRemaining}
          </li>
          <li>
            Time limit:{" "}
            {overview.config.timeLimitSeconds
              ? `${String(Math.round(overview.config.timeLimitSeconds / 60))} minutes`
              : "No limit"}
          </li>
          <li>Items: {overview.itemCount}</li>
        </ul>
      </section>

      {overview.config.secureMode ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          Secure mode is enabled for this assessment.
        </p>
      ) : null}

      {proctoringEnabled ? (
        <p className="rounded border border-blue-300 bg-blue-50 p-3 text-sm">
          L{String(level >= 1 ? level : 1)} proctoring signals may be recorded during this attempt.
          Monitoring is advisory only.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        className="rounded border px-4 py-2"
        disabled={!canStart || starting}
        onClick={handleStartClick}
      >
        {starting ? "Starting..." : "Start attempt"}
      </button>

      <ProctoringConsentModal
        open={consentOpen}
        confirming={starting}
        level={consentLevel(level >= 1 ? level : 1)}
        onCancel={() => {
          if (!starting) setConsentOpen(false);
        }}
        onConfirm={() => {
          void startAttempt(true);
        }}
      />
    </div>
  );
}
