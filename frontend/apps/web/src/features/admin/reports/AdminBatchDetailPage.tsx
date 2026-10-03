"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardCopy,
  Columns3,
  Download,
  Filter,
  Mail,
  MoreVertical,
  RefreshCw,
  Search,
  Settings2,
  Users,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  BATCH_LEARNER_COLUMN_OPTIONS,
  dateInputToEndIso,
  dateInputToStartIso,
  exportBatchReport,
  fetchBatchDetail,
  fetchBatchLearnerDetail,
  fetchBatchLearners,
  sendBatchMessage,
  type BatchDetail,
  type BatchHealth,
  type BatchLearnerColumnKey,
  type BatchLearnerDetail,
  type BatchLearnerItem,
  type BatchesListHealthFilter,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type DetailTab = "overview" | "learners" | "live_sessions" | "exams" | "content" | "messages";

type LearnerPanelTab = "live" | "exams" | "course";
type CompletionOp = "gte" | "lte";

const PAGE_SIZE = 25;
const DEFAULT_COLUMNS: BatchLearnerColumnKey[] = BATCH_LEARNER_COLUMN_OPTIONS.map(
  (column) => column.key,
);

const DETAIL_TABS: Array<{ key: DetailTab; label: string }> = [
  { key: "overview", label: "Overview" },
  { key: "learners", label: "Learners" },
  { key: "live_sessions", label: "Live sessions" },
  { key: "exams", label: "Exams" },
  { key: "content", label: "Content" },
  { key: "messages", label: "Messages" },
];

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

function isStaleActivity(value: string | null): boolean {
  if (!value) return true;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return true;
  return Date.now() - date.getTime() > 14 * 24 * 60 * 60 * 1000;
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function metricBarTone(
  value: number | null | undefined,
  passMark: number | null | undefined = 70,
): string {
  if (value == null) return "bg-[var(--admin-outline)]";
  const pass = passMark ?? 70;
  if (value >= pass) return "bg-[var(--admin-success)]";
  if (value >= 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function statusPillClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "ACTIVE") {
    return "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (normalized === "INACTIVE") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function healthRailClass(health: BatchHealth): string {
  if (health === "critical") return "bg-[var(--admin-danger)]";
  if (health === "at_risk") return "bg-[var(--admin-warning)]";
  return "bg-transparent";
}

function healthLabel(health: BatchHealth): string {
  if (health === "critical") return "Critical";
  if (health === "at_risk") return "At risk";
  return "On track";
}

function weekCaption(startsAt: string | null, endsAt: string | null): string {
  const now = Date.now();
  if (endsAt) {
    const ends = new Date(endsAt).getTime();
    if (!Number.isNaN(ends) && ends < now) {
      const days = Math.max(1, Math.floor((now - ends) / (1000 * 60 * 60 * 24)));
      return `Ended ${days} day${days === 1 ? "" : "s"} ago`;
    }
  }
  if (startsAt && endsAt) {
    const start = new Date(startsAt).getTime();
    const end = new Date(endsAt).getTime();
    if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
      const totalWeeks = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24 * 7)));
      const elapsedWeeks = Math.min(
        totalWeeks,
        Math.max(1, Math.round((now - start) / (1000 * 60 * 60 * 24 * 7))),
      );
      if (now >= start && now <= end) {
        return `Week ${elapsedWeeks} of ${totalWeeks}`;
      }
    }
  }
  if (startsAt) {
    const start = new Date(startsAt).getTime();
    if (!Number.isNaN(start) && start > now) return "Starts soon";
  }
  return "Open window";
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function parseTab(value: string | null): DetailTab {
  if (
    value === "learners" ||
    value === "live_sessions" ||
    value === "exams" ||
    value === "content" ||
    value === "messages"
  ) {
    return value;
  }
  return "overview";
}

