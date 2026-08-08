"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Mail,
  RefreshCw,
  User,
  UserMinus,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchBatchLearnerDetail,
  removeBatchLearner,
  sendBatchMessage,
  type BatchHealth,
  type BatchLearnerDetail,
} from "./admin-batches-roster-api";

type LearnerTab = "attendance" | "exams" | "course";
type RemoveReason = "transferred" | "withdrawn" | "administrative" | "other";

const LEARNER_TABS: Array<{ key: LearnerTab; label: string }> = [
  { key: "attendance", label: "Live class attendance" },
  { key: "exams", label: "Exams" },
  { key: "course", label: "Course completion" },
];

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const selectClassName =
  "h-9 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const dangerOutlineButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 text-sm font-medium text-[var(--admin-danger)] transition-all hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50";

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
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

function formatRelative(value: string | null): string {
  if (!value) return "No activity";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No activity";
  const diffMs = Date.now() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "Today";
  if (days === 1) return "1 day ago";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

function formatDuration(seconds: number | null, plannedMinutes: number | null): string {
  if (seconds == null && plannedMinutes == null) return "-";
  const mins = seconds != null ? Math.round(seconds / 60) : null;
  if (mins != null && plannedMinutes != null) return `${mins}m of ${plannedMinutes}m`;
  if (mins != null) return `${mins}m`;
  return `of ${plannedMinutes}m`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function healthLabel(health: BatchHealth): string {
  if (health === "critical") return "Critical";
  if (health === "at_risk") return "At risk";
  return "On track";
}

function healthChipClass(health: BatchHealth): string {
  if (health === "critical") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (health === "at_risk") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
}

function metricBarTone(value: number | null | undefined, passMark = 70): string {
  if (value == null) return "bg-[var(--admin-outline)]";
  if (value >= passMark) return "bg-[var(--admin-success)]";
  if (value >= 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function attendanceSquareClass(
  kind: BatchLearnerDetail["liveAttendance"][number]["attendanceKind"],
): string {
  if (kind === "attended") return "bg-[var(--admin-success)]";
  if (kind === "partial") return "bg-[var(--admin-warning)]";
  if (kind === "absent") return "bg-[var(--admin-danger)]";
  return "border border-[var(--admin-outline)] bg-transparent";
}

function attendanceRailClass(
  kind: BatchLearnerDetail["liveAttendance"][number]["attendanceKind"],
): string {
  if (kind === "absent") return "bg-[var(--admin-danger)]";
  if (kind === "partial") return "bg-[var(--admin-warning)]";
  return "bg-transparent";
}

function attendanceKindLabel(
  kind: BatchLearnerDetail["liveAttendance"][number]["attendanceKind"],
): string {
  if (kind === "attended") return "Attended";
  if (kind === "partial") return "Partial";
  if (kind === "absent") return "Absent";
  return "Upcoming";
}

function attendancePillClass(
  kind: BatchLearnerDetail["liveAttendance"][number]["attendanceKind"],
): string {
  if (kind === "attended") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (kind === "partial") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (kind === "absent") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function outcomePillClass(outcome: BatchLearnerDetail["exams"][number]["outcome"]): string {
  if (outcome === "passed") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (outcome === "borderline") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  if (outcome === "failed") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (outcome === "in_progress") {
    return "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function courseStatusLabel(status: BatchLearnerDetail["courseProgress"][number]["statusLabel"]): string {
  if (status === "completed") return "Completed";
  if (status === "in_progress") return "In progress";
  if (status === "behind") return "Behind";
  return "Not started";
}

function heatmapLevelClass(count: number): string {
  if (count >= 8) return "bg-[color-mix(in_srgb,var(--admin-primary)_90%,transparent)]";
  if (count >= 4) return "bg-[color-mix(in_srgb,var(--admin-primary)_65%,transparent)]";
  if (count >= 2) return "bg-[color-mix(in_srgb,var(--admin-primary)_40%,transparent)]";
  if (count >= 1) return "bg-[color-mix(in_srgb,var(--admin-primary)_20%,transparent)]";
  return "bg-[var(--admin-surface-high)]";
}

function parseTab(value: string | null): LearnerTab {
  if (value === "exams" || value === "course") return value;
  return "attendance";
}

function clampPct(value: number | null | undefined): number {
  if (value == null || Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}

function MetricBar({
  value,
  cohortAverage,
  showCohortTicks,
  passMark,
  tone,
}: {
  value: number | null;
  cohortAverage?: number | null;
  showCohortTicks: boolean;
  passMark?: number | null;
  tone?: string;
}) {
  const width = clampPct(value);
  const barTone = tone ?? metricBarTone(value, passMark ?? 70);
  const tick =
    showCohortTicks && cohortAverage != null && !Number.isNaN(cohortAverage)
      ? clampPct(cohortAverage)
      : null;

  return (
    <div className="relative h-[3px] w-full overflow-visible rounded-full bg-[var(--admin-surface-high)]">
      <div className={`h-full rounded-full ${barTone}`} style={{ width: `${width}%` }} />
      {tick != null ? (
        <span
          className="absolute top-1/2 z-10 h-2.5 w-px -translate-y-1/2 bg-[var(--admin-on-surface-variant)]"
          style={{ left: `${tick}%` }}
          title={`Cohort average ${formatPct(cohortAverage)}`}
          aria-hidden="true"
        />
      ) : null}
    </div>
  );
}

function StandingRow({
  label,
  value,
  percentile,
  caption,
}: {
  label: string;
  value: number | null;
  percentile: number | null;
  caption: string;
}) {
  const marker = percentile != null ? clampPct(percentile) : null;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-[var(--admin-on-surface)]">{label}</span>
        <span className="font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
          {formatPct(value)}
        </span>
      </div>
      <div className="relative h-2 w-full rounded-full bg-[var(--admin-surface-high)]">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
          style={{ width: "100%" }}
          aria-hidden="true"
        />
        {marker != null ? (
          <span
            className="absolute top-1/2 h-3 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm bg-[var(--admin-primary)]"
            style={{ left: `${marker}%` }}
            title={`${marker}th percentile`}
            aria-hidden="true"
          />
        ) : null}
      </div>
      <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">{caption}</p>
    </div>
  );
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-hidden="true">
      <Shimmer className="h-4 w-72 max-w-full" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-center gap-4">
          <Shimmer className="h-10 w-10 rounded-full" />
          <div className="space-y-2">
            <Shimmer className="h-7 w-48" />
            <Shimmer className="h-4 w-40" />
            <div className="flex gap-2">
              <Shimmer className="h-6 w-28" />
              <Shimmer className="h-6 w-24" />
              <Shimmer className="h-6 w-20" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-36" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <Shimmer key={index} className="h-24 border border-[var(--admin-border)]" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="space-y-3 lg:col-span-8">
          <Shimmer className="h-10 w-full" />
          {Array.from({ length: 5 }).map((_, index) => (
            <Shimmer key={index} className="h-12 w-full" />
          ))}
        </div>
        <div className="space-y-4 lg:col-span-4">
          <Shimmer className="h-48 w-full" />
          <Shimmer className="h-40 w-full" />
          <Shimmer className="h-44 w-full" />
        </div>
      </div>
    </div>
  );
}

export function AdminBatchLearnerDetailPage({
  batchId,
  membershipId,
}: {
  batchId: string;
  membershipId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = parseTab(searchParams.get("tab"));

  const [detail, setDetail] = useState<BatchLearnerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCohortTicks, setShowCohortTicks] = useState(true);
  const [copiedId, setCopiedId] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);

  const [removeOpen, setRemoveOpen] = useState(false);
  const [removeReason, setRemoveReason] = useState<RemoveReason>("withdrawn");
  const [removeNotes, setRemoveNotes] = useState("");
  const [removeBusy, setRemoveBusy] = useState(false);

  const setTab = useCallback(
    (tab: LearnerTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "attendance") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.replace(
        query
          ? `/admin/reports/batches/${batchId}/learners/${membershipId}?${query}`
          : `/admin/reports/batches/${batchId}/learners/${membershipId}`,
      );
    },
    [batchId, membershipId, router, searchParams],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBatchLearnerDetail(batchId, membershipId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load this learner report.",
      );
    } finally {
      setLoading(false);
    }
  }, [batchId, membershipId]);

  useEffect(() => {
    void load();
  }, [load]);

  const heatmapWeeks = useMemo(() => {
    const cells = detail?.activityHeatmap.cells ?? [];
    const weeks: Array<Array<{ date: string; count: number }>> = [];
    for (let i = 0; i < cells.length; i += 7) {
      weeks.push(cells.slice(i, i + 7));
    }
    return weeks.slice(-12);
  }, [detail?.activityHeatmap.cells]);

  const heatmapMonths = useMemo(() => {
    const labels: string[] = [];
    let lastMonth = "";
    for (const week of heatmapWeeks) {
      const first = week[0];
      if (!first) continue;
      const month = new Date(`${first.date}T00:00:00`).toLocaleString(undefined, {
        month: "short",
      });
      if (month !== lastMonth) {
        labels.push(month);
        lastMonth = month;
      }
    }
    return labels;
  }, [heatmapWeeks]);

  const nextLesson = useMemo(
    () => detail?.lessonStrip.find((lesson) => lesson.isNext) ?? null,
    [detail?.lessonStrip],
  );

  async function copyMembershipId() {
    try {
      await navigator.clipboard.writeText(membershipId);
      setCopiedId(true);
      window.setTimeout(() => setCopiedId(false), 1500);
    } catch {
      setActionError("Couldn't copy membership id.");
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setMessageBusy(true);
    setActionError(null);
    try {
      await sendBatchMessage({
        batchId,
        membershipIds: [membershipId],
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
    } catch (messageError) {
      setActionError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Couldn't send message.",
      );
    } finally {
      setMessageBusy(false);
    }
  }

  async function handleRemove() {
    if (removeReason === "other" && !removeNotes.trim()) return;
    setRemoveBusy(true);
    setActionError(null);
    try {
      const body =
        removeReason === "other"
          ? { reason: removeReason, notes: removeNotes.trim() }
          : { reason: removeReason };
      await removeBatchLearner(batchId, membershipId, body);
      router.push(`/admin/reports/batches/${batchId}?tab=learners`);
    } catch (removeError) {
      setActionError(
        removeError instanceof ClientApiError
          ? removeError.message
          : removeError instanceof Error
            ? removeError.message
            : "Couldn't remove learner from batch.",
      );
    } finally {
      setRemoveBusy(false);
    }
  }

  if (loading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (error && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
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
              <p className="text-sm font-medium text-[var(--admin-danger)]">
                Couldn&apos;t load this learner report.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white transition-all hover:opacity-90 active:translate-y-px"
            onClick={() => void load()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
        <div className="opacity-40">
          <DetailLoadingSkeleton />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const learnerName = detail.learnerName ?? detail.email ?? "Learner";
  const passMark = detail.summary.passMarkPct ?? 70;
  const learnersHref = `/admin/reports/batches/${batchId}?tab=learners`;

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
        <Link href="/admin/reports/batches" className="hover:text-[var(--admin-primary)]">
          Batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link
          href={`/admin/reports/batches/${batchId}`}
          className="hover:text-[var(--admin-primary)]"
        >
          {detail.batchName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">{learnerName}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href={learnersHref}
            className="mb-3 inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            All learners in this batch
          </Link>
          <div className="flex items-start gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
              {learnerInitials(detail.learnerName, detail.email)}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                {learnerName}
              </h1>
              <p className="mt-0.5 truncate font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {detail.email ?? "No email"}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {detail.batchName}
                </span>
                <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  Joined {formatDate(detail.joinedAt)}
                </span>
                <span
                  className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${healthChipClass(detail.health)}`}
                >
                  {healthLabel(detail.health)}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/admin/members/${membershipId}`}
            className={secondaryButtonClassName}
          >
            <User className="h-4 w-4" aria-hidden="true" />
            Open member profile
          </Link>
          <button
            type="button"
            className={secondaryButtonClassName}
            onClick={() => {
              setMessageSubject("");
              setMessageBody("");
              setMessageOpen(true);
              setActionError(null);
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message learner
          </button>
          <button
            type="button"
            className={[
              secondaryButtonClassName,
              showCohortTicks
                ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
                : "",
            ].join(" ")}
            aria-pressed={showCohortTicks}
            onClick={() => setShowCohortTicks((current) => !current)}
          >
            Compare with cohort
          </button>
          <button
            type="button"
            className={dangerOutlineButtonClassName}
            onClick={() => {
              setRemoveReason("withdrawn");
              setRemoveNotes("");
              setRemoveOpen(true);
              setActionError(null);
            }}
          >
            <UserMinus className="h-4 w-4" aria-hidden="true" />
            Remove from batch
          </button>
        </div>
      </div>

      {actionError ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-3 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError}</p>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-3 text-xs font-semibold text-white"
            onClick={() => {
              setActionError(null);
              void load();
            }}
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:grid-cols-5">
        <div className="col-span-2 space-y-2 border-[var(--admin-border)] md:col-span-1 md:border-r md:pr-3 lg:col-span-1">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Content completion
          </p>
          <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
            {formatPct(detail.summary.contentCompletionPct)}
          </p>
          <MetricBar
            value={detail.summary.contentCompletionPct}
            cohortAverage={detail.cohortAverages.contentCompletionPct}
            showCohortTicks={showCohortTicks}
            passMark={passMark}
          />
          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.summary.completedLessons} of {detail.summary.totalLessons} lessons
            {showCohortTicks && detail.cohortAverages.contentCompletionPct != null
              ? ` · cohort ${formatPct(detail.cohortAverages.contentCompletionPct)}`
              : ""}
          </p>
        </div>
        <div className="space-y-2 border-[var(--admin-border)] md:border-r md:pr-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Live attendance
          </p>
          <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
            {formatPct(detail.summary.liveAttendancePct)}
          </p>
          <MetricBar
            value={detail.summary.liveAttendancePct}
            cohortAverage={detail.cohortAverages.liveAttendancePct}
            showCohortTicks={showCohortTicks}
            passMark={passMark}
          />
          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.summary.liveAttendedCount} of {detail.summary.liveSessionCount} sessions
            {showCohortTicks && detail.cohortAverages.liveAttendancePct != null
              ? ` · cohort ${formatPct(detail.cohortAverages.liveAttendancePct)}`
              : ""}
          </p>
        </div>
        <div className="space-y-2 border-[var(--admin-border)] md:border-r md:pr-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Test score
          </p>
          <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
            {formatPct(detail.summary.testScorePct)}
          </p>
          <MetricBar
            value={detail.summary.testScorePct}
            cohortAverage={detail.cohortAverages.testScorePct}
            showCohortTicks={showCohortTicks}
            passMark={passMark}
          />
          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.summary.testAttemptCount} attempt
            {detail.summary.testAttemptCount === 1 ? "" : "s"}
            {showCohortTicks && detail.cohortAverages.testScorePct != null
              ? ` · cohort ${formatPct(detail.cohortAverages.testScorePct)}`
              : ""}
          </p>
        </div>
        <div className="space-y-2 border-[var(--admin-border)] md:border-r md:pr-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Last activity
          </p>
          <p className="font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
            {formatRelative(detail.activityAt)}
          </p>
          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.summary.lastActivityLabel ?? formatDateTime(detail.activityAt)}
          </p>
        </div>
        <div className="space-y-2">
          <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Days in batch
          </p>
          <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
            {detail.summary.daysInBatch}
          </p>
          <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
            {detail.summary.targetDays != null
              ? `of ${detail.summary.targetDays} target days`
              : "Since joined"}
          </p>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8">
          <div className="flex gap-1 border-b border-[var(--admin-border)]">
            {LEARNER_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={[
                  "h-10 px-3 text-sm font-semibold transition-colors",
                  activeTab === tab.key
                    ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                onClick={() => setTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {activeTab === "attendance" ? (
              detail.liveAttendance.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                    No live sessions linked to this batch yet
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Attendance rows appear once sessions are scheduled for this cohort.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="border-b border-[var(--admin-border)] px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {detail.liveAttendance.map((session) => (
                        <span
                          key={session.liveSessionId}
                          title={`${session.title}: ${attendanceKindLabel(session.attendanceKind)}`}
                          className={`h-3 w-3 rounded-[2px] ${attendanceSquareClass(session.attendanceKind)}`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {detail.summary.liveAttendedCount} attended ·{" "}
                      {detail.summary.livePartialCount} partial ·{" "}
                      {detail.summary.liveAbsentCount} absent
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Session
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Scheduled
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Status
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Attendance
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Joined / Left
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Duration
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Log
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.liveAttendance.map((session) => {
                          const plannedSeconds =
                            session.plannedDurationMinutes != null
                              ? session.plannedDurationMinutes * 60
                              : null;
                          const coverage =
                            session.durationSeconds != null &&
                            plannedSeconds != null &&
                            plannedSeconds > 0
                              ? clampPct((session.durationSeconds / plannedSeconds) * 100)
                              : null;
                          return (
                            <tr
                              key={session.liveSessionId}
                              className={[
                                "relative border-b border-[var(--admin-border)] last:border-b-0",
                                session.attendanceKind === "upcoming" ? "opacity-60" : "",
                              ].join(" ")}
                            >
                              <td className="relative px-3 py-2.5">
                                <span
                                  className={`absolute bottom-0 left-0 top-0 w-1 ${attendanceRailClass(session.attendanceKind)}`}
                                  aria-hidden="true"
                                />
                                <p className="font-medium text-[var(--admin-primary)]">
                                  {session.title}
                                </p>
                                {session.sessionKind ? (
                                  <span className="mt-1 inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                    {titleCase(session.sessionKind)}
                                  </span>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                {formatDateTime(session.scheduledAt)}
                              </td>
                              <td className="px-3 py-2.5">
                                <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {titleCase(session.sessionStatus)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] ${attendancePillClass(session.attendanceKind)}`}
                                >
                                  {attendanceKindLabel(session.attendanceKind)}
                                </span>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                <div>{formatDateTime(session.joinedAt)}</div>
                                <div>{formatDateTime(session.leftAt)}</div>
                              </td>
                              <td className="min-w-[7rem] px-3 py-2.5">
                                <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                                  {formatDuration(
                                    session.durationSeconds,
                                    session.plannedDurationMinutes,
                                  )}
                                </p>
                                {coverage != null ? (
                                  <div className="mt-1 h-[3px] w-full rounded-full bg-[var(--admin-surface-high)]">
                                    <div
                                      className={`h-full rounded-full ${metricBarTone(coverage, 70)}`}
                                      style={{ width: `${coverage}%` }}
                                    />
                                  </div>
                                ) : null}
                              </td>
                              <td className="px-3 py-2.5">
                                <button
                                  type="button"
                                  className="cursor-not-allowed text-xs text-[var(--admin-on-surface-variant)] opacity-50"
                                  disabled
                                  title="Session log is not available yet"
                                >
                                  View log
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : null}

            {activeTab === "exams" ? (
              detail.exams.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                    No exam attempts in the batch scope
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Attempts appear once learners submit assessments linked to this batch.
                  </p>
                </div>
              ) : (
                <div>
                  <div className="border-b border-[var(--admin-border)] px-4 py-3">
                    <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      Average {formatPct(detail.summary.testScorePct)} across{" "}
                      {detail.summary.testAttemptCount} attempt
                      {detail.summary.testAttemptCount === 1 ? "" : "s"} · best{" "}
                      {formatPct(detail.summary.bestTestScorePct)}
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                      <thead>
                        <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Assessment
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Status
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Score
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Duration
                          </th>
                          <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                            Review
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {detail.exams.map((exam) => {
                          const reviewHref =
                            exam.assessmentId && exam.attemptId
                              ? `/admin/reports/progress-score/scores/quizzes/${exam.assessmentId}/attempts/${exam.attemptId}`
                              : "#";
                          const examPass = exam.passMarkPct ?? passMark;
                          return (
                            <tr
                              key={exam.attemptId}
                              className="border-b border-[var(--admin-border)] last:border-b-0"
                            >
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-[var(--admin-primary)]">
                                  {exam.assessmentTitle}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {formatDateTime(exam.submittedAt ?? exam.startedAt)}
                                </p>
                              </td>
                              <td className="px-3 py-2.5">
                                <span
                                  className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] ${outcomePillClass(exam.outcome)}`}
                                >
                                  {titleCase(exam.outcome)}
                                </span>
                              </td>
                              <td className="min-w-[8rem] px-3 py-2.5">
                                <p className="font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                                  {formatPct(exam.scorePct)}
                                </p>
                                <div className="relative mt-1 h-[3px] w-full rounded-full bg-[var(--admin-surface-high)]">
                                  <div
                                    className={`h-full rounded-full ${metricBarTone(exam.scorePct, examPass)}`}
                                    style={{ width: `${clampPct(exam.scorePct)}%` }}
                                  />
                                  <span
                                    className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-[var(--admin-on-surface-variant)]"
                                    style={{ left: `${clampPct(examPass)}%` }}
                                    title={`Pass mark ${formatPct(examPass)}`}
                                    aria-hidden="true"
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                {exam.durationSeconds != null
                                  ? `${Math.round(exam.durationSeconds / 60)}m`
                                  : "-"}
                              </td>
                              <td className="px-3 py-2.5">
                                <Link
                                  href={reviewHref}
                                  className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                                >
                                  Review attempt
                                </Link>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            ) : null}

            {activeTab === "course" ? (
              detail.courseProgress.length === 0 && detail.lessonStrip.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                    No course progress found
                  </p>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Curriculum progress appears when this batch is linked to a course.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 p-4">
                  {detail.courseProgress.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No course progress found for this learner.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
                        <thead>
                          <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                            <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Course
                            </th>
                            <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Completed
                            </th>
                            <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Total
                            </th>
                            <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Completion
                            </th>
                            <th className="px-3 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                              Last lesson
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {detail.courseProgress.map((course) => (
                            <tr
                              key={course.courseId}
                              className="border-b border-[var(--admin-border)] last:border-b-0"
                            >
                              <td className="px-3 py-2.5">
                                <p className="font-medium text-[var(--admin-primary)]">
                                  {course.courseTitle}
                                </p>
                                <p className="mt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {courseStatusLabel(course.statusLabel)}
                                </p>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-[var(--admin-on-surface)]">
                                {course.completedLessons}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-[var(--admin-on-surface)]">
                                {course.totalLessons}
                              </td>
                              <td className="min-w-[8rem] px-3 py-2.5">
                                <p className="font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                                  {formatPct(course.completionPct)}
                                </p>
                                <div className="mt-1 h-[3px] w-full rounded-full bg-[var(--admin-surface-high)]">
                                  <div
                                    className={`h-full rounded-full ${metricBarTone(course.completionPct, passMark)}`}
                                    style={{ width: `${clampPct(course.completionPct)}%` }}
                                  />
                                </div>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                {course.lastLessonTitle ?? "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {detail.lessonStrip.length > 0 ? (
                    <div className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                          Lesson strip
                        </p>
                        {nextLesson ? (
                          <p className="text-xs text-[var(--admin-on-surface-variant)]">
                            Up next:{" "}
                            <span className="font-medium text-[var(--admin-on-surface)]">
                              {nextLesson.title}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {detail.lessonStrip.map((lesson) => (
                          <span
                            key={lesson.lessonId}
                            title={lesson.title}
                            className={[
                              "h-6 w-1.5 rounded-sm",
                              lesson.completed
                                ? "bg-[var(--admin-success)]"
                                : lesson.isNext
                                  ? "ring-2 ring-[var(--admin-primary)] ring-offset-1 ring-offset-[var(--admin-surface-low)] bg-transparent border border-[var(--admin-primary)]"
                                  : "border border-[var(--admin-outline)] bg-transparent",
                            ].join(" ")}
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              )
            ) : null}
          </div>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-4">
          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h2 className="border-b border-[var(--admin-border)] pb-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--admin-on-surface)]">
              System activity
            </h2>
            {heatmapWeeks.length === 0 ? (
              <p className="mt-3 text-sm text-[var(--admin-on-surface-variant)]">
                No activity recorded for this learner yet.
              </p>
            ) : (
              <div className="mt-3 space-y-2">
                <div className="flex gap-[3px] overflow-x-auto pb-1">
                  {heatmapWeeks.map((week, weekIndex) => (
                    <div key={weekIndex} className="flex flex-col gap-[3px]">
                      {week.map((day) => (
                        <div
                          key={day.date}
                          title={`${day.date}: ${day.count} event${day.count === 1 ? "" : "s"}`}
                          className={`h-3 w-3 rounded-[2px] ${heatmapLevelClass(day.count)}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                {heatmapMonths.length > 0 ? (
                  <div className="flex items-center justify-between px-0.5 font-mono text-[10px] text-[var(--admin-outline)]">
                    {heatmapMonths.map((month) => (
                      <span key={month}>{month}</span>
                    ))}
                  </div>
                ) : null}
                {detail.activityHeatmap.longestGapDays != null ? (
                  <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    Longest gap: {detail.activityHeatmap.longestGapDays} day
                    {detail.activityHeatmap.longestGapDays === 1 ? "" : "s"}
                  </p>
                ) : null}
              </div>
            )}
          </section>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h2 className="border-b border-[var(--admin-border)] pb-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--admin-on-surface)]">
              Standing in cohort
            </h2>
            <div className="mt-4 space-y-4">
              <StandingRow
                label="Content completion"
                value={detail.summary.contentCompletionPct}
                percentile={detail.standing.completionPercentile}
                caption={detail.standing.completionLabel}
              />
              <StandingRow
                label="Test score"
                value={detail.summary.testScorePct}
                percentile={detail.standing.testPercentile}
                caption={detail.standing.testLabel}
              />
              <StandingRow
                label="Live attendance"
                value={detail.summary.liveAttendancePct}
                percentile={detail.standing.attendancePercentile}
                caption={detail.standing.attendanceLabel}
              />
            </div>
          </section>

          <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h2 className="border-b border-[var(--admin-border)] pb-2 font-mono text-xs uppercase tracking-[0.08em] text-[var(--admin-on-surface)]">
              Batch membership details
            </h2>
            <dl className="mt-3 space-y-3 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Membership id</dt>
                <dd className="flex min-w-0 items-center gap-1.5">
                  <span className="truncate font-mono text-xs text-[var(--admin-on-surface)]">
                    {detail.membership.membershipId}
                  </span>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                    onClick={() => void copyMembershipId()}
                    title="Copy membership id"
                    aria-label="Copy membership id"
                  >
                    {copiedId ? (
                      <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" aria-hidden="true" />
                    ) : (
                      <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
                    )}
                  </button>
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Joined on</dt>
                <dd className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {formatDate(detail.membership.joinedAt)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Role</dt>
                <dd className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {detail.membership.role}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Source</dt>
                <dd className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {detail.membership.source}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-[var(--admin-on-surface-variant)]">Added by</dt>
                <dd className="font-mono text-xs text-[var(--admin-on-surface)]">
                  {detail.membership.addedBy}
                </dd>
              </div>
            </dl>
            <button
              type="button"
              className="mt-4 text-xs font-medium text-[var(--admin-danger)] hover:underline"
              onClick={() => {
                setRemoveReason("withdrawn");
                setRemoveNotes("");
                setRemoveOpen(true);
                setActionError(null);
              }}
            >
              Remove from batch
            </button>
          </section>
        </aside>
      </div>

      {messageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="learner-message-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="learner-message-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Message learner
              </h2>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setMessageOpen(false)}
                aria-label="Close message dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Sending to {learnerName}.
              </p>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Subject
                <input
                  className={fieldClassName}
                  value={messageSubject}
                  onChange={(event) => setMessageSubject(event.target.value)}
                  maxLength={200}
                />
              </label>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Message
                <textarea
                  className={`${fieldClassName} h-auto min-h-[120px] py-2`}
                  rows={5}
                  value={messageBody}
                  onChange={(event) => setMessageBody(event.target.value)}
                  maxLength={10000}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => setMessageOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={primaryButtonClassName}
                disabled={messageBusy || !messageSubject.trim() || !messageBody.trim()}
                onClick={() => void handleSendMessage()}
              >
                {messageBusy ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {removeOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="learner-remove-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="learner-remove-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Remove {learnerName} from {detail.batchName}?
              </h2>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setRemoveOpen(false)}
                aria-label="Close remove dialog"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3 px-5 py-4">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Batch metrics will recalculate. Course enrolments and progress remain untouched.
              </p>
              <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                Reason
                <Select
                  className={selectClassName}
                  value={removeReason}
                  onValueChange={(value) => setRemoveReason(value as RemoveReason)}
                  options={[
                    { value: "transferred", label: "Transferred" },
                    { value: "withdrawn", label: "Withdrawn" },
                    { value: "administrative", label: "Administrative" },
                    { value: "other", label: "Other" },
                  ]}
                />
              </label>
              {removeReason === "other" ? (
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Notes
                  <textarea
                    className={`${fieldClassName} h-auto min-h-[80px] py-2`}
                    rows={3}
                    value={removeNotes}
                    onChange={(event) => setRemoveNotes(event.target.value)}
                    maxLength={2000}
                    placeholder="Describe the reason"
                  />
                </label>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className={ghostButtonClassName}
                onClick={() => setRemoveOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-[var(--admin-danger)] px-4 text-sm font-medium text-white transition-all hover:opacity-90 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-danger)]/30 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={
                  removeBusy || (removeReason === "other" && !removeNotes.trim())
                }
                onClick={() => void handleRemove()}
              >
                {removeBusy ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
