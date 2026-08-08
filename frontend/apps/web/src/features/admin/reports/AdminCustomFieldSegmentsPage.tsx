"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronRight,
  Copy,
  Download,
  Filter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Trash2,
  Users,
} from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
} from "../../analytics/analytics-admin-shared";
import { ClientApiError } from "../../../lib/client-api";
import {
  createGroupFromSegment,
  deleteCustomFieldSegment,
  downloadCsv,
  duplicateCustomFieldSegment,
  exportCustomFieldSegmentsCsv,
  fetchCustomFieldSegments,
  type CustomFieldSegmentItem,
  type CustomFieldSegmentSummary,
} from "./admin-custom-field-segments-api";
import { CustomFieldReportTabs } from "./CustomFieldReportTabs";

const selectClassName =
  "h-9 min-w-[140px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] text-xs font-medium text-[var(--admin-on-surface)] hover:border-[var(--admin-outline)] focus-visible:border-[var(--admin-primary)] focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]/30";

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

function formatCount(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

function formatDateShort(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function formatRelativeDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = date.getTime() - Date.now();
  const absDays = Math.round(Math.abs(diffMs) / (1000 * 60 * 60 * 24));
  if (absDays < 1) {
    const absHours = Math.round(Math.abs(diffMs) / (1000 * 60 * 60));
    if (absHours < 1) return "Just now";
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absHours,
      "hour",
    );
  }
  if (absDays < 14) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(
      Math.sign(diffMs) * absDays,
      "day",
    );
  }
  return formatDateShort(value);
}

