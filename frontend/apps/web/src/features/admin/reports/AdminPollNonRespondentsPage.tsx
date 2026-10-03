"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Group,
  Info,
  Mail,
  Pencil,
  RefreshCw,
  Search,
  UserX,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchPollNonRespondents,
  type PollNonRespondentItem,
  type PollNonRespondentsSummary,
} from "./admin-polls-roster-api";
import { csvEscape } from "@/lib/export/csv";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 100;

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const MERGE_TOKENS = [
  { token: "[learner name]", label: "learner name" },
  { token: "[poll question]", label: "poll question" },
  { token: "[session title]", label: "session title" },
  { token: "[recording link]", label: "recording link" },
] as const;

type PresenceFilter = "any" | "present" | "absent";
type SortBy =
  | "learner_name"
  | "batch_name"
  | "presence"
  | "watch_seconds"
  | "polls_answered"
  | "last_response_at";
type SortDir = "asc" | "desc";

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

function formatWatchSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  const total = Math.max(0, Math.floor(value));
  if (total < 60) return `${String(total)}s`;
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes)}:${String(seconds).padStart(2, "0")}`;
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function escapeCsvCell(value: string): string {
  // Non-respondent exports are lists of learner names; csvEscape adds the
  // formula-prefix guard this was missing (M1).
  return csvEscape(value);
}

function buildCsv(rows: PollNonRespondentItem[]): string {
  const header = [
    "Learner",
    "Email",
    "Batch",
    "Presence",
    "Watch time (seconds)",
    "Polls answered",
    "Last response",
  ];
  const lines = [header.join(",")];
  for (const row of rows) {
    lines.push(
      [
        escapeCsvCell(row.learnerName ?? ""),
        escapeCsvCell(row.email ?? ""),
        escapeCsvCell(row.batchName ?? ""),
        escapeCsvCell(row.presence),
        escapeCsvCell(row.watchSeconds == null ? "" : String(row.watchSeconds)),
        escapeCsvCell(String(row.pollsAnswered)),
        escapeCsvCell(row.lastResponseAt ?? ""),
      ].join(","),
    );
  }
  return `${lines.join("\n")}\n`;
}

function downloadCsvBlob(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function wrapSelection(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  wrapper: string,
): { next: string; cursor: number } {
  const selected = value.slice(selectionStart, selectionEnd);
  if (selected.length === 0) {
    const inserted = `${wrapper}${wrapper}`;
    const next = `${value.slice(0, selectionStart)}${inserted}${value.slice(selectionEnd)}`;
    return { next, cursor: selectionStart + wrapper.length };
  }
  const wrapped = `${wrapper}${selected}${wrapper}`;
  const next = `${value.slice(0, selectionStart)}${wrapped}${value.slice(selectionEnd)}`;
  return { next, cursor: selectionStart + wrapped.length };
}

function NonRespondentsLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <Shimmer className="h-3 w-80" />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-28" />
          <Shimmer className="h-8 w-56" />
          <Shimmer className="h-4 w-96 max-w-full" />
          <Shimmer className="mt-2 h-6 w-64 rounded-md" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-44" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Shimmer key={index} className="h-28 bg-[var(--admin-surface)]" />
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] p-4">
          <Shimmer className="h-9 w-64" />
          <Shimmer className="h-9 w-36" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-left text-sm">
            <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
              <tr>
                <th className="w-11 px-3 py-3">
                  <Shimmer className="h-4 w-4" />
                </th>
                <th className="px-4 py-3">Learner</th>
                <th className="px-4 py-3">Batch</th>
                <th className="px-4 py-3">Presence</th>
                <th className="px-4 py-3 text-right">Watch time</th>
                <th className="px-4 py-3 text-right">Polls answered</th>
                <th className="px-4 py-3 text-right">Last response</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: 6 }).map((_, index) => (
                <tr key={index} className="h-11 border-b border-[var(--admin-border)]">
                  <td className="px-3 py-3">
                    <Shimmer className="h-4 w-4" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Shimmer className="h-8 w-8 rounded-full" />
                      <div className="space-y-1">
                        <Shimmer className="h-3.5 w-32" />
                        <Shimmer className="h-3 w-40" />
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Shimmer className="h-5 w-24 rounded-md" />
                  </td>
                  <td className="px-4 py-3">
                    <Shimmer className="h-5 w-16 rounded-full" />
                  </td>
                  <td className="px-4 py-3">
                    <Shimmer className="ml-auto h-3.5 w-12" />
                  </td>
                  <td className="px-4 py-3">
                    <Shimmer className="ml-auto h-3.5 w-8" />
                  </td>
                  <td className="px-4 py-3">
                    <Shimmer className="ml-auto h-3.5 w-28" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ErrorPanel({ message, onRetry }: { message: string; onRetry: () => void }) {
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
              Couldn&apos;t load non-respondents.
            </p>
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
      <div className="pointer-events-none opacity-40">
        <NonRespondentsLoadingSkeleton />
      </div>
    </>
  );
}

function UnknownAudiencePanel() {
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-16 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <UserX
          className="h-9 w-9 text-[var(--admin-outline)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h2 className="max-w-lg text-base font-semibold text-[var(--admin-on-surface)]">
        This poll has no known audience, so non-respondents cannot be listed.
      </h2>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Link the poll to a live session or a batch to enable this view.
      </p>
      <Link href="/admin/polls" className={`${primaryButtonClassName} mt-8`}>
        <Pencil className="h-4 w-4" aria-hidden="true" />
        Open in poll editor
      </Link>
    </div>
  );
}

function MessageNonRespondentsDrawer({
  open,
  pollTitle,
  pollIsOpen,
  sendCount,
  presentNonRespondentCount,
  excludeAbsent,
  onExcludeAbsentChange,
  subject,
  onSubjectChange,
  body,
  onBodyChange,
  channelEmail,
  onChannelEmailChange,
  channelInApp,
  onChannelInAppChange,
  onClose,
  onSend,
  onTestSend,
}: {
  open: boolean;
  pollTitle: string;
  pollIsOpen: boolean;
  sendCount: number;
  presentNonRespondentCount: number;
  excludeAbsent: boolean;
  onExcludeAbsentChange: (value: boolean) => void;
  subject: string;
  onSubjectChange: (value: string) => void;
  body: string;
  onBodyChange: (value: string) => void;
  channelEmail: boolean;
  onChannelEmailChange: (value: boolean) => void;
  channelInApp: boolean;
  onChannelInAppChange: (value: boolean) => void;
  onClose: () => void;
  onSend: () => void;
  onTestSend: () => void;
}) {
  const titleId = useId();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const focusable = panelRef.current.querySelector<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [open]);

  function insertToken(token: string) {
    const el = bodyRef.current;
    if (!el) {
      onBodyChange(`${body}${token}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const next = `${body.slice(0, start)}${token}${body.slice(end)}`;
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  }

  function applyWrap(wrapper: string) {
    const el = bodyRef.current;
    if (!el) {
      onBodyChange(`${wrapper}${body}${wrapper}`);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const { next, cursor } = wrapSelection(body, start, end, wrapper);
    onBodyChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(cursor, cursor);
    });
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)]">
      <button
        type="button"
        className="absolute inset-0 cursor-default"
        aria-label="Close message drawer overlay"
        onClick={onClose}
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
          <div className="min-w-0 pr-4">
            <h2 id={titleId} className="text-base font-semibold text-[var(--admin-on-surface)]">
              {sendCount.toLocaleString()} learner{sendCount === 1 ? "" : "s"} did not answer
            </h2>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Compose a follow-up message to collect responses.
            </p>
          </div>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
            aria-label="Close"
            onClick={onClose}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {pollIsOpen ? (
            <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_10%,var(--admin-surface))] px-3 py-3">
              <Info
                className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]"
                aria-hidden="true"
              />
              <div>
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                  Poll is still open
                </p>
                <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  Learners will be directed to the active poll link.
                </p>
              </div>
            </div>
          ) : null}

          <fieldset className="space-y-2">
            <legend className="text-xs text-[var(--admin-on-surface-variant)]">Channels</legend>
            <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={channelEmail}
                onChange={(event) => {
                  onChannelEmailChange(event.target.checked);
                }}
              />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--admin-primary)]"
                checked={channelInApp}
                onChange={(event) => {
                  onChannelInAppChange(event.target.checked);
                }}
              />
              In-app
            </label>
          </fieldset>

          <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
            Subject
            <input
              className={fieldClassName}
              value={subject}
              onChange={(event) => {
                onSubjectChange(event.target.value);
              }}
              maxLength={200}
              placeholder={`We missed your answer: ${pollTitle}`}
            />
          </label>

          <div className="space-y-2">
            <p className="text-xs text-[var(--admin-on-surface-variant)]">Insert tokens</p>
            <div className="flex flex-wrap gap-2">
              {MERGE_TOKENS.map((item) => (
                <button
                  key={item.token}
                  type="button"
                  className="inline-flex h-7 items-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2.5 font-mono text-[11px] text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
                  onClick={() => {
                    insertToken(item.token);
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--admin-on-surface-variant)]">Message</p>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2 text-xs font-semibold text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    applyWrap("**");
                  }}
                  aria-label="Bold selection"
                >
                  B
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 min-w-7 items-center justify-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2 text-xs italic text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() => {
                    applyWrap("_");
                  }}
                  aria-label="Italic selection"
                >
                  I
                </button>
              </div>
            </div>
            <textarea
              ref={bodyRef}
              className={`${fieldClassName} h-auto min-h-[180px] w-full py-2`}
              rows={8}
              value={body}
              onChange={(event) => {
                onBodyChange(event.target.value);
              }}
              maxLength={10000}
            />
          </div>

          <label className="flex items-start gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-3">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-[var(--admin-primary)]"
              checked={excludeAbsent}
              onChange={(event) => {
                onExcludeAbsentChange(event.target.checked);
              }}
            />
            <span>
              <span className="block text-sm text-[var(--admin-on-surface)]">
                Exclude learners who were not present when the poll ran
              </span>
              <span className="mt-1 block text-xs text-[var(--admin-on-surface-variant)]">
                Updates count to {presentNonRespondentCount.toLocaleString()} learner
                {presentNonRespondentCount === 1 ? "" : "s"}
              </span>
            </span>
          </label>

          <button
            type="button"
            className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
            onClick={onTestSend}
          >
            Send a test to myself
          </button>

          <p className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-3 text-sm text-[var(--admin-on-surface-variant)]">
            You are about to send a message to{" "}
            <span className="font-semibold text-[var(--admin-on-surface)]">
              {sendCount.toLocaleString()} learner{sendCount === 1 ? "" : "s"}
            </span>
            . Review the subject and body before sending.
          </p>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={ghostButtonClassName} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            disabled={
              sendCount === 0 || !subject.trim() || !body.trim() || (!channelEmail && !channelInApp)
            }
            onClick={onSend}
          >
            <Mail className="h-4 w-4" aria-hidden="true" />
            Send to {sendCount.toLocaleString()} learner{sendCount === 1 ? "" : "s"}
          </button>
        </div>
      </aside>
    </div>
  );
}

