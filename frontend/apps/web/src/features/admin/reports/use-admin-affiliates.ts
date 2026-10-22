"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ClientApiError } from "../../../lib/client-api";
import type { ReportInitialDataInRange } from "../../../lib/server/report-initial-data";
import {
  AFFILIATES_DEFAULTS,
  salesMarketingRangeBefore,
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchAffiliateDetail,
  fetchAffiliates,
  fetchPendingAffiliateRequests,
  recordAffiliatePayout,
  reviewAffiliateRequest,
  updateAffiliatePartner,
  type AffiliateDetailPayload,
  type AffiliateItem,
  type AffiliatePendingRequest,
  type AffiliatesPayload,
  type AffiliatesSummary,
} from "./admin-sales-marketing-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer } from "./viewer-time";
import {
  type StatusFilter,
  type TierFilter,
  type UnpaidBand,
  VIEW_TO_QUERY,
  type ViewTab,
  copyToClipboard,
  formatMoneyAmountFor,
  formatShortDateFor,
  tierLabel,
} from "./admin-affiliates-shared";

/** The state, data loading and handlers behind AdminAffiliatesPanel. */
export function useAdminAffiliates(props: {
  /**
   * The first page over the default 30 days of activity, loaded by the server
   * with the range it counted; the first browser load is skipped when present.
   */
  initialData?: ReportInitialDataInRange<AffiliatesPayload> | null | undefined;
}) {
  const { initialData } = props;
  const viewer = useViewerLocale();
  const formatMoneyAmount = withViewer(formatMoneyAmountFor, viewer);
  const formatShortDate = withViewer(formatShortDateFor, viewer);
  // Read once: later renders must not reset what the panel has changed since.
  const [initial] = useState(() => initialData ?? null);
  // The server's range when it loaded the panel, so both render the same
  // dates even if the clocks disagree or the day turned in between.
  const initialRange = useMemo(
    () => initial?.range ?? salesMarketingRangeBefore(AFFILIATES_DEFAULTS.rangeDays),
    [initial],
  );

  const [payload, setPayload] = useState<AffiliatesPayload | null>(initial?.data ?? null);
  const [loading, setLoading] = useState(initial === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activityFrom, setActivityFrom] = useState(initialRange.from);
  const [activityTo, setActivityTo] = useState(initialRange.to);

  const [viewTab, setViewTab] = useState<ViewTab>("all");

  const [searchQ, setSearchQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("all");
  const [tierFilter, setTierFilter] = useState<TierFilter>("any");
  const [draftTier, setDraftTier] = useState<TierFilter>("any");
  const [unpaidBand, setUnpaidBand] = useState<UnpaidBand>("any");
  const [draftUnpaidBand, setDraftUnpaidBand] = useState<UnpaidBand>("any");
  const [signedUpFrom, setSignedUpFrom] = useState("");
  const [draftSignedUpFrom, setDraftSignedUpFrom] = useState("");
  const [signedUpTo, setSignedUpTo] = useState("");
  const [draftSignedUpTo, setDraftSignedUpTo] = useState("");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);

  const [pendingItems, setPendingItems] = useState<AffiliatePendingRequest[]>([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeAffiliateId, setActiveAffiliateId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AffiliateDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [payoutTarget, setPayoutTarget] = useState<AffiliateItem | null>(null);
  const [payoutMethod, setPayoutMethod] = useState("");
  const [payoutDate, setPayoutDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [payoutReference, setPayoutReference] = useState("");
  const [payoutNotify, setPayoutNotify] = useState(true);

  const [suspendTarget, setSuspendTarget] = useState<AffiliateItem | null>(null);
  const [suspendReason, setSuspendReason] = useState("");

  const filtersActive =
    Boolean(searchQ.trim()) ||
    statusFilter !== "all" ||
    tierFilter !== "any" ||
    unpaidBand !== "any" ||
    Boolean(signedUpFrom) ||
    Boolean(signedUpTo) ||
    viewTab !== "all";

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
      setError(null);
      try {
        const response = await fetchAffiliates({
          q: searchQ.trim() || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          tier: tierFilter === "any" ? undefined : tierFilter,
          unpaidBand: unpaidBand === "any" ? undefined : unpaidBand,
          view: viewTab === "pending" ? "all" : VIEW_TO_QUERY[viewTab],
          activityFrom: dateInputToStartIso(activityFrom),
          activityTo: dateInputToEndIso(activityTo),
          signedUpFrom: dateInputToStartIso(signedUpFrom),
          signedUpTo: dateInputToEndIso(signedUpTo),
          sortBy: viewTab === "top" ? "commission_earned_cents" : undefined,
          sortDir: "desc",
          page: viewTab === "pending" ? 1 : page,
          limit: 25,
        });
        setPayload(response.data);
        if (viewTab !== "pending") {
          setSelectedIds(new Set());
        }
      } catch (loadError) {
        setPayload(null);
        setError(
          loadError instanceof ClientApiError
            ? loadError.message
            : loadError instanceof Error
              ? loadError.message
              : "Couldn't load affiliates.",
        );
      } finally {
        if (!soft) setLoading(false);
      }
    },
    [
      activityFrom,
      activityTo,
      page,
      searchQ,
      signedUpFrom,
      signedUpTo,
      statusFilter,
      tierFilter,
      unpaidBand,
      viewTab,
    ],
  );

  const loadPending = useCallback(async () => {
    setPendingLoading(true);
    setPendingError(null);
    try {
      const response = await fetchPendingAffiliateRequests();
      setPendingItems(response.data.items);
    } catch (loadError) {
      setPendingItems([]);
      setPendingError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load pending requests.",
      );
    } finally {
      setPendingLoading(false);
    }
  }, []);

  const loadDetail = useCallback(async (affiliateId: string) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetchAffiliateDetail(affiliateId);
      setDetail(response.data);
    } catch (loadError) {
      setDetail(null);
      setDetailError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load affiliate detail.",
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useReportLoad(load, initial);

  useEffect(() => {
    if (viewTab === "pending") {
      void loadPending();
    }
  }, [loadPending, viewTab]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => {
      setToast(null);
    }, 3200);
    return () => {
      window.clearTimeout(timer);
    };
  }, [toast]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDrawerOpen(false);
        setActiveAffiliateId(null);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!menuOpenId) return;
    function onPointer(event: Event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest("[data-row-menu]")) return;
      setMenuOpenId(null);
    }
    window.addEventListener("mousedown", onPointer);
    return () => {
      window.removeEventListener("mousedown", onPointer);
    };
  }, [menuOpenId]);

  const applyFilters = () => {
    setSearchQ(draftQ.trim());
    setStatusFilter(draftStatus);
    setTierFilter(draftTier);
    setUnpaidBand(draftUnpaidBand);
    setSignedUpFrom(draftSignedUpFrom);
    setSignedUpTo(draftSignedUpTo);
    setPage(1);
  };

  const clearFilters = () => {
    setDraftQ("");
    setSearchQ("");
    setDraftStatus("all");
    setStatusFilter("all");
    setDraftTier("any");
    setTierFilter("any");
    setDraftUnpaidBand("any");
    setUnpaidBand("any");
    setDraftSignedUpFrom("");
    setSignedUpFrom("");
    setDraftSignedUpTo("");
    setSignedUpTo("");
    setViewTab("all");
    setPage(1);
  };

  async function handleExport(affiliateIds?: string[]) {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "affiliates",
        q: searchQ.trim() || undefined,
        activityFrom: dateInputToStartIso(activityFrom),
        activityTo: dateInputToEndIso(activityTo),
        signedUpFrom: dateInputToStartIso(signedUpFrom),
        signedUpTo: dateInputToEndIso(signedUpTo),
        affiliateIds: affiliateIds?.length ? affiliateIds : undefined,
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
      setActionError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export report.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openDrawer(item: AffiliateItem) {
    setActiveAffiliateId(item.affiliateId);
    setDrawerOpen(true);
    setMenuOpenId(null);
    void loadDetail(item.affiliateId);
  }

  function closeDrawer() {
    setDrawerOpen(false);
    setActiveAffiliateId(null);
    setDetail(null);
    setDetailError(null);
  }

  function openPayout(item: AffiliateItem | null) {
    const target =
      item ??
      items.find((row) => selectedIds.has(row.affiliateId) && row.unpaidCents > 0) ??
      items.find((row) => row.unpaidCents > 0) ??
      null;
    if (!target) {
      setToast("No unpaid commission to record.");
      return;
    }
    if (target.unpaidCents <= 0) {
      setToast("This affiliate has no unpaid balance.");
      return;
    }
    setPayoutTarget(target);
    setPayoutMethod("");
    setPayoutDate(new Date().toISOString().slice(0, 10));
    setPayoutReference("");
    setPayoutNotify(true);
    setActionError(null);
    setMenuOpenId(null);
  }

  function openSuspend(item: AffiliateItem) {
    setSuspendTarget(item);
    setSuspendReason("");
    setActionError(null);
    setMenuOpenId(null);
  }

  async function confirmPayout() {
    if (!payoutTarget) return;
    setBusy(true);
    setActionError(null);
    try {
      const noteParts = [
        payoutMethod.trim() ? `Method: ${payoutMethod.trim()}` : null,
        payoutDate.trim() ? `Date: ${payoutDate.trim()}` : null,
        payoutReference.trim() ? `Reference: ${payoutReference.trim()}` : null,
        payoutNotify ? "Notify: yes" : "Notify: no",
      ].filter(Boolean);
      await recordAffiliatePayout({
        affiliateId: payoutTarget.affiliateId,
        note: noteParts.length ? noteParts.join(" · ") : null,
      });
      setPayoutTarget(null);
      setToast("Payout recorded.");
      await load();
      if (activeAffiliateId === payoutTarget.affiliateId) {
        await loadDetail(payoutTarget.affiliateId);
      }
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not record payout.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmSuspend() {
    if (!suspendTarget) return;
    setBusy(true);
    setActionError(null);
    try {
      await updateAffiliatePartner(suspendTarget.affiliateId, { status: "INACTIVE" });
      setSuspendTarget(null);
      setToast(
        suspendReason.trim()
          ? `Affiliate suspended. Reason noted locally: ${suspendReason.trim()}`
          : "Affiliate suspended.",
      );
      await load();
      if (activeAffiliateId === suspendTarget.affiliateId) {
        await loadDetail(suspendTarget.affiliateId);
      }
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not suspend affiliate.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleReview(requestId: string, action: "approve" | "reject") {
    setBusy(true);
    setActionError(null);
    try {
      await reviewAffiliateRequest(requestId, action);
      setToast(action === "approve" ? "Affiliate approved." : "Request declined.");
      await loadPending();
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not review request.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopyCoupon(code: string, id: string) {
    const ok = await copyToClipboard(code);
    if (ok) {
      setCopiedCodeId(id);
      window.setTimeout(() => {
        setCopiedCodeId(null);
      }, 1800);
    } else {
      setToast("Couldn't copy coupon.");
    }
  }

  const summary: AffiliatesSummary | null = payload?.summary ?? null;
  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const maxRevenue = useMemo(
    () => items.reduce((max, row) => Math.max(max, row.revenueContributionCents), 0),
    [items],
  );

  const isEmpty =
    viewTab !== "pending" &&
    !loading &&
    !error &&
    payload != null &&
    pageInfo != null &&
    pageInfo.totalCount === 0;
  const isTrulyEmpty = isEmpty && !filtersActive && (summary?.totalCount ?? 0) === 0;
  const isFilteredEmpty = isEmpty && !isTrulyEmpty;

  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.affiliateId));
  const selectedItems = items.filter((item) => selectedIds.has(item.affiliateId));
  const selectedCount = selectedIds.size;
  const selectedUnpaidCents = selectedItems.reduce((sum, row) => sum + row.unpaidCents, 0);
  const currency = summary?.currency ?? items[0]?.currency ?? "USD";

  const pageTotals = useMemo(() => {
    return items.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenueContributionCents,
        earned: acc.earned + row.commissionEarnedCents,
        unpaid: acc.unpaid + row.unpaidCents,
        paid: acc.paid + row.paidCents,
      }),
      { revenue: 0, earned: 0, unpaid: 0, paid: 0 },
    );
  }, [items]);

  const maxTrend = useMemo(() => {
    if (!detail?.earningsTrend.length) return 0;
    return detail.earningsTrend.reduce((max, point) => Math.max(max, point.commissionCents), 0);
  }, [detail]);

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (statusFilter !== "all") {
      chips.push({
        key: "status",
        label: `Status: ${statusFilter === "ACTIVE" ? "Active" : "Suspended"}`,
      });
    }
    if (tierFilter !== "any") {
      chips.push({ key: "tier", label: `Tier: ${tierLabel(tierFilter)}` });
    }
    if (unpaidBand !== "any") {
      const labels: Record<Exclude<UnpaidBand, "any">, string> = {
        has_unpaid: "Has unpaid",
        zero: "Zero unpaid",
        above_1000: "Unpaid above 1,000",
      };
      chips.push({ key: "unpaid", label: `Unpaid: ${labels[unpaidBand]}` });
    }
    if (signedUpFrom || signedUpTo) {
      chips.push({
        key: "signed",
        label: `Signed up: ${signedUpFrom || "…"} → ${signedUpTo || "…"}`,
      });
    }
    if (searchQ.trim()) chips.push({ key: "search", label: `Search: ${searchQ.trim()}` });
    return chips;
  }, [searchQ, signedUpFrom, signedUpTo, statusFilter, tierFilter, unpaidBand]);

  return {
    viewer,
    formatMoneyAmount,
    formatShortDate,
    payload,
    loading,
    busy,
    error,
    actionError,
    toast,
    activityFrom,
    setActivityFrom,
    activityTo,
    setActivityTo,
    viewTab,
    setViewTab,
    draftQ,
    setDraftQ,
    draftStatus,
    setDraftStatus,
    draftTier,
    setDraftTier,
    draftUnpaidBand,
    setDraftUnpaidBand,
    draftSignedUpFrom,
    setDraftSignedUpFrom,
    draftSignedUpTo,
    setDraftSignedUpTo,
    setPage,
    selectedIds,
    setSelectedIds,
    menuOpenId,
    setMenuOpenId,
    copiedCodeId,
    pendingItems,
    pendingLoading,
    pendingError,
    drawerOpen,
    activeAffiliateId,
    detail,
    detailLoading,
    detailError,
    payoutTarget,
    setPayoutTarget,
    payoutMethod,
    setPayoutMethod,
    payoutDate,
    setPayoutDate,
    payoutReference,
    setPayoutReference,
    payoutNotify,
    setPayoutNotify,
    suspendTarget,
    setSuspendTarget,
    suspendReason,
    setSuspendReason,
    load,
    loadPending,
    loadDetail,
    applyFilters,
    clearFilters,
    handleExport,
    openDrawer,
    closeDrawer,
    openPayout,
    openSuspend,
    confirmPayout,
    confirmSuspend,
    handleReview,
    handleCopyCoupon,
    summary,
    items,
    pageInfo,
    maxRevenue,
    isEmpty,
    isTrulyEmpty,
    isFilteredEmpty,
    allOnPageSelected,
    selectedCount,
    selectedUnpaidCents,
    currency,
    pageTotals,
    maxTrend,
    filterChips,
  };
}

export type AdminAffiliatesView = ReturnType<typeof useAdminAffiliates>;
