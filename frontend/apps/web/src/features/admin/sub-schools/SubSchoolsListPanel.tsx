"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Columns3,
  Loader2,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { SubSchoolsEmptyIllustration } from "./SubSchoolsEmptyIllustration";
import { SUB_SCHOOLS_CREATE_HREF, SUB_SCHOOL_URL_SUFFIX, subSchoolDetailHref } from "./sub-schools-shared";

export type SubSchoolRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  mobileNumber: string | null;
  email: string | null;
  status: "ACTIVE" | "INACTIVE" | "ARCHIVED";
  createdAt: string;
  updatedAt: string;
};

type ColumnId = "name" | "url" | "email" | "status" | "created";

const COLUMNS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: "name", label: "Sub-School Name" },
  { id: "url", label: "URL" },
  { id: "email", label: "Email" },
  { id: "status", label: "Status" },
  { id: "created", label: "Created" },
];

const ROWS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "-";
  }
}

function statusLabel(status: SubSchoolRow["status"]): string {
  if (status === "ACTIVE") return "Active";
  if (status === "INACTIVE") return "Inactive";
  return "Archived";
}

export function SubSchoolsListPanel({ initialItems }: { initialItems: SubSchoolRow[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<SubSchoolRow | null>(null);
  const columnsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter(
      (row) =>
        row.name.toLowerCase().includes(normalized) ||
        row.key.toLowerCase().includes(normalized) ||
        (row.email ?? "").toLowerCase().includes(normalized) ||
        (row.description ?? "").toLowerCase().includes(normalized),
    );
  }, [items, query]);

  const visibleColumns = useMemo(() => COLUMNS.filter((column) => !hidden.has(column.id)), [hidden]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);
  const hasQuery = query.trim().length > 0;

  function toggleColumn(id: ColumnId) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (id !== "name" && visibleColumns.length > 1) next.add(id);
      return next;
    });
  }

  async function removeSubSchool(row: SubSchoolRow) {
    setBusyId(row.id);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/sub-schools/${row.id}`, `sub-school-delete-${row.id}`, undefined, {
        successMessage: `${row.name} removed.`,
      });
      setConfirmRemove(null);
      setItems((previous) => previous.filter((item) => item.id !== row.id));
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not remove the sub-school.");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
            Sub-Schools
          </h1>
          <p className="max-w-xl text-sm text-[var(--admin-on-surface-variant)]">
            Create multiple sub-schools under your main school
          </p>
        </div>
        <Link
          href={SUB_SCHOOLS_CREATE_HREF}
          prefetch={false}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] shadow-sm transition-all hover:opacity-90 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create
        </Link>
      </header>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search by Sub-School Name"
            aria-label="Search by Sub-School Name"
            className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] py-2.5 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
        <div ref={columnsRef} className="relative self-end sm:self-auto">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={columnsOpen}
            onClick={() => {
              setColumnsOpen((open) => !open);
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-border)] hover:bg-[var(--admin-surface-high)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
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
              {COLUMNS.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                >
                  <input
                    type="checkbox"
                    checked={!hidden.has(column.id)}
                    disabled={column.id === "name"}
                    onChange={() => {
                      toggleColumn(column.id);
                    }}
                    className="h-4 w-4 accent-[var(--admin-primary)]"
                  />
                  {column.label}
                </label>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          hasQuery={hasQuery}
          onClearSearch={() => {
            setQuery("");
            setPage(0);
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--admin-border)] px-4 py-3">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              {filtered.length} {filtered.length === 1 ? "sub-school" : "sub-schools"}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-4">
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
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)]">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]"
                    >
                      {column.label}
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--admin-border)] last:border-b-0">
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-4 py-4 align-middle">
                        {column.id === "name" ? (
                          <div className="min-w-0">
                            <Link
                              href={subSchoolDetailHref(row.id)}
                              prefetch={false}
                              className="font-semibold text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)]"
                            >
                              {row.name}
                            </Link>
                            {row.mobileNumber ? (
                              <p className="mt-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                                {row.mobileNumber}
                              </p>
                            ) : null}
                          </div>
                        ) : column.id === "url" ? (
                          <code className="rounded-md bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs text-[var(--admin-on-surface-variant)]">
                            {row.key}
                            {SUB_SCHOOL_URL_SUFFIX}
                          </code>
                        ) : column.id === "email" ? (
                          <span className="text-[var(--admin-on-surface-variant)]">
                            {row.email ?? "-"}
                          </span>
                        ) : column.id === "status" ? (
                          <span
                            className={[
                              "inline-flex rounded-md px-2 py-0.5 text-xs font-semibold",
                              row.status === "ACTIVE"
                                ? "bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]"
                                : row.status === "ARCHIVED"
                                  ? "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
                                  : "bg-[color-mix(in_srgb,var(--admin-warning)_16%,var(--admin-surface))] text-[var(--admin-warning)]",
                            ].join(" ")}
                          >
                            {statusLabel(row.status)}
                          </span>
                        ) : (
                          <span className="whitespace-nowrap text-[var(--admin-on-surface-variant)]">
                            {formatDate(row.createdAt)}
                          </span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center justify-end">
                        <button
                          type="button"
                          disabled={busyId === row.id}
                          onClick={() => {
                            setConfirmRemove(row);
                          }}
                          aria-label={`Remove ${row.name}`}
                          className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {busyId === row.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="h-4 w-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmRemove !== null}
        title="Remove sub-school?"
        description={
          confirmRemove
            ? `${confirmRemove.name} will be permanently removed. This cannot be undone.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        busy={busyId !== null}
        onConfirm={() => {
          if (confirmRemove) void removeSubSchool(confirmRemove);
        }}
        onCancel={() => {
          setConfirmRemove(null);
        }}
      />
    </div>
  );
}

function EmptyState({
  hasQuery,
  onClearSearch,
}: {
  hasQuery: boolean;
  onClearSearch: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 text-center sm:py-28">
      <SubSchoolsEmptyIllustration />
      <div className="space-y-1.5">
        <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No results found</p>
        <p className="max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
          {hasQuery
            ? "No sub-schools match your search. Try a different name or clear the filter."
            : "Create your first sub-school to organize learners under your main academy."}
        </p>
      </div>
      {hasQuery ? (
        <button
          type="button"
          onClick={onClearSearch}
          className="rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
        >
          Clear search
        </button>
      ) : (
        <Link
          href={SUB_SCHOOLS_CREATE_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] shadow-sm transition-all hover:opacity-90 motion-safe:active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create Sub-School
        </Link>
      )}
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
