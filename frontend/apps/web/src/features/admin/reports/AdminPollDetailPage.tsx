"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  EyeOff,
  Mail,
  Pencil,
  RefreshCw,
  Search,
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
  POLL_RESPONDENT_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportPollReport,
  fetchPollDetail,
  fetchPollRespondents,
  type PollDetail,
  type PollRespondentColumnKey,
  type PollRespondentItem,
  type PollTimelineEvent,
  type PollTimelinePoint,
} from "./admin-polls-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { AdminPollOptionDetailDrawer } from "./AdminPollOptionDetailPage";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const PAGE_SIZE = 25;

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const DEFAULT_COLUMNS: PollRespondentColumnKey[] = POLL_RESPONDENT_COLUMN_OPTIONS.map(
  (column) => column.key,
);

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

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  const rounded = value;
  if (rounded % 1 === 0) return `${String(rounded)}s`;
  return `${rounded.toFixed(1)}s`;
}

function formatDurationSeconds(value: number | null | undefined): string {
  if (value == null || value <= 0) return "No time limit";
  if (value < 60) return `${String(value)}s`;
  const minutes = Math.floor(value / 60);
  const seconds = value % 60;
  return seconds > 0 ? `${String(minutes)}m ${String(seconds)}s` : `${String(minutes)}m`;
}

function resultVisibilityLabel(value: string): string {
  const normalized = value.toLowerCase();
  if (normalized.includes("vote")) return "Results after vote";
  if (normalized.includes("end") || normalized.includes("close")) {
    return "Results after poll ends";
  }
  return titleCase(value);
}