function LoadingSkeleton() {
  return (
    <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex h-[60px] items-center gap-8 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6">
        <Shimmer className="h-4 w-24" />
        <Shimmer className="h-4 w-32" />
        <Shimmer className="h-4 w-16" />
      </div>
      <div className="h-11 border-b border-[var(--admin-border)] px-6">
        <div className="grid h-full grid-cols-12 items-center gap-4">
          <Shimmer className="col-span-5 h-3" />
          <Shimmer className="col-span-3 h-3" />
          <Shimmer className="col-span-2 h-3" />
          <Shimmer className="col-span-2 h-3 justify-self-end" />
        </div>
      </div>
      {[0, 1, 2].map((row) => (
        <div
          key={row}
          className="h-11 border-b border-[var(--admin-border)] px-6 last:border-b-0"
        >
          <div className="grid h-full grid-cols-12 items-center gap-4">
            <Shimmer className="col-span-5 h-4" />
            <Shimmer className="col-span-3 h-4" />
            <Shimmer className="col-span-2 h-5 rounded-full" />
            <Shimmer className="col-span-2 h-4 justify-self-end" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DeleteModal({
  segment,
  busy,
  onCancel,
  onConfirm,
}: {
  segment: CustomFieldSegmentItem;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_40%,transparent)] p-4 backdrop-blur-sm">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-segment-title"
        className="w-full max-w-md overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
      >
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <h3
            id="delete-segment-title"
            className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]"
          >
            Delete &apos;{segment.name}&apos;?
          </h3>
          <p className="mb-4 text-sm text-[var(--admin-on-surface-variant)]">
            This segment currently matches{" "}
            <span className="font-mono text-[13px] text-[var(--admin-on-surface)]">
              {formatCount(segment.matchedCount)}
            </span>{" "}
            learners. Deleting it cannot be undone.
          </p>
          {segment.dependencyCount > 0 ? (
            <div className="mb-6 rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
              <div className="flex items-start gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-warning)]" />
                <div>
                  <strong className="font-semibold text-[var(--admin-on-surface)]">
                    Dependency warning:
                  </strong>{" "}
                  Used by {segment.dependencyCount} scheduled export
                  {segment.dependencyCount === 1 ? "" : "s"}.
                </div>
              </div>
            </div>
          ) : (
            <div className="mb-6" />
          )}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              className={ghostButtonClassName}
              onClick={onCancel}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className="inline-flex h-9 items-center justify-center rounded-sm bg-[var(--admin-danger)] px-4 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
              onClick={onConfirm}
              disabled={busy}
            >
              {busy ? "Deleting…" : "Delete segment"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminCustomFieldSegmentsPage() {
  const [items, setItems] = useState<CustomFieldSegmentItem[]>([]);
  const [summary, setSummary] = useState<CustomFieldSegmentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CustomFieldSegmentItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCustomFieldSegments();
      setItems(response.data.items);
      setSummary(response.data.summary);
      setSelected(new Set());
    } catch (err) {
      const message =
        err instanceof ClientApiError ? err.message : "Couldn't load the segments list.";
      setError(message);
      setItems([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const largestMatch = useMemo(() => {
    let max = 0;
    for (const item of items) {
      if (item.matchedCount != null && item.matchedCount > max) max = item.matchedCount;
    }
    return max || summary?.largestSegmentCount || 1;
  }, [items, summary]);

  const allSelected = items.length > 0 && selected.size === items.length;

  async function onExport() {
    setExporting(true);
    try {
      const response = await exportCustomFieldSegmentsCsv();
      downloadCsv(response.data.csv, response.data.filename);
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Export failed.");
    } finally {
      setExporting(false);
    }
  }

  async function onDuplicate(segmentId: string) {
    setMenuOpenId(null);
    try {
      await duplicateCustomFieldSegment(segmentId);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Duplicate failed.");
    }
  }

  async function onCreateGroup(segment: CustomFieldSegmentItem) {
    setMenuOpenId(null);
    try {
      await createGroupFromSegment(segment.id, { title: segment.name });
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Could not create group.");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteCustomFieldSegment(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err instanceof ClientApiError ? err.message : "Delete failed.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]">
            <span>Admin</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>Reports</span>
            <ChevronRight className="h-3.5 w-3.5" />
            <span>Custom Field</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Segments
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
            Saved conditions over your custom fields — reusable for grouping, messaging, and
            export.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => void onExport()}
            disabled={exporting || loading}
          >
            <Download className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export CSV"}
          </button>
          <Link href="/admin/reports/custom-field/segments/new" className={primaryButtonClassName}>
            <Plus className="h-4 w-4" />
            New segment
          </Link>
        </div>
      </div>

      <CustomFieldReportTabs active="segments" />

      {error ? (
        <div className="flex items-center justify-between gap-3 rounded-sm border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
          <div className="flex items-center gap-3 text-sm text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            className="rounded-sm bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] px-3 py-1.5 text-sm text-[var(--admin-danger)] transition-colors hover:opacity-90"
            onClick={() => void load()}
          >
            Retry
          </button>
        </div>
      ) : null}

      {summary && !loading ? (
        <div className="grid overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] md:grid-cols-6">
          <div className="border-b border-[var(--admin-border)] p-4 md:col-span-2 md:border-b-0 md:border-r">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Segments
            </div>
            <div className="flex items-baseline gap-3">
              <span className="font-mono text-2xl leading-none text-[var(--admin-on-surface)]">
                {formatCount(summary.segmentCount)}
              </span>
              <span className="text-xs text-[var(--admin-on-surface-variant)]">
                {summary.sharedCount} shared, {summary.privateCount} private
              </span>
            </div>
          </div>
          <div className="border-b border-[var(--admin-border)] p-4 md:border-b-0 md:border-r">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Learners covered
            </div>
            <div className="font-mono text-2xl leading-none text-[var(--admin-on-surface)]">
              {formatCount(summary.learnersCovered)}
            </div>
            <div className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
              at least one segment
            </div>
          </div>
          <div className="border-b border-[var(--admin-border)] p-4 md:border-b-0 md:border-r">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Largest segment
            </div>
            <div className="truncate text-sm text-[var(--admin-on-surface)]">
              {summary.largestSegmentName ?? "—"}
            </div>
            <div className="mt-1 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
              · {formatCount(summary.largestSegmentCount)}
            </div>
          </div>
          <div className="relative overflow-hidden border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-warning)_6%,var(--admin-surface))] p-4 md:border-b-0 md:border-r">
            <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-[var(--admin-warning)]" />
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-warning)]">
              Stale
            </div>
            <div className="font-mono text-2xl leading-none text-[var(--admin-warning)]">
              {formatCount(summary.staleCount)}
            </div>
            <div className="mt-1 text-[10px] text-[color-mix(in_srgb,var(--admin-warning)_70%,transparent)]">
              not refreshed in 30 days
            </div>
          </div>
          <div className="p-4">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Used in messages
            </div>
            <div className="font-mono text-2xl leading-none text-[var(--admin-on-surface)]">
              {formatCount(summary.usedInMessages)}
            </div>
            <div className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
              scheduled export refs
            </div>
          </div>
        </div>
      ) : null}

      {loading ? <LoadingSkeleton /> : null}

      {!loading && items.length === 0 && !error ? (
        <div className="flex h-[400px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
          <Filter className="mb-4 h-12 w-12 text-[var(--admin-on-surface-variant)]" strokeWidth={1.25} />
          <h3 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No segments yet
          </h3>
          <p className="mb-6 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            Save a set of conditions once and reuse it for groups, messages, and exports.
          </p>
          <Link href="/admin/reports/custom-field/segments/new" className={primaryButtonClassName}>
            New segment
          </Link>
        </div>
      ) : null}

      {!loading && items.length > 0 ? (
        <div className="overflow-hidden rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="overflow-x-auto">
            <table className="min-w-[1100px] w-full border-collapse text-left text-sm">
              <thead>
                <tr className="h-11 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <th className="w-10 px-4">
                    <input
                      type="checkbox"
                      className={selectClassName.replace("h-9 min-w-[140px]", "h-4 w-4")}
                      checked={allSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelected(new Set(items.map((item) => item.id)));
                        } else {
                          setSelected(new Set());
                        }
                      }}
                      aria-label="Select all segments"
                    />
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Segment
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Conditions
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Matches
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Sync
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Visibility
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Created by
                  </th>
                  <th className="px-3 font-mono text-[10px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    Last refreshed
                  </th>
                  <th className="w-12 px-3" />
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const matchPct =
                    item.matchedCount == null
                      ? 0
                      : Math.max(4, Math.round((item.matchedCount / largestMatch) * 100));
                  const delta =
                    item.matchedDelta == null
                      ? null
                      : `${item.matchedDelta >= 0 ? "+" : ""}${item.matchedDelta} since ${formatDateShort(item.matchedCountAt)}`;
                  return (
                    <tr
                      key={item.id}
                      className="h-14 border-b border-[var(--admin-border)] last:border-b-0 hover:bg-[color-mix(in_srgb,var(--admin-primary)_4%,var(--admin-surface))]"
                    >
                      <td className="px-4">
                        <input
                          type="checkbox"
                          checked={selected.has(item.id)}
                          onChange={(event) => {
                            setSelected((prev) => {
                              const next = new Set(prev);
                              if (event.target.checked) next.add(item.id);
                              else next.delete(item.id);
                              return next;
                            });
                          }}
                          aria-label={`Select ${item.name}`}
                        />
                      </td>
                      <td className="max-w-[280px] px-3 py-2">
                        <Link
                          href={`/admin/reports/custom-field/segments/${item.id}`}
                          className="font-medium text-[var(--admin-primary)] hover:underline"
                        >
                          {item.name}
                        </Link>
                        <div className="mt-0.5 line-clamp-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                          {item.conditionSummary}
                        </div>
                      </td>
                      <td className="px-3 font-mono text-[13px] text-[var(--admin-on-surface-variant)]">
                        {item.conditionCount} conditions in {item.groupCount} group
                        {item.groupCount === 1 ? "" : "s"}
                      </td>
                      <td className="min-w-[140px] px-3">
                        <div className="font-mono text-[13px] text-[var(--admin-on-surface)]">
                          {formatCount(item.matchedCount)}
                        </div>
                        <div className="mt-1 h-[3px] w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                          <div
                            className="h-full rounded-full bg-[var(--admin-primary)]"
                            style={{ width: `${matchPct}%` }}
                          />
                        </div>
                        {delta ? (
                          <div className="mt-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                            {delta}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3">
                        <span className="inline-flex rounded-sm border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-2 py-0.5 font-mono text-[11px] font-semibold uppercase text-[var(--admin-on-surface)]">
                          {item.refreshMode === "snapshot" ? "Snapshot" : "Live"}
                        </span>
                      </td>
                      <td className="px-3">
                        <span className="inline-flex rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                          {item.visibility === "private" ? "Private" : "Shared"}
                        </span>
                      </td>
                      <td className="px-3 text-[var(--admin-on-surface-variant)]">
                        {item.createdByName ?? "—"}
                      </td>
                      <td
                        className={`px-3 ${
                          item.isStale
                            ? "text-[var(--admin-warning)]"
                            : "text-[var(--admin-on-surface-variant)]"
                        }`}
                      >
                        <div className="text-xs">{formatRelativeDate(item.matchedCountAt)}</div>
                        <div className="font-mono text-[10px]">
                          {formatDateShort(item.matchedCountAt)}
                        </div>
                      </td>
                      <td className="relative px-3">
                        <button
                          type="button"
                          className="rounded-sm p-1.5 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                          aria-label={`Actions for ${item.name}`}
                          onClick={() =>
                            setMenuOpenId((current) => (current === item.id ? null : item.id))
                          }
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                        {menuOpenId === item.id ? (
                          <div
                            ref={menuRef}
                            className="absolute right-3 top-10 z-20 min-w-[200px] rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg"
                          >
                            <Link
                              href={`/admin/reports/custom-field/segments/${item.id}`}
                              className="block px-3 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                              onClick={() => setMenuOpenId(null)}
                            >
                              Open segment
                            </Link>
                            <Link
                              href={`/admin/reports/custom-field/segments/${item.id}/edit`}
                              className="block px-3 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                              onClick={() => setMenuOpenId(null)}
                            >
                              Edit conditions
                            </Link>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                              onClick={() => void onDuplicate(item.id)}
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Duplicate
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-low)]"
                              onClick={() => void onCreateGroup(item)}
                            >
                              <Users className="h-3.5 w-3.5" />
                              Create group from segment
                            </button>
                            <button
                              type="button"
                              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-[var(--admin-danger)] hover:bg-[var(--admin-surface-low)]"
                              onClick={() => {
                                setMenuOpenId(null);
                                setDeleteTarget(item);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Delete
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
            <span>
              {selected.size > 0
                ? `${selected.size} selected`
                : `${items.length} segment${items.length === 1 ? "" : "s"}`}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-[var(--admin-primary)] hover:underline"
              onClick={() => void load()}
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <DeleteModal
          segment={deleteTarget}
          busy={deleting}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={() => void confirmDelete()}
        />
      ) : null}
    </div>
  );
}
