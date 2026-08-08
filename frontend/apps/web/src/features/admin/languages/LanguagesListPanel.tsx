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
  Languages as LanguagesIcon,
  Loader2,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Select } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { languageName } from "./language-catalog";

export type LanguageRow = {
  locale: string;
  nativeName: string | null;
  isRtl: boolean;
  isDefault: boolean;
  isFallback: boolean;
  updatedAt: string;
};

type ColumnId = "language" | "direction" | "status" | "updated";

const COLUMNS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: "language", label: "Language" },
  { id: "direction", label: "Direction" },
  { id: "status", label: "Status" },
  { id: "updated", label: "Last updated" },
];

const ROWS_PER_PAGE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
];

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

export function LanguagesListPanel({ initialLanguages }: { initialLanguages: LanguageRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(0);
  const [busyLocale, setBusyLocale] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<LanguageRow | null>(null);
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

  const rows = useMemo(
    () => initialLanguages.map((row) => ({ ...row, englishName: languageName(row.locale) })),
    [initialLanguages],
  );

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return rows;
    return rows.filter(
      (row) =>
        row.englishName.toLowerCase().includes(normalized) ||
        (row.nativeName ?? "").toLowerCase().includes(normalized) ||
        row.locale.toLowerCase().includes(normalized),
    );
  }, [rows, query]);

  const visibleColumns = useMemo(() => COLUMNS.filter((column) => !hidden.has(column.id)), [hidden]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
  const currentPage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(currentPage * rowsPerPage, currentPage * rowsPerPage + rowsPerPage);

  function toggleColumn(id: ColumnId) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (id !== "language" && visibleColumns.length > 1) next.add(id);
      return next;
    });
  }

  async function setDefault(row: LanguageRow) {
    setBusyLocale(row.locale);
    setError(null);
    try {
      await clientApi.put(
        `/api/v1/locales/metadata/${row.locale}`,
        { isDefault: true },
        "locale-set-default",
        { successMessage: `${languageName(row.locale)} is now the default language.` },
      );
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not update the default language.");
    } finally {
      setBusyLocale(null);
    }
  }

  async function removeLanguage(row: LanguageRow) {
    setBusyLocale(row.locale);
    setError(null);
    try {
      await clientApi.delete(`/api/v1/locales/metadata/${row.locale}`, "locale-remove", undefined, {
        successMessage: `${languageName(row.locale)} removed.`,
      });
      setConfirmRemove(null);
      router.refresh();
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Could not remove the language.");
    } finally {
      setBusyLocale(null);
    }
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] sm:text-3xl">
            Languages
          </h1>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Easily translate all your contents into different languages.
          </p>
        </div>
        <Link
          href="/admin/languages/add"
          prefetch={false}
          className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-[var(--admin-on-surface)] px-5 py-2.5 text-sm font-bold text-[var(--admin-surface)] shadow-sm transition-all hover:opacity-90 motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Create
        </Link>
      </header>

      {error ? (
        <p role="alert" className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            placeholder="Search by language"
            aria-label="Search by language"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-9 pr-3 text-sm text-[var(--admin-on-surface)] outline-none transition-colors placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
          />
        </div>
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
            <ChevronDown className={`h-4 w-4 text-[var(--admin-on-surface-variant)] transition-transform duration-200 ${columnsOpen ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
          {columnsOpen ? (
            <div
              role="menu"
              aria-label="Toggle columns"
              className={`absolute right-0 top-[calc(100%+6px)] z-20 w-52 bg-[var(--admin-surface)] p-1.5 shadow-lg ${dropdownPanelSurfaceClassName}`}
            >
              {COLUMNS.map((column) => (
                <label key={column.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]">
                  <input
                    type="checkbox"
                    checked={!hidden.has(column.id)}
                    disabled={column.id === "language"}
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
        <EmptyState hasQuery={query.trim().length > 0} />
      ) : (
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
              <PagerButton label="First page" disabled={currentPage === 0} onClick={() => { setPage(0); }}>
                <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
              </PagerButton>
              <PagerButton label="Previous page" disabled={currentPage === 0} onClick={() => { setPage((value) => Math.max(0, value - 1)); }}>
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </PagerButton>
              <PagerButton label="Next page" disabled={currentPage >= pageCount - 1} onClick={() => { setPage((value) => Math.min(pageCount - 1, value + 1)); }}>
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </PagerButton>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)]">
                  {visibleColumns.map((column) => (
                    <th key={column.id} className="whitespace-nowrap px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
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
                  <tr key={row.locale} className="border-b border-[var(--admin-border)] last:border-b-0">
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-4 py-4 align-middle">
                        {column.id === "language" ? (
                          <div className="flex items-center gap-3">
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-xs font-bold uppercase text-[var(--admin-primary)]">
                              {row.locale.slice(0, 2)}
                            </span>
                            <div className="min-w-0">
                              <p className="font-semibold text-[var(--admin-on-surface)]">{row.englishName}</p>
                              {row.nativeName && row.nativeName !== row.englishName ? (
                                <p className="text-xs text-[var(--admin-on-surface-variant)]">{row.nativeName}</p>
                              ) : null}
                            </div>
                          </div>
                        ) : column.id === "direction" ? (
                          <span className="text-[var(--admin-on-surface-variant)]">{row.isRtl ? "RTL" : "LTR"}</span>
                        ) : column.id === "status" ? (
                          <div className="flex flex-wrap gap-1.5">
                            {row.isDefault ? (
                              <span className="inline-flex items-center gap-1 rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_16%,var(--admin-surface))] px-2 py-0.5 text-xs font-semibold text-[var(--admin-primary)]">
                                <Star className="h-3 w-3" aria-hidden="true" />
                                Default
                              </span>
                            ) : null}
                            {row.isFallback ? (
                              <span className="rounded-md bg-[var(--admin-surface-high)] px-2 py-0.5 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
                                Fallback
                              </span>
                            ) : null}
                            {!row.isDefault && !row.isFallback ? (
                              <span className="rounded-md bg-[color-mix(in_srgb,var(--admin-success)_16%,var(--admin-surface))] px-2 py-0.5 text-xs font-semibold text-[var(--admin-success)]">
                                Active
                              </span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="whitespace-nowrap text-[var(--admin-on-surface-variant)]">{formatUpdated(row.updatedAt)}</span>
                        )}
                      </td>
                    ))}
                    <td className="px-4 py-4 align-middle">
                      <div className="flex items-center justify-end gap-1">
                        {!row.isDefault ? (
                          <button
                            type="button"
                            disabled={busyLocale === row.locale}
                            onClick={() => void setDefault(row)}
                            aria-label={`Set ${row.englishName} as default`}
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)] disabled:opacity-50"
                          >
                            {busyLocale === row.locale ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                            ) : (
                              <Star className="h-3.5 w-3.5" aria-hidden="true" />
                            )}
                            Set default
                          </button>
                        ) : null}
                        <button
                          type="button"
                          disabled={row.isDefault || busyLocale === row.locale}
                          onClick={() => {
                            setConfirmRemove(row);
                          }}
                          aria-label={`Remove ${row.englishName}`}
                          title={row.isDefault ? "The default language cannot be removed" : undefined}
                          className="rounded-lg p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-danger)] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
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
        title="Remove language?"
        description={
          confirmRemove
            ? `${languageName(confirmRemove.locale)} will no longer be available for translation. Existing translations are kept but hidden.`
            : ""
        }
        confirmLabel="Remove"
        destructive
        busy={busyLocale !== null}
        onConfirm={() => {
          if (confirmRemove) void removeLanguage(confirmRemove);
        }}
        onCancel={() => {
          setConfirmRemove(null);
        }}
      />
    </div>
  );
}

function EmptyState({ hasQuery }: { hasQuery: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24 text-center">
      <span className="flex h-20 w-20 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]">
        <LanguagesIcon className="h-9 w-9 text-[var(--admin-primary)]" aria-hidden="true" />
      </span>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No results found</p>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          {hasQuery
            ? "No languages match your search."
            : "Add a language to start translating your content."}
        </p>
      </div>
      {!hasQuery ? (
        <Link
          href="/admin/languages/add"
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] shadow-sm transition-all hover:opacity-90 motion-safe:active:scale-[0.98]"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Add language
        </Link>
      ) : null}
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
