"use client";

import {
  AlertTriangle,
  BookOpen,
  Copy,
  Download,
  ExternalLink,
  Mail,
  RefreshCw,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import { couponEditHref } from "../grow/coupons-shared";
import {
  createSalesMarketingGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchCouponRedemptions,
  sendSalesMarketingMessage,
  type CouponRedemptionItem,
  type CouponRedemptionsPayload,
  type CouponRedemptionsSortBy,
} from "./admin-sales-marketing-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type Props = { couponId: string };

type CohortTab = "group" | "message";
type MembershipMode = "static" | "live";

const SORT_OPTIONS: Array<{ value: CouponRedemptionsSortBy; label: string }> = [
  { value: "applied_at", label: "Applied date" },
  { value: "final_amount_cents", label: "Final amount" },
  { value: "discount_cents", label: "Discount" },
  { value: "learner_name", label: "Learner name" },
];

function formatMoneyAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatShortDate(iso: string): string {
  const date = new Date(iso.includes("T") ? iso : `${iso}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatAbsoluteDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = date.getTime() - Date.now();
  const absMs = Math.abs(diffMs);
  const minutes = Math.round(absMs / 60_000);
  const hours = Math.round(absMs / 3_600_000);
  const days = Math.round(absMs / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  if (minutes < 60) return rtf.format(Math.sign(diffMs) * Math.max(1, minutes), "minute");
  if (hours < 48) return rtf.format(Math.sign(diffMs) * hours, "hour");
  if (days < 60) return rtf.format(Math.sign(diffMs) * days, "day");
  return rtf.format(Math.sign(diffMs) * Math.round(days / 30), "month");
}

function initials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function discountLabel(type: string, value: number, currency: string): string {
  if (type.toUpperCase() === "PERCENT") {
    return `${String(value)}% OFF`;
  }
  return `${formatMoneyAmount(value)} ${currency} OFF`;
}

function statusPillClass(displayStatus: string): string {
  const normalized = displayStatus.toUpperCase();
  if (normalized === "ACTIVE") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (normalized === "CAP_REACHED") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function statusLabel(displayStatus: string): string {
  return displayStatus.replace(/_/g, " ");
}

function usagePercent(redemptionCount: number, totalUsageLimit: number | null): number {
  if (totalUsageLimit == null || totalUsageLimit <= 0) {
    return redemptionCount > 0 ? 12 : 0;
  }
  return Math.min(100, Math.round((redemptionCount / totalUsageLimit) * 100));
}

function parseAmountToCents(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number.parseFloat(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0) return undefined;
  return Math.round(parsed * 100);
}

function shortOrderRef(item: CouponRedemptionItem): string {
  const raw = item.invoiceNumber || item.paymentOrderId || "";
  if (!raw) return "—";
  return item.invoiceNumber ? raw : `#${raw.slice(0, 8)}`;
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

function RedemptionsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading coupon redemptions">
      <Shimmer className="h-3 w-80 max-w-full" />
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-64 max-w-full" />
          <div className="flex gap-2">
            <Shimmer className="h-5 w-16" />
            <Shimmer className="h-5 w-24" />
            <Shimmer className="h-5 w-28" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="bg-[var(--admin-surface)] p-4">
            <Shimmer className="mb-3 h-3 w-20" />
            <Shimmer className="h-8 w-24" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-[58fr_42fr]">
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-4 h-4 w-40" />
          <Shimmer className="h-40 w-full" />
        </div>
        <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <Shimmer className="mb-4 h-4 w-44" />
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Shimmer key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
        </div>
        <div className="divide-y divide-[var(--admin-border)]">
          {Array.from({ length: 8 }).map((_, index) => (
            <div key={index} className="flex h-11 items-center gap-4 px-4">
              <Shimmer className="h-4 w-4" />
              <Shimmer className="h-7 w-7 rounded-full" />
              <Shimmer className="h-4 flex-1" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-4 w-24" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function RedemptionsTrendChart({
  trend,
  endsAt,
  currency,
}: {
  trend: CouponRedemptionsPayload["trend"];
  endsAt: string | null;
  currency: string;
}) {
  if (trend.length === 0) {
    return (
      <p className="flex min-h-[180px] items-center justify-center text-sm text-[var(--admin-on-surface-variant)]">
        No redemption activity in this period.
      </p>
    );
  }

  const maxCount = Math.max(...trend.map((point) => point.redemptionCount), 1);
  const maxRevenue = Math.max(...trend.map((point) => point.revenueCents), 1);
  const peakIndex = trend.reduce(
    (best, point, index) =>
      point.redemptionCount > defined(trend[best]).redemptionCount ? index : best,
    0,
  );

  const chartWidth = 100;
  const chartHeight = 80;
  const padding = 4;
  const innerWidth = chartWidth - padding * 2;
  const innerHeight = chartHeight - padding * 2;

  const linePoints = trend.map((point, index) => {
    const x = padding + (index / Math.max(trend.length - 1, 1)) * innerWidth;
    const y = padding + innerHeight - (point.revenueCents / maxRevenue) * innerHeight;
    return `${String(x)},${String(y)}`;
  });

  let expiryIndex: number | null = null;
  if (endsAt) {
    const expiryDate = new Date(endsAt);
    if (!Number.isNaN(expiryDate.getTime())) {
      const expiryDay = expiryDate.toISOString().slice(0, 10);
      const idx = trend.findIndex((point) => point.date.slice(0, 10) === expiryDay);
      if (idx >= 0) expiryIndex = idx;
      else {
        const first = defined(trend[0]).date.slice(0, 10);
        const last = defined(trend[trend.length - 1]).date.slice(0, 10);
        if (expiryDay >= first && expiryDay <= last) {
          expiryIndex = Math.round(
            ((trend.length - 1) * (new Date(expiryDay).getTime() - new Date(first).getTime())) /
              Math.max(new Date(last).getTime() - new Date(first).getTime(), 1),
          );
        }
      }
    }
  }

  return (
    <div className="relative">
      <div className="flex h-44 items-end gap-1 px-1">
        {trend.map((point, index) => {
          const heightPct = Math.max(4, Math.round((point.redemptionCount / maxCount) * 100));
          const isPeak = index === peakIndex && point.redemptionCount > 0;
          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
              title={`${formatShortDate(point.date)}: ${String(point.redemptionCount)} redemptions, ${formatMoneyAmount(point.revenueCents)} ${currency}`}
            >
              <div
                className={[
                  "w-full max-w-[28px] rounded-t transition-colors",
                  isPeak
                    ? "bg-[var(--admin-primary)]"
                    : "bg-[color-mix(in_srgb,var(--admin-primary)_35%,var(--admin-surface-high))]",
                ].join(" ")}
                style={{ height: `${String(heightPct)}%` }}
              />
            </div>
          );
        })}
      </div>
      <svg
        viewBox={`0 0 ${String(chartWidth)} ${String(chartHeight)}`}
        className="pointer-events-none absolute inset-x-0 bottom-6 h-36 w-full px-1"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <polyline
          fill="none"
          stroke="var(--admin-accent, var(--admin-success))"
          strokeWidth="1.5"
          strokeLinejoin="round"
          points={linePoints.join(" ")}
        />
        {expiryIndex != null ? (
          <>
            <line
              x1={padding + (expiryIndex / Math.max(trend.length - 1, 1)) * innerWidth}
              y1={padding}
              x2={padding + (expiryIndex / Math.max(trend.length - 1, 1)) * innerWidth}
              y2={chartHeight - padding}
              stroke="var(--admin-warning)"
              strokeWidth="1"
              strokeDasharray="3 2"
            />
          </>
        ) : null}
      </svg>
      {expiryIndex != null ? (
        <p className="mt-2 text-center font-mono text-[10px] uppercase tracking-wider text-[var(--admin-warning)]">
          Expiry
        </p>
      ) : null}
      <div className="mt-3 flex justify-between font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
        <span>{formatShortDate(defined(trend[0]).date)}</span>
        <span>{formatShortDate(defined(trend[trend.length - 1]).date)}</span>
      </div>
    </div>
  );
}

export function AdminCouponRedemptionsPanel({ couponId }: Props) {
  const [payload, setPayload] = useState<CouponRedemptionsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [courseFilterId, setCourseFilterId] = useState("");
  const [draftCourseId, setDraftCourseId] = useState("");
  const [appliedFrom, setAppliedFrom] = useState("");
  const [appliedTo, setAppliedTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [draftMinAmount, setDraftMinAmount] = useState("");
  const [draftMaxAmount, setDraftMaxAmount] = useState("");
  const [sortBy, setSortBy] = useState<CouponRedemptionsSortBy>("applied_at");
  const [draftSortBy, setDraftSortBy] = useState<CouponRedemptionsSortBy>("applied_at");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cohortTab, setCohortTab] = useState<CohortTab>("group");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [membershipMode, setMembershipMode] = useState<MembershipMode>("static");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const filtersActive = useMemo(
    () =>
      Boolean(searchQ.trim()) ||
      Boolean(courseFilterId) ||
      Boolean(appliedFrom) ||
      Boolean(appliedTo) ||
      Boolean(minAmount.trim()) ||
      Boolean(maxAmount.trim()) ||
      sortBy !== "applied_at",
    [appliedFrom, appliedTo, courseFilterId, maxAmount, minAmount, searchQ, sortBy],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchCouponRedemptions(couponId, {
        q: searchQ.trim() || undefined,
        courseId: courseFilterId || undefined,
        appliedFrom: dateInputToStartIso(appliedFrom),
        appliedTo: dateInputToEndIso(appliedTo),
        minFinalAmountCents: parseAmountToCents(minAmount),
        maxFinalAmountCents: parseAmountToCents(maxAmount),
        sortBy,
        sortDir: "desc",
        page,
        limit: 25,
      });
      setPayload(response.data);
    } catch (loadError) {
      setPayload(null);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load coupon redemptions.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    appliedFrom,
    appliedTo,
    couponId,
    courseFilterId,
    maxAmount,
    minAmount,
    page,
    searchQ,
    sortBy,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  useEffect(() => {
    if (!drawerOpen || !payload) return;
    setGroupName(`Redemptions — ${payload.code}`);
    setGroupDescription("");
    setMembershipMode("static");
    setMessageSubject("");
    setMessageBody("");
    setActionError(null);
    setCohortTab("group");
  }, [drawerOpen, payload]);

  function applyFilters() {
    setSearchQ(draftQ);
    setCourseFilterId(draftCourseId);
    setAppliedFrom(draftFrom);
    setAppliedTo(draftTo);
    setMinAmount(draftMinAmount);
    setMaxAmount(draftMaxAmount);
    setSortBy(draftSortBy);
    setPage(1);
    setSelectedIds(new Set());
  }

  function clearAllFilters() {
    setDraftQ("");
    setDraftCourseId("");
    setDraftFrom("");
    setDraftTo("");
    setDraftMinAmount("");
    setDraftMaxAmount("");
    setDraftSortBy("applied_at");
    setSearchQ("");
    setCourseFilterId("");
    setAppliedFrom("");
    setAppliedTo("");
    setMinAmount("");
    setMaxAmount("");
    setSortBy("applied_at");
    setPage(1);
    setSelectedIds(new Set());
  }

  function toggleSelectAllOnPage(items: CouponRedemptionItem[]) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = items.length > 0 && items.every((item) => next.has(item.membershipId));
      if (allSelected) {
        for (const item of items) next.delete(item.membershipId);
      } else {
        for (const item of items) next.add(item.membershipId);
      }
      return next;
    });
  }

  function toggleRow(membershipId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(membershipId)) next.delete(membershipId);
      else next.add(membershipId);
      return next;
    });
  }

  function openDrawer(tab: CohortTab) {
    setCohortTab(tab);
    setDrawerOpen(true);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "coupons",
        couponId,
        q: searchQ.trim() || undefined,
        courseId: courseFilterId || undefined,
        appliedFrom: dateInputToStartIso(appliedFrom),
        appliedTo: dateInputToEndIso(appliedTo),
        minFinalAmountCents: parseAmountToCents(minAmount),
        maxFinalAmountCents: parseAmountToCents(maxAmount),
        sortBy,
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
      setError(
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

  async function handleCreateGroup() {
    if (!payload || !groupName.trim() || membershipMode === "live") return;
    setBusy(true);
    setActionError(null);
    try {
      const selected = [...selectedIds];
      await createSalesMarketingGroup({
        couponId,
        title: groupName.trim(),
        ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
        ...(selected.length > 0
          ? { membershipIds: selected }
          : {
              ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
              appliedFrom: dateInputToStartIso(appliedFrom),
              appliedTo: dateInputToEndIso(appliedTo),
              ...(courseFilterId ? { courseFilterId } : {}),
            }),
      });
      setDrawerOpen(false);
    } catch (groupError) {
      setActionError(
        groupError instanceof ClientApiError
          ? groupError.message
          : groupError instanceof Error
            ? groupError.message
            : "Unable to create group.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleSendMessage() {
    if (!messageSubject.trim() || !messageBody.trim()) return;
    setBusy(true);
    setActionError(null);
    try {
      const selected = [...selectedIds];
      await sendSalesMarketingMessage({
        couponId,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        ...(selected.length > 0
          ? { membershipIds: selected }
          : {
              ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
              appliedFrom: dateInputToStartIso(appliedFrom),
              appliedTo: dateInputToEndIso(appliedTo),
              ...(courseFilterId ? { courseFilterId } : {}),
            }),
      });
      setDrawerOpen(false);
    } catch (messageError) {
      setActionError(
        messageError instanceof ClientApiError
          ? messageError.message
          : messageError instanceof Error
            ? messageError.message
            : "Unable to send message.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleCopy(value: string, key: string) {
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedKey(key);
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current));
      }, 1500);
    }
  }

  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const summary = payload?.summary;
  const products = payload?.products ?? [];
  const trend = payload?.trend ?? [];

  const pageTotal = useMemo(
    () => items.reduce((sum, item) => sum + item.finalAmountCents, 0),
    [items],
  );

  const selectedTotal = useMemo(() => {
    if (selectedIds.size === 0) return 0;
    return items
      .filter((item) => selectedIds.has(item.membershipId))
      .reduce((sum, item) => sum + item.finalAmountCents, 0);
  }, [items, selectedIds]);

  const productOptions = useMemo(
    () => [
      { value: "", label: "All products" },
      ...products.map((product) => ({
        value: product.courseId ?? "",
        label: product.productTitle,
      })),
    ],
    [products],
  );

  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (searchQ.trim()) chips.push(`Search: ${searchQ.trim()}`);
    if (courseFilterId) {
      const product = products.find((p) => p.courseId === courseFilterId);
      chips.push(product?.productTitle ?? "Product filter");
    }
    if (appliedFrom || appliedTo) {
      chips.push(`Applied: ${appliedFrom || "…"} – ${appliedTo || "…"}`);
    }
    if (minAmount.trim()) chips.push(`Min: ${minAmount}`);
    if (maxAmount.trim()) chips.push(`Max: ${maxAmount}`);
    if (sortBy !== "applied_at") {
      chips.push(`Sort: ${SORT_OPTIONS.find((o) => o.value === sortBy)?.label ?? sortBy}`);
    }
    return chips;
  }, [appliedFrom, appliedTo, courseFilterId, maxAmount, minAmount, products, searchQ, sortBy]);

  const isTrulyEmpty =
    !loading && !error && payload != null && payload.redemptionCount === 0 && !filtersActive;
  const isFilteredEmpty =
    !loading &&
    !error &&
    payload != null &&
    pageInfo?.totalCount === 0 &&
    items.length === 0 &&
    filtersActive;

  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.membershipId));
  const selectedCount = selectedIds.size;
  const matchCount = selectedCount > 0 ? selectedCount : (pageInfo?.totalCount ?? 0);

  const capLabel = payload?.totalUsageLimit == null ? "UNL" : String(payload.totalUsageLimit);
  const usagePct = payload ? usagePercent(payload.redemptionCount, payload.totalUsageLimit) : 0;
  const redemptionBarPct = payload?.totalUsageLimit
    ? usagePercent(summary?.redemptionCount ?? payload.redemptionCount, payload.totalUsageLimit)
    : 0;

  const buyerTotal = (summary?.firstTimeBuyerCount ?? 0) + (summary?.returningBuyerCount ?? 0);
  const newPct =
    buyerTotal > 0 ? Math.round(((summary?.firstTimeBuyerCount ?? 0) / buyerTotal) * 100) : 0;
  const returnPct = buyerTotal > 0 ? 100 - newPct : 0;

  if (loading && !payload) {
    return <RedemptionsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav
        aria-label="Breadcrumb"
        className="font-mono text-[11px] uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
      >
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/admin" className="hover:text-[var(--admin-primary)]">
              Admin
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link href="/admin/reports" className="hover:text-[var(--admin-primary)]">
              Reports
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/admin/reports/sales-marketing"
              className="hover:text-[var(--admin-primary)]"
            >
              Sales &amp; Marketing
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li>
            <Link
              href="/admin/reports/sales-marketing/coupons"
              className="hover:text-[var(--admin-primary)]"
            >
              Coupons
            </Link>
          </li>
          <li aria-hidden="true">/</li>
          <li className="text-[var(--admin-on-surface)]">{payload?.code ?? "…"}</li>
        </ol>
      </nav>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-2xl font-semibold uppercase tracking-tight text-[var(--admin-on-surface)]">
              {payload?.code ?? "Coupon"}
            </h1>
            {payload?.code ? (
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                title={copiedKey === "code" ? "Copied" : "Copy code"}
                aria-label="Copy coupon code"
                onClick={() => void handleCopy(payload.code, "code")}
              >
                <Copy className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {payload?.name ?? "Redemptions for this discount code."}
          </p>
          {payload ? (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                className={[
                  "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
                  statusPillClass(payload.displayStatus),
                ].join(" ")}
              >
                {statusLabel(payload.displayStatus)}
              </span>
              <span className="inline-flex rounded bg-[var(--admin-surface-high)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--admin-on-surface)]">
                {discountLabel(payload.discountType, payload.discountValue, payload.currency)}
              </span>
              <span className="inline-flex items-center gap-2 rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs text-[var(--admin-on-surface)]">
                <span className="font-mono">
                  {payload.redemptionCount.toLocaleString()} / {capLabel}
                </span>
                <span className="h-1 w-16 overflow-hidden rounded-full bg-[var(--admin-border)]">
                  <span
                    className="block h-full rounded-full bg-[var(--admin-primary)]"
                    style={{ width: `${String(Math.max(usagePct > 0 ? 4 : 0, usagePct))}%` }}
                  />
                </span>
              </span>
              {payload.endsAt ? (
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Expires {formatShortDate(payload.endsAt)}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={couponEditHref(couponId)}
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open in coupon editor
          </Link>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
            onClick={() => {
              openDrawer("group");
            }}
            disabled={!payload || isTrulyEmpty}
          >
            <Users className="h-4 w-4" aria-hidden="true" />
            Cohort actions
          </button>
        </div>
      </div>

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
                Couldn&apos;t load coupon redemptions.
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

      {error && !payload ? (
        <div className="pointer-events-none opacity-30">
          <RedemptionsSkeleton />
        </div>
      ) : null}

      {!error && payload && summary && !isTrulyEmpty ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-6">
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Revenue Driven</p>
              <p className="font-mono text-2xl font-semibold leading-tight text-[var(--admin-on-surface)]">
                {formatMoneyAmount(summary.totalRevenueCents)}
                <span className="ml-1 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </p>
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Discount Given</p>
              <p className="font-mono text-2xl font-semibold leading-tight text-[var(--admin-warning)]">
                {formatMoneyAmount(summary.totalDiscountCents)}
                <span className="ml-1 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </p>
            </div>
            <div className="bg-[color-mix(in_srgb,var(--admin-success)_6%,var(--admin-surface))] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Net</p>
              <p className="font-mono text-2xl font-semibold leading-tight text-[var(--admin-success)]">
                {formatMoneyAmount(summary.totalNetCents)}
                <span className="ml-1 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </p>
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Redemptions</p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {summary.redemptionCount.toLocaleString()}
              </p>
              {payload.totalUsageLimit != null ? (
                <div className="mt-2 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                  <div
                    className="h-full rounded-full bg-[var(--admin-primary)]"
                    style={{
                      width: `${String(Math.max(redemptionBarPct > 0 ? 4 : 0, redemptionBarPct))}%`,
                    }}
                  />
                </div>
              ) : null}
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Average Order</p>
              <p className="font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatMoneyAmount(summary.avgOrderCents)}
                <span className="ml-1 text-[10px] font-normal text-[var(--admin-on-surface-variant)]">
                  {summary.currency}
                </span>
              </p>
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                First-Time Buyers
              </p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {summary.firstTimeBuyerCount.toLocaleString()}
              </p>
              <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
                {summary.firstTimeBuyerPercent}% of redeemers
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[58fr_42fr]">
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Redemptions over time
              </h2>
              <RedemptionsTrendChart
                trend={trend}
                endsAt={payload.endsAt}
                currency={summary.currency}
              />
            </div>

            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 shadow-sm">
              <h2 className="mb-4 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                Where it was redeemed
              </h2>
              {products.length === 0 ? (
                <p className="text-sm text-[var(--admin-on-surface-variant)]">
                  No product breakdown available.
                </p>
              ) : (
                <ul className="space-y-3">
                  {products.map((product) => (
                    <li key={`${product.courseId ?? "none"}-${product.productTitle}`}>
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <BookOpen
                            className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                            aria-hidden="true"
                          />
                          <span className="truncate text-sm text-[var(--admin-on-surface)]">
                            {product.productTitle}
                          </span>
                        </div>
                        <span className="shrink-0 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {product.redemptionCount}
                        </span>
                      </div>
                      <div className="mb-1 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
                        <div
                          className="h-full rounded-full bg-[var(--admin-primary)]"
                          style={{
                            width: `${String(Math.max(product.sharePercent > 0 ? 4 : 0, product.sharePercent))}%`,
                          }}
                        />
                      </div>
                      <p className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                        {formatMoneyAmount(product.revenueCents)} {summary.currency}
                      </p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-6 border-t border-[var(--admin-border)] pt-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Redeemed by
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                    <span>New</span>
                    <span className="ml-auto font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {summary.firstTimeBuyerCount} ({newPct}%)
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface)]">
                    <span
                      className="h-2.5 w-2.5 rounded-full bg-[var(--admin-on-surface-high)] ring-1 ring-[var(--admin-border)]"
                      aria-hidden="true"
                    />
                    <span>Return</span>
                    <span className="ml-auto font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {summary.returningBuyerCount} ({returnPct}%)
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}

      {!error && payload && isTrulyEmpty ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
              <Tag
                className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                strokeWidth={1.5}
                aria-hidden="true"
              />
            </div>
            <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
              This coupon has not been redeemed yet
            </h2>
            <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Created {formatShortDate(payload.createdAt)}
              {payload.totalUsageLimit != null
                ? ` · Usage cap ${payload.totalUsageLimit.toLocaleString()}`
                : " · No usage cap"}
            </p>
            <Link
              href={couponEditHref(couponId)}
              className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
            >
              <ExternalLink className="h-4 w-4" aria-hidden="true" />
              Open in coupon editor
            </Link>
          </div>
        </div>
      ) : null}

      {!error && payload && !isTrulyEmpty ? (
        <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
            <div className="flex flex-wrap gap-3">
              <label className="relative flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">
                  Search learner
                </span>
                <span className="relative">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                    aria-hidden="true"
                  />
                  <input
                    value={draftQ}
                    onChange={(event) => {
                      setDraftQ(event.target.value);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") applyFilters();
                    }}
                    placeholder="Name or email…"
                    className="h-9 w-56 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  />
                </span>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Product</span>
                <Select
                  value={draftCourseId}
                  onValueChange={setDraftCourseId}
                  options={productOptions}
                  ariaLabel="Filter by product"
                  className="h-9 min-w-[160px]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Applied from</span>
                <input
                  type="date"
                  value={draftFrom}
                  onChange={(event) => {
                    setDraftFrom(event.target.value);
                  }}
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Applied to</span>
                <input
                  type="date"
                  value={draftTo}
                  onChange={(event) => {
                    setDraftTo(event.target.value);
                  }}
                  className="h-9 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Min amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftMinAmount}
                  onChange={(event) => {
                    setDraftMinAmount(event.target.value);
                  }}
                  placeholder="0.00"
                  className="h-9 w-28 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 font-mono text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Max amount</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={draftMaxAmount}
                  onChange={(event) => {
                    setDraftMaxAmount(event.target.value);
                  }}
                  placeholder="0.00"
                  className="h-9 w-28 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 font-mono text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-xs text-[var(--admin-on-surface-variant)]">Sort</span>
                <Select
                  value={draftSortBy}
                  onValueChange={(value) => {
                    setDraftSortBy(value as CouponRedemptionsSortBy);
                  }}
                  options={SORT_OPTIONS}
                  ariaLabel="Sort redemptions"
                  className="h-9 min-w-[160px]"
                />
              </label>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                onClick={applyFilters}
              >
                Apply
              </button>
              <button
                type="button"
                className="inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--admin-outline)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                title="Refresh"
                aria-label="Refresh"
                onClick={() => void load()}
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {filterChips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 border-b border-[var(--admin-border)] px-4 py-2.5">
              {filterChips.map((chip) => (
                <span
                  key={chip}
                  className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]"
                >
                  {chip}
                </span>
              ))}
              <button
                type="button"
                className="text-[11px] font-medium text-[var(--admin-primary)] hover:underline"
                onClick={clearAllFilters}
              >
                Clear all
              </button>
            </div>
          ) : null}

          {isFilteredEmpty ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center px-6 py-12 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
                <Tag
                  className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No redemptions match these filters
              </h2>
              <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Try clearing filters or widening the date range to see all redemptions for this
                coupon.
              </p>
              <button
                type="button"
                className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                onClick={clearAllFilters}
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left">
                  <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]">
                    <tr>
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          checked={allOnPageSelected}
                          onChange={() => {
                            toggleSelectAllOnPage(items);
                          }}
                          aria-label="Select all on page"
                        />
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Learner
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Product
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Discount
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Final Amount
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Order Ref
                      </th>
                      <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                        Applied On
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => {
                      const selected = selectedIds.has(item.membershipId);
                      const orderLabel = shortOrderRef(item);
                      const orderValue = item.invoiceNumber || item.paymentOrderId;
                      return (
                        <tr
                          key={item.id}
                          className={[
                            "group border-b border-[var(--admin-border)] transition-colors last:border-b-0",
                            selected
                              ? "border-l-2 border-l-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                              : "border-l-2 border-l-transparent hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)]",
                          ].join(" ")}
                        >
                          <td className="h-11 px-4">
                            <input
                              type="checkbox"
                              className="h-4 w-4 accent-[var(--admin-primary)]"
                              checked={selected}
                              onChange={() => {
                                toggleRow(item.membershipId);
                              }}
                              aria-label={`Select ${item.learnerName ?? item.email ?? "learner"}`}
                            />
                          </td>
                          <td className="h-11 px-4">
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] font-mono text-[10px] font-semibold text-[var(--admin-on-surface-variant)]">
                                {initials(item.learnerName, item.email)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-[var(--admin-primary)]">
                                  {item.learnerName ?? "—"}
                                </p>
                                {item.email ? (
                                  <p className="truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {item.email}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>
                          <td className="h-11 px-4">
                            <div className="flex min-w-0 items-center gap-2">
                              <span className="truncate text-sm text-[var(--admin-on-surface)]">
                                {item.productTitle ?? "—"}
                              </span>
                              <span className="shrink-0 rounded bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                                Course
                              </span>
                            </div>
                          </td>
                          <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-danger)]">
                            −{formatMoneyAmount(item.discountCents)}
                          </td>
                          <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                            {formatMoneyAmount(item.finalAmountCents)}
                            <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                              {item.currency}
                            </span>
                          </td>
                          <td className="h-11 px-4">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-[11px] text-[var(--admin-on-surface)]">
                                {orderLabel}
                              </span>
                              {orderValue ? (
                                <button
                                  type="button"
                                  className="rounded p-0.5 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-primary)] group-hover:opacity-100"
                                  title={copiedKey === item.id ? "Copied" : "Copy order reference"}
                                  aria-label="Copy order reference"
                                  onClick={() => void handleCopy(orderValue, item.id)}
                                >
                                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                </button>
                              ) : null}
                            </div>
                          </td>
                          <td className="h-11 px-4">
                            <p className="text-sm text-[var(--admin-on-surface)]">
                              {relativeTime(item.appliedAt)}
                            </p>
                            <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                              {formatAbsoluteDateTime(item.appliedAt)}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pageInfo && pageInfo.totalPages > 0 ? (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                  <p>
                    Showing {(pageInfo.page - 1) * pageInfo.pageSize + 1}–
                    {Math.min(pageInfo.page * pageInfo.pageSize, pageInfo.totalCount)} of{" "}
                    {pageInfo.totalCount} redemptions
                    <span className="mx-2 text-[var(--admin-border)]">·</span>
                    Page total{" "}
                    <span className="font-mono text-[var(--admin-on-surface)]">
                      {formatMoneyAmount(pageTotal)} {summary?.currency ?? payload.currency}
                    </span>
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
                      disabled={!pageInfo.hasPreviousPage || loading}
                      onClick={() => {
                        setPage((current) => Math.max(1, current - 1));
                      }}
                    >
                      Previous
                    </button>
                    <span className="font-mono text-xs">
                      {pageInfo.page} / {pageInfo.totalPages}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-[var(--admin-outline)] px-3 py-1 transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
                      disabled={!pageInfo.hasNextPage || loading}
                      onClick={() => {
                        setPage((current) => current + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      ) : null}

      {selectedCount > 0 ? (
        <div
          className="sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-lg transition-transform"
          role="region"
          aria-label="Selection actions"
        >
          <div className="text-sm text-[var(--admin-on-surface)]">
            <span className="font-mono font-semibold">{selectedCount}</span> selected
            <span className="mx-2 text-[var(--admin-border)]">·</span>
            Total{" "}
            <span className="font-mono font-semibold">
              {formatMoneyAmount(selectedTotal)} {summary?.currency ?? payload?.currency ?? ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              Clear
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded border border-[var(--admin-outline)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
              onClick={() => {
                openDrawer("message");
              }}
            >
              <Mail className="h-3.5 w-3.5" aria-hidden="true" />
              Email
            </button>
            <button
              type="button"
              className="inline-flex h-8 items-center gap-1.5 rounded bg-[var(--admin-primary-strong)] px-3 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
              onClick={() => {
                openDrawer("group");
              }}
            >
              <Users className="h-3.5 w-3.5" aria-hidden="true" />
              Create group
            </button>
          </div>
        </div>
      ) : null}

      {drawerOpen && payload ? (
        <div className="fixed inset-0 z-50 flex justify-end">
          <button
            type="button"
            className="absolute inset-0 bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] backdrop-blur-[2px]"
            aria-label="Close cohort drawer"
            onClick={() => {
              setDrawerOpen(false);
            }}
          />
          <aside
            className="relative flex h-full w-full max-w-[560px] flex-col border-l border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="cohort-drawer-title"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-5 py-4">
              <div>
                <h2
                  id="cohort-drawer-title"
                  className="font-mono text-lg font-semibold tracking-tight text-[var(--admin-on-surface)]"
                >
                  {matchCount.toLocaleString()} redeemers match the current filters
                </h2>
                {filterChips.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {filterChips.map((chip) => (
                      <span
                        key={chip}
                        className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                ) : null}
                {selectedCount > 0 ? (
                  <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                    Using {selectedCount} selected learner{selectedCount === 1 ? "" : "s"}.
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setDrawerOpen(false);
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="flex gap-1 border-b border-[var(--admin-border)] px-5 pt-3">
              {(
                [
                  ["group", "Create Group"],
                  ["message", "Send Message"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={[
                    "border-b-2 px-3 pb-2.5 text-xs font-medium transition-colors",
                    cohortTab === key
                      ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                  onClick={() => {
                    setCohortTab(key);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {actionError ? (
                <div className="mb-4 rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-3 py-2 text-sm text-[var(--admin-danger)]">
                  {actionError}
                </div>
              ) : null}

              {cohortTab === "group" ? (
                <div className="space-y-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Group name
                    </span>
                    <input
                      value={groupName}
                      onChange={(event) => {
                        setGroupName(event.target.value);
                      }}
                      className="h-10 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Description (optional)
                    </span>
                    <textarea
                      value={groupDescription}
                      onChange={(event) => {
                        setGroupDescription(event.target.value);
                      }}
                      rows={3}
                      className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                  <fieldset className="space-y-2">
                    <legend className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">
                      Membership mode
                    </legend>
                    <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--admin-border)] p-3 hover:bg-[var(--admin-surface-low)]">
                      <input
                        type="radio"
                        name="membership-mode"
                        className="mt-0.5 accent-[var(--admin-primary)]"
                        checked={membershipMode === "static"}
                        onChange={() => {
                          setMembershipMode("static");
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          Static Snapshot
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Capture the current matched redeemers as group members.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-not-allowed items-start gap-2 rounded border border-[var(--admin-border)] p-3 opacity-60">
                      <input
                        type="radio"
                        name="membership-mode"
                        className="mt-0.5 accent-[var(--admin-primary)]"
                        checked={membershipMode === "live"}
                        disabled
                        onChange={() => {
                          setMembershipMode("live");
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          Live Sync
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Keep the group in sync with matching redeemers over time.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                  <p className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-3 py-2 text-xs text-[var(--admin-warning)]">
                    Live sync isn&apos;t available yet. Choose Static Snapshot to create a group
                    from the current selection or filters.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">Subject</span>
                    <input
                      value={messageSubject}
                      onChange={(event) => {
                        setMessageSubject(event.target.value);
                      }}
                      className="h-10 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">Message</span>
                    <textarea
                      value={messageBody}
                      onChange={(event) => {
                        setMessageBody(event.target.value);
                      }}
                      rows={8}
                      className="rounded border border-[var(--admin-outline)] bg-[var(--admin-surface-low)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-4">
              <button
                type="button"
                className="inline-flex h-9 items-center rounded border border-[var(--admin-outline)] px-4 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                onClick={() => {
                  setDrawerOpen(false);
                }}
                disabled={busy}
              >
                Cancel
              </button>
              {cohortTab === "group" ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
                  disabled={busy || !groupName.trim() || membershipMode === "live"}
                  onClick={() => void handleCreateGroup()}
                >
                  {busy ? "Creating…" : `Create group with ${matchCount.toLocaleString()} learners`}
                </button>
              ) : (
                <button
                  type="button"
                  className="inline-flex h-9 items-center rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
                  disabled={busy || !messageSubject.trim() || !messageBody.trim()}
                  onClick={() => void handleSendMessage()}
                >
                  {busy ? "Sending…" : `Send to ${matchCount.toLocaleString()} learners`}
                </button>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
