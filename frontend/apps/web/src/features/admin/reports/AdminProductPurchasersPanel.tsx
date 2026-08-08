"use client";

import {
  AlertTriangle,
  ArrowLeft,
  Columns3,
  Copy,
  Download,
  ExternalLink,
  History,
  RefreshCw,
  Search,
  Tag,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  createSalesMarketingGroup,
  dateInputToEndIso,
  dateInputToStartIso,
  exportSalesMarketingReport,
  fetchSalesPurchasers,
  sendSalesMarketingMessage,
  SALES_PURCHASER_COLUMN_OPTIONS,
  type SalesPurchaserColumnKey,
  type SalesPurchaserItem,
  type SalesPurchasersList,
} from "./admin-sales-marketing-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

type Props = { courseId: string };

type CohortTab = "group" | "message";
type MembershipMode = "static" | "live";

const DEFAULT_COLUMNS: SalesPurchaserColumnKey[] = [
  "learner_name",
  "amount_cents",
  "enrolled_type",
  "coupon_code",
  "payment_order_id",
  "purchased_at",
];

const ENROLLED_TYPE_OPTIONS = [
  { value: "", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "trial", label: "Trial" },
];

function formatMoneyAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function initials(name: string | null, email: string | null): string {
  const source = (name?.trim() || email?.trim() || "?").replace(/\s+/g, " ");
  const parts = source.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    return `${defined(parts[0])[0] ?? ""}${defined(parts[1])[0] ?? ""}`.toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

function formatRelativeTime(iso: string): string {
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

function productTypeLabel(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized.includes("sub")) return "Subscription";
  if (normalized.includes("bundle")) return "Bundle";
  if (normalized.includes("live")) return "Live class";
  if (normalized.includes("digital") || normalized.includes("ebook")) return "Digital";
  if (!type.trim()) return "Course";
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
}

function statusPillClass(status: string): string {
  const normalized = status.toUpperCase();
  if (normalized === "PUBLISHED") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  if (normalized === "DRAFT") {
    return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function enrolledTypePillClass(type: string | null): string {
  const normalized = (type ?? "").toLowerCase();
  if (normalized === "trial") {
    return "bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] text-[var(--admin-warning)]";
  }
  if (normalized === "paid") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] text-[var(--admin-success)]";
  }
  return "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
}

function shortOrderId(item: SalesPurchaserItem): string {
  const raw = item.invoiceNumber || item.paymentOrderId || "";
  if (!raw) return "—";
  return `#${raw.slice(0, 8)}`;
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

function PurchasersSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading purchasers">
      <Shimmer className="h-4 w-28" />
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="space-y-2">
          <Shimmer className="h-8 w-72 max-w-full" />
          <div className="flex gap-2">
            <Shimmer className="h-5 w-20" />
            <Shimmer className="h-5 w-24" />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Shimmer className="h-9 w-24" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-28" />
          <Shimmer className="h-9 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-6">
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className={[
              "bg-[var(--admin-surface)] p-4",
              index === 0 ? "col-span-2 sm:col-span-1 lg:col-span-2" : "",
            ].join(" ")}
          >
            <Shimmer className="mb-3 h-3 w-20" />
            <Shimmer className="h-8 w-28" />
            <Shimmer className="mt-2 h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-wrap gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
          <Shimmer className="h-9 w-48" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-36" />
          <Shimmer className="h-9 w-32" />
          <Shimmer className="h-9 w-20" />
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

export function AdminProductPurchasersPanel({ courseId }: Props) {
  const columnsPanelId = useId();
  const columnsRef = useRef<HTMLDivElement>(null);
  const [payload, setPayload] = useState<SalesPurchasersList | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [searchQ, setSearchQ] = useState("");
  const [draftQ, setDraftQ] = useState("");
  const [purchasedFrom, setPurchasedFrom] = useState("");
  const [purchasedTo, setPurchasedTo] = useState("");
  const [draftFrom, setDraftFrom] = useState("");
  const [draftTo, setDraftTo] = useState("");
  const [enrolledType, setEnrolledType] = useState("");
  const [draftEnrolledType, setDraftEnrolledType] = useState("");
  const [page, setPage] = useState(1);

  const [columns, setColumns] = useState<SalesPurchaserColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<SalesPurchaserColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [cohortTab, setCohortTab] = useState<CohortTab>("group");
  const [groupName, setGroupName] = useState("");
  const [groupDescription, setGroupDescription] = useState("");
  const [membershipMode, setMembershipMode] = useState<MembershipMode>("static");
  const [messageSubject, setMessageSubject] = useState("");
  const [messageBody, setMessageBody] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchSalesPurchasers(courseId, {
        q: searchQ.trim() || undefined,
        enrolledType: enrolledType || undefined,
        purchasedFrom: dateInputToStartIso(purchasedFrom),
        purchasedTo: dateInputToEndIso(purchasedTo),
        columns,
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
            : "Couldn't load purchaser data.",
      );
    } finally {
      setLoading(false);
    }
  }, [columns, courseId, enrolledType, page, purchasedFrom, purchasedTo, searchQ]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [columnsOpen]);

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
    setGroupName(`Purchasers — ${payload.productTitle}`);
    setGroupDescription("");
    setMembershipMode("static");
    setMessageSubject("");
    setMessageBody("");
    setActionError(null);
    setCohortTab("group");
  }, [drawerOpen, payload]);

  function applyFilters() {
    setSearchQ(draftQ);
    setPurchasedFrom(draftFrom);
    setPurchasedTo(draftTo);
    setEnrolledType(draftEnrolledType);
    setPage(1);
    setSelectedIds(new Set());
  }

  function clearAllFilters() {
    setDraftQ("");
    setDraftFrom("");
    setDraftTo("");
    setDraftEnrolledType("");
    setSearchQ("");
    setPurchasedFrom("");
    setPurchasedTo("");
    setEnrolledType("");
    setPage(1);
    setSelectedIds(new Set());
  }

  function resetDateRange() {
    setDraftFrom("");
    setDraftTo("");
    setPurchasedFrom("");
    setPurchasedTo("");
    setPage(1);
  }

  function toggleDraftColumn(key: SalesPurchaserColumnKey) {
    setDraftColumns((current) => {
      if (current.includes(key)) {
        if (key === "learner_name") return current;
        if (current.length <= 1) return current;
        return current.filter((item) => item !== key);
      }
      return [...current, key];
    });
  }

  function toggleSelectAllOnPage(items: SalesPurchaserItem[]) {
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

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportSalesMarketingReport({
        section: "sales",
        courseId,
        q: searchQ.trim() || undefined,
        purchasedFrom: dateInputToStartIso(purchasedFrom),
        purchasedTo: dateInputToEndIso(purchasedTo),
        columns,
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
        courseId,
        title: groupName.trim(),
        ...(groupDescription.trim() ? { description: groupDescription.trim() } : {}),
        ...(selected.length > 0
          ? { membershipIds: selected }
          : {
              ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
              ...(enrolledType ? { enrolledType } : {}),
              purchasedFrom: dateInputToStartIso(purchasedFrom),
              purchasedTo: dateInputToEndIso(purchasedTo),
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
        courseId,
        subject: messageSubject.trim(),
        message: messageBody.trim(),
        ...(selected.length > 0
          ? { membershipIds: selected }
          : {
              ...(searchQ.trim() ? { q: searchQ.trim() } : {}),
              ...(enrolledType ? { enrolledType } : {}),
              purchasedFrom: dateInputToStartIso(purchasedFrom),
              purchasedTo: dateInputToEndIso(purchasedTo),
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

  async function handleCopyOrder(item: SalesPurchaserItem) {
    const value = item.invoiceNumber || item.paymentOrderId;
    if (!value) return;
    const ok = await copyToClipboard(value);
    if (ok) {
      setCopiedId(item.membershipId);
      window.setTimeout(() => {
        setCopiedId((current) => (current === item.membershipId ? null : current));
      }, 1500);
    }
  }

  const items = payload?.items ?? [];
  const pageInfo = payload?.pageInfo;
  const isEmpty =
    !loading &&
    !error &&
    payload != null &&
    payload.pageInfo.totalCount === 0 &&
    items.length === 0;
  const allOnPageSelected =
    items.length > 0 && items.every((item) => selectedIds.has(item.membershipId));
  const selectedCount = selectedIds.size;
  const matchCount = selectedCount > 0 ? selectedCount : (pageInfo?.totalCount ?? 0);

  const filterChips = useMemo(() => {
    const chips: string[] = [];
    if (payload?.productTitle) chips.push(payload.productTitle);
    if (enrolledType) chips.push(`Status: ${enrolledType}`);
    if (purchasedFrom || purchasedTo) {
      chips.push(`Dates: ${purchasedFrom || "…"} – ${purchasedTo || "…"}`);
    }
    if (searchQ.trim()) chips.push(`Search: ${searchQ.trim()}`);
    return chips;
  }, [enrolledType, payload?.productTitle, purchasedFrom, purchasedTo, searchQ]);

  const visibleColumns = useMemo(
    () => SALES_PURCHASER_COLUMN_OPTIONS.filter((column) => columns.includes(column.key)),
    [columns],
  );

  if (loading && !payload) {
    return <PurchasersSkeleton />;
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/reports/sales-marketing/sales"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All products
      </Link>

      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-start">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
              {payload?.productTitle ?? "Purchasers"}
            </h1>
            {payload ? (
              <>
                <span className="rounded bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                  {productTypeLabel(payload.productType)}
                </span>
                <span
                  className={[
                    "rounded px-2 py-0.5 text-xs font-medium capitalize",
                    statusPillClass(payload.productStatus),
                  ].join(" ")}
                >
                  {payload.productStatus.toLowerCase()}
                </span>
              </>
            ) : null}
          </div>
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Purchasers, paid and trial learners, and order details for this product.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" ref={columnsRef}>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
              aria-expanded={columnsOpen}
              aria-controls={columnsPanelId}
              onClick={() => {
                setDraftColumns(columns);
                setColumnsOpen((open) => !open);
              }}
            >
              <Columns3 className="h-4 w-4" aria-hidden="true" />
              Columns
            </button>
            {columnsOpen ? (
              <div
                id={columnsPanelId}
                className="absolute right-0 top-[calc(100%+8px)] z-40 w-[min(300px,calc(100vw-2rem))] rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
              >
                <div className="flex items-center justify-between border-b border-[var(--admin-border)] px-4 py-3">
                  <h3 className="text-sm font-semibold text-[var(--admin-on-surface)]">Columns</h3>
                  <button
                    type="button"
                    className="rounded p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    onClick={() => {
                      setColumnsOpen(false);
                    }}
                    aria-label="Close columns panel"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
                <ul className="max-h-[280px] space-y-1 overflow-y-auto p-3">
                  {SALES_PURCHASER_COLUMN_OPTIONS.map((column) => {
                    const checked = draftColumns.includes(column.key);
                    const locked =
                      column.key === "learner_name" && checked && draftColumns.length === 1;
                    return (
                      <li key={column.key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[var(--admin-surface-low)]">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[var(--admin-primary)]"
                            checked={checked}
                            disabled={locked || (column.key === "learner_name" && checked)}
                            onChange={() => {
                              toggleDraftColumn(column.key);
                            }}
                          />
                          <span className="text-xs text-[var(--admin-on-surface)]">
                            {column.label}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
                <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
                  <button
                    type="button"
                    className="text-xs font-medium text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                    onClick={() => {
                      setDraftColumns(DEFAULT_COLUMNS);
                    }}
                  >
                    Reset to default
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded bg-[var(--admin-primary-strong)] px-3 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                    onClick={() => {
                      const next = draftColumns.includes("learner_name")
                        ? draftColumns
                        : (["learner_name", ...draftColumns] as SalesPurchaserColumnKey[]);
                      setColumns(next);
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
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px disabled:opacity-50"
            onClick={() => void handleExport()}
            disabled={busy || loading || Boolean(error)}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>

          <Link
            href={`/studio/courses/${courseId}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 text-xs font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
          >
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            Open product
          </Link>

          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-4 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px disabled:opacity-50"
            onClick={() => {
              setDrawerOpen(true);
            }}
            disabled={!payload || Boolean(error)}
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
                Couldn&apos;t load purchaser data.
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
          <PurchasersSkeleton />
        </div>
      ) : null}

      {!error && payload ? (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-border)] sm:grid-cols-3 lg:grid-cols-6">
            <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-2">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Revenue</p>
              <p className="font-mono text-[28px] font-semibold leading-tight tracking-tight text-[var(--admin-on-surface)]">
                {formatMoneyAmount(payload.revenueCents)}
                <span className="ml-2 text-sm font-normal text-[var(--admin-on-surface-variant)]">
                  {payload.currency}
                </span>
              </p>
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Purchasers</p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {payload.purchaserCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Paid</p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-on-surface)]">
                {payload.paidLearnerCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-[var(--admin-surface)] p-4">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Trial</p>
              <p className="font-mono text-2xl font-semibold text-[var(--admin-warning)]">
                {payload.trialLearnerCount.toLocaleString()}
              </p>
            </div>
            <div className="col-span-2 bg-[var(--admin-surface)] p-4 sm:col-span-1 lg:col-span-1">
              <p className="mb-1 text-xs text-[var(--admin-on-surface-variant)]">Average order</p>
              <p className="font-mono text-lg font-semibold text-[var(--admin-on-surface)]">
                {formatMoneyAmount(payload.avgOrderCents)}
                <span className="ml-1 text-[10px] font-normal text-[var(--admin-on-surface-variant)]">
                  {payload.currency}
                </span>
              </p>
              <p className="mt-2 text-[11px] text-[var(--admin-on-surface-variant)]">
                Discounted orders {payload.discountedOrderCount.toLocaleString()}
                <span className="ml-1">({payload.discountedOrderPercent}% used a coupon)</span>
              </p>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
            <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:flex-row md:flex-wrap md:items-end md:justify-between">
              <div className="flex flex-wrap gap-3">
                <label className="relative flex flex-col gap-1.5">
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Search</span>
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
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">From</span>
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
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">To</span>
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
                  <span className="text-xs text-[var(--admin-on-surface-variant)]">Enrolment</span>
                  <Select
                    value={draftEnrolledType}
                    onValueChange={setDraftEnrolledType}
                    options={ENROLLED_TYPE_OPTIONS}
                    ariaLabel="Enrolment type"
                    className="h-9 min-w-[140px]"
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
                  onClick={() => void load()}
                >
                  <RefreshCw className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {selectedCount > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))] px-4 py-2.5">
                <p className="text-sm text-[var(--admin-on-surface)]">
                  <span className="font-mono font-semibold">{selectedCount}</span> selected
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="inline-flex h-8 items-center rounded border border-[var(--admin-outline)] px-3 text-xs text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                    onClick={() => {
                      setSelectedIds(new Set());
                    }}
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-8 items-center gap-1.5 rounded bg-[var(--admin-primary-strong)] px-3 text-xs font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                    onClick={() => {
                      setDrawerOpen(true);
                    }}
                  >
                    <Users className="h-3.5 w-3.5" aria-hidden="true" />
                    Cohort actions
                  </button>
                </div>
              </div>
            ) : null}

            {isEmpty ? (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 py-12 text-center">
                <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-low)] shadow-sm">
                  <Tag
                    className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                    strokeWidth={1.5}
                    aria-hidden="true"
                  />
                </div>
                <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
                  No purchasers matched these filters
                </h2>
                <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
                  Try clearing filters or resetting the date range to see all purchasers for this
                  product.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded bg-[var(--admin-primary-strong)] px-5 text-sm font-medium text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary)] active:translate-y-px"
                    onClick={clearAllFilters}
                  >
                    Clear all filters
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-10 items-center gap-2 rounded border border-[var(--admin-outline)] px-5 text-sm font-medium text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] active:translate-y-px"
                    onClick={resetDateRange}
                  >
                    <History className="h-4 w-4" aria-hidden="true" />
                    Reset date range
                  </button>
                </div>
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
                        {visibleColumns.map((column) => (
                          <th
                            key={column.key}
                            className={[
                              "px-4 py-3 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]",
                              column.key === "amount_cents" || column.key === "currency"
                                ? "text-right"
                                : "",
                            ].join(" ")}
                          >
                            {column.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const selected = selectedIds.has(item.membershipId);
                        const orderLabel = shortOrderId(item);
                        const orderValue = item.invoiceNumber || item.paymentOrderId;
                        return (
                          <tr
                            key={`${item.membershipId}-${item.purchasedAt}`}
                            className={[
                              "group border-b border-[var(--admin-border)] transition-colors last:border-b-0",
                              selected
                                ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,var(--admin-surface))]"
                                : "hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,transparent)]",
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
                                aria-label={`Select ${item.learnerName ?? item.email ?? "purchaser"}`}
                              />
                            </td>
                            {columns.includes("learner_name") ? (
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
                            ) : null}
                            {columns.includes("email") ? (
                              <td className="h-11 px-4 text-sm text-[var(--admin-on-surface)]">
                                {item.email ?? "—"}
                              </td>
                            ) : null}
                            {columns.includes("amount_cents") ? (
                              <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface)]">
                                {formatMoneyAmount(item.amountCents)}
                                <span className="ml-1 text-[10px] text-[var(--admin-on-surface-variant)]">
                                  {item.currency}
                                </span>
                              </td>
                            ) : null}
                            {columns.includes("currency") ? (
                              <td className="h-11 px-4 text-right font-mono text-sm text-[var(--admin-on-surface-variant)]">
                                {item.currency}
                              </td>
                            ) : null}
                            {columns.includes("enrolled_type") ? (
                              <td className="h-11 px-4">
                                <span
                                  className={[
                                    "inline-flex rounded px-2 py-0.5 text-xs font-medium capitalize",
                                    enrolledTypePillClass(item.enrolledType),
                                  ].join(" ")}
                                >
                                  {item.enrolledType ?? "—"}
                                </span>
                              </td>
                            ) : null}
                            {columns.includes("coupon_code") ? (
                              <td className="h-11 px-4 font-mono text-xs uppercase text-[var(--admin-on-surface)]">
                                {item.couponCode ?? "—"}
                              </td>
                            ) : null}
                            {columns.includes("payment_order_id") ? (
                              <td className="h-11 px-4">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-mono text-[11px] text-[var(--admin-on-surface)]">
                                    {orderLabel}
                                  </span>
                                  {orderValue ? (
                                    <button
                                      type="button"
                                      className="rounded p-0.5 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity hover:text-[var(--admin-primary)] group-hover:opacity-100"
                                      title={
                                        copiedId === item.membershipId ? "Copied" : "Copy order id"
                                      }
                                      onClick={() => void handleCopyOrder(item)}
                                    >
                                      <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                                    </button>
                                  ) : null}
                                </div>
                              </td>
                            ) : null}
                            {columns.includes("purchased_at") ? (
                              <td className="h-11 px-4">
                                <p className="text-sm text-[var(--admin-on-surface)]">
                                  {formatRelativeTime(item.purchasedAt)}
                                </p>
                                <p className="text-[11px] text-[var(--admin-on-surface-variant)]">
                                  {formatAbsoluteDateTime(item.purchasedAt)}
                                </p>
                              </td>
                            ) : null}
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
                      {pageInfo.totalCount} purchasers
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
        </>
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
                  {matchCount.toLocaleString()} purchasers match the current filters
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
                          Capture the current matched purchasers as group members.
                        </span>
                      </span>
                    </label>
                    <label className="flex cursor-pointer items-start gap-2 rounded border border-[var(--admin-border)] p-3 hover:bg-[var(--admin-surface-low)]">
                      <input
                        type="radio"
                        name="membership-mode"
                        className="mt-0.5 accent-[var(--admin-primary)]"
                        checked={membershipMode === "live"}
                        onChange={() => {
                          setMembershipMode("live");
                        }}
                      />
                      <span>
                        <span className="block text-sm font-medium text-[var(--admin-on-surface)]">
                          Live Sync
                        </span>
                        <span className="text-xs text-[var(--admin-on-surface-variant)]">
                          Keep the group in sync with matching purchasers over time.
                        </span>
                      </span>
                    </label>
                  </fieldset>
                  {membershipMode === "live" ? (
                    <p className="rounded border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-warning)_8%,var(--admin-surface))] px-3 py-2 text-xs text-[var(--admin-warning)]">
                      Live sync isn&apos;t available yet. Choose Static Snapshot to create a group
                      from the current selection or filters.
                    </p>
                  ) : null}
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
