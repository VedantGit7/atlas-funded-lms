"use client";

import { ChevronDown, ChevronUp, Info, RefreshCw, Search, Shield } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { z } from "zod";
import type { AuditEntryViewSchema } from "@atlas/contracts/audit/audit";
import { VirtualizedTable } from "../../../components/patterns/VirtualizedTable";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  actionBadgeClassName,
  cardClassName,
  cardHeaderClassName,
  columnLabelClassName,
  detailButtonClassName,
  detailLabelClassName,
  detailValueClassName,
  fieldClassName,
  formatActorLabel,
  formatAuditTimestamp,
  humanizeAuditAction,
  infoBannerClassName,
  labelClassName,
  matchesAuditSearch,
  metadataPreClassName,
  outlineButtonClassName,
  pendingPanelClassName,
  selectClassName,
  statusBannerClassName,
} from "./audit-admin-shared";

type AuditEntryItem = z.infer<typeof AuditEntryViewSchema>;

type AuditLogViewerProps = {
  initialEntries: AuditEntryItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
  actionOptions: string[];
};

type AuditListResponse = {
  data: AuditEntryItem[];
  page: {
    nextCursor: string | null;
    hasMore: boolean;
  };
};

export function AuditLogViewer({
  initialEntries,
  initialNextCursor,
  initialHasMore,
  actionOptions,
}: AuditLogViewerProps) {
  const [entries, setEntries] = useState(initialEntries);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [actionFilter, setActionFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selected = entries.find((entry) => entry.id === selectedId) ?? null;

  const filteredEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (actionFilter && entry.action !== actionFilter) return false;
      return matchesAuditSearch(entry, searchQuery);
    });
  }, [actionFilter, entries, searchQuery]);

  const loadPage = useCallback(async (cursor?: string) => {
    const params = new URLSearchParams({ limit: "50" });
    if (cursor) params.set("cursor", cursor);

    const response = await clientApi.get<AuditListResponse>(`/api/v1/audit?${params.toString()}`);
    return response;
  }, []);

  useEffect(() => {
    setEntries(initialEntries);
    setNextCursor(initialNextCursor);
    setHasMore(initialHasMore);
  }, [initialEntries, initialHasMore, initialNextCursor]);

  async function reloadFromServer() {
    setRefreshing(true);
    setErrorMessage(null);
    try {
      const response = await loadPage();
      setEntries(response.data);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
      setSelectedId(null);
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setRefreshing(false);
    }
  }

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;

    setLoadingMore(true);
    setErrorMessage(null);

    try {
      const response = await loadPage(nextCursor);
      setEntries((current) => [...current, ...response.data]);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (error) {
      setErrorMessage(formatClientError(error));
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-[22px]">
              Audit Log
            </h1>
            <span className="rounded-full bg-[var(--admin-primary-container)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-on-primary-container)]">
              {entries.length} loaded
            </span>
          </div>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            Append-only tenant audit history with safe entry projections.
          </p>
        </div>
        <button
          type="button"
          className={`${outlineButtonClassName} inline-flex items-center gap-2`}
          disabled={refreshing}
          onClick={() => {
            void reloadFromServer();
          }}
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "motion-safe:animate-spin" : ""}`}
            aria-hidden="true"
          />
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <div className={infoBannerClassName}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
        <p className="text-sm font-medium text-[var(--admin-on-primary-container)]">
          Audit entries are append-only and cannot be modified or deleted. Use filters to narrow
          events by action or search terms.
        </p>
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] text-[var(--admin-danger)]`}
        >
          {errorMessage}
        </p>
      ) : null}

      <div className={cardClassName}>
        <div className={cardHeaderClassName}>
          <h2 className="text-[15px] font-semibold text-[var(--admin-on-surface)]">Audit events</h2>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-end">
            <label className="grid min-w-[12rem] gap-1.5">
              <span className={labelClassName}>Action</span>
              <select
                className={`${selectClassName} py-2 text-xs`}
                value={actionFilter}
                onChange={(event) => {
                  setActionFilter(event.target.value);
                  setSelectedId(null);
                }}
              >
                <option value="">All actions</option>
                {actionOptions.map((action) => (
                  <option key={action} value={action}>
                    {humanizeAuditAction(action)}
                  </option>
                ))}
              </select>
            </label>
            <div className="relative min-w-[14rem]">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(event) => {
                  setSearchQuery(event.target.value);
                  setSelectedId(null);
                }}
                placeholder="Search events..."
                aria-label="Search audit events"
                className={`${fieldClassName} py-2 pl-9 pr-3 text-xs`}
              />
            </div>
          </div>
        </div>

        <VirtualizedTable
          rows={filteredEntries}
          rowHeight={64}
          maxHeight={520}
          shellClassName="overflow-hidden"
          emptyShellClassName="overflow-hidden"
          getRowKey={(entry) => entry.id}
          emptyMessage="No audit entries match the current filter."
          header={
            <div className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/40">
              <div className="grid grid-cols-[minmax(10rem,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_5.5rem] gap-4 px-6 py-2">
                <span className={columnLabelClassName}>When</span>
                <span className={columnLabelClassName}>Action</span>
                <span className={columnLabelClassName}>Target</span>
                <span className={`${columnLabelClassName} text-right`}>Details</span>
              </div>
            </div>
          }
          renderRow={(entry) => {
            const isSelected = selectedId === entry.id;
            return (
              <div
                className={[
                  "grid grid-cols-[minmax(10rem,1.1fr)_minmax(0,1.4fr)_minmax(0,1fr)_5.5rem] items-center gap-4 border-b border-[var(--admin-border)] px-6 py-3 motion-safe:transition-colors motion-safe:duration-200",
                  isSelected
                    ? "bg-[var(--admin-primary-container)]/12"
                    : "hover:bg-[var(--admin-surface-low)]/80",
                ].join(" ")}
              >
                <div className="text-sm text-[var(--admin-on-surface-variant)]">
                  {formatAuditTimestamp(entry.occurredAt)}
                </div>
                <div className="min-w-0 space-y-1">
                  <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                    {humanizeAuditAction(entry.action)}
                  </p>
                  <span className={`${actionBadgeClassName} truncate`}>{entry.action}</span>
                </div>
                <div className="min-w-0 text-sm text-[var(--admin-on-surface)]">
                  <span className="font-medium">{entry.targetType}</span>
                  {entry.targetId ? (
                    <span className="text-[var(--admin-on-surface-variant)]">
                      {" "}
                      &middot; {entry.targetId.slice(0, 8)}
                    </span>
                  ) : null}
                </div>
                <div className="text-right">
                  <button
                    type="button"
                    className={detailButtonClassName(isSelected)}
                    aria-expanded={isSelected}
                    onClick={() => {
                      setSelectedId(entry.id === selectedId ? null : entry.id);
                    }}
                  >
                    {isSelected ? (
                      <>
                        Hide
                        <ChevronUp className="h-3.5 w-3.5" aria-hidden="true" />
                      </>
                    ) : (
                      <>
                        View
                        <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            );
          }}
        />

        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]/30 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Showing {filteredEntries.length} of {entries.length} loaded event
            {entries.length === 1 ? "" : "s"}
            {hasMore ? " · more available" : ""}
          </p>
          {hasMore ? (
            <button
              type="button"
              className={outlineButtonClassName}
              disabled={loadingMore}
              onClick={() => {
                void loadMore();
              }}
            >
              {loadingMore ? "Loading…" : "Load more"}
            </button>
          ) : null}
        </div>
      </div>

      {selected ? (
        <aside
          aria-label="Audit entry details"
          className={`${pendingPanelClassName} space-y-5`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-[var(--admin-primary)]" aria-hidden="true" />
                <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                  Audit entry
                </h2>
              </div>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                {humanizeAuditAction(selected.action)}
              </p>
            </div>
            <button
              type="button"
              className={detailButtonClassName(true)}
              onClick={() => {
                setSelectedId(null);
              }}
            >
              Close
            </button>
          </div>

          <dl className="grid gap-4 sm:grid-cols-2">
            <div>
              <dt className={detailLabelClassName}>Action</dt>
              <dd className={detailValueClassName}>
                <span className={actionBadgeClassName}>{selected.action}</span>
              </dd>
            </div>
            <div>
              <dt className={detailLabelClassName}>Occurred</dt>
              <dd className={detailValueClassName}>{formatAuditTimestamp(selected.occurredAt)}</dd>
            </div>
            <div>
              <dt className={detailLabelClassName}>Target</dt>
              <dd className={detailValueClassName}>
                {selected.targetType}
                {selected.targetId ? ` (${selected.targetId})` : ""}
              </dd>
            </div>
            <div>
              <dt className={detailLabelClassName}>Actor</dt>
              <dd className={detailValueClassName}>{formatActorLabel(selected)}</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className={detailLabelClassName}>Request ID</dt>
              <dd className={`${detailValueClassName} font-mono text-xs`}>{selected.requestId}</dd>
            </div>
            {selected.reason ? (
              <div className="sm:col-span-2">
                <dt className={detailLabelClassName}>Reason</dt>
                <dd className={detailValueClassName}>{selected.reason}</dd>
              </div>
            ) : null}
            {selected.metadata ? (
              <div className="sm:col-span-2">
                <dt className={detailLabelClassName}>Metadata</dt>
                <dd className="mt-1">
                  <pre className={metadataPreClassName}>
                    {JSON.stringify(selected.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
          </dl>
        </aside>
      ) : null}
    </section>
  );
}

function formatClientError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}
