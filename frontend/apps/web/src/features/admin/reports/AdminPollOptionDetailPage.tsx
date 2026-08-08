"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  EyeOff,
  Info,
  Mail,
  RefreshCw,
  Search,
  Vote,
  X,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportPollReport,
  fetchPollOptionDetail,
  fetchPollRespondents,
  type PollOptionDetail,
  type PollOptionTimingBucket,
  type PollRespondentItem,
} from "./admin-polls-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

const PAGE_SIZE = 25;
const DRAWER_PREVIEW = 10;

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
  return `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%`;
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

function formatRelative(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return formatDateTime(value);
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatSeconds(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  const rounded = Number(value);
  if (rounded % 1 === 0) return `${rounded}s`;
  return `${rounded.toFixed(1)}s`;
}

function learnerInitials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function withoutEmDash(value: string): string {
  return value.replace(/\u2014|\u2013/g, "-");
}

function rankCopy(detail: PollOptionDetail): string {
  const base = `Ranked ${detail.rank} of ${detail.optionCount} options`;
  if (detail.votesAheadOfNext == null) return base;
  if (detail.votesAheadOfNext === 0) {
    return `${base} · Tied with the next option`;
  }
  return `${base} · ${detail.votesAheadOfNext.toLocaleString()} vote${
    detail.votesAheadOfNext === 1 ? "" : "s"
  } ahead of the next option`;
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ClientApiError) return error.message;
  if (error instanceof Error) return error.message;
  return fallback;
}

function DetailLoadingSkeleton({ compact }: { compact?: boolean }) {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-live="polite">
      <Shimmer className="h-16 w-full" />
      <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 md:grid-cols-4"}`}>
        {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
          <Shimmer key={index} className="h-20" />
        ))}
      </div>
      <Shimmer className="h-40 w-full" />
      <Shimmer className="h-56 w-full" />
    </div>
  );
}

function ErrorDetailPanel({
  message,
  onRetry,
  title = "Couldn't load option report.",
}: {
  message: string;
  onRetry: () => void;
  title?: string;
}) {
  return (
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
          <p className="text-sm font-semibold text-[var(--admin-danger)]">{title}</p>
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
  );
}

function EmptyVotesPanel({ compact }: { compact?: boolean }) {
  return (
    <div
      className={[
        "flex flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 text-center",
        compact ? "py-12" : "min-h-[280px] py-16",
      ].join(" ")}
    >
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
        <Vote
          className="h-7 w-7 text-[var(--admin-outline)]"
          aria-hidden="true"
          strokeWidth={1.5}
        />
      </div>
      <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
        No learner chose this option
      </h3>
      <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
        Respondent detail and audience segments will appear here once someone selects this answer.
      </p>
    </div>
  );
}

function AnonymousPanel({ compact }: { compact?: boolean }) {
  return (
    <div
      className={[
        "flex flex-col items-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 text-center",
        compact ? "py-10" : "py-16",
      ].join(" ")}
    >
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
        Voter identity is not recorded for this poll. Option tallies, audience segments, and timing
        above remain available.
      </p>
    </div>
  );
}

function SummaryBand({ detail }: { detail: PollOptionDetail }) {
  const option = detail.option;
  return (
    <div className="space-y-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
            Option selection
          </p>
          <p className="mt-1 font-mono text-[28px] font-semibold leading-none text-[var(--admin-on-surface)]">
            {option.count.toLocaleString()}
            <span className="ml-2 text-sm font-medium text-[var(--admin-on-surface-variant)]">
              of {detail.totalResponses.toLocaleString()} total
            </span>
          </p>
        </div>
        <p className="font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
          {formatPct(option.percent)}
        </p>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
        <div
          className={[
            "h-full rounded-full",
            detail.quizMode && option.isCorrect
              ? "bg-[var(--admin-success)]"
              : "bg-[var(--admin-primary)]",
          ].join(" ")}
          style={{ width: `${Math.max(0, Math.min(100, option.percent))}%` }}
        />
      </div>
      <p className="flex items-start gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{rankCopy(detail)}</span>
      </p>
    </div>
  );
}

