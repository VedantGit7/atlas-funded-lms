"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  ChevronRight,
  ClipboardList,
  Download,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportBatchReport,
  fetchBatchExams,
  fetchBatchExamsBelowPass,
  fetchBatchExamsMatrix,
  sendBatchMessage,
  type BatchExamAssessmentItem,
  type BatchExamsListData,
  type BatchExamsMatrixCellKind,
  type BatchExamsMatrixData,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ViewMode = "assessments" | "matrix";

const thClass =
  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]";
const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";
const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const SUB_TABS = [
  { key: "overview", label: "Overview", path: "" },
  { key: "learners", label: "Learners", path: "?tab=learners" },
  { key: "live_sessions", label: "Live sessions", path: "/live-sessions" },
  { key: "exams", label: "Exams", path: "/exams" },
  { key: "content", label: "Content", path: "/content" },
  { key: "messages", label: "Messages", path: "/messages" },
] as const;

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

function formatPct(v: number | null | undefined) {
  if (v == null || Number.isNaN(v)) return "-";
  return `${v.toFixed(v % 1 === 0 ? 0 : 1)}%`;
}

function formatDate(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function errMsg(e: unknown, fallback: string) {
  if (e instanceof ClientApiError || e instanceof Error) return e.message;
  return fallback;
}

function clampPct(v: number) {
  return Math.max(0, Math.min(100, v));
}

function barTone(v: number | null | undefined, pass = 50) {
  if (v == null) return "bg-[var(--admin-outline)]";
  if (v >= pass) return "bg-[var(--admin-success)]";
  if (v >= 40) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function passRateTone(rate: number | null | undefined) {
  if (rate == null) return "text-[var(--admin-on-surface-variant)]";
  if (rate < 50) return "text-[var(--admin-danger)]";
  return "text-[var(--admin-on-surface)]";
}

function healthRailClass(rail: BatchExamAssessmentItem["healthRail"] | "none") {
  if (rail === "success") return "bg-[var(--admin-success)]";
  if (rail === "warning") return "bg-[var(--admin-warning)]";
  if (rail === "danger") return "bg-[var(--admin-danger)]";
  return "bg-transparent";
}

function typeBadgeLabel(typeLabel: BatchExamAssessmentItem["typeLabel"]) {
  if (typeLabel === "exam") return "EXAM";
  if (typeLabel === "quiz") return "QUIZ";
  return "OTHER";
}

function typeBadgeClass(typeLabel: BatchExamAssessmentItem["typeLabel"]) {
  if (typeLabel === "exam") {
    return "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]";
  }
  if (typeLabel === "quiz") {
    return "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function matrixCellClass(kind: BatchExamsMatrixCellKind) {
  if (kind === "passed") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_18%,var(--admin-surface))] text-[var(--admin-success)]";
  }
  if (kind === "failed") {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_18%,var(--admin-surface))] text-[var(--admin-danger)]";
  }
  if (kind === "awaiting") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_18%,var(--admin-surface))] text-[var(--admin-warning)]";
  }
  return "border border-[var(--admin-outline)] bg-transparent text-[var(--admin-on-surface-variant)]";
}

function matrixCellLabel(kind: BatchExamsMatrixCellKind) {
  const map: Record<BatchExamsMatrixCellKind, string> = {
    passed: "Passed",
    failed: "Failed",
    awaiting: "Awaiting grading",
    not_attempted: "Not attempted",
  };
  return map[kind];
}

function scoreReportHref(courseId: string | null | undefined) {
  if (courseId) return `/admin/reports/progress-score/scores/course/${courseId}`;
  return "/admin/reports/progress-score/scores";
}

function quizReportHref(assessmentId: string) {
  return `/admin/reports/progress-score/scores/quizzes/${assessmentId}`;
}

function hasUsableDistribution(item: BatchExamAssessmentItem) {
  const d = item.distribution;
  return [d.min, d.q1, d.median, d.q3, d.max].some((v) => v != null);
}

