"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Columns3,
  Copy,
  Plus,
  Search,
  Trash2,
  AlertTriangle,
} from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { AdminConfirmDialog } from "../../../components/shells/admin/AdminConfirmDialog";
import { catalogSearchClassName } from "./courses-catalog-shared";
import {
  coursePricingPlansFromDetail,
  formatPricingPlanPrice,
  formatPricingPlanType,
  formatPricingPlanValidity,
  PRICING_PLAN_STATUS_TABS,
  PRICING_PLAN_TABLE_COLUMNS,
  resolvePlanCheckoutUrl,
  storedCoursePricingPlansFromDetail,
  type CoursePricingPlanItem,
  type PricingPlanStatusTab,
  type PricingPlanTableColumnId,
} from "./course-pricing-plan-settings";
import {
  deleteCoursePricingPlan,
  formatCoursePricingPlanError,
} from "./course-pricing-plans-client";
import {
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsPricingPlansPanelProps = {
  course: CourseDetail;
  disabled: boolean;
  refreshToken?: number;
  onAddPlan: () => void;
  onEditPlan: (planId: string) => void;
  onCourseChange: (course: CourseDetail) => void;
};

const ROWS_PER_PAGE_OPTIONS = [10, 30, 50] as const;

const DEFAULT_VISIBLE_COLUMNS: PricingPlanTableColumnId[] = PRICING_PLAN_TABLE_COLUMNS.map(
  (column) => column.id,
);

const statusTabClassName = (active: boolean) =>
  [
    "relative px-1 pb-3 pt-1 text-sm font-semibold transition-colors",
    active
      ? "text-[var(--admin-primary-strong)] after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-[var(--admin-primary)]"
      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
  ].join(" ");

const adminBadgeSuccessClassName =
  "inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] px-2.5 py-0.5 text-xs font-semibold text-[var(--admin-success)]";

const tableHeaderClassName =
  "whitespace-nowrap px-4 py-3 text-left text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]";

const tableCellClassName = "whitespace-nowrap px-4 py-3.5 text-sm text-[var(--admin-on-surface)]";

function truncateMiddle(value: string, maxLength = 34): string {
  if (value.length <= maxLength) return value;
  const head = value.slice(0, 16);
  const tail = value.slice(-12);
  return `${head}…${tail}`;
}

function CopyCheckoutButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => {
      setCopied(false);
    }, 1600);
    return () => {
      window.clearTimeout(timer);
    };
  }, [copied]);

  return (
    <button
      type="button"
      className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
      aria-label={copied ? "Copied checkout link" : "Copy checkout link"}
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
        });
      }}
    >
      <Copy className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
    </button>
  );
}

