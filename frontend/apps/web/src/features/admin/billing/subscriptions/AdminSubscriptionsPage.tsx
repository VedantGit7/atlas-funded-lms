"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Columns3,
  Inbox,
} from "lucide-react";
import {
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "@atlas/design-system";
import type { SubscriptionView } from "@atlas/domain-config/schemas/subscriptions";
import { dropdownPanelSurfaceClassName } from "../../../studio/courses/admin-form-dropdown-shared";
import { billingBackLinkClassName } from "../billing-admin-shared";

type AdminSubscriptionsPageProps = {
  subscriptions: SubscriptionView[];
};

type ColumnId =
  | "planName"
  | "currency"
  | "status"
  | "durationType"
  | "nextBillingAt"
  | "createdAt"
  | "updatedAt";

type ColumnDef = {
  id: ColumnId;
  label: string;
  render: (row: SubscriptionView) => React.ReactNode;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : dateFormatter.format(date);
}

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function statusPillClassName(status: string): string {
  const normalized = status.toLowerCase();
  const base = "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold";
  if (normalized === "active") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]`;
  }
  if (normalized === "trial") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-warning)_18%,var(--admin-surface))] text-[var(--admin-warning)]`;
  }
  if (normalized === "past_due" || normalized === "expired") {
    return `${base} bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]`;
  }
  return `${base} bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]`;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "planName",
    label: "Plan name",
    render: (row) => (
      <span className="font-medium text-[var(--admin-on-surface)]">{row.planName}</span>
    ),
  },
  { id: "currency", label: "Currency", render: (row) => row.currency },
  {
    id: "status",
    label: "Status",
    render: (row) => (
      <span className={statusPillClassName(row.status)}>{titleCase(row.status)}</span>
    ),
  },
  { id: "durationType", label: "Duration Type", render: (row) => titleCase(row.durationType) },
  {
    id: "nextBillingAt",
    label: "Next Billing Date",
    render: (row) => formatDate(row.nextBillingAt),
  },
  { id: "createdAt", label: "Created On", render: (row) => formatDate(row.createdAt) },
  { id: "updatedAt", label: "Updated On", render: (row) => formatDate(row.updatedAt) },
];

const ROWS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

const cellClassName =
  "whitespace-nowrap px-4 py-3.5 text-sm text-[var(--admin-on-surface-variant)]";
const headCellClassName =
  "whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]";

export function AdminSubscriptionsPage({ subscriptions }: AdminSubscriptionsPageProps) {
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!columnsOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!columnsRef.current?.contains(event.target as Node)) setColumnsOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [columnsOpen]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((column) => !hidden.has(column.id)),
    [hidden],
  );

  const pageCount = Math.max(1, Math.ceil(subscriptions.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = subscriptions.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  );

  function toggleColumn(id: ColumnId) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) {
        next.delete(id);
      } else if (visibleColumns.length > 1) {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      <Link href="/admin/billing" prefetch={false} className={billingBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Billing
      </Link>

      <header className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          Subscriptions
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">View your subscriptions</p>
      </header>

      <div className="flex justify-end">
        <div ref={columnsRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={columnsOpen}
            onClick={() => {
              setColumnsOpen((open) => !open);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
          >
            <Columns3 className="h-4 w-4" aria-hidden="true" />
            Columns
            <ChevronDown
              className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${columnsOpen ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
          {columnsOpen ? (
            <div
              role="menu"
              aria-label="Toggle columns"
              className={`absolute right-0 top-[calc(100%+6px)] z-20 w-56 bg-[var(--admin-surface)] p-1.5 shadow-lg ${dropdownPanelSurfaceClassName}`}
            >
              {COLUMNS.map((column) => {
                const isVisible = !hidden.has(column.id);
                return (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                  >
                    <input
                      type="checkbox"
                      checked={isVisible}
                      onChange={() => {
                        toggleColumn(column.id);
                      }}
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                    />
                    {column.label}
                  </label>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <div className="flex flex-wrap items-center justify-end gap-4 border-b border-[var(--admin-border)] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--admin-on-surface-variant)]">Rows Per Page</span>
            <Select
              value={String(rowsPerPage)}
              onValueChange={(value) => {
                setRowsPerPage(Number(value));
                setPage(0);
              }}
              options={ROWS_PER_PAGE_OPTIONS}
              ariaLabel="Rows per page"
              className="w-20 border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface)]"
            />
          </div>
          <div className="flex items-center gap-1">
            <PagerButton
              label="First page"
              disabled={currentPage === 0}
              onClick={() => {
                setPage(0);
              }}
            >
              <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
            </PagerButton>
            <PagerButton
              label="Previous page"
              disabled={currentPage === 0}
              onClick={() => {
                setPage((value) => Math.max(0, value - 1));
              }}
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </PagerButton>
            <PagerButton
              label="Next page"
              disabled={currentPage >= pageCount - 1}
              onClick={() => {
                setPage((value) => Math.min(pageCount - 1, value + 1));
              }}
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </PagerButton>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table className="w-full border-collapse text-left">
            <TableHead>
              <TableRow className="border-b border-[var(--admin-border)]">
                {visibleColumns.map((column) => (
                  <TableHeaderCell key={column.id} className={headCellClassName}>
                    {column.label}
                  </TableHeaderCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {pageRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColumns.length} className="px-4 py-16">
                    <div className="flex flex-col items-center gap-2 text-center">
                      <Inbox
                        className="h-8 w-8 text-[var(--admin-on-surface-variant)]"
                        aria-hidden="true"
                      />
                      <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                        No subscriptions yet
                      </p>
                      <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                        Your active plan and billing history will appear here once a subscription is
                        provisioned.
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pageRows.map((row) => (
                  <TableRow
                    key={row.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0 transition-colors hover:bg-[var(--admin-surface-high)]/50"
                  >
                    {visibleColumns.map((column) => (
                      <TableCell key={column.id} className={cellClassName}>
                        {column.render(row)}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

function PagerButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
