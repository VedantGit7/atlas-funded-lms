"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { learnerAssessmentOverviewSchema } from "../assessment-response-schemas";

type Overview = z.infer<typeof learnerAssessmentOverviewSchema>;

type AssessmentOverviewProps = {
  overview: Overview;
};

export function AssessmentOverviewPanel({ overview }: AssessmentOverviewProps) {
  const router = useRouter();
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleStart() {
    setStarting(true);
    setError(null);
    try {
      const response = await clientApi.post<{ data: { id: string } }>(
        `/api/v1/assessments/${overview.id}/attempts`,
        {},
        "attempt-start",
      );
      router.push(`/attempts/${response.data.id}`);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Unable to start attempt.");
    } finally {
      setStarting(false);
    }
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

      {overview.config.l1ProctoringEnabled ? (
        <p className="rounded border border-blue-300 bg-blue-50 p-3 text-sm">
          L1 proctoring signals may be recorded during this attempt.
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="button"
        className="rounded border px-4 py-2"
        disabled={!canStart || starting}
        onClick={() => void handleStart()}
      >
        {starting ? "Starting..." : "Start attempt"}
      </button>
    </div>
  );
}
