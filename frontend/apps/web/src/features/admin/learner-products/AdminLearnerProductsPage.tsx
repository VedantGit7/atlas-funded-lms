"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Archive,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Info,
  Plus,
  Search,
  Send,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
} from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  enrollInProduct,
  fetchBundles,
  fetchMockTests,
  fetchSubscriptionPlans,
  fetchTestSeries,
  PRODUCT_PAGE_SIZE,
  updateLearnerProductStatuses,
  type LearnerProductKind,
  type ProductListPageInfo,
} from "./learner-products-api";
import {
  catalogueBulkBarClassName,
  catalogueBulkButtonClassName,
  catalogueNoteClassName,
  cataloguePagerButtonClassName,
  catalogueSearchInputClassName,
  catalogueTabActiveClassName,
  catalogueTabBarClassName,
  catalogueTabClassName,
  catalogueTabCountClassName,
  catalogueToolbarClassName,
  formatUpdatedAt,
  statusLabel,
  toCsv,
  type ProductRow,
} from "./learner-products-shared";
import { LearnerProductsTable } from "./LearnerProductsTable";
import {
  CatalogueEmptyState,
  CatalogueErrorState,
  CatalogueSkeleton,
} from "./LearnerProductsStates";
import { LearnerProductEnrolDrawer, type EnrolSubmission } from "./LearnerProductEnrolDrawer";

type ProductTab = "mock-tests" | "test-series" | "bundles" | "subscription-plans";

type TabConfig = {
  key: ProductTab;
  label: string;
  /** Lower-case plural used inside sentences ("24 mock tests in this catalogue"). */
  noun: string;
  singular: string;
  /** Mock tests wrap a single assessment, so their rows have nothing to expand. */
  expandable: boolean;
  caption: string;
  load: (filters: {
    q?: string;
    status?: string;
    page?: number;
  }) => Promise<{ data: { items: unknown[]; pageInfo: ProductListPageInfo } }>;
  /** Wire value the batch status endpoint dispatches on. */
  kind: LearnerProductKind;
  toRow: (item: never) => ProductRow;
};

type BaseItem = {
  id: string;
  slug: string;
  title: string;
  status: string;
  updatedAt: string;
};

/**
 * The four endpoints are shaped identically, so the tab only decides which set
 * of functions to call and how a row summarises its contents. Keeping that in
 * one table is what stops this screen becoming four near-copies.
 */
const TABS: TabConfig[] = [
  {
    key: "mock-tests",
    label: "Mock tests",
    noun: "mock tests",
    singular: "Mock test",
    expandable: false,
    caption: "Mock tests wrap a single assessment and have no contents list.",
    load: fetchMockTests,
    kind: "mock_test",
    toRow: (item: BaseItem) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      status: item.status,
      updatedAt: item.updatedAt,
      detail: "—",
      items: [],
    }),
  },
  {
    key: "test-series",
    label: "Test series",
    noun: "test series",
    singular: "Test series",
    expandable: true,
    caption: "A test series runs its mock tests in the order listed.",
    load: fetchTestSeries,
    kind: "test_series",
    toRow: (
      item: BaseItem & {
        items: Array<{ id: string; position: number; title?: string | null }>;
      },
    ) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      status: item.status,
      updatedAt: item.updatedAt,
      detail: `${String(item.items.length)} ${item.items.length === 1 ? "test" : "tests"}`,
      items: item.items.map((entry) => ({
        id: entry.id,
        kind: "mock_test",
        position: entry.position,
        title: entry.title ?? null,
      })),
    }),
  },
  {
    key: "bundles",
    label: "Bundles",
    noun: "bundles",
    singular: "Bundle",
    expandable: true,
    caption: "Enrolling into a bundle enrols the learner into every item it contains.",
    load: fetchBundles,
    kind: "bundle",
    toRow: (
      item: BaseItem & {
        items: Array<{ id: string; position: number; itemKind?: string; title?: string | null }>;
      },
    ) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      status: item.status,
      updatedAt: item.updatedAt,
      detail: `${String(item.items.length)} ${item.items.length === 1 ? "item" : "items"}`,
      items: item.items.map((entry) => ({
        id: entry.id,
        kind: entry.itemKind ?? "course",
        position: entry.position,
        title: entry.title ?? null,
      })),
    }),
  },
  {
    key: "subscription-plans",
    label: "Subscription plans",
    noun: "subscription plans",
    singular: "Subscription plan",
    expandable: true,
    caption: "Billing cadence is set here; charging is handled outside this module.",
    load: fetchSubscriptionPlans,
    kind: "subscription_plan",
    toRow: (
      item: BaseItem & {
        billingInterval: string;
        items: Array<{ id: string; position: number; itemKind?: string; title?: string | null }>;
      },
    ) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      status: item.status,
      updatedAt: item.updatedAt,
      detail: `${item.billingInterval} · ${String(item.items.length)} ${
        item.items.length === 1 ? "item" : "items"
      }`,
      items: item.items.map((entry) => ({
        id: entry.id,
        kind: entry.itemKind ?? "course",
        position: entry.position,
        title: entry.title ?? null,
      })),
    }),
  },
];

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Draft" },
  { value: "ARCHIVED", label: "Archived" },
] as const;

