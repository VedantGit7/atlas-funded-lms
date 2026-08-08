"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  FileText,
  MoreVertical,
  Receipt,
  RefreshCw,
  Search,
  Settings2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Select } from "@atlas/design-system";
import { ClientApiError } from "../../../lib/client-api";
import {
  dateInputToEndIso,
  dateInputToStartIso,
  downloadPaymentInvoice,
  exportPaymentInvoices,
  fetchPaymentInvoices,
  PAYMENT_INVOICE_COLUMN_OPTIONS,
  type PaymentInvoiceColumnKey,
  type PaymentInvoiceItem,
} from "./admin-payments-roster-api";
import { downloadReportExport, pollReportRunUntilComplete } from "./admin-reports-api";
import { PaymentsReportTabs } from "./PaymentsReportTabs";

const PAGE_SIZE_OPTIONS = [
  { value: "12", label: "12" },
  { value: "24", label: "24" },
  { value: "48", label: "48" },
];

const DEFAULT_COLUMNS: PaymentInvoiceColumnKey[] = [
  "invoice_number",
  "learner_name",
  "email",
  "billing_name",
  "product_title",
  "amount_cents",
  "tax_amount_cents",
  "currency",
  "paid_at",
];

type CurrencyTotal = { currency: string; amountCents: number };

