"use client";

import {
  AlertTriangle,
  Banknote,
  Check,
  ChevronRight,
  Copy,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  Users,
  X,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import {
  InitialsAvatar,
  Shimmer,
  type StatusFilter,
  type TierFilter,
  type UnpaidBand,
  isSuspendedStatus,
  statusLabel,
  statusPillClass,
  tierLabel,
  tierPillClass,
} from "./admin-affiliates-shared";
import type { AdminAffiliatesView } from "./use-admin-affiliates";

/** Revenue, earned, unpaid and paid totals for the range. */
export function AffiliatesSummary({ view }: { view: AdminAffiliatesView }) {
  const { formatMoneyAmount, summary, viewer } = view;
  return (
    <>
      {summary ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-5">
          <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-2">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Revenue contributed
            </p>
            <p className="font-mono text-[28px] font-semibold leading-tight tracking-tight text-[var(--admin-on-surface)]">
              {formatMoneyAmount(summary.revenueCents)}
              <span className="ml-1.5 text-[11px] font-normal text-[var(--admin-on-surface-variant)]">
                {summary.currency}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
              {summary.windowLabel}
            </p>
          </div>

          <div className="bg-[var(--admin-surface)] p-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Commission earned
            </p>
            <p className="font-mono text-lg font-medium text-[var(--admin-on-surface)]">
              {formatMoneyAmount(summary.commissionCents)}
              <span className="ml-1 text-[11px] font-normal opacity-70">{summary.currency}</span>
            </p>
          </div>

          <div className="bg-[var(--admin-surface)] p-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Unpaid
            </p>
            <p className="font-mono text-lg font-medium text-[var(--admin-warning)]">
              {formatMoneyAmount(summary.unpaidCents)}
              <span className="ml-1 text-[11px] font-normal opacity-70">{summary.currency}</span>
            </p>
            <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
              across {summary.unpaidAffiliateCount.toLocaleString(viewer.locale)} affiliate
              {summary.unpaidAffiliateCount === 1 ? "" : "s"}
            </p>
          </div>

          <div className="bg-[var(--admin-surface)] p-4">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Paid
            </p>
            <p className="font-mono text-lg font-medium text-[var(--admin-success)]">
              {formatMoneyAmount(summary.paidCents)}
              <span className="ml-1 text-[11px] font-normal opacity-70">{summary.currency}</span>
            </p>
          </div>

          <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-1">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Active affiliates
            </p>
            <p className="font-mono text-lg font-medium text-[var(--admin-on-surface)]">
              {summary.activeCount.toLocaleString(viewer.locale)}
              <span className="ml-1 text-xs font-normal text-[var(--admin-on-surface-variant)]">
                of {summary.totalCount.toLocaleString(viewer.locale)}
              </span>
            </p>
            <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
              {summary.pendingApprovalCount.toLocaleString(viewer.locale)} pending approval
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Search, status, tier and date filters, with the applied chips. */
export function AffiliatesFilters({ view }: { view: AdminAffiliatesView }) {
  const {
    applyFilters,
    clearFilters,
    draftQ,
    draftSignedUpFrom,
    draftSignedUpTo,
    draftStatus,
    draftTier,
    draftUnpaidBand,
    filterChips,
    setDraftQ,
    setDraftSignedUpFrom,
    setDraftSignedUpTo,
    setDraftStatus,
    setDraftTier,
    setDraftUnpaidBand,
  } = view;
  return (
    <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
        <label className="relative min-w-0 flex-1 max-w-sm">
          <span className="sr-only">Search affiliates</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
          <input
            className="h-9 w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
            placeholder="Name, email, or coupon"
            value={draftQ}
            onChange={(event) => {
              setDraftQ(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") applyFilters();
            }}
          />
        </label>

        <div className="w-full sm:w-40">
          <Select
            ariaLabel="Status"
            value={draftStatus}
            onValueChange={(value) => {
              setDraftStatus(value as StatusFilter);
            }}
            options={[
              { value: "all", label: "Status: All" },
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Suspended" },
            ]}
            className="h-9"
          />
        </div>

        <div className="w-full sm:w-40">
          <Select
            ariaLabel="Tier"
            value={draftTier}
            onValueChange={(value) => {
              setDraftTier(value as TierFilter);
            }}
            options={[
              { value: "any", label: "Tier: Any" },
              { value: "STANDARD", label: "Standard" },
              { value: "PREMIUM", label: "Premium" },
            ]}
            className="h-9"
          />
        </div>

        <div className="w-full sm:w-48">
          <Select
            ariaLabel="Unpaid band"
            value={draftUnpaidBand}
            onValueChange={(value) => {
              setDraftUnpaidBand(value as UnpaidBand);
            }}
            options={[
              { value: "any", label: "Unpaid: Any" },
              { value: "has_unpaid", label: "Has unpaid" },
              { value: "zero", label: "Zero unpaid" },
              { value: "above_1000", label: "Above 1,000" },
            ]}
            className="h-9"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="sr-only">Signed up from</span>
          <input
            type="date"
            value={draftSignedUpFrom}
            onChange={(event) => {
              setDraftSignedUpFrom(event.target.value);
            }}
            className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
            aria-label="Signed up from"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="sr-only">Signed up to</span>
          <input
            type="date"
            value={draftSignedUpTo}
            onChange={(event) => {
              setDraftSignedUpTo(event.target.value);
            }}
            className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
            aria-label="Signed up to"
          />
        </label>

        <button
          type="button"
          className="inline-flex h-9 items-center justify-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
          onClick={applyFilters}
        >
          Apply
        </button>
      </div>

      {filterChips.length > 0 ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-xs text-[var(--admin-on-surface-variant)]">Active filters:</span>
          {filterChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex items-center gap-1 rounded-full border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 text-[11px] text-[var(--admin-on-surface)]"
            >
              {chip.label}
            </span>
          ))}
          <button
            type="button"
            className="text-xs font-medium text-[var(--admin-primary)] hover:underline"
            onClick={clearFilters}
          >
            Clear all
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Partner applications waiting for approval. */
export function AffiliatesPendingList({ view }: { view: AdminAffiliatesView }) {
  const {
    busy,
    formatShortDate,
    handleReview,
    loadPending,
    pendingError,
    pendingItems,
    pendingLoading,
    viewTab,
  } = view;
  return (
    <>
      {viewTab === "pending" ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          {pendingError ? (
            <div className="flex items-center justify-between gap-3 p-4" role="alert">
              <p className="text-sm text-[var(--admin-danger)]">{pendingError}</p>
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs"
                onClick={() => void loadPending()}
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                Retry
              </button>
            </div>
          ) : pendingLoading ? (
            <div className="divide-y divide-[var(--admin-border)] p-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="flex h-14 items-center gap-3 px-3">
                  <Shimmer className="h-8 w-8 rounded-full" />
                  <Shimmer className="h-4 flex-1" />
                  <Shimmer className="h-8 w-20" />
                </div>
              ))}
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center p-8 text-center">
              <Users
                className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No pending affiliate requests
              </h2>
              <p className="mt-2 text-sm text-[var(--admin-on-surface-variant)]">
                New applications will appear here for approval.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="h-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                    <th className="px-4 py-2 font-medium">Applicant</th>
                    <th className="px-4 py-2 font-medium">Note</th>
                    <th className="px-4 py-2 font-medium">Requested</th>
                    <th className="px-4 py-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {pendingItems.map((row) => (
                    <tr key={row.id} className="h-14">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={row.displayName} email={row.email} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--admin-on-surface)]">
                              {row.displayName ?? "—"}
                            </p>
                            <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                              {row.email ?? ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="max-w-xs px-4 py-2 text-xs text-[var(--admin-on-surface-variant)]">
                        {row.note?.trim() || "—"}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {formatShortDate(row.createdAt)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            className="inline-flex h-8 items-center rounded bg-[var(--admin-primary-strong)] px-3 text-xs font-medium text-[var(--admin-on-primary)] disabled:opacity-50"
                            disabled={busy}
                            onClick={() => void handleReview(row.id, "approve")}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="inline-flex h-8 items-center rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] disabled:opacity-50"
                            disabled={busy}
                            onClick={() => void handleReview(row.id, "reject")}
                          >
                            Decline
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}

/** The affiliate table, its row menus and the pager. */
export function AffiliatesTable({ view }: { view: AdminAffiliatesView }) {
  const {
    allOnPageSelected,
    copiedCodeId,
    formatMoneyAmount,
    formatShortDate,
    handleCopyCoupon,
    isEmpty,
    items,
    loading,
    maxRevenue,
    menuOpenId,
    openDrawer,
    openPayout,
    openSuspend,
    pageInfo,
    pageTotals,
    selectedIds,
    setMenuOpenId,
    setPage,
    setSelectedIds,
    viewTab,
    viewer,
  } = view;
  return (
    <>
      {viewTab !== "pending" && !isEmpty ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_1px_2px_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead>
                <tr className="h-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  <th className="w-10 px-4 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                      checked={allOnPageSelected}
                      onChange={(event) => {
                        if (event.target.checked) {
                          setSelectedIds(new Set(items.map((row) => row.affiliateId)));
                        } else {
                          setSelectedIds(new Set());
                        }
                      }}
                      aria-label="Select all on page"
                    />
                  </th>
                  <th className="px-4 py-2 font-medium">Affiliate</th>
                  <th className="px-4 py-2 font-medium">Tier</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Coupon</th>
                  <th className="px-4 py-2 text-right font-medium">Revenue</th>
                  <th className="px-4 py-2 text-right font-medium">Earned</th>
                  <th className="px-4 py-2 text-right font-medium">Unpaid</th>
                  <th className="px-4 py-2 text-right font-medium">Paid</th>
                  <th className="px-4 py-2 font-medium">Signed up</th>
                  <th className="w-12 px-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((row) => {
                  const muted = isSuspendedStatus(row.status);
                  const share =
                    maxRevenue > 0
                      ? Math.max(4, Math.round((row.revenueContributionCents / maxRevenue) * 100))
                      : 0;
                  const selected = selectedIds.has(row.affiliateId);
                  return (
                    <tr
                      key={row.affiliateId}
                      className={[
                        "group h-14 cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_4%,var(--admin-surface))]",
                        muted ? "opacity-70" : "",
                        selected
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                          : "",
                      ].join(" ")}
                      onClick={() => {
                        openDrawer(row);
                      }}
                    >
                      <td
                        className="px-4 text-center"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <input
                          type="checkbox"
                          className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                          checked={selected}
                          onChange={(event) => {
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (event.target.checked) next.add(row.affiliateId);
                              else next.delete(row.affiliateId);
                              return next;
                            });
                          }}
                          aria-label={`Select ${row.learnerName ?? row.email ?? "affiliate"}`}
                        />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-3">
                          <InitialsAvatar name={row.learnerName} email={row.email} />
                          <div className="min-w-0">
                            <p className="truncate font-medium text-[var(--admin-on-surface)]">
                              {row.learnerName ?? "—"}
                            </p>
                            <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                              {row.email ?? ""}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={[
                            "inline-flex rounded px-2 py-0.5 text-[11px] font-medium",
                            tierPillClass(row.tier),
                          ].join(" ")}
                        >
                          {tierLabel(row.tier)}
                        </span>
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={[
                            "inline-flex rounded px-2 py-0.5 text-[11px] font-medium",
                            statusPillClass(row.status),
                          ].join(" ")}
                        >
                          {statusLabel(row.status)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-2"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                      >
                        <button
                          type="button"
                          className="inline-flex items-center gap-1.5 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] uppercase text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface)]"
                          onClick={() => void handleCopyCoupon(row.couponCode, row.affiliateId)}
                          title="Copy coupon"
                        >
                          {row.couponCode || "—"}
                          {copiedCodeId === row.affiliateId ? (
                            <Check
                              className="h-3 w-3 text-[var(--admin-success)]"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy
                              className="h-3 w-3 text-[var(--admin-on-surface-variant)]"
                              aria-hidden="true"
                            />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-mono text-[var(--admin-on-surface)]">
                            {formatMoneyAmount(row.revenueContributionCents)}
                          </span>
                          <div className="hidden h-1.5 w-14 overflow-hidden rounded-full bg-[var(--admin-surface-high)] xl:flex">
                            <div
                              className="h-full rounded-full bg-[var(--admin-on-surface)]"
                              style={{ width: `${String(share)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[var(--admin-on-surface)]">
                        {formatMoneyAmount(row.commissionEarnedCents)}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {row.unpaidCents > 0 ? (
                          <span className="text-[var(--admin-warning)]">
                            {formatMoneyAmount(row.unpaidCents)}
                          </span>
                        ) : (
                          <span className="text-[var(--admin-on-surface-variant)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right font-mono text-[var(--admin-success)]">
                        {formatMoneyAmount(row.paidCents)}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                        {formatShortDate(row.signedUpAt)}
                      </td>
                      <td
                        className="relative px-2 py-2 text-right"
                        onClick={(event) => {
                          event.stopPropagation();
                        }}
                        data-row-menu
                      >
                        <div className="inline-flex items-center gap-0.5">
                          <button
                            type="button"
                            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                            aria-label="More actions"
                            onClick={() => {
                              setMenuOpenId((current) =>
                                current === row.affiliateId ? null : row.affiliateId,
                              );
                            }}
                          >
                            <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                            aria-label={`Open ${row.learnerName ?? "affiliate"} detail`}
                            onClick={() => {
                              openDrawer(row);
                            }}
                          >
                            <ChevronRight className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                        {menuOpenId === row.affiliateId ? (
                          <div className="absolute right-2 top-10 z-20 w-44 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                            <button
                              type="button"
                              className="flex w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                              onClick={() => {
                                openDrawer(row);
                              }}
                            >
                              View detail
                            </button>
                            <button
                              type="button"
                              className="flex w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                              disabled={row.unpaidCents <= 0}
                              onClick={() => {
                                openPayout(row);
                              }}
                            >
                              Record payout
                            </button>
                            {row.email ? (
                              <a
                                href={`mailto:${row.email}`}
                                className="flex w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                              >
                                Message
                              </a>
                            ) : null}
                            {!isSuspendedStatus(row.status) ? (
                              <button
                                type="button"
                                className="flex w-full px-3 py-2 text-left text-xs text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)]"
                                onClick={() => {
                                  openSuspend(row);
                                }}
                              >
                                Suspend
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-xs text-[var(--admin-on-surface-variant)]">
                  <td colSpan={5} className="px-4 py-3 font-medium">
                    Page totals
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoneyAmount(pageTotals.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono">
                    {formatMoneyAmount(pageTotals.earned)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--admin-warning)]">
                    {formatMoneyAmount(pageTotals.unpaid)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-[var(--admin-success)]">
                    {formatMoneyAmount(pageTotals.paid)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {pageInfo ? (
            <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
              <span>
                {pageInfo.totalCount.toLocaleString(viewer.locale)} affiliate
                {pageInfo.totalCount === 1 ? "" : "s"}
                {pageInfo.totalPages > 1
                  ? ` · Page ${String(pageInfo.page)} of ${String(pageInfo.totalPages)}`
                  : null}
              </span>
              {pageInfo.totalPages > 1 ? (
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded border border-[var(--admin-outline)] px-3 py-1.5 disabled:opacity-40"
                    disabled={!pageInfo.hasPreviousPage || loading}
                    onClick={() => {
                      setPage((prev) => Math.max(1, prev - 1));
                    }}
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    className="rounded border border-[var(--admin-outline)] px-3 py-1.5 disabled:opacity-40"
                    disabled={!pageInfo.hasNextPage || loading}
                    onClick={() => {
                      setPage((prev) => prev + 1);
                    }}
                  >
                    Next
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** One affiliate's earnings, referrals and payouts. */
export function AffiliateDrawer({ view }: { view: AdminAffiliatesView }) {
  const {
    activeAffiliateId,
    busy,
    closeDrawer,
    copiedCodeId,
    detail,
    detailError,
    detailLoading,
    drawerOpen,
    formatMoneyAmount,
    formatShortDate,
    handleCopyCoupon,
    loadDetail,
    maxTrend,
    openPayout,
    openSuspend,
  } = view;
  return (
    <>
      {drawerOpen && activeAffiliateId ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] backdrop-blur-[2px]"
            aria-label="Close affiliate detail"
            onClick={closeDrawer}
          />
          <aside
            className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="affiliate-detail-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div className="flex min-w-0 items-start gap-3">
                <InitialsAvatar
                  name={detail?.affiliate.learnerName ?? null}
                  email={detail?.affiliate.email ?? null}
                  size="lg"
                />
                <div className="min-w-0">
                  <h2
                    id="affiliate-detail-title"
                    className="truncate text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]"
                  >
                    {detail?.affiliate.learnerName ?? "Affiliate"}
                  </h2>
                  {detail?.affiliate.email ? (
                    <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                      {detail.affiliate.email}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {detail ? (
                      <>
                        <span
                          className={[
                            "inline-flex rounded px-2 py-0.5 text-[11px] font-medium",
                            statusPillClass(detail.affiliate.status),
                          ].join(" ")}
                        >
                          {statusLabel(detail.affiliate.status)}
                        </span>
                        <span
                          className={[
                            "inline-flex rounded px-2 py-0.5 text-[11px] font-medium",
                            tierPillClass(detail.affiliate.tier),
                          ].join(" ")}
                        >
                          {tierLabel(detail.affiliate.tier)}
                        </span>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded border border-[var(--admin-outline)] px-2 py-0.5 font-mono text-[11px] uppercase text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                          onClick={() =>
                            void handleCopyCoupon(
                              detail.affiliate.couponCode,
                              `drawer-${detail.affiliate.affiliateId}`,
                            )
                          }
                        >
                          {detail.affiliate.couponCode}
                          {copiedCodeId === `drawer-${detail.affiliate.affiliateId}` ? (
                            <Check
                              className="h-3 w-3 text-[var(--admin-success)]"
                              aria-hidden="true"
                            />
                          ) : (
                            <Copy className="h-3 w-3" aria-hidden="true" />
                          )}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              </div>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={closeDrawer}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {detailLoading ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Shimmer key={index} className="h-16 w-full" />
                    ))}
                  </div>
                  <Shimmer className="h-28 w-full" />
                  <Shimmer className="h-40 w-full" />
                </div>
              ) : detailError ? (
                <div className="rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] p-4 text-sm text-[var(--admin-danger)]">
                  {detailError}
                  <button
                    type="button"
                    className="mt-3 block text-xs font-medium underline"
                    onClick={() => void loadDetail(activeAffiliateId)}
                  >
                    Retry
                  </button>
                </div>
              ) : detail ? (
                <div className="space-y-6">
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        {
                          label: "Revenue",
                          value: formatMoneyAmount(detail.affiliate.revenueContributionCents),
                          tone: "text-[var(--admin-on-surface)]",
                        },
                        {
                          label: "Earned",
                          value: formatMoneyAmount(detail.affiliate.commissionEarnedCents),
                          tone: "text-[var(--admin-on-surface)]",
                        },
                        {
                          label: "Unpaid",
                          value: formatMoneyAmount(detail.affiliate.unpaidCents),
                          tone: "text-[var(--admin-warning)]",
                        },
                        {
                          label: "Paid",
                          value: formatMoneyAmount(detail.affiliate.paidCents),
                          tone: "text-[var(--admin-success)]",
                        },
                      ] as const
                    ).map((metric) => (
                      <div
                        key={metric.label}
                        className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3"
                      >
                        <p className="text-[11px] uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                          {metric.label}
                        </p>
                        <p
                          className={["mt-1 font-mono text-base font-semibold", metric.tone].join(
                            " ",
                          )}
                        >
                          {metric.value}
                          <span className="ml-1 text-[10px] font-normal opacity-70">
                            {detail.affiliate.currency}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>

                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Earnings over time
                    </h3>
                    {detail.earningsTrend.length === 0 ? (
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        No earnings yet.
                      </p>
                    ) : (
                      <div className="flex h-28 items-end gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-3">
                        {detail.earningsTrend.map((point) => {
                          const height =
                            maxTrend > 0
                              ? Math.max(6, Math.round((point.commissionCents / maxTrend) * 100))
                              : 6;
                          return (
                            <div
                              key={point.month}
                              className="group relative flex flex-1 flex-col items-center justify-end"
                              title={`${point.month}: ${formatMoneyAmount(point.commissionCents)}`}
                            >
                              <div
                                className="w-full rounded-t bg-[var(--admin-primary)] transition-opacity group-hover:opacity-80"
                                style={{ height: `${String(height)}%` }}
                              />
                              <span className="mt-1 truncate text-[9px] text-[var(--admin-on-surface-variant)]">
                                {point.month.slice(5) || point.month}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Attributed orders
                      {detail.ordersTotalCount > 0 ? (
                        <span className="ml-1 font-mono font-normal">
                          ({detail.ordersTotalCount})
                        </span>
                      ) : null}
                    </h3>
                    {detail.orders.length === 0 ? (
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        No attributed orders.
                      </p>
                    ) : (
                      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)]">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                            <tr>
                              <th className="px-3 py-2 font-medium">Product</th>
                              <th className="px-3 py-2 text-right font-medium">Order</th>
                              <th className="px-3 py-2 text-right font-medium">Commission</th>
                              <th className="px-3 py-2 font-medium">Date</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-[var(--admin-border)]">
                            {detail.orders.map((order) => (
                              <tr key={order.commissionId}>
                                <td className="max-w-[140px] truncate px-3 py-2 text-[var(--admin-on-surface)]">
                                  {order.productTitle}
                                </td>
                                <td className="px-3 py-2 text-right font-mono">
                                  {formatMoneyAmount(order.orderAmountCents)}
                                </td>
                                <td className="px-3 py-2 text-right font-mono text-[var(--admin-warning)]">
                                  {formatMoneyAmount(order.commissionCents)}
                                </td>
                                <td className="px-3 py-2 font-mono text-[var(--admin-on-surface-variant)]">
                                  {formatShortDate(order.createdAt)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>

                  <section>
                    <h3 className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                      Payout history
                    </h3>
                    {detail.payouts.length === 0 ? (
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">
                        No payouts recorded.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {detail.payouts.map((payout) => (
                          <li
                            key={payout.payoutId}
                            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-mono text-sm font-medium text-[var(--admin-success)]">
                                {formatMoneyAmount(payout.amountCents)} {payout.currency}
                              </span>
                              <span className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {formatShortDate(payout.paidAt)}
                              </span>
                            </div>
                            {payout.note ? (
                              <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                                {payout.note}
                              </p>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    )}
                  </section>
                </div>
              ) : null}
            </div>

            {detail ? (
              <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] px-5 py-4">
                {detail.affiliate.email ? (
                  <a
                    href={`mailto:${detail.affiliate.email}`}
                    className="inline-flex h-9 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                    Message
                  </a>
                ) : null}
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                  onClick={() =>
                    void handleCopyCoupon(
                      detail.affiliate.couponCode,
                      `footer-${detail.affiliate.affiliateId}`,
                    )
                  }
                >
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  Copy coupon
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-1.5 rounded bg-[var(--admin-primary-strong)] px-3 text-xs font-medium text-[var(--admin-on-primary)] disabled:opacity-50"
                  disabled={detail.affiliate.unpaidCents <= 0 || busy}
                  onClick={() => {
                    openPayout(detail.affiliate);
                  }}
                >
                  <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                  Record payout
                </button>
                {!isSuspendedStatus(detail.affiliate.status) ? (
                  <button
                    type="button"
                    className="ml-auto inline-flex h-9 items-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] px-3 text-xs text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)]"
                    onClick={() => {
                      openSuspend(detail.affiliate);
                    }}
                  >
                    Suspend
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}
    </>
  );
}

/** Record a payout to an affiliate. */
export function AffiliatePayoutModal({ view }: { view: AdminAffiliatesView }) {
  const {
    actionError,
    busy,
    confirmPayout,
    formatMoneyAmount,
    payoutDate,
    payoutMethod,
    payoutNotify,
    payoutReference,
    payoutTarget,
    setPayoutDate,
    setPayoutMethod,
    setPayoutNotify,
    setPayoutReference,
    setPayoutTarget,
  } = view;
  return (
    <>
      {payoutTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => {
            if (!busy) setPayoutTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-payout-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id="record-payout-title"
                className="pr-4 text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Record payout
              </h2>
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setPayoutTarget(null);
                }}
                aria-label="Close"
                disabled={busy}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-5 p-6">
              <div className="flex items-center gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
                <InitialsAvatar name={payoutTarget.learnerName} email={payoutTarget.email} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                    {payoutTarget.learnerName ?? "—"}
                  </p>
                  <p className="truncate text-xs text-[var(--admin-on-surface-variant)]">
                    {payoutTarget.email ?? ""}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">Unpaid balance</p>
                <p className="mt-1 font-mono text-2xl font-semibold text-[var(--admin-warning)]">
                  {formatMoneyAmount(payoutTarget.unpaidCents)}
                  <span className="ml-1.5 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                    {payoutTarget.currency}
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                  Full unpaid balance will be marked paid. Partial payouts are not supported.
                </p>
              </div>

              <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Method
                <input
                  value={payoutMethod}
                  onChange={(event) => {
                    setPayoutMethod(event.target.value);
                  }}
                  placeholder="Bank transfer, PayPal…"
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>

              <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Date
                <input
                  type="date"
                  value={payoutDate}
                  onChange={(event) => {
                    setPayoutDate(event.target.value);
                  }}
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>

              <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Reference
                <input
                  value={payoutReference}
                  onChange={(event) => {
                    setPayoutReference(event.target.value);
                  }}
                  placeholder="Transaction ID or memo"
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                <input
                  type="checkbox"
                  checked={payoutNotify}
                  onChange={(event) => {
                    setPayoutNotify(event.target.checked);
                  }}
                  className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                />
                Notify affiliate (informational — saved in payout note)
              </label>

              {actionError ? (
                <p className="text-sm text-[var(--admin-danger)]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded border border-[var(--admin-outline)] px-4 text-xs text-[var(--admin-on-surface)] disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setPayoutTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy || payoutTarget.unpaidCents <= 0}
                onClick={() => void confirmPayout()}
              >
                Confirm payout
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

/** Suspend or reinstate an affiliate. */
export function AffiliateSuspendModal({ view }: { view: AdminAffiliatesView }) {
  const {
    actionError,
    busy,
    confirmSuspend,
    setSuspendReason,
    setSuspendTarget,
    suspendReason,
    suspendTarget,
  } = view;
  return (
    <>
      {suspendTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => {
            if (!busy) setSuspendTarget(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-affiliate-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id="suspend-affiliate-title"
                className="pr-4 text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Suspend affiliate
              </h2>
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setSuspendTarget(null);
                }}
                aria-label="Close"
                disabled={busy}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]"
                  aria-hidden="true"
                />
                <p className="text-sm text-[var(--admin-on-surface)]">
                  Suspending{" "}
                  <span className="font-semibold">
                    {suspendTarget.learnerName ?? suspendTarget.email ?? "this affiliate"}
                  </span>{" "}
                  sets their status to inactive. Their coupon will stop attributing new commissions.
                </p>
              </div>
              <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Reason (optional)
                <textarea
                  value={suspendReason}
                  onChange={(event) => {
                    setSuspendReason(event.target.value);
                  }}
                  rows={3}
                  placeholder="Why is this affiliate being suspended?"
                  className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>
              {actionError ? (
                <p className="text-sm text-[var(--admin-danger)]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2 border-t border-[var(--admin-border)] px-6 py-4">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded border border-[var(--admin-outline)] px-4 text-xs text-[var(--admin-on-surface)] disabled:opacity-50"
                disabled={busy}
                onClick={() => {
                  setSuspendTarget(null);
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded bg-[var(--admin-danger)] px-4 text-xs font-medium text-[var(--admin-on-danger)] disabled:opacity-50"
                disabled={busy}
                onClick={() => void confirmSuspend()}
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
