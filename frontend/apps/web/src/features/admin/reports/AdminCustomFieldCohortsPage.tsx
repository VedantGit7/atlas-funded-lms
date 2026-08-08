"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Group,
  Mail,
  MessageSquareOff,
  MoreVertical,
  RefreshCw,
  Search,
  Send,
  Users,
  UserX,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  fetchCustomFieldCohortGroups,
  fetchCustomFieldCohortMessages,
  retryCustomFieldCohortMessage,
  type CustomFieldCohortGroupItem,
  type CustomFieldCohortMessageItem,
} from "./admin-custom-field-roster-api";
import {
  CustomFieldCohortActionsDrawer,
  type CustomFieldCohortDrawerMode,
} from "./CustomFieldCohortActionsDrawer";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";

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

function formatCreatedShort(iso: string) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
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
      className="flex flex-col gap-6 lg:flex-row"
      aria-busy="true"
      aria-label="Loading cohorts"
    >
      <div className="flex min-h-[360px] flex-[58] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex h-11 items-center border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5">
          <Shimmer className="h-4 w-48" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex h-11 items-center gap-4 border-b border-[var(--admin-border)] px-4 last:border-0"
          >
            <Shimmer className="h-4 w-40" />
            <Shimmer className="ml-auto h-4 w-24" />
            <Shimmer className="h-4 w-16" />
          </div>
        ))}
      </div>
      <div className="flex min-h-[360px] flex-[42] flex-col gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
        <Shimmer className="mb-2 h-4 w-36" />
        <Shimmer className="h-28 w-full" />
        <Shimmer className="h-28 w-full" />
      </div>
    </div>
  );
}

function groupHref(group: CustomFieldCohortGroupItem) {
  if (group.segmentId) {
    return `/admin/reports/custom-field/segments/${group.segmentId}`;
  }
  return "/admin/batches";
}

function statusPill(status: CustomFieldCohortMessageItem["status"]) {
  if (status === "partially_failed" || status === "failed") {
    return "border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)] text-[var(--admin-danger)]";
  }
  return "border-[color-mix(in_srgb,var(--admin-success)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-success)_10%,transparent)] text-[var(--admin-success)]";
}

function DeliveryBar({ msg }: { msg: CustomFieldCohortMessageItem }) {
  const total = Math.max(msg.recipientCount, 1);
  const deliveredPct = Math.round((msg.deliveredCount / total) * 100);
  const failedPct = Math.round((msg.failedCount / total) * 100);
  const skippedPct = Math.max(0, 100 - deliveredPct - failedPct);

  return (
    <div
      className="flex h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
      role="img"
      aria-label={`Delivered ${deliveredPct}%, failed ${failedPct}%, other ${skippedPct}%`}
    >
      <div
        className="h-full bg-[var(--admin-success)]"
        style={{ width: `${deliveredPct}%` }}
        title="Delivered"
      />
      <div
        className="h-full bg-[var(--admin-danger)]"
        style={{ width: `${failedPct}%` }}
        title="Failed"
      />
      <div
        className="h-full bg-[var(--admin-outline)]"
        style={{ width: `${skippedPct}%` }}
        title="Skipped / remaining"
      />
    </div>
  );
}

export function AdminCustomFieldCohortsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groups, setGroups] = useState<CustomFieldCohortGroupItem[]>([]);
  const [messages, setMessages] = useState<CustomFieldCohortMessageItem[]>([]);
  const [groupsPage, setGroupsPage] = useState(1);
  const [messagesPage, setMessagesPage] = useState(1);
  const [groupsTotal, setGroupsTotal] = useState(0);
  const [groupsHasPrev, setGroupsHasPrev] = useState(false);
  const [groupsHasNext, setGroupsHasNext] = useState(false);
  const [messagesHasNext, setMessagesHasNext] = useState(false);
  const [q, setQ] = useState("");
  const [qDraft, setQDraft] = useState("");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<CustomFieldCohortDrawerMode>("group");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [retryBusy, setRetryBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [groupsRes, messagesRes] = await Promise.all([
        fetchCustomFieldCohortGroups({ q: q || undefined, page: groupsPage, limit: 10 }),
        fetchCustomFieldCohortMessages({ page: messagesPage, limit: 10 }),
      ]);
      setGroups(groupsRes.data.items);
      setGroupsTotal(groupsRes.data.pageInfo.totalCount);
      setGroupsHasPrev(groupsRes.data.pageInfo.hasPreviousPage);
      setGroupsHasNext(groupsRes.data.pageInfo.hasNextPage);
      setMessages(messagesRes.data.items);
      setMessagesHasNext(messagesRes.data.pageInfo.hasNextPage);
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
      await retryCustomFieldCohortMessage(campaignId);
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

  function openDrawer(mode: CustomFieldCohortDrawerMode) {
    setDrawerMode(mode);
    setDrawerOpen(true);
  }

  const rangeStart = groups.length === 0 ? 0 : (groupsPage - 1) * 10 + 1;
  const rangeEnd = (groupsPage - 1) * 10 + groups.length;

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 pb-12">
      <CustomFieldReportTabs active="cohorts" />

      <section className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Cohorts
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Groups and messages created from custom-field conditions.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex h-10 items-center gap-2`}
            onClick={() => openDrawer("group")}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            New group
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} inline-flex h-10 items-center gap-2`}
            onClick={() => openDrawer("message")}
          >
            <Send className="h-4 w-4" aria-hidden="true" />
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
        <div className="flex flex-col gap-6 lg:flex-row">
          {/* Groups panel ~58% */}
          <div className="flex min-h-[420px] flex-[58] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Groups created from this report
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
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className="w-40 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1.5 pl-8 pr-2 font-mono text-[11px] text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] sm:w-48"
                  placeholder="Filter groups…"
                  value={qDraft}
                  onChange={(e) => setQDraft(e.target.value)}
                  aria-label="Filter groups"
                />
              </form>
            </div>

            {groups.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-outline)]">
                  <UserX className="h-8 w-8" strokeWidth={1.25} aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  No groups created from this report yet
                </h3>
                <p className="mb-6 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  Aggregate learners into cohorts from segments or ad-hoc filters to track and
                  message them together.
                </p>
                <button
                  type="button"
                  className={primaryButtonClassName}
                  onClick={() => openDrawer("group")}
                >
                  Define first cohort
                </button>
              </div>
            ) : (
              <>
                <div className="flex-1 overflow-x-auto">
                  <table className="w-full border-collapse text-left text-sm">
                    <thead className="sticky top-0 z-10 bg-[var(--admin-surface)]">
                      <tr className="border-b border-[var(--admin-border)] font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        <th className="h-10 px-4 font-semibold">Group name</th>
                        <th className="h-10 px-4 font-semibold">Source</th>
                        <th className="h-10 px-4 font-semibold">Criteria</th>
                        <th className="h-10 px-4 text-right font-semibold">Members</th>
                        <th className="h-10 px-4 font-semibold">Sync</th>
                        <th className="h-10 px-4 font-semibold">Created</th>
                        <th className="h-10 w-10 px-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => {
                        const selected = selectedGroupId === group.batchId;
                        return (
                          <tr
                            key={group.batchId}
                            className={[
                              "group h-11 border-b border-[var(--admin-border)] transition-colors hover:bg-[var(--admin-surface-high)]",
                              selected
                                ? "border-l-2 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,transparent)]"
                                : "",
                            ].join(" ")}
                            onClick={() => setSelectedGroupId(group.batchId)}
                          >
                            <td className="px-4">
                              <Link
                                href={groupHref(group)}
                                className="font-medium text-[var(--admin-primary)] hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {group.name}
                              </Link>
                            </td>
                            <td className="px-4">
                              <span className="inline-flex items-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                                {group.sourceLabel}
                              </span>
                            </td>
                            <td
                              className="max-w-[150px] truncate px-4 text-[var(--admin-on-surface-variant)]"
                              title={group.criteriaSummary ?? undefined}
                            >
                              {group.criteriaSummary ?? "—"}
                            </td>
                            <td className="px-4 text-right font-mono text-[13px]">
                              {formatCount(group.memberCount)}
                            </td>
                            <td className="px-4">
                              <span
                                className={[
                                  "inline-flex items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide",
                                  group.syncType === "live"
                                    ? "border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] text-[var(--admin-primary)]"
                                    : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
                                ].join(" ")}
                              >
                                {group.syncType === "live" ? "Live" : "Static snapshot"}
                              </span>
                            </td>
                            <td className="px-4 text-xs text-[var(--admin-on-surface-variant)]">
                              <div>{group.createdByLabel ?? "System"}</div>
                              <div>{formatCreatedShort(group.createdAt)}</div>
                            </td>
                            <td className="relative px-2 text-center">
                              <button
                                type="button"
                                className="p-1 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-on-surface)] group-hover:opacity-100"
                                aria-label={`Actions for ${group.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMenuOpenId((id) =>
                                    id === group.batchId ? null : group.batchId,
                                  );
                                }}
                              >
                                <MoreVertical className="h-[18px] w-[18px]" />
                              </button>
                              {menuOpenId === group.batchId ? (
                                <div className="absolute right-2 z-20 mt-1 min-w-[160px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                  <Link
                                    href="/admin/batches"
                                    className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                    onClick={() => setMenuOpenId(null)}
                                  >
                                    View members
                                  </Link>
                                  <Link
                                    href={groupHref(group)}
                                    className="block px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                    onClick={() => setMenuOpenId(null)}
                                  >
                                    Open source
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
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                  <span>
                    Showing {formatCount(rangeStart)}–{formatCount(rangeEnd)} of{" "}
                    {formatCount(groupsTotal)} groups
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                      disabled={!groupsHasPrev}
                      onClick={() => setGroupsPage((p) => Math.max(1, p - 1))}
                      aria-label="Previous groups page"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="flex h-6 w-6 items-center justify-center rounded hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                      disabled={!groupsHasNext}
                      onClick={() => setGroupsPage((p) => p + 1)}
                      aria-label="Next groups page"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Messages panel ~42% */}
          <div className="flex min-h-[420px] flex-[42] flex-col overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-5 py-3">
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                Message history
              </h2>
              <button
                type="button"
                className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                onClick={() => openDrawer("message")}
              >
                View all <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            {messages.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center bg-[var(--admin-surface-low)] p-6 text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded bg-[var(--admin-surface-high)] text-[var(--admin-outline)]">
                  <MessageSquareOff className="h-6 w-6" strokeWidth={1.25} aria-hidden="true" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                  No messages sent from this report yet
                </h3>
                <p className="mb-6 max-w-xs text-sm text-[var(--admin-on-surface-variant)]">
                  Initiate a broadcast to learners in a segment or ad-hoc cohort.
                </p>
                <button
                  type="button"
                  className={ghostButtonClassName}
                  onClick={() => openDrawer("message")}
                >
                  <Mail className="mr-2 h-4 w-4" aria-hidden="true" />
                  Draft broadcast
                </button>
              </div>
            ) : (
              <div className="flex flex-1 flex-col gap-3 overflow-y-auto bg-[var(--admin-surface-low)] p-4">
                {messages.map((msg) => (
                  <article
                    key={msg.campaignId}
                    className={[
                      "relative rounded-md border bg-[var(--admin-surface)] p-4 shadow-sm transition-shadow hover:shadow-md",
                      msg.status === "partially_failed" || msg.status === "failed"
                        ? "overflow-hidden border-[color-mix(in_srgb,var(--admin-danger)_35%,var(--admin-border))]"
                        : "border-[var(--admin-border)]",
                    ].join(" ")}
                  >
                    {msg.status === "partially_failed" || msg.status === "failed" ? (
                      <div
                        className="absolute inset-y-0 left-0 w-1 bg-[var(--admin-danger)]"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="mb-2 flex items-start justify-between gap-2 pl-1">
                      <div>
                        <h3 className="text-base font-semibold leading-tight text-[var(--admin-on-surface)]">
                          {msg.subject}
                        </h3>
                        <p className="mt-1 flex items-center gap-1 text-xs text-[var(--admin-on-surface-variant)]">
                          <Group className="h-3.5 w-3.5" aria-hidden="true" />
                          {msg.audienceCaption ?? "Cohort message"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-sm border px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase tracking-wide ${statusPill(msg.status)}`}
                      >
                        {msg.status === "partially_failed"
                          ? "Partially failed"
                          : msg.status === "failed"
                            ? "Failed"
                            : "Sent"}
                      </span>
                    </div>

                    <div className="mt-3 pl-1">
                      <div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                        <span>
                          Delivered:{" "}
                          <span className="text-[var(--admin-on-surface)]">
                            {formatCount(msg.deliveredCount)}
                          </span>
                        </span>
                        <span>
                          Skipped:{" "}
                          <span className="text-[var(--admin-on-surface)]">
                            {formatCount(msg.skippedCount)}
                          </span>
                        </span>
                        {msg.failedCount > 0 ? (
                          <span className="font-medium text-[var(--admin-danger)]">
                            Failed:{" "}
                            <span className="font-mono">{formatCount(msg.failedCount)}</span>
                          </span>
                        ) : null}
                        <span>
                          Opened:{" "}
                          <span className="text-[var(--admin-on-surface)]">
                            {msg.openedCount == null ? "—" : formatCount(msg.openedCount)}
                          </span>
                        </span>
                      </div>
                      <DeliveryBar msg={msg} />
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-2 border-t border-[var(--admin-border)] pt-3 pl-1 text-xs text-[var(--admin-on-surface-variant)]">
                      <span>
                        Sent by {msg.sentByLabel ?? "System"} · {formatWhen(msg.sentAt)}
                      </span>
                      {msg.status === "partially_failed" || msg.status === "failed" ? (
                        <button
                          type="button"
                          className="rounded border border-[var(--admin-danger)] px-3 py-1 text-xs font-semibold text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_5%,transparent)] disabled:opacity-50"
                          disabled={retryBusy === msg.campaignId}
                          onClick={() => void handleRetry(msg.campaignId)}
                        >
                          <RefreshCw className="mr-1 inline h-3 w-3" aria-hidden="true" />
                          Retry failed
                        </button>
                      ) : (
                        <span className="inline-flex items-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[10px]">
                          {msg.sourceLabel}
                        </span>
                      )}
                    </div>
                  </article>
                ))}
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={messagesPage <= 1}
                    onClick={() => setMessagesPage((p) => Math.max(1, p - 1))}
                  >
                    Newer
                  </button>
                  <button
                    type="button"
                    className={ghostButtonClassName}
                    disabled={!messagesHasNext}
                    onClick={() => setMessagesPage((p) => p + 1)}
                  >
                    Older
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <CustomFieldCohortActionsDrawer
        open={drawerOpen}
        initialMode={drawerMode}
        onClose={() => setDrawerOpen(false)}
        onSuccess={() => void load()}
      />
    </div>
  );
}