function AudienceSegments({
  detail,
  compact,
}: {
  detail: PollOptionDetail;
  compact?: boolean;
}) {
  const segments = detail.segments ?? [];
  return (
    <section>
      <h3 className="mb-3 text-sm font-semibold text-[var(--admin-on-surface)]">
        Audience segments
      </h3>
      {segments.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-6 text-center">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            No cohort batch memberships were linked to respondents for this option.
          </p>
        </div>
      ) : (
        <div className={`grid gap-3 ${compact ? "grid-cols-2" : "grid-cols-2 lg:grid-cols-4"}`}>
          {segments.map((segment) => (
            <div
              key={segment.key}
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-3"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-[var(--admin-on-surface)] line-clamp-2">
                  {segment.label}
                </p>
                <span className="shrink-0 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  {segment.count.toLocaleString()}
                </span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className="h-full rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_70%,var(--admin-surface-high))]"
                  style={{ width: `${Math.max(0, Math.min(100, segment.percent))}%` }}
                />
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatPct(segment.percent)} of option votes
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function VelocityChart({
  buckets,
  bucketSeconds,
  timingInsight,
}: {
  buckets: PollOptionTimingBucket[];
  bucketSeconds: number;
  timingInsight: string | null;
}) {
  const maxCount = Math.max(
    1,
    ...buckets.map((bucket) => Math.max(bucket.optionCount, bucket.overallCount)),
  );

  return (
    <section className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
          Response velocity
        </h3>
        <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
          This option versus overall poll timing ({formatSeconds(bucketSeconds)} buckets)
        </p>
      </div>
      <div className="space-y-3 p-4">
        {buckets.length === 0 ? (
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            No timing data recorded for this option.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-4 text-[11px] text-[var(--admin-on-surface-variant)]">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[var(--admin-primary)]" />
                This option
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_45%,var(--admin-surface-high))]" />
                Poll overall
              </span>
            </div>
            <div className="space-y-2.5">
              {buckets.map((bucket) => {
                const optionPct = (bucket.optionCount / maxCount) * 100;
                const overallPct = (bucket.overallCount / maxCount) * 100;
                return (
                  <div key={bucket.offsetSeconds} className="grid grid-cols-[52px_1fr] gap-3">
                    <span className="pt-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                      {formatSeconds(bucket.offsetSeconds)}
                    </span>
                    <div className="space-y-1">
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className="h-full rounded-full bg-[var(--admin-primary)]"
                          style={{ width: `${optionPct}%` }}
                          title={`${bucket.optionCount} for this option`}
                        />
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className="h-full rounded-full bg-[color-mix(in_srgb,var(--admin-on-surface-variant)_45%,var(--admin-surface-high))]"
                          style={{ width: `${overallPct}%` }}
                          title={`${bucket.overallCount} overall`}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
        {timingInsight ? (
          <p className="border-t border-[var(--admin-border)] pt-3 text-xs text-[var(--admin-on-surface-variant)]">
            {withoutEmDash(timingInsight)}
          </p>
        ) : null}
      </div>
    </section>
  );
}

function PerformanceBars({ detail }: { detail: PollOptionDetail }) {
  const rows = useMemo(() => {
    const all = [detail.option, ...(detail.siblings ?? [])];
    return [...all].sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.sortOrder - b.sortOrder;
    });
  }, [detail.option, detail.siblings]);

  return (
    <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[var(--admin-border)] px-4 py-3">
        <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Performance</h3>
        <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
          Sibling option comparison for this poll
        </p>
      </div>
      <div className="divide-y divide-[var(--admin-border)]">
        {rows.map((row) => {
          const isCurrent = row.optionId === detail.option.optionId;
          const barColor =
            detail.quizMode && row.isCorrect
              ? "bg-[var(--admin-success)]"
              : isCurrent
                ? "bg-[var(--admin-primary)]"
                : "bg-[color-mix(in_srgb,var(--admin-primary)_45%,var(--admin-surface-high))]";
          return (
            <div
              key={row.optionId}
              className={[
                "grid grid-cols-[minmax(0,1fr)_minmax(120px,2fr)_auto] items-center gap-3 px-4 py-3",
                isCurrent
                  ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                  : "",
              ].join(" ")}
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p
                    className={[
                      "truncate text-sm",
                      isCurrent
                        ? "font-semibold text-[var(--admin-on-surface)]"
                        : "font-medium text-[var(--admin-on-surface)]",
                    ].join(" ")}
                  >
                    {row.label}
                  </p>
                  {detail.quizMode && row.isCorrect ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--admin-success)]">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Correct
                    </span>
                  ) : null}
                  {isCurrent ? (
                    <span className="rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Current
                    </span>
                  ) : null}
                </div>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                <div
                  className={`h-full rounded-full ${barColor}`}
                  style={{ width: `${Math.max(0, Math.min(100, row.percent))}%` }}
                />
              </div>
              <div className="shrink-0 text-right font-mono text-xs text-[var(--admin-on-surface)]">
                {row.count.toLocaleString()}
                <span className="text-[var(--admin-on-surface-variant)]">
                  {" "}
                  · {row.percent.toFixed(1)}%
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RespondentsTable({
  respondents,
  loading,
  quizMode,
  timeMode,
  emptyLabel,
  selectable,
  selectedIds,
  onToggleRow,
  onToggleAll,
}: {
  respondents: PollRespondentItem[];
  loading: boolean;
  quizMode: boolean;
  timeMode: "relative" | "absolute";
  emptyLabel: string;
  selectable?: boolean;
  selectedIds?: string[];
  onToggleRow?: (membershipId: string) => void;
  onToggleAll?: () => void;
}) {
  const selected = selectedIds ?? [];
  const pageIds = respondents
    .map((row) => row.membershipId)
    .filter((id): id is string => Boolean(id));
  const allSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.includes(id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
          <tr>
            {selectable ? (
              <th className="w-11 px-3 py-3">
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-[var(--admin-primary)]"
                  checked={allSelected}
                  onChange={onToggleAll}
                  aria-label="Select all respondents on this page"
                />
              </th>
            ) : null}
            <th className="px-4 py-3">Learner</th>
            {quizMode ? <th className="px-4 py-3">Status</th> : null}
            <th className="px-4 py-3 text-right">Time</th>
            <th className="px-4 py-3 text-right">Responded</th>
          </tr>
        </thead>
        <tbody>
          {loading && respondents.length === 0 ? (
            Array.from({ length: 5 }).map((_, index) => (
              <tr key={index} className="h-11 border-b border-[var(--admin-border)]">
                <td className="px-4 py-3" colSpan={selectable ? 5 : 4}>
                  <Shimmer className="h-4 w-48" />
                </td>
              </tr>
            ))
          ) : respondents.length === 0 ? (
            <tr>
              <td
                colSpan={selectable ? 5 : 4}
                className="px-4 py-8 text-center text-sm text-[var(--admin-on-surface-variant)]"
              >
                {emptyLabel}
              </td>
            </tr>
          ) : (
            respondents.map((row, index) => {
              const membershipId = row.membershipId;
              const isSelected = membershipId ? selected.includes(membershipId) : false;
              return (
                <tr
                  key={`${membershipId ?? "row"}-${row.respondedAt}-${index}`}
                  className={[
                    "h-11 border-b border-[var(--admin-border)] last:border-b-0",
                    isSelected
                      ? "bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "hover:bg-[var(--admin-surface-high)]",
                  ].join(" ")}
                >
                  {selectable ? (
                    <td className="px-3 py-3">
                      {membershipId ? (
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={isSelected}
                          onChange={() => onToggleRow?.(membershipId)}
                          aria-label={`Select ${row.learnerName ?? row.email ?? "respondent"}`}
                        />
                      ) : null}
                    </td>
                  ) : null}
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
                  {quizMode ? (
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
                  <td className="px-4 py-3 text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                    {timeMode === "relative"
                      ? formatRelative(row.respondedAt)
                      : formatDateTime(row.respondedAt)}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function MessageNoticeDialog({
  open,
  onClose,
  count,
}: {
  open: boolean;
  onClose: () => void;
  count: number;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="option-message-notice-title"
    >
      <div className="w-full max-w-md rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl">
        <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-5 py-4">
          <h2
            id="option-message-notice-title"
            className="text-base font-semibold text-[var(--admin-on-surface)]"
          >
            Messaging unavailable
          </h2>
          <button
            type="button"
            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
            aria-label="Close notice"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="space-y-3 px-5 py-4">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Messaging from poll option reports is not available yet
            {count > 0
              ? ` (${count.toLocaleString()} respondent${count === 1 ? "" : "s"} would be targeted).`
              : "."}{" "}
            Export the respondent list to follow up outside the report.
          </p>
        </div>
        <div className="flex justify-end border-t border-[var(--admin-border)] px-5 py-4">
          <button type="button" className={primaryButtonClassName} onClick={onClose}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

type OptionActions = {
  busy: boolean;
  copied: boolean;
  onCopy: () => void;
  onExport: () => void;
  onMessage: () => void;
};

function OptionActionButtons({
  actions,
  layout,
}: {
  actions: OptionActions;
  layout: "page" | "drawer";
}) {
  const { busy, copied, onCopy, onExport, onMessage } = actions;
  if (layout === "drawer") {
    return (
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <button type="button" className={secondaryButtonClassName} onClick={onCopy}>
            <Copy className="h-4 w-4" aria-hidden="true" />
            {copied ? "Copied" : "Copy option ID"}
          </button>
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={onExport}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {busy ? "Exporting..." : "Export this option"}
          </button>
        </div>
        <button type="button" className={primaryButtonClassName} onClick={onMessage}>
          <Mail className="h-4 w-4" aria-hidden="true" />
          Message these respondents
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className={secondaryButtonClassName} onClick={onCopy}>
        <Copy className="h-4 w-4" aria-hidden="true" />
        {copied ? "Copied" : "Copy option ID"}
      </button>
      <button
        type="button"
        className={secondaryButtonClassName}
        disabled={busy}
        onClick={onExport}
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        {busy ? "Exporting..." : "Export this option"}
      </button>
      <button type="button" className={primaryButtonClassName} onClick={onMessage}>
        <Mail className="h-4 w-4" aria-hidden="true" />
        Message these respondents
      </button>
    </div>
  );
}

function useOptionActions(pollId: string, optionId: string) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [messageOpen, setMessageOpen] = useState(false);
  const [messageCount, setMessageCount] = useState(0);

  const onCopy = useCallback(async () => {
    setActionError(null);
    try {
      await navigator.clipboard.writeText(optionId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Unable to copy option ID to the clipboard.");
    }
  }, [optionId]);

  const onExport = useCallback(async () => {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportPollReport({
        pollId,
        optionId,
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
      setActionError(errorMessage(exportError, "Unable to export option report."));
    } finally {
      setBusy(false);
    }
  }, [optionId, pollId]);

  const onMessage = useCallback((count = 0) => {
    setMessageCount(count);
    setMessageOpen(true);
  }, []);

  return {
    busy,
    copied,
    actionError,
    setActionError,
    messageOpen,
    setMessageOpen,
    messageCount,
    onCopy,
    onExport,
    onMessage,
  };
}

function OptionHeaderMeta({ detail }: { detail: PollOptionDetail }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {detail.quizMode ? (
        <span className="inline-flex rounded-md border border-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-primary)]">
          Quiz mode
        </span>
      ) : null}
      <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
        {detail.anonymousVote ? "Anonymous" : "Identified"}
      </span>
      <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
        {detail.isOpen
          ? `Opened ${formatDateTime(detail.openedAt)}`
          : detail.closedAt
            ? `Closed ${formatDateTime(detail.closedAt)}`
            : `Opened ${formatDateTime(detail.openedAt)}`}
      </span>
      {detail.medianResponseSeconds != null ? (
        <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
          Median {formatSeconds(detail.medianResponseSeconds)}
          {detail.overallMedianResponseSeconds != null
            ? ` versus ${formatSeconds(detail.overallMedianResponseSeconds)} overall`
            : ""}
        </span>
      ) : null}
    </div>
  );
}

export function AdminPollOptionDetailDrawer({
  pollId,
  optionId,
  onClose,
}: {
  pollId: string;
  optionId: string | null;
  onClose: () => void;
}) {
  const open = Boolean(optionId);
  const titleId = useId();
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [respondentsLoading, setRespondentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PollOptionDetail | null>(null);
  const [respondents, setRespondents] = useState<PollRespondentItem[]>([]);
  const [respondentTotalCount, setRespondentTotalCount] = useState(0);

  const actions = useOptionActions(pollId, optionId ?? "");

  const isAnonymous = Boolean(detail?.anonymousVote || detail?.respondentsHidden);
  const hasVotes = (detail?.option.count ?? 0) > 0;

  const loadDetail = useCallback(async () => {
    if (!optionId) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPollOptionDetail(pollId, optionId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(errorMessage(loadError, "Unable to load option report."));
    } finally {
      setLoading(false);
    }
  }, [optionId, pollId]);

  const loadRespondents = useCallback(async () => {
    if (!optionId || !detail || detail.respondentsHidden || detail.anonymousVote) {
      setRespondents([]);
      setRespondentTotalCount(0);
      return;
    }
    setRespondentsLoading(true);
    try {
      const response = await fetchPollRespondents(pollId, {
        optionId,
        sortBy: "responded_at",
        sortDir: "desc",
        page: 1,
      });
      setRespondents(response.data.items.slice(0, DRAWER_PREVIEW));
      setRespondentTotalCount(response.data.pageInfo.totalCount);
    } catch (loadError) {
      setRespondents([]);
      setRespondentTotalCount(0);
      setError(errorMessage(loadError, "Unable to load respondents."));
    } finally {
      setRespondentsLoading(false);
    }
  }, [detail, optionId, pollId]);

  useEffect(() => {
    if (!open || !optionId) {
      setDetail(null);
      setRespondents([]);
      setRespondentTotalCount(0);
      setError(null);
      return;
    }
    void loadDetail();
  }, [loadDetail, open, optionId]);

  useEffect(() => {
    if (!open || !detail || loading) return;
    void loadRespondents();
  }, [detail, loadRespondents, loading, open]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !optionId) return null;

  const previewRespondents = respondents.slice(0, DRAWER_PREVIEW);

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)]">
        <button
          type="button"
          className="absolute inset-0 cursor-default"
          aria-label="Close option detail overlay"
          onClick={onClose}
        />
        <aside
          className="relative z-10 flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
        >
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2
                  id={titleId}
                  className="text-base font-semibold text-[var(--admin-on-surface)]"
                >
                  {detail?.option.label ?? "Option detail"}
                </h2>
                {detail?.quizMode && detail.option.isCorrect ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--admin-success)]">
                    <Check className="h-3 w-3" aria-hidden="true" />
                    Correct
                  </span>
                ) : null}
              </div>
              <p className="mt-1 truncate text-sm text-[var(--admin-on-surface-variant)]">
                {detail?.pollTitle ?? "Poll"}
              </p>
            </div>
            <button
              type="button"
              className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30"
              aria-label="Close drawer"
              onClick={onClose}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>

          <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            {actions.actionError ? (
              <ErrorDetailPanel
                message={actions.actionError}
                title="Action failed"
                onRetry={() => actions.setActionError(null)}
              />
            ) : null}

            {loading && !detail && !error ? <DetailLoadingSkeleton compact /> : null}

            {error && !detail ? (
              <ErrorDetailPanel message={error} onRetry={() => void loadDetail()} />
            ) : null}

            {detail ? (
              <>
                {error ? (
                  <ErrorDetailPanel
                    message={error}
                    onRetry={() => {
                      void loadDetail();
                      void loadRespondents();
                    }}
                  />
                ) : null}

                <SummaryBand detail={detail} />

                {!hasVotes ? (
                  <EmptyVotesPanel compact />
                ) : (
                  <>
                    <AudienceSegments detail={detail} compact />
                    <VelocityChart
                      buckets={detail.timing.buckets}
                      bucketSeconds={detail.timing.bucketSeconds}
                      timingInsight={detail.timingInsight}
                    />

                    <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                      <div className="flex items-end justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
                        <div>
                          <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                            Respondents
                          </h3>
                          <p className="text-xs text-[var(--admin-on-surface-variant)]">
                            {isAnonymous
                              ? "Identity hidden for anonymous polls"
                              : `${respondentTotalCount.toLocaleString()} response${
                                  respondentTotalCount === 1 ? "" : "s"
                                }`}
                          </p>
                        </div>
                      </div>

                      {isAnonymous ? (
                        <div className="p-4">
                          <AnonymousPanel compact />
                        </div>
                      ) : (
                        <>
                          <RespondentsTable
                            respondents={previewRespondents}
                            loading={respondentsLoading}
                            quizMode={detail.quizMode}
                            timeMode="relative"
                            emptyLabel="No respondents for this option."
                          />
                          {respondentTotalCount > 0 ? (
                            <div className="border-t border-[var(--admin-border)] px-4 py-3">
                              <button
                                type="button"
                                className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
                                onClick={() => {
                                  router.push(
                                    `/admin/reports/polls/${pollId}/options/${optionId}`,
                                  );
                                  onClose();
                                }}
                              >
                                View all {respondentTotalCount.toLocaleString()} respondents
                              </button>
                            </div>
                          ) : null}
                        </>
                      )}
                    </section>
                  </>
                )}
              </>
            ) : null}
          </div>

          <div className="sticky bottom-0 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-5 py-4">
            <OptionActionButtons
              layout="drawer"
              actions={{
                busy: actions.busy,
                copied: actions.copied,
                onCopy: () => void actions.onCopy(),
                onExport: () => void actions.onExport(),
                onMessage: () => actions.onMessage(respondentTotalCount),
              }}
            />
          </div>
        </aside>
      </div>

      <MessageNoticeDialog
        open={actions.messageOpen}
        onClose={() => actions.setMessageOpen(false)}
        count={actions.messageCount}
      />
    </>
  );
}

export function AdminPollOptionDetailPage({
  pollId,
  optionId,
}: {
  pollId: string;
  optionId: string;
}) {
  const searchId = useId();
  const [loading, setLoading] = useState(true);
  const [respondentsLoading, setRespondentsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detail, setDetail] = useState<PollOptionDetail | null>(null);
  const [respondents, setRespondents] = useState<PollRespondentItem[]>([]);
  const [respondentPage, setRespondentPage] = useState(1);
  const [respondentTotalPages, setRespondentTotalPages] = useState(0);
  const [respondentTotalCount, setRespondentTotalCount] = useState(0);

  const [learnerName, setLearnerName] = useState("");
  const [draftLearnerName, setDraftLearnerName] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const actions = useOptionActions(pollId, optionId);

  const isAnonymous = Boolean(detail?.anonymousVote || detail?.respondentsHidden);
  const hasVotes = (detail?.option.count ?? 0) > 0;

  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPollOptionDetail(pollId, optionId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setError(errorMessage(loadError, "Unable to load option report."));
    } finally {
      setLoading(false);
    }
  }, [optionId, pollId]);

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
        optionId,
        sortBy: "responded_at",
        sortDir: "desc",
        page: respondentPage,
      });
      setRespondents(response.data.items);
      setRespondentTotalCount(response.data.pageInfo.totalCount);
      setRespondentTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setRespondents([]);
      setRespondentTotalCount(0);
      setRespondentTotalPages(0);
      setError(errorMessage(loadError, "Unable to load respondents."));
    } finally {
      setRespondentsLoading(false);
    }
  }, [detail, learnerName, optionId, pollId, respondentPage]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  useEffect(() => {
    if (!detail || loading) return;
    void loadRespondents();
  }, [detail, loadRespondents, loading]);

  function applySearch() {
    setLearnerName(draftLearnerName.trim());
    setRespondentPage(1);
    setSelectedIds([]);
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

  function toggleSelectRow(membershipId: string) {
    setSelectedIds((current) =>
      current.includes(membershipId)
        ? current.filter((id) => id !== membershipId)
        : [...current, membershipId],
    );
  }

  const rangeStart =
    respondentTotalCount === 0 ? 0 : (respondentPage - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(respondentPage * PAGE_SIZE, respondentTotalCount);

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
        <Link
          href={`/admin/reports/polls/${pollId}`}
          className="max-w-[180px] truncate hover:text-[var(--admin-primary)]"
        >
          {detail?.pollTitle ?? "Poll"}
        </Link>
        <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="max-w-[220px] truncate font-medium text-[var(--admin-on-surface)]">
          {detail?.option.label ?? "Option"}
        </span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <Link
            href={`/admin/reports/polls/${pollId}`}
            className={`${ghostButtonClassName} mb-3 inline-flex`}
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to poll
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {detail?.option.label ?? "Option report"}
            </h1>
            {detail?.quizMode && detail.option.isCorrect ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--admin-success)_35%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-success)]">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                Correct
              </span>
            ) : null}
          </div>
          {detail?.pollDescription ? (
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {detail.pollDescription}
            </p>
          ) : (
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              {detail?.pollTitle ?? "Poll option report"}
            </p>
          )}
          {detail ? <OptionHeaderMeta detail={detail} /> : null}
        </div>

        <OptionActionButtons
          layout="page"
          actions={{
            busy: actions.busy,
            copied: actions.copied,
            onCopy: () => void actions.onCopy(),
            onExport: () => void actions.onExport(),
            onMessage: () =>
              actions.onMessage(
                selectedIds.length > 0 ? selectedIds.length : respondentTotalCount,
              ),
          }}
        />
      </div>

      {(error || actions.actionError) && detail ? (
        <ErrorDetailPanel
          message={actions.actionError ?? error ?? "Something went wrong."}
          onRetry={() => {
            actions.setActionError(null);
            void loadDetail();
            void loadRespondents();
          }}
        />
      ) : null}

      {detail ? (
        <>
          <SummaryBand detail={detail} />

          {!hasVotes ? (
            <EmptyVotesPanel />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-12">
                <div className="space-y-4 lg:col-span-7">
                  <AudienceSegments detail={detail} />
                  <VelocityChart
                    buckets={detail.timing.buckets}
                    bucketSeconds={detail.timing.bucketSeconds}
                    timingInsight={detail.timingInsight}
                  />
                </div>
                <div className="lg:col-span-5">
                  <PerformanceBars detail={detail} />
                </div>
              </div>

              <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
                  <div>
                    <h2 className="text-sm font-semibold text-[var(--admin-on-surface)]">
                      Respondents
                    </h2>
                    <p className="text-xs text-[var(--admin-on-surface-variant)]">
                      {isAnonymous
                        ? "Individual voter rows are not available for anonymous polls."
                        : `${respondentTotalCount.toLocaleString()} response${
                            respondentTotalCount === 1 ? "" : "s"
                          } for this option`}
                    </p>
                  </div>
                </div>

                {isAnonymous ? (
                  <div className="p-4">
                    <AnonymousPanel />
                  </div>
                ) : (
                  <>
                    <div className="border-b border-[var(--admin-border)] p-4">
                      <div className="flex flex-wrap items-end gap-3">
                        <label className="relative grid min-w-[220px] flex-1 gap-1 text-xs text-[var(--admin-on-surface-variant)]">
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
                            onChange={(event) => setDraftLearnerName(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") applySearch();
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          className={secondaryButtonClassName}
                          onClick={applySearch}
                        >
                          Search
                        </button>
                        {learnerName ? (
                          <button
                            type="button"
                            className={ghostButtonClassName}
                            onClick={() => {
                              setDraftLearnerName("");
                              setLearnerName("");
                              setRespondentPage(1);
                              setSelectedIds([]);
                            }}
                          >
                            Clear
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {selectedIds.length > 0 ? (
                      <div className="mx-4 mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
                        <p className="text-sm text-[var(--admin-on-surface)]">
                          <span className="font-mono font-medium">{selectedIds.length}</span>{" "}
                          respondent{selectedIds.length === 1 ? "" : "s"} selected
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className={secondaryButtonClassName}
                            onClick={() => actions.onMessage(selectedIds.length)}
                          >
                            <Mail className="h-4 w-4" aria-hidden="true" />
                            Message
                          </button>
                          <button
                            type="button"
                            className={ghostButtonClassName}
                            onClick={() => setSelectedIds([])}
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                    ) : null}

                    <RespondentsTable
                      respondents={respondents}
                      loading={respondentsLoading}
                      quizMode={detail.quizMode}
                      timeMode="absolute"
                      emptyLabel={
                        learnerName
                          ? "No respondents match this search."
                          : "No respondents for this option."
                      }
                      selectable
                      selectedIds={selectedIds}
                      onToggleRow={toggleSelectRow}
                      onToggleAll={toggleSelectAll}
                    />

                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                      <p>
                        {respondentTotalCount === 0
                          ? "No results"
                          : `Showing ${rangeStart}-${rangeEnd} of ${respondentTotalCount.toLocaleString()}`}
                      </p>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          disabled={respondentPage <= 1 || respondentsLoading}
                          onClick={() =>
                            setRespondentPage((current) => Math.max(1, current - 1))
                          }
                          aria-label="Previous page"
                        >
                          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <span className="font-mono">
                          {respondentPage}
                          {respondentTotalPages > 0 ? ` / ${respondentTotalPages}` : ""}
                        </span>
                        <button
                          type="button"
                          className={ghostButtonClassName}
                          disabled={
                            respondentPage >= respondentTotalPages ||
                            respondentsLoading ||
                            respondentTotalPages === 0
                          }
                          onClick={() => setRespondentPage((current) => current + 1)}
                          aria-label="Next page"
                        >
                          <ChevronRight className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </section>
            </>
          )}
        </>
      ) : null}

      <MessageNoticeDialog
        open={actions.messageOpen}
        onClose={() => actions.setMessageOpen(false)}
        count={actions.messageCount}
      />
    </div>
  );
}
