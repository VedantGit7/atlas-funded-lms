"use client";

import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Download,
  Mail,
  RefreshCw,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import type { ReportInitialDataInRange } from "../../../lib/server/report-initial-data";
import { AFFILIATES_HREF } from "../grow/affiliates-shared";
import { type AffiliatesPayload } from "./admin-sales-marketing-roster-api";
import { AffiliatesSkeleton } from "./admin-affiliates-shared";
import {
  AffiliateDrawer,
  AffiliatePayoutModal,
  AffiliateSuspendModal,
  AffiliatesFilters,
  AffiliatesPendingList,
  AffiliatesSummary,
  AffiliatesTable,
} from "./admin-affiliates-sections";
import { useAdminAffiliates } from "./use-admin-affiliates";

export function AdminAffiliatesPanel(
  props: {
    /**
     * The first page over the default 30 days of activity, loaded by the server
     * with the range it counted; the first browser load is skipped when present.
     */
    initialData?: ReportInitialDataInRange<AffiliatesPayload> | null | undefined;
  } = {},
) {
  const view = useAdminAffiliates(props);
  const {
    actionError,
    activityFrom,
    activityTo,
    busy,
    clearFilters,
    currency,
    error,
    formatMoneyAmount,
    handleExport,
    isFilteredEmpty,
    isTrulyEmpty,
    load,
    loading,
    openPayout,
    payload,
    payoutTarget,
    pendingItems,
    selectedCount,
    selectedIds,
    selectedUnpaidCents,
    setActivityFrom,
    setActivityTo,
    setPage,
    setSelectedIds,
    setViewTab,
    summary,
    suspendTarget,
    toast,
    viewTab,
  } = view;

  if (loading && !payload && viewTab !== "pending") {
    return <AffiliatesSkeleton />;
  }

  return (
    <div className="relative flex flex-col gap-6 pb-20">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Affiliates
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-[var(--admin-on-surface-variant)]">
            People promoting your products — revenue contributed, commission earned, and payouts
            owed in the selected activity window.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]">
            <CalendarDays
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <span className="sr-only">Activity from</span>
            <input
              type="date"
              value={activityFrom}
              onChange={(event) => {
                setActivityFrom(event.target.value);
                setPage(1);
              }}
              className="bg-transparent outline-none"
            />
            <span className="text-[var(--admin-on-surface-variant)]">–</span>
            <span className="sr-only">Activity to</span>
            <input
              type="date"
              value={activityTo}
              onChange={(event) => {
                setActivityTo(event.target.value);
                setPage(1);
              }}
              className="bg-transparent outline-none"
            />
          </label>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading || Boolean(error)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>

          <Link
            href={`${AFFILIATES_HREF}?tab=settings`}
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
          >
            <Settings className="h-4 w-4" aria-hidden="true" />
            Affiliate settings
          </Link>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
            onClick={() => {
              openPayout(null);
            }}
            disabled={Boolean(error) || viewTab === "pending"}
          >
            <Banknote className="h-4 w-4" aria-hidden="true" />
            Record payout
          </button>
        </div>
      </div>

      {toast ? (
        <div
          className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)]"
          role="status"
        >
          {toast}
        </div>
      ) : null}

      {actionError && !payoutTarget && !suspendTarget ? (
        <div
          className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
          role="alert"
        >
          {actionError}
        </div>
      ) : null}

      {error ? (
        <div
          className="flex flex-col gap-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4 sm:flex-row sm:items-center sm:justify-between"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle
              className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]"
              aria-hidden="true"
            />
            <div>
              <h2 className="text-base font-semibold text-[var(--admin-danger)]">
                Failed to load affiliates.
              </h2>
              <p className="mt-0.5 text-sm text-[color-mix(in_srgb,var(--admin-danger)_80%,var(--admin-on-surface))]">
                {error}
              </p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex h-9 shrink-0 items-center gap-2 rounded border border-[var(--admin-danger)] px-4 text-xs font-medium text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] active:translate-y-px"
            onClick={() => void load()}
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none opacity-30">
          <AffiliatesSkeleton />
        </div>
      ) : null}

      {!error && (summary || viewTab === "pending") ? (
        <>
          <AffiliatesSummary view={view} />

          <AffiliatesFilters view={view} />

          <div className="flex gap-1 overflow-x-auto border-b border-[var(--admin-border)]">
            {(
              [
                { key: "all" as const, label: "All affiliates" },
                { key: "owed" as const, label: "Owed commission" },
                { key: "pending" as const, label: "Pending approval" },
                { key: "top" as const, label: "Top earners" },
                { key: "suspended" as const, label: "Suspended" },
              ] as const
            ).map((tab) => {
              const active = viewTab === tab.key;
              const badge =
                tab.key === "pending"
                  ? (summary?.pendingApprovalCount ?? pendingItems.length)
                  : null;
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={[
                    "inline-flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2 text-sm transition-colors",
                    active
                      ? "border-[var(--admin-primary)] font-semibold text-[var(--admin-primary)]"
                      : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    setViewTab(tab.key);
                    setPage(1);
                    setSelectedIds(new Set());
                  }}
                >
                  {tab.label}
                  {badge != null && badge > 0 ? (
                    <span className="inline-flex min-w-[1.25rem] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-warning)_18%,transparent)] px-1.5 py-0.5 font-mono text-[10px] font-medium text-[var(--admin-warning)]">
                      {badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <AffiliatesPendingList view={view} />

          {viewTab !== "pending" && isTrulyEmpty ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                <Users
                  className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
              </div>
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No affiliates yet
              </h2>
              <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Affiliates who promote your products will appear here with revenue and commission
                once they start attributing orders.
              </p>
              <Link
                href={`${AFFILIATES_HREF}?tab=settings`}
                className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-6 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
              >
                <Settings className="h-4 w-4" aria-hidden="true" />
                Affiliate settings
              </Link>
            </div>
          ) : null}

          {viewTab !== "pending" && isFilteredEmpty ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <Search
                className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No affiliates match these filters
              </h2>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                Try clearing filters or widening the activity window.
              </p>
              <button
                type="button"
                className="mt-4 text-sm font-medium text-[var(--admin-primary)] hover:underline"
                onClick={clearFilters}
              >
                Clear all filters
              </button>
            </div>
          ) : null}

          <AffiliatesTable view={view} />
        </>
      ) : null}

      {selectedCount > 0 && viewTab !== "pending" ? (
        <div className="fixed bottom-6 left-1/2 z-40 flex w-[min(920px,calc(100%-2rem))] -translate-x-1/2 flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_12%,transparent)]">
          <div className="text-sm text-[var(--admin-on-surface)]">
            <span className="font-mono font-semibold">{selectedCount}</span> selected
            <span className="mx-2 text-[var(--admin-on-surface-variant)]">·</span>
            <span className="text-[var(--admin-on-surface-variant)]">Unpaid </span>
            <span className="font-mono font-medium text-[var(--admin-warning)]">
              {formatMoneyAmount(selectedUnpaidCents)} {currency}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="inline-flex h-8 items-center gap-1.5 rounded border border-dashed border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface-variant)]"
              title="Use Grow → Affiliates for cohort messaging"
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Message via Grow
            </span>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
              disabled={busy}
              onClick={() => void handleExport([...selectedIds])}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export selection
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded bg-[var(--admin-primary-strong)] px-3 text-xs font-medium text-[var(--admin-on-primary)] disabled:opacity-50"
              disabled={busy || selectedUnpaidCents <= 0}
              onClick={() => {
                openPayout(null);
              }}
            >
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
              Record payout
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              aria-label="Clear selection"
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

      <AffiliateDrawer view={view} />

      <AffiliatePayoutModal view={view} />

      <AffiliateSuspendModal view={view} />
    </div>
  );
}