function formatMoney(cents: number, currency: string): string {
  return `${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatAmount(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 24 * 60 * 60 * 1000);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
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

function downloadHtmlFile(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function AdminPaymentsInvoicesLedgerPage() {
  const router = useRouter();
  const defaults = useMemo(() => defaultRange(), []);
  const [paidFrom, setPaidFrom] = useState(defaults.from);
  const [paidTo, setPaidTo] = useState(defaults.to);
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const [currency, setCurrency] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [sortBy, setSortBy] = useState("paid_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [columns, setColumns] = useState<PaymentInvoiceColumnKey[]>(DEFAULT_COLUMNS);
  const [draftColumns, setDraftColumns] = useState<PaymentInvoiceColumnKey[]>(DEFAULT_COLUMNS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [items, setItems] = useState<PaymentInvoiceItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [pageByCurrency, setPageByCurrency] = useState<CurrencyTotal[]>([]);
  const [filteredByCurrency, setFilteredByCurrency] = useState<CurrencyTotal[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rowMenuId, setRowMenuId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  const currencyOptions = useMemo(() => {
    const seen = new Set<string>();
    const options = [{ value: "", label: "Currency: All" }];
    for (const row of filteredByCurrency) {
      const code = row.currency.toUpperCase();
      if (!code || seen.has(code)) continue;
      seen.add(code);
      options.push({ value: code, label: code });
    }
    if (currency && !seen.has(currency.toUpperCase())) {
      options.push({ value: currency.toUpperCase(), label: currency.toUpperCase() });
    }
    return options;
  }, [currency, filteredByCurrency]);

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
    if (currency) {
      chips.push({
        key: "currency",
        label: `Currency: ${currency}`,
        clear: () => {
          setCurrency("");
          setPage(1);
        },
      });
    }
    if (paidFrom !== defaults.from || paidTo !== defaults.to) {
      chips.push({
        key: "date",
        label: `Date: ${paidFrom} → ${paidTo}`,
        clear: () => {
          setPaidFrom(defaults.from);
          setPaidTo(defaults.to);
          setPage(1);
        },
      });
    }
    return chips;
  }, [currency, defaults.from, defaults.to, paidFrom, paidTo, searchApplied]);

  const loadInvoices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchPaymentInvoices({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        q: searchApplied || undefined,
        currency: currency || undefined,
        sortBy,
        sortDir,
        columns,
        page,
        limit: pageSize,
      });
      setItems(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
      setPageByCurrency(response.data.totals.pageByCurrency);
      setFilteredByCurrency(response.data.totals.filteredByCurrency);
      setSelectedIds(new Set());
    } catch (loadError) {
      setItems([]);
      setTotalCount(0);
      setTotalPages(0);
      setPageByCurrency([]);
      setFilteredByCurrency([]);
      setError(
        loadError instanceof ClientApiError
          ? loadError.message
          : loadError instanceof Error
            ? loadError.message
            : "Couldn't load invoice data.",
      );
    } finally {
      setLoading(false);
    }
  }, [columns, currency, page, pageSize, paidFrom, paidTo, searchApplied, sortBy, sortDir]);

  useEffect(() => {
    void loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    function onDocClick(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
      setRowMenuId(null);
    }
    document.addEventListener("click", onDocClick);
    return () => {
      document.removeEventListener("click", onDocClick);
    };
  }, []);

  function clearAllFilters() {
    setSearch("");
    setSearchApplied("");
    setCurrency("");
    setPaidFrom(defaults.from);
    setPaidTo(defaults.to);
    setPage(1);
  }

  function applySearch() {
    setSearchApplied(search.trim());
    setPage(1);
  }

  async function handleExport() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportPaymentInvoices({
        paidFrom: dateInputToStartIso(paidFrom),
        paidTo: dateInputToEndIso(paidTo),
        q: searchApplied || undefined,
        currency: currency || undefined,
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
            : "Unable to export invoices.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDownloadInvoice(orderId: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await downloadPaymentInvoice(orderId);
      downloadHtmlFile(response.data.filename, response.data.content);
    } catch (downloadError) {
      setError(
        downloadError instanceof ClientApiError
          ? downloadError.message
          : downloadError instanceof Error
            ? downloadError.message
            : "Unable to download invoice.",
      );
    } finally {
      setBusy(false);
      setRowMenuId(null);
    }
  }

  function toggleSelectAll() {
    if (selectedIds.size === items.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(items.map((item) => item.id)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, totalCount);
  const showEmpty = !loading && !error && items.length === 0;
  const hasFilters = activeFilterChips.length > 0;
  const showCol = (key: PaymentInvoiceColumnKey) => columns.includes(key);

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-6">
      <PaymentsReportTabs active="invoices" />

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
              Invoices
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-[var(--admin-on-surface-variant)]">
              Every invoice issued against a paid order. Numbering is automatic and sequential.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs">
              <input
                type="date"
                value={paidFrom}
                onChange={(event) => {
                  setPaidFrom(event.target.value);
                  setPage(1);
                }}
                className="bg-transparent outline-none"
                aria-label="Issued from"
              />
              <span className="text-[var(--admin-on-surface-variant)]">–</span>
              <input
                type="date"
                value={paidTo}
                onChange={(event) => {
                  setPaidTo(event.target.value);
                  setPage(1);
                }}
                className="bg-transparent outline-none"
                aria-label="Issued to"
              />
            </label>

            <div className="relative" ref={columnsRef}>
              <button
                type="button"
                className={[
                  "inline-flex h-9 items-center gap-2 rounded border px-3 font-mono text-xs font-bold uppercase tracking-wide transition-colors",
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
                  className="absolute right-0 top-[calc(100%+8px)] z-40 flex w-[min(420px,calc(100vw-2rem))] flex-col border border-[var(--admin-border)] bg-[var(--admin-surface-high)] shadow-2xl"
                  onClick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <div className="flex items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <h3 className="text-base font-semibold text-[var(--admin-on-surface)]">
                      Manage columns
                    </h3>
                    <button
                      type="button"
                      className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setColumnsOpen(false);
                      }}
                    >
                      <X className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="grid max-h-[320px] grid-cols-1 gap-1 overflow-y-auto p-4 sm:grid-cols-2">
                    {PAYMENT_INVOICE_COLUMN_OPTIONS.map((column) => {
                      const checked = draftColumns.includes(column.key);
                      return (
                        <label
                          key={column.key}
                          className="flex cursor-pointer items-center gap-3 rounded border border-transparent p-2 font-mono text-xs hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface)]"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
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
                          <span>{column.label}</span>
                        </label>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
                    <button
                      type="button"
                      className="font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                      onClick={() => {
                        setDraftColumns(DEFAULT_COLUMNS);
                      }}
                    >
                      Reset
                    </button>
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
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)] disabled:opacity-50"
              disabled={busy || loading}
              onClick={() => void handleExport()}
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Export CSV
            </button>

            <Link
              href="/admin/learner-billing/invoice-config"
              className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)]"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Invoice settings
            </Link>

            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded bg-[var(--admin-primary)] px-4 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
              onClick={() => {
                router.push("/admin/reports/payments/transactions");
              }}
              title="Invoices are issued automatically when an order is paid"
            >
              <Receipt className="h-4 w-4" aria-hidden="true" />
              View paid orders
            </button>
          </div>
        </div>
      </div>

      <div className="sticky top-0 z-20 flex flex-col gap-3 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Search
            </label>
            <div className="relative flex items-center border-b border-[var(--admin-border)] focus-within:border-[var(--admin-primary)]">
              <Search className="absolute left-2 h-4 w-4 text-[var(--admin-on-surface-variant)]" />
              <input
                className="w-full bg-transparent py-2 pl-8 pr-2 font-mono text-xs outline-none placeholder:text-[var(--admin-on-surface-variant)]"
                placeholder="Invoice #, learner, email, or billing name"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applySearch();
                }}
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
              Currency
            </label>
            <Select
              value={currency}
              onValueChange={(value) => {
                setCurrency(value);
                setPage(1);
              }}
              options={currencyOptions}
              ariaLabel="Currency"
              className="h-9 min-w-[140px]"
            />
          </div>
          <button
            type="button"
            className="inline-flex h-9 items-center gap-2 rounded border border-[var(--admin-primary)] px-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-primary)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)]"
            onClick={applySearch}
          >
            Apply
          </button>
        </div>

        {activeFilterChips.length > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--admin-border)] pt-3">
            {activeFilterChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2 py-1 font-mono text-xs text-[var(--admin-on-surface)]"
                onClick={chip.clear}
              >
                {chip.label}
                <X className="h-3.5 w-3.5 text-[var(--admin-danger)]" aria-hidden="true" />
              </button>
            ))}
            <button
              type="button"
              className="ml-1 font-mono text-xs text-[var(--admin-on-surface-variant)] underline underline-offset-2 hover:text-[var(--admin-primary)]"
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
              <p className="text-sm font-bold">Couldn&apos;t load invoice data</p>
              <p className="font-mono text-xs opacity-80">{error}</p>
            </div>
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-1 rounded border border-[var(--admin-danger)] px-3 py-1.5 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
            onClick={() => void loadInvoices()}
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
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="grid grid-cols-6 items-center gap-4 border-b border-[var(--admin-border)] px-4 py-4 last:border-0"
            >
              <Shimmer className="h-4 w-28" />
              <Shimmer className="h-4 w-24" />
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-4 w-16" />
              <Shimmer className="h-6 w-16" />
              <Shimmer className="ml-auto h-6 w-6" />
            </div>
          ))}
        </div>
      ) : null}

      {showEmpty ? (
        <div className="relative flex min-h-[380px] flex-col items-center justify-center overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[color-mix(in_srgb,var(--admin-primary)_40%,transparent)] to-transparent" />
          <div className="relative mb-6 flex h-24 w-24 items-center justify-center">
            <div className="absolute inset-0 rotate-45 border border-[var(--admin-border)] opacity-40" />
            <FileText
              className="relative z-10 h-12 w-12 text-[var(--admin-on-surface-variant)]"
              strokeWidth={1.25}
            />
          </div>
          <h2 className="mb-2 text-center text-xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            {hasFilters ? "No invoices match these filters" : "No invoices yet"}
          </h2>
          <p className="mb-8 max-w-md text-center text-sm text-[var(--admin-on-surface-variant)]">
            {hasFilters
              ? "Try widening the date range or clearing search and currency filters."
              : "Paid orders receive invoice numbers automatically. Configure numbering under Invoice settings."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
              onClick={clearAllFilters}
            >
              Reset filters
            </button>
          ) : (
            <Link
              href="/admin/learner-billing/invoice-config"
              className="inline-flex items-center gap-2 rounded bg-[var(--admin-primary)] px-6 py-3 font-mono text-xs font-bold uppercase tracking-wide text-[var(--admin-on-primary)]"
            >
              <Settings2 className="h-4 w-4" aria-hidden="true" />
              Invoice settings
            </Link>
          )}
        </div>
      ) : null}

      {!loading && !error && items.length > 0 ? (
        <div className="relative overflow-hidden border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          {selectedIds.size > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-4 py-3">
              <span className="font-mono text-xs font-bold text-[var(--admin-primary)]">
                {selectedIds.size} invoice{selectedIds.size === 1 ? "" : "s"} selected
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded border border-[var(--admin-border)] px-3 py-1.5 font-mono text-xs text-[var(--admin-on-surface)] hover:border-[var(--admin-primary)] disabled:opacity-50"
                  disabled={busy}
                  onClick={() => void handleExport()}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Export selection
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-3 py-1.5 font-mono text-xs text-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,transparent)]"
                  onClick={() => {
                    setSelectedIds(new Set());
                  }}
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Clear
                </button>
              </div>
            </div>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1080px] border-collapse text-left">
              <thead className="sticky top-0 z-10 border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                <tr>
                  <th className="w-10 p-3 text-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.size > 0 && selectedIds.size === items.length}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                      aria-label="Select all on page"
                    />
                  </th>
                  {showCol("invoice_number") ? (
                    <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Invoice #
                    </th>
                  ) : null}
                  {showCol("learner_name") || showCol("email") ? (
                    <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Learner
                    </th>
                  ) : null}
                  {showCol("billing_name") ? (
                    <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Billing name
                    </th>
                  ) : null}
                  {showCol("product_title") ? (
                    <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Product
                    </th>
                  ) : null}
                  {showCol("amount_cents") ? (
                    <th className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Price
                    </th>
                  ) : null}
                  {showCol("tax_amount_cents") ? (
                    <th className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Tax
                    </th>
                  ) : null}
                  {showCol("currency") ? (
                    <th className="p-3 text-center font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Currency
                    </th>
                  ) : null}
                  {showCol("paid_at") ? (
                    <th className="p-3 font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-primary)]">
                      <button
                        type="button"
                        className="inline-flex items-center gap-1"
                        onClick={() => {
                          setSortBy("paid_at");
                          setSortDir((current) => (current === "desc" ? "asc" : "desc"));
                          setPage(1);
                        }}
                      >
                        Issued date
                      </button>
                    </th>
                  ) : null}
                  <th className="p-3 text-center font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Status
                  </th>
                  <th className="p-3 text-right font-mono text-[11px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((invoice) => {
                  const selected = selectedIds.has(invoice.id);
                  return (
                    <tr
                      key={invoice.id}
                      className={[
                        "transition-colors hover:bg-[var(--admin-surface-low)]",
                        selected
                          ? "bg-[color-mix(in_srgb,var(--admin-primary)_6%,transparent)]"
                          : "",
                        invoice.status === "void"
                          ? "bg-[color-mix(in_srgb,var(--admin-danger)_4%,transparent)] opacity-70"
                          : "",
                      ].join(" ")}
                    >
                      <td className="p-3 text-center align-top">
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => {
                            toggleSelect(invoice.id);
                          }}
                          className="h-4 w-4 accent-[var(--admin-primary)]"
                          aria-label={`Select ${invoice.invoiceNumber}`}
                        />
                      </td>
                      {showCol("invoice_number") ? (
                        <td className="p-3 align-top">
                          <Link
                            href={`/admin/reports/payments/invoices/${invoice.id}`}
                            className={[
                              "font-mono text-xs font-medium hover:underline",
                              invoice.status === "void"
                                ? "text-[var(--admin-on-surface-variant)] line-through"
                                : "text-[var(--admin-primary)]",
                            ].join(" ")}
                          >
                            {invoice.invoiceNumber}
                          </Link>
                        </td>
                      ) : null}
                      {showCol("learner_name") || showCol("email") ? (
                        <td className="p-3 align-top">
                          {showCol("learner_name") ? (
                            <div className="text-sm font-medium text-[var(--admin-on-surface)]">
                              {invoice.membershipId ? (
                                <Link
                                  href={`/admin/members/${invoice.membershipId}`}
                                  className="hover:underline"
                                >
                                  {invoice.learnerName ?? "Learner"}
                                </Link>
                              ) : (
                                (invoice.learnerName ?? "—")
                              )}
                            </div>
                          ) : null}
                          {showCol("email") && invoice.email ? (
                            <div className="font-mono text-[11px] text-[var(--admin-on-surface-variant)]">
                              {invoice.email}
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                      {showCol("billing_name") ? (
                        <td className="p-3 align-top">
                          {invoice.billingNameDiffers ? (
                            <>
                              <div className="text-sm text-[var(--admin-on-surface)]">
                                {invoice.billingName ?? "—"}
                              </div>
                              <span className="mt-1 inline-block rounded bg-[color-mix(in_srgb,var(--admin-warning)_12%,transparent)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--admin-warning)]">
                                differs from learner
                              </span>
                            </>
                          ) : (
                            <div className="font-mono text-xs italic text-[var(--admin-on-surface-variant)]">
                              Same as learner
                            </div>
                          )}
                        </td>
                      ) : null}
                      {showCol("product_title") ? (
                        <td className="p-3 align-top text-sm text-[var(--admin-on-surface-variant)]">
                          {invoice.productTitle ?? "—"}
                        </td>
                      ) : null}
                      {showCol("amount_cents") ? (
                        <td className="p-3 align-top text-right font-mono text-xs text-[var(--admin-on-surface)]">
                          {formatAmount(invoice.amountCents)}
                        </td>
                      ) : null}
                      {showCol("tax_amount_cents") ? (
                        <td className="p-3 align-top text-right font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {invoice.taxAmountCents != null
                            ? formatAmount(invoice.taxAmountCents)
                            : "—"}
                        </td>
                      ) : null}
                      {showCol("currency") ? (
                        <td className="p-3 align-top text-center font-mono text-xs text-[var(--admin-on-surface)]">
                          {invoice.currency}
                        </td>
                      ) : null}
                      {showCol("paid_at") ? (
                        <td className="p-3 align-top font-mono text-xs text-[var(--admin-on-surface-variant)]">
                          {formatDate(invoice.paidAt ?? invoice.createdAt)}
                        </td>
                      ) : null}
                      <td className="p-3 align-top text-center">
                        {invoice.status === "void" ? (
                          <span className="inline-flex items-center justify-center rounded border border-[color-mix(in_srgb,var(--admin-danger)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-danger)_12%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-danger)]">
                            Void
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center rounded border border-[color-mix(in_srgb,var(--admin-success)_30%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,transparent)] px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-[var(--admin-success)]">
                            Issued
                          </span>
                        )}
                      </td>
                      <td className="relative p-3 align-top text-right whitespace-nowrap">
                        {invoice.status !== "void" ? (
                          <button
                            type="button"
                            className="mr-2 font-mono text-xs text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] disabled:opacity-50"
                            disabled={busy}
                            onClick={() => void handleDownloadInvoice(invoice.id)}
                          >
                            Download
                          </button>
                        ) : null}
                        <button
                          type="button"
                          className="text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
                          onClick={(event) => {
                            event.stopPropagation();
                            setRowMenuId((current) => (current === invoice.id ? null : invoice.id));
                          }}
                          aria-label="Row actions"
                        >
                          <MoreVertical
                            className="inline h-5 w-5 align-middle"
                            aria-hidden="true"
                          />
                        </button>
                        {rowMenuId === invoice.id ? (
                          <div className="absolute right-2 top-10 z-20 min-w-[180px] rounded border border-[var(--admin-border)] bg-[var(--admin-surface-high)] py-1 shadow-lg">
                            <Link
                              href={`/admin/reports/payments/invoices/${invoice.id}`}
                              className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                              onClick={() => {
                                setRowMenuId(null);
                              }}
                            >
                              Open preview
                            </Link>
                            {invoice.status !== "void" ? (
                              <button
                                type="button"
                                className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                                onClick={() => void handleDownloadInvoice(invoice.id)}
                              >
                                Download invoice
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                              onClick={() => {
                                setRowMenuId(null);
                                router.push(`/admin/reports/payments/transactions/${invoice.id}`);
                              }}
                            >
                              Open order
                            </button>
                            {invoice.membershipId ? (
                              <Link
                                href={`/admin/members/${invoice.membershipId}`}
                                className="block w-full px-3 py-2 text-left font-mono text-xs hover:bg-[var(--admin-surface)]"
                                onClick={() => {
                                  setRowMenuId(null);
                                }}
                              >
                                View learner
                              </Link>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-3 sm:flex-row sm:items-center">
            <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
              {pageByCurrency.length > 0 ? (
                pageByCurrency.map((row, index) => (
                  <div key={row.currency} className="flex items-center gap-2">
                    {index > 0 ? (
                      <div className="hidden h-4 w-px bg-[var(--admin-border)] sm:block" />
                    ) : null}
                    <span className="text-[var(--admin-on-surface-variant)]">Page total:</span>
                    <span className="font-bold text-[var(--admin-on-surface)]">
                      {formatMoney(row.amountCents, row.currency)}
                    </span>
                  </div>
                ))
              ) : (
                <span className="text-[var(--admin-on-surface-variant)]">Page total: —</span>
              )}
              {filteredByCurrency.length > 0 ? (
                <>
                  <div className="hidden h-4 w-px bg-[var(--admin-border)] sm:block" />
                  <span className="text-[var(--admin-on-surface-variant)]">
                    Filtered:{" "}
                    {filteredByCurrency
                      .map((row) => formatMoney(row.amountCents, row.currency))
                      .join(" · ")}
                  </span>
                </>
              ) : null}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 font-mono text-xs text-[var(--admin-on-surface-variant)]">
                <span>Rows</span>
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
              </div>
              <div className="font-mono text-xs text-[var(--admin-on-surface-variant)]">
                {rangeStart}-{rangeEnd} of {totalCount}
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] disabled:opacity-40"
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
                  className="p-1 text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)] disabled:opacity-40"
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
        </div>
      ) : null}
    </div>
  );
}
