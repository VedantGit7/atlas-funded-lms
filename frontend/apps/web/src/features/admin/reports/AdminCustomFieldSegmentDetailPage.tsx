"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  Info,
  MoreHorizontal,
  PieChart,
  RefreshCw,
  Search,
  Users,
  UserX,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { formatMoney } from "./admin-custom-field-roster-api";
import {
  createGroupFromSegment,
  downloadCsv,
  duplicateCustomFieldSegment,
  exportCustomFieldSegmentLearnersCsv,
  fetchCustomFieldSegmentLearners,
  fetchCustomFieldSegmentView,
  type CustomFieldSegmentItem,
  type SegmentAnalytics,
  type SegmentCondition,
  type SegmentLearnerRow,
} from "./admin-custom-field-segments-api";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";

function operatorLabel(operator: string): string {
  switch (operator) {
    case "is":
      return "is";
    case "is_not":
      return "is not";
    case "contains":
      return "contains";
    case "starts_with":
      return "starts with";
    case "is_empty":
      return "is empty";
    case "is_not_empty":
      return "is not empty";
    case "eq":
      return "=";
    case "neq":
      return "≠";
    case "gt":
      return "is above";
    case "lt":
      return "is below";
    case "between":
      return "between";
    case "is_true":
      return "is true";
    case "is_false":
      return "is false";
    case "is_any_of":
      return "is any of";
    case "is_none_of":
      return "is none of";
    case "before":
      return "before";
    case "after":
      return "after";
    case "in_last_n_days":
      return "in the last";
    default:
      return operator.replaceAll("_", " ");
  }
}

