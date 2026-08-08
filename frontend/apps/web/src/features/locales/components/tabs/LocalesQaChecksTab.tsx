"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, EmptyState, Skeleton } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import {
  localesAlertErrorClassName,
  localesAlertSuccessClassName,
  localesMonoKeyClassName,
  localesPrimaryButtonClassName,
  localesTableHeadClassName,
  localesTableRowClassName,
  localesTableShellClassName,
} from "../../locales-admin-shared";
import { formatRelativeTime } from "../../locales-admin-utils";

type QaIssue = {
  id: string;
  locale: string;
  key: string;
  severity: "error" | "warning" | "info";
  issueType: string;
  message: string;
  createdAt: string;
};

type QaRun = {
  id: string;
  issueCount: number;
  startedAt: string;
  completedAt: string;
};

type LocalesQaChecksTabProps = {
  canManage: boolean;
};

export function LocalesQaChecksTab({ canManage }: LocalesQaChecksTabProps) {
  const [run, setRun] = useState<QaRun | null>(null);
  const [issues, setIssues] = useState<QaIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageTone, setMessageTone] = useState<"error" | "success">("error");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await clientApi.get<{ data: { run: QaRun | null; issues: QaIssue[] } }>(
        "/api/v1/locales/qa-checks",
      );
      setRun(response.data.run);
      setIssues(response.data.issues);
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "Failed to load QA checks.");
      setMessageTone("error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function runChecks() {
    if (!canManage) return;
    setRunning(true);
    setMessage(null);
    try {
      const response = await clientApi.post<{ data: { run: QaRun; issues: QaIssue[] } }>(
        "/api/v1/locales/qa-checks",
        {},
        `locale-qa-run-${Date.now()}`,
      );
      setRun(response.data.run);
      setIssues(response.data.issues);
      setMessage(`QA run completed with ${response.data.issues.length} issue(s).`);
      setMessageTone("success");
    } catch (caught) {
      setMessage(caught instanceof ClientApiError ? caught.message : "QA run failed.");
      setMessageTone("error");
    } finally {
      setRunning(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-hidden="true">
        <Skeleton className="h-10 w-full bg-[var(--admin-surface-high)]" />
        <Skeleton className="h-48 w-full bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Automated QA checks</h2>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            {run
              ? `Last run ${formatRelativeTime(run.completedAt)} — ${run.issueCount} issue(s)`
              : "No QA run recorded yet."}
          </p>
        </div>
        {canManage ? (
          <Button
            className={localesPrimaryButtonClassName}
            disabled={running}
            onClick={() => void runChecks()}
          >
            {running ? "Running…" : "Run QA checks"}
          </Button>
        ) : null}
      </div>

      {message ? (
        <div
          role="alert"
          className={messageTone === "success" ? localesAlertSuccessClassName : localesAlertErrorClassName}
        >
          {message}
        </div>
      ) : null}

      {issues.length === 0 ? (
        <EmptyState
          title="No QA issues"
          description="Run checks to detect missing keys, placeholder mismatches, and length warnings."
          className="border-[var(--admin-border)] bg-[var(--admin-surface)] [&_h2]:text-[var(--admin-on-surface)] [&_p]:text-[var(--admin-on-surface-variant)]"
        />
      ) : (
        <div className={localesTableShellClassName}>
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`${localesTableRowClassName} hover:bg-transparent`}>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Severity</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Locale</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Key</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Issue</th>
              </tr>
            </thead>
            <tbody>
              {issues.map((issue) => (
                <tr key={issue.id} className={localesTableRowClassName}>
                  <td className="px-4 py-3 capitalize text-[var(--admin-on-surface)]">{issue.severity}</td>
                  <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">{issue.locale}</td>
                  <td className="px-4 py-3">
                    <code className={localesMonoKeyClassName}>{issue.key}</code>
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">{issue.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
