"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BookOpen,
  ChevronRight,
  Download,
  ExternalLink,
  Mail,
  MoreVertical,
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
  fetchBatchContent,
  fetchBatchContentLearners,
  fetchBatchContentStalled,
  sendBatchMessage,
  type BatchContentFunnelLesson,
  type BatchContentLearnerItem,
  type BatchContentReportData,
} from "./admin-batches-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

type ContentView = "any" | "stalled" | "never_started" | "finished" | "in_progress";
type MessageMode = "stalled" | "selected";
type PageInfoShape = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

const PAGE_SIZE = 25;
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

const VIEW_OPTIONS: Array<{ value: ContentView; label: string }> = [
  { value: "any", label: "All" },
  { value: "stalled", label: "Stalled" },
  { value: "never_started", label: "Never started" },
  { value: "in_progress", label: "In progress" },
  { value: "finished", label: "Finished" },
];

const SPREAD_BANDS = [
  { key: "0-25", label: "0-25", tone: "bg-[var(--admin-danger)]", field: "band0to25" as const },
  { key: "26-50", label: "26-50", tone: "bg-[var(--admin-warning)]", field: "band26to50" as const },
  { key: "51-75", label: "51-75", tone: "bg-[var(--admin-primary)]", field: "band51to75" as const },
  { key: "76-100", label: "76-100", tone: "bg-[var(--admin-success)]", field: "band76to100" as const },
];

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
  return `${Number(v).toFixed(v % 1 === 0 ? 0 : 1)}%`;
}