export function AdminPollNonRespondentsPage({ pollId }: { pollId: string }) {
  const searchId = useId();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [summary, setSummary] = useState<PollNonRespondentsSummary | null>(null);
  const [items, setItems] = useState<PollNonRespondentItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [presence, setPresence] = useState<PresenceFilter>("any");
  const [sortBy, setSortBy] = useState<SortBy>("learner_name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [messageOpen, setMessageOpen] = useState(false);
  const [excludeAbsent, setExcludeAbsent] = useState(false);
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [channelEmail, setChannelEmail] = useState(true);
  const [channelInApp, setChannelInApp] = useState(false);

  const hasFilters = Boolean(q.trim() || presence !== "any");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPollNonRespondents(pollId, {
        q: q.trim() || undefined,
        presence,
        sortBy,
        sortDir,
        page,
        limit: PAGE_SIZE,
      });
      setSummary(response.data.summary);
      setItems(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setSummary(null);
      setItems([]);
      setTotalCount(0);
      setTotalPages(0);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load non-respondents.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, pollId, presence, q, sortBy, sortDir]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, presence, q, sortBy, sortDir, pollId]);

  function applySearch() {
    setQ(draftQ.trim());
    setPage(1);
  }

  const audienceLabel = useMemo(() => {
    if (!summary) return null;
    if (summary.audienceSource === "live_session") {
      const title = summary.liveSessionTitle ?? "Live session";
      return `${title} · ${summary.eligibleCount.toLocaleString()} eligible`;
    }
    if (summary.audienceSource === "batch") {
      return summary.batchName ?? "Batch audience";
    }
    return null;
  }, [summary]);

  const sendCount = useMemo(() => {
    if (!summary) return 0;
    if (excludeAbsent) return summary.presentNonRespondentCount;
    if (selectedIds.length > 0) return selectedIds.length;
    return summary.nonRespondentCount;
  }, [excludeAbsent, selectedIds.length, summary]);

  const pageIds = useMemo(() => items.map((row) => row.membershipId), [items]);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));

  function toggleSelectAll() {
    if (pageIds.length === 0) return;
    if (allPageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }
    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  }

  function toggleSelectRow(membershipId: string) {
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  function openMessageDrawer() {
    if (!summary) return;
    setExcludeAbsent(false);
    setMessageSubject(`We missed your answer: ${summary.pollTitle}`);
    setMessageBody("");
    setChannelEmail(true);
    setChannelInApp(false);
    setMessageOpen(true);
    setNotice(null);
  }

  async function handleExport() {
    if (!summary?.audienceKnown) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const collected: PollNonRespondentItem[] = [];
      let exportPage = 1;
      let hasMore = true;

      while (hasMore) {
        const response = await fetchPollNonRespondents(pollId, {
          q: q.trim() || undefined,
          presence,
          sortBy,
          sortDir,
          page: exportPage,
          limit: EXPORT_PAGE_SIZE,
        });
        if (!response.data.summary.audienceKnown) {
          throw new Error("This poll has no known audience to export.");
        }
        collected.push(...response.data.items);
        hasMore = response.data.pageInfo.hasNextPage;
        exportPage += 1;
        if (exportPage > 1000) break;
      }

      const filtered =
        selectedIds.length > 0
          ? collected.filter((row) => selectedIds.includes(row.membershipId))
          : collected;

      downloadCsvBlob(`poll-${pollId}-non-respondents.csv`, buildCsv(filtered));
      setNotice(
        `Exported ${filtered.length.toLocaleString()} non-respondent${filtered.length === 1 ? "" : "s"}.`,
      );
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export CSV.",
      );
    } finally {
      setBusy(false);
    }
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, totalCount);

  const emptyMessage = hasFilters
    ? "No non-respondents match filters."
    : "Everyone in the audience responded.";

  if (loading && !summary && !error) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <NonRespondentsLoadingSkeleton />
      </div>
    );
  }

  if (error && !summary) {
    return (
      <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-16">
        <ErrorPanel message={error} onRetry={() => void load()} />
      </div>
    );
  }

  const pollTitle = summary?.pollTitle ?? "Poll";
  const audienceKnown = Boolean(summary?.audienceKnown);

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
        <Link
          href={`/admin/reports/polls/${pollId}`}
          className="max-w-[200px] truncate hover:text-[var(--admin-primary)]"
        >
          {pollTitle}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="font-medium text-[var(--admin-on-surface)]">Non-respondents</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/reports/polls/${pollId}`}
            className={`${ghostButtonClassName} mb-3 inline-flex`}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Poll report
          </Link>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Non-respondents
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Learners who were eligible for this poll and did not answer.
          </p>
          {audienceKnown && audienceLabel ? (
            <div className="mt-3 inline-flex max-w-full items-center gap-2 rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
              <Group className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{audienceLabel}</span>
            </div>
          ) : null}
        </div>

        {audienceKnown ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={secondaryButtonClassName}
              disabled={busy || loading}
              onClick={() => void handleExport()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              {busy ? "Exporting..." : "Export CSV"}
            </button>
            <button
              type="button"
              className={primaryButtonClassName}
              onClick={openMessageDrawer}
              disabled={!summary || summary.nonRespondentCount === 0}
            >
              <Mail className="h-4 w-4" aria-hidden="true" />
              Message non-respondents
            </button>
          </div>
        ) : null}
      </div>

      {error && summary ? (
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
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {notice ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-start sm:justify-between"
          role="status"
        >
          <div className="flex items-start gap-3">
            <Info
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]"
              aria-hidden="true"
            />
            <p className="text-sm text-[var(--admin-on-surface)]">{notice}</p>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => {
              setNotice(null);
            }}
            aria-label="Dismiss notice"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      {!audienceKnown && summary ? (
        <UnknownAudiencePanel />
      ) : summary ? (
        <>
          <div className="grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-4">
            <div className="space-y-3 bg-[var(--admin-surface)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Eligible
              </p>
              <p className="font-mono text-[32px] font-semibold leading-none text-[var(--admin-on-surface)]">
                {summary.eligibleCount.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">Known audience size</p>
            </div>
            <div className="space-y-3 bg-[var(--admin-surface)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-success)]">
                Responded
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-success)]">
                {summary.respondentCount.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">Submitted an answer</p>
            </div>
            <div className="space-y-3 bg-[var(--admin-surface)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-warning)]">
                Non-respondents
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-warning)]">
                {summary.nonRespondentCount.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                Eligible and unanswered
              </p>
            </div>
            <div className="space-y-3 bg-[var(--admin-surface)] p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Present non-respondents
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {summary.presentNonRespondentCount.toLocaleString()}
              </p>
              <p className="text-xs text-[var(--admin-on-surface-variant)]">
                {summary.absentNonRespondentCount.toLocaleString()} absent
              </p>
            </div>
          </div>

          <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="border-b border-[var(--admin-border)] p-4">
              <div className="flex flex-wrap items-end gap-3">
                <label className="relative grid min-w-[220px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Search
                  <Search
                    className="pointer-events-none absolute bottom-2.5 left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    id={searchId}
                    className={`${fieldClassName} w-full pl-9`}
                    placeholder="Name or email"
                    value={draftQ}
                    onChange={(event) => {
                      setDraftQ(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applySearch();
                    }}
                  />
                </label>
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Presence
                  <Select
                    className={selectClassName}
                    value={presence}
                    onValueChange={(value) => {
                      setPresence(value === "present" || value === "absent" ? value : "any");
                      setPage(1);
                    }}
                    options={[
                      { value: "any", label: "Any presence" },
                      { value: "present", label: "Present" },
                      { value: "absent", label: "Absent" },
                    ]}
                    ariaLabel="Filter by presence"
                  />
                </label>
                <label className="grid gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                  Sort
                  <Select
                    className={selectClassName}
                    value={sortBy}
                    onValueChange={(value) => {
                      const next =
                        value === "batch_name" ||
                        value === "presence" ||
                        value === "watch_seconds" ||
                        value === "polls_answered" ||
                        value === "last_response_at"
                          ? value
                          : "learner_name";
                      setSortBy(next);
                      setPage(1);
                    }}
                    options={[
                      { value: "learner_name", label: "Learner" },
                      { value: "batch_name", label: "Batch" },
                      { value: "presence", label: "Presence" },
                      { value: "watch_seconds", label: "Watch time" },
                      { value: "polls_answered", label: "Polls answered" },
                      { value: "last_response_at", label: "Last response" },
                    ]}
                    ariaLabel="Sort non-respondents"
                  />
                </label>
                <Select
                  className={selectClassName}
                  value={sortDir}
                  onValueChange={(value) => {
                    setSortDir(value === "desc" ? "desc" : "asc");
                    setPage(1);
                  }}
                  options={[
                    { value: "asc", label: "Asc" },
                    { value: "desc", label: "Desc" },
                  ]}
                  ariaLabel="Sort direction"
                />
                <button type="button" className={secondaryButtonClassName} onClick={applySearch}>
                  Apply
                </button>
                {selectedIds.length > 0 ? (
                  <p className="ml-auto self-center text-sm text-[var(--admin-on-surface)]">
                    <span className="font-mono font-medium">{selectedIds.length}</span> selected
                  </p>
                ) : null}
              </div>
            </div>

            {selectedIds.length > 0 ? (
              <div className="mx-4 mb-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                <p className="text-sm text-[var(--admin-on-surface)]">
                  <span className="font-mono font-medium">{selectedIds.length}</span> learner
                  {selectedIds.length === 1 ? "" : "s"} selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={secondaryButtonClassName}
                    onClick={openMessageDrawer}
                  >
                    <Mail className="h-4 w-4" aria-hidden="true" />
                    Message selected
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
              <table className="w-full min-w-[960px] text-left text-sm">
                <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  <tr>
                    <th className="w-11 px-3 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-[var(--admin-primary)]"
                        checked={allPageSelected}
                        disabled={items.length === 0}
                        onChange={toggleSelectAll}
                        aria-label="Select all non-respondents on this page"
                      />
                    </th>
                    <th className="px-4 py-3">Learner</th>
                    <th className="px-4 py-3">Batch</th>
                    <th className="px-4 py-3">Presence</th>
                    <th className="px-4 py-3 text-right">Watch time</th>
                    <th className="px-4 py-3 text-right">Polls answered</th>
                    <th className="px-4 py-3 text-right">Last response</th>
                  </tr>
                </thead>
                <tbody>
                  {loading && items.length === 0 ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={index} className="h-11 border-b border-[var(--admin-border)]">
                        <td className="px-3 py-3">
                          <Shimmer className="h-4 w-4" />
                        </td>
                        <td className="px-4 py-3" colSpan={6}>
                          <Shimmer className="h-4 w-48" />
                        </td>
                      </tr>
                    ))
                  ) : items.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-[var(--admin-on-surface-variant)]"
                      >
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    items.map((row) => {
                      const selected = selectedIds.includes(row.membershipId);
                      const isPresent = row.presence === "present";
                      return (
                        <tr
                          key={row.membershipId}
                          className={[
                            "h-11 border-b border-[var(--admin-border)] last:border-b-0",
                            selected
                              ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                              : "hover:bg-[var(--admin-surface-high)]",
                          ].join(" ")}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--admin-primary)]"
                              checked={selected}
                              onChange={() => {
                                toggleSelectRow(row.membershipId);
                              }}
                              aria-label={`Select ${row.learnerName ?? row.email ?? "learner"}`}
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                                {learnerInitials(row.learnerName, row.email)}
                              </span>
                              <div className="min-w-0">
                                <p className="truncate font-medium text-[var(--admin-on-surface)]">
                                  {row.learnerName ?? "-"}
                                </p>
                                {row.email ? (
                                  <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                                    {row.email}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            {row.batchName ? (
                              <span className="inline-flex max-w-[180px] truncate rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 text-xs text-[var(--admin-on-surface)]">
                                {row.batchName}
                              </span>
                            ) : (
                              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                                -
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isPresent ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-success)]">
                                <Check className="h-3 w-3" aria-hidden="true" />
                                Present
                              </span>
                            ) : (
                              <span className="inline-flex rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                Absent
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface)]">
                            {formatWatchSeconds(row.watchSeconds)}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface)]">
                            {row.pollsAnswered.toLocaleString()}
                          </td>
                          <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {formatDateTime(row.lastResponseAt)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
              <p>
                {totalCount === 0
                  ? emptyMessage
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
          </section>
        </>
      ) : null}

      <MessageNonRespondentsDrawer
        open={messageOpen}
        pollTitle={summary?.pollTitle ?? ""}
        pollIsOpen={Boolean(summary?.pollIsOpen)}
        sendCount={sendCount}
        presentNonRespondentCount={summary?.presentNonRespondentCount ?? 0}
        excludeAbsent={excludeAbsent}
        onExcludeAbsentChange={setExcludeAbsent}
        subject={messageSubject}
        onSubjectChange={setMessageSubject}
        body={messageBody}
        onBodyChange={setMessageBody}
        channelEmail={channelEmail}
        onChannelEmailChange={setChannelEmail}
        channelInApp={channelInApp}
        onChannelInAppChange={setChannelInApp}
        onClose={() => {
          setMessageOpen(false);
        }}
        onTestSend={() => {
          setNotice("Test send is not available yet.");
        }}
        onSend={() => {
          setMessageOpen(false);
          setNotice(
            "Messaging from poll reports is not available yet. Export the non-respondent list to follow up outside the report.",
          );
        }}
      />
    </div>
  );
}
