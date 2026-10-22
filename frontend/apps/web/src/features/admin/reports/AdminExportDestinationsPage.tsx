"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { AlertCircle, Check, Download, FilterX, Inbox, Mail, Plus, Search } from "lucide-react";
import { ClientApiError } from "../../../lib/client-api";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import { DropdownField } from "../../studio/courses/admin-form-dropdown-shared";
import {
  DESTINATIONS_ROSTER_DEFAULTS,
  type DestinationsRosterPayload,
  deleteDestination,
  exportDestinationsList,
  fetchDestinationsRoster,
  testDestination,
  updateDestination,
  type DestinationItem,
  type DestinationKind,
  type DestinationSort,
  type DestinationStatusFilter,
  type DestinationsRosterSummary,
} from "./admin-export-destinations-api";
import { useReportLoad } from "./use-report-load";
import { useViewerLocale, withViewer, RenderedAtProvider } from "./viewer-time";
import {
  DestinationBlock,
  DestinationsLoadingSkeleton,
  type DrawerMode,
  EMPTY_SUMMARY,
  downloadCsv,
  fieldClassName,
  formatCountFor,
  formatRelativeFor,
  ghostButtonClassName,
  primaryButtonClassName,
  secondaryButtonClassName,
} from "./admin-export-destinations-shared";
import { DeleteDestinationModal, DestinationDrawer } from "./admin-export-destination-drawer";

type DestinationsPageProps = {
  /** The first page, loaded by the server; the first browser load is skipped when present. */
  initialRoster?: ReportInitialData<DestinationsRosterPayload> | null;
};

/**
 * Relative times on the page count from when the server rendered it until
 * hydration ends (see viewer-time), so both renders read the same.
 */
export function AdminExportDestinationsPage(props: DestinationsPageProps = {}) {
  return (
    <RenderedAtProvider renderedAt={props.initialRoster?.loadedAt ?? null}>
      <DestinationsRoster {...props} />
    </RenderedAtProvider>
  );
}

