"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Download,
  EyeOff,
  Filter,
  GitCompareArrows,
  RefreshCw,
  Search,
  Settings2,
  Video,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportPollReport,
  fetchPollsRoster,
  type PollListItem,
  type PollsListSummary,
  type PollsListView,
} from "./admin-polls-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ModuleTab = "polls" | "live" | "compare" | "exports";

const PAGE_SIZE = 25;

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

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

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function statusPillClass(poll: PollListItem): string {
  if (poll.isOpen) {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (poll.status.toUpperCase() === "ARCHIVED") {
    return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
}

function statusLabel(poll: PollListItem): string {
  if (poll.isOpen) return "Open";
  if (poll.status.toUpperCase() === "ARCHIVED") return "Archived";
  return "Closed";
}

function PollBarsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="48"
      height="48"
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="8" y="12" width="20" height="4" rx="2" fill="currentColor" />
      <rect
        x="8"
        y="12"
        width="32"
        height="4"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="8" y="22" width="28" height="4" rx="2" fill="currentColor" />
      <rect
        x="8"
        y="22"
        width="32"
        height="4"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="8" y="32" width="12" height="4" rx="2" fill="currentColor" />
      <rect
        x="8"
        y="32"
        width="32"
        height="4"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}

function PollsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
        <div className="relative overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 lg:col-span-2">
          <Shimmer className="mb-2 h-3 w-32" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="mt-2 h-3 w-24" />
        </div>
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-2 h-3 w-28" />
          <Shimmer className="h-7 w-20" />
          <Shimmer className="mt-4 h-[3px] w-full" />
        </div>
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-2 h-3 w-20" />
          <Shimmer className="h-7 w-12" />
          <Shimmer className="mt-2 h-3 w-28" />
        </div>
        <div className="flex flex-col gap-4">
          <Shimmer className="h-[72px] w-full rounded-lg" />
          <Shimmer className="h-[72px] w-full rounded-lg" />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] p-4">
          <div className="flex gap-3">
            <Shimmer className="h-8 w-24" />
            <Shimmer className="h-8 w-32" />
          </div>
          <Shimmer className="h-8 w-48" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] border-collapse text-left">
            <thead className="bg-[var(--admin-surface-low)]">
              <tr>
                {Array.from({ length: 5 }).map((_, index) => (
                  <th key={index} className="border-b border-[var(--admin-border)] p-4">
                    <Shimmer className={`h-3 ${index === 0 ? "w-24" : "ml-auto w-16"}`} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 5 }).map((_, rowIndex) => (
                <tr key={rowIndex} className="h-11 border-b border-[var(--admin-border)]">
                  <td className="p-4">
                    <div
                      className="relative h-4 overflow-hidden rounded-sm bg-[var(--admin-surface-high)] after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite] after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent"
                      style={{ width: `${String(55 + ((rowIndex * 13) % 30))}%` }}
                    />
                  </td>
                  <td className="p-4">
                    <Shimmer className="ml-auto h-4 w-12" />
                  </td>
                  <td className="p-4">
                    <Shimmer className="ml-auto h-4 w-16" />
                  </td>
                  <td className="p-4">
                    <Shimmer className="ml-auto h-4 w-14" />
                  </td>
                  <td className="p-4">
                    <Shimmer className="ml-auto h-4 w-10" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t border-[var(--admin-border)] p-4">
          <Shimmer className="h-4 w-32" />
          <div className="flex gap-2">
            <Shimmer className="h-8 w-8" />
            <Shimmer className="h-8 w-8" />
            <Shimmer className="h-8 w-8" />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyPollsState({
  hasFilters,
  onClear,
  onManage,
}: {
  hasFilters: boolean;
  onClear: () => void;
  onManage: () => void;
}) {
  return (
    <div className="flex min-h-[400px] flex-1 flex-col items-center justify-center bg-gradient-to-b from-transparent to-[color-mix(in_srgb,var(--admin-primary)_4%,transparent)] px-6 py-16 text-center">
      <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-[var(--admin-surface-low)] opacity-60" />
        <PollBarsIcon className="relative z-10 text-[var(--admin-outline)]" />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        {hasFilters ? "No polls match these filters" : "No polls yet"}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
        {hasFilters
          ? "Polls are created in Products - Poll, or launched during a live session. Adjust filters to see matching results."
          : "Create a poll in Manage polls, or launch one during a live session to start collecting responses."}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        {hasFilters ? (
          <button type="button" className={secondaryButtonClassName} onClick={onClear}>
            Clear filters
          </button>
        ) : null}
        <button type="button" className={primaryButtonClassName} onClick={onManage}>
          <Settings2 className="h-4 w-4" aria-hidden="true" />
          Manage polls
        </button>
      </div>
    </div>
  );
}

function ErrorPollsPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div
        className="flex flex-col gap-3 border-b border-[color-mix(in_srgb,var(--admin-danger)_20%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <div className="flex items-start gap-3 text-[var(--admin-danger)]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold">Couldn&apos;t load polls.</p>
            <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_75%,var(--admin-on-surface))]">
              {message}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
      <div className="w-full">
        <div className="flex h-11 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          <div className="min-w-0 flex-[2]">Poll</div>
          <div className="min-w-0 flex-1 text-right">Type</div>
          <div className="min-w-0 flex-1 text-right">Responses</div>
          <div className="w-32 text-right">Status</div>
        </div>
        {[0.3, 0.2, 0.1].map((opacity, index) => (
          <div
            key={index}
            className="flex h-11 items-center border-b border-[var(--admin-border)] px-6 last:border-b-0"
            style={{ opacity }}
          >
            <div className="min-w-0 flex-[2]">
              <div
                className="h-4 rounded bg-[var(--admin-surface-high)]"
                style={{ width: `${String(70 - index * 12)}%` }}
              />
            </div>
            <div className="flex min-w-0 flex-1 justify-end">
              <div className="h-4 w-1/2 rounded bg-[var(--admin-surface-high)]" />
            </div>
            <div className="flex min-w-0 flex-1 justify-end">
              <div className="h-4 w-1/3 rounded bg-[var(--admin-surface-high)]" />
            </div>
            <div className="flex w-32 justify-end">
              <div className="h-6 w-16 rounded-full bg-[var(--admin-surface-high)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AdminPollsRosterPage() {
  const router = useRouter();
  const searchId = useId();

  const [moduleTab, setModuleTab] = useState<ModuleTab>("polls");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(false);

  const [polls, setPolls] = useState<PollListItem[]>([]);
  const [summary, setSummary] = useState<PollsListSummary | null>(null);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [draftSearch, setDraftSearch] = useState("");
  const [searchQ, setSearchQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [pollType, setPollType] = useState("");
  const [view, setView] = useState<PollsListView>("all");
  const [createdFrom, setCreatedFrom] = useState("");
  const [createdTo, setCreatedTo] = useState("");

  const hasActiveFilters = useMemo(
    () =>
      Boolean(searchQ || statusFilter || pollType || view !== "all" || createdFrom || createdTo),
    [createdFrom, createdTo, pollType, searchQ, statusFilter, view],
  );

  const loadPolls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPollsRoster({
        q: searchQ.trim() || undefined,
        status: statusFilter || undefined,
        pollType: pollType || undefined,
        view,
        createdFrom: dateInputToStartIso(createdFrom),
        createdTo: dateInputToEndIso(createdTo),
        page,
        limit: PAGE_SIZE,
      });
      setPolls(response.data.items);
      setSummary(response.data.summary);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load polls.",
      );
      setPolls([]);
      setSummary(null);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [createdFrom, createdTo, page, pollType, searchQ, statusFilter, view]);

  useEffect(() => {
    void loadPolls();
  }, [loadPolls]);

  function clearAllFilters() {
    setDraftSearch("");
    setSearchQ("");
    setStatusFilter("");
    setPollType("");
    setView("all");
    setCreatedFrom("");
    setCreatedTo("");
    setPage(1);
  }

  function applyView(next: PollsListView) {
    setView(next);
    setPage(1);
  }

  function openPoll(poll: PollListItem) {
    router.push(`/admin/reports/polls/${poll.id}`);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportPollReport({
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

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin" className="hover:text-[var(--admin-primary)]">
          Admin
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Polls</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <h1 className="text-[32px] font-bold tracking-tight text-[var(--admin-on-surface)]">
            Polls
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Live and standalone poll results, option tallies, and respondent detail where voting is
            identified.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              router.push("/admin/reports/polls/compare");
            }}
          >
            <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
            Compare polls
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>
          <Link href="/admin/polls" className={primaryButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Manage polls
          </Link>
        </div>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Polls module">
          {(
            [
              ["polls", "Polls"],
              ["live", "Live Sessions"],
              ["compare", "Compare"],
              ["exports", "Exports"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={moduleTab === value}
              className={[
                "h-10 whitespace-nowrap px-6 text-sm font-semibold transition-colors",
                moduleTab === value
                  ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                  : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
              onClick={() => {
                if (value === "live") {
                  router.push("/admin/reports/polls/live-sessions");
                  return;
                }
                if (value === "compare") {
                  router.push("/admin/reports/polls/compare");
                  return;
                }
                if (value === "exports") {
                  router.push("/admin/reports/polls/exports");
                  return;
                }
                setModuleTab("polls");
                return;
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {moduleTab === "polls" ? (
        <>
          {error && polls.length === 0 && !loading ? (
            <ErrorPollsPanel message={error} onRetry={() => void loadPolls()} />
          ) : null}

          {loading && polls.length === 0 && !error ? (
            <PollsLoadingSkeleton />
          ) : !(error && polls.length === 0) ? (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
                <div className="relative overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 lg:col-span-2">
                  <div className="relative z-10">
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Responses Collected
                    </p>
                    <p className="font-mono text-[32px] font-semibold leading-none text-[var(--admin-on-surface)]">
                      {(summary?.totalResponses ?? 0).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                      across {(summary?.pollCount ?? 0).toLocaleString()} polls
                    </p>
                  </div>
                  <div className="pointer-events-none absolute bottom-0 left-0 z-0 h-1/3 w-full bg-gradient-to-t from-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] to-transparent opacity-70" />
                  <div className="pointer-events-none absolute bottom-0 left-0 z-0 h-1 w-3/4 bg-[var(--admin-primary)]" />
                </div>

                <div className="flex flex-col justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                  <div>
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                      Avg Participation
                    </p>
                    <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                      {formatPct(summary?.avgParticipationPct)}
                    </p>
                  </div>
                  <div className="mt-4">
                    <div className="h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                      <div
                        className="h-full rounded-full bg-[var(--admin-primary)]"
                        style={{
                          width: `${String(Math.max(0, Math.min(100, summary?.avgParticipationPct ?? 0)))}%`,
                        }}
                      />
                    </div>
                    <p className="mt-2 text-xs leading-tight text-[var(--admin-on-surface-variant)]">
                      where audience size is known
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    applyView("quiz");
                  }}
                >
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                    Quiz Polls
                  </p>
                  <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                    {(summary?.quizPollCount ?? 0).toLocaleString()}
                  </p>
                  <p className="mt-2 text-xs leading-tight text-[var(--admin-on-surface-variant)]">
                    average {formatPct(summary?.avgQuizCorrectPct)} correct
                  </p>
                </button>

                <div className="flex flex-col gap-4">
                  <button
                    type="button"
                    className="group flex flex-1 items-center justify-between rounded-lg border border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-4 text-left transition-colors hover:bg-[color-mix(in_srgb,var(--admin-success)_6%,var(--admin-surface))]"
                    onClick={() => {
                      applyView("open");
                    }}
                  >
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-success)]">
                        Open Now
                      </p>
                      <p className="font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                        {(summary?.openNowCount ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <ArrowRight
                      className="h-5 w-5 text-[var(--admin-success)] transition-transform group-hover:translate-x-1"
                      aria-hidden="true"
                    />
                  </button>
                  <button
                    type="button"
                    className="flex flex-1 items-center justify-between rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                    onClick={() => {
                      applyView("anonymous");
                    }}
                    title="No respondent detail"
                  >
                    <div>
                      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                        Anonymous
                      </p>
                      <p className="font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
                        {(summary?.anonymousCount ?? 0).toLocaleString()}
                      </p>
                    </div>
                    <EyeOff
                      className="h-[18px] w-[18px] text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["all", "All polls"],
                    ["open", "Open now"],
                    ["quiz", "Quiz"],
                    ["live", "Live-linked"],
                    ["standalone", "Standalone"],
                    ["anonymous", "Anonymous"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={[
                      "h-8 rounded-lg px-3 text-xs font-semibold transition-colors",
                      view === value
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                    onClick={() => {
                      applyView(value);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                  <label className="relative flex min-w-0 flex-1 items-center" htmlFor={searchId}>
                    <Search
                      className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      id={searchId}
                      className={`${fieldClassName} w-full pl-9`}
                      placeholder="Search poll title or description"
                      value={draftSearch}
                      onChange={(event) => {
                        setDraftSearch(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          setSearchQ(draftSearch.trim());
                          setPage(1);
                        }
                      }}
                    />
                  </label>
                  <div className="hidden h-6 w-px bg-[var(--admin-border)] lg:block" />
                  <Select
                    className={selectClassName}
                    value={statusFilter}
                    onValueChange={(value) => {
                      setStatusFilter(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "All Statuses" },
                      { value: "ACTIVE", label: "Active" },
                      { value: "INACTIVE", label: "Closed" },
                      { value: "ARCHIVED", label: "Archived" },
                    ]}
                    ariaLabel="Status"
                  />
                  <Select
                    className={selectClassName}
                    value={pollType}
                    onValueChange={(value) => {
                      setPollType(value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "Any type" },
                      { value: "multiple_choice", label: "Multiple choice" },
                      { value: "yes_no", label: "Yes / No" },
                    ]}
                    ariaLabel="Poll type"
                  />
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={() => {
                      setShowMoreFilters((current) => !current);
                    }}
                  >
                    <Filter className="h-4 w-4" aria-hidden="true" />
                    More Filters
                  </button>
                  {hasActiveFilters ? (
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      onClick={clearAllFilters}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                      Clear
                    </button>
                  ) : null}
                </div>
                {showMoreFilters ? (
                  <div className="mt-3 flex flex-wrap items-end gap-3 border-t border-[var(--admin-border)] pt-3">
                    <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Created from
                      <input
                        type="date"
                        className={fieldClassName}
                        value={createdFrom}
                        onChange={(event) => {
                          setCreatedFrom(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Created to
                      <input
                        type="date"
                        className={fieldClassName}
                        value={createdTo}
                        onChange={(event) => {
                          setCreatedTo(event.target.value);
                          setPage(1);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      onClick={() => {
                        setSearchQ(draftSearch.trim());
                        setPage(1);
                        void loadPolls();
                      }}
                    >
                      Apply
                    </button>
                  </div>
                ) : null}
              </div>

              {error && polls.length > 0 ? (
                <div
                  className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                >
                  <div className="flex items-start gap-3">
                    <AlertTriangle
                      className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-[var(--admin-danger)]">{error}</p>
                  </div>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)]"
                    onClick={() => void loadPolls()}
                  >
                    Retry
                  </button>
                </div>
              ) : null}

              <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] border-collapse text-left text-sm">
                    <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      <tr>
                        <th className="px-4 py-3">Poll</th>
                        <th className="px-4 py-3">Type</th>
                        <th className="px-4 py-3 text-right">Responses</th>
                        <th className="px-4 py-3 text-right">Participation</th>
                        <th className="px-4 py-3">Context</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!loading && polls.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-0">
                            <EmptyPollsState
                              hasFilters={hasActiveFilters}
                              onClear={clearAllFilters}
                              onManage={() => {
                                router.push("/admin/polls");
                              }}
                            />
                          </td>
                        </tr>
                      ) : (
                        polls.map((poll, index) => (
                          <tr
                            key={poll.id}
                            className="group h-11 cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                            style={{
                              animationDelay: `${String(Math.min(index, 11) * 20)}ms`,
                            }}
                            onClick={() => {
                              openPoll(poll);
                            }}
                          >
                            <td className="px-4 py-3">
                              <div className="font-medium text-[var(--admin-primary)]">
                                {poll.title}
                              </div>
                              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                                <span>{poll.optionCount} options</span>
                                {poll.anonymousVote ? (
                                  <span className="inline-flex items-center gap-0.5">
                                    <EyeOff className="h-3 w-3" aria-hidden="true" />
                                    Anonymous
                                  </span>
                                ) : null}
                                {poll.quizMode ? <span>Quiz</span> : null}
                                {poll.allowMultipleAnswers ? <span>Multi-answer</span> : null}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-[var(--admin-on-surface)]">
                              {titleCase(poll.pollType)}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[var(--admin-on-surface)]">
                              {poll.responseCount.toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right font-mono text-[var(--admin-on-surface)]">
                              {formatPct(poll.participationPct)}
                            </td>
                            <td className="px-4 py-3 text-[var(--admin-on-surface-variant)]">
                              {poll.liveSessionTitle && poll.liveSessionId ? (
                                <Link
                                  href={`/admin/reports/polls/live-sessions/${poll.liveSessionId}`}
                                  className="inline-flex items-center gap-1.5 text-[var(--admin-primary)] hover:underline"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                  }}
                                >
                                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span className="line-clamp-1 max-w-[160px]">
                                    {poll.liveSessionTitle}
                                  </span>
                                </Link>
                              ) : poll.liveSessionTitle ? (
                                <span className="inline-flex items-center gap-1.5">
                                  <Video className="h-3.5 w-3.5" aria-hidden="true" />
                                  <span className="line-clamp-1 max-w-[160px]">
                                    {poll.liveSessionTitle}
                                  </span>
                                </span>
                              ) : (
                                "Standalone"
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={[
                                  "inline-flex rounded-full border px-2 py-0.5 font-mono text-[11px] font-medium",
                                  statusPillClass(poll),
                                ].join(" ")}
                              >
                                {statusLabel(poll)}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                              {formatDate(poll.createdAt)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {polls.length > 0 || loading ? (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                    <p>
                      {totalCount === 0
                        ? "No results"
                        : `Showing ${String(rangeStart)}-${String(rangeEnd)} of ${totalCount.toLocaleString()}`}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={ghostButtonClassName}
                        disabled={page <= 1 || loading}
                        onClick={() => {
                          setPage((current) => Math.max(1, current - 1));
                        }}
                        aria-label="Previous page"
                      >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="font-mono">
                        {page}
                        {totalPages > 0 ? ` / ${String(totalPages)}` : ""}
                      </span>
                      <button
                        type="button"
                        className={ghostButtonClassName}
                        disabled={page >= totalPages || loading || totalPages === 0}
                        onClick={() => {
                          setPage((current) => current + 1);
                        }}
                        aria-label="Next page"
                      >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
