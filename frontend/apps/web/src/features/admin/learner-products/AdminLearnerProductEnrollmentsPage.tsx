"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Check,
  Download,
  Info,
  RotateCcw,
  Search,
  UserPlus,
  Users,
  UserX,
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
  fetchProductDetail,
  fetchProductEnrollmentPage,
  updateProductEnrollments,
  PRODUCT_PAGE_SIZE,
  type EnrollmentAction,
  type LearnerProductKind,
  type ProductDetail,
  type ProductEnrollmentListItem,
  type ProductTypeSlug,
} from "./learner-products-api";
import {
  catalogueBulkBarClassName,
  catalogueBulkButtonClassName,
  catalogueCheckboxClassName,
  catalogueEmptyPanelClassName,
  cataloguePagerButtonClassName,
  catalogueRowClassName,
  catalogueRowSelectedClassName,
  catalogueSearchInputClassName,
  catalogueSlugChipClassName,
  catalogueTableHeadCellClassName,
  catalogueTableShellClassName,
  formatUpdatedAt,
  toCsv,
} from "./learner-products-shared";
import { LearnerProductEnrolDrawer, type EnrolSubmission } from "./LearnerProductEnrolDrawer";

const CATALOGUE_HREF = "/admin/manage/learner-products";

const KIND_BY_TYPE: Record<ProductTypeSlug, { kind: LearnerProductKind; label: string }> = {
  "mock-tests": { kind: "mock_test", label: "Mock test" },
  "test-series": { kind: "test_series", label: "Test series" },
  bundles: { kind: "bundle", label: "Bundle" },
  "subscription-plans": { kind: "subscription_plan", label: "Subscription plan" },
};

const STATUS_FILTERS = [
  { value: "", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "revoked", label: "Revoked" },
] as const;

const TYPE_FILTERS = [
  { value: "", label: "Any type" },
  { value: "free", label: "Free" },
  { value: "paid", label: "Paid" },
  { value: "trial", label: "Trial" },
  { value: "comp", label: "Complimentary" },
] as const;

/**
 * Effective state, not just the stored one.
 *
 * A row whose `expiresAt` is in the past is still `active` in the database —
 * nothing sweeps it — so rendering the column verbatim would tell an operator a
 * learner has access they lost last month.
 */
function effectiveState(enrollment: ProductEnrollmentListItem): "active" | "revoked" | "expired" {
  if (enrollment.status === "revoked") return "revoked";
  if (enrollment.expiresAt && new Date(enrollment.expiresAt).getTime() < Date.now()) {
    return "expired";
  }
  return "active";
}

const STATE_CHIP: Record<string, string> = {
  active:
    "border-[color-mix(in_srgb,var(--admin-success)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_14%,var(--admin-surface))] text-[var(--admin-success)]",
  expired:
    "border-[color-mix(in_srgb,var(--admin-warning)_35%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] text-[var(--admin-warning)]",
  revoked:
    "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
};

function initials(name: string | null, email: string | null): string {
  const source = name?.trim() ?? email?.split("@")[0] ?? "";
  if (!source) return "?";
  return (
    source
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "?"
  );
}

/**
 * Who is enrolled in one product.
 *
 * The console could place a learner into a product and never show who was
 * already in it; the roster endpoint closed that, and this screen is where it
 * surfaces. Expiry changes and revocation live here too, because the moment an
 * operator can see the list is the moment they need to correct it.
 */
