"use client";

import type { z } from "zod";
import type { learnerAssessmentOverviewSchema } from "../assessment-response-schemas";
import { useStartAttempt } from "../lib/use-start-attempt";
import { ProctoringConsentModal } from "./proctoring-consent-modal";

type Overview = z.infer<typeof learnerAssessmentOverviewSchema>;

type AssessmentOverviewProps = {
  overview: Overview;
};

export function AssessmentOverviewPanel({ overview }: AssessmentOverviewProps) {
  const level = overview.config.proctoringLevel;
  const proctoringEnabled = level >= 1 || overview.config.l1ProctoringEnabled;
  const attempt = useStartAttempt({
    assessmentId: overview.id,
    proctoringLevel: proctoringEnabled ? Math.max(level, 1) : 0,
  });
  const { starting, error } = attempt;

  const canStart = overview.attemptsRemaining == null || overview.attemptsRemaining > 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{overview.title}</h1>
        {overview.description ? (
          <p className="mt-2 text-foreground">{overview.description}</p>
        ) : null}
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
        <p className="rounded border border-warning/40 bg-warning/10 p-3 text-sm">
          Secure mode is enabled for this assessment.
        </p>
      ) : null}

      {proctoringEnabled ? (
        <p className="rounded border border-primary/30 bg-primary/10 p-3 text-sm">
          L{String(level >= 1 ? level : 1)} proctoring signals may be recorded during this attempt.
          Monitoring is advisory only.
        </p>
      ) : null}

      {error ? <p className="text-sm text-destructive-text">{error}</p> : null}

      <button
        type="button"
        className="rounded border px-4 py-2"
        disabled={!canStart || starting}
        onClick={attempt.start}
      >
        {starting ? "Starting..." : "Start attempt"}
      </button>

      <ProctoringConsentModal
        open={attempt.consentOpen}
        confirming={starting}
        level={attempt.consentLevel}
        onCancel={attempt.cancelConsent}
        onConfirm={attempt.confirmConsent}
      />
    </div>
  );
}