function formatDateTime(v: string | null | undefined) {
  if (!v) return "-";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function errMsg(e: unknown, fallback: string) {
  if (e instanceof ClientApiError || e instanceof Error) return e.message;
  return fallback;
}

function clampPct(v: number) {
  return Math.max(0, Math.min(100, v));
}

function parseView(raw: string | null): ContentView {
  if (raw === "stalled" || raw === "never_started" || raw === "finished" || raw === "in_progress") {
    return raw;
  }
  return "any";
}

function healthRailClass(
  rail: BatchContentLearnerItem["healthRail"] | BatchContentFunnelLesson["healthRail"],
) {
  if (rail === "success") return "bg-[var(--admin-success)]";
  if (rail === "warning") return "bg-[var(--admin-warning)]";
  if (rail === "danger") return "bg-[var(--admin-danger)]";
  return "bg-transparent";
}

function barTone(v: number | null | undefined) {
  if (v == null) return "bg-[var(--admin-outline)]";
  if (v >= 76) return "bg-[var(--admin-success)]";
  if (v >= 51) return "bg-[var(--admin-primary)]";
  if (v >= 26) return "bg-[var(--admin-warning)]";
  return "bg-[var(--admin-danger)]";
}

function lessonTypeBadge(type: BatchContentFunnelLesson["lessonType"], typeLabel: string) {
  const label =
    type === "video"
      ? "Video"
      : type === "article"
        ? "Article"
        : type === "quiz"
          ? "Quiz"
          : type === "project"
            ? "Project"
            : typeLabel || "Other";
  if (type === "video") {
    return {
      label,
      className:
        "border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]",
    };
  }
  if (type === "quiz") {
    return {
      label,
      className:
        "border-[color-mix(in_srgb,var(--admin-warning)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]",
    };
  }
  if (type === "project") {
    return {
      label,
      className:
        "border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]",
    };
  }
  return {
    label,
    className:
      "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
  };
}

function learnerName(item: BatchContentLearnerItem) {
  return item.learnerName?.trim() || item.email?.trim() || "Learner";
}

function MiniBar({ value }: { value: number | null | undefined }) {
  if (value == null) return null;
  return (
    <div className="mt-1 h-[3px] w-full max-w-[88px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
      <div className={`h-full rounded-full ${barTone(value)}`} style={{ width: `${clampPct(value)}%` }} />
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
        <BookOpen className="h-8 w-8 text-[var(--admin-outline)]" aria-hidden="true" strokeWidth={1.5} />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">{description}</p>
      {action ? <div className="mt-5 flex justify-center">{action}</div> : null}
    </div>
  );
}

function ErrorStrip({
  title,
  detail,
  onRetry,
  onDismiss,
}: {
  title: string;
  detail?: string | null;
  onRetry?: () => void;
  onDismiss?: () => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
      role="alert"
    >
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-[var(--admin-danger)]">{title}</p>
          {detail ? (
            <p className="mt-0.5 text-xs text-[color-mix(in_srgb,var(--admin-danger)_70%,var(--admin-on-surface))]">
              {detail}
            </p>
          ) : null}
        </div>
      </div>
      {onRetry ? (
        <button
          type="button"
          className="inline-flex h-8 items-center justify-center rounded-lg bg-[var(--admin-danger)] px-4 text-xs font-semibold text-white hover:opacity-90"
          onClick={onRetry}
        >
          <RefreshCw className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
          Retry
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" className={ghostButtonClassName} onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <Shimmer className="h-3 w-72 max-w-full" />
      <div className="flex flex-col gap-4 lg:flex-row lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-52" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-56" />
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 lg:col-span-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Shimmer key={i} className="h-10 w-full" />
          ))}
        </div>
        <div className="space-y-4">
          <Shimmer className="h-40 w-full rounded-lg" />
          <Shimmer className="h-36 w-full rounded-lg" />
        </div>
      </div>
      <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="border-b border-[var(--admin-border)] px-4 py-3 last:border-0">
            <Shimmer className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}

function CompletionSpread({
  spread,
  rosterCount,
}: {
  spread: BatchContentReportData["completionSpread"];
  rosterCount: number;
}) {
  const bands = SPREAD_BANDS.map((b) => ({ ...b, count: spread[b.field] }));
  const total = Math.max(rosterCount, bands.reduce((s, b) => s + b.count, 0), 1);
  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Completion spread</h2>
      <p className="mt-1 text-xs text-[var(--admin-on-surface-variant)]">
        Share of roster in each completion band.
      </p>
      <div className="mt-4 flex h-3 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        {bands.map((band) => {
          const width = (band.count / total) * 100;
          if (width <= 0) return null;
          return (
            <div
              key={band.key}
              className={`h-full ${band.tone}`}
              style={{ width: `${width}%` }}
              title={`${band.label}: ${band.count}`}
            />
          );
        })}
      </div>
      <ul className="mt-4 space-y-2">
        {bands.map((band) => (
          <li
            key={band.key}
            className="flex items-center justify-between gap-3 text-xs text-[var(--admin-on-surface)]"
          >
            <span className="inline-flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-sm ${band.tone}`} aria-hidden="true" />
              {band.label}%
            </span>
            <span className="font-mono text-[var(--admin-on-surface-variant)]">
              {band.count}
              <span className="text-[var(--admin-outline)]"> / </span>
              {formatPct((band.count / total) * 100)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function PacePanel({
  paceSeries,
  paceLabel,
  weeksBehind,
}: {
  paceSeries: BatchContentReportData["paceSeries"];
  paceLabel: string | null;
  weeksBehind: number | null;
}) {
  const behind =
    (weeksBehind != null && weeksBehind > 0) || Boolean(paceLabel && /behind/i.test(paceLabel));
  let maxPct = 1;
  for (const p of paceSeries) {
    if (p.completionPct != null) maxPct = Math.max(maxPct, p.completionPct);
    if (p.expectedPct != null) maxPct = Math.max(maxPct, p.expectedPct);
  }
  const latestExpected = [...paceSeries].reverse().find((p) => p.expectedPct != null)?.expectedPct;

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Pace</h2>
      <p
        className={[
          "mt-1 text-xs",
          behind ? "text-[var(--admin-warning)]" : "text-[var(--admin-on-surface-variant)]",
        ].join(" ")}
      >
        {paceLabel ?? "Cumulative completion across the batch window."}
      </p>
      {paceSeries.length === 0 ? (
        <p className="mt-6 text-center text-xs text-[var(--admin-on-surface-variant)]">No pace data yet.</p>
      ) : (
        <>
          <div className="relative mt-4 h-28">
            {latestExpected != null ? (
              <div
                className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-[var(--admin-on-surface-variant)]"
                style={{ bottom: `${(latestExpected / maxPct) * 100}%` }}
                title={`Expected ${formatPct(latestExpected)}`}
                aria-hidden="true"
              />
            ) : null}
            <div className="absolute inset-0 flex items-end gap-1">
              {paceSeries.map((point) => {
                const pct = point.completionPct ?? 0;
                const height = (pct / maxPct) * 100;
                return (
                  <div
                    key={point.weekStart}
                    className="group relative flex min-w-0 flex-1 flex-col justify-end"
                    title={`${point.weekLabel}: ${formatPct(point.completionPct)}${
                      point.expectedPct != null ? ` (expected ${formatPct(point.expectedPct)})` : ""
                    }`}
                  >
                    {point.expectedPct != null ? (
                      <span
                        className="absolute inset-x-0 z-10 border-t border-dashed border-[var(--admin-outline)]"
                        style={{ bottom: `${(point.expectedPct / maxPct) * 100}%` }}
                        aria-hidden="true"
                      />
                    ) : null}
                    <div
                      className="w-full rounded-t-sm bg-[var(--admin-primary)] group-hover:opacity-90"
                      style={{ height: `${Math.max(height, pct > 0 ? 4 : 0)}%` }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
            <span>{paceSeries[0]?.weekLabel ?? ""}</span>
            <span>{paceSeries[paceSeries.length - 1]?.weekLabel ?? ""}</span>
          </div>
        </>
      )}
    </section>
  );
}

function MessageDrawer({
  open,
  mode,
  count,
  stalledDays,
  subject,
  body,
  busy,
  onSubjectChange,
  onBodyChange,
  onClose,
  onSend,
}: {
  open: boolean;
  mode: MessageMode;
  count: number;
  stalledDays: number;
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
    if (!panel) return;
    const focusable = panel.querySelector<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    (focusable ?? panel).focus();
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
    return () => window.removeEventListener("keydown", onKey);
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
              {mode === "stalled"
                ? "Message learners who have stalled"
                : "Message selected learners"}
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {mode === "stalled"
                ? `${count} learner${count === 1 ? "" : "s"} with no lesson completed in ${stalledDays} days`
                : `Sending to ${count} selected learner${count === 1 ? "" : "s"}`}
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
              onChange={(e) => onSubjectChange(e.target.value)}
              maxLength={200}
            />
          </label>
          <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            Message
            <textarea
              className={`${fieldClassName} h-auto min-h-[180px] py-2`}
              rows={8}
              value={body}
              onChange={(e) => onBodyChange(e.target.value)}
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
            {busy ? "Sending…" : `Send to ${count}`}
          </button>
        </div>
      </aside>
    </div>
  );
}

export function AdminBatchContentPage({ batchId }: { batchId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchId = useId();

  const q = searchParams.get("q") ?? "";
  const view = parseView(searchParams.get("view"));
  const pageRaw = Number(searchParams.get("page"));
  const page = Number.isFinite(pageRaw) && pageRaw >= 1 ? Math.floor(pageRaw) : 1;

  const [draftQ, setDraftQ] = useState(q);
  const [report, setReport] = useState<BatchContentReportData | null>(null);
  const [learners, setLearners] = useState<BatchContentLearnerItem[]>([]);
  const [pageInfo, setPageInfo] = useState<PageInfoShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [learnersLoading, setLearnersLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [learnersError, setLearnersError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageMode, setMessageMode] = useState<MessageMode>("stalled");
  const [messageIds, setMessageIds] = useState<string[]>([]);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [messageBusy, setMessageBusy] = useState(false);
  const [stalledDays, setStalledDays] = useState(14);

  const basePath = `/admin/reports/batches/${batchId}/content`;

  const replaceParams = useCallback(
    (patch: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(patch)) {
        if (value == null || value === "") params.delete(key);
        else params.set(key, value);
      }
      const query = params.toString();
      router.replace(query ? `${basePath}?${query}` : basePath);
    },
    [basePath, router, searchParams],
  );

  useEffect(() => setDraftQ(q), [q]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      const next = draftQ.trim();
      if (next === q) return;
      replaceParams({ q: next || null, page: "1" });
    }, 300);
    return () => window.clearTimeout(t);
  }, [draftQ, q, replaceParams]);

  useEffect(() => {
    setSelectedIds([]);
    setRowMenuId(null);
  }, [q, view, page]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if ((event.target as HTMLElement | null)?.closest("[data-row-menu]")) return;
      setRowMenuId(null);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setRowMenuId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchBatchContent(batchId);
      setReport(response.data);
      setStalledDays(response.data.summary.stalledDaysThreshold || 14);
    } catch (e) {
      setError(errMsg(e, "Couldn't load content completion."));
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  const loadLearners = useCallback(async () => {
    setLearnersLoading(true);
    setLearnersError(null);
    try {
      const response = await fetchBatchContentLearners(batchId, {
        q: q.trim() || undefined,
        view,
        sortBy: "days_since",
        sortDir: "desc",
        page,
        limit: PAGE_SIZE,
      });
      setLearners(response.data.items);
      setPageInfo(response.data.pageInfo);
    } catch (e) {
      setLearnersError(errMsg(e, "Couldn't load learners."));
      setLearners([]);
      setPageInfo(null);
    } finally {
      setLearnersLoading(false);
    }
  }, [batchId, page, q, view]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  useEffect(() => {
    if (!report?.courseId) {
      setLearners([]);
      setPageInfo(null);
      setLearnersLoading(false);
      setLearnersError(null);
      return;
    }
    void loadLearners();
  }, [loadLearners, report?.courseId]);

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportBatchReport({ batchId, emailDownloadLink: true });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status === "failed") throw new Error(completed.errorMessage ?? "Export failed.");
      if (completed.status === "completed") await downloadReportExport(completed.id, "csv");
    } catch (e) {
      setActionError(errMsg(e, "Unable to export report."));
    } finally {
      setBusy(false);
    }
  }

  async function openMessageStalled() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await fetchBatchContentStalled(batchId);
      const ids = response.data.membershipIds;
      const days = response.data.stalledDaysThreshold || stalledDays;
      setStalledDays(days);
      if (ids.length === 0) {
        setActionError("No stalled learners to message for this batch.");
        return;
      }
      setMessageMode("stalled");
      setMessageIds(ids);
      setMessageSubject("Catch up on your course progress");
      setMessageBody(
        `We noticed you have not completed a lesson in ${days} days. Please return to the course when you can, and reach out if you need help getting back on track.`,
      );
      setMessageOpen(true);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't load stalled learners."));
    } finally {
      setBusy(false);
    }
  }

  function openMessageSelected(ids: string[]) {
    if (ids.length === 0) return;
    setMessageMode("selected");
    setMessageIds(ids);
    setMessageSubject("About your course progress");
    setMessageBody(
      "We wanted to check in on your course progress. Please continue when you can, and reach out if you need help.",
    );
    setMessageOpen(true);
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
      setSelectedIds([]);
    } catch (e) {
      setActionError(errMsg(e, "Couldn't send message."));
    } finally {
      setMessageBusy(false);
    }
  }

  function toggleSelectAll() {
    if (learners.length > 0 && selectedIds.length === learners.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(learners.map((row) => row.membershipId));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }

  function toggleView(next: ContentView) {
    replaceParams({ view: next === "any" ? null : next, page: "1" });
  }

  const batchName = report?.batchName ?? "Batch";
  const summary = report?.summary;
  const courseId = report?.courseId ?? null;
  const totalLessons = summary?.totalLessons ?? 0;
  const noCourse = report != null && report.courseId == null;
  const noLessons =
    report != null && report.courseId != null && totalLessons === 0 && report.modules.length === 0;
  const totalCount = pageInfo?.totalCount ?? 0;
  const totalPages = pageInfo?.totalPages ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);
  const avgLessonsCaption =
    summary?.avgCompletedLessons == null || Number.isNaN(summary.avgCompletedLessons)
      ? `- of ${summary?.totalLessons ?? 0} lessons on average`
      : `${Number(summary.avgCompletedLessons).toFixed(
          summary.avgCompletedLessons % 1 === 0 ? 0 : 1,
        )} of ${summary.totalLessons} lessons on average`;

  if (loading && !report) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <PageSkeleton />
      </div>
    );
  }

  if (error && !report) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <ErrorStrip
          title="Couldn't load content completion."
          detail={error}
          onRetry={() => void loadReport()}
        />
        <div className="opacity-40">
          <PageSkeleton />
        </div>
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
        <Link href="/admin/reports/batches" className="hover:text-[var(--admin-primary)]">
          Batches
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <Link href={`/admin/reports/batches/${batchId}`} className="hover:text-[var(--admin-primary)]">
          {batchName}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Content</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Content completion
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            How far this cohort has moved through the linked course.
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
          <Link
            href={courseId ? `/studio/courses/${courseId}` : "/admin/courses"}
            className={secondaryButtonClassName}
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open course
          </Link>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={busy || noCourse}
            onClick={() => void openMessageStalled()}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Message learners who have stalled
          </button>
        </div>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Batch report tabs">
          {SUB_TABS.map((tab) => {
            const active = tab.key === "content";
            return (
              <Link
                key={tab.key}
                href={`/admin/reports/batches/${batchId}${tab.path}`}
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
        <ErrorStrip title={actionError} onDismiss={() => setActionError(null)} />
      ) : null}

      {noCourse ? (
        <EmptyState
          title="No course linked"
          description="This batch has no linked course, so content completion cannot be reported yet."
          action={
            <Link href="/admin/courses" className={secondaryButtonClassName}>
              Open course library
            </Link>
          }
        />
      ) : noLessons ? (
        <EmptyState
          title="No lessons in course yet"
          description="The linked course has no lessons, so there is nothing to measure yet."
          action={
            courseId ? (
              <Link href={`/studio/courses/${courseId}`} className={secondaryButtonClassName}>
                Open course
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          {summary ? (
            <div className="grid grid-cols-1 overflow-hidden rounded-sm border border-[var(--admin-border)] md:grid-cols-6 md:gap-px md:bg-[var(--admin-border)]">
              <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 md:col-span-2">
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Average completion
                </p>
                <p className="font-mono text-[32px] font-medium leading-none text-[var(--admin-on-surface)]">
                  {formatPct(summary.avgCompletionPct)}
                </p>
                <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className={`h-full rounded-full ${barTone(summary.avgCompletionPct)}`}
                    style={{ width: `${clampPct(summary.avgCompletionPct ?? 0)}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">{avgLessonsCaption}</p>
              </div>
              <button
                type="button"
                className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                onClick={() => toggleView(view === "finished" ? "any" : "finished")}
              >
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-success)]">
                  Finished the course
                </p>
                <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-success)]">
                  {summary.finishedCount}
                </p>
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">learners</p>
              </button>
              <button
                type="button"
                className="relative flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                onClick={() => toggleView(view === "stalled" ? "any" : "stalled")}
              >
                <span className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-warning)]" aria-hidden="true" />
                <p className="mb-3 pl-2 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-warning)]">
                  Stalled
                </p>
                <p className="pl-2 font-mono text-2xl font-medium leading-none text-[var(--admin-warning)]">
                  {summary.stalledCount}
                </p>
                <p className="mt-2 pl-2 text-xs text-[var(--admin-on-surface-variant)]">
                  no lesson completed in {summary.stalledDaysThreshold} days
                </p>
              </button>
              <button
                type="button"
                className="flex flex-col justify-between bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                onClick={() => toggleView(view === "never_started" ? "any" : "never_started")}
              >
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Never started
                </p>
                <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
                  {summary.neverStartedCount}
                </p>
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">learners</p>
              </button>
              <div className="flex flex-col justify-between bg-[var(--admin-surface)] p-5">
                <p className="mb-3 font-mono text-[11px] font-medium uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
                  Median time to finish
                </p>
                <p className="font-mono text-2xl font-medium leading-none text-[var(--admin-on-surface)]">
                  {summary.medianDaysToFinish == null ? "-" : summary.medianDaysToFinish}
                </p>
                <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">days</p>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] lg:col-span-2">
              <div className="border-b border-[var(--admin-border)] px-4 py-3">
                <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">Curriculum funnel</h2>
                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Lesson completion across the linked course, in sequence.
                </p>
              </div>
              {report?.modules.length ? (
                report.modules.map((mod) => (
                  <div key={mod.moduleId}>
                    <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                        {mod.title}
                      </p>
                    </div>
                    {mod.lessons.length === 0 ? (
                      <p className="px-4 py-6 text-center text-xs text-[var(--admin-on-surface-variant)]">
                        No lessons
                      </p>
                    ) : (
                      mod.lessons.map((lesson) => {
                        const badge = lessonTypeBadge(lesson.lessonType, lesson.typeLabel);
                        const isDropOff =
                          lesson.healthRail === "warning" || lesson.healthRail === "danger";
                        return (
                          <button
                            key={lesson.lessonId}
                            type="button"
                            className={[
                              "group relative flex w-full flex-col gap-2 border-b border-[var(--admin-border)] px-4 py-3 text-left last:border-b-0 transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--admin-primary)]/30 sm:flex-row sm:items-center sm:gap-4",
                              isDropOff
                                ? "bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))]"
                                : "",
                            ].join(" ")}
                            onClick={() => toggleView("in_progress")}
                          >
                            <span
                              className={`absolute inset-y-0 left-0 w-1 ${healthRailClass(lesson.healthRail)}`}
                              aria-hidden="true"
                            />
                            <span className="w-8 shrink-0 pl-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                              {String(lesson.sequenceNumber).padStart(2, "0")}
                            </span>
                            <div className="min-w-0 flex-1 pl-2 sm:pl-0">
                              <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                                {lesson.title}
                              </p>
                              {isDropOff && lesson.dropOffPct != null ? (
                                <p className="mt-0.5 text-[11px] text-[var(--admin-warning)]">
                                  Drop-off of {formatPct(lesson.dropOffPct)}
                                </p>
                              ) : null}
                            </div>
                            <span
                              className={`inline-flex w-fit shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                            <div className="w-full shrink-0 sm:w-40">
                              <div className="flex items-center justify-between gap-2">
                                <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                                  <div
                                    className={`h-full rounded-full ${barTone(lesson.completionPct)}`}
                                    style={{ width: `${clampPct(lesson.completionPct ?? 0)}%` }}
                                  />
                                </div>
                                <span className="shrink-0 font-mono text-[11px] text-[var(--admin-on-surface)]">
                                  {lesson.completedCount}
                                  <span className="text-[var(--admin-on-surface-variant)]">
                                    /{lesson.rosterCount}
                                  </span>
                                </span>
                              </div>
                            </div>
                            <span className="w-full shrink-0 font-mono text-[11px] text-[var(--admin-on-surface-variant)] sm:w-20 sm:text-right">
                              {lesson.medianDurationLabel ?? "-"}
                            </span>
                          </button>
                        );
                      })
                    )}
                  </div>
                ))
              ) : (
                <p className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]">
                  No lessons
                </p>
              )}
            </section>

            <div className="flex flex-col gap-4">
              {report ? (
                <CompletionSpread
                  spread={report.completionSpread}
                  rosterCount={summary?.rosterCount ?? 0}
                />
              ) : null}
              {report ? (
                <PacePanel
                  paceSeries={report.paceSeries}
                  paceLabel={summary?.paceLabel ?? null}
                  weeksBehind={summary?.weeksBehindSchedule ?? null}
                />
              ) : null}
            </div>
          </div>

          {selectedIds.length > 0 ? (
            <div className="sticky top-2 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3 shadow-sm">
              <p className="text-sm text-[var(--admin-on-surface)]">
                <span className="font-mono font-medium">{selectedIds.length}</span> learner
                {selectedIds.length === 1 ? "" : "s"} selected
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={secondaryButtonClassName}
                  onClick={() => openMessageSelected(selectedIds)}
                >
                  <Mail className="h-4 w-4" aria-hidden="true" />
                  Message selected
                </button>
                <button type="button" className={ghostButtonClassName} onClick={() => setSelectedIds([])}>
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
                  <Search
                    className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <label htmlFor={searchId} className="sr-only">
                    Search learners
                  </label>
                  <input
                    id={searchId}
                    className={`${fieldClassName} w-full pl-9`}
                    placeholder="Search name or email"
                    value={draftQ}
                    onChange={(e) => setDraftQ(e.target.value)}
                  />
                </div>
                <div
                  className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-0.5"
                  role="tablist"
                  aria-label="Learner view filter"
                >
                  {VIEW_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="tab"
                      aria-selected={view === opt.value}
                      className={[
                        "h-8 rounded-md px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30",
                        view === opt.value
                          ? "bg-[var(--admin-surface)] text-[var(--admin-on-surface)] shadow-sm"
                          : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                      ].join(" ")}
                      onClick={() => toggleView(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Showing {rangeStart}-{rangeEnd} of {totalCount}
              </p>
            </div>

            {learnersError ? (
              <div className="border-b border-[var(--admin-border)] p-4">
                <ErrorStrip
                  title="Couldn't load learners."
                  detail={learnersError}
                  onRetry={() => void loadLearners()}
                />
              </div>
            ) : null}

            {learnersLoading && learners.length === 0 && !learnersError ? (
              <div>
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 border-b border-[var(--admin-border)] px-4 py-3 last:border-b-0"
                  >
                    <Shimmer className="h-4 w-4" />
                    <Shimmer className="h-4 w-40" />
                    <Shimmer className="ml-auto h-4 w-24" />
                  </div>
                ))}
              </div>
            ) : !learnersError && learners.length === 0 ? (
              <div className="px-6 py-14 text-center">
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">No learners match</p>
                <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                  Try clearing search or changing the view filter.
                </p>
              </div>
            ) : !learnersError ? (
              <div className={`overflow-x-auto ${learnersLoading ? "opacity-60" : ""}`}>
                <table className="min-w-[1100px] w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                      <th className="w-11 px-3 py-2.5">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={learners.length > 0 && selectedIds.length === learners.length}
                          onChange={toggleSelectAll}
                          aria-label="Select all learners on this page"
                        />
                      </th>
                      <th className={thClass}>Learner</th>
                      <th className={thClass}>Completion</th>
                      <th className={thClass}>Last lesson completed</th>
                      <th className={thClass}>Days since</th>
                      <th className={thClass}>Projected finish</th>
                      <th className={`${thClass} w-12`}>
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {learners.map((row) => {
                      const name = learnerName(row);
                      const stalled =
                        row.activityStatus === "stalled" ||
                        (row.daysSinceActivity != null && row.daysSinceActivity >= stalledDays);
                      const willNotFinish =
                        row.projectedFinishLabel === "Will not finish in window" ||
                        row.willFinishInWindow === false;
                      return (
                        <tr
                          key={row.membershipId}
                          className="group relative border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[var(--admin-surface-low)]"
                        >
                          <td className="relative px-3 py-3">
                            <span
                              className={`absolute inset-y-0 left-0 w-1 ${healthRailClass(row.healthRail)}`}
                              aria-hidden="true"
                            />
                            <input
                              type="checkbox"
                              className="ml-2 h-4 w-4 accent-[var(--admin-primary)]"
                              checked={selectedIds.includes(row.membershipId)}
                              onChange={() => toggleSelect(row.membershipId)}
                              aria-label={`Select ${name}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                              <Link
                                href={`/admin/reports/batches/${batchId}/learners/${row.membershipId}`}
                                className="hover:text-[var(--admin-primary)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                              >
                                {name}
                              </Link>
                            </p>
                            {row.email && row.learnerName ? (
                              <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {row.email}
                              </p>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <p className="font-mono text-xs font-medium text-[var(--admin-on-surface)]">
                              {formatPct(row.completionPct)}
                            </p>
                            <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {row.completedLessons} of {row.totalLessons}
                            </p>
                            <MiniBar value={row.completionPct} />
                          </td>
                          <td className="px-4 py-3">
                            <p className="max-w-[220px] truncate text-sm text-[var(--admin-on-surface)]">
                              {row.lastLessonTitle ?? "-"}
                            </p>
                            <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {formatDateTime(row.lastActivityAt)}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className={[
                                "font-mono text-xs",
                                stalled
                                  ? "text-[var(--admin-warning)]"
                                  : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              {row.daysSinceActivity == null ? "-" : row.daysSinceActivity}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <p
                              className={[
                                "text-xs",
                                willNotFinish
                                  ? "font-medium text-[var(--admin-danger)]"
                                  : "text-[var(--admin-on-surface)]",
                              ].join(" ")}
                            >
                              {row.projectedFinishLabel || "-"}
                            </p>
                          </td>
                          <td className="relative px-3 py-3" data-row-menu>
                            <button
                              type="button"
                              className="rounded p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                              aria-label={`Actions for ${name}`}
                              aria-expanded={rowMenuId === row.membershipId}
                              onClick={() =>
                                setRowMenuId((c) =>
                                  c === row.membershipId ? null : row.membershipId,
                                )
                              }
                            >
                              <MoreVertical className="h-4 w-4" aria-hidden="true" />
                            </button>
                            {rowMenuId === row.membershipId ? (
                              <div className="absolute right-3 top-9 z-30 min-w-[180px] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="block w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setRowMenuId(null);
                                    openMessageSelected([row.membershipId]);
                                  }}
                                >
                                  Message
                                </button>
                                <Link
                                  href={`/admin/reports/batches/${batchId}/learners/${row.membershipId}`}
                                  className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => setRowMenuId(null)}
                                >
                                  Open learner
                                </Link>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            {totalPages > 1 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3">
                <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                  Page {page} of {totalPages}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={page <= 1}
                    onClick={() => replaceParams({ page: String(page - 1) })}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    disabled={page >= totalPages}
                    onClick={() => replaceParams({ page: String(page + 1) })}
                  >
                    Next
                  </button>
                </div>
              </div>
            ) : null}
          </section>
        </>
      )}

      <MessageDrawer
        open={messageOpen}
        mode={messageMode}
        count={messageIds.length}
        stalledDays={stalledDays}
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