export function AdminLearnerProductEnrollmentsPage({
  type,
  productId,
}: {
  type: ProductTypeSlug;
  productId: string;
}) {
  const meta = KIND_BY_TYPE[type];

  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [rows, setRows] = useState<ProductEnrollmentListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const [searchInput, setSearchInput] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [enrolledType, setEnrolledType] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);

  const [statusOpen, setStatusOpen] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [acting, setActing] = useState(false);
  const [expiryOpen, setExpiryOpen] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrolError, setEnrolError] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setQuery(searchInput);
      setPage(1);
    }, 350);
    return () => {
      clearTimeout(timer);
    };
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    fetchProductDetail(type, productId)
      .then((response) => {
        if (!cancelled) setProduct(response.data);
      })
      .catch((caught: unknown) => {
        if (cancelled) return;
        if (caught instanceof ClientApiError && caught.status === 404) setNotFound(true);
      });
    return () => {
      cancelled = true;
    };
  }, [type, productId]);

  const requestId = useRef(0);

  const load = useCallback(async () => {
    const ticket = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const response = await fetchProductEnrollmentPage(type, productId, {
        page,
        ...(query.trim() ? { q: query.trim() } : {}),
        ...(status ? { status } : {}),
        ...(enrolledType ? { enrolledType } : {}),
        // The API takes instants; a date input gives a day, so the range covers
        // the whole of both end dates rather than cutting the last one short.
        ...(from ? { enrolledFrom: new Date(`${from}T00:00:00Z`).toISOString() } : {}),
        ...(to ? { enrolledTo: new Date(`${to}T23:59:59Z`).toISOString() } : {}),
      });
      if (ticket !== requestId.current) return;
      setRows(response.data.items);
      setTotalCount(response.data.pageInfo.totalCount);
      setTotalPages(response.data.pageInfo.totalPages);
    } catch (caught) {
      if (ticket !== requestId.current) return;
      setRows([]);
      setTotalCount(0);
      setError(
        caught instanceof ClientApiError && caught.status === 403
          ? "You do not have permission to view enrolments."
          : caught instanceof ClientApiError
            ? caught.message
            : "Could not load enrolments.",
      );
    } finally {
      if (ticket === requestId.current) setLoading(false);
    }
  }, [type, productId, page, query, status, enrolledType, from, to]);

  useEffect(() => {
    setSelected(new Set());
    void load();
  }, [load]);

  const filtered = Boolean(query.trim() || status || enrolledType || from || to);

  function clearFilters() {
    setSearchInput("");
    setQuery("");
    setStatus("");
    setEnrolledType("");
    setFrom("");
    setTo("");
    setPage(1);
  }

  async function runAction(action: EnrollmentAction, expiresAt?: string | null) {
    if (selected.size === 0 || !product) return;
    setActing(true);
    setNotice(null);
    setError(null);
    try {
      const response = await updateProductEnrollments({
        productKind: meta.kind,
        productId: product.id,
        enrollmentIds: [...selected],
        action,
        ...(action === "set_expiry" ? { expiresAt: expiresAt ?? null } : {}),
      });

      const { updatedIds, missingIds } = response.data;
      setSelected(new Set());
      setExpiryOpen(false);
      if (updatedIds.length > 0) {
        setNotice(
          action === "revoke"
            ? `${String(updatedIds.length)} ${updatedIds.length === 1 ? "enrolment" : "enrolments"} revoked.`
            : action === "restore"
              ? `${String(updatedIds.length)} restored.`
              : `Expiry updated on ${String(updatedIds.length)}.`,
        );
      }
      if (missingIds.length > 0) {
        setError(
          `${String(missingIds.length)} ${
            missingIds.length === 1 ? "enrolment is" : "enrolments are"
          } no longer on this product and were skipped.`,
        );
      }
      await load();
    } catch (caught) {
      setError(
        caught instanceof ClientApiError ? caught.message : "Could not update those enrolments.",
      );
    } finally {
      setActing(false);
    }
  }

  function exportRows() {
    const chosen = selected.size > 0 ? rows.filter((row) => selected.has(row.id)) : rows;
    const csv = toCsv(
      ["Learner", "Email", "Membership ID", "Type", "State", "Enrolled", "Expires"],
      chosen.map((row) => [
        row.displayName ?? "",
        row.email ?? "",
        row.membershipId,
        row.enrolledType,
        effectiveState(row),
        formatUpdatedAt(row.enrolledAt),
        row.expiresAt ? formatUpdatedAt(row.expiresAt) : "No expiry",
      ]),
    );
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `enrolments-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${String(chosen.length)} ${chosen.length === 1 ? "row" : "rows"}.`);
  }

  async function submitEnrolment(submission: EnrolSubmission) {
    if (!product) return;
    setEnrolling(true);
    setEnrolError(null);
    try {
      await enrollInProduct(type, product.id, {
        membershipId: submission.membershipId,
        enrolledType: submission.enrolledType,
        ...(submission.expiresAt ? { expiresAt: submission.expiresAt } : {}),
      });
      setDrawerOpen(false);
      setNotice("Learner enrolled.");
      await load();
    } catch (caught) {
      setEnrolError(
        caught instanceof ClientApiError ? caught.message : "Could not enrol that learner.",
      );
    } finally {
      setEnrolling(false);
    }
  }

  if (notFound) {
    return (
      <div className={catalogueEmptyPanelClassName}>
        <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
          <AlertTriangle className="h-7 w-7" aria-hidden="true" />
        </span>
        <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Product not found</h2>
        <Link href={CATALOGUE_HREF} className={`${manageSecondaryButtonClassName} mt-6`}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to the catalogue
        </Link>
      </div>
    );
  }

  const rangeStart = totalCount === 0 ? 0 : (page - 1) * PRODUCT_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PRODUCT_PAGE_SIZE, totalCount);
  const allSelected = rows.length > 0 && rows.every((row) => selected.has(row.id));

  return (
    <div className="space-y-6">
      <nav aria-label="Breadcrumb">
        <ol className="flex flex-wrap items-center gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
          <li>
            <Link
              href={CATALOGUE_HREF}
              className="transition-colors hover:text-[var(--admin-primary)]"
            >
              Learner Products
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li>
            <Link
              href={`${CATALOGUE_HREF}/${type}/${productId}`}
              className="truncate transition-colors hover:text-[var(--admin-primary)]"
            >
              {product?.title ?? "Product"}
            </Link>
          </li>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
          <li aria-current="page" className="font-medium text-[var(--admin-on-surface)]">
            Enrolments
          </li>
        </ol>
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
            Enrolments
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            {product ? `${product.title} · ${meta.label}` : meta.label}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`${CATALOGUE_HREF}/${type}/${productId}`}
            className={manageSecondaryButtonClassName}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to product
          </Link>
          <button
            type="button"
            onClick={exportRows}
            disabled={rows.length === 0}
            className={manageSecondaryButtonClassName}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => {
              setEnrolError(null);
              setDrawerOpen(true);
            }}
            className={managePrimaryButtonClassName}
          >
            <UserPlus className="h-4 w-4" aria-hidden="true" />
            Enrol a learner
          </button>
        </div>
      </header>

      <p className="flex items-start gap-3 rounded-xl border border-[color-mix(in_srgb,var(--admin-primary)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface))] p-4 text-sm text-[var(--admin-on-surface-variant)]">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--admin-primary)]" aria-hidden="true" />
        Enrolling here places a learner into this product directly. Revoking removes their access
        but keeps the record of who granted it.
      </p>

      <div className="grid gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
            htmlFor="enrolment-search"
          >
            Search learner
          </label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              id="enrolment-search"
              type="search"
              className={catalogueSearchInputClassName}
              placeholder="Name or email"
              value={searchInput}
              onChange={(event) => {
                setSearchInput(event.target.value);
              }}
            />
          </div>
        </div>

        <div>
          <DropdownField
            label={
              <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                Enrolment type
              </span>
            }
            labelId="enrolment-type-filter"
            open={typeOpen}
            panelAriaLabel="Enrolment type"
            onToggle={() => {
              setTypeOpen((previous) => !previous);
            }}
            triggerContent={
              TYPE_FILTERS.find((entry) => entry.value === enrolledType)?.label ?? "Any type"
            }
          >
            <div className="flex flex-col gap-0.5 p-1.5">
              {TYPE_FILTERS.map((entry) => (
                <button
                  key={entry.value || "any"}
                  type="button"
                  role="option"
                  aria-selected={entry.value === enrolledType}
                  className={dropdownItemClassName}
                  onClick={() => {
                    setEnrolledType(entry.value);
                    setPage(1);
                    setTypeOpen(false);
                  }}
                >
                  <span className="flex-1">{entry.label}</span>
                  {entry.value === enrolledType ? (
                    <Check className="h-4 w-4 text-[var(--admin-primary)]" aria-hidden="true" />
                  ) : null}
                </button>
              ))}
            </div>
          </DropdownField>
        </div>

        <div>
          <DropdownField
            label={
              <span className="text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                Status
              </span>
            }
            labelId="enrolment-status-filter"
            open={statusOpen}
            panelAriaLabel="Status"
            onToggle={() => {
              setStatusOpen((previous) => !previous);
            }}
            triggerContent={
              STATUS_FILTERS.find((entry) => entry.value === status)?.label ?? "Any status"
            }
          >
            <div className="flex flex-col gap-0.5 p-1.5">
              {STATUS_FILTERS.map((entry) => (
                <button
                  key={entry.value || "any"}
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
          {/* Expiry is derived, so it cannot be a server-side filter without a
              sweep job inventing a status nothing writes. */}
          <p className="mt-1 text-[11px] text-[var(--admin-on-surface-variant)]">
            Expired access still counts as active until revoked.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
              htmlFor="enrolled-from"
            >
              Enrolled from
            </label>
            <input
              id="enrolled-from"
              type="date"
              max={to || undefined}
              className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25"
              value={from}
              onChange={(event) => {
                setFrom(event.target.value);
                setPage(1);
              }}
            />
          </div>
          <div>
            <label
              className="mb-1.5 block text-xs font-semibold text-[var(--admin-on-surface-variant)]"
              htmlFor="enrolled-to"
            >
              To
            </label>
            <input
              id="enrolled-to"
              type="date"
              min={from || undefined}
              className="w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25"
              value={to}
              onChange={(event) => {
                setTo(event.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {loading
            ? "Loading enrolments…"
            : `${String(totalCount)} ${totalCount === 1 ? "enrolment" : "enrolments"}${
                filtered ? " match these filters" : ""
              }`}
        </p>
        {filtered ? (
          <button type="button" onClick={clearFilters} className={manageSecondaryButtonClassName}>
            <X className="h-4 w-4" aria-hidden="true" />
            Clear filters
          </button>
        ) : null}
      </div>

      {selected.size > 0 ? (
        <div className={catalogueBulkBarClassName}>
          <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
            {selected.size} {selected.size === 1 ? "enrolment" : "enrolments"} selected
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={acting}
              className={catalogueBulkButtonClassName}
              onClick={() => {
                setExpiryOpen(true);
              }}
            >
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              Change expiry
            </button>
            <button
              type="button"
              disabled={acting}
              className={catalogueBulkButtonClassName}
              onClick={exportRows}
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              Export selection
            </button>
            <button
              type="button"
              disabled={acting}
              className={catalogueBulkButtonClassName}
              onClick={() => {
                void runAction("restore");
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Restore
            </button>
            <button
              type="button"
              disabled={acting}
              className={`${catalogueBulkButtonClassName} text-[var(--admin-danger)]`}
              onClick={() => {
                void runAction("revoke");
              }}
            >
              <UserX className="h-3.5 w-3.5" aria-hidden="true" />
              Revoke
            </button>
            <button
              type="button"
              className={catalogueBulkButtonClassName}
              onClick={() => {
                setSelected(new Set());
              }}
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}

      <p aria-live="polite" className="sr-only">
        {notice ?? error ?? ""}
      </p>
      {notice ? (
        <p className="text-sm font-medium text-[var(--admin-on-surface)]">{notice}</p>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm font-medium text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      {loading ? (
        <RosterSkeleton />
      ) : rows.length === 0 ? (
        <div className={catalogueEmptyPanelClassName}>
          <span className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]">
            <Users className="h-7 w-7" aria-hidden="true" />
          </span>
          <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">
            {filtered ? "No enrolments match" : "Nobody is enrolled yet"}
          </h2>
          <p className="mt-2 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            {filtered
              ? "No enrolments match the current filters."
              : "Learners placed into this product will appear here."}
          </p>
          {filtered ? (
            <button
              type="button"
              onClick={clearFilters}
              className={`${manageSecondaryButtonClassName} mt-6`}
            >
              <X className="h-4 w-4" aria-hidden="true" />
              Clear filters
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setEnrolError(null);
                setDrawerOpen(true);
              }}
              className={`${managePrimaryButtonClassName} mt-6`}
            >
              <UserPlus className="h-4 w-4" aria-hidden="true" />
              Enrol a learner
            </button>
          )}
        </div>
      ) : (
        <>
          <div className={catalogueTableShellClassName}>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[56rem] border-collapse text-left">
                <thead className="bg-[color-mix(in_srgb,var(--admin-surface-high)_55%,transparent)]">
                  <tr>
                    <th scope="col" className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        className={catalogueCheckboxClassName}
                        checked={allSelected}
                        aria-label={allSelected ? "Clear selection" : "Select all on this page"}
                        onChange={() => {
                          setSelected(allSelected ? new Set() : new Set(rows.map((row) => row.id)));
                        }}
                      />
                    </th>
                    <th scope="col" className={catalogueTableHeadCellClassName}>
                      Learner
                    </th>
                    <th scope="col" className={catalogueTableHeadCellClassName}>
                      Type
                    </th>
                    <th scope="col" className={catalogueTableHeadCellClassName}>
                      State
                    </th>
                    <th scope="col" className={catalogueTableHeadCellClassName}>
                      Enrolled
                    </th>
                    <th scope="col" className={catalogueTableHeadCellClassName}>
                      Expires
                    </th>
                    <th scope="col" className={catalogueTableHeadCellClassName}>
                      Membership
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isSelected = selected.has(row.id);
                    const state = effectiveState(row);
                    return (
                      <tr
                        key={row.id}
                        className={[
                          catalogueRowClassName,
                          isSelected ? catalogueRowSelectedClassName : "",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 align-middle">
                          <input
                            type="checkbox"
                            className={catalogueCheckboxClassName}
                            checked={isSelected}
                            aria-label={`Select ${row.displayName ?? row.membershipId}`}
                            onChange={() => {
                              setSelected((previous) => {
                                const next = new Set(previous);
                                if (next.has(row.id)) next.delete(row.id);
                                else next.add(row.id);
                                return next;
                              });
                            }}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                              {initials(row.displayName, row.email)}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                                {row.displayName ?? "Unnamed learner"}
                              </span>
                              <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
                                {row.email ?? "No email on file"}
                              </span>
                            </span>
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center rounded-full border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-2.5 py-1 text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                            {row.enrolledType}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold capitalize ${STATE_CHIP[state] ?? ""}`}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full bg-current"
                              aria-hidden="true"
                            />
                            {state}
                          </span>
                        </td>
                        <td className="font-data px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                          {formatUpdatedAt(row.enrolledAt)}
                        </td>
                        <td className="font-data px-4 py-3 text-xs text-[var(--admin-on-surface-variant)]">
                          {row.expiresAt ? formatUpdatedAt(row.expiresAt) : "No expiry"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`${catalogueSlugChipClassName} break-all`}>
                            {row.membershipId}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
        </>
      )}

      {expiryOpen ? (
        <ExpiryDialog
          count={selected.size}
          busy={acting}
          onCancel={() => {
            setExpiryOpen(false);
          }}
          onSubmit={(value) => {
            void runAction("set_expiry", value);
          }}
        />
      ) : null}

      <LearnerProductEnrolDrawer
        open={drawerOpen}
        productTitle={product?.title ?? ""}
        productKindLabel={meta.label}
        productStatusLabel={product?.status ?? ""}
        busy={enrolling}
        error={enrolError}
        onSubmit={(submission) => {
          void submitEnrolment(submission);
        }}
        onCancel={() => {
          setDrawerOpen(false);
          setEnrolError(null);
        }}
      />
    </div>
  );
}

function ExpiryDialog({
  count,
  busy,
  onCancel,
  onSubmit,
}: {
  count: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (expiresAt: string | null) => void;
}) {
  const [value, setValue] = useState("");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [busy, onCancel]);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Cancel"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={() => {
          if (!busy) onCancel();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="expiry-heading"
        className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <h2 id="expiry-heading" className="text-lg font-bold text-[var(--admin-on-surface)]">
          Change expiry
        </h2>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          Applies to {count} selected {count === 1 ? "enrolment" : "enrolments"}.
        </p>

        <label
          className="mt-5 block text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
          htmlFor="expiry-date"
        >
          Access expires
        </label>
        <input
          id="expiry-date"
          type="date"
          className="mt-2 w-full rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/25"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
        <p className="mt-1.5 text-xs text-[var(--admin-on-surface-variant)]">
          Leave empty and save to clear the expiry, giving access that does not end.
        </p>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className={manageSecondaryButtonClassName}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              onSubmit(value ? new Date(`${value}T23:59:59Z`).toISOString() : null);
            }}
            className={managePrimaryButtonClassName}
          >
            {busy ? "Saving…" : "Apply expiry"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RosterSkeleton() {
  return (
    <div className={catalogueTableShellClassName} aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div
          key={index}
          className="flex items-center gap-4 border-t border-[var(--admin-border)] px-4 py-4 first:border-t-0"
        >
          <div className="h-4 w-4 shrink-0 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-1/3 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
            <div className="h-3 w-1/4 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse" />
          </div>
          <div className="hidden h-6 w-20 rounded-full bg-[var(--admin-surface-high)] motion-safe:animate-pulse sm:block" />
          <div className="hidden h-3 w-20 rounded bg-[var(--admin-surface-high)] motion-safe:animate-pulse md:block" />
        </div>
      ))}
    </div>
  );
}
