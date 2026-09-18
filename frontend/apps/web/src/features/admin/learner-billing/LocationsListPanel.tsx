"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  Columns3,
  HelpCircle,
  Info,
  Plus,
  Search,
  Star,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import type { BillingLocationView } from "@atlas/domain-config/schemas/learner-billing";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { currencyName } from "./currency-options";
import { currencySymbol, flagFor } from "./location-options";

type ColumnId = "title" | "currency" | "status" | "description";

const COLUMNS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: "title", label: "Location Title" },
  { id: "currency", label: "Currency" },
  { id: "status", label: "Status" },
  { id: "description", label: "Description" },
];

const ROWS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

export function LocationsListPanel({
  initialLocations,
}: {
  initialLocations: BillingLocationView[];
}) {
  const [query, setQuery] = useState("");
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

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return initialLocations;
    // Searching only the title meant typing a currency — a column right there
    // on screen — returned nothing.
    return initialLocations.filter((location) =>
      [
        location.title,
        location.locationKey,
        location.currency,
        currencyName(location.currency) ?? "",
        location.description ?? "",
      ].some((field) => field.toLowerCase().includes(normalized)),
    );
  }, [initialLocations, query]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((column) => !hidden.has(column.id)),
    [hidden],
  );
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    currentPage * rowsPerPage,
    currentPage * rowsPerPage + rowsPerPage,
  );

  function toggleColumn(id: ColumnId) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (id !== "title" && visibleColumns.length > 1) next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
              Locations
            </h1>
            <HelpCircle
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-label="Sell your content to multiple regions, each with its own currency."
            />
          </div>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Sell your content to multiple geo-locations with their own currency and rates.
          </p>
        </div>
        <Link
          href="/admin/learner-billing/locations/add"
          prefetch={false}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-bold text-[var(--admin-on-primary)] shadow-sm transition-all hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add Location
        </Link>
      </header>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
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
            placeholder="Search location, currency or code"
            aria-label="Search location, currency or code"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--admin-primary)_30%,transparent)]"
          />
        </div>
        <p
          aria-live="polite"
          className="text-sm text-[var(--admin-on-surface-variant)] sm:ml-auto sm:mr-2"
        >
          {query.trim() === ""
            ? `${initialLocations.length} ${initialLocations.length === 1 ? "location" : "locations"}`
            : `${filtered.length} of ${initialLocations.length} matching`}
        </p>
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
              className={`absolute right-0 top-[calc(100%+6px)] z-20 w-52 bg-[var(--admin-surface)] p-1.5 shadow-lg ${dropdownPanelSurfaceClassName}`}
            >
              {COLUMNS.map((column) => (
                <label
                  key={column.id}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                >
                  <input
                    type="checkbox"
                    checked={!hidden.has(column.id)}
                    disabled={column.id === "title"}
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
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-4 py-16 text-center">
                    {/* Two different situations that used to share one message:
                        an empty list needs "add one", a filtered list needs
                        "clear the search". */}
                    <p className="text-sm font-medium text-[var(--admin-on-surface)]">
                      {query.trim() === "" ? "No locations yet" : "No locations match that search"}
                    </p>
                    <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                      {query.trim() === ""
                        ? "Add a location to charge learners in a specific currency by region."
                        : `Nothing matches “${query.trim()}”.`}
                    </p>
                    {query.trim() === "" ? null : (
                      <button
                        type="button"
                        onClick={() => {
                          setQuery("");
                          setPage(0);
                        }}
                        className="mt-3 rounded-lg border border-[var(--admin-border)] px-3 py-1.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                      >
                        Clear search
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((location) => (
                  <tr
                    key={location.id}
                    className="border-b border-[var(--admin-border)] last:border-b-0"
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-4 py-4 align-top">
                        {column.id === "title" ? (
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-14 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-xl">
                              {flagFor(location.locationKey)}
                            </span>
                            <span className="min-w-0">
                              <span className="block font-semibold text-[var(--admin-on-surface)]">
                                {location.title}
                              </span>
                              {location.isDefault ? (
                                <span className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                                  {/* This row catches every region without a
                                      location of its own, which is the one
                                      thing that made it different and the one
                                      thing the table never said. */}
                                  <Star className="h-3 w-3" aria-hidden="true" />
                                  Fallback for unlisted regions
                                </span>
                              ) : (
                                <span className="font-data mt-0.5 block text-xs text-[var(--admin-on-surface-variant)]">
                                  {location.locationKey}
                                </span>
                              )}
                            </span>
                          </div>
                        ) : column.id === "currency" ? (
                          <span className="inline-flex items-center gap-2 whitespace-nowrap text-[var(--admin-on-surface)]">
                            <span className="text-[var(--admin-on-surface-variant)]">
                              {currencySymbol(location.currency)}
                            </span>
                            {currencyName(location.currency) ?? location.currency}
                          </span>
                        ) : column.id === "status" ? (
                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                              location.status === "published"
                                ? "bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] text-[var(--admin-success)]"
                                : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]"
                            }`}
                          >
                            {location.status === "published" ? "Published" : "Unpublished"}
                          </span>
                        ) : (
                          <span className="block max-w-md text-[var(--admin-on-surface-variant)]">
                            {location.description ?? "—"}
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <div className="flex items-start gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-high)] p-4">
        <Info
          className="mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
          aria-hidden="true"
        />
        <p className="text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
          {/* Course pricing plans store the location as free text and match on
              this title, so the name is load-bearing — worth saying, since
              nothing else on the screen hints at it. */}
          A course pricing plan picks its location by name, so renaming one here does not follow
          through to plans already using the old name. Each region can have one location; the
          fallback row covers everywhere else.
        </p>
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
