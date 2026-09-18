"use client";

import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import {
  localesAlertErrorClassName,
  localesTableHeadClassName,
  localesTableRowClassName,
  localesTableShellClassName,
} from "../../locales-admin-shared";
import { formatRelativeTime } from "../../locales-admin-utils";

type OverviewData = {
  localeCount: number;
  resourceCount: number;
  canonicalKeyCount: number;
  pendingReviewCount: number;
  qaIssueCount: number;
  lastQaRunAt: string | null;
  defaultLocale: string;
  fallbackLocale: string | null;
};

type CoverageEntry = {
  locale: string;
  totalCanonicalKeys: number;
  translatedCount: number;
  coveragePercent: number;
  missingKeys: string[];
};

type LocalesOverviewTabProps = {
  canManage: boolean;
};

export function LocalesOverviewTab({ canManage }: LocalesOverviewTabProps) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [coverage, setCoverage] = useState<CoverageEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [overviewResponse, coverageResponse] = await Promise.all([
        clientApi.get<{ data: OverviewData }>("/api/v1/locales/overview"),
        clientApi.get<{ data: CoverageEntry[] }>("/api/v1/locales/coverage"),
      ]);
      setOverview(overviewResponse.data);
      setCoverage(coverageResponse.data);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Failed to load overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="space-y-4 p-6" aria-hidden="true">
        <Skeleton className="h-24 w-full bg-[var(--admin-surface-high)]" />
        <Skeleton className="h-48 w-full bg-[var(--admin-surface-high)]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div role="alert" className={localesAlertErrorClassName}>
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Locales", value: overview?.localeCount ?? 0 },
          { label: "Strings", value: overview?.resourceCount ?? 0 },
          { label: "Canonical keys", value: overview?.canonicalKeyCount ?? 0 },
          { label: "Pending review", value: overview?.pendingReviewCount ?? 0 },
        ].map((card) => (
          <div
            key={card.label}
            className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              {card.label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--admin-on-surface)]">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Locale health</h2>
        <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-[var(--admin-on-surface-variant)]">Default locale</dt>
            <dd className="font-mono text-[var(--admin-on-surface)]">
              {overview?.defaultLocale ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--admin-on-surface-variant)]">Fallback locale</dt>
            <dd className="font-mono text-[var(--admin-on-surface)]">
              {overview?.fallbackLocale ?? "—"}
            </dd>
          </div>
          <div>
            <dt className="text-[var(--admin-on-surface-variant)]">Open QA issues</dt>
            <dd className="text-[var(--admin-on-surface)]">{overview?.qaIssueCount ?? 0}</dd>
          </div>
          <div>
            <dt className="text-[var(--admin-on-surface-variant)]">Last QA run</dt>
            <dd className="text-[var(--admin-on-surface)]">
              {overview?.lastQaRunAt ? formatRelativeTime(overview.lastQaRunAt) : "Never"}
            </dd>
          </div>
        </dl>
        {!canManage ? (
          <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">Read-only overview.</p>
        ) : null}
      </div>

      <div className={localesTableShellClassName}>
        <div className="border-b border-[var(--admin-border)] px-4 py-3">
          <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
            Coverage by locale
          </h2>
          <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
            Completion is measured against the canonical key registry, not raw key counts.
          </p>
        </div>
        {coverage.length === 0 ? (
          <p className="p-4 text-sm text-[var(--admin-on-surface-variant)]">
            No locale coverage yet. Register canonical keys by saving strings in the default locale.
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className={`${localesTableRowClassName} hover:bg-transparent`}>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Locale</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Coverage</th>
                <th className={`${localesTableHeadClassName} px-4 py-2`}>Missing keys</th>
              </tr>
            </thead>
            <tbody>
              {coverage.map((entry) => (
                <tr key={entry.locale} className={localesTableRowClassName}>
                  <td className="px-4 py-3 font-mono text-[var(--admin-on-surface)]">
                    {entry.locale}
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                    {entry.coveragePercent}% ({entry.translatedCount}/{entry.totalCanonicalKeys})
                  </td>
                  <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                    {entry.missingKeys.length === 0
                      ? "None"
                      : `${entry.missingKeys.length} missing`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