export function CourseSettingsPricingPlansPanel({
  course,
  disabled,
  refreshToken = 0,
  onAddPlan,
  onEditPlan,
  onCourseChange,
}: CourseSettingsPricingPlansPanelProps) {
  const searchId = useId();
  const columnsMenuRef = useRef<HTMLDivElement>(null);
  const [statusTab, setStatusTab] = useState<PricingPlanStatusTab>("ALL");
  const [search, setSearch] = useState("");
  const [rowsPerPage, setRowsPerPage] =
    useState<(typeof ROWS_PER_PAGE_OPTIONS)[number]>(30);
  const [page, setPage] = useState(1);
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [visibleColumns, setVisibleColumns] =
    useState<PricingPlanTableColumnId[]>(DEFAULT_VISIBLE_COLUMNS);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [pendingDeletePlan, setPendingDeletePlan] = useState<CoursePricingPlanItem | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const storedPlanIds = useMemo(
    () => new Set(storedCoursePricingPlansFromDetail(course).map((plan) => plan.id)),
    [course, refreshToken],
  );

  const plans = useMemo(
    () => coursePricingPlansFromDetail(course),
    [course, refreshToken],
  );

  const filteredPlans = useMemo(() => {
    const query = search.trim().toLowerCase();
    return plans.filter((plan) => {
      if (statusTab !== "ALL" && plan.status !== statusTab) return false;
      if (!query) return true;
      return plan.title.toLowerCase().includes(query);
    });
  }, [plans, search, statusTab]);

  const totalPages = Math.max(1, Math.ceil(filteredPlans.length / rowsPerPage));
  const currentPage = Math.min(page, totalPages);
  const pageStart = (currentPage - 1) * rowsPerPage;
  const pagePlans = filteredPlans.slice(pageStart, pageStart + rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [search, statusTab, rowsPerPage]);

  useEffect(() => {
    if (!columnsOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (columnsMenuRef.current && !columnsMenuRef.current.contains(event.target as Node)) {
        setColumnsOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [columnsOpen]);

  function toggleColumn(columnId: PricingPlanTableColumnId) {
    setVisibleColumns((current) => {
      if (current.includes(columnId)) {
        if (current.length === 1) return current;
        return current.filter((id) => id !== columnId);
      }
      return [...current, columnId];
    });
  }

  async function handleDeletePlan(plan: CoursePricingPlanItem) {
    if (disabled || deletingPlanId || !storedPlanIds.has(plan.id)) return;

    setDeletingPlanId(plan.id);
    setDeleteError(null);

    try {
      const updated = await deleteCoursePricingPlan(course, plan.id);
      onCourseChange(updated);
      setPendingDeletePlan(null);
    } catch (error) {
      setDeleteError(formatCoursePricingPlanError(error));
    } finally {
      setDeletingPlanId(null);
    }
  }

  function renderCell(plan: CoursePricingPlanItem, columnId: PricingPlanTableColumnId) {
    switch (columnId) {
      case "title":
        return <span className="font-semibold">{plan.title}</span>;
      case "type":
        return formatPricingPlanType(plan);
      case "price":
        return formatPricingPlanPrice(plan);
      case "validity":
        return formatPricingPlanValidity(plan);
      case "location":
        return (
          <span className="inline-flex items-center gap-2">
            <span>{plan.location}</span>
            {plan.isDefault ? (
              <span className={adminBadgeSuccessClassName}>Default</span>
            ) : null}
          </span>
        );
      case "oneToOneTemplate":
        return plan.oneToOneTemplate ?? "—";
      case "paymentGateway":
        return plan.paymentGateway ?? "—";
      case "checkoutUrl": {
        const checkoutUrl = resolvePlanCheckoutUrl(course, plan);
        if (!checkoutUrl) return "—";
        return (
          <span className="inline-flex max-w-[16rem] items-center gap-1">
            <span className="truncate">{truncateMiddle(checkoutUrl)}</span>
            <CopyCheckoutButton value={checkoutUrl} />
          </span>
        );
      }
      case "accessibility":
        return (
          <span
            className={
              plan.accessibility === "PUBLIC"
                ? adminBadgeSuccessClassName
                : "inline-flex items-center rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-xs font-semibold text-[var(--admin-on-surface-variant)]"
            }
          >
            {plan.accessibility === "PUBLIC" ? "Public" : "Private"}
          </span>
        );
      default:
        return "—";
    }
  }

  const visibleColumnDefs = PRICING_PLAN_TABLE_COLUMNS.filter((column) =>
    visibleColumns.includes(column.id),
  );

  return (
    <div className="min-w-0 w-full space-y-6">
      <div className="flex flex-wrap items-start justify-end gap-4">
        <button
          type="button"
          className={`${inlineLessonPrimaryDarkButtonClassName} gap-2`}
          disabled={disabled}
          onClick={onAddPlan}
        >
          <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
          Add Pricing Plans
        </button>
      </div>

      <div className="border-b border-[var(--admin-border)]">
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {PRICING_PLAN_STATUS_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={statusTabClassName(statusTab === tab)}
              aria-current={statusTab === tab ? "page" : undefined}
              onClick={() => {
                setStatusTab(tab);
              }}
            >
              {tab === "ALL" ? "ALL" : tab.charAt(0) + tab.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative min-w-0 flex-1 lg:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            strokeWidth={1.75}
            aria-hidden="true"
          />
          <label htmlFor={searchId} className="sr-only">
            Search by title
          </label>
          <input
            id={searchId}
            type="search"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
            }}
            placeholder="Search by Title"
            className={catalogSearchClassName}
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div ref={columnsMenuRef} className="relative">
            <button
              type="button"
              aria-expanded={columnsOpen}
              className={inlineLessonSecondaryButtonClassName}
              onClick={() => {
                setColumnsOpen((open) => !open);
              }}
            >
              <Columns3 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              Columns
              <ChevronDown
                className={[
                  "h-4 w-4 transition-transform duration-200",
                  columnsOpen ? "rotate-180" : "",
                ].join(" ")}
                aria-hidden="true"
              />
            </button>
            {columnsOpen ? (
              <div className="absolute right-0 top-[calc(100%+6px)] z-20 min-w-[14rem] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
                {PRICING_PLAN_TABLE_COLUMNS.map((column) => {
                  const checked = visibleColumns.includes(column.id);
                  return (
                    <label
                      key={column.id}
                      className="flex cursor-pointer items-center gap-3 px-4 py-2 text-sm text-[var(--admin-on-surface)] hover:bg-[var(--admin-surface-high)]"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        className="h-4 w-4 rounded border-[var(--admin-border)] text-[var(--admin-primary)]"
                        onChange={() => {
                          toggleColumn(column.id);
                        }}
                      />
                      {column.label}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
            <span className="whitespace-nowrap">Rows per page</span>
            <select
              value={rowsPerPage}
              className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-2.5 py-1.5 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              onChange={(event) => {
                setRowsPerPage(Number(event.target.value) as (typeof ROWS_PER_PAGE_OPTIONS)[number]);
              }}
            >
              {ROWS_PER_PAGE_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
              disabled={currentPage <= 1}
              aria-label="First page"
              onClick={() => {
                setPage(1);
              }}
            >
              <ChevronsLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
              disabled={currentPage <= 1}
              aria-label="Previous page"
              onClick={() => {
                setPage((value) => Math.max(1, value - 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-40"
              disabled={currentPage >= totalPages}
              aria-label="Next page"
              onClick={() => {
                setPage((value) => Math.min(totalPages, value + 1));
              }}
            >
              <ChevronRight className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>

      {deleteError ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {deleteError}
        </p>
      ) : null}

      <div className="min-w-0 max-w-full overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="min-w-0 max-w-full overflow-x-auto">
          <table className="w-max min-w-full border-collapse">
            <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]/70">
              <tr>
                {visibleColumnDefs.map((column) => (
                  <th key={column.id} scope="col" className={tableHeaderClassName}>
                    {column.label}
                  </th>
                ))}
                <th scope="col" className={`${tableHeaderClassName} w-12 text-right`}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {pagePlans.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleColumnDefs.length + 1}
                    className="px-4 py-12 text-center text-sm text-[var(--admin-on-surface-variant)]"
                  >
                    {search.trim() || statusTab !== "ALL"
                      ? "No pricing plans match your filters."
                      : "No pricing plans yet. Add your first plan to get started."}
                  </td>
                </tr>
              ) : (
                pagePlans.map((plan) => (
                  <tr
                    key={plan.id}
                    className="cursor-pointer transition-colors hover:bg-[var(--admin-surface-low)]"
                    onClick={() => {
                      if (disabled) return;
                      onEditPlan(plan.id);
                    }}
                  >
                    {visibleColumnDefs.map((column) => (
                      <td key={column.id} className={tableCellClassName}>
                        {renderCell(plan, column.id)}
                      </td>
                    ))}
                    <td className={`${tableCellClassName} w-12 text-right`}>
                      <button
                        type="button"
                        className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] hover:text-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                        disabled={
                          disabled ||
                          deletingPlanId === plan.id ||
                          !storedPlanIds.has(plan.id)
                        }
                        aria-label={`Delete ${plan.title}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPendingDeletePlan(plan);
                        }}
                      >
                        <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AdminConfirmDialog
        open={pendingDeletePlan != null}
        title="Delete pricing plan?"
        description={
          pendingDeletePlan ? (
            <>
              <span className="font-medium text-[var(--admin-on-surface)]">{pendingDeletePlan.title}</span>{" "}
              will be removed from your course. This action cannot be undone.
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete plan"
        busyLabel="Deleting…"
        icon={AlertTriangle}
        tone="danger"
        busy={deletingPlanId != null}
        onConfirm={() => {
          if (pendingDeletePlan) {
            void handleDeletePlan(pendingDeletePlan);
          }
        }}
        onCancel={() => {
          if (deletingPlanId) return;
          setPendingDeletePlan(null);
        }}
      />
    </div>
  );
}