function DestinationsRoster({ initialRoster }: DestinationsPageProps) {
  const viewer = useViewerLocale();
  const formatCount = withViewer(formatCountFor, viewer);
  const formatRelative = withViewer(formatRelativeFor, viewer);
  const kindLabelId = useId();
  const statusLabelId = useId();
  const sortLabelId = useId();

  // Read once: later renders must not reset what the page has changed since.
  const [initial] = useState(() => initialRoster ?? null);
  const [loading, setLoading] = useState(initial === null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<DestinationItem[]>(initial?.data.items ?? []);
  const [summary, setSummary] = useState<DestinationsRosterSummary>(
    initial?.data.summary ?? EMPTY_SUMMARY,
  );
  const [totalCount, setTotalCount] = useState(initial?.data.pageInfo.totalCount ?? 0);
  const [page, setPage] = useState<number>(DESTINATIONS_ROSTER_DEFAULTS.page);
  const [totalPages, setTotalPages] = useState(initial?.data.pageInfo.totalPages ?? 0);

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [kind, setKind] = useState<DestinationKind | "any">(DESTINATIONS_ROSTER_DEFAULTS.kind);
  const [status, setStatus] = useState<DestinationStatusFilter>(
    DESTINATIONS_ROSTER_DEFAULTS.status,
  );
  const [sort, setSort] = useState<DestinationSort>(DESTINATIONS_ROSTER_DEFAULTS.sort);

  const [kindOpen, setKindOpen] = useState(false);
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<DrawerMode>("create");
  const [editItem, setEditItem] = useState<DestinationItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DestinationItem | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQ(q.trim());
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [q]);

  const load = useCallback(
    async (options?: { soft?: boolean }) => {
      const soft = options?.soft === true;
      if (!soft) setLoading(true);
      setError(null);
      try {
        const response = await fetchDestinationsRoster({
          q: debouncedQ || undefined,
          kind,
          status,
          sort,
          page,
          limit: DESTINATIONS_ROSTER_DEFAULTS.limit,
        });
        setItems(response.data.items);
        setSummary(response.data.summary);
        setTotalCount(response.data.pageInfo.totalCount);
        setTotalPages(response.data.pageInfo.totalPages);
      } catch (err) {
        setError(
          err instanceof ClientApiError
            ? err.message
            : err instanceof Error
              ? err.message
              : "Unable to load destinations.",
        );
        setItems([]);
        setSummary(EMPTY_SUMMARY);
      } finally {
        if (!soft) setLoading(false);
      }
    },
    [debouncedQ, kind, status, sort, page],
  );

  useReportLoad(load, initial);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, kind, status, sort]);

  const hasFilters = Boolean(debouncedQ) || kind !== "any" || status !== "all";

  function clearFilters() {
    setQ("");
    setKind("any");
    setStatus("all");
    setSort("name_asc");
  }

  async function handleExportList() {
    setBusy(true);
    setError(null);
    try {
      const response = await exportDestinationsList();
      downloadCsv(response.data.content, response.data.filename);
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to export list.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleActive(item: DestinationItem) {
    setBusy(true);
    setError(null);
    setMenuOpenId(null);
    try {
      await updateDestination(item.id, { isActive: !item.isActive });
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to update destination.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleTest(item: DestinationItem) {
    setBusy(true);
    setError(null);
    setMenuOpenId(null);
    try {
      await testDestination(item.id);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Test delivery failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setBusy(true);
    setError(null);
    try {
      await deleteDestination(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(
        err instanceof ClientApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Unable to delete destination.",
      );
    } finally {
      setBusy(false);
    }
  }

  function openCreateDrawer() {
    setDrawerMode("create");
    setEditItem(null);
    setDrawerOpen(true);
  }

  function openEditDrawer(item: DestinationItem) {
    setDrawerMode("edit");
    setEditItem(item);
    setDrawerOpen(true);
    setMenuOpenId(null);
  }

  async function copyWebhookUrl(url: string) {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      setError("Unable to copy URL to clipboard.");
    }
  }

  const moduleTabs: Array<{ key: string; label: string; href?: string; active?: boolean }> = [
    { key: "history", label: "History", href: "/admin/reports/exports" },
    { key: "new", label: "New export", href: "/admin/reports/exports/new" },
    { key: "schedules", label: "Schedules", href: "/admin/reports/exports/schedules" },
    {
      key: "destinations",
      label: "Destinations",
      href: "/admin/reports/exports/destinations",
      active: true,
    },
    { key: "settings", label: "Settings", href: "/admin/reports/exports/settings" },
  ];

  const kindFilterLabel =
    kind === "any"
      ? "Any kind"
      : kind === "email"
        ? "Email"
        : kind === "webhook"
          ? "Webhook"
          : "Storage";
  const statusFilterLabel =
    status === "all"
      ? "All statuses"
      : status === "enabled"
        ? "Enabled"
        : status === "disabled"
          ? "Disabled"
          : "Failing";
  const sortFilterLabel =
    sort === "name_asc"
      ? "Name (A-Z)"
      : sort === "updated_desc"
        ? "Recently updated"
        : sort === "last_delivery_desc"
          ? "Last delivery (latest)"
          : "Failures (most)";

  const showEmptyTrue =
    !loading && !error && items.length === 0 && !hasFilters && summary.totalCount === 0;
  const showEmptyFiltered = !loading && !error && items.length === 0 && hasFilters;

  const showingFrom = totalCount === 0 ? 0 : (page - 1) * 50 + 1;
  const showingTo = Math.min(page * 50, totalCount);

  return (
    <div className="relative flex flex-col gap-6 pb-28">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-2xl">
          <p className="mb-1 text-xs font-medium tracking-wide text-[var(--admin-on-surface-variant)]">
            Admin / Reports / Exports
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--admin-on-surface)]">
            Destinations
          </h1>
          <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
            Where scheduled and delivered exports are sent.
          </p>
          <nav
            className="mt-4 flex items-end gap-5 border-b border-[var(--admin-border)]"
            aria-label="Exports module"
          >
            {moduleTabs.map((tab) => {
              const className = `-mb-px border-b-2 pb-2 text-sm transition-colors ${
                tab.active
                  ? "border-[var(--admin-primary)] font-medium text-[var(--admin-primary)]"
                  : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]"
              }`;
              if (tab.href) {
                return (
                  <Link key={tab.key} href={tab.href} className={className}>
                    {tab.label}
                  </Link>
                );
              }
              return (
                <button
                  key={tab.key}
                  type="button"
                  disabled
                  title="Coming soon"
                  className={`${className} cursor-not-allowed opacity-50`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={secondaryButtonClassName}
            disabled={busy}
            onClick={() => {
              void handleExportList();
            }}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Export this list
          </button>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              openCreateDrawer();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New destination
          </button>
        </div>
      </div>

      {error ? (
        <div
          className="flex flex-wrap items-center gap-4 rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] p-4"
          role="alert"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-danger)_16%,var(--admin-surface))] text-[var(--admin-danger)]">
            <AlertCircle className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-[var(--admin-danger)]">
              Couldn&apos;t load destinations.
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">{error}</p>
          </div>
          <button
            type="button"
            className="rounded-lg border border-[var(--admin-danger)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--admin-danger)]"
            onClick={() => {
              void load();
            }}
          >
            Retry
          </button>
        </div>
      ) : null}

      {loading && items.length === 0 ? (
        <DestinationsLoadingSkeleton />
      ) : showEmptyTrue ? (
        <section className="flex min-h-[400px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-12 text-center">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full border border-dashed border-[var(--admin-outline)] bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
            <Inbox className="h-12 w-12" strokeWidth={1.25} aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
            No destinations configured
          </h2>
          <p className="mb-8 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            Exports can still be downloaded manually. Add a destination to deliver scheduled exports
            by email, webhook, or cloud storage.
          </p>
          <button
            type="button"
            className={primaryButtonClassName}
            onClick={() => {
              openCreateDrawer();
            }}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            New destination
          </button>
        </section>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:col-span-2">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Destinations
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {formatCount(summary.totalCount)}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-on-surface-variant)]">
                {formatCount(summary.emailCount)} email · {formatCount(summary.webhookCount)}{" "}
                webhook · {formatCount(summary.storageCount)} storage
              </p>
            </div>
            <div className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
              <p className="mb-2 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-on-surface-variant)] uppercase">
                Deliveries this month
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-on-surface)]">
                {formatCount(summary.deliveriesThisMonth)}
              </p>
              <p className="mt-2 text-xs text-[var(--admin-success)]">
                {formatCount(summary.deliveriesSucceededThisMonth)} succeeded
              </p>
            </div>
            <button
              type="button"
              className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-5 text-left transition-colors hover:bg-[var(--admin-surface-low)]"
              onClick={() => {
                setStatus("failing");
              }}
            >
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-danger)]" />
              <p className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-danger)] uppercase">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                Failing
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-danger)]">
                {formatCount(summary.failingCount)}
              </p>
              <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-danger)_80%,transparent)]">
                {summary.failingCaption ?? "No failing destinations"}
              </p>
            </button>
            <div className="relative overflow-hidden rounded-lg border border-[color-mix(in_srgb,var(--admin-warning)_30%,var(--admin-border))] bg-[var(--admin-surface)] p-5">
              <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--admin-warning)]" />
              <p className="mb-2 flex items-center gap-1 font-mono text-[10px] font-medium tracking-wider text-[var(--admin-warning)] uppercase">
                <Mail className="h-3.5 w-3.5" aria-hidden="true" />
                External recipients
              </p>
              <p className="font-mono text-[32px] leading-tight font-medium text-[var(--admin-warning)]">
                {formatCount(summary.externalRecipientCount)}
              </p>
              <p className="mt-2 text-xs text-[color-mix(in_srgb,var(--admin-warning)_80%,transparent)]">
                addresses outside tenant domain
              </p>
            </div>
          </div>

          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Showing {formatCount(showingFrom)} of {formatCount(totalCount)}
            {summary.lastDeliveryAt ? (
              <> · Last delivery {formatRelative(summary.lastDeliveryAt)}</>
            ) : null}
          </p>

          <div className="flex flex-wrap items-end gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4">
            <div className="flex min-w-[200px] flex-1 flex-col gap-1">
              <label className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                Search destinations
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute top-2.5 left-3 h-4 w-4 text-[var(--admin-on-surface-variant)]"
                  aria-hidden="true"
                />
                <input
                  className={`${fieldClassName} pl-9`}
                  placeholder="By name or target..."
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value);
                  }}
                />
              </div>
            </div>

            <div className="min-w-[130px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Kind
                  </span>
                }
                labelId={kindLabelId}
                open={kindOpen}
                onToggle={() => {
                  setKindOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{kindFilterLabel}</span>
                  </span>
                }
                panelAriaLabel="Kind options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["any", "Any kind"],
                      ["email", "Email"],
                      ["webhook", "Webhook"],
                      ["storage", "Storage"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={kind === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setKind(value);
                        setKindOpen(false);
                      }}
                    >
                      {kind === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="min-w-[140px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Status
                  </span>
                }
                labelId={statusLabelId}
                open={statusOpen}
                onToggle={() => {
                  setStatusOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{statusFilterLabel}</span>
                  </span>
                }
                panelAriaLabel="Status options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["all", "All statuses"],
                      ["enabled", "Enabled"],
                      ["disabled", "Disabled"],
                      ["failing", "Failing"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={status === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setStatus(value);
                        setStatusOpen(false);
                      }}
                    >
                      {status === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <div className="min-w-[170px]">
              <DropdownField
                label={
                  <span className="font-mono text-[10px] font-medium text-[var(--admin-on-surface-variant)] uppercase">
                    Sort by
                  </span>
                }
                labelId={sortLabelId}
                open={sortOpen}
                onToggle={() => {
                  setSortOpen((o) => !o);
                }}
                triggerContent={
                  <span className="flex w-full items-center gap-2 text-[13px]">
                    <span className="flex-1 text-left">{sortFilterLabel}</span>
                  </span>
                }
                panelAriaLabel="Sort options"
              >
                <div className="p-1.5" role="listbox">
                  {(
                    [
                      ["name_asc", "Name (A-Z)"],
                      ["updated_desc", "Recently updated"],
                      ["last_delivery_desc", "Last delivery (latest)"],
                      ["failures_desc", "Failures (most)"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="option"
                      aria-selected={sort === value}
                      className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        setSort(value);
                        setSortOpen(false);
                      }}
                    >
                      {sort === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <span className="w-3.5" />
                      )}
                      {label}
                    </button>
                  ))}
                </div>
              </DropdownField>
            </div>

            <button
              type="button"
              className={ghostButtonClassName}
              title="Clear filters"
              onClick={clearFilters}
              disabled={!hasFilters}
            >
              <FilterX className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {showEmptyFiltered ? (
            <section className="flex min-h-[240px] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-10 text-center">
              <Inbox
                className="mb-4 h-10 w-10 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <h2 className="mb-2 text-base font-semibold text-[var(--admin-on-surface)]">
                No destinations match these filters
              </h2>
              <p className="mb-6 text-sm text-[var(--admin-on-surface-variant)]">
                Try clearing filters or adding a new destination.
              </p>
              <button type="button" className={secondaryButtonClassName} onClick={clearFilters}>
                Clear filters
              </button>
            </section>
          ) : (
            <>
              <div className="space-y-3">
                {items.map((item) => (
                  <DestinationBlock
                    key={item.id}
                    item={item}
                    menuOpen={menuOpenId === item.id}
                    onToggleMenu={() => {
                      setMenuOpenId((current) => (current === item.id ? null : item.id));
                    }}
                    onEdit={() => {
                      openEditDrawer(item);
                    }}
                    onTest={() => {
                      void handleTest(item);
                    }}
                    onToggleActive={() => {
                      void handleToggleActive(item);
                    }}
                    onDelete={() => {
                      setMenuOpenId(null);
                      setDeleteTarget(item);
                    }}
                    onCopyWebhook={() => {
                      if (item.webhookUrl) void copyWebhookUrl(item.webhookUrl);
                    }}
                  />
                ))}
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between text-sm text-[var(--admin-on-surface-variant)]">
                  <span>
                    {formatCount(showingFrom)}-{formatCount(showingTo)} of {formatCount(totalCount)}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={page <= 1 || busy}
                      onClick={() => {
                        setPage((p) => Math.max(1, p - 1));
                      }}
                    >
                      Previous
                    </button>
                    <span>
                      Page {page} of {totalPages}
                    </span>
                    <button
                      type="button"
                      className={secondaryButtonClassName}
                      disabled={page >= totalPages || busy}
                      onClick={() => {
                        setPage((p) => p + 1);
                      }}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </>
      )}

      <DestinationDrawer
        open={drawerOpen}
        mode={drawerMode}
        editItem={editItem}
        tenantEmailDomains={summary.tenantEmailDomains}
        busy={busy}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSaved={() => {
          void load();
        }}
      />

      {deleteTarget ? (
        <DeleteDestinationModal
          item={deleteTarget}
          busy={busy}
          onCancel={() => {
            setDeleteTarget(null);
          }}
          onConfirm={() => {
            void handleDeleteConfirm();
          }}
        />
      ) : null}
    </div>
  );
}