function ResponseTimelineChart({
  points,
  durationSeconds,
}: {
  points: PollTimelinePoint[];
  durationSeconds: number;
}) {
  const width = 400;
  const height = 160;
  const padL = 36;
  const padR = 12;
  const padT = 12;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const maxX = Math.max(durationSeconds, ...points.map((point) => point.offsetSeconds), 1);
  const maxY = Math.max(1, ...points.map((point) => point.responseCount));

  const xAt = (offset: number) => padL + (offset / maxX) * plotW;
  const yAt = (count: number) => padT + plotH - (count / maxY) * plotH;

  const linePath = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${xAt(point.offsetSeconds).toFixed(1)} ${yAt(point.responseCount).toFixed(1)}`,
    )
    .join(" ");

  const areaPath =
    points.length > 0
      ? `${linePath} L ${xAt(defined(points[points.length - 1]).offsetSeconds).toFixed(1)} ${(padT + plotH).toFixed(1)} L ${xAt(defined(points[0]).offsetSeconds).toFixed(1)} ${(padT + plotH).toFixed(1)} Z`
      : "";

  const midX = Math.round(maxX / 2);

  return (
    <svg
      viewBox={`0 0 ${String(width)} ${String(height)}`}
      className="h-auto w-full"
      role="img"
      aria-label="Response timeline"
    >
      <line
        x1={padL}
        x2={padL + plotW}
        y1={padT + plotH}
        y2={padT + plotH}
        stroke="var(--admin-border)"
        strokeWidth={1}
      />
      {[0, maxY].map((tick) => (
        <g key={`y-${String(tick)}`}>
          <line
            x1={padL}
            x2={padL + plotW}
            y1={yAt(tick)}
            y2={yAt(tick)}
            stroke="var(--admin-border)"
            strokeWidth={1}
            strokeDasharray={tick === 0 ? undefined : "2 2"}
          />
        </g>
      ))}
      {areaPath ? (
        <path d={areaPath} fill="color-mix(in srgb, var(--admin-primary) 22%, transparent)" />
      ) : null}
      {linePath ? (
        <path
          d={linePath}
          fill="none"
          stroke="var(--admin-primary)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : null}
      {[0, midX, maxX].map((tick, index) => (
        <text
          key={`x-${String(tick)}-${String(index)}`}
          x={xAt(tick)}
          y={height - 8}
          textAnchor="middle"
          className="fill-[var(--admin-on-surface-variant)]"
          style={{ fontSize: 10, fontFamily: "ui-monospace, monospace" }}
        >
          {formatSeconds(tick)}
        </text>
      ))}
    </svg>
  );
}

function TimelineEventsList({ events }: { events: PollTimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-xs text-[var(--admin-on-surface-variant)]">No timeline events recorded.</p>
    );
  }
  return (
    <ul className="space-y-3">
      {events.map((event, index) => (
        <li key={`${event.kind}-${event.at}-${String(index)}`} className="flex gap-3">
          <div className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--admin-primary)]" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-[var(--admin-on-surface)]">{event.label}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {formatDateTime(event.at)}
            </p>
            {event.detail ? (
              <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                {event.detail}
              </p>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <Shimmer className="h-3 w-72" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-24" />
          <Shimmer className="h-8 w-96 max-w-full" />
          <Shimmer className="h-4 w-64" />
          <div className="flex flex-wrap gap-2 pt-1">
            {Array.from({ length: 5 }).map((_, index) => (
              <Shimmer key={index} className="h-6 w-24 rounded-md" />
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-40" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-4">
        <Shimmer className="h-28 bg-[var(--admin-surface)] md:col-span-2" />
        <Shimmer className="h-28 bg-[var(--admin-surface)]" />
        <Shimmer className="h-28 bg-[var(--admin-surface)]" />
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Shimmer className="h-80 lg:col-span-7" />
        <Shimmer className="h-80 lg:col-span-5" />
      </div>
      <Shimmer className="h-96 w-full" />
    </div>
  );
}

function ErrorDetailPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <>
      <div
        className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
        role="alert"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
            aria-hidden="true"
          />
          <div>
            <p className="text-sm font-semibold text-[var(--admin-danger)]">
              Couldn&apos;t load poll report.
            </p>
            <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_75%,var(--admin-on-surface))]">
              {message}
            </p>
          </div>
        </div>
        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white transition-all hover:opacity-90 active:translate-y-px"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      </div>
      <div className="pointer-events-none opacity-40">
        <DetailLoadingSkeleton />
      </div>
    </>
  );
}

function EmptyResponsesPanel() {
  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <BarChart3
          className="h-9 w-9 text-[var(--admin-outline)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
        No responses recorded for this poll
      </h2>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Option tallies and respondent detail will appear here once learners submit answers.
      </p>
      <Link href="/admin/polls" className={`${primaryButtonClassName} mt-8`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Open in poll editor
      </Link>
    </div>
  );
}

export function AdminPollDetailPage({ pollId }: { pollId: string }) {
  const router = useRouter();
  const searchId = useId();
  const columnsPanelId = useId();
  const columnsRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(true);
  const [respondentsLoading, setRespondentsLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<PollDetail | null>(null);
  const [respondents, setRespondents] = useState<PollRespondentItem[]>([]);
  const [respondentPage, setRespondentPage] = useState(1);
  const [respondentTotalPages, setRespondentTotalPages] = useState(0);
  const [respondentTotalCount, setRespondentTotalCount] = useState(0);

  const [learnerName, setLearnerName] = useState("");
  const [draftLearnerName, setDraftLearnerName] = useState("");
  const [optionId, setOptionId] = useState("");
  const [drawerOptionId, setDrawerOptionId] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<"any" | "correct" | "incorrect">("any");
  const [respondedFrom, setRespondedFrom] = useState("");
  const [respondedTo, setRespondedTo] = useState("");
  const [sortBy, setSortBy] = useState("responded_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [columns, setColumns] = useState<PollRespondentColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<PollRespondentColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageMembershipIds, setMessageMembershipIds] = useState<string[] | null>(null);

  const isAnonymous = Boolean(detail?.anonymousVote || detail?.respondentsHidden);
  const hasResponses = (detail?.totalResponses ?? 0) > 0;
  const showCorrectSummary = Boolean(detail?.quizMode);
  const summaryGridClass = showCorrectSummary
    ? "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)]"
    : "md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]";

  const participationPct = useMemo(() => {
    if (detail?.eligibleCount != null && detail.eligibleCount > 0) {
      return detail.participationPct ?? (detail.totalResponses / detail.eligibleCount) * 100;
    }
    return detail?.participationPct ?? null;
  }, [detail]);

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPollDetail(pollId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load poll report.",
      );
    } finally {
      setLoading(false);
    }
  }, [pollId]);

  const loadRespondents = useCallback(async () => {
    if (!detail || detail.respondentsHidden || detail.anonymousVote) {
      setRespondents([]);
      setRespondentTotalCount(0);
      setRespondentTotalPages(0);
      return;
    }

    setRespondentsLoading(true);
    try {
      const response = await fetchPollRespondents(pollId, {
        learnerName: learnerName.trim() || undefined,
        optionId: optionId || undefined,
        isCorrect: isCorrect === "any" ? undefined : isCorrect,
        respondedFrom: dateInputToStartIso(respondedFrom),
        respondedTo: dateInputToEndIso(respondedTo),
        sortBy,
        sortDir,
        columns,
        page: respondentPage,
      });
      setRespondents(response.data.items);
      setRespondentTotalCount(response.data.pageInfo.totalCount);
      setRespondentTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setRespondents([]);
      setRespondentTotalCount(0);
      setRespondentTotalPages(0);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load respondents.",
      );
    } finally {
      setRespondentsLoading(false);
    }
  }, [
    columns,
    detail,
    isCorrect,
    learnerName,
    optionId,
    pollId,
    respondentPage,
    respondedFrom,
    respondedTo,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail || loading) return;
    void loadRespondents();
  }, [detail, loadDetail, loadRespondents, loading]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!columnsOpen) return;
      if (columnsRef.current && !columnsRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [columnsOpen]);

  function applyRespondentFilters() {
    setLearnerName(draftLearnerName.trim());
    setRespondentPage(1);
    setSelectedIds([]);
  }

  function clearRespondentFilters() {
    setDraftLearnerName("");
    setLearnerName("");
    setOptionId("");
    setIsCorrect("any");
    setRespondedFrom("");
    setRespondedTo("");
    setSortBy("responded_at");
    setSortDir("desc");
    setRespondentPage(1);
    setSelectedIds([]);
  }

  const hasRespondentFilters = useMemo(
    () => Boolean(learnerName || optionId || isCorrect !== "any" || respondedFrom || respondedTo),
    [isCorrect, learnerName, optionId, respondedFrom, respondedTo],
  );

  function toggleDraftColumn(key: PollRespondentColumnKey) {
    setDraftColumns((current) => {
      if (current.includes(key)) {
        if (current.length === 1) return current;
        return current.filter((column) => column !== key);
      }
      return [...current, key];
    });
  }

  function toggleSelectAll() {
    const pageIds = respondents
      .map((row) => row.membershipId)
      .filter((id): id is string => Boolean(id));
    if (pageIds.length === 0) return;
    if (pageIds.every((id) => selectedIds.includes(id))) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  function toggleSelectRow(membershipId: string | null) {
    if (!membershipId) return;
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  function openMessageModal(membershipIds?: string[]) {
    setMessageMembershipIds(membershipIds && membershipIds.length > 0 ? membershipIds : null);
    setMessageSubject(detail?.title ? `Re: ${detail.title}` : "");
    setMessageBody("");
    setMessageOpen(true);
  }

  function handleMessageAction() {
    if (isAnonymous) {
      if (detail?.eligibleCount != null) {
        router.push(`/admin/reports/polls/${pollId}/non-respondents`);
        return;
      }
      setError("Non-respondents can only be listed when the poll has a known audience.");
      return;
    }
    if (selectedIds.length > 0) {
      openMessageModal(selectedIds);
      return;
    }
    setSelectionMode(true);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportPollReport({
        pollId,
        learnerName: learnerName.trim() || undefined,
        optionId: optionId || undefined,
        respondedFrom: dateInputToStartIso(respondedFrom),
        respondedTo: dateInputToEndIso(respondedTo),
        columns,
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

  const showLearnerColumn = columns.includes("learner_name") || columns.includes("email");
  const showOptionColumn = columns.includes("option_label");
  const showCorrectColumn = Boolean(detail?.quizMode) && columns.includes("is_correct");
  const showRespondedColumn = columns.includes("responded_at");

  const rangeStart = respondentTotalCount === 0 ? 0 : (respondentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(respondentPage * PAGE_SIZE, respondentTotalCount);

  const answerModeLabel = detail?.allowMultipleAnswers ? "Multi-answer" : "Single answer";

  if (loading && !detail && !error) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <ErrorDetailPanel message={error} onRetry={() => void loadDetail()} />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
      <nav
        className="flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
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
        <Link href="/admin/reports/polls" className="hover:text-[var(--admin-primary)]">
          Polls
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">
          {detail?.title ?? "Poll report"}
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Link href="/admin/reports/polls" className={`${ghostButtonClassName} mb-3 inline-flex`}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All polls
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            {detail?.title ?? "Poll report"}
          </h1>
          {detail?.description ? (
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {detail.description}
            </p>
          ) : null}
          {detail ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {titleCase(detail.pollType)}
              </span>
              <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {answerModeLabel}
              </span>
              {detail.quizMode ? (
                <span className="inline-flex rounded-md border border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-primary)]">
                  Quiz mode
                </span>
              ) : null}
              <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {detail.anonymousVote ? "Anonymous" : "Identified"}
              </span>
              <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {resultVisibilityLabel(detail.resultVisibility)}
              </span>
              <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {detail.optionCount} options
              </span>
              {detail.durationSeconds != null && detail.durationSeconds > 0 ? (
                <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {formatDurationSeconds(detail.durationSeconds)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!isAnonymous ? (
            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                className={secondaryButtonClassName}
                aria-expanded={columnsOpen}
                aria-controls={columnsPanelId}
                onClick={() => {
                  setDraftColumns(columns);
                  setColumnsOpen((open) => !open);
                }}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns
              </button>
              {columnsOpen ? (
                <div
                  id={columnsPanelId}
                  className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(320px,calc(100vw-2rem))] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
                    <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Respondent columns
                    </h3>
                    <button
                      type="button"
                      className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setColumnsOpen(false);
                      }}
                      aria-label="Close columns panel"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="max-h-[280px] space-y-1 overflow-y-auto p-3">
                    {POLL_RESPONDENT_COLUMN_OPTIONS.filter(
                      (column) => column.key !== "is_correct" || detail?.quizMode,
                    ).map((column) => (
                      <li key={column.key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--admin-surface-low)]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked={draftColumns.includes(column.key)}
                            onChange={() => {
                              toggleDraftColumn(column.key);
                            }}
                          />
                          <span className="text-xs text-[var(--admin-on-surface)]">
                            {column.label}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setDraftColumns(DEFAULT_COLUMNS);
                      }}
                    >
                      Reset
                    </button>
                    <button
                      type="button"
                      className={primaryButtonClassName}
                      onClick={() => {
                        setColumns(draftColumns);
                        setColumnsOpen(false);
                        setRespondentPage(1);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy || loading}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy ? "Exporting..." : "Export CSV"}
          </button>
          {detail ? (
            <Link
              href={`/admin/reports/polls/${pollId}/live`}
              className={detail.isOpen ? primaryButtonClassName : secondaryButtonClassName}
            >
              {detail.isOpen ? "Open live monitor" : "Open monitor"}
            </Link>
          ) : null}
          {detail?.eligibleCount != null ? (
            <Link
              href={`/admin/reports/polls/${pollId}/non-respondents`}
              className={secondaryButtonClassName}
            >
              View non-respondents
            </Link>
          ) : null}
          <Link href="/admin/polls" className={secondaryButtonClassName}>
            <Pencil className="h-4 w-4" aria-hidden="true" />
            Open in editor
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={handleMessageAction}
            disabled={isAnonymous && detail?.eligibleCount == null}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {isAnonymous ? "Message non-respondents" : "Message respondents"}
          </button>
        </div>
      </div>

      {error && detail ? (
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
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white"
            onClick={() => {
              void loadDetail();
              void loadRespondents();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {selectionMode && !isAnonymous ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
          <p className="text-sm text-[var(--admin-on-surface)]">
            Select respondents below, then choose Message to compose a note.
          </p>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => {
              setSelectionMode(false);
              setSelectedIds([]);
            }}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {detail ? (
        <div
          className={[
            "grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)]",
            summaryGridClass,
          ].join(" ")}
        >
          <div className="space-y-3 bg-[var(--admin-surface)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Responses
            </p>
            <p className="font-mono text-[32px] font-semibold leading-none text-[var(--admin-on-surface)]">
              {detail.totalResponses.toLocaleString()}
            </p>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              {detail.eligibleCount != null
                ? `of ${detail.eligibleCount.toLocaleString()} eligible · ${formatPct(participationPct)}`
                : "Audience size unknown for standalone polls"}
            </p>
            {participationPct != null ? (
              <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[var(--admin-primary)]"
                  style={{
                    width: `${String(Math.max(0, Math.min(100, participationPct)))}%`,
                  }}
                />
              </div>
            ) : null}
          </div>

          {showCorrectSummary ? (
            <div className="space-y-3 bg-[var(--admin-surface)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-success)]">
                Correct
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-success)]">
                {formatPct(detail.correctPct)}
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {detail.correctCount != null
                  ? `${detail.correctCount.toLocaleString()} of ${detail.totalResponses.toLocaleString()} answered correctly`
                  : "Quiz correctness"}
              </p>
              {detail.correctPct != null ? (
                <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className="h-full rounded-full bg-[var(--admin-success)]"
                    style={{
                      width: `${String(Math.max(0, Math.min(100, detail.correctPct)))}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="space-y-3 bg-[var(--admin-surface)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Median time
            </p>
            <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
              {formatSeconds(detail.medianResponseSeconds)}
            </p>
            <p className="text-xs text-[var(--admin-on-surface-variant)]">Time to answer</p>
          </div>

          <div className="space-y-3 bg-[var(--admin-surface)] p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              Source
            </p>
            {detail.liveSessionTitle && detail.liveSessionId ? (
              <Link
                href={`/admin/reports/polls/live-sessions/${detail.liveSessionId}`}
                className="inline-flex items-start gap-1.5 text-sm font-medium text-[var(--admin-primary)] hover:underline"
              >
                <Video className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="line-clamp-2">{detail.liveSessionTitle}</span>
              </Link>
            ) : (
              <p className="text-sm font-medium text-[var(--admin-on-surface)]">Standalone</p>
            )}
            <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
              {detail.isOpen
                ? `Opened ${formatDateTime(detail.openedAt)}`
                : detail.closedAt
                  ? `Closed ${formatDateTime(detail.closedAt)}`
                  : `Opened ${formatDateTime(detail.openedAt)}`}
            </p>
          </div>
        </div>
      ) : null}

      {!hasResponses && detail ? (
        <EmptyResponsesPanel />
      ) : detail ? (
        <div className="grid gap-4 lg:grid-cols-12">
          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-7">
            <div className="border-b border-[var(--admin-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                Results distribution
              </h2>
            </div>
            <div className="space-y-4 p-4">
              {detail.options.map((option) => {
                const isActive = optionId === option.optionId;
                const barColor = option.isCorrect
                  ? "bg-[var(--admin-success)]"
                  : "bg-[color-mix(in_srgb,var(--admin-primary)_60%,var(--admin-surface-high))]";
                return (
                  <button
                    key={option.optionId}
                    type="button"
                    className={[
                      "relative w-full rounded-md border px-3 py-3 text-left transition-colors",
                      isActive
                        ? "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                        : "border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                    onClick={() => {
                      setDrawerOptionId(option.optionId);
                      setOptionId(option.optionId);
                      setRespondentPage(1);
                    }}
                  >
                    {isActive ? (
                      <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-primary)]" />
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {option.label}
                        </span>
                        {detail.quizMode && option.isCorrect ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--admin-success)]">
                            <Check className="h-3 w-3" aria-hidden="true" />
                            Correct
                          </span>
                        ) : null}
                      </div>
                      <div className="font-mono text-xs text-[var(--admin-on-surface)]">
                        {option.count.toLocaleString()}{" "}
                        <span className="text-[var(--admin-on-surface-variant)]">
                          · {option.percent.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                      <div
                        className={`h-full rounded-full ${barColor}`}
                        style={{ width: `${String(Math.min(100, option.percent))}%` }}
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="border-t border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
              {detail.totalResponses.toLocaleString()} responses ·{" "}
              {detail.uniqueLearnerCount.toLocaleString()} learners ·{" "}
              {detail.allowMultipleAnswers ? "Multi-answer" : "Single answer"}
            </div>
          </section>

          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-5">
            <div className="border-b border-[var(--admin-border)] px-4 py-3">
              <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                {isAnonymous ? "Poll timeline" : "Response timeline"}
              </h2>
            </div>
            <div className="space-y-4 p-4">
              {!isAnonymous && detail.timeline.points.length > 0 ? (
                <>
                  <ResponseTimelineChart
                    points={detail.timeline.points}
                    durationSeconds={detail.timeline.durationSeconds}
                  />
                  {detail.timeline.earlySharePct != null ? (
                    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                      {formatPct(detail.timeline.earlySharePct)} of responses arrived in the first
                      20 seconds.
                    </div>
                  ) : null}
                </>
              ) : null}
              {isAnonymous || detail.timeline.events.length > 0 ? (
                <TimelineEventsList events={detail.timeline.events} />
              ) : null}
              {!isAnonymous &&
              detail.timeline.points.length === 0 &&
              detail.timeline.events.length === 0 ? (
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  No timing data recorded for this poll.
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {detail ? (
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Respondents</h2>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {isAnonymous
                  ? "Individual voter rows are not available for anonymous polls."
                  : hasResponses
                    ? `${respondentTotalCount.toLocaleString()} response${respondentTotalCount === 1 ? "" : "s"}`
                    : detail.eligibleCount != null
                      ? `0 / ${detail.eligibleCount.toLocaleString()} eligible`
                      : "0 responses"}
              </p>
            </div>
            {optionId && !isAnonymous ? (
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setOptionId("");
                  setRespondentPage(1);
                }}
              >
                Clear option filter
              </button>
            ) : null}
          </div>

          {isAnonymous ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <EyeOff
                  className="h-7 w-7 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
              </div>
              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Responses are anonymous
              </h3>
              <p className="mt-2 max-w-lg text-sm text-[var(--admin-on-surface-variant)]">
                Voter identity is not recorded for this poll. Option tallies and timing above remain
                available.
              </p>
              <button
                type="button"
                className={`${secondaryButtonClassName} mt-6`}
                disabled={detail.eligibleCount == null}
                title={
                  detail.eligibleCount == null
                    ? "Requires a known live-session audience"
                    : undefined
                }
                onClick={() => {
                  router.push(`/admin/reports/polls/${pollId}/non-respondents`);
                }}
              >
                View non-respondents
              </button>
              {detail.eligibleCount != null ? (
                <p className="mt-2 max-w-md text-xs text-[var(--admin-on-surface-variant)]">
                  Eligibility is known from the live session roster.
                </p>
              ) : (
                <p className="mt-2 max-w-md text-xs text-[var(--admin-on-surface-variant)]">
                  Non-respondents can be listed only when the poll has a known audience.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-[var(--admin-border)] p-4">
                <div className="flex flex-wrap items-end gap-3">
                  <label className="relative grid min-w-[200px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Learner
                    <Search
                      className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    <input
                      id={searchId}
                      className={`${fieldClassName} w-full pl-9`}
                      placeholder="Name or email"
                      value={draftLearnerName}
                      onChange={(event) => {
                        setDraftLearnerName(event.target.value);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyRespondentFilters();
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Option
                    <Select
                      className={selectClassName}
                      value={optionId}
                      onValueChange={(value) => {
                        setOptionId(value);
                        setRespondentPage(1);
                      }}
                      options={[
                        { value: "", label: "All options" },
                        ...detail.options.map((option) => ({
                          value: option.optionId,
                          label: option.label,
                        })),
                      ]}
                      ariaLabel="Filter by option"
                    />
                  </label>
                  {detail.quizMode ? (
                    <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Correct
                      <Select
                        className={selectClassName}
                        value={isCorrect}
                        onValueChange={(value) => {
                          setIsCorrect(
                            value === "correct" || value === "incorrect" ? value : "any",
                          );
                          setRespondentPage(1);
                        }}
                        options={[
                          { value: "any", label: "All" },
                          { value: "correct", label: "Correct" },
                          { value: "incorrect", label: "Incorrect" },
                        ]}
                        ariaLabel="Filter by correctness"
                      />
                    </label>
                  ) : null}
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    From
                    <input
                      type="date"
                      className={fieldClassName}
                      value={respondedFrom}
                      onChange={(event) => {
                        setRespondedFrom(event.target.value);
                        setRespondentPage(1);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    To
                    <input
                      type="date"
                      className={fieldClassName}
                      value={respondedTo}
                      onChange={(event) => {
                        setRespondedTo(event.target.value);
                        setRespondentPage(1);
                      }}
                    />
                  </label>
                  <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Sort
                    <Select
                      className={selectClassName}
                      value={sortBy}
                      onValueChange={setSortBy}
                      options={[
                        { value: "responded_at", label: "Time responded" },
                        { value: "response_seconds", label: "Response seconds" },
                        { value: "learner_name", label: "Learner" },
                        { value: "option_label", label: "Option" },
                      ]}
                      ariaLabel="Sort respondents"
                    />
                  </label>
                  <Select
                    className={selectClassName}
                    value={sortDir}
                    onValueChange={(value) => {
                      setSortDir(value === "asc" ? "asc" : "desc");
                    }}
                    options={[
                      { value: "desc", label: "Desc" },
                      { value: "asc", label: "Asc" },
                    ]}
                    ariaLabel="Sort direction"
                  />
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={applyRespondentFilters}
                  >
                    Apply
                  </button>
                </div>

                {hasRespondentFilters ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {learnerName ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]">
                        Learner: {learnerName}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            setLearnerName("");
                            setDraftLearnerName("");
                            setRespondentPage(1);
                          }}
                          aria-label="Remove learner filter"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {optionId ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]">
                        Option:{" "}
                        {detail.options.find((option) => option.optionId === optionId)?.label ??
                          optionId}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            setOptionId("");
                            setRespondentPage(1);
                          }}
                          aria-label="Remove option filter"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    {isCorrect !== "any" ? (
                      <span className="inline-flex items-center gap-1 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]">
                        Correct: {titleCase(isCorrect)}
                        <button
                          type="button"
                          className="rounded p-0.5 hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            setIsCorrect("any");
                            setRespondentPage(1);
                          }}
                          aria-label="Remove correctness filter"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                      onClick={clearRespondentFilters}
                    >
                      Clear all
                    </button>
                  </div>
                ) : null}
              </div>

              {selectedIds.length > 0 ? (
                <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                  <p className="text-sm text-[var(--admin-on-surface)]">
                    <span className="font-mono font-medium">{selectedIds.length}</span> respondent
                    {selectedIds.length === 1 ? "" : "s"} selected
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      onClick={() => {
                        openMessageModal(selectedIds);
                      }}
                    >
                      <Mail className="h-4 w-4" aria-hidden="true" />
                      Message
                    </button>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={busy}
                      onClick={() => void handleExport()}
                    >
                      <Download className="h-4 w-4" aria-hidden="true" />
                      Export selected
                    </button>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      onClick={() => {
                        setSelectedIds([]);
                      }}
                    >
                      Clear
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px] text-left text-sm">
                  <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <tr>
                      <th className="w-11 px-3 py-3">
                        {(selectionMode || selectedIds.length > 0) && hasResponses ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked={
                              respondents.length > 0 &&
                              respondents.every(
                                (row) =>
                                  !row.membershipId || selectedIds.includes(row.membershipId),
                              )
                            }
                            onChange={toggleSelectAll}
                            aria-label="Select all respondents on this page"
                          />
                        ) : null}
                      </th>
                      {showLearnerColumn ? <th className="px-4 py-3">Learner</th> : null}
                      {showOptionColumn ? <th className="px-4 py-3">Option</th> : null}
                      {showCorrectColumn ? <th className="px-4 py-3">Status</th> : null}
                      <th className="px-4 py-3 text-right">Time</th>
                      {showRespondedColumn ? (
                        <th className="px-4 py-3 text-right">Responded on</th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody>
                    {respondentsLoading && respondents.length === 0 ? (
                      Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index} className="h-11 border-b border-[var(--admin-border)]">
                          <td className="px-3 py-3">
                            <Shimmer className="h-4 w-4" />
                          </td>
                          <td className="px-4 py-3" colSpan={5}>
                            <Shimmer className="h-4 w-48" />
                          </td>
                        </tr>
                      ))
                    ) : !hasResponses ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                        >
                          {detail.eligibleCount != null
                            ? `0 / ${detail.eligibleCount.toLocaleString()} eligible`
                            : "No responses recorded yet."}
                        </td>
                      </tr>
                    ) : respondents.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
                        >
                          No respondents match these filters.
                        </td>
                      </tr>
                    ) : (
                      respondents.map((row, index) => {
                        const membershipId = row.membershipId;
                        const selected = membershipId ? selectedIds.includes(membershipId) : false;
                        return (
                          <tr
                            key={`${membershipId ?? "anon"}-${row.optionId}-${String(index)}`}
                            className={[
                              "h-11 border-b border-[var(--admin-border)] last:border-b-0",
                              selected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                                : "hover:bg-[var(--admin-surface-high)]",
                            ].join(" ")}
                          >
                            <td className="px-3 py-3">
                              {membershipId && (selectionMode || selectedIds.length > 0) ? (
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[var(--admin-primary)]"
                                  checked={selected}
                                  onChange={() => {
                                    toggleSelectRow(membershipId);
                                  }}
                                  aria-label={`Select ${row.learnerName ?? row.email ?? "respondent"}`}
                                />
                              ) : null}
                            </td>
                            {showLearnerColumn ? (
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-3">
                                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                                    {learnerInitials(row.learnerName, row.email)}
                                  </span>
                                  <div className="min-w-0">
                                    <p className="truncate font-medium text-[var(--admin-on-surface)]">
                                      {row.learnerName ?? "-"}
                                    </p>
                                    {(columns.includes("email") ||
                                      columns.includes("learner_name")) &&
                                    row.email ? (
                                      <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                                        {row.email}
                                      </p>
                                    ) : null}
                                  </div>
                                </div>
                              </td>
                            ) : null}
                            {showOptionColumn ? (
                              <td className="px-4 py-3">
                                <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs text-[var(--admin-on-surface)]">
                                  {row.optionLabel}
                                </span>
                              </td>
                            ) : null}
                            {showCorrectColumn ? (
                              <td className="px-4 py-3">
                                {row.isCorrect == null ? (
                                  "-"
                                ) : row.isCorrect ? (
                                  <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-success)]">
                                    <Check className="h-3 w-3" aria-hidden="true" />
                                    Correct
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full border border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-danger)]">
                                    Incorrect
                                  </span>
                                )}
                              </td>
                            ) : null}
                            <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface)]">
                              {formatSeconds(row.responseSeconds)}
                            </td>
                            {showRespondedColumn ? (
                              <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                {formatDateTime(row.respondedAt)}
                              </td>
                            ) : null}
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {hasResponses ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  <p>
                    {respondentTotalCount === 0
                      ? detail.eligibleCount != null
                        ? `0 / ${detail.eligibleCount.toLocaleString()} eligible`
                        : "No results"
                      : `Showing ${String(rangeStart)}-${String(rangeEnd)} of ${respondentTotalCount.toLocaleString()}`}
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={respondentPage <= 1 || respondentsLoading}
                      onClick={() => {
                        setRespondentPage((current) => Math.max(1, current - 1));
                      }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="font-mono">
                      {respondentPage}
                      {respondentTotalPages > 0 ? ` / ${String(respondentTotalPages)}` : ""}
                    </span>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={
                        respondentPage >= respondentTotalPages ||
                        respondentsLoading ||
                        respondentTotalPages === 0
                      }
                      onClick={() => {
                        setRespondentPage((current) => current + 1);
                      }}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      {messageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="poll-message-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="poll-message-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Message respondents
              </h2>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => {
                  setMessageOpen(false);
                }}
                aria-label="Close message dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                {messageMembershipIds
                  ? `Sending to ${String(messageMembershipIds.length)} selected respondent${messageMembershipIds.length === 1 ? "" : "s"}.`
                  : "Sending to respondents matching the current filters."}
              </p>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Subject
                <input
                  className={fieldClassName}
                  value={messageSubject}
                  onChange={(event) => {
                    setMessageSubject(event.target.value);
                  }}
                  maxLength={200}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Message
                <textarea
                  className={`${fieldClassName} h-auto min-h-[120px] py-2`}
                  rows={5}
                  value={messageBody}
                  onChange={(event) => {
                    setMessageBody(event.target.value);
                  }}
                  maxLength={10000}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => {
                  setMessageOpen(false);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={!messageSubject.trim() || !messageBody.trim()}
                onClick={() => {
                  setMessageOpen(false);
                  setSelectionMode(false);
                  setError(
                    "Messaging from poll reports is not available yet. Export the respondent list to follow up outside the report.",
                  );
                }}
              >
                Send message
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <AdminPollOptionDetailDrawer
        pollId={pollId}
        optionId={drawerOptionId}
        onClose={() => {
          setDrawerOptionId(null);
        }}
      />
    </div>
  );
}
