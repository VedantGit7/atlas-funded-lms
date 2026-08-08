"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  exportPaymentInstalments,
  fetchPaymentInstalmentDetail,
  fetchPaymentInstalments,
  payPaymentInstalment,
  PAYMENT_INSTALMENT_COLUMN_OPTIONS,
  type PaymentInstalmentColumnKey,
  type PaymentInstalmentPlanItem,
  type PaymentInstalmentScheduleItem,
  type PaymentInstalmentSummary,
} from "./admin-payments-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

const PAGE_SIZE_OPTIONS = [
  { value: "12", label: "12" },
  { value: "24", label: "24" },
  { value: "48", label: "48" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "overdue", label: "Overdue" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const NEXT_DUE_OPTIONS = [
  { value: "", label: "Any time" },
  { value: "overdue", label: "Overdue" },
  { value: "7days", label: "Next 7 days" },
  { value: "30days", label: "Next 30 days" },
];

const DEFAULT_COLUMNS: PaymentInstalmentColumnKey[] = [
  "learner_name",
  "email",
  "product_title",
  "pricing_plan_label",
  "remaining_amount_cents",
  "total_amount_cents",
  "status",
  "next_due_at",
];

const EMPTY_SUMMARY: PaymentInstalmentSummary = {
  currency: "USD",
  outstandingCents: 0,
  outstandingPlanCount: 0,
  dueNext7DaysCents: 0,
  overdueCents: 0,
  overdueInstalmentCount: 0,
  completedThisMonthCount: 0,
};

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(plan: PaymentInstalmentPlanItem): { label: string; className: string } {
  if (plan.overdueCount > 0 || plan.status === "overdue") {
    return {
      label: "OVERDUE",
      className:
        "border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] text-[var(--admin-danger)]",
    };
  }
  if (plan.status === "completed") {
    return {
      label: "COMPLETED",
      className:
        "border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]",
    };
  }
  if (plan.status === "cancelled") {
    return {
      label: "CANCELLED",
      className:
        "border-[var(--admin-border)] bg-[var(--admin-surface-variant)] text-[var(--admin-on-surface-variant)]",
    };
  }
  return {
    label: "ACTIVE",
    className:
      "border-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] text-[var(--admin-primary)]",
  };
}

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

export function AdminPaymentsInstalmentsLedgerPage() {
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [status, setStatus] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productTitleApplied, setProductTitleApplied] = useState("");
  const [pricingPlanLabel, setPricingPlanLabel] = useState("");
  const [pricingPlanLabelApplied, setPricingPlanLabelApplied] = useState("");
  const [nextDue, setNextDue] = useState<"" | "overdue" | "7days" | "30days">("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortBy, setSortBy] = useState("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<PaymentInstalmentColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<PaymentInstalmentColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [items, setItems] = useState<PaymentInstalmentPlanItem[]>([]);
  const [summary, setSummary] = useState<PaymentInstalmentSummary>(EMPTY_SUMMARY);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<PaymentInstalmentScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: () => void }> = [];
    if (searchApplied) {
      chips.push({
        key: "search",
        label: `Search: ${searchApplied}`,
        clear: () => {
          setSearch("");
          setSearchApplied("");
          setPage(1);
        },
      });
    }
    if (status) {
      chips.push({
        key: "status",
        label: `Status: ${status}`,
        clear: () => {
          setStatus("");
          setPage(1);
        },
      });
    }
    if (productTitleApplied) {
      chips.push({
        key: "product",
        label: `Product: ${productTitleApplied}`,
        clear: () => {
          setProductTitle("");
          setProductTitleApplied("");
          setPage(1);
        },
      });
    }
    if (pricingPlanLabelApplied) {
      chips.push({
        key: "pricing",
        label: `Plan: ${pricingPlanLabelApplied}`,
        clear: () => {
          setPricingPlanLabel("");
          setPricingPlanLabelApplied("");
          setPage(1);
        },
      });
    }
    if (nextDue) {
      chips.push({
        key: "nextDue",
        label: `Next due: ${nextDue}`,
        clear: () => {
          setNextDue("");
          setPage(1);
        },
      });
    }
    return chips;
  }, [nextDue, pricingPlanLabelApplied, productTitleApplied, searchApplied, status]);

  function applyTextFilters() {
    setSearchApplied(search.trim());
    setProductTitleApplied(productTitle.trim());
    setPricingPlanLabelApplied(pricingPlanLabel.trim());
    setPage(1);
  }

  const loadPlans = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentInstalments({
        q: searchApplied || undefined,
        status: status || undefined,
        productTitle: productTitleApplied || undefined,
        pricingPlanLabel: pricingPlanLabelApplied || undefined,
        nextDue: nextDue || undefined,
        sortBy,
        sortDir,
        columns,
        page,
        limit: pageSize,
      });
      setItems(response.data.items);
      setSummary(response.data.summary);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (loadError) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      setTotalCount(0);
      setTotalPages(0);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load instalment plans.",
      );
    } finally {
      setLoading(false);
    }
  }, [
    columns,
    nextDue,
    page,
    pageSize,
    pricingPlanLabelApplied,
    productTitleApplied,
    searchApplied,
    sortBy,
    sortDir,
    status,
  ]);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  async function openPlan(planId: string) {
    setSelectedPlanId(planId);
    setScheduleLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentInstalmentDetail(planId);
      setSchedule(response.data.instalments);
    } catch (detailError) {
      setSchedule([]);
      setError(
        detailError instanceof ClientApiError
          ? detailError.message
          : detailError instanceof Error
            ? detailError.message
            : "Unable to load instalment schedule.",
      );
    } finally {
      setScheduleLoading(false);
    }
  }

  function clearAllFilters() {
    setSearch("");
    setSearchApplied("");
    setStatus("");
    setProductTitle("");
    setProductTitleApplied("");
    setPricingPlanLabel("");
    setPricingPlanLabelApplied("");
    setNextDue("");
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportPaymentInstalments({
        q: searchApplied || undefined,
        status: status || undefined,
        sortBy,
        sortDir,
        columns,
        emailDownloadLink: true,
      });
      const completed = await pollReportRunUntilComplete(response.data.runId);
      if (completed.status !== "completed") {
        throw new Error(completed.errorMessage ?? "Export failed.");
      }
      await downloadReportExport(completed.id, "csv");
    } catch (exportError) {
      setError(
        exportError instanceof ClientApiError
          ? exportError.message
          : exportError instanceof Error
            ? exportError.message
            : "Unable to export instalments.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handlePayNext() {
    if (!selectedPlanId) return;
    setBusy(true);
    setError(null);
    try {
      await payPaymentInstalment(selectedPlanId);
      await openPlan(selectedPlanId);
      await loadPlans();
    } catch (payError) {
      setError(
        payError instanceof ClientApiError
          ? payError.message
          : payError instanceof Error
            ? payError.message
            : "Unable to record instalment payment.",
      );
    } finally {
      setBusy(false);
    }
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const showEmpty = !loading && !error && items.length === 0;
  const hasFilters = activeFilterChips.length > 0;
  const showCol = (key: PaymentInstalmentColumnKey) => columns.includes(key);
  const selectedPlan = items.find((item) => item.id === selectedPlanId) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PaymentsReportTabs active="instalment" />

      <div className="flex flex-col gap-4 border-b border-[var(--admin-border)] pb-4">
        <nav className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
          <Link href="/admin" className="hover:text-[var(--admin-primary)]">
            Admin
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/enrollments" className="hover:text-[var(--admin-primary)]">
            Reports
          </Link>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <Link href="/admin/reports/payments" className="hover:text-[var(--admin-primary)]">
            Payments
          </Link>
        </nav>

        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-3xl">
              Instalment plans
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
              Track split payments, remaining balances, and overdue schedules.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                className={[
                  "inline-flex h-9 items-center gap-2 rounded border px-3 font-mono text-xs font-bold uppercase tracking-wide",
                  columnsOpen
                    ? "border-[var(--admin-primary)] bg-[var(--admin-surface-high)] text-[var(--admin-primary)]"
                    : "border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)]",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  setDraftColumns(columns);
                  setColumnsOpen((open) => !open);
                }}
              >
                <Columns3 className="h-4 w-4" aria-hidden="true" />
                Columns
              </button>
              {columnsOpen ? (
                <div
                  className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(420px,calc(100vw-2rem))] border border-[var(--admin-border)] bg-[var(--admin-surface-high)] shadow-2xl"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <div className="grid max-h-[320px] grid-cols-1 gap-1 overflow-y-auto p-4 sm:grid-cols-2">
                    {PAYMENT_INSTALMENT_COLUMN_OPTIONS.map((column) => (
                      <label
                        key={column.key}
                        className="flex cursor-pointer items-center gap-3 p-2 font-mono text-xs hover:bg-[var(--admin-surface)]"
                      >
                        <input
                          type="checkbox"
                          checked={draftColumns.includes(column.key)}
                          onChange={() => {
                            setDraftColumns((current) => {
                              if (current.includes(column.key)) {
                                const next = current.filter((key) => key !== column.key);
                                return next.length > 0 ? next : current;
                              }
                              return [...current, column.key];
                            });
                          }}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                        />
                        {column.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end border-t border-[var(--admin-border)] p-3">
                    <button
                      type="button"
                      className="rounded bg-[var(--admin-primary)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
                      onClick={() => {
                        setColumns(draftColumns);
                        setColumnsOpen(false);
                        setPage(1);
                      }}
                    >
                      Apply
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide disabled:opacity-50"
              disabled={busy || loading}
              onClick={() => void handleExport()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>
            <Link
              href="/admin/reports/payments/instalments/new"
              className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary)] px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create plan
            </Link>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] border border-[var(--admin-border)] md:grid-cols-5 md:divide-x md:divide-y-0">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className={`bg-[var(--admin-surface)] p-6 ${index === 0 ? "md:col-span-2" : ""}`}
            >
              <Shimmer className="mb-3 h-3 w-24" />
              <Shimmer className="h-8 w-40" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 divide-y divide-[var(--admin-border)] border border-[var(--admin-border)] bg-[var(--admin-surface-high)] md:grid-cols-5 md:divide-x md:divide-y-0">
          <div className="flex flex-col justify-center p-6 md:col-span-2">
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Outstanding balance
            </p>
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="font-mono text-2xl font-bold text-[var(--admin-on-surface)] md:text-3xl">
                {formatMoney(summary.outstandingCents, summary.currency)}
              </span>
              <span className="border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2 py-0.5 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                across {summary.outstandingPlanCount} active plans
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center p-6">
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Due next 7 days
            </p>
            <span className="font-mono text-xl font-semibold text-[var(--admin-on-surface)]">
              {formatMoney(summary.dueNext7DaysCents, summary.currency)}
            </span>
          </div>
          <div className="flex flex-col justify-center bg-[color-mix(in_srgb,var(--admin-danger)_8%,transparent)] p-6">
            <p className="mb-2 flex items-center gap-1 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-danger)]">
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
              Overdue
            </p>
            <span className="font-mono text-xl font-semibold text-[var(--admin-danger)]">
              {formatMoney(summary.overdueCents, summary.currency)}
            </span>
            <button
              type="button"
              className="mt-2 self-start text-left font-mono text-xs text-[var(--admin-danger)] underline decoration-[color-mix(in_srgb,var(--admin-danger)_50%,transparent)] hover:decoration-[var(--admin-danger)]"
              onClick={() => {
                setStatus("overdue");
                setNextDue("overdue");
                setPage(1);
              }}
            >
              {summary.overdueInstalmentCount} instalment
              {summary.overdueInstalmentCount === 1 ? "" : "s"}
            </button>
          </div>
          <div className="flex flex-col justify-center p-6">
            <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Completed this month
            </p>
            <span className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
              {summary.completedThisMonthCount}
            </span>
          </div>
        </div>
      )}

      <div className="sticky top-0 z-20 flex flex-col gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Search
            </label>
            <div className="relative border-b border-[var(--admin-border)] focus-within:border-[var(--admin-primary)]">
              <Search className="absolute left-0 bottom-2 h-4 w-4 text-[var(--admin-on-surface-variant)]" />
              <input
                className="w-full bg-transparent py-2 pl-6 font-mono text-xs outline-none"
                placeholder="Learner, email, or product"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyTextFilters();
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Status
            </label>
            <Select
              value={status}
              onValueChange={(value) => {
                setStatus(value);
                setPage(1);
              }}
              options={STATUS_OPTIONS}
              ariaLabel="Status"
              className="h-9 min-w-[140px]"
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Pricing plan
            </label>
            <input
              className="h-9 w-36 border-b border-[var(--admin-border)] bg-transparent font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
              placeholder="Any"
              value={pricingPlanLabel}
              onChange={(event) => {
                setPricingPlanLabel(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyTextFilters();
              }}
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Product
            </label>
            <input
              className="h-9 w-40 border-b border-[var(--admin-border)] bg-transparent font-mono text-xs outline-none focus:border-[var(--admin-primary)]"
              placeholder="All products"
              value={productTitle}
              onChange={(event) => {
                setProductTitle(event.target.value);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") applyTextFilters();
              }}
            />
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Next due
            </label>
            <Select
              value={nextDue}
              onValueChange={(value) => {
                setNextDue(value as "" | "overdue" | "7days" | "30days");
                setPage(1);
              }}
              options={NEXT_DUE_OPTIONS}
              ariaLabel="Next due"
              className="h-9 min-w-[140px]"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-1 px-2 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]"
            onClick={applyTextFilters}
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Apply
          </button>
        </div>
        {activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-xs"
                onClick={chip.clear}
              >
                {chip.label}
                <X className="h-3.5 w-3.5 text-[var(--admin-danger)]" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              className="font-mono text-xs text-[var(--admin-on-surface-variant)] underline"
              onClick={clearAllFilters}
            >
              Clear all
            </button>
          </div>
        ) : null}
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-4 border border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] p-4">
          <div className="flex items-center gap-3 text-[var(--admin-danger)]">
            <AlertTriangle className="h-5 w-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold">Couldn&apos;t load instalment data</p>
              <p className="font-mono text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-[var(--admin-danger)] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-danger)]"
            onClick={() => void loadPlans()}
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
            Retry
          </button>
        </div>
      ) : null}

      {loading ? (
        <div
          className="border border-[var(--admin-border)] bg-[var(--admin-surface)]"
          aria-busy="true"
        >
          <div className="grid grid-cols-6 gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Shimmer key={index} className="h-3" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-6 items-center gap-4 border-b border-[var(--admin-border)] px-4 py-4 last:border-0"
            >
              <Shimmer className="h-4 w-24" />
              <div className="flex items-center gap-2">
                <Shimmer className="h-6 w-6 rounded-full" />
                <Shimmer className="h-4 w-28" />
              </div>
              <Shimmer className="h-4 w-32" />
              <Shimmer className="h-2 w-full" />
              <Shimmer className="h-4 w-20" />
              <Shimmer className="ml-auto h-4 w-16" />
            </div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="relative flex min-h-[360px] flex-col items-center justify-center overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
          <Receipt
            className="mb-6 h-16 w-16 text-[var(--admin-on-surface-variant)]"
            strokeWidth={1.25}
          />
          <h2 className="mb-2 text-center text-xl font-semibold text-[var(--admin-on-surface)]">
            {hasFilters ? "No plans match these filters" : "No instalment plans yet"}
          </h2>
          <p className="mb-8 max-w-md text-center text-sm text-[var(--admin-on-surface-variant)]">
            {hasFilters
              ? "Try clearing status or next-due filters to see more plans."
              : "Create a plan to split a purchase into scheduled payments."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              className="rounded bg-[var(--admin-primary)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
              onClick={clearAllFilters}
            >
              Reset filters
            </button>
          ) : (
            <Link
              href="/admin/reports/payments/instalments/new"
              className="inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create plan
            </Link>
          )}
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[960px] border-collapse text-left">
                <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  <tr>
                    {showCol("learner_name") || showCol("email") ? (
                      <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Learner
                      </th>
                    ) : null}
                    {showCol("product_title") ? (
                      <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Product
                      </th>
                    ) : null}
                    {showCol("pricing_plan_label") ? (
                      <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Pricing
                      </th>
                    ) : null}
                    <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Progress
                    </th>
                    {showCol("remaining_amount_cents") || showCol("total_amount_cents") ? (
                      <th className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Remaining
                      </th>
                    ) : null}
                    {showCol("next_due_at") ? (
                      <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-primary)]">
                        <button
                          type="button"
                          onClick={() => {
                            setSortBy("next_due_at");
                            setSortDir((current) => (current === "asc" ? "desc" : "asc"));
                            setPage(1);
                          }}
                        >
                          Next due
                        </button>
                      </th>
                    ) : null}
                    {showCol("status") ? (
                      <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                        Status
                      </th>
                    ) : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--admin-border)]">
                  {items.map((plan) => {
                    const badge = statusBadge(plan);
                    const progress =
                      plan.instalmentCount > 0
                        ? Math.round((plan.paidCount / plan.instalmentCount) * 100)
                        : 0;
                    return (
                      <tr
                        key={plan.id}
                        className={[
                          "cursor-pointer transition-colors hover:bg-[var(--admin-surface-low)]",
                          selectedPlanId === plan.id
                            ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)]"
                            : "",
                        ].join(" ")}
                        onClick={() => void openPlan(plan.id)}
                      >
                        {showCol("learner_name") || showCol("email") ? (
                          <td className="p-3 align-top">
                            <Link
                              href={`/admin/reports/payments/instalments/${plan.id}`}
                              className="text-sm font-medium text-[var(--admin-primary)] hover:underline"
                              onClick={(event) => {
                                event.stopPropagation();
                              }}
                            >
                              {plan.learnerName ?? "Learner"}
                            </Link>
                            {showCol("email") && plan.email ? (
                              <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                                {plan.email}
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                        {showCol("product_title") ? (
                          <td className="p-3 align-top text-sm text-[var(--admin-on-surface-variant)]">
                            {plan.productTitle}
                          </td>
                        ) : null}
                        {showCol("pricing_plan_label") ? (
                          <td className="p-3 align-top font-mono text-xs text-[var(--admin-on-surface-variant)]">
                            {plan.pricingPlanLabel ?? "—"}
                          </td>
                        ) : null}
                        <td className="p-3 align-top">
                          <div className="mb-1 font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                            {plan.paidCount}/{plan.instalmentCount || "—"}
                          </div>
                          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[var(--admin-surface-variant)]">
                            <div
                              className="h-full bg-[var(--admin-primary)]"
                              style={{ width: `${String(progress)}%` }}
                            />
                          </div>
                        </td>
                        {showCol("remaining_amount_cents") || showCol("total_amount_cents") ? (
                          <td className="p-3 align-top text-right font-mono text-xs">
                            <div className="text-[var(--admin-on-surface)]">
                              {formatMoney(plan.remainingAmountCents, plan.currency)}
                            </div>
                            {showCol("total_amount_cents") ? (
                              <div className="text-[var(--admin-on-surface-variant)]">
                                of {formatMoney(plan.totalAmountCents, plan.currency)}
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                        {showCol("next_due_at") ? (
                          <td
                            className={[
                              "p-3 align-top font-mono text-xs",
                              plan.overdueCount > 0
                                ? "text-[var(--admin-danger)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {formatDate(plan.nextDueAt)}
                          </td>
                        ) : null}
                        {showCol("status") ? (
                          <td className="p-3 align-top">
                            <span
                              className={`inline-flex rounded border px-2 py-0.5 font-mono text-[10px] font-bold tracking-wide ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 sm:flex-row sm:items-center">
              <div className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {rangeStart}-{rangeEnd} of {totalCount}
              </div>
              <div className="flex items-center gap-4">
                <Select
                  value={String(pageSize)}
                  onValueChange={(value) => {
                    setPageSize(Number(value));
                    setPage(1);
                  }}
                  options={PAGE_SIZE_OPTIONS}
                  ariaLabel="Rows per page"
                  className="h-8 min-w-[72px]"
                />
                <button
                  type="button"
                  className="p-1 disabled:opacity-40"
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((current) => Math.max(1, current - 1));
                  }}
                  aria-label="Previous page"
                >
                  <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="p-1 disabled:opacity-40"
                  disabled={totalPages === 0 || page >= totalPages}
                  onClick={() => {
                    setPage((current) => current + 1);
                  }}
                  aria-label="Next page"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>

          <aside className="border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
            <h2 className="mb-3 border-b border-[var(--admin-border)] pb-2 text-lg font-semibold text-[var(--admin-on-surface)]">
              Schedule
            </h2>
            {!selectedPlanId ? (
              <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                Select a plan to view instalments and record the next payment.
              </p>
            ) : scheduleLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Shimmer key={index} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <>
                {selectedPlan ? (
                  <div className="mb-4">
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      {selectedPlan.learnerName ?? "Learner"}
                    </p>
                    <p className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                      {selectedPlan.productTitle}
                    </p>
                    <Link
                      href={`/admin/reports/payments/instalments/${selectedPlan.id}`}
                      className="mt-1 mr-3 inline-block font-mono text-xs text-[var(--admin-primary)] hover:underline"
                    >
                      Open plan
                    </Link>
                    <Link
                      href={`/admin/members/${selectedPlan.membershipId}`}
                      className="mt-1 inline-block font-mono text-xs text-[var(--admin-primary)] hover:underline"
                    >
                      View learner
                    </Link>
                  </div>
                ) : null}
                <div className="mb-4 space-y-2">
                  {schedule.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 py-2"
                    >
                      <div>
                        <div className="font-mono text-xs text-[var(--admin-on-surface)]">
                          #{item.sequenceNo} ·{" "}
                          {formatMoney(item.amountCents, selectedPlan?.currency ?? "USD")}
                        </div>
                        <div className="font-mono text-[10px] text-[var(--admin-on-surface-variant)]">
                          Due {formatDate(item.dueAt)}
                          {item.paidAt ? ` · Paid ${formatDate(item.paidAt)}` : ""}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] uppercase text-[var(--admin-on-surface-variant)]">
                        {item.status}
                      </span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  className="inline-flex w-full items-center justify-center gap-2 rounded bg-[var(--admin-primary)] px-4 py-2 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)] disabled:opacity-50"
                  disabled={busy || schedule.every((item) => item.status === "paid")}
                  onClick={() => void handlePayNext()}
                >
                  Record next payment
                </button>
              </>
            )}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