function formatConditionValue(condition: SegmentCondition): string[] {
  const op = condition.operator;
  if (op === "is_empty" || op === "is_not_empty" || op === "is_true" || op === "is_false") {
    return [];
  }
  if (Array.isArray(condition.value)) {
    return condition.value.map(String);
  }
  if (op === "in_last_n_days" && condition.value && typeof condition.value === "object") {
    const days = (condition.value as { days?: number }).days;
    return days != null ? [`${String(days)} days`] : [];
  }
  if (condition.value == null || condition.value === "") return [];
  return [
    typeof condition.value === "string" ||
    typeof condition.value === "number" ||
    typeof condition.value === "boolean"
      ? String(condition.value)
      : "",
  ];
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-sm bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${value.toLocaleString(undefined, {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  })}%`;
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function formatRelative(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const absHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
  if (absHours < 1) return "Just now";
  if (absHours < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absHours,
      "hour",
    );
  }
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
    Math.sign(diffMs) * absDays,
    "day",
  );
}

function fieldTypeMarker(fieldType: string): string {
  const normalized = fieldType.toLowerCase();
  if (normalized === "number") return "num";
  if (normalized === "boolean") return "bol";
  if (normalized === "select") return "sel";
  if (normalized === "date") return "dat";
  return "txt";
}

function statusPillClass(status: string): string {
  const upper = status.toUpperCase();
  if (upper === "ACTIVE") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  return "border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_8%,var(--admin-surface))] text-[var(--admin-on-surface-variant)]";
}

function initials(name: string | null, email: string | null): string {
  const source = name ?? email ?? "?";
  return source
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div className="space-y-2">
          <Shimmer className="h-8 w-64" />
          <Shimmer className="h-4 w-96" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="h-28 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
          >
            <Shimmer className="mb-3 h-3 w-20" />
            <Shimmer className="h-7 w-16" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
          <Shimmer className="h-4 w-40" />
        </div>
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
          >
            <Shimmer className="h-4 w-8 rounded-full" />
            <Shimmer className="h-4 w-32" />
            <Shimmer className="h-4 w-24" />
            <Shimmer className="ml-auto h-4 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminCustomFieldSegmentDetailPage({ segmentId }: { segmentId: string }) {
  const [segment, setSegment] = useState<CustomFieldSegmentItem | null>(null);
  const [analytics, setAnalytics] = useState<SegmentAnalytics | null>(null);
  const [zeroMatch, setZeroMatch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [learners, setLearners] = useState<SegmentLearnerRow[]>([]);
  const [fieldDefinitions, setFieldDefinitions] = useState<
    Array<{ id: string; key: string; label: string; fieldType: string }>
  >([]);
  const [learnersTotal, setLearnersTotal] = useState(0);
  const [learnersPage, setLearnersPage] = useState(1);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [searchDraft, setSearchDraft] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [cohortOpen, setCohortOpen] = useState(false);
  const [busyAction, setBusyAction] = useState(false);

  const loadView = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldSegmentView(segmentId);
      setSegment(response.data.segment);
      setAnalytics(response.data.analytics);
      setZeroMatch(response.data.zeroMatch);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't load segment analytics.");
      setSegment(null);
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [segmentId]);

  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    try {
      const response = await fetchCustomFieldSegmentLearners(segmentId, {
        ...(search ? { q: search } : {}),
        page: learnersPage,
        limit: 25,
      });
      setLearners(response.data.items);
      setFieldDefinitions(response.data.fieldDefinitions);
      setLearnersTotal(response.data.pageInfo.totalCount);
      if (
        !response.data.pageInfo.hasNextPage &&
        learnersPage > 1 &&
        response.data.items.length === 0
      ) {
        setLearnersPage(1);
      }
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Couldn't load matched learners.");
    } finally {
      setLearnersLoading(false);
    }
  }, [segmentId, search, learnersPage]);

  useEffect(() => {
    void loadView();
  }, [loadView]);

  useEffect(() => {
    if (!loading && !error) void loadLearners();
  }, [loading, error, loadLearners]);

  const visibleCustomFields = useMemo(() => fieldDefinitions.slice(0, 6), [fieldDefinitions]);

  const allSelected = learners.length > 0 && selected.size === learners.length;

  async function onDuplicate() {
    setBusyAction(true);
    try {
      const result = await duplicateCustomFieldSegment(segmentId);
      window.location.href = `/admin/reports/custom-field/segments/${result.data.id}`;
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Duplicate failed.");
    } finally {
      setBusyAction(false);
    }
  }

  async function onExportLearners() {
    setBusyAction(true);
    try {
      const response = await exportCustomFieldSegmentLearnersCsv(segmentId);
      downloadCsv(response.data.csv, response.data.filename);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Export failed.");
    } finally {
      setBusyAction(false);
    }
  }

  async function onCreateGroup() {
    setBusyAction(true);
    setCohortOpen(false);
    try {
      await createGroupFromSegment(segmentId, {
        ...(segment?.name ? { title: `${segment.name} group` } : {}),
      });
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not create group.");
    } finally {
      setBusyAction(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="segments" />
        <LoadingSkeleton />
      </div>
    );
  }

  if (error && !segment) {
    return (
      <div className="space-y-6">
        <CustomFieldReportTabs active="segments" />
        <div className="flex items-center justify-between gap-3 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
          <div className="flex items-center gap-3 text-sm text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="rounded-sm border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-semibold text-[var(--admin-danger)]"
            onClick={() => void loadView()}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!segment || !analytics) return null;

  const fieldLabels = new Map<string, string>();
  for (const definition of fieldDefinitions) {
    fieldLabels.set(`custom:${definition.key}`, definition.label);
    fieldLabels.set(definition.key, definition.label);
  }
  fieldLabels.set("learner:status", "Status");
  fieldLabels.set("learner:total_spent_cents", "Total spent");
  fieldLabels.set("learner:email", "Email");
  fieldLabels.set("learner:learner_name", "Learner");
  fieldLabels.set("learner:enrollment_count", "Enrolments");
  fieldLabels.set("learner:last_active_at", "Last active");
  fieldLabels.set("learner:signed_up_at", "Signed up");

  return (
    <div className="space-y-6">
      <nav className="flex flex-wrap items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
        <span>Admin</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <span>Reports</span>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/admin/reports/custom-field" className="hover:text-[var(--admin-on-surface)]">
          Custom Field
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link
          href="/admin/reports/custom-field/segments"
          className="hover:text-[var(--admin-on-surface)]"
        >
          Segments
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="font-medium text-[var(--admin-on-surface)]">{segment.name}</span>
      </nav>

      <CustomFieldReportTabs active="segments" />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-3">
          <div className="flex items-center gap-2 text-sm text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4" />
            {error}
          </div>
          <button
            type="button"
            className="rounded-sm border border-[var(--admin-danger)] bg-[var(--admin-surface)] px-3 py-1 text-xs font-semibold text-[var(--admin-danger)]"
            onClick={() => {
              setError(null);
              void loadView();
              void loadLearners();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {segment.name}
            </h1>
            <span
              className={`inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${
                segment.refreshMode === "live"
                  ? "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_10%,var(--admin-surface))] text-[var(--admin-success)]"
                  : "border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)]"
              }`}
            >
              {segment.refreshMode === "live" ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)]" />
              ) : null}
              {segment.refreshMode === "live" ? "Live" : "Snapshot"}
            </span>
            <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[var(--admin-on-surface-variant)]">
              {segment.visibility === "private" ? "Private" : "Shared"}
            </span>
            <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[var(--admin-on-surface-variant)]">
              {formatCount(analytics.matchedCount)} learners
            </span>
          </div>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {segment.conditionSummary}
          </p>
          <Link
            href="/admin/reports/custom-field/segments"
            className="inline-flex text-xs text-[var(--admin-primary)] hover:underline"
          >
            ← All segments
          </Link>
        </div>
        <div className="relative flex flex-wrap items-center gap-3">
          <Link
            href={`/admin/reports/custom-field/segments/${segmentId}/edit`}
            className={ghostButtonClassName}
          >
            Edit conditions
          </Link>
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={busyAction}
            onClick={() => void onExportLearners()}
          >
            <Download className="h-4 w-4" />
            Export CSV
          </button>
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={busyAction}
            onClick={() => void onDuplicate()}
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              setCohortOpen((open) => !open);
            }}
          >
            Cohort actions
            <ChevronDown className="h-4 w-4" />
          </button>
          {cohortOpen ? (
            <div className="absolute right-0 top-11 z-20 min-w-[200px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                onClick={() => void onCreateGroup()}
              >
                <Users className="h-3.5 w-3.5" />
                Create group
              </button>
              <Link
                href="/admin/reports/custom-field"
                className="block px-3 py-2 text-sm hover:bg-[var(--admin-surface-low)]"
                onClick={() => {
                  setCohortOpen(false);
                }}
              >
                Message learners
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
        <div className="flex h-28 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Matches
          </div>
          <div>
            <div className="font-mono text-[32px] font-medium leading-tight text-[var(--admin-on-surface)]">
              {formatCount(analytics.matchedCount)}
            </div>
            {analytics.matchedDelta != null ? (
              <div className="mt-1 flex items-center gap-2 text-xs">
                <span
                  className={`inline-flex items-center ${
                    analytics.matchedDelta >= 0
                      ? "text-[var(--admin-success)]"
                      : "text-[var(--admin-danger)]"
                  }`}
                >
                  <ArrowUp
                    className={`h-3.5 w-3.5 ${analytics.matchedDelta < 0 ? "rotate-180" : ""}`}
                  />
                  {Math.abs(analytics.matchedDelta)}
                </span>
                <span className="text-[var(--admin-on-surface-variant)]">
                  since {formatDateShort(analytics.matchedCountAt)}
                </span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="flex h-28 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Share of learners
          </div>
          <div>
            <div className="font-mono text-2xl text-[var(--admin-on-surface)]">
              {formatPct(analytics.shareOfLearnersPct)}
            </div>
            <div className="mt-2 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
              <div
                className="h-full rounded-full bg-[var(--admin-primary)]"
                style={{ width: `${String(Math.min(100, analytics.shareOfLearnersPct ?? 0))}%` }}
              />
            </div>
          </div>
        </div>
        <div className="flex h-28 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Avg Total Spent
          </div>
          <div className="font-mono text-2xl text-[var(--admin-on-surface)]">
            {analytics.averageTotalSpentCents == null
              ? "—"
              : formatMoney(analytics.averageTotalSpentCents, analytics.currency)}
          </div>
        </div>
        <div className="flex h-28 flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Avg Enrolments
          </div>
          <div className="font-mono text-2xl text-[var(--admin-on-surface)]">
            {analytics.averageEnrollmentCount == null
              ? "—"
              : analytics.averageEnrollmentCount.toLocaleString(undefined, {
                  maximumFractionDigits: 1,
                })}
          </div>
        </div>
        <div className="relative flex h-28 flex-col justify-between overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="relative z-10 text-xs uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
            Active 30 Days
          </div>
          <div className="relative z-10">
            <div className="font-mono text-2xl text-[var(--admin-on-surface)]">
              {formatCount(analytics.activeLast30DaysCount)}
            </div>
            <div className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
              {formatPct(analytics.activeLast30DaysPct)} of segment
            </div>
          </div>
          <div className="absolute -bottom-4 -right-4 z-0 h-24 w-24 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)]" />
        </div>
      </div>

      {zeroMatch ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-24 text-center">
          <UserX
            className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
            strokeWidth={1.25}
          />
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No learners currently match this segment
          </h2>
          <p className="mb-6 text-xs text-[var(--admin-on-surface-variant)]">
            {segment.matchedCountAt
              ? `Last refreshed ${formatRelative(segment.matchedCountAt)} (${formatDateShort(segment.matchedCountAt)})`
              : "This segment has never matched anyone."}
            {segment.previousMatchedCount != null
              ? ` · previously matched ${formatCount(segment.previousMatchedCount)}`
              : ""}
          </p>
          <Link
            href={`/admin/reports/custom-field/segments/${segmentId}/edit`}
            className={primaryButtonClassName}
          >
            Edit conditions
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-6 lg:flex-row">
            <div className="flex w-full flex-col gap-6 lg:w-[62%]">
              <div className="flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex items-center justify-between rounded-t-lg border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-5 py-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Segment Conditions
                  </h2>
                  <Link
                    href={`/admin/reports/custom-field/segments/${segmentId}/edit`}
                    className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
                  >
                    Edit conditions
                  </Link>
                </div>
                <div className="flex flex-col gap-4 p-5">
                  {segment.conditions.groups.map((group, groupIndex) => (
                    <div key={group.id} className="space-y-3">
                      {groupIndex > 0 ? (
                        <div className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                          {segment.conditions.rootCombinator}
                        </div>
                      ) : null}
                      {group.conditions.map((condition, conditionIndex) => {
                        const label =
                          fieldLabels.get(`${condition.fieldSource}:${condition.fieldKey}`) ??
                          condition.fieldKey;
                        const values = formatConditionValue(condition);
                        return (
                          <div key={condition.id} className="flex items-start gap-3">
                            <div className="mt-2 w-8 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                              {conditionIndex === 0 ? "IF" : group.combinator}
                            </div>
                            <div className="flex flex-1 flex-wrap items-center gap-2 rounded-sm border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_50%,var(--admin-surface))] p-3">
                              <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-1 text-sm font-medium shadow-sm">
                                {label}
                              </span>
                              <span className="text-sm text-[var(--admin-on-surface-variant)]">
                                {operatorLabel(condition.operator)}
                              </span>
                              {values.map((value) => (
                                <span
                                  key={value}
                                  className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-1 font-mono text-sm"
                                >
                                  {value}
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-1 flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="border-b border-[var(--admin-border)] px-5 py-4">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    How this segment differs
                  </h2>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Comparing segment custom fields against all active learners
                  </p>
                </div>
                <div className="flex flex-col gap-6 p-5">
                  {analytics.fieldDivergences.map((field, index) => (
                    <div key={field.fieldKey}>
                      {index > 0 ? (
                        <hr className="mb-6 border-dashed border-[var(--admin-border)]" />
                      ) : null}
                      <div className="mb-2 flex items-end justify-between gap-3">
                        <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {field.fieldLabel}
                        </div>
                        <div className="text-xs text-[var(--admin-on-surface-variant)]">
                          {field.caption}
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-3">
                        {field.buckets.map((bucket) => (
                          <div
                            key={bucket.value}
                            className="grid grid-cols-[100px_1fr_40px] items-center gap-4"
                          >
                            <div className="text-right text-sm text-[var(--admin-on-surface-variant)]">
                              {bucket.value}
                            </div>
                            <div className="relative flex h-6 w-full items-center">
                              <div className="absolute h-4 w-full rounded-sm bg-[var(--admin-surface-low)]" />
                              <div
                                className="absolute z-10 h-4 rounded-sm bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_20%,transparent)]"
                                style={{ width: `${String(Math.min(100, bucket.tenantPct))}%` }}
                              />
                              <div
                                className="absolute z-20 h-2 rounded-sm bg-[var(--admin-primary)]"
                                style={{ width: `${String(Math.min(100, bucket.segmentPct))}%` }}
                              />
                            </div>
                            <div className="text-right font-mono text-[13px]">
                              {formatPct(bucket.segmentPct)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  {analytics.fieldDivergences.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No select/boolean custom fields to compare yet.
                    </p>
                  ) : null}
                  {analytics.similarFieldCount > 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      {analytics.similarFieldCount} other fields match the tenant closely and are
                      collapsed here.
                    </p>
                  ) : null}
                  <div className="flex items-center justify-end gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-3 rounded-sm bg-[var(--admin-primary)]" />
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        Segment
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-sm bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_20%,transparent)]" />
                      <span className="text-xs text-[var(--admin-on-surface-variant)]">
                        Tenant average
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex w-full flex-col gap-6 lg:w-[38%]">
              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h3 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
                  Spend Distribution
                </h3>
                <p className="mb-4 text-xs text-[var(--admin-on-surface-variant)]">
                  Total spent ({analytics.currency}) distribution
                </p>
                <div className="relative mb-2 flex h-32 items-end gap-0.5">
                  {analytics.tenantMedianBucketIndex != null ? (
                    <div
                      className="absolute bottom-0 top-0 z-10 border-l border-dashed border-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)]"
                      style={{
                        left: `${String(((analytics.tenantMedianBucketIndex + 0.5) / Math.max(1, analytics.spendHistogram.length)) * 100)}%`,
                      }}
                    >
                      <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap bg-[var(--admin-surface)] px-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                        Tenant Med
                      </span>
                    </div>
                  ) : null}
                  {analytics.spendHistogram.map((bucket) => (
                    <div
                      key={bucket.label}
                      className="w-full rounded-t-sm bg-[var(--admin-primary)]"
                      style={{
                        height: `${String(Math.max(bucket.heightPct, bucket.count > 0 ? 4 : 2))}%`,
                        opacity: bucket.count > 0 ? 1 : 0.25,
                      }}
                      title={`${bucket.label}: ${String(bucket.count)}`}
                    />
                  ))}
                </div>
                <div className="mt-1 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  <span>{analytics.spendHistogram[0]?.label ?? "—"}</span>
                  <span>
                    {analytics.spendHistogram[Math.floor(analytics.spendHistogram.length / 2)]
                      ?.label ?? ""}
                  </span>
                  <span>
                    {analytics.spendHistogram[analytics.spendHistogram.length - 1]?.label ?? ""}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h3 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
                  Signup Cohort
                </h3>
                <p className="mb-4 text-xs text-[var(--admin-on-surface-variant)]">
                  When these learners joined
                </p>
                <div className="flex flex-col gap-2">
                  {analytics.signupCohorts.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No signup data.
                    </p>
                  ) : (
                    analytics.signupCohorts.map((cohort) => (
                      <div key={cohort.label} className="flex items-center gap-3">
                        <span className="w-12 text-right text-xs text-[var(--admin-on-surface-variant)]">
                          {cohort.label}
                        </span>
                        <div className="h-3 flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
                          <div
                            className="h-full rounded-full bg-[var(--admin-primary)]"
                            style={{ width: `${String(cohort.pct)}%` }}
                          />
                        </div>
                        <span className="w-8 font-mono text-xs">{cohort.count}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h3 className="mb-1 text-base font-semibold text-[var(--admin-on-surface)]">
                  Segment Overlap
                </h3>
                <p className="mb-4 text-xs text-[var(--admin-on-surface-variant)]">
                  Top overlapping segments
                </p>
                <div className="flex flex-col gap-3">
                  {analytics.overlaps.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No overlapping segments yet.
                    </p>
                  ) : (
                    analytics.overlaps.map((overlap, index) => (
                      <div
                        key={overlap.segmentId}
                        className={`flex items-center justify-between ${
                          index < analytics.overlaps.length - 1
                            ? "border-b border-[var(--admin-border)] pb-2"
                            : ""
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <PieChart className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
                          <Link
                            href={`/admin/reports/custom-field/segments/${overlap.segmentId}`}
                            className="text-sm font-medium hover:text-[var(--admin-primary)]"
                          >
                            {overlap.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">
                            {formatCount(overlap.overlapCount)}
                          </span>
                          <span className="rounded-sm bg-[var(--admin-surface-low)] px-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                            {formatPct(overlap.overlapPct)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2 flex flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-col justify-between gap-3 rounded-t-lg border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 sm:flex-row sm:items-center">
              <div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  Matched Learners ({formatCount(learnersTotal)})
                </h2>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  <Info className="h-3.5 w-3.5" />
                  This list refreshes every time the segment is used.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    className="h-9 w-64 rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-9 pr-4 text-sm outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    placeholder="Search learners…"
                    value={searchDraft}
                    onChange={(event) => {
                      setSearchDraft(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setLearnersPage(1);
                        setSearch(searchDraft.trim());
                      }
                    }}
                  />
                </div>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => {
                    setLearnersPage(1);
                    setSearch(searchDraft.trim());
                  }}
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {selected.size > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color-mix(in_srgb,var(--admin-primary)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] px-4 py-2">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[var(--admin-primary)]">
                    {selected.size} learners selected
                  </span>
                  <button
                    type="button"
                    className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-2 py-1 text-xs"
                    onClick={() => {
                      setSelected(new Set());
                    }}
                  >
                    Clear
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-medium"
                    onClick={() => void onCreateGroup()}
                  >
                    Create group
                  </button>
                  <button
                    type="button"
                    className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-1.5 text-xs font-medium"
                    onClick={() => void onExportLearners()}
                  >
                    Export selection
                  </button>
                </div>
              </div>
            ) : null}

            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[1000px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                    <th className="sticky left-0 z-10 h-10 w-12 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(event) => {
                          if (event.target.checked) {
                            setSelected(new Set(learners.map((row) => row.membershipId)));
                          } else {
                            setSelected(new Set());
                          }
                        }}
                        aria-label="Select all"
                      />
                    </th>
                    <th className="sticky left-[49px] z-10 h-10 w-[240px] border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Learner
                    </th>
                    <th className="h-10 px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Status
                    </th>
                    {visibleCustomFields.map((field) => (
                      <th
                        key={field.key}
                        className="h-10 px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
                      >
                        <div className="flex items-center gap-1">
                          <span className="rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-1 py-0.5 font-mono text-[10px]">
                            {fieldTypeMarker(field.fieldType)}
                          </span>
                          {field.label}
                        </div>
                      </th>
                    ))}
                    <th className="h-10 px-4 text-right font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Total Spent
                    </th>
                    <th className="h-10 px-4 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Last Active
                    </th>
                    <th className="h-10 w-12 px-4" />
                  </tr>
                </thead>
                <tbody>
                  {learnersLoading ? (
                    <tr>
                      <td
                        colSpan={8 + visibleCustomFields.length}
                        className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        Loading learners…
                      </td>
                    </tr>
                  ) : learners.length === 0 ? (
                    <tr>
                      <td
                        colSpan={8 + visibleCustomFields.length}
                        className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        No learners on this page.
                      </td>
                    </tr>
                  ) : (
                    learners.map((row) => {
                      const isSelected = selected.has(row.membershipId);
                      return (
                        <tr
                          key={row.membershipId}
                          className={`h-11 border-b border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] ${
                            isSelected
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                              : "bg-[var(--admin-surface)]"
                          }`}
                        >
                          <td
                            className={`sticky left-0 z-10 border-r border-[var(--admin-border)] px-4 ${
                              isSelected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                                : "bg-[var(--admin-surface)]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) => {
                                setSelected((prev) => {
                                  const next = new Set(prev);
                                  if (event.target.checked) next.add(row.membershipId);
                                  else next.delete(row.membershipId);
                                  return next;
                                });
                              }}
                              aria-label={`Select ${row.learnerName ?? row.email ?? "learner"}`}
                            />
                          </td>
                          <td
                            className={`sticky left-[49px] z-10 border-r border-[var(--admin-border)] px-4 ${
                              isSelected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                                : "bg-[var(--admin-surface)]"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[10px] font-bold">
                                {initials(row.learnerName, row.email)}
                              </div>
                              <div className="min-w-0">
                                <Link
                                  href={`/admin/reports/custom-field/learners/${row.membershipId}`}
                                  className="block truncate text-sm font-medium text-[var(--admin-on-surface)] hover:text-[var(--admin-primary)]"
                                >
                                  {row.learnerName ?? "—"}
                                </Link>
                                <div className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                                  {row.email ?? "—"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4">
                            <span
                              className={`inline-flex rounded-sm border px-2 py-0.5 font-mono text-[11px] font-semibold uppercase ${statusPillClass(row.status)}`}
                            >
                              {row.status}
                            </span>
                          </td>
                          {visibleCustomFields.map((field) => (
                            <td key={field.key} className="px-4 text-sm">
                              {row.customFields[field.key] ?? (
                                <span className="text-[var(--admin-on-surface-variant)]">—</span>
                              )}
                            </td>
                          ))}
                          <td className="px-4 text-right font-mono text-sm">
                            {formatMoney(row.totalSpentCents, row.currency)}
                          </td>
                          <td className="px-4 text-sm text-[var(--admin-on-surface-variant)]">
                            {formatRelative(row.lastActiveAt)}
                          </td>
                          <td className="px-4">
                            <MoreHorizontal className="h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]" />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
              <span>
                Showing {learners.length} of {formatCount(learnersTotal)} matched learners
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={learnersPage <= 1}
                  onClick={() => {
                    setLearnersPage((page) => Math.max(1, page - 1));
                  }}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  disabled={learnersPage * 25 >= learnersTotal}
                  onClick={() => {
                    setLearnersPage((page) => page + 1);
                  }}
                >
                  Load more
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
