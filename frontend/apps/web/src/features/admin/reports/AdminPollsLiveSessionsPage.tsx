"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, RefreshCw, Search, Video } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import { fetchLiveSessionsWithPolls, type LiveSessionPollListItem } from "./admin-polls-roster-api";

const secondaryButtonClassName =
  "inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] transition-all hover:bg-[var(--admin-surface-high)] active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30 disabled:cursor-not-allowed disabled:opacity-50";

const fieldClassName =
  "h-9 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] placeholder:text-[var(--admin-on-surface-variant)] focus-visible:border-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "-";
  return `${value.toFixed(value % 1 === 0 ? 0 : 1)}%`;
}

function formatWhen(iso: string | null): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function titleCase(value: string): string {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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

export function AdminPollsLiveSessionsPage() {
  const router = useRouter();
  const [items, setItems] = useState<LiveSessionPollListItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [q, setQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchLiveSessionsWithPolls({
        q: q || undefined,
        page,
        limit: 25,
      });
      setItems(response.data.items);
      setTotalPages(response.data.pageInfo.totalPages);
      setTotalCount(response.data.pageInfo.totalCount);
    } catch (err) {
      setItems([]);
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Couldn't load live sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    void load();
  }, [load]);

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
        <span className="font-medium text-[var(--admin-on-surface)]">Live sessions</span>
      </nav>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Live sessions
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Sessions where polls were run. Open a session for poll analytics, timeline, and the
            cross-poll matrix.
          </p>
        </div>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="Polls module">
          {(
            [
              ["polls", "Polls", "/admin/reports/polls"],
              ["live", "Live Sessions", "/admin/reports/polls/live-sessions"],
              ["compare", "Compare", "/admin/reports/polls/compare"],
              ["exports", "Exports", "/admin/reports/polls/exports"],
            ] as const
          ).map(([value, label, href]) => (
            <Link
              key={value}
              href={href}
              role="tab"
              aria-selected={value === "live"}
              className={[
                "inline-flex h-10 items-center whitespace-nowrap px-6 text-sm font-semibold transition-colors",
                value === "live"
                  ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                  : "border-b-2 border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
              ].join(" ")}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            className={`${fieldClassName} w-full pl-9`}
            placeholder="Search session title or host…"
            value={draftQ}
            onChange={(event) => {
              setDraftQ(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                setPage(1);
                setQ(draftQ.trim());
              }
            }}
          />
        </div>
        <button
          type="button"
          className={secondaryButtonClassName}
          onClick={() => {
            setPage(1);
            setQ(draftQ.trim());
          }}
        >
          Search
        </button>
        <button
          type="button"
          className={ghostButtonClassName}
          disabled={loading}
          onClick={() => void load()}
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      {error ? (
        <div
          className="flex flex-col gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
            <p className="text-sm text-[var(--admin-danger)]">{error}</p>
          </div>
          <button type="button" className={secondaryButtonClassName} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      <section className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        {loading ? (
          <div className="space-y-0" aria-busy="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex h-14 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-b-0"
              >
                <Shimmer className="h-4 w-1/3" />
                <Shimmer className="h-4 w-16" />
                <Shimmer className="h-4 w-20" />
                <Shimmer className="ml-auto h-4 w-24" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
              <Video
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.25}
                aria-hidden="true"
              />
            </div>
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              No live sessions with polls yet
            </h2>
            <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Launch a poll during a live event to see it here. Attendance-only sessions stay under
              Live Class Attendance.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Link href="/admin/reports/polls" className={secondaryButtonClassName}>
                Back to polls
              </Link>
              <Link href="/admin/reports/live-class-attendance" className={ghostButtonClassName}>
                Live class attendance
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  <th className="px-4 py-3">Session</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3 text-right">Attendees</th>
                  <th className="px-4 py-3 text-right">Polls</th>
                  <th className="px-4 py-3 text-right">Responses</th>
                  <th className="px-4 py-3 text-right">Avg participation</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer border-b border-[var(--admin-border)] transition-colors last:border-b-0 hover:bg-[var(--admin-surface-high)]"
                    onClick={() => {
                      router.push(`/admin/reports/polls/live-sessions/${item.id}`);
                    }}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[var(--admin-primary)]">{item.title}</div>
                      <div className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                        {[item.courseTitle, item.batchName, item.hostLabel]
                          .filter(Boolean)
                          .join(" · ") || "No module / cohort linked"}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--admin-on-surface)]">
                      {formatWhen(item.startedAt ?? item.scheduledAt)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--admin-on-surface)]">
                      {item.attendanceCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--admin-on-surface)]">
                      {item.pollCount}
                      {item.quizPollCount > 0 ? (
                        <span className="ml-1 text-[var(--admin-on-surface-variant)]">
                          ({item.quizPollCount} quiz)
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--admin-on-surface)]">
                      {item.totalResponses.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-[var(--admin-on-surface)]">
                      {formatPct(item.avgParticipationPct)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-md border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {titleCase(item.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && items.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
            <span>
              Showing page {page}
              {totalPages > 0 ? ` of ${String(totalPages)}` : ""} · {totalCount.toLocaleString()}{" "}
              sessions
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={page <= 1}
                onClick={() => {
                  setPage((value) => Math.max(1, value - 1));
                }}
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                Previous
              </button>
              <button
                type="button"
                className={ghostButtonClassName}
                disabled={totalPages === 0 || page >= totalPages}
                onClick={() => {
                  setPage((value) => value + 1);
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        Need attendance check-ins without poll analytics?{" "}
        <Link
          href="/admin/reports/live-class-attendance"
          className="font-medium text-[var(--admin-primary)] hover:underline"
        >
          Open live class attendance
        </Link>
        .
      </p>
    </div>
  );
}
