"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import {
  acknowledgeAtRiskAlert,
  evaluateAtRiskAlerts,
  fetchAtRiskAlerts,
  type AtRiskAlert,
} from "../api";
import {
  sectionHeaderClassName,
  tableHeaderClassName,
  tableShellClassName,
} from "../analytics-studio-shared";

type AnalyticsAtRiskTableProps = {
  enabled?: boolean | undefined;
};

export function AnalyticsAtRiskTable({ enabled = true }: AnalyticsAtRiskTableProps) {
  const [alerts, setAlerts] = useState<AtRiskAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadAlerts = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchAtRiskAlerts({ status: "open", limit: 50 });
      setAlerts(response.data.alerts);
    } catch {
      setErrorMessage("Unable to load at-risk alerts.");
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadAlerts();
  }, [loadAlerts]);

  async function handleEvaluate() {
    setEvaluating(true);
    setActionMessage(null);
    setErrorMessage(null);
    try {
      const result = await evaluateAtRiskAlerts();
      setActionMessage(
        `Evaluated ${String(result.data.evaluatedRules)} rules · ${String(result.data.alertsCreated)} new · ${String(result.data.alertsUpdated)} updated`,
      );
      await loadAlerts();
    } catch {
      setErrorMessage("Failed to recompute at-risk alerts.");
    } finally {
      setEvaluating(false);
    }
  }

  async function handleAcknowledge(alertId: string) {
    setActionMessage(null);
    try {
      await acknowledgeAtRiskAlert(alertId);
      setAlerts((current) => current.filter((alert) => alert.id !== alertId));
      setActionMessage("Alert acknowledged.");
    } catch {
      setErrorMessage("Failed to acknowledge alert.");
    }
  }

  if (!enabled) return null;

  return (
    <section className={tableShellClassName} aria-label="At-risk learners">
      <div className={sectionHeaderClassName}>
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface)]">
            At-risk learners
          </h2>
          <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
            Open alerts from inactivity, low grades, and cohort activity rules.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
          onClick={() => {
            void handleEvaluate();
          }}
          disabled={evaluating}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${evaluating ? "animate-spin" : ""}`}
            aria-hidden="true"
          />
          Recompute
        </button>
      </div>

      {errorMessage ? (
        <div
          className="mx-4 mb-3 flex items-center gap-2 rounded-md border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
          {errorMessage}
        </div>
      ) : null}

      {actionMessage ? (
        <div
          className="mx-4 mb-3 flex items-center gap-2 text-sm text-[var(--admin-success)]"
          aria-live="polite"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          {actionMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          Loading at-risk alerts…
        </div>
      ) : alerts.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
          No open at-risk alerts. Run recompute to scan enrollments and lesson activity.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className={tableHeaderClassName}>
                <th scope="col" className="px-4 py-3">
                  Learner
                </th>
                <th scope="col" className="px-4 py-3">
                  Rule
                </th>
                <th scope="col" className="px-4 py-3">
                  Triggered
                </th>
                <th scope="col" className="px-4 py-3">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {alerts.map((alert) => (
                <tr key={alert.id}>
                  <td className="px-4 py-3 font-medium text-[var(--admin-on-surface)]">
                    {alert.displayName}
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                    {alert.ruleName}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-[var(--admin-on-surface-variant)]">
                    {new Date(alert.triggeredAt).toLocaleString()}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      className="rounded-md border border-[var(--admin-border)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        void handleAcknowledge(alert.id);
                      }}
                    >
                      Acknowledge
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
