"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  fetchAtRiskRules,
  updateAtRiskRule,
  type AtRiskRule,
} from "../../admin/domain/admin-domain-api";
import {
  sectionHeaderClassName,
  tableHeaderClassName,
  tableShellClassName,
} from "../analytics-studio-shared";
import { fieldClassName } from "../analytics-admin-shared";

function thresholdKeyForRule(rule: AtRiskRule): string | null {
  switch (rule.ruleType) {
    case "inactivity_days":
      return "inactivityDays";
    case "grade_below":
      return "gradeThreshold";
    case "low_activity_vs_cohort":
      return "cohortPercentile";
    default:
      return null;
  }
}

function thresholdLabelForRule(rule: AtRiskRule): string {
  switch (rule.ruleType) {
    case "inactivity_days":
      return "Inactivity days";
    case "grade_below":
      return "Grade threshold";
    case "low_activity_vs_cohort":
      return "Cohort percentile";
    default:
      return "Threshold";
  }
}

export function AnalyticsAtRiskRulesPanel({ enabled = true }: { enabled?: boolean }) {
  const [rules, setRules] = useState<AtRiskRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savingRuleId, setSavingRuleId] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    if (!enabled) return;
    setLoading(true);
    setErrorMessage(null);
    try {
      const response = await fetchAtRiskRules();
      setRules(response.data.rules);
    } catch {
      setErrorMessage("Unable to load at-risk rules.");
      setRules([]);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    void loadRules();
  }, [loadRules]);

  async function handleThresholdChange(rule: AtRiskRule, rawValue: string) {
    const key = thresholdKeyForRule(rule);
    if (!key) return;
    const parsed = Number(rawValue);
    if (!Number.isFinite(parsed)) return;

    setSavingRuleId(rule.id);
    setErrorMessage(null);
    try {
      const response = await updateAtRiskRule(rule.id, {
        config: { ...rule.config, [key]: parsed },
      });
      setRules((current) => current.map((entry) => (entry.id === rule.id ? response.data : entry)));
    } catch {
      setErrorMessage("Failed to update rule threshold.");
    } finally {
      setSavingRuleId(null);
    }
  }

  async function handleToggleActive(rule: AtRiskRule) {
    setSavingRuleId(rule.id);
    setErrorMessage(null);
    try {
      const nextStatus = rule.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      const response = await updateAtRiskRule(rule.id, { status: nextStatus });
      setRules((current) => current.map((entry) => (entry.id === rule.id ? response.data : entry)));
    } catch {
      setErrorMessage("Failed to update rule status.");
    } finally {
      setSavingRuleId(null);
    }
  }

  if (!enabled) return null;

  return (
    <section className={tableShellClassName} aria-label="At-risk rules">
      <div className={sectionHeaderClassName}>
        <div>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface)]">
            At-risk rules
          </h2>
          <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
            Adjust thresholds and enable or disable alert rules.
          </p>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] px-3 py-1.5 text-[11px] font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:opacity-50"
          onClick={() => void loadRules()}
          disabled={loading}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>

      {errorMessage ? (
        <div className="mx-4 mb-3 rounded-md border border-[var(--admin-danger)] px-3 py-2 text-sm text-[var(--admin-danger)]" role="alert">
          {errorMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">Loading rules…</div>
      ) : rules.length === 0 ? (
        <div className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">No rules configured.</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-left text-sm">
            <thead>
              <tr className={tableHeaderClassName}>
                <th scope="col" className="px-4 py-3">
                  Rule
                </th>
                <th scope="col" className="px-4 py-3">
                  Threshold
                </th>
                <th scope="col" className="px-4 py-3">
                  Active
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {rules.map((rule) => {
                const thresholdKey = thresholdKeyForRule(rule);
                const thresholdValue = thresholdKey ? Number(rule.config[thresholdKey] ?? "") : "";
                return (
                  <tr key={rule.id}>
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--admin-on-surface)]">{rule.name}</div>
                      <div className="text-xs text-[var(--admin-on-surface-variant)]">{rule.ruleType}</div>
                    </td>
                    <td className="px-4 py-3">
                      {thresholdKey ? (
                        <label className="block text-xs">
                          <span className="mb-1 block text-[var(--admin-on-surface-variant)]">
                            {thresholdLabelForRule(rule)}
                          </span>
                          <input
                            type="number"
                            className={`${fieldClassName} max-w-[120px]`}
                            defaultValue={Number.isFinite(thresholdValue) ? thresholdValue : ""}
                            disabled={savingRuleId === rule.id}
                            onBlur={(event) => {
                              void handleThresholdChange(rule, event.target.value);
                            }}
                          />
                        </label>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={rule.status === "ACTIVE"}
                          disabled={savingRuleId === rule.id || rule.status === "ARCHIVED"}
                          onChange={() => {
                            void handleToggleActive(rule);
                          }}
                        />
                        {rule.status === "ACTIVE" ? "Active" : "Inactive"}
                      </label>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
