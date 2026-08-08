"use client";

import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  Check,
  ChevronRight,
  Copy,
  Download,
  Mail,
  MoreHorizontal,
  RefreshCw,
  Search,
  Settings,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import { AFFILIATES_HREF } from "../grow/affiliates-shared";
import {
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
import {
  downloadReportExport,
  pollReportRunUntilComplete,
} from "./admin-reports-api";

type StatusFilter = "all" | "ACTIVE" | "INACTIVE";
type TierFilter = "any" | "STANDARD" | "PREMIUM";
type UnpaidBand = "any" | "has_unpaid" | "zero" | "above_1000";
type ViewTab = "all" | "owed" | "pending" | "top" | "suspended";

const VIEW_TO_QUERY: Record<Exclude<ViewTab, "pending">, string> = {
  all: "all",
  owed: "owed",
  top: "top",
  suspended: "suspended",
};

function defaultActivityRange(days = 30): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

function formatMoneyAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function initials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function isSuspendedStatus(status: string): boolean {
  return status.toUpperCase() === "INACTIVE" || status.toUpperCase() === "SUSPENDED";
}

function statusLabel(status: string): string {
  if (isSuspendedStatus(status)) return "Suspended";
  if (status.toUpperCase() === "ACTIVE") return "Active";
  return status.charAt(0).toUpperCase() + status.slice(1).toLowerCase();
}

function statusPillClass(status: string): string {
  if (isSuspendedStatus(status)) {
    return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]";
  }
  if (status.toUpperCase() === "ACTIVE") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function tierPillClass(tier: string): string {
  if (tier.toUpperCase() === "PREMIUM") {
    return "bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function tierLabel(tier: string): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1).toLowerCase();
}

async function copyToClipboard(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    return false;
  }
}

function Shimmer({ className }: { className?: string }) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded bg-[var(--admin-surface-high)]",
        "after:absolute after:inset-0 after:-translate-x-full after:animate-[shimmer_1.8s_infinite]",
        "after:bg-gradient-to-r after:from-transparent after:via-[color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)] after:to-transparent",
        className ?? "",
      ].join(" ")}
    />
  );
}

function AffiliatesSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading affiliates">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-44" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={[
              "bg-[var(--admin-surface)] p-4",
              index === 0 ? "col-span-2 sm:col-span-1 lg:col-span-2" : "",
            ].join(" ")}
          >
            <Shimmer className="mb-3 h-3 w-24" />
            <Shimmer className="h-8 w-28" />
            <Shimmer className="mt-2 h-3 w-32" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-40" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-4 px-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-8 w-8 rounded-full" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InitialsAvatar({
  name,
  email,
  size = "md",
}: {
  name: string | null;
  email: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg" ? "h-12 w-12 text-sm" : size === "sm" ? "h-7 w-7 text-[10px]" : "h-8 w-8 text-xs";
  return (
    <div
      className={[
        "flex shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono font-semibold text-[var(--admin-on-surface-variant)]",
        sizeClass,
      ].join(" ")}
      aria-hidden="true"
    >
      {initials(name, email)}
    </div>
  );
}

export function AdminAffiliatesPanel() {
  const initialRange = useMemo(() => defaultActivityRange(30), []);

  const [payload, setPayload] = useState<AffiliatesPayload | null>(null);
  const [loading, setLoading] = useState(true);
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

  const load = useCallback(async () => {
    setLoading(true);
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
      setLoading(false);
    }
  }, [
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
  ]);

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

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (viewTab === "pending") {
      void loadPending();
    }
  }, [loadPending, viewTab]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
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
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  useEffect(() => {
    if (!menuOpenId) return;
    function onPointer(event: Event) {
      const target = event.target as HTMLElement | null;
      if (target?.closest?.("[data-row-menu]")) return;
      setMenuOpenId(null);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
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
      window.setTimeout(() => setCopiedCodeId(null), 1800);
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
  const isTrulyEmpty =
    isEmpty && !filtersActive && (summary?.totalCount ?? 0) === 0;
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
            <CalendarDays className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
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
            onClick={() => openPayout(null)}
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
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" aria-hidden="true" />
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
                  across {summary.unpaidAffiliateCount.toLocaleString()} affiliate
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
                  {summary.activeCount.toLocaleString()}
                  <span className="ml-1 text-xs font-normal text-[var(--admin-on-surface-variant)]">
                    of {summary.totalCount.toLocaleString()}
                  </span>
                </p>
                <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                  {summary.pendingApprovalCount.toLocaleString()} pending approval
                </p>
              </div>
            </div>
          ) : null}

          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:flex-wrap">
              <label className="relative min-w-0 flex-1 max-w-sm">
                <span className="sr-only">Search affiliates</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                <input
                  className="h-9 w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  placeholder="Name, email, or coupon"
                  value={draftQ}
                  onChange={(event) => setDraftQ(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters();
                  }}
                />
              </label>

              <div className="w-full sm:w-40">
                <Select
                  ariaLabel="Status"
                  value={draftStatus}
                  onValueChange={(value) => setDraftStatus(value as StatusFilter)}
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
                  onValueChange={(value) => setDraftTier(value as TierFilter)}
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
                  onValueChange={(value) => setDraftUnpaidBand(value as UnpaidBand)}
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
                  onChange={(event) => setDraftSignedUpFrom(event.target.value)}
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  aria-label="Signed up from"
                />
              </label>

              <label className="flex flex-col gap-1">
                <span className="sr-only">Signed up to</span>
                <input
                  type="date"
                  value={draftSignedUpTo}
                  onChange={(event) => setDraftSignedUpTo(event.target.value)}
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
                tab.key === "pending" ? (summary?.pendingApprovalCount ?? pendingItems.length) : null;
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
                  <Users className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
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

          {viewTab !== "pending" && isTrulyEmpty ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                <Users className="h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
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
              <Search className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
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
                          onClick={() => openDrawer(row)}
                        >
                          <td
                            className="px-4 text-center"
                            onClick={(event) => event.stopPropagation()}
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
                            onClick={(event) => event.stopPropagation()}
                          >
                            <button
                              type="button"
                              className="inline-flex items-center gap-1.5 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-[11px] uppercase text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface)]"
                              onClick={() => void handleCopyCoupon(row.couponCode, row.affiliateId)}
                              title="Copy coupon"
                            >
                              {row.couponCode || "—"}
                              {copiedCodeId === row.affiliateId ? (
                                <Check className="h-3 w-3 text-[var(--admin-success)]" aria-hidden="true" />
                              ) : (
                                <Copy className="h-3 w-3 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
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
                                  style={{ width: `${share}%` }}
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
                            onClick={(event) => event.stopPropagation()}
                            data-row-menu
                          >
                            <div className="inline-flex items-center gap-0.5">
                              <button
                                type="button"
                                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                                aria-label="More actions"
                                onClick={() =>
                                  setMenuOpenId((current) =>
                                    current === row.affiliateId ? null : row.affiliateId,
                                  )
                                }
                              >
                                <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                              </button>
                              <button
                                type="button"
                                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                                aria-label={`Open ${row.learnerName ?? "affiliate"} detail`}
                                onClick={() => openDrawer(row)}
                              >
                                <ChevronRight className="h-4 w-4" aria-hidden="true" />
                              </button>
                            </div>
                            {menuOpenId === row.affiliateId ? (
                              <div className="absolute right-2 top-10 z-20 w-44 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg">
                                <button
                                  type="button"
                                  className="flex w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => openDrawer(row)}
                                >
                                  View detail
                                </button>
                                <button
                                  type="button"
                                  className="flex w-full px-3 py-2 text-left text-xs text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
                                  disabled={row.unpaidCents <= 0}
                                  onClick={() => openPayout(row)}
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
                                    onClick={() => openSuspend(row)}
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
                    {pageInfo.totalCount.toLocaleString()} affiliate
                    {pageInfo.totalCount === 1 ? "" : "s"}
                    {pageInfo.totalPages > 1
                      ? ` · Page ${pageInfo.page} of ${pageInfo.totalPages}`
                      : null}
                  </span>
                  {pageInfo.totalPages > 1 ? (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded border border-[var(--admin-outline)] px-3 py-1.5 disabled:opacity-40"
                        disabled={!pageInfo.hasPreviousPage || loading}
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        className="rounded border border-[var(--admin-outline)] px-3 py-1.5 disabled:opacity-40"
                        disabled={!pageInfo.hasNextPage || loading}
                        onClick={() => setPage((prev) => prev + 1)}
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
              onClick={() => openPayout(null)}
            >
              <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
              Record payout
            </button>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded border border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
              aria-label="Clear selection"
              onClick={() => setSelectedIds(new Set())}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}

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
                            <Check className="h-3 w-3 text-[var(--admin-success)]" aria-hidden="true" />
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
                        <p className={["mt-1 font-mono text-base font-semibold", metric.tone].join(" ")}>
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
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">No earnings yet.</p>
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
                                style={{ height: `${height}%` }}
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
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">No attributed orders.</p>
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
                      <p className="text-sm text-[var(--admin-on-surface-variant)]">No payouts recorded.</p>
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
                  onClick={() => openPayout(detail.affiliate)}
                >
                  <Banknote className="h-3.5 w-3.5" aria-hidden="true" />
                  Record payout
                </button>
                {!isSuspendedStatus(detail.affiliate.status) ? (
                  <button
                    type="button"
                    className="ml-auto inline-flex h-9 items-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_40%,var(--admin-outline))] px-3 text-xs text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)]"
                    onClick={() => openSuspend(detail.affiliate)}
                  >
                    Suspend
                  </button>
                ) : null}
              </div>
            ) : null}
          </aside>
        </div>
      ) : null}

      {payoutTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => !busy && setPayoutTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="record-payout-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => event.stopPropagation()}
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
                onClick={() => setPayoutTarget(null)}
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
                  onChange={(event) => setPayoutMethod(event.target.value)}
                  placeholder="Bank transfer, PayPal…"
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>

              <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Date
                <input
                  type="date"
                  value={payoutDate}
                  onChange={(event) => setPayoutDate(event.target.value)}
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>

              <label className="grid gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                Reference
                <input
                  value={payoutReference}
                  onChange={(event) => setPayoutReference(event.target.value)}
                  placeholder="Transaction ID or memo"
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>

              <label className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                <input
                  type="checkbox"
                  checked={payoutNotify}
                  onChange={(event) => setPayoutNotify(event.target.checked)}
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
                onClick={() => setPayoutTarget(null)}
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

      {suspendTarget ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => !busy && setSuspendTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="suspend-affiliate-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => event.stopPropagation()}
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
                onClick={() => setSuspendTarget(null)}
                aria-label="Close"
                disabled={busy}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-start gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] p-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-warning)]" aria-hidden="true" />
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
                  onChange={(event) => setSuspendReason(event.target.value)}
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
                onClick={() => setSuspendTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-9 items-center rounded bg-[var(--admin-danger)] px-4 text-xs font-medium text-[var(--admin-on-primary)] disabled:opacity-50"
                disabled={busy}
                onClick={() => void confirmSuspend()}
              >
                Suspend
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
