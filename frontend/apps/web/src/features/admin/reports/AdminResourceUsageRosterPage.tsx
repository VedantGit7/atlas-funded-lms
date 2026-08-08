"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  analyticsAlertErrorClassName,
  analyticsExportButtonClassName,
  analyticsTableHeadClassName,
  analyticsTableRowClassName,
  analyticsTableShellClassName,
  fieldClassName,
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import {
  generalSettingsFormCardClassName,
  generalSettingsPageDescClassName,
  generalSettingsPageTitleClassName,
} from "../general-settings/general-settings-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  RESOURCE_USAGE_METRIC_OPTIONS,
  exportResourceUsageReport,
  fetchResourceUsageDormant,
  fetchResourceUsageHistory,
  fetchResourceUsageInactive,
  fetchResourceUsageOverview,
  type ResourceUsageDormantItem,
  type ResourceUsageHistoryItem,
  type ResourceUsageInactiveItem,
  type ResourceUsageOverview,
} from "./admin-resource-usage-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type Tab = "overview" | "history" | "dormant" | "inactive";

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString();
}

function formatGb(value: number): string {
  if (!Number.isFinite(value)) return "—";
  if (value < 0.01 && value > 0) return "<0.01 GB";
  return `${value.toFixed(2)} GB`;
}

function formatCount(value: number): string {
  return value.toLocaleString();
}

function MeterCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <p className="text-xs text-neutral-500">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-neutral-500">{hint}</p> : null}
    </div>
  );
}

export function AdminResourceUsageRosterPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<ResourceUsageOverview | null>(null);
  const [historyItems, setHistoryItems] = useState<ResourceUsageHistoryItem[]>([]);
  const [dormantItems, setDormantItems] = useState<ResourceUsageDormantItem[]>([]);
  const [inactiveItems, setInactiveItems] = useState<ResourceUsageInactiveItem[]>([]);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [searchQ, setSearchQ] = useState("");
  const [metricKey, setMetricKey] = useState("");

  const loadOverview = useCallback(async () => {
    setOverviewLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageOverview();
      setOverview(response.data);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load Resource Usage overview.",
      );
      setOverview(null);
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageHistory({
        ...(metricKey ? { metricKey } : {}),
        page,
      });
      setHistoryItems(response.data.items);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load usage history.",
      );
      setHistoryItems([]);
    } finally {
      setListLoading(false);
    }
  }, [metricKey, page]);

  const loadDormant = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageDormant({
        ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
        page,
      });
      setDormantItems(response.data.items);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load dormant content.",
      );
      setDormantItems([]);
    } finally {
      setListLoading(false);
    }
  }, [page, searchQ]);

  const loadInactive = useCallback(async () => {
    setListLoading(true);
    setError(null);
    try {
      const response = await fetchResourceUsageInactive({
        ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
        page,
      });
      setInactiveItems(response.data.items);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load inactive learners.",
      );
      setInactiveItems([]);
    } finally {
      setListLoading(false);
    }
  }, [page, searchQ]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  useEffect(() => {
    if (tab === "overview") return;
    if (tab === "history") {
      void loadHistory();
      return;
    }
    if (tab === "dormant") {
      void loadDormant();
      return;
    }
    void loadInactive();
  }, [loadDormant, loadHistory, loadInactive, tab]);

  function switchTab(next: Tab) {
    setTab(next);
    setPage(1);
    setError(null);
  }

  async function handleExport() {
    if (tab === "overview") return;
    setBusy(true);
    setError(null);
    try {
      const reportTab = tab === "history" ? "history" : tab === "dormant" ? "dormant" : "inactive";
      const response = await exportResourceUsageReport({
        reportTab,
        ...(tab === "history" && metricKey ? { metricKey } : {}),
        ...((tab === "dormant" || tab === "inactive") && searchQ.trim()
          ? { q: searchQ.trim() }
          : {}),
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      if (completed.status === "completed") {
        await downloadReportExport(completed.id, "csv");
      }
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  const meters = overview?.meters;
  const optimization = overview?.optimization;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className={generalSettingsPageTitleClassName}>Resource Usage</h1>
          <p className={generalSettingsPageDescClassName}>
            Live plan meters, monthly usage history, and optimization lists for dormant content
            and inactive learners (30-day rules).
          </p>
        </div>
        <Link href="/admin/usagedashboard" prefetch={false} className={ghostButtonClassName}>
          Open Usage Insights
        </Link>
      </div>

      {error ? <div className={analyticsAlertErrorClassName}>{error}</div> : null}

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["overview", "Overview"],
            ["history", "History"],
            ["dormant", "Dormant content"],
            ["inactive", "Inactive learners"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={tab === key ? primaryButtonClassName : ghostButtonClassName}
            onClick={() => switchTab(key)}
          >
            {label}
            {key === "dormant" && optimization
              ? ` (${optimization.dormantContentCount})`
              : null}
            {key === "inactive" && optimization
              ? ` (${optimization.inactiveLearnerCount})`
              : null}
          </button>
        ))}
      </div>

      {tab === "overview" ? (
        <section className={generalSettingsFormCardClassName}>
          {overviewLoading ? (
            <p className="text-sm text-neutral-600">Loading meters…</p>
          ) : (
            <>
              <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <MeterCard label="Storage" value={formatGb(meters?.storageGb ?? 0)} />
                <MeterCard
                  label="Active users (30d)"
                  value={formatCount(meters?.activeUsers30d ?? 0)}
                />
                <MeterCard label="Current MAU" value={formatCount(meters?.currentMau ?? 0)} />
                <MeterCard
                  label="Total learners"
                  value={formatCount(meters?.totalLearners ?? 0)}
                />
                <MeterCard label="Tests taken" value={formatCount(meters?.testSubmits ?? 0)} />
                <MeterCard label="Products" value={formatCount(meters?.products ?? 0)} />
                <MeterCard label="Questions" value={formatCount(meters?.questions ?? 0)} />
                <MeterCard
                  label="Message sends (month)"
                  value={formatCount(meters?.messageSends ?? 0)}
                />
                <MeterCard
                  label="Bandwidth"
                  value={formatGb(meters?.bandwidthGb ?? 0)}
                  hint="Not metered yet"
                />
                <MeterCard
                  label="DRM tokens"
                  value={formatCount(meters?.drmTokens ?? 0)}
                  hint="Not metered yet"
                />
                <MeterCard
                  label="Video transcoding"
                  value={`${(meters?.videoTranscodingHours ?? 0).toFixed(1)} h`}
                  hint="Not metered yet"
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">Dormant content (30d)</p>
                  <p className="text-xl font-semibold text-amber-950">
                    {formatCount(optimization?.dormantContentCount ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    {formatGb(optimization?.dormantStorageGb ?? 0)} attached storage
                  </p>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-xs text-amber-800">Inactive learners (30d)</p>
                  <p className="text-xl font-semibold text-amber-950">
                    {formatCount(optimization?.inactiveLearnerCount ?? 0)}
                  </p>
                  <p className="mt-1 text-xs text-amber-800">
                    No activity in the last 30 days
                  </p>
                </div>
                <div className="rounded-lg border border-neutral-200 p-3">
                  <p className="text-xs text-neutral-500">Optimize</p>
                  <p className="mt-1 text-sm text-neutral-700">
                    Archive dormant courses or inactive learners to reclaim plan capacity. Open
                    the tabs above for full lists and CSV export.
                  </p>
                </div>
              </div>
            </>
          )}
        </section>
      ) : null}

      {tab !== "overview" ? (
        <section className={generalSettingsFormCardClassName}>
          <div className="mb-3 flex flex-wrap items-end gap-3">
            {tab === "history" ? (
              <label className="grid gap-1 text-sm">
                Metric
                <select
                  className={fieldClassName}
                  value={metricKey}
                  onChange={(event) => {
                    setMetricKey(event.target.value);
                    setPage(1);
                  }}
                >
                  {RESOURCE_USAGE_METRIC_OPTIONS.map((option) => (
                    <option key={option.value || "all"} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <label className="grid gap-1 text-sm">
                Search
                <input
                  className={fieldClassName}
                  value={searchQ}
                  onChange={(event) => setSearchQ(event.target.value)}
                  placeholder={tab === "dormant" ? "Course title" : "Name or email"}
                />
              </label>
            )}
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={() => {
                setPage(1);
                if (tab === "history") void loadHistory();
                else if (tab === "dormant") void loadDormant();
                else void loadInactive();
              }}
            >
              Apply
            </button>
            <button
              type="button"
              className={analyticsExportButtonClassName}
              disabled={busy || listLoading}
              onClick={() => void handleExport()}
            >
              {busy ? "Exporting…" : "Export CSV"}
            </button>
          </div>

          {listLoading ? (
            <p className="text-sm text-neutral-600">Loading…</p>
          ) : tab === "history" ? (
            <div className={analyticsTableShellClassName}>
              <table className="min-w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-3 py-2">Metric</th>
                    <th className="px-3 py-2">Period</th>
                    <th className="px-3 py-2">Value</th>
                    <th className="px-3 py-2">Calculated</th>
                  </tr>
                </thead>
                <tbody>
                  {historyItems.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-neutral-500" colSpan={4}>
                        No usage history snapshots yet. Snapshots appear after monthly usage jobs
                        run.
                      </td>
                    </tr>
                  ) : (
                    historyItems.map((item) => (
                      <tr
                        key={`${item.metricKey}-${item.period}`}
                        className={analyticsTableRowClassName}
                      >
                        <td className="px-3 py-2">{item.metricLabel}</td>
                        <td className="px-3 py-2">{item.period}</td>
                        <td className="px-3 py-2">
                          {item.unit === "GB"
                            ? formatGb(item.value)
                            : formatCount(item.value)}
                        </td>
                        <td className="px-3 py-2">{formatDate(item.calculatedAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : tab === "dormant" ? (
            <div className={analyticsTableShellClassName}>
              <table className="min-w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-3 py-2">Course</th>
                    <th className="px-3 py-2">Lessons</th>
                    <th className="px-3 py-2">Storage</th>
                    <th className="px-3 py-2">Last learner activity</th>
                    <th className="px-3 py-2">Created</th>
                  </tr>
                </thead>
                <tbody>
                  {dormantItems.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-neutral-500" colSpan={5}>
                        No dormant published courses in the last 30 days.
                      </td>
                    </tr>
                  ) : (
                    dormantItems.map((item) => (
                      <tr key={item.courseId} className={analyticsTableRowClassName}>
                        <td className="px-3 py-2">
                          <div className="font-medium">{item.title}</div>
                          <div className="text-xs text-neutral-500">{item.status}</div>
                        </td>
                        <td className="px-3 py-2">{item.lessonCount}</td>
                        <td className="px-3 py-2">{formatGb(item.storageGb)}</td>
                        <td className="px-3 py-2">{formatDate(item.lastLearnerActivityAt)}</td>
                        <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className={analyticsTableShellClassName}>
              <table className="min-w-full text-left text-sm">
                <thead className={analyticsTableHeadClassName}>
                  <tr>
                    <th className="px-3 py-2">Learner</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Last active</th>
                    <th className="px-3 py-2">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {inactiveItems.length === 0 ? (
                    <tr>
                      <td className="px-3 py-4 text-neutral-500" colSpan={4}>
                        No inactive learners in the last 30 days.
                      </td>
                    </tr>
                  ) : (
                    inactiveItems.map((item) => (
                      <tr key={item.membershipId} className={analyticsTableRowClassName}>
                        <td className="px-3 py-2">{item.learnerName ?? "—"}</td>
                        <td className="px-3 py-2">{item.email ?? "—"}</td>
                        <td className="px-3 py-2">{formatDate(item.lastActiveAt)}</td>
                        <td className="px-3 py-2">{formatDate(item.createdAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 ? (
            <div className="mt-3 flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </button>
              <span className="text-sm text-neutral-600">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={page >= totalPages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