function MiniBar({
  value,
  passMark,
}: {
  value: number | null | undefined;
  passMark?: number | null;
}) {
  if (value == null && passMark == null) return null;
  const fill = value == null ? 0 : clampPct(value);
  return (
    <div className="relative mt-1 h-[3px] w-full max-w-[88px] overflow-visible rounded-full bg-[var(--admin-surface-high)]">
      {passMark != null ? (
        <span
          className="absolute top-[-2px] z-10 h-[7px] w-px bg-[var(--admin-on-surface-variant)]"
          style={{ left: `${String(clampPct(passMark))}%` }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={`h-full rounded-full ${barTone(value, passMark ?? 50)}`}
        style={{ width: `${String(fill)}%` }}
      />
    </div>
  );
}

function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-16 text-center">
      <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
        <ClipboardList
          className="h-8 w-8 text-[var(--admin-outline)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        {description}
      </p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Shimmer className="h-3 w-72 max-w-full" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-80" />
        </div>
        <div className="flex gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-40" />
          <Shimmer className="h-9 w-52" />
        </div>
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Shimmer key={i} className="h-8 w-24" />
        ))}
      </div>
      <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
        <div className="space-y-3 bg-[var(--admin-surface)] p-5 md:col-span-2">
          <Shimmer className="h-3 w-32" />
          <Shimmer className="h-8 w-20" />
          <Shimmer className="h-[3px] w-full" />
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-3 bg-[var(--admin-surface)] p-5">
            <Shimmer className="h-3 w-24" />
            <Shimmer className="h-7 w-14" />
          </div>
        ))}
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="border-b border-[var(--admin-border)] px-4 py-3 last:border-0">
            <Shimmer className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function BoxPlotRow({
  title,
  distribution,
  passMarkPct,
}: {
  title: string;
  distribution: BatchExamAssessmentItem["distribution"];
  passMarkPct: number | null;
}) {
  const { min, q1, median, q3, max } = distribution;
  if (min == null || q1 == null || median == null || q3 == null || max == null) {
    return (
      <div className="flex items-center gap-4 py-2">
        <p className="w-36 shrink-0 truncate text-xs text-[var(--admin-on-surface)]" title={title}>
          {title}
        </p>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">No score distribution</p>
      </div>
    );
  }

  const left = clampPct(Math.min(q1, q3));
  const right = clampPct(Math.max(q1, q3));
  const width = Math.max(1, right - left);

  return (
    <div className="flex items-center gap-4 py-2.5">
      <p
        className="w-36 shrink-0 truncate text-xs font-medium text-[var(--admin-on-surface)]"
        title={title}
      >
        {title}
      </p>
      <div className="relative h-6 flex-1">
        <div
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-[var(--admin-outline)]"
          aria-hidden="true"
        />
        {passMarkPct != null ? (
          <div
            className="absolute inset-y-0 z-10 border-l border-dashed border-[var(--admin-on-surface-variant)]"
            style={{ left: `${String(clampPct(passMarkPct))}%` }}
            aria-hidden="true"
          />
        ) : null}
        <div
          className="absolute top-1/2 h-px -translate-y-1/2 bg-[var(--admin-on-surface-variant)]"
          style={{
            left: `${String(clampPct(min))}%`,
            width: `${String(Math.max(0, clampPct(max) - clampPct(min)))}%`,
          }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-[var(--admin-on-surface)]"
          style={{ left: `${String(clampPct(min))}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 h-3 w-0.5 -translate-y-1/2 bg-[var(--admin-on-surface)]"
          style={{ left: `${String(clampPct(max))}%` }}
          aria-hidden="true"
        />
        <div
          className="absolute top-1/2 h-4 -translate-y-1/2 rounded-sm border border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
          style={{ left: `${String(left)}%`, width: `${String(width)}%` }}
          title={`IQR ${formatPct(q1)} - ${formatPct(q3)}`}
        />
        <div
          className="absolute top-1/2 z-10 h-5 w-0.5 -translate-y-1/2 bg-[var(--admin-primary)]"
          style={{ left: `${String(clampPct(median))}%` }}
          title={`Median ${formatPct(median)}`}
          aria-hidden="true"
        />
      </div>
      <p className="w-16 shrink-0 text-right font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        {formatPct(median)}
      </p>
    </div>
  );
}

function MessageDrawer({
  open,
  count,
  passMarkPct,
  subject,
  body,
  busy,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend,
}: {
  open: boolean;
  count: number;
  passMarkPct: number | null;
  subject: string;
  body: string;
  busy: boolean;
  onSubjectChange: (v: string) => void;
  onBodyChange: (v: string) => void;
  onClose: () => void;
  onSend: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    if (panel) {
      const focusable = panel.querySelector<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      (focusable ?? panel).focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, busy, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close message drawer overlay"
        onClick={() => {
          if (!busy) onClose();
        }}
      />
      <aside
        ref={(el) => {
          panelRef.current = el;
        }}
        className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="flex items-start justify-between border-b border-[var(--admin-border)] px-6 py-4">
          <div>
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              Message learners below pass mark
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {count} learner{count === 1 ? "" : "s"}
              {passMarkPct != null
                ? ` scored below ${formatPct(passMarkPct)}`
                : " are below the pass mark"}
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            Subject
            <input
              className={fieldClassName}
              value={subject}
              onChange={(e) => {
                onSubjectChange(e.target.value);
              }}
              maxLength={200}
            />
          </label>
          <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            Message
            <textarea
              className={`${fieldClassName} h-auto min-h-[180px] py-2`}
              rows={8}
              value={body}
              onChange={(e) => {
                onBodyChange(e.target.value);
              }}
              maxLength={10000}
            />
          </label>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={ghostButtonClassName} disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || count === 0 || !subject.trim() || !body.trim()}
            onClick={onSend}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            {busy ? "Sending…" : `Send to ${String(count)}`}
          </button>
        </div>
      </aside>
    </div>
  );
}

export function AdminBatchExamsPage({ batchId }: { batchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();

  const view: ViewMode = searchParams.get("view") === "matrix" ? "matrix" : "assessments";
  const q = searchParams.get("q") ?? "";

  const [draftQ, setDraftQ] = useState(q);
  const [listData, setListData] = useState<BatchExamsListData | null>(null);
  const [matrixData, setMatrixData] = useState<BatchExamsMatrixData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [messagePassMark, setMessagePassMark] = useState<number | null>(null);
  const [messageBusy, setMessageBusy] = useState(false);

  const replaceParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(
        query
          ? `/admin/reports/batches/${batchId}/exams?${query}`
          : `/admin/reports/batches/${batchId}/exams`,
      );
    },
    [batchId, router, searchParams],
  );

  useEffect(() => {
    setDraftQ(q);
  }, [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = draftQ.trim();
      if (next === q) return;
      replaceParams({ q: next || null });
    }, 300);
    return () => {
      window.clearTimeout(t);
    };
  }, [draftQ, q, replaceParams]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (view === "matrix") {
        const [matrixRes, listRes] = await Promise.all([
          fetchBatchExamsMatrix(batchId, { q: q.trim() || undefined }),
          fetchBatchExams(batchId),
        ]);
        setMatrixData(matrixRes.data);
        setListData(listRes.data);
      } else {
        const response = await fetchBatchExams(batchId, {
          q: q.trim() || undefined,
        });
        setListData(response.data);
      }
    } catch (e) {
      setError(errMsg(e, "Couldn't load exams."));
      if (view === "matrix") setMatrixData(null);
      else setListData(null);
    } finally {
      setLoading(false);
    }
  }, [batchId, q, view]);

  useEffect(() => {
    void load();
  }, [load]);

  const batchName = listData?.batchName ?? matrixData?.batchName ?? "Batch";
  const summary = listData?.summary;
  const courseId = listData?.courseId ?? null;
  const passMark = summary?.passMarkPct ?? matrixData?.passMarkPct ?? 70;

  const filteredAssessments = useMemo(() => {
    const items = listData?.assessments ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((item) => item.title.toLowerCase().includes(needle));
  }, [listData?.assessments, q]);

  const distributionItems = useMemo(
    () => filteredAssessments.filter(hasUsableDistribution),
    [filteredAssessments],
  );

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportBatchReport({ batchId, emailDownloadLink: true });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed")
        throw new Error(completed.errorMessage ?? "Export failed.");
      if (completed.status === "completed") await downloadReportExport(completed.id, "csv");
    } catch (e) {
      setActionError(errMsg(e, "Unable to export report."));
    } finally {
      setBusy(false);
    }
  }

  async function openMessageBelowPass() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetchBatchExamsBelowPass(batchId);
      const ids = response.data.membershipIds;
      if (ids.length === 0) {
        setActionError("No learners are below the pass mark for this batch.");
        return;
      }
      const mark = response.data.passMarkPct;
      setMessageIds(ids);
      setMessagePassMark(mark);
      setMessageSubject("Improve your assessment scores");
      setMessageBody(
        `Your latest assessment scores are below the pass mark of ${formatPct(mark)}. Please review the material and retake when available, or reach out if you need help.`,
      );
      setMessageOpen(true);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't load learners below pass mark."));
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim() || messageIds.length === 0) return;
    setMessageBusy(true);
    setActionError(null);
    try {
      await sendBatchMessage({
        batchId,
        membershipIds: messageIds,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
      });
      setMessageOpen(false);
      setMessageSubject("");
      setMessageBody("");
      setMessageIds([]);
      setMessagePassMark(null);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  if (loading && !listData && !matrixData) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !listData && !matrixData) {
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
                Couldn&apos;t load exams.
              </p>
              <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white hover:opacity-90"
            onClick={() => void load()}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
        <div className="opacity-40">
          <PageSkeleton />
        </div>
      </div>
    );
  }

  const noCourse =
    listData != null && listData.courseId == null && listData.assessments.length === 0;
  const noAssessments =
    listData != null && listData.assessments.length === 0 && listData.courseId != null;

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
          {batchName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Exams</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Exams
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Assessment results for learners in this batch.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => void handleExport()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link href={scoreReportHref(courseId)} className={secondaryButtonClassName}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open score report
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy}
            onClick={() => void openMessageBelowPass()}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message learners below pass mark
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Batch report tabs">
          {SUB_TABS.map((tab) => {
            const active = tab.key === "exams";
            const href = `/admin/reports/batches/${batchId}${tab.path}`;
            return (
              <Link
                key={tab.key}
                href={href}
                role="tab"
                aria-selected={active}
                className={[
                  "inline-flex h-10 shrink-0 items-center px-4 text-xs font-semibold uppercase tracking-[0.06em] transition-colors",
                  active
                    ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
      </div>

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

      {summary ? (
        <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              Average score
            </p>
            <p className="font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
              {formatPct(summary.avgScorePct)}
            </p>
            <div className="relative mt-3 h-[3px] overflow-visible rounded-full bg-[var(--admin-surface-high)]">
              <span
                className="absolute top-[-2px] z-10 h-[7px] w-px bg-[var(--admin-on-surface-variant)]"
                style={{ left: `${String(clampPct(summary.passMarkPct))}%` }}
                aria-hidden="true"
              />
              <div
                className={`h-full rounded-full ${barTone(summary.avgScorePct, summary.passMarkPct)}`}
                style={{
                  width: `${String(clampPct(summary.avgScorePct ?? 0))}%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
              Pass mark {formatPct(summary.passMarkPct)}
            </p>
          </div>
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              Pass rate
            </p>
            <p
              className={`font-mono text-2xl font-medium leading-none ${passRateTone(summary.passRatePct)}`}
            >
              {formatPct(summary.passRatePct)}
            </p>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
              {summary.passedLearnerCount} of {summary.rosterCount} learners
            </p>
          </div>
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
              Attempts
            </p>
            <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
              {summary.attemptCount}
            </p>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
              {summary.attemptsPerLearner == null
                ? "-"
                : `${summary.attemptsPerLearner.toFixed(
                    summary.attemptsPerLearner % 1 === 0 ? 0 : 1,
                  )} per learner`}
            </p>
          </div>
          <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-warning)]">
              Awaiting grading
            </p>
            <p className="inline-flex items-center gap-2 font-mono text-2xl font-medium leading-none text-[var(--admin-warning)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" aria-hidden="true" />
              {summary.awaitingGradingCount}
            </p>
          </div>
          <button
            type="button"
            className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            onClick={() => {
              replaceParams({ view: "matrix", q: null });
            }}
          >
            <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-warning)]">
              Not attempted
            </p>
            <p className="inline-flex items-center gap-2 font-mono text-2xl font-medium leading-none text-[var(--admin-warning)]">
              <span className="h-2 w-2 rounded-full bg-[var(--admin-warning)]" aria-hidden="true" />
              {summary.notAttemptedCount}
            </p>
            <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">View by learner</p>
          </button>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          className="inline-flex rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5"
          role="tablist"
          aria-label="Exams view"
        >
          {(
            [
              ["assessments", "By assessment"],
              ["matrix", "By learner"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={view === key}
              className={[
                "h-8 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30",
                view === key
                  ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                  : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
              ].join(" ")}
              onClick={() => {
                replaceParams({
                  view: key === "assessments" ? null : key,
                });
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="relative block w-full max-w-sm" htmlFor={searchId}>
          <span className="sr-only">
            {view === "matrix" ? "Filter learners" : "Filter assessments"}
          </span>
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            id={searchId}
            className={`${fieldClassName} w-full pl-9`}
            placeholder={view === "matrix" ? "Filter learners" : "Filter assessments"}
            value={draftQ}
            onChange={(e) => {
              setDraftQ(e.target.value);
            }}
          />
        </label>
      </div>

      {view === "assessments" ? (
        <>
          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            {loading && !listData?.assessments.length ? (
              <div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="border-b border-[var(--admin-border)] px-4 py-3 last:border-0"
                  >
                    <Shimmer className="h-4 w-full" />
                  </div>
                ))}
              </div>
            ) : noCourse ? (
              <EmptyState
                title="No course linked"
                description="This batch has no linked course, so assessment results cannot be reported yet."
                action={
                  <Link
                    href={`/admin/reports/batches/${batchId}`}
                    className={secondaryButtonClassName}
                  >
                    Open batch overview
                  </Link>
                }
              />
            ) : noAssessments || filteredAssessments.length === 0 ? (
              <EmptyState
                title="No assessments linked"
                description={
                  q.trim()
                    ? "No assessments match your filter."
                    : "No assessments are linked to this batch yet."
                }
                action={
                  q.trim() ? undefined : (
                    <Link href="/admin/assessments" className={secondaryButtonClassName}>
                      Open assessments
                    </Link>
                  )
                }
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th className={thClass}>Assessment</th>
                      <th className={thClass}>Released on</th>
                      <th className={thClass}>Attempted</th>
                      <th className={thClass}>Average score</th>
                      <th className={thClass}>Pass rate</th>
                      <th className={thClass}>High / Low</th>
                      <th className={thClass}>Awaiting</th>
                      <th className={thClass}>
                        <span className="sr-only">Results</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredAssessments.map((item) => (
                      <tr
                        key={item.assessmentId}
                        className="group relative border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[var(--admin-surface-low)]"
                      >
                        <td className="relative px-4 py-3">
                          <span
                            className={`absolute inset-y-0 left-0 w-1 ${healthRailClass(item.healthRail)}`}
                            aria-hidden="true"
                          />
                          <div className="pl-2">
                            <span
                              className={`mb-1 inline-flex rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${typeBadgeClass(item.typeLabel)}`}
                            >
                              {typeBadgeLabel(item.typeLabel)}
                            </span>
                            <p className="text-sm font-medium text-[var(--admin-primary)]">
                              <Link
                                href={quizReportHref(item.assessmentId)}
                                className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                              >
                                {item.title}
                              </Link>
                            </p>
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]">
                          {formatDate(item.releasedAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                            {item.attemptedCount}
                            <span className="text-[var(--admin-on-surface-variant)]">
                              {" "}
                              of {item.rosterCount}
                            </span>
                          </p>
                          <MiniBar value={item.attemptedPct} />
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs font-medium text-[var(--admin-on-surface)]">
                            {formatPct(item.avgScorePct)}
                          </p>
                          <MiniBar
                            value={item.avgScorePct}
                            passMark={item.passMarkPct ?? passMark}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <p
                            className={`font-mono text-xs font-medium ${passRateTone(item.passRatePct)}`}
                          >
                            {formatPct(item.passRatePct)}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatPct(item.highScorePct)}
                            <span className="mx-1.5 text-[var(--admin-outline)]">|</span>
                            {formatPct(item.lowScorePct)}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-mono text-xs">
                          {item.awaitingGradingCount > 0 ? (
                            <span className="text-[var(--admin-warning)]">
                              {item.awaitingGradingCount}
                            </span>
                          ) : (
                            <span className="text-[var(--admin-on-surface-variant)]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={quizReportHref(item.assessmentId)}
                            className="text-xs font-medium text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                          >
                            View results
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {distributionItems.length > 0 ? (
            <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                    Score distribution
                  </h2>
                  <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
                    Box-plot style spread per assessment on a shared 0-100 scale.
                  </p>
                </div>
                <div className="flex flex-wrap gap-4 text-[11px] text-[var(--admin-on-surface-variant)]">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-6 rounded-sm border border-[var(--admin-outline)] bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface))]"
                      aria-hidden="true"
                    />
                    IQR (Q1-Q3)
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 w-0.5 bg-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                    Median
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className="inline-block h-3 border-l border-dashed border-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                    Pass mark
                  </span>
                </div>
              </div>
              <div className="mb-1 flex items-center gap-4 px-0">
                <div className="w-36 shrink-0" />
                <div className="relative flex flex-1 justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                  <span>0</span>
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
                <div className="w-16 shrink-0" />
              </div>
              <div className="divide-y divide-[var(--admin-border)]">
                {distributionItems.map((item) => (
                  <BoxPlotRow
                    key={item.assessmentId}
                    title={item.title}
                    distribution={item.distribution}
                    passMarkPct={item.passMarkPct ?? passMark}
                  />
                ))}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <p className="border-b border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)] md:hidden">
            Open on a larger screen to see the learner score matrix.
          </p>
          {loading && !matrixData ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <Shimmer key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : !matrixData?.assessments.length || !matrixData.learners.length ? (
            <EmptyState
              title="No assessments linked"
              description="No assessments are linked to this batch yet."
              action={
                <Link href="/admin/assessments" className={secondaryButtonClassName}>
                  Open assessments
                </Link>
              }
            />
          ) : (
            <>
              <div className="hidden overflow-auto md:block" style={{ maxHeight: 560 }}>
                <table className="border-collapse text-left">
                  <thead>
                    <tr>
                      <th className="sticky left-0 top-0 z-30 border-b border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Learner
                      </th>
                      {matrixData.assessments.map((assessment) => (
                        <th
                          key={assessment.assessmentId}
                          className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-1 py-2 text-center"
                          title={assessment.title}
                        >
                          <div className="mx-auto flex h-16 w-8 items-end justify-center">
                            <span className="origin-bottom -rotate-45 whitespace-nowrap text-[10px] text-[var(--admin-on-surface)]">
                              {(assessment.shortTitle || assessment.title).length > 14
                                ? `${(assessment.shortTitle || assessment.title).slice(0, 14)}…`
                                : assessment.shortTitle || assessment.title}
                            </span>
                          </div>
                        </th>
                      ))}
                      <th className="sticky right-0 top-0 z-30 border-b border-l border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Avg
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {matrixData.learners.map((learner) => {
                      const name = learner.learnerName ?? learner.email ?? "Learner";
                      return (
                        <tr
                          key={learner.membershipId}
                          className="border-b border-[var(--admin-border)] last:border-b-0"
                        >
                          <td className="relative sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5">
                            <span
                              className={`absolute inset-y-0 left-0 w-1 ${healthRailClass(learner.healthRail)}`}
                              aria-hidden="true"
                            />
                            <p className="max-w-[140px] truncate pl-2 text-xs font-medium text-[var(--admin-on-surface)]">
                              <Link
                                href={`/admin/reports/batches/${batchId}/learners/${learner.membershipId}`}
                                className="hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                              >
                                {name}
                              </Link>
                            </p>
                            {learner.email && learner.learnerName ? (
                              <p className="max-w-[140px] truncate pl-2 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {learner.email}
                              </p>
                            ) : null}
                          </td>
                          {matrixData.assessments.map((assessment) => {
                            const cell =
                              learner.cells.find(
                                (c) => c.assessmentId === assessment.assessmentId,
                              ) ?? null;
                            const kind = cell?.kind ?? "not_attempted";
                            const scoreLabel =
                              kind === "awaiting"
                                ? "--"
                                : kind === "not_attempted"
                                  ? "-"
                                  : formatPct(cell?.scorePct);
                            return (
                              <td key={assessment.assessmentId} className="px-1 py-1.5 text-center">
                                <span
                                  className={`relative inline-flex h-8 min-w-[2.25rem] items-center justify-center rounded-sm px-1 font-mono text-[11px] ${matrixCellClass(kind)}`}
                                  title={`${name} · ${assessment.title} · ${matrixCellLabel(kind)}${cell?.scorePct != null ? ` · ${formatPct(cell.scorePct)}` : ""}`}
                                  aria-label={`${name}, ${assessment.title}: ${matrixCellLabel(kind)}`}
                                >
                                  {scoreLabel}
                                  {cell && cell.attemptCount > 1 ? (
                                    <span className="absolute -right-0.5 -top-1 rounded bg-[var(--admin-surface)] px-0.5 font-mono text-[8px] text-[var(--admin-on-surface-variant)]">
                                      ×{cell.attemptCount}
                                    </span>
                                  ) : null}
                                </span>
                              </td>
                            );
                          })}
                          <td className="sticky right-0 z-10 border-l border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5">
                            <p className="font-mono text-xs text-[var(--admin-on-surface)]">
                              {formatPct(learner.avgScorePct)}
                            </p>
                            <MiniBar value={learner.avgScorePct} passMark={passMark} />
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <td className="sticky left-0 z-10 border-r border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Assessment avg
                      </td>
                      {matrixData.assessments.map((assessment) => (
                        <td
                          key={assessment.assessmentId}
                          className="px-1 py-2 text-center font-mono text-[11px] text-[var(--admin-on-surface)]"
                        >
                          {formatPct(assessment.avgScorePct)}
                        </td>
                      ))}
                      <td className="sticky right-0 z-10 border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2 font-mono text-xs text-[var(--admin-on-surface)]">
                        {formatPct(matrixData.cohortAvgScorePct)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap gap-4 border-t border-[var(--admin-border)] px-4 py-3 text-[11px] text-[var(--admin-on-surface-variant)]">
                {(
                  [
                    ["passed", "Passed"],
                    ["failed", "Failed"],
                    ["awaiting", "Awaiting"],
                    ["not_attempted", "Not attempted"],
                  ] as const
                ).map(([kind, label]) => (
                  <span key={kind} className="inline-flex items-center gap-1.5">
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-sm ${matrixCellClass(kind)}`}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <MessageDrawer
        open={messageOpen}
        count={messageIds.length}
        passMarkPct={messagePassMark}
        subject={messageSubject}
        body={messageBody}
        busy={messageBusy}
        onSubjectChange={setMessageSubject}
        onBodyChange={setMessageBody}
        onClose={() => {
          if (!messageBusy) setMessageOpen(false);
        }}
        onSend={() => void handleSendMessage()}
      />
    </div>
  );
}
