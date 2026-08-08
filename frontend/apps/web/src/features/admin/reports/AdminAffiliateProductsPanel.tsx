"use client";

import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  Download,
  GraduationCap,
  Link2,
  Package,
  Plus,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { AFFILIATES_HREF } from "../grow/affiliates-shared";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchAffiliateProducts,
  upsertAffiliateProduct,
  type AffiliateProductItem,
  type AffiliateProductsPayload,
  type AffiliateProductsSummary,
} from "./admin-sales-marketing-roster-api";
import {
  downloadReportExport,
  pollReportRunUntilComplete,
} from "./admin-reports-api";

type ProgrammeFilter = "all" | "enabled" | "disabled";
type CommissionBand = "any" | "below_10" | "10_20" | "above_20";
type SortBy =
  | "revenue_cents"
  | "commission_cents"
  | "order_count"
  | "commission_rate_pct"
  | "effective_rate_pct"
  | "published_at"
  | "product_title";

type DisableReason = "" | "restructuring" | "temporary" | "policy" | "other";
type CommissionMode = "default" | "override";

type StudioCourseOption = {
  id: string;
  title: string;
};

const SORT_OPTIONS: Array<{ value: SortBy; label: string }> = [
  { value: "revenue_cents", label: "Revenue" },
  { value: "commission_cents", label: "Commission" },
  { value: "order_count", label: "Orders" },
  { value: "commission_rate_pct", label: "Commission rate" },
  { value: "effective_rate_pct", label: "Effective rate" },
  { value: "published_at", label: "Published date" },
  { value: "product_title", label: "Product title" },
];

const DISABLE_REASONS: Array<{ value: Exclude<DisableReason, "">; label: string }> = [
  { value: "restructuring", label: "Programme restructuring" },
  { value: "temporary", label: "Temporary pause" },
  { value: "policy", label: "Policy violation" },
  { value: "other", label: "Other" },
];

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

function formatRate(value: number): string {
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
}