/**
 * Tenant catalogue of learner products.
 *
 * Mock tests, test series, bundles and subscription plans shipped with full
 * backend support and no UI, so a school could not see its own catalogue, move
 * a product out of DRAFT, or put a learner into one. Enrolment here is the
 * admin-side `enrollment.manage` action — placing someone into a product — not
 * learner self-service purchase, which the note at the top of the screen says
 * out loud because an admin catalogue usually implies selling.
 */
export function AdminLearnerProductsPage() {
  const [tabKey, setTabKey] = useState<ProductTab>("mock-tests");
  const [rows, setRows] = useState<ProductRow[]>([]);
  const [pageInfo, setPageInfo] = useState<ProductListPageInfo | null>(null);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [statusOpen, setStatusOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());
  const [bulkRunning, setBulkRunning] = useState(false);

  const [enrolFor, setEnrolFor] = useState<ProductRow | null>(null);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  const tab = useMemo(
    () => TABS.find((entry) => entry.key === tabKey) ?? TABS[0],
    [tabKey],
  ) as TabConfig;

  // Typing re-queried the API on every keystroke before this; the debounce is
  // what makes the search field usable on a catalogue of any size.
  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

  const requestId = useRef(0);

  const load = useCallback(
    async (activeTab: TabConfig, activeQuery: string, activeStatus: string, activePage: number) => {
      const ticket = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        // `exactOptionalPropertyTypes` is on, so an absent filter must be an
        // absent key rather than an explicit `undefined`.
        const response = await activeTab.load({
          page: activePage,
          ...(activeQuery.trim() ? { q: activeQuery.trim() } : {}),
          ...(activeStatus ? { status: activeStatus } : {}),
        });
        // A slow response for a tab the operator has already left must not
        // repaint the table underneath the tab they are now looking at.
        if (ticket !== requestId.current) return;
        setRows(response.data.items.map((item) => activeTab.toRow(item as never)));
        setPageInfo(response.data.pageInfo);
      } catch (caught) {
        if (ticket !== requestId.current) return;
        setRows([]);
        setPageInfo(null);
        setError(caught instanceof ClientApiError ? caught.message : "Could not load products.");
      } finally {
        if (ticket === requestId.current) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    setSelectedIds(new Set());
    void load(tab, query, status, page);
  }, [load, tab, query, status, page]);

  function switchTab(next: ProductTab) {
    setTabKey(next);
    setPage(1);
    setSelectedIds(new Set());
    setNotice(null);
    setEnrolFor(null);
  }

  function clearFilters() {
    setSearchInput("");
    setQuery("");
    setStatus("");
    setPage(1);
  }

  function toggleRow(id: string) {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds((previous) =>
      previous.size === rows.length ? new Set() : new Set(rows.map((row) => row.id)),
    );
  }

  async function applyStatus(targets: ProductRow[], nextStatus: string) {
    const pending = targets.filter((row) => row.status.toUpperCase() !== nextStatus);
    if (pending.length === 0) {
      setNotice(`Already ${statusLabel(nextStatus).toLowerCase()}.`);
      return;
    }

    setNotice(null);
    setError(null);
    setBulkRunning(true);
    setBusyIds(new Set(pending.map((row) => row.id)));

    try {
      const response = await updateLearnerProductStatuses(
        tab.kind,
        pending.map((row) => row.id),
        nextStatus,
      );
      const { updated, missingIds } = response.data;

      setSelectedIds(new Set());
      if (updated.length > 0) {
        setNotice(
          `${String(updated.length)} ${
            updated.length === 1 ? tab.singular.toLowerCase() : tab.noun
          } moved to ${statusLabel(nextStatus).toLowerCase()}.`,
        );
      }
      // A stale selection is the operator's to know about, not something to
      // swallow: those rows are gone from under them, and the count they just
      // read would otherwise be silently wrong.
      if (missingIds.length > 0) {
        setError(
          `${String(missingIds.length)} ${
            missingIds.length === 1 ? "product is" : "products are"
          } no longer available and were skipped.`,
        );
      }
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not update those products.",
      );
    } finally {
      setBusyIds(new Set());
      setBulkRunning(false);
    }

    await load(tab, query, status, page);
  }

  function exportSelection() {
    const chosen = selectedIds.size > 0 ? rows.filter((row) => selectedIds.has(row.id)) : rows;
    const csv = toCsv(
      ["Title", "Slug", "Contents", "Status", "Updated"],
      chosen.map((row) => [
        row.title,
        row.slug,
        row.detail,
        statusLabel(row.status),
        formatUpdatedAt(row.updatedAt),
      ]),
    );

    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tab.key}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${String(chosen.length)} ${chosen.length === 1 ? "row" : "rows"}.`);
  }

  function copySlug(slug: string) {
    void navigator.clipboard.writeText(slug).then(
      () => {
        setNotice(`Copied “${slug}”.`);
      },
      () => {
        setNotice(null);
      },
    );
  }

  async function submitEnrolment(submission: EnrolSubmission) {
    if (!enrolFor) return;
    setEnrolling(true);
    setEnrolError(null);
    try {
      await enrollInProduct(tab.key, enrolFor.id, {
        membershipId: submission.membershipId,
        enrolledType: submission.enrolledType,
        ...(submission.expiresAt ? { expiresAt: submission.expiresAt } : {}),
      });
      setNotice(`Learner enrolled into “${enrolFor.title}”.`);
      setEnrolFor(null);
    } catch (caught) {
      setEnrolError(
        caught instanceof ClientApiError ? caught.message : "Could not enrol that learner.",
      );
    } finally {
      setEnrolling(false);
    }
  }

  const filtered = query.trim().length > 0 || status !== "";
  const totalCount = pageInfo?.totalCount ?? 0;
  const totalPages = pageInfo?.totalPages ?? 0;
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PRODUCT_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PRODUCT_PAGE_SIZE, totalCount);
  const selectedCount = selectedIds.size;
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const activeStatusLabel =
    STATUS_FILTERS.find((entry) => entry.value === status)?.label ?? "All statuses";

  return (
    <div className="space-y-6">
      <div className={catalogueNoteClassName}>
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Enrolling here places a learner into a product directly. No payment is taken and no
          invoice is created.
        </p>
      </div>

      <div className={catalogueTabBarClassName} role="tablist" aria-label="Product type">
        {TABS.map((entry) => {
          const isActive = entry.key === tabKey;
          return (
            <button
              key={entry.key}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={[catalogueTabClassName, isActive ? catalogueTabActiveClassName : ""].join(
                " ",
              )}
              onClick={() => {
                switchTab(entry.key);
              }}
            >
              {entry.label}
              {isActive && pageInfo ? (
                <span className={catalogueTabCountClassName}>{pageInfo.totalCount}</span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className={catalogueToolbarClassName}>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {loading
            ? `Loading ${tab.noun}…`
            : `${String(totalCount)} ${totalCount === 1 ? tab.singular.toLowerCase() : tab.noun}${
                filtered ? " match these filters" : " in this catalogue"
              }`}
        </p>

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-end">
          <div className="relative w-full sm:w-72">
            <label className="sr-only" htmlFor="learner-product-search">
              Search {tab.noun}
            </label>
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              id="learner-product-search"
              type="search"
              className={catalogueSearchInputClassName}
              placeholder="Search title or slug"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
            {searchInput ? (
              <button
                type="button"
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                onClick={() => {
                  setSearchInput("");
                }}
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="w-full sm:w-48">
            <DropdownField
              label={
                <span className="sr-only" id="learner-product-status-label">
                  Filter by status
                </span>
              }
              labelId="learner-product-status"
              open={statusOpen}
              panelAriaLabel="Filter by status"
              leftIcon={<SlidersHorizontal className="h-4 w-4" aria-hidden="true" />}
              onToggle={() => {
                setStatusOpen((previous) => !previous);
              }}
              triggerContent={activeStatusLabel}
            >
              <div className="flex flex-col gap-0.5 overflow-y-auto p-1.5">
                {STATUS_FILTERS.map((entry) => (
                  <button
                    key={entry.value || "all"}
                    type="button"
                    role="option"
                    aria-selected={entry.value === status}
                    className={dropdownItemClassName}
                    onClick={() => {
                      setStatus(entry.value);
                      setPage(1);
                      setStatusOpen(false);
                    }}
                  >
                    <span className="flex-1">{entry.label}</span>
                    {entry.value === status ? (
                      <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                    ) : null}
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>

          <button
            type="button"
            onClick={exportSelection}
            disabled={rows.length === 0}
            className={manageSecondaryButtonClassName}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export
          </button>

          <Link
            href={`/admin/manage/learner-products/${tab.key}/new`}
            className={managePrimaryButtonClassName}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New {tab.singular.toLowerCase()}
          </Link>
        </div>
      </div>

      {selectedCount > 0 ? (
        <div className={catalogueBulkBarClassName}>
          <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
            {selectedCount} {selectedCount === 1 ? tab.singular.toLowerCase() : tab.noun} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className={catalogueBulkButtonClassName}
              disabled={bulkRunning}
              onClick={() => {
                void applyStatus(selectedRows, "PUBLISHED");
              }}
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              Publish
            </button>
            <button
              type="button"
              className={catalogueBulkButtonClassName}
              disabled={bulkRunning}
              onClick={() => {
                void applyStatus(selectedRows, "ARCHIVED");
              }}
            >
              <Archive className="h-3.5 w-3.5" aria-hidden="true" />
              Archive
            </button>
            <button
              type="button"
              className={catalogueBulkButtonClassName}
              disabled={bulkRunning}
              onClick={exportSelection}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export
            </button>
            <button
              type="button"
              className={catalogueBulkButtonClassName}
              onClick={() => {
                setSelectedIds(new Set());
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {notice ?? ""}
      </p>
      {notice ? (
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">{notice}</p>
      ) : null}

      {loading ? (
        <CatalogueSkeleton />
      ) : error && rows.length === 0 ? (
        <CatalogueErrorState
          message={error}
          retrying={loading}
          onRetry={() => {
            void load(tab, query, status, page);
          }}
        />
      ) : rows.length === 0 ? (
        <CatalogueEmptyState
          productLabel={tab.label}
          filtered={filtered}
          query={query}
          onClearFilters={clearFilters}
          createHref={`/admin/manage/learner-products/${tab.key}/new`}
          createLabel={`New ${tab.singular.toLowerCase()}`}
        />
      ) : (
        <>
          {error ? (
            <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
              {error}
            </p>
          ) : null}

          <LearnerProductsTable
            rows={rows}
            typeSlug={tab.key}
            selectedIds={selectedIds}
            expandable={tab.expandable}
            busyIds={busyIds}
            onToggleRow={toggleRow}
            onToggleAll={toggleAll}
            onEnrol={(row) => {
              setEnrolError(null);
              setEnrolFor(row);
            }}
            onChangeStatus={(row, nextStatus) => {
              void applyStatus([row], nextStatus);
            }}
            onCopySlug={copySlug}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-[var(--admin-on-surface-variant)]">{tab.caption}</p>
            <div className="flex items-center gap-3">
              <span className="text-xs tabular-nums text-[var(--admin-on-surface-variant)]">
                Showing {rangeStart}–{rangeEnd} of {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous page"
                  className={cataloguePagerButtonClassName}
                  disabled={page <= 1}
                  onClick={() => {
                    setPage((previous) => Math.max(1, previous - 1));
                  }}
                >
                  <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Next page"
                  className={cataloguePagerButtonClassName}
                  disabled={totalPages === 0 || page >= totalPages}
                  onClick={() => {
                    setPage((previous) => previous + 1);
                  }}
                >
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <LearnerProductEnrolDrawer
        open={enrolFor !== null}
        productTitle={enrolFor?.title ?? ""}
        productKindLabel={tab.singular}
        productStatusLabel={enrolFor ? statusLabel(enrolFor.status) : ""}
        busy={enrolling}
        error={enrolError}
        onSubmit={(submission) => {
          void submitEnrolment(submission);
        }}
        onCancel={() => {
          setEnrolFor(null);
          setEnrolError(null);
        }}
      />
    </div>
  );
}