function TripleMetricCell({
  value,
  caption,
  linked = true,
  passMark,
}: {
  value: number | null | undefined;
  caption: string;
  linked?: boolean;
  passMark?: number | null;
}) {
  if (!linked || value == null) {
    return (
      <div className="min-w-[7rem]">
        <p className="font-mono text-sm font-medium text-[var(--admin-on-surface-variant)]">-</p>
        <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
          {linked ? caption : "No linked course"}
        </p>
      </div>
    );
  }
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className="min-w-[7rem]">
      <p className="font-mono text-sm font-medium text-[var(--admin-on-surface)]">
        {formatPct(value)}
      </p>
      <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div
          className={`h-full rounded-full transition-[width] duration-200 ${metricBarTone(value, passMark)}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">{caption}</p>
    </div>
  );
}

function SummaryMetricCard({
  label,
  value,
  caption,
  barValue,
  passMark,
  span2,
  warning,
  onClick,
}: {
  label: string;
  value: string;
  caption: string;
  barValue?: number | null;
  passMark?: number | null;
  span2?: boolean;
  warning?: boolean;
  onClick?: () => void;
}) {
  const content = (
    <>
      <p
        className={[
          "text-[11px] font-semibold uppercase tracking-[0.06em]",
          warning ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {label}
      </p>
      <p
        className={[
          "mt-2 font-mono font-medium leading-none",
          span2 ? "text-[32px]" : "text-2xl",
          warning ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface)]",
        ].join(" ")}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
      {barValue != null ? (
        <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          <div
            className={`h-full rounded-full ${metricBarTone(barValue, passMark)}`}
            style={{ width: `${Math.max(0, Math.min(100, barValue))}%` }}
          />
        </div>
      ) : null}
    </>
  );

  const className = [
    "rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 text-left",
    span2 ? "md:col-span-2" : "",
    warning ? "border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))]" : "",
    onClick ? "transition-colors hover:bg-[var(--admin-surface-high)]" : "",
  ].join(" ");

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

function DetailLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <div className="flex flex-col gap-3">
        <Shimmer className="h-3 w-64" />
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <Shimmer className="h-8 w-72" />
            <Shimmer className="h-4 w-40" />
            <div className="flex gap-2">
              <Shimmer className="h-6 w-16 rounded-md" />
              <Shimmer className="h-6 w-24 rounded-md" />
              <Shimmer className="h-6 w-20 rounded-md" />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Shimmer className="h-9 w-24" />
            <Shimmer className="h-9 w-28" />
            <Shimmer className="h-9 w-32" />
            <Shimmer className="h-9 w-36" />
          </div>
        </div>
      </div>
      <div className="flex gap-1 border-b border-[var(--admin-border)] pb-0">
        {Array.from({ length: 6 }).map((_, index) => (
          <Shimmer key={index} className="mb-2 h-8 w-24" />
        ))}
      </div>
      <div className="grid gap-3 md:grid-cols-5">
        <Shimmer className="h-28 md:col-span-2" />
        <Shimmer className="h-28" />
        <Shimmer className="h-28" />
        <div className="grid gap-3">
          <Shimmer className="h-[3.25rem]" />
          <Shimmer className="h-[3.25rem]" />
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <Shimmer className="h-72 lg:col-span-7" />
        <div className="space-y-4 lg:col-span-5">
          <Shimmer className="h-40" />
          <Shimmer className="h-40" />
        </div>
      </div>
    </div>
  );
}

export function AdminBatchDetailPage({ batchId }: { batchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();
  const columnsPanelId = useId();
  const columnsRef = useRef<HTMLDivElement | null>(null);

  const activeTab = parseTab(searchParams.get("tab"));

  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(true);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [learners, setLearners] = useState<BatchLearnerItem[]>([]);
  const [learnersLoading, setLearnersLoading] = useState(false);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [draftSearch, setDraftSearch] = useState("");
  const [learnerName, setLearnerName] = useState("");
  const [joinedFrom, setJoinedFrom] = useState("");
  const [joinedTo, setJoinedTo] = useState("");
  const [completionOp, setCompletionOp] = useState<CompletionOp>("gte");
  const [completionValue, setCompletionValue] = useState("");
  const [healthFilter, setHealthFilter] = useState<BatchesListHealthFilter>("any");
  const [sortBy, setSortBy] = useState("joined_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const [columns, setColumns] = useState<BatchLearnerColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<BatchLearnerColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);

  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageMembershipIds, setMessageMembershipIds] = useState<string[] | null>(null);

  const [learnerDetail, setLearnerDetail] = useState<BatchLearnerDetail | null>(null);
  const [learnerPanelTab, setLearnerPanelTab] = useState<LearnerPanelTab>("live");
  const [learnerDetailLoading, setLearnerDetailLoading] = useState(false);
  const [learnerDetailError, setLearnerDetailError] = useState<string | null>(null);

  const passMark = detail?.averages.passMarkPct ?? 70;

  const setTab = useCallback(
    (tab: DetailTab) => {
      if (tab === "live_sessions") {
        router.push(`/admin/reports/batches/${batchId}/live-sessions`);
        return;
      }
      if (tab === "exams") {
        router.push(`/admin/reports/batches/${batchId}/exams`);
        return;
      }
      if (tab === "content") {
        router.push(`/admin/reports/batches/${batchId}/content`);
        return;
      }
      if (tab === "messages") {
        router.push(`/admin/reports/batches/${batchId}/messages`);
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      if (tab === "overview") {
        params.delete("tab");
      } else {
        params.set("tab", tab);
      }
      const query = params.toString();
      router.replace(
        query ? `/admin/reports/batches/${batchId}?${query}` : `/admin/reports/batches/${batchId}`,
      );
    },
    [batchId, router, searchParams],
  );

  const loadDetail = useCallback(async () => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetchBatchDetail(batchId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setDetailError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load this batch report.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, [batchId]);

  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    setLearnersError(null);
    try {
      const trimmedName = learnerName.trim();
      const joinedFromIso = dateInputToStartIso(joinedFrom);
      const joinedToIso = dateInputToEndIso(joinedTo);
      const parsedCompletion = completionValue.trim() ? Number(completionValue.trim()) : undefined;
      const completionFilter =
        parsedCompletion != null && !Number.isNaN(parsedCompletion)
          ? completionOp === "gte"
            ? { minCompletion: parsedCompletion }
            : { maxCompletion: parsedCompletion }
          : {};

      const response = await fetchBatchLearners(batchId, {
        ...(trimmedName ? { learnerName: trimmedName } : {}),
        ...(joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
        ...(joinedToIso ? { joinedTo: joinedToIso } : {}),
        ...completionFilter,
        ...(healthFilter !== "any" ? { health: healthFilter } : {}),
        sortBy,
        sortDir,
        columns,
        page,
        limit: PAGE_SIZE,
      });
      setLearners(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setSelectedIds((current) =>
        current.filter((id) => response.data.items.some((item) => item.membershipId === id)),
      );
    } catch (loadError) {
      setLearners([]);
      setTotalCount(0);
      setTotalPages(0);
      setLearnersError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load batch learners.",
      );
    } finally {
      setLearnersLoading(false);
    }
  }, [
    batchId,
    columns,
    completionOp,
    completionValue,
    healthFilter,
    joinedFrom,
    joinedTo,
    learnerName,
    page,
    sortBy,
    sortDir,
  ]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (activeTab === "live_sessions") {
      router.replace(`/admin/reports/batches/${batchId}/live-sessions`);
    }
    if (activeTab === "exams") {
      router.replace(`/admin/reports/batches/${batchId}/exams`);
    }
    if (activeTab === "content") {
      router.replace(`/admin/reports/batches/${batchId}/content`);
    }
    if (activeTab === "messages") {
      router.replace(`/admin/reports/batches/${batchId}/messages`);
    }
  }, [activeTab, batchId, router]);

  useEffect(() => {
    if (activeTab !== "learners") return;
    void loadLearners();
  }, [activeTab, loadLearners]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!columnsRef.current) return;
      if (!columnsRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [columnsOpen]);

  useEffect(() => {
    if (!learnerDetail?.membershipId) return;
    let cancelled = false;
    setLearnerDetailLoading(true);
    setLearnerDetailError(null);
    void fetchBatchLearnerDetail(batchId, learnerDetail.membershipId)
      .then((response) => {
        if (!cancelled) setLearnerDetail(response.data);
      })
      .catch((loadError: unknown) => {
        if (cancelled) return;
        setLearnerDetailError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Unable to load learner detail.",
        );
      })
      .finally(() => {
        if (!cancelled) setLearnerDetailLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [batchId, learnerDetail?.membershipId]);

  const hasLearnerFilters = useMemo(() => {
    return Boolean(
      learnerName || joinedFrom || joinedTo || completionValue || healthFilter !== "any",
    );
  }, [completionValue, healthFilter, joinedFrom, joinedTo, learnerName]);

  const cohortTrend = detail?.overview.cohortTrend ?? [];
  const scoreDistribution = detail?.overview.scoreDistribution ?? [];
  const scoreTotal = scoreDistribution.reduce((sum, bucket) => sum + bucket.count, 0);
  const maxTrendValue = Math.max(
    1,
    ...cohortTrend.map((point) =>
      Math.max(
        point.liveAttendancePct ?? 0,
        point.contentCompletionPct ?? 0,
        point.testScorePct ?? 0,
      ),
    ),
  );

  function clearLearnerFilters() {
    setDraftSearch("");
    setLearnerName("");
    setJoinedFrom("");
    setJoinedTo("");
    setCompletionOp("gte");
    setCompletionValue("");
    setHealthFilter("any");
    setPage(1);
    setSelectedIds([]);
  }

  function applySearch() {
    setLearnerName(draftSearch.trim());
    setPage(1);
  }

  async function copyBatchKey() {
    if (!detail?.key) return;
    try {
      await navigator.clipboard.writeText(detail.key);
      setCopiedKey(true);
      window.setTimeout(() => {
        setCopiedKey(false);
      }, 1500);
    } catch {
      setActionError("Couldn't copy batch key.");
    }
  }

  function openLearnerPanel(learner: BatchLearnerItem) {
    setRowMenuId(null);
    router.push(`/admin/reports/batches/${batchId}/learners/${learner.membershipId}`);
  }

  function closeLearnerPanel() {
    setLearnerDetail(null);
    setLearnerDetailError(null);
  }

  function openMessageModal(membershipIds?: string[]) {
    setMessageMembershipIds(membershipIds && membershipIds.length > 0 ? membershipIds : null);
    setMessageSubject("");
    setMessageBody("");
    setMessageOpen(true);
    setActionError(null);
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const trimmedName = learnerName.trim();
      const joinedFromIso = dateInputToStartIso(joinedFrom);
      const joinedToIso = dateInputToEndIso(joinedTo);
      const parsedCompletion = completionValue.trim() ? Number(completionValue.trim()) : undefined;
      await sendBatchMessage({
        batchId,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        ...(messageMembershipIds ? { membershipIds: messageMembershipIds } : {}),
        ...(!messageMembershipIds && trimmedName ? { learnerName: trimmedName } : {}),
        ...(!messageMembershipIds && joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
        ...(!messageMembershipIds && joinedToIso ? { joinedTo: joinedToIso } : {}),
        ...(!messageMembershipIds &&
        parsedCompletion != null &&
        !Number.isNaN(parsedCompletion) &&
        completionOp === "gte"
          ? { minCompletion: parsedCompletion }
          : {}),
        ...(!messageMembershipIds &&
        parsedCompletion != null &&
        !Number.isNaN(parsedCompletion) &&
        completionOp === "lte"
          ? { maxCompletion: parsedCompletion }
          : {}),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setMessageMembershipIds(null);
    } catch (messageError) {
      setActionError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const trimmedName = learnerName.trim();
      const joinedFromIso = dateInputToStartIso(joinedFrom);
      const joinedToIso = dateInputToEndIso(joinedTo);
      const response = await exportBatchReport({
        batchId,
        ...(trimmedName ? { learnerName: trimmedName } : {}),
        ...(joinedFromIso ? { joinedFrom: joinedFromIso } : {}),
        ...(joinedToIso ? { joinedTo: joinedToIso } : {}),
        columns,
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
      setActionError(
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

  function toggleSelectAll() {
    if (learners.length > 0 && selectedIds.length === learners.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(learners.map((learner) => learner.membershipId));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  function moveDraftColumn(index: number, direction: -1 | 1) {
    setDraftColumns((current) => {
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      next.splice(nextIndex, 0, item);
      return next;
    });
  }

  function toggleDraftColumn(key: BatchLearnerColumnKey) {
    setDraftColumns((current) => {
      if (current.includes(key)) {
        const next = current.filter((item) => item !== key);
        return next.length > 0 ? next : current;
      }
      return [...current, key];
    });
  }

  function goToAtRiskLearners() {
    setHealthFilter("needs_attention");
    setPage(1);
    setTab("learners");
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const linkedCourse = Boolean(detail?.courseId);

  if (detailLoading && !detail) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <DetailLoadingSkeleton />
      </div>
    );
  }

  if (detailError && !detail) {
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
                Couldn&apos;t load this batch report.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {detailError}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)] transition-all hover:opacity-90 active:translate-y-px"
            onClick={() => void loadDetail()}
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
        <span className="font-medium text-[var(--admin-on-surface)]">{detail.name}</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            href="/admin/reports/batches"
            className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            All batches
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            {detail.name}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)] transition-colors hover:border-[var(--admin-outline)] hover:text-[var(--admin-on-surface)]"
              onClick={() => void copyBatchKey()}
              title="Copy batch key"
            >
              {copiedKey ? (
                <Check className="h-3.5 w-3.5 text-[var(--admin-success)]" aria-hidden="true" />
              ) : (
                <ClipboardCopy className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              {copiedKey ? "Copied" : detail.key}
            </button>
            <span
              className={`inline-flex rounded-md border px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] ${statusPillClass(detail.status)}`}
            >
              {titleCase(detail.status)}
            </span>
            <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {weekCaption(detail.startsAt, detail.endsAt)}
            </span>
            <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              {detail.memberCount.toLocaleString()} learners
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeTab === "learners" ? (
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
                  className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-[min(360px,calc(100vw-2rem))] flex-col rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
                >
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
                    <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Customize columns
                    </h3>
                    <button
                      type="button"
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setColumnsOpen(false);
                      }}
                      aria-label="Close columns"
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <ul className="max-h-[320px] space-y-1 overflow-y-auto p-3">
                    {draftColumns.map((key, index) => {
                      const option = BATCH_LEARNER_COLUMN_OPTIONS.find(
                        (column) => column.key === key,
                      );
                      if (!option) return null;
                      return (
                        <li
                          key={key}
                          className="flex items-center gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked
                            onChange={() => {
                              toggleDraftColumn(key);
                            }}
                            aria-label={`Toggle ${option.label}`}
                          />
                          <span className="min-w-0 flex-1 text-xs text-[var(--admin-on-surface)]">
                            {option.label}
                          </span>
                          <button
                            type="button"
                            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                            disabled={index === 0}
                            onClick={() => {
                              moveDraftColumn(index, -1);
                            }}
                            aria-label={`Move ${option.label} up`}
                          >
                            <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] disabled:opacity-30"
                            disabled={index === draftColumns.length - 1}
                            onClick={() => {
                              moveDraftColumn(index, 1);
                            }}
                            aria-label={`Move ${option.label} down`}
                          >
                            <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </li>
                      );
                    })}
                    {BATCH_LEARNER_COLUMN_OPTIONS.filter(
                      (column) => !draftColumns.includes(column.key),
                    ).map((column) => (
                      <li
                        key={column.key}
                        className="flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface-low)]"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={false}
                          onChange={() => {
                            toggleDraftColumn(column.key);
                          }}
                          aria-label={`Toggle ${column.label}`}
                        />
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          {column.label}
                        </span>
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
                        setPage(1);
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
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link href="/admin/batches" className={secondaryButtonClassName}>
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Batch Settings
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              openMessageModal();
            }}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message Learners
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Batch report tabs">
          {DETAIL_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              className={[
                "h-10 shrink-0 px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                activeTab === tab.key
                  ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                  : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
              onClick={() => {
                setTab(tab.key);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-[var(--admin-on-surface-variant)]">
        <span>
          Course:{" "}
          {detail.courseTitle ? (
            <Link
              href="/admin/courses"
              className="font-medium text-[var(--admin-primary)] hover:underline"
            >
              {detail.courseTitle}
            </Link>
          ) : (
            <span>No linked course</span>
          )}
        </span>
        <span aria-hidden="true">·</span>
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          <Calendar className="h-3.5 w-3.5" aria-hidden="true" />
          Window {formatDate(detail.startsAt)} to {formatDate(detail.endsAt)}
        </span>
        <span aria-hidden="true">·</span>
        <span className="font-mono text-xs">Created {formatDate(detail.createdAt)}</span>
      </p>

      {actionError ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-danger)]">{actionError}</p>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => {
              setActionError(null);
            }}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      {activeTab === "overview" ? (
        <>
          <div className="grid gap-3 md:grid-cols-5">
            <SummaryMetricCard
              label="Content completion"
              value={formatPct(detail.averages.contentCompletionPct)}
              caption={`Average across ${detail.memberCount.toLocaleString()} learners`}
              barValue={detail.averages.contentCompletionPct}
              passMark={passMark}
              span2
            />
            <SummaryMetricCard
              label="Live attendance"
              value={formatPct(detail.averages.liveAttendancePct)}
              caption={`${detail.averages.liveSessionHeldCount} of ${detail.averages.liveSessionTotalCount} sessions held`}
              barValue={detail.averages.liveAttendancePct}
              passMark={passMark}
            />
            <SummaryMetricCard
              label="Avg test score"
              value={formatPct(detail.averages.testScorePct)}
              caption={
                detail.averages.passMarkPct != null
                  ? `Pass mark ${formatPct(detail.averages.passMarkPct)}`
                  : "Average assessment score"
              }
              barValue={detail.averages.testScorePct}
              passMark={passMark}
            />
            <div className="grid gap-3">
              <SummaryMetricCard
                label="Active (14d)"
                value={String(detail.averages.activeLearnerCount)}
                caption={`of ${detail.memberCount.toLocaleString()} learners`}
              />
              <SummaryMetricCard
                label="At risk"
                value={String(detail.averages.atRiskCount)}
                caption="Needs attention"
                warning
                onClick={goToAtRiskLearners}
              />
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="flex flex-col gap-4 lg:col-span-7">
              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Cohort trend
                  </h2>
                  <div className="flex flex-wrap gap-3 text-[11px] text-[var(--admin-on-surface-variant)]">
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-[var(--admin-primary)]" />
                      Attendance
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-sm bg-[color-mix(in_srgb,var(--admin-primary)_55%,var(--admin-outline))]" />
                      Completion
                    </span>
                  </div>
                </div>
                {cohortTrend.length === 0 ? (
                  <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-center text-sm text-[var(--admin-on-surface-variant)]">
                    No cohort trend data for this batch window yet.
                  </div>
                ) : (
                  <div className="flex h-48 items-end gap-2">
                    {cohortTrend.map((point) => {
                      const attendance = point.liveAttendancePct ?? 0;
                      const completion = point.contentCompletionPct ?? 0;
                      return (
                        <div
                          key={point.weekStart}
                          className="flex min-w-0 flex-1 flex-col items-center gap-2"
                          title={`${point.weekLabel}: attendance ${formatPct(point.liveAttendancePct)}, completion ${formatPct(point.contentCompletionPct)}`}
                        >
                          <div className="flex h-36 w-full items-end justify-center gap-0.5">
                            <div
                              className="w-[42%] rounded-t-sm bg-[var(--admin-primary)] transition-[height] duration-200"
                              style={{
                                height: `${Math.max(4, (attendance / maxTrendValue) * 100)}%`,
                              }}
                            />
                            <div
                              className="w-[42%] rounded-t-sm bg-[color-mix(in_srgb,var(--admin-primary)_55%,var(--admin-outline))] transition-[height] duration-200"
                              style={{
                                height: `${Math.max(4, (completion / maxTrendValue) * 100)}%`,
                              }}
                            />
                          </div>
                          <span className="truncate font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                            {point.weekLabel}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <h2 className="mb-4 text-base font-semibold text-[var(--admin-on-surface)]">
                  Score distribution
                </h2>
                {scoreDistribution.length === 0 || scoreTotal === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No test scores recorded for this batch yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {scoreDistribution.map((bucket) => {
                      const width =
                        scoreTotal > 0 ? Math.round((bucket.count / scoreTotal) * 100) : 0;
                      return (
                        <div key={bucket.bucket}>
                          <div className="mb-1 flex items-center justify-between text-xs">
                            <span className="text-[var(--admin-on-surface)]">{bucket.label}</span>
                            <span className="font-mono text-[var(--admin-on-surface-variant)]">
                              {bucket.count}
                            </span>
                          </div>
                          <div className="h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                            <div
                              className={[
                                "h-full rounded-full",
                                bucket.bucket === "above_80"
                                  ? "bg-[var(--admin-success)]"
                                  : bucket.bucket === "from_60_to_80"
                                    ? "bg-[var(--admin-warning)]"
                                    : "bg-[var(--admin-danger)]",
                              ].join(" ")}
                              style={{ width: `${width}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <div className="flex flex-col gap-4 lg:col-span-5">
              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Needs attention
                  </h2>
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                    onClick={goToAtRiskLearners}
                  >
                    View roster
                  </button>
                </div>
                {detail.overview.needsAttention.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No learners currently need attention.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.overview.needsAttention.map((item) => (
                      <li key={item.membershipId}>
                        <button
                          type="button"
                          className="relative flex w-full items-start gap-3 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                          onClick={() => {
                            router.push(
                              `/admin/reports/batches/${batchId}/learners/${item.membershipId}`,
                            );
                          }}
                        >
                          <span
                            className={`absolute bottom-0 left-0 top-0 w-1 ${healthRailClass(item.health)}`}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1 pl-1">
                            <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                              {item.learnerName ?? item.email ?? "Learner"}
                            </p>
                            <p className="mt-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                              {item.reason}
                            </p>
                            <div className="mt-2 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                              <div
                                className={`h-full rounded-full ${metricBarTone(item.contentCompletionPct, passMark)}`}
                                style={{
                                  width: `${Math.max(0, Math.min(100, item.contentCompletionPct ?? 0))}%`,
                                }}
                              />
                            </div>
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {healthLabel(item.health)}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                    Upcoming sessions
                  </h2>
                  <Link
                    href={`/admin/reports/batches/${batchId}/live-sessions`}
                    className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                  >
                    View all
                  </Link>
                </div>
                {detail.overview.upcomingSessions.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No upcoming live sessions scheduled for this batch.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {detail.overview.upcomingSessions.map((session) => (
                      <li
                        key={session.liveSessionId}
                        className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                      >
                        <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {session.title}
                        </p>
                        <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                          {formatDateTime(session.scheduledAt)}
                          {session.durationMinutes != null ? ` · ${session.durationMinutes}m` : ""}
                          {" · "}
                          {titleCase(session.status)}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </>
      ) : null}

      {activeTab === "learners" ? (
        <div className={learnerDetail ? "grid gap-4 xl:grid-cols-[1fr_360px]" : ""}>
          <div className="min-w-0 space-y-4">
            {learnersError ? (
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
                      Couldn&apos;t load learners.
                    </p>
                    <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                      {learnersError}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-[var(--admin-on-danger)]"
                  onClick={() => void loadLearners()}
                >
                  <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
                  Retry
                </button>
              </div>
            ) : null}

            <div className="sticky top-0 z-20 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3 shadow-sm">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                <label className="relative flex min-w-0 flex-1 items-center" htmlFor={searchId}>
                  <Search
                    className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    id={searchId}
                    className={`${fieldClassName} w-full pl-9`}
                    placeholder="Search learner name"
                    value={draftSearch}
                    onChange={(event) => {
                      setDraftSearch(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applySearch();
                    }}
                  />
                </label>
                <label className="grid gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  Joined from
                  <input
                    type="date"
                    className={fieldClassName}
                    value={joinedFrom}
                    onChange={(event) => {
                      setJoinedFrom(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="grid gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  Joined to
                  <input
                    type="date"
                    className={fieldClassName}
                    value={joinedTo}
                    onChange={(event) => {
                      setJoinedTo(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <div className="flex items-end gap-2">
                  <label className="grid gap-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    Completion
                    <Select
                      className={selectClassName}
                      value={completionOp}
                      onValueChange={(value) => {
                        setCompletionOp(value as CompletionOp);
                        setPage(1);
                      }}
                      options={[
                        { value: "gte", label: "≥" },
                        { value: "lte", label: "≤" },
                      ]}
                      ariaLabel="Completion comparison"
                    />
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className={`${fieldClassName} w-20`}
                    placeholder="%"
                    value={completionValue}
                    onChange={(event) => {
                      setCompletionValue(event.target.value);
                      setPage(1);
                    }}
                    aria-label="Completion percent"
                  />
                </div>
                <Select
                  className={selectClassName}
                  value={healthFilter}
                  onValueChange={(value) => {
                    setHealthFilter(value as BatchesListHealthFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: "any", label: "Health: All" },
                    { value: "on_track", label: "On track" },
                    { value: "needs_attention", label: "At risk + critical" },
                    { value: "at_risk", label: "At risk" },
                    { value: "critical", label: "Critical" },
                  ]}
                  ariaLabel="Health"
                />
                <Select
                  className={selectClassName}
                  value={`${sortBy}:${sortDir}`}
                  onValueChange={(value) => {
                    const [nextSort, nextDir] = value.split(":");
                    setSortBy(nextSort ?? "joined_at");
                    setSortDir(nextDir === "asc" ? "asc" : "desc");
                    setPage(1);
                  }}
                  options={[
                    { value: "joined_at:desc", label: "Joined · newest" },
                    { value: "joined_at:asc", label: "Joined · oldest" },
                    { value: "activity_at:desc", label: "Activity · recent" },
                    { value: "content_completion_pct:desc", label: "Completion · high" },
                    { value: "live_attendance_pct:desc", label: "Attendance · high" },
                    { value: "test_score_pct:desc", label: "Test · high" },
                    { value: "learner_name:asc", label: "Name · A-Z" },
                  ]}
                  ariaLabel="Sort"
                />
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-3 text-xs font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
                  onClick={applySearch}
                >
                  <Filter className="h-3.5 w-3.5" aria-hidden="true" />
                  Apply
                </button>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={clearLearnerFilters}
                  title="Clear filters"
                >
                  Add filter
                </button>
              </div>
              {hasLearnerFilters ? (
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
                  {learnerName ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px] text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setLearnerName("");
                        setDraftSearch("");
                        setPage(1);
                      }}
                    >
                      Search: {learnerName}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                  {joinedFrom ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
                      onClick={() => {
                        setJoinedFrom("");
                        setPage(1);
                      }}
                    >
                      From {joinedFrom}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                  {joinedTo ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
                      onClick={() => {
                        setJoinedTo("");
                        setPage(1);
                      }}
                    >
                      To {joinedTo}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                  {completionValue ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
                      onClick={() => {
                        setCompletionValue("");
                        setPage(1);
                      }}
                    >
                      Completion {completionOp === "gte" ? "≥" : "≤"} {completionValue}%
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                  {healthFilter !== "any" ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1.5 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-1 text-[11px]"
                      onClick={() => {
                        setHealthFilter("any");
                        setPage(1);
                      }}
                    >
                      Health:{" "}
                      {healthFilter === "needs_attention"
                        ? "At risk + critical"
                        : titleCase(healthFilter)}
                      <X className="h-3 w-3" aria-hidden="true" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
                    onClick={clearLearnerFilters}
                  >
                    Clear all
                  </button>
                </div>
              ) : null}
            </div>

            {selectedIds.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                <p className="text-sm text-[var(--admin-on-surface)]">
                  <span className="font-mono font-medium">{selectedIds.length}</span> learners
                  selected
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
                    Export
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

            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
              {learnersLoading && learners.length === 0 ? (
                <div className="space-y-0">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div
                      key={index}
                      className="relative flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0"
                    >
                      <span className="absolute bottom-0 left-0 top-0 w-1 bg-[var(--admin-surface-high)]" />
                      <Shimmer className="h-4 w-4" />
                      <Shimmer className="h-8 w-8 rounded-full" />
                      <Shimmer className="h-4 w-36" />
                      <Shimmer className="ml-auto h-4 w-24" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[960px] text-left text-sm">
                    <thead>
                      <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        <th className="w-11 px-3">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked={learners.length > 0 && selectedIds.length === learners.length}
                            onChange={toggleSelectAll}
                            aria-label="Select all learners on this page"
                          />
                        </th>
                        {columns.includes("learner_name") ? (
                          <th className="px-3">Learner</th>
                        ) : null}
                        {columns.includes("activity_at") ? (
                          <th className="px-3">Last activity</th>
                        ) : null}
                        {columns.includes("live_attendance_pct") ? (
                          <th className="px-3">Live attendance</th>
                        ) : null}
                        {columns.includes("test_score_pct") ? (
                          <th className="px-3">Test score</th>
                        ) : null}
                        {columns.includes("content_completion_pct") ? (
                          <th className="px-3">Content</th>
                        ) : null}
                        {columns.includes("joined_at") ? <th className="px-3">Joined on</th> : null}
                        <th className="w-12 px-3">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {!learnersLoading && learners.length === 0 ? (
                        <tr>
                          <td colSpan={Math.max(3, columns.length + 2)} className="p-0">
                            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
                              <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                                <Users
                                  className="h-9 w-9 text-[var(--admin-primary)]"
                                  aria-hidden="true"
                                  strokeWidth={1.5}
                                />
                              </div>
                              <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                                {hasLearnerFilters
                                  ? "No learners match these filters"
                                  : "No learners in this batch"}
                              </h3>
                              <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                                {hasLearnerFilters
                                  ? "Adjust search, dates, completion, or health filters to see matching memberships."
                                  : "Add members in Batch Settings, then return here to track attendance, scores, and completion."}
                              </p>
                              <div className="mt-6 flex flex-wrap justify-center gap-2">
                                {hasLearnerFilters ? (
                                  <button
                                    type="button"
                                    className={secondaryButtonClassName}
                                    onClick={clearLearnerFilters}
                                  >
                                    Clear filters
                                  </button>
                                ) : (
                                  <Link href="/admin/batches" className={primaryButtonClassName}>
                                    Batch Settings
                                  </Link>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        learners.map((learner, index) => {
                          const selected = selectedIds.includes(learner.membershipId);
                          const stale = isStaleActivity(learner.activityAt);
                          return (
                            <tr
                              key={learner.membershipId}
                              className={[
                                "group relative h-11 border-b border-[var(--admin-border)] last:border-b-0",
                                "cursor-pointer transition-colors duration-150",
                                selected
                                  ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]"
                                  : "hover:bg-[var(--admin-surface-high)]",
                              ].join(" ")}
                              style={{
                                animationDelay: `${Math.min(index, 11) * 20}ms`,
                              }}
                              onClick={() => {
                                openLearnerPanel(learner);
                              }}
                            >
                              <td
                                className="relative px-3"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                <span
                                  className={`absolute bottom-0 left-0 top-0 w-1 ${healthRailClass(learner.health)}`}
                                  aria-hidden="true"
                                />
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[var(--admin-primary)]"
                                  checked={selected}
                                  onChange={() => {
                                    toggleSelect(learner.membershipId);
                                  }}
                                  aria-label={`Select ${learner.learnerName ?? learner.email ?? "learner"}`}
                                />
                              </td>
                              {columns.includes("learner_name") ? (
                                <td className="px-3">
                                  <div className="flex items-center gap-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-medium text-[var(--admin-on-surface)]">
                                      {learnerInitials(learner.learnerName, learner.email)}
                                    </span>
                                    <div className="min-w-0">
                                      <p className="truncate font-medium text-[var(--admin-on-surface)]">
                                        {learner.learnerName ?? learner.email ?? "Learner"}
                                      </p>
                                      {columns.includes("email") && learner.email ? (
                                        <p className="truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                          {learner.email}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>
                                </td>
                              ) : null}
                              {columns.includes("activity_at") ? (
                                <td className="px-3">
                                  <p
                                    className={[
                                      "font-mono text-xs",
                                      stale
                                        ? "text-[var(--admin-danger)]"
                                        : "text-[var(--admin-on-surface-variant)]",
                                    ].join(" ")}
                                  >
                                    {formatRelative(learner.activityAt)}
                                  </p>
                                  <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {formatDateTime(learner.activityAt)}
                                  </p>
                                </td>
                              ) : null}
                              {columns.includes("live_attendance_pct") ? (
                                <td className="px-3">
                                  <TripleMetricCell
                                    value={learner.liveAttendancePct}
                                    caption={`${learner.liveAttendedCount} of ${learner.liveSessionCount} sessions`}
                                    passMark={passMark}
                                  />
                                </td>
                              ) : null}
                              {columns.includes("test_score_pct") ? (
                                <td className="px-3">
                                  <TripleMetricCell
                                    value={learner.testScorePct}
                                    caption={`${learner.testAttemptCount} attempts`}
                                    linked={linkedCourse}
                                    passMark={passMark}
                                  />
                                </td>
                              ) : null}
                              {columns.includes("content_completion_pct") ? (
                                <td className="px-3">
                                  <TripleMetricCell
                                    value={learner.contentCompletionPct}
                                    caption={`${learner.completedLessons} of ${learner.totalLessons} lessons`}
                                    linked={linkedCourse}
                                    passMark={passMark}
                                  />
                                </td>
                              ) : null}
                              {columns.includes("joined_at") ? (
                                <td className="px-3 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                                  {formatDate(learner.joinedAt)}
                                </td>
                              ) : null}
                              <td
                                className="relative px-3"
                                onClick={(event) => {
                                  event.stopPropagation();
                                }}
                              >
                                <button
                                  type="button"
                                  className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                                  aria-label="Row actions"
                                  onClick={() => {
                                    setRowMenuId((current) =>
                                      current === learner.membershipId
                                        ? null
                                        : learner.membershipId,
                                    );
                                  }}
                                >
                                  <MoreVertical className="h-4 w-4" aria-hidden="true" />
                                </button>
                                {rowMenuId === learner.membershipId ? (
                                  <div className="absolute right-3 top-9 z-30 min-w-[180px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                      onClick={() => {
                                        openLearnerPanel(learner);
                                      }}
                                    >
                                      View learner report
                                    </button>
                                    <button
                                      type="button"
                                      className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                      onClick={() => {
                                        openMessageModal([learner.membershipId]);
                                      }}
                                    >
                                      Message learner
                                    </button>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    Showing {rangeStart}-{rangeEnd} of {totalCount.toLocaleString()} learners
                  </p>
                  <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                    <span className="mr-3 inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-1 bg-[var(--admin-warning)]" />
                      At risk
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="inline-block h-3 w-1 bg-[var(--admin-danger)]" />
                      Critical
                    </span>
                    {" · "}
                    At risk: any metric below 40% or no activity in 14 days. Critical: two or more
                    metrics below 40%.
                  </p>
                </div>
                {totalPages > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page <= 1 || learnersLoading}
                      onClick={() => {
                        setPage((current) => Math.max(1, current - 1));
                      }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <span className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {page} / {totalPages}
                    </span>
                    <button
                      type="button"
                      className={ghostButtonClassName}
                      disabled={page >= totalPages || learnersLoading}
                      onClick={() => {
                        setPage((current) => current + 1);
                      }}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
          </div>

          {learnerDetail ? (
            <aside className="h-fit rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] xl:sticky xl:top-4">
              <div className="flex items-start justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
                    {learnerDetail.learnerName ?? learnerDetail.email ?? "Learner"}
                  </h2>
                  <p className="mt-0.5 truncate font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                    {learnerDetail.email ?? "-"}
                  </p>
                </div>
                <button
                  type="button"
                  className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                  onClick={closeLearnerPanel}
                  aria-label="Close learner detail"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 border-b border-[var(--admin-border)] p-3">
                <div className="rounded-md bg-[var(--admin-surface-low)] p-2">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Live
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                    {formatPct(learnerDetail.summary.liveAttendancePct)}
                  </p>
                </div>
                <div className="rounded-md bg-[var(--admin-surface-low)] p-2">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Test
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                    {formatPct(learnerDetail.summary.testScorePct)}
                  </p>
                </div>
                <div className="rounded-md bg-[var(--admin-surface-low)] p-2">
                  <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Content
                  </p>
                  <p className="mt-1 font-mono text-sm font-semibold text-[var(--admin-on-surface)]">
                    {formatPct(learnerDetail.summary.contentCompletionPct)}
                  </p>
                </div>
              </div>

              <div className="flex gap-1 border-b border-[var(--admin-border)] px-2 pt-2">
                {(
                  [
                    ["live", "Live"],
                    ["exams", "Exams"],
                    ["course", "Course"],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    className={[
                      "h-8 flex-1 rounded-md text-xs font-semibold transition-colors",
                      learnerPanelTab === key
                        ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
                        : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]",
                    ].join(" ")}
                    onClick={() => {
                      setLearnerPanelTab(key);
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="max-h-[480px] overflow-y-auto p-3">
                {learnerDetailError ? (
                  <p className="text-sm text-[var(--admin-danger)]">{learnerDetailError}</p>
                ) : null}
                {learnerDetailLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Shimmer key={index} className="h-10 w-full" />
                    ))}
                  </div>
                ) : learnerPanelTab === "live" ? (
                  learnerDetail.liveAttendance.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No live session attendance for this learner in the batch scope.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {learnerDetail.liveAttendance.map((session) => (
                        <li
                          key={session.liveSessionId}
                          className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                        >
                          <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                            {session.title}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatDateTime(session.scheduledAt)} · {titleCase(session.status)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : learnerPanelTab === "exams" ? (
                  learnerDetail.exams.length === 0 ? (
                    <p className="text-sm text-[var(--admin-on-surface-variant)]">
                      No exam attempts in the batch scope.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {learnerDetail.exams.map((exam) => (
                        <li
                          key={exam.attemptId}
                          className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                        >
                          <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                            {exam.assessmentTitle}
                          </p>
                          <p className="mt-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {formatPct(exam.scorePct)} · {titleCase(exam.attemptStatus)} ·{" "}
                            {formatDateTime(exam.submittedAt ?? exam.startedAt)}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )
                ) : learnerDetail.courseProgress.length === 0 ? (
                  <p className="text-sm text-[var(--admin-on-surface-variant)]">
                    No course progress found for this learner.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {learnerDetail.courseProgress.map((course) => (
                      <li
                        key={course.courseId}
                        className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                      >
                        <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                          {course.courseTitle}
                        </p>
                        <TripleMetricCell
                          value={course.completionPct}
                          caption={`${course.completedLessons} of ${course.totalLessons} lessons`}
                          passMark={passMark}
                        />
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>
          ) : null}
        </div>
      ) : null}

      {activeTab === "live_sessions" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Opening live sessions report…
          </p>
          <Link
            href={`/admin/reports/batches/${batchId}/live-sessions`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to live sessions
          </Link>
        </div>
      ) : null}

      {activeTab === "exams" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Opening exams report…</p>
          <Link
            href={`/admin/reports/batches/${batchId}/exams`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to exams
          </Link>
        </div>
      ) : null}

      {activeTab === "content" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Opening content completion report…
          </p>
          <Link
            href={`/admin/reports/batches/${batchId}/content`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to content completion
          </Link>
        </div>
      ) : null}

      {activeTab === "messages" ? (
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Opening messages…</p>
          <Link
            href={`/admin/reports/batches/${batchId}/messages`}
            className="mt-3 inline-flex text-sm font-medium text-[var(--admin-primary)] hover:underline"
          >
            Continue to messages
          </Link>
        </div>
      ) : null}

      {messageOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="batch-message-title"
        >
          <div className="w-full max-w-lg rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
              <h2
                id="batch-message-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Message learners
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
                  ? `Sending to ${messageMembershipIds.length} selected learner${messageMembershipIds.length === 1 ? "" : "s"}.`
                  : "Sending to learners matching the current batch filters (or the full roster)."}
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
                disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                onClick={() => void handleSendMessage()}
              >
                {busy ? "Sending…" : "Send message"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