function productTypeLabel(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Course";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
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

function AffiliateProductsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading affiliate products">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-56" />
          <Shimmer className="h-4 w-96 max-w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-44" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
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
              <Shimmer className="h-8 w-8 rounded" />
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

function ProgrammeToggle({
  enabled,
  disabled,
  onToggle,
  label,
}: {
  enabled: boolean;
  disabled?: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      disabled={disabled}
      onClick={onToggle}
      className={[
        "relative inline-flex h-4 w-8 shrink-0 items-center rounded-full border transition-colors",
        enabled
          ? "border-[var(--admin-primary)] bg-[var(--admin-primary)]"
          : "border-[var(--admin-outline)] bg-[var(--admin-surface-high)]",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      ].join(" ")}
    >
      <span
        className={[
          "absolute h-3 w-3 rounded-full bg-[var(--admin-surface)] shadow-sm transition-transform",
          enabled ? "translate-x-[14px]" : "translate-x-0.5",
        ].join(" ")}
      />
    </button>
  );
}

export function AdminAffiliateProductsPanel() {
  const initialRange = useMemo(() => defaultActivityRange(30), []);

  const [payload, setPayload] = useState<AffiliateProductsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [activityFrom, setActivityFrom] = useState(initialRange.from);
  const [activityTo, setActivityTo] = useState(initialRange.to);

  const [searchQ, setSearchQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [programme, setProgramme] = useState<ProgrammeFilter>("all");
  const [draftProgramme, setDraftProgramme] = useState<ProgrammeFilter>("all");
  const [commissionBand, setCommissionBand] = useState<CommissionBand>("any");
  const [draftCommissionBand, setDraftCommissionBand] = useState<CommissionBand>("any");
  const [sortBy, setSortBy] = useState<SortBy>("revenue_cents");
  const [draftSortBy, setDraftSortBy] = useState<SortBy>("revenue_cents");
  const [page, setPage] = useState(1);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [disableTarget, setDisableTarget] = useState<AffiliateProductItem | null>(null);
  const [disableReason, setDisableReason] = useState<DisableReason>("");
  const [enableTarget, setEnableTarget] = useState<AffiliateProductItem | null>(null);
  const [enableMode, setEnableMode] = useState<CommissionMode>("default");
  const [enableRate, setEnableRate] = useState("10");
  const [enableStartDate, setEnableStartDate] = useState(() => new Date().toISOString().slice(0, 10));

  const [addOpen, setAddOpen] = useState(false);
  const [courses, setCourses] = useState<StudioCourseOption[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [addCourseId, setAddCourseId] = useState("");
  const [addMode, setAddMode] = useState<CommissionMode>("default");
  const [addRate, setAddRate] = useState("10");

  const filtersActive =
    Boolean(searchQ.trim()) || programme !== "all" || commissionBand !== "any";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchAffiliateProducts({
        q: searchQ.trim() || undefined,
        enabled: programme,
        commissionBand,
        activityFrom: dateInputToStartIso(activityFrom),
        activityTo: dateInputToEndIso(activityTo),
        sortBy,
        sortDir: "desc",
        page,
        limit: 50,
      });
      setPayload(response.data);
      setSelectedIds(new Set());
    } catch (loadError) {
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Unable to load affiliate products.",
      );
    } finally {
      setLoading(false);
    }
  }, [activityFrom, activityTo, commissionBand, page, programme, searchQ, sortBy]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyFilters = () => {
    setSearchQ(draftQ.trim());
    setProgramme(draftProgramme);
    setCommissionBand(draftCommissionBand);
    setSortBy(draftSortBy);
    setPage(1);
  };

  const clearFilters = () => {
    setDraftQ("");
    setSearchQ("");
    setDraftProgramme("all");
    setProgramme("all");
    setDraftCommissionBand("any");
    setCommissionBand("any");
    setDraftSortBy("revenue_cents");
    setSortBy("revenue_cents");
    setPage(1);
  };

  async function handleExport() {
    setBusy(true);
    setActionError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "affiliate-products",
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

  function openDisable(item: AffiliateProductItem) {
    setDisableTarget(item);
    setDisableReason("");
    setActionError(null);
  }

  function openEnable(item: AffiliateProductItem) {
    setEnableTarget(item);
    setEnableMode(item.inheritsDefaultRate ? "default" : "override");
    setEnableRate(String(item.commissionRatePct || item.tenantDefaultCommissionPct || 10));
    setEnableStartDate(new Date().toISOString().slice(0, 10));
    setActionError(null);
  }

  async function confirmDisable() {
    if (!disableTarget || !disableReason) return;
    setBusy(true);
    setActionError(null);
    try {
      const existingResponse = await clientApi.get<{
        data: {
          items: Array<{
            courseId: string;
            standardDiscountPct: number | null;
            standardCommissionPct: number | null;
            premiumDiscountPct: number | null;
            premiumCommissionPct: number | null;
          }>;
        };
      }>("/api/v1/sales/affiliates/products", "affiliate-product-before-disable");
      const existing = existingResponse.data.items.find(
        (row) => row.courseId === disableTarget.courseId,
      );
      await upsertAffiliateProduct({
        courseId: disableTarget.courseId,
        enabled: false,
        standardDiscountPct: existing?.standardDiscountPct ?? null,
        standardCommissionPct: existing?.standardCommissionPct ?? null,
        premiumDiscountPct: existing?.premiumDiscountPct ?? null,
        premiumCommissionPct: existing?.premiumCommissionPct ?? null,
      });
      setDisableTarget(null);
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not disable programme.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmEnable() {
    if (!enableTarget) return;
    const overridePct = Number(enableRate);
    if (enableMode === "override" && (!Number.isFinite(overridePct) || overridePct < 0 || overridePct > 100)) {
      setActionError("Enter a commission rate between 0 and 100.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      const existingResponse = await clientApi.get<{
        data: {
          items: Array<{
            courseId: string;
            standardDiscountPct: number | null;
            standardCommissionPct: number | null;
            premiumDiscountPct: number | null;
            premiumCommissionPct: number | null;
          }>;
        };
      }>("/api/v1/sales/affiliates/products", "affiliate-product-before-enable");
      const existing = existingResponse.data.items.find(
        (row) => row.courseId === enableTarget.courseId,
      );
      await upsertAffiliateProduct({
        courseId: enableTarget.courseId,
        enabled: true,
        standardDiscountPct: existing?.standardDiscountPct ?? null,
        standardCommissionPct:
          enableMode === "override" ? Math.round(overridePct) : null,
        premiumDiscountPct: existing?.premiumDiscountPct ?? null,
        premiumCommissionPct: existing?.premiumCommissionPct ?? null,
      });
      setEnableTarget(null);
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not enable programme.",
      );
    } finally {
      setBusy(false);
    }
  }

  function onToggleClick(item: AffiliateProductItem) {
    if (item.enabled) {
      openDisable(item);
      return;
    }
    openEnable(item);
  }

  async function openAddModal() {
    setAddOpen(true);
    setAddCourseId("");
    setAddMode("default");
    setAddRate(String(payload?.summary.tenantDefaultCommissionPct ?? 10));
    setActionError(null);
    setCoursesLoading(true);
    try {
      const [coursesResponse, productsResponse] = await Promise.all([
        clientApi.get<{ data: { items: Array<{ id: string; title?: string | null }> } }>(
          "/api/v1/courses?view=studio&limit=100",
          "affiliate-products-courses",
        ),
        clientApi.get<{ data: { items: Array<{ courseId: string }> } }>(
          "/api/v1/sales/affiliates/products",
          "affiliate-products-configured",
        ),
      ]);
      const inProgramme = new Set(productsResponse.data.items.map((row) => row.courseId));
      setCourses(
        coursesResponse.data.items
          .map((row) => ({
            id: row.id,
            title: row.title?.trim() || "Untitled course",
          }))
          .filter((course) => !inProgramme.has(course.id)),
      );
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not load courses.",
      );
    } finally {
      setCoursesLoading(false);
    }
  }

  async function confirmAddProduct() {
    if (!addCourseId) {
      setActionError("Select a course first.");
      return;
    }
    const overridePct = Number(addRate);
    if (addMode === "override" && (!Number.isFinite(overridePct) || overridePct < 0 || overridePct > 100)) {
      setActionError("Enter a commission rate between 0 and 100.");
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await upsertAffiliateProduct({
        courseId: addCourseId,
        enabled: true,
        standardCommissionPct: addMode === "override" ? Math.round(overridePct) : null,
      });
      setAddOpen(false);
      await load();
    } catch (caught) {
      setActionError(
        caught instanceof ClientApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not enable product.",
      );
    } finally {
      setBusy(false);
    }
  }

  const summary: AffiliateProductsSummary | null = payload?.summary ?? null;
  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const maxRevenue = useMemo(
    () => items.reduce((max, row) => Math.max(max, row.revenueCents), 0),
    [items],
  );
  const isEmpty =
    !loading && !error && payload != null && pageInfo != null && pageInfo.totalCount === 0;
  const isTrulyEmpty =
    isEmpty && !filtersActive && (summary?.productsInProgramme ?? 0) === 0;
  const isFilteredEmpty = isEmpty && !isTrulyEmpty;
  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.courseId));

  const filterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string }> = [];
    if (programme !== "all") {
      chips.push({
        key: "programme",
        label: `Programme: ${programme === "enabled" ? "Enabled" : "Disabled"}`,
      });
    }
    if (commissionBand !== "any") {
      const labels: Record<Exclude<CommissionBand, "any">, string> = {
        below_10: "Below 10%",
        "10_20": "10–20%",
        above_20: "Above 20%",
      };
      chips.push({ key: "commission", label: `Commission: ${labels[commissionBand]}` });
    }
    if (searchQ.trim()) chips.push({ key: "search", label: `Search: ${searchQ.trim()}` });
    return chips;
  }, [commissionBand, programme, searchQ]);

  if (loading && !payload) {
    return <AffiliateProductsSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
            Affiliate products
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-[var(--admin-on-surface-variant)]">
            Which products pay commission, and what that programme has returned in the selected
            activity window.
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
            onClick={() => void openAddModal()}
            disabled={Boolean(error)}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Enable a product
          </button>
        </div>
      </div>

      {actionError && !disableTarget && !enableTarget && !addOpen ? (
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
                Failed to load affiliate product configurations.
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
          <AffiliateProductsSkeleton />
        </div>
      ) : null}

      {!error && summary ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-5">
            <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-2">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Affiliate revenue
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
              <p className="font-mono text-lg font-medium text-[var(--admin-warning)]">
                {formatMoneyAmount(summary.commissionCents)}
                <span className="ml-1 text-[11px] font-normal opacity-70">{summary.currency}</span>
              </p>
              <p className="mt-2 inline-flex rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatRate(summary.effectiveRatePct)} effective rate
              </p>
            </div>

            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Net to tenant
              </p>
              <p className="font-mono text-lg font-medium text-[var(--admin-success)]">
                {formatMoneyAmount(summary.netCents)}
                <span className="ml-1 text-[11px] font-normal opacity-70">{summary.currency}</span>
              </p>
            </div>

            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Orders
              </p>
              <p className="font-mono text-lg font-medium text-[var(--admin-on-surface)]">
                {summary.orderCount.toLocaleString()}
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                {formatMoneyAmount(summary.avgOrderValueCents)} {summary.currency} average
              </p>
            </div>

            <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-1">
              <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                Products enabled
              </p>
              <p className="font-mono text-lg font-medium text-[var(--admin-on-surface)]">
                {summary.productsEnabled.toLocaleString()}
                <span className="ml-1 text-xs font-normal text-[var(--admin-on-surface-variant)]">
                  of {summary.productsTotal.toLocaleString()}
                </span>
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                {summary.productsInProgramme.toLocaleString()} in programme
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
              <label className="relative min-w-0 flex-1 max-w-sm">
                <span className="sr-only">Search product title</span>
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                <input
                  className="h-9 w-full rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-8 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  placeholder="Search product title"
                  value={draftQ}
                  onChange={(event) => setDraftQ(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") applyFilters();
                  }}
                />
              </label>

              <div className="w-full sm:w-44">
                <Select
                  ariaLabel="Programme"
                  value={draftProgramme}
                  onValueChange={(value) => setDraftProgramme(value as ProgrammeFilter)}
                  options={[
                    { value: "all", label: "Programme: All" },
                    { value: "enabled", label: "Enabled" },
                    { value: "disabled", label: "Disabled" },
                  ]}
                  className="h-9"
                />
              </div>

              <div className="w-full sm:w-44">
                <Select
                  ariaLabel="Commission band"
                  value={draftCommissionBand}
                  onValueChange={(value) => setDraftCommissionBand(value as CommissionBand)}
                  options={[
                    { value: "any", label: "Commission: Any" },
                    { value: "below_10", label: "Below 10%" },
                    { value: "10_20", label: "10–20%" },
                    { value: "above_20", label: "Above 20%" },
                  ]}
                  className="h-9"
                />
              </div>

              <div className="w-full sm:w-48">
                <Select
                  ariaLabel="Sort by"
                  value={draftSortBy}
                  onValueChange={(value) => setDraftSortBy(value as SortBy)}
                  options={SORT_OPTIONS}
                  className="h-9"
                />
              </div>

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

          {isTrulyEmpty ? (
            <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-high)]">
                <Link2 className="h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
              </div>
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No products are enabled for affiliates
              </h2>
              <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                Enable products to allow affiliates to generate referral links and earn commissions.
              </p>
              <button
                type="button"
                className="mt-8 inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-6 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                onClick={() => void openAddModal()}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Enable a product
              </button>
            </div>
          ) : null}

          {isFilteredEmpty ? (
            <div className="flex min-h-[240px] flex-col items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8 text-center">
              <Package className="mb-4 h-8 w-8 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
              <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                No products match these filters
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

          {!isEmpty ? (
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
                              setSelectedIds(new Set(items.map((row) => row.courseId)));
                            } else {
                              setSelectedIds(new Set());
                            }
                          }}
                          aria-label="Select all on page"
                        />
                      </th>
                      <th className="px-4 py-2 font-medium">Product</th>
                      <th className="px-4 py-2 font-medium">Programme</th>
                      <th className="px-4 py-2 text-right font-medium">Commission rate</th>
                      <th className="px-4 py-2 text-right font-medium">Orders</th>
                      <th className="px-4 py-2 text-right font-medium">Revenue</th>
                      <th className="px-4 py-2 text-right font-medium">Commission</th>
                      <th className="px-4 py-2 text-right font-medium">Net</th>
                      <th className="px-4 py-2 text-right font-medium">Eff. rate</th>
                      <th className="px-4 py-2 font-medium">Published on</th>
                      <th className="w-10 px-4" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--admin-border)]">
                    {items.map((row) => {
                      const share =
                        maxRevenue > 0 ? Math.max(4, Math.round((row.revenueCents / maxRevenue) * 100)) : 0;
                      const muted = !row.enabled;
                      const showWarning = !row.enabled && row.activeAffiliateCount > 0;
                      return (
                        <tr
                          key={row.courseId}
                          className={[
                            "group h-11 transition-colors hover:bg-[var(--admin-surface-high)]",
                            muted ? "opacity-80" : "",
                          ].join(" ")}
                        >
                          <td className="px-4 text-center">
                            <input
                              type="checkbox"
                              className="rounded border-[var(--admin-outline)] text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                              checked={selectedIds.has(row.courseId)}
                              onChange={(event) => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (event.target.checked) next.add(row.courseId);
                                  else next.delete(row.courseId);
                                  return next;
                                });
                              }}
                              aria-label={`Select ${row.productTitle}`}
                            />
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-3">
                              <div
                                className={[
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)]",
                                  muted ? "opacity-70" : "",
                                ].join(" ")}
                              >
                                <GraduationCap
                                  className={[
                                    "h-4 w-4",
                                    muted
                                      ? "text-[var(--admin-on-surface-variant)]"
                                      : "text-[var(--admin-primary)]",
                                  ].join(" ")}
                                  aria-hidden="true"
                                />
                              </div>
                              <div className="min-w-0">
                                <p
                                  className={[
                                    "truncate font-medium",
                                    muted
                                      ? "text-[var(--admin-on-surface-variant)]"
                                      : "text-[var(--admin-primary-strong)]",
                                  ].join(" ")}
                                >
                                  {row.productTitle}
                                </p>
                                <div className="mt-0.5 flex flex-wrap items-center gap-2">
                                  <span className="inline-flex rounded border border-[color-mix(in_srgb,var(--admin-outline)_40%,transparent)] bg-[var(--admin-surface-high)] px-1.5 py-0.5 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                    {productTypeLabel(row.productType)}
                                  </span>
                                  {showWarning ? (
                                    <span className="inline-flex items-center gap-0.5 text-[10px] text-[var(--admin-warning)]">
                                      <AlertTriangle className="h-3 w-3" aria-hidden="true" />
                                      Disabled, but {row.activeAffiliateCount} affiliate
                                      {row.activeAffiliateCount === 1 ? "" : "s"} still have history
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex items-center gap-2">
                              <ProgrammeToggle
                                enabled={row.enabled}
                                disabled={busy}
                                label={
                                  row.enabled
                                    ? `Disable affiliate programme for ${row.productTitle}`
                                    : `Enable affiliate programme for ${row.productTitle}`
                                }
                                onToggle={() => onToggleClick(row)}
                              />
                              <span
                                className={[
                                  "text-xs",
                                  muted
                                    ? "text-[var(--admin-on-surface-variant)]"
                                    : "text-[var(--admin-on-surface-variant)]",
                                ].join(" ")}
                              >
                                {row.enabled ? "Enabled" : "Disabled"}
                              </span>
                            </div>
                          </td>
                          <td
                            className={[
                              "px-4 py-2 text-right font-mono",
                              muted ? "text-[var(--admin-on-surface-variant)]" : "",
                            ].join(" ")}
                          >
                            {formatRate(row.commissionRatePct)}
                          </td>
                          <td
                            className={[
                              "px-4 py-2 text-right font-mono",
                              muted ? "text-[var(--admin-on-surface-variant)]" : "",
                            ].join(" ")}
                          >
                            {row.orderCount.toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <span
                                className={[
                                  "font-mono",
                                  muted ? "text-[var(--admin-on-surface-variant)]" : "",
                                ].join(" ")}
                              >
                                {formatMoneyAmount(row.revenueCents)}
                                <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                  {row.currency}
                                </span>
                              </span>
                              <div className="hidden h-1.5 w-16 overflow-hidden rounded-full bg-[var(--admin-surface-high)] xl:flex">
                                <div
                                  className={[
                                    "h-full rounded-full",
                                    muted
                                      ? "bg-[var(--admin-outline)]"
                                      : "bg-[var(--admin-on-surface)]",
                                  ].join(" ")}
                                  style={{ width: `${share}%` }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--admin-warning)]">
                            {formatMoneyAmount(row.commissionCents)}
                            <span className="ml-1 text-[10px] opacity-70">{row.currency}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--admin-success)]">
                            {formatMoneyAmount(row.netCents)}
                            <span className="ml-1 text-[10px] opacity-70">{row.currency}</span>
                          </td>
                          <td className="px-4 py-2 text-right font-mono text-[var(--admin-on-surface-variant)]">
                            {formatRate(row.effectiveRatePct)}
                          </td>
                          <td className="px-4 py-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {formatShortDate(row.publishedAt)}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {showWarning ? (
                              <Link
                                href={`${AFFILIATES_HREF}?tab=partners`}
                                className="inline-flex rounded border border-[var(--admin-outline)] px-2 py-1 text-[10px] font-medium text-[var(--admin-on-surface)] opacity-0 transition-opacity hover:bg-[var(--admin-surface-high)] group-hover:opacity-100"
                              >
                                View partners
                              </Link>
                            ) : (
                              <Link
                                href={`${AFFILIATES_HREF}?tab=products`}
                                className="inline-flex text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-primary)] group-hover:opacity-100"
                                aria-label={`Open ${row.productTitle} in affiliate products`}
                              >
                                <ChevronRight className="h-5 w-5" aria-hidden="true" />
                              </Link>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {pageInfo && pageInfo.totalPages > 1 ? (
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                  <span>
                    Page {pageInfo.page} of {pageInfo.totalPages} ·{" "}
                    {pageInfo.totalCount.toLocaleString()} products
                  </span>
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
                </div>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {disableTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => !busy && setDisableTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="disable-affiliate-product-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id="disable-affiliate-product-title"
                className="pr-4 text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Disable affiliate programme for this product
              </h2>
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => setDisableTarget(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-6">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                You are disabling the affiliate programme for{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">
                  {disableTarget.productTitle}
                </span>
                .
              </p>
              <div className="space-y-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--admin-on-surface-variant)]">Active affiliates</span>
                  <span className="font-mono text-[var(--admin-on-surface)]">
                    {disableTarget.activeAffiliateCount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--admin-on-surface-variant)]">Unpaid commission</span>
                  <span className="font-mono text-[var(--admin-on-surface)]">
                    {formatMoneyAmount(disableTarget.unpaidCommissionCents)}{" "}
                    <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                      {disableTarget.currency}
                    </span>
                  </span>
                </div>
              </div>
              <div className="flex gap-3 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] p-4">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-danger)]" />
                <p className="text-sm text-[var(--admin-on-surface)]">
                  Existing affiliate links will stop earning commission on new orders. Unpaid
                  commission already earned is not affected.
                </p>
              </div>
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Reason for disabling
                </span>
                <Select
                  ariaLabel="Reason for disabling"
                  value={disableReason || "__none__"}
                  onValueChange={(value) =>
                    setDisableReason(value === "__none__" ? "" : (value as DisableReason))
                  }
                  options={[
                    { value: "__none__", label: "Select a reason…" },
                    ...DISABLE_REASONS,
                  ]}
                  className="h-10"
                />
              </label>
              {actionError ? (
                <p className="text-sm text-[var(--admin-danger)]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setDisableTarget(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md bg-[var(--admin-danger)] px-4 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
                onClick={() => void confirmDisable()}
                disabled={busy || !disableReason}
              >
                Disable programme
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {enableTarget ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => !busy && setEnableTarget(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="enable-affiliate-product-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id="enable-affiliate-product-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Enable affiliate programme
              </h2>
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => setEnableTarget(null)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-6">
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                Configure the affiliate programme settings for{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">
                  {enableTarget.productTitle}
                </span>
                .
              </p>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Commission rate
                </p>
                <label
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3",
                    enableMode === "default"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="enable-commission"
                    checked={enableMode === "default"}
                    onChange={() => setEnableMode("default")}
                    className="text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Inherit tenant default
                    </span>
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Currently set to {formatRate(enableTarget.tenantDefaultCommissionPct)}
                    </span>
                  </span>
                </label>
                <label
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3",
                    enableMode === "override"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="enable-commission"
                    checked={enableMode === "override"}
                    onChange={() => setEnableMode("override")}
                    className="text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Custom override
                    </span>
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Set a specific rate for this product
                    </span>
                  </span>
                </label>
                {enableMode === "override" ? (
                  <label className="block space-y-1 pl-7">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">Rate (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={enableRate}
                      onChange={(event) => setEnableRate(event.target.value)}
                      className="h-10 w-28 rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 font-mono text-sm outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                ) : null}
              </div>
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Start date
                </span>
                <div className="relative">
                  <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" />
                  <input
                    type="date"
                    value={enableStartDate}
                    onChange={(event) => setEnableStartDate(event.target.value)}
                    className="h-10 w-full rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] pl-10 pr-3 text-sm outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                  />
                </div>
                <span className="text-[11px] text-[var(--admin-on-surface-variant)]">
                  Informational for your records — commission applies immediately when enabled.
                </span>
              </label>
              {actionError ? (
                <p className="text-sm text-[var(--admin-danger)]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setEnableTarget(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md bg-[var(--admin-primary-strong)] px-4 text-sm font-medium text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary)] disabled:opacity-50"
                onClick={() => void confirmEnable()}
                disabled={busy}
              >
                Enable programme
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_45%,transparent)] p-4 backdrop-blur-sm"
          onClick={() => !busy && setAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-affiliate-product-title"
            className="flex w-full max-w-[480px] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-[0_8px_30px_color-mix(in_srgb,var(--admin-on-surface)_8%,transparent)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
              <h2
                id="add-affiliate-product-title"
                className="text-base font-semibold text-[var(--admin-on-surface)]"
              >
                Enable a product
              </h2>
              <button
                type="button"
                className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                onClick={() => setAddOpen(false)}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-6 p-6">
              <label className="block space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Course
                </span>
                {coursesLoading ? (
                  <Shimmer className="h-10 w-full" />
                ) : (
                  <Select
                    ariaLabel="Course"
                    value={addCourseId || "__none__"}
                    onValueChange={(value) => setAddCourseId(value === "__none__" ? "" : value)}
                    options={[
                      { value: "__none__", label: "Select a course…" },
                      ...courses.map((course) => ({
                        value: course.id,
                        label: course.title,
                      })),
                    ]}
                    className="h-10"
                  />
                )}
              </label>
              <div className="space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]">
                  Commission rate
                </p>
                <label
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3",
                    addMode === "default"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="add-commission"
                    checked={addMode === "default"}
                    onChange={() => setAddMode("default")}
                    className="text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span>
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Inherit tenant default
                    </span>
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Currently set to{" "}
                      {formatRate(summary?.tenantDefaultCommissionPct ?? 10)}
                    </span>
                  </span>
                </label>
                <label
                  className={[
                    "flex cursor-pointer items-center gap-3 rounded-md border p-3",
                    addMode === "override"
                      ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))]"
                      : "border-[var(--admin-border)] bg-[var(--admin-surface)]",
                  ].join(" ")}
                >
                  <input
                    type="radio"
                    name="add-commission"
                    checked={addMode === "override"}
                    onChange={() => setAddMode("override")}
                    className="text-[var(--admin-primary)] focus:ring-[var(--admin-primary)]"
                  />
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                      Custom override
                    </span>
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">
                      Set a specific rate for this product
                    </span>
                  </span>
                </label>
                {addMode === "override" ? (
                  <label className="block space-y-1 pl-7">
                    <span className="text-xs text-[var(--admin-on-surface-variant)]">Rate (%)</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={addRate}
                      onChange={(event) => setAddRate(event.target.value)}
                      className="h-10 w-28 rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 font-mono text-sm outline-none focus:border-[var(--admin-primary)] focus:ring-1 focus:ring-[var(--admin-primary)]"
                    />
                  </label>
                ) : null}
              </div>
              {actionError ? (
                <p className="text-sm text-[var(--admin-danger)]" role="alert">
                  {actionError}
                </p>
              ) : null}
            </div>
            <div className="flex justify-end gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-6 py-4">
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-4 text-sm font-medium text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                onClick={() => setAddOpen(false)}
                disabled={busy}
              >
                Cancel
              </button>
              <button
                type="button"
                className="inline-flex h-10 items-center rounded-md bg-[var(--admin-primary-strong)] px-4 text-sm font-medium text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary)] disabled:opacity-50"
                onClick={() => void confirmAddProduct()}
                disabled={busy || coursesLoading}
              >
                Enable programme
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
