"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Group,
  History,
  Mail,
  MessageSquare,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Users,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchCohortGroups,
  fetchCohortMessages,
  retryCohortMessage,
  type CohortGroupItem,
  type CohortMessageItem,
} from "./admin-progress-score-roster-api";
import { CohortActionsDrawer, type CohortDrawerMode } from "./CohortActionsDrawer";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";

function formatCount(n: number) {
  return new Intl.NumberFormat().format(n);
}

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-sm bg-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] ${className ?? ""}`}
    />
  );
}

function CohortsSkeleton() {
  return (
    <div
      className="grid grid-cols-1 gap-6 lg:grid-cols-12"
      aria-busy="true"
      aria-label="Loading cohorts"
    >
      <div className="flex flex-col gap-4 lg:col-span-7">
        <div className="flex justify-between border-b border-[var(--admin-border)] pb-4">
          <div className="w-1/2 space-y-3">
            <Shimmer className="h-10 w-3/4" />
            <Shimmer className="h-4 w-1/2" />
          </div>
          <Shimmer className="h-12 w-32" />
        </div>
        <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <Shimmer className="mb-6 h-6 w-48" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="grid grid-cols-4 gap-4 border-b border-[var(--admin-border)] py-4 last:border-0"
            >
              <Shimmer className="h-5 w-32" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-5 w-16 rounded-full" />
              <Shimmer className="h-8 w-8 justify-self-end" />
            </div>
          ))}
        </div>
      </div>
      <div className="lg:col-span-5">
        <div className="min-h-[480px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-6">
            <Shimmer className="h-4 w-36" />
          </div>
          <div className="space-y-4 p-6">
            <Shimmer className="h-28 w-full" />
            <Shimmer className="h-28 w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}

function groupHref(group: CohortGroupItem) {
  if (group.sourceKind === "scores" && group.assessmentId) {
    return `/admin/reports/progress-score/scores/quizzes/${group.assessmentId}`;
  }
  if (group.productType && group.productId) {
    return `/admin/reports/progress-score/progress/${group.productType}/${group.productId}`;
  }
  return "/admin/batches";
}

function statusPill(status: CohortMessageItem["status"]) {
  if (status === "partially_failed") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status === "failed") {
    return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_16%,transparent)] text-[var(--admin-danger)]";
  }
  return "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface)]";
}

export function AdminProgressScoreCohortsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CohortGroupItem[]>([]);
  const [messages, setMessages] = useState<CohortMessageItem[]>([]);
  const [groupsPage, setGroupsPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsHasPrev, setGroupsHasPrev] = useState(false);
  const [groupsHasNext, setGroupsHasNext] = useState(false);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<CohortDrawerMode>("group");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, messagesRes] = await Promise.all([
        fetchCohortGroups({ ...(q ? { q } : {}), page: groupsPage, limit: 10 }),
        fetchCohortMessages({ page: messagesPage, limit: 10 }),
      ]);
      setGroups(groupsRes.data.items);
      setGroupsTotal(groupsRes.data.pageInfo.totalCount);
      setGroupsHasPrev(groupsRes.data.pageInfo.hasPreviousPage);
      setGroupsHasNext(groupsRes.data.pageInfo.hasNextPage);
      setMessages(messagesRes.data.items);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to load cohorts.",
      );
    } finally {
      setLoading(false);
    }
  }, [groupsPage, messagesPage, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleRetry(campaignId: string) {
    setRetryBusy(campaignId);
    try {
      await retryCohortMessage(campaignId);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Retry failed.",
      );
    } finally {
      setRetryBusy(null);
    }
  }

  function openDrawer(mode: CohortDrawerMode) {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-16">
      <ProgressScoreReportTabs active="cohorts" />

      <section className="flex flex-col items-start justify-between gap-6 border-b border-[var(--admin-border)] pb-8 lg:flex-row lg:items-end">
        <div className="max-w-2xl">
          <nav
            className="mb-4 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]"
            aria-label="Breadcrumb"
          >
            <Link href="/admin/reports" className="hover:text-[var(--admin-on-surface)]">
              Reports
            </Link>
            <span aria-hidden="true">/</span>
            <Link
              href="/admin/reports/progress-score"
              className="hover:text-[var(--admin-on-surface)]"
            >
              Progress Score
            </Link>
            <span aria-hidden="true">/</span>
            <span className="text-[var(--admin-on-surface)]">Cohorts</span>
          </nav>
          <h1 className="mb-2 text-3xl font-semibold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-4xl">
            Cohorts
          </h1>
          <p className="text-base text-[var(--admin-on-surface-variant)]">
            Turn a filtered progress or score roster into a saved group, or message the learners in
            it.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-sm border-2 border-[var(--admin-on-surface)] px-6 uppercase tracking-wider`}
            onClick={() => {
              openDrawer("group");
            }}
          >
            <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
            New group
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} h-11 px-6 uppercase tracking-wider`}
            onClick={() => {
              openDrawer("message");
            }}
          >
            <Send className="h-4 w-4 shrink-0" aria-hidden="true" />
            New message
          </button>
        </div>
      </section>

      {error && !loading ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-4">
          <p className="text-sm text-[var(--admin-danger)]">{error}</p>
          <button type="button" className={ghostButtonClassName} onClick={() => void load()}>
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <CohortsSkeleton />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 lg:col-span-7">
            <div className="mb-6 flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4 sm:flex-row sm:items-center sm:justify-between">
              <h2 className="text-xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
                Groups created from reports
              </h2>
              <form
                className="relative"
                onSubmit={(e) => {
                  e.preventDefault();
                  setGroupsPage(1);
                  setQ(qDraft.trim());
                }}
              >
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className="w-full rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] py-2 pl-9 pr-3 font-mono text-xs text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] sm:w-56"
                  placeholder="Search groups…"
                  value={qDraft}
                  onChange={(e) => {
                    setQDraft(e.target.value);
                  }}
                />
              </form>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Group className="mb-4 h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
                <h3 className="mb-2 text-lg font-semibold text-[var(--admin-on-surface)]">
                  No groups yet
                </h3>
                <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                  Create a group from a filtered Progress or Scores roster, or start here with New
                  group.
                </p>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => {
                    openDrawer("group");
                  }}
                >
                  New group
                </button>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead>
                      <tr className="border-b border-[var(--admin-border)] font-mono text-[11px] uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
                        <th className="px-2 pb-3 font-medium">Group name</th>
                        <th className="px-2 pb-3 font-medium">Source</th>
                        <th className="px-2 pb-3 font-medium">Members</th>
                        <th className="px-2 pb-3 font-medium">Sync</th>
                        <th className="px-2 pb-3 font-medium" />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <tr
                          key={group.batchId}
                          className="group border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]"
                        >
                          <td className="px-2 py-3 align-top">
                            <Link
                              href={groupHref(group)}
                              className="font-medium text-[#6366f1] underline-offset-4 hover:underline dark:text-[#818cf8]"
                            >
                              {group.name}
                            </Link>
                            {group.criteriaSummary ? (
                              <div className="mt-1 line-clamp-1 text-xs text-[var(--admin-on-surface-variant)]">
                                {group.criteriaSummary}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-2 py-3 align-top">
                            <div className="flex flex-col items-start gap-1">
                              <span className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--admin-on-surface)]">
                                {group.sourceKind === "progress" ? "Progress" : "Score"}
                              </span>
                              <span className="line-clamp-1 text-xs text-[var(--admin-on-surface-variant)]">
                                {group.assessmentTitle ?? group.productTitle ?? "—"}
                              </span>
                            </div>
                          </td>
                          <td className="px-2 py-3 font-mono text-[var(--admin-on-surface)]">
                            {formatCount(group.memberCount)}
                          </td>
                          <td className="px-2 py-3">
                            <span
                              className={[
                                "inline-flex w-max items-center gap-1 rounded-full border px-2 py-1 font-mono text-[10px] uppercase",
                                group.syncType === "live"
                                  ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                                  : "border-[var(--admin-border)] text-[var(--admin-on-surface-variant)]",
                              ].join(" ")}
                            >
                              <RefreshCw className="h-3 w-3" aria-hidden="true" />
                              {group.syncType === "live" ? "Live" : "Static"}
                            </span>
                          </td>
                          <td className="relative px-2 py-3 text-right">
                            <button
                              type="button"
                              className="p-1 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-on-surface)] group-hover:opacity-100"
                              aria-label={`Actions for ${group.name}`}
                              onClick={() => {
                                setMenuOpenId((id) =>
                                  id === group.batchId ? null : group.batchId,
                                );
                              }}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>
                            {menuOpenId === group.batchId ? (
                              <div className="absolute right-2 z-10 mt-1 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                <Link
                                  href={`/admin/batches`}
                                  className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                  }}
                                >
                                  View members
                                </Link>
                                <Link
                                  href={groupHref(group)}
                                  className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setMenuOpenId(null);
                                  }}
                                >
                                  Open source roster
                                </Link>
                              </div>
                            ) : null}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 flex items-center justify-between font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                  <span>
                    Showing {formatCount(groups.length)} of {formatCount(groupsTotal)} groups
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="rounded-sm border border-[var(--admin-border)] p-1 hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                      disabled={!groupsHasPrev}
                      onClick={() => {
                        setGroupsPage((p) => Math.max(1, p - 1));
                      }}
                      aria-label="Previous page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="rounded-sm border border-[var(--admin-border)] p-1 hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
                      disabled={!groupsHasNext}
                      onClick={() => {
                        setGroupsPage((p) => p + 1);
                      }}
                      aria-label="Next page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col gap-4 lg:col-span-5">
            <h2 className="border-b border-[var(--admin-border)] border-l-4 border-l-[var(--admin-primary)] pb-4 pl-2 text-xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              Message history
            </h2>

            {messages.length === 0 ? (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
                <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <MessageSquare
                    className="h-12 w-12 text-[var(--admin-outline)] opacity-60"
                    strokeWidth={1.25}
                    aria-hidden="true"
                  />
                </div>
                <h3 className="mb-2 text-xl font-bold text-[var(--admin-on-surface)]">
                  No Messages
                </h3>
                <p className="mb-8 max-w-xs text-sm text-[var(--admin-on-surface-variant)]">
                  No messages sent from this report yet. Start a conversation to keep your cohort
                  informed.
                </p>
                <button
                  type="button"
                  className={`${primaryButtonClassName} w-full uppercase tracking-widest sm:w-auto`}
                  onClick={() => {
                    openDrawer("message");
                  }}
                >
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  New Message
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => {
                  const deliveredPct =
                    msg.recipientCount > 0
                      ? Math.round((msg.deliveredCount / msg.recipientCount) * 100)
                      : 0;
                  const failedPct =
                    msg.recipientCount > 0
                      ? Math.round((msg.failedCount / msg.recipientCount) * 100)
                      : 0;
                  return (
                    <article
                      key={msg.campaignId}
                      className={[
                        "relative overflow-hidden rounded-sm border bg-[var(--admin-surface)] p-5 transition-colors",
                        msg.status === "partially_failed" || msg.status === "failed"
                          ? "border-[var(--admin-danger)] hover:border-[var(--admin-warning)]"
                          : "border-[var(--admin-border)] hover:border-[var(--admin-primary)]",
                      ].join(" ")}
                    >
                      <div className="absolute right-0 top-0 p-3">
                        <span
                          className={`rounded-sm border px-2 py-1 font-mono text-[10px] uppercase ${statusPill(msg.status)}`}
                        >
                          {msg.status === "partially_failed"
                            ? "Partially Failed"
                            : msg.status === "failed"
                              ? "Failed"
                              : "Sent"}
                        </span>
                      </div>
                      <h3 className="mb-1 pr-28 text-lg font-bold leading-tight text-[var(--admin-on-surface)]">
                        {msg.subject}
                      </h3>
                      <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
                        {msg.audienceCaption ?? "Cohort message"}
                      </p>
                      <div className="mb-5 flex gap-2">
                        <span className="inline-flex items-center gap-1 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] uppercase text-[var(--admin-on-surface)]">
                          {msg.sourceKind === "progress" ? (
                            <History className="h-3 w-3" aria-hidden="true" />
                          ) : (
                            <Users className="h-3 w-3" aria-hidden="true" />
                          )}
                          {msg.sourceKind === "progress" ? "Progress" : "Score"}
                        </span>
                      </div>
                      <div className="mb-4 grid grid-cols-3 gap-4 border-t border-[var(--admin-border)] pt-4">
                        <div>
                          <div className="font-mono text-lg text-[var(--admin-on-surface)]">
                            {formatCount(msg.deliveredCount)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                            Delivered
                          </div>
                        </div>
                        <div>
                          <div
                            className={[
                              "font-mono text-lg",
                              msg.failedCount > 0
                                ? "text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface)]",
                            ].join(" ")}
                          >
                            {msg.failedCount > 0
                              ? formatCount(msg.failedCount)
                              : formatCount(msg.skippedCount)}
                          </div>
                          <div
                            className={[
                              "text-[10px] uppercase tracking-wider",
                              msg.failedCount > 0
                                ? "text-[var(--admin-warning)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {msg.failedCount > 0 ? "Failed" : "Skipped"}
                          </div>
                        </div>
                        <div>
                          <div className="font-mono text-lg text-[var(--admin-on-surface)]">
                            {msg.openedCount == null ? "—" : formatCount(msg.openedCount)}
                          </div>
                          <div className="text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                            Opened
                          </div>
                        </div>
                      </div>
                      <div className="mb-4 flex h-1 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className="h-full bg-[var(--admin-primary)]"
                          style={{ width: `${String(deliveredPct)}%` }}
                        />
                        {failedPct > 0 ? (
                          <div
                            className="h-full bg-[var(--admin-warning)]"
                            style={{ width: `${String(failedPct)}%` }}
                          />
                        ) : null}
                      </div>
                      <div className="flex items-end justify-between border-t border-[var(--admin-border)] pt-4">
                        <div className="text-xs text-[var(--admin-on-surface-variant)]">
                          Sent by{" "}
                          <span className="text-[var(--admin-on-surface)]">
                            {msg.sentByLabel ?? "Admin"}
                          </span>
                          <br />
                          {formatWhen(msg.sentAt)}
                        </div>
                        {msg.failedCount > 0 ? (
                          <button
                            type="button"
                            className="flex items-center gap-1 rounded-sm bg-[var(--admin-warning)] px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-[var(--admin-on-warning)] disabled:opacity-50"
                            disabled={retryBusy === msg.campaignId}
                            onClick={() => void handleRetry(msg.campaignId)}
                          >
                            <RefreshCw className="h-3 w-3" aria-hidden="true" />
                            Retry failed
                          </button>
                        ) : msg.reportHref ? (
                          <Link
                            href={msg.reportHref}
                            className="flex items-center gap-1 font-mono text-xs uppercase text-[var(--admin-primary)] hover:underline"
                          >
                            View report <ArrowRight className="h-3.5 w-3.5" />
                          </Link>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={messagesPage <= 1}
                    onClick={() => {
                      setMessagesPage((p) => Math.max(1, p - 1));
                    }}
                  >
                    Newer
                  </button>
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={messages.length < 10}
                    onClick={() => {
                      setMessagesPage((p) => p + 1);
                    }}
                  >
                    Older
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CohortActionsDrawer
        open={drawerOpen}
        initialMode={drawerMode}
        audience={null}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSuccess={() => void load()}
      />
    </div>
  );
}
