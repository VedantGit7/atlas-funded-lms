"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Image as ImageIcon,
  MapPin,
  MoreVertical,
  Plus,
  Search,
  Users,
  Video,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import {
  EVENTS_CREATE_HREF,
  MARKETING_HREF,
  eventHref,
  eventStatusLabel,
  formatEventCount,
  formatEventDateTime,
  formatEventRelativeFromNow,
  type MarketingEventDto,
  type MarketingEventListSummary,
  type MarketingEventStatus,
} from "./events-shared";

type StatusTab = "ALL" | MarketingEventStatus | "PAST";

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
] as const;

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "LIVE", label: "Live" },
  { id: "DRAFT", label: "Draft" },
  { id: "UNPUBLISHED", label: "Unpublished" },
  { id: "PAST", label: "Past" },
];

type ListResponse = {
  data: {
    items: MarketingEventDto[];
    summary: MarketingEventListSummary;
  };
};

type EventResponse = { data: MarketingEventDto };

const EMPTY_SUMMARY: MarketingEventListSummary = {
  liveCount: 0,
  draftCount: 0,
  unpublishedCount: 0,
  pastCount: 0,
  totalCount: 0,
  totalRegistrations: 0,
  upcomingLiveCount: 0,
};

function statusTone(status: MarketingEventStatus): "success" | "warning" | "neutral" {
  if (status === "LIVE") return "success";
  if (status === "UNPUBLISHED") return "warning";
  return "neutral";
}

function StatusPill({ status }: { status: MarketingEventStatus }) {
  const tone = statusTone(status);
  const dotClass =
    tone === "success"
      ? "bg-[var(--admin-success)]"
      : tone === "warning"
        ? "bg-[var(--admin-warning)]"
        : "bg-[var(--admin-on-surface-variant)]";
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider",
        tone === "success"
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : tone === "warning"
            ? "bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} aria-hidden="true" />
      {eventStatusLabel(status)}
    </span>
  );
}

function PastPill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-surface-high)] px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
      <span
        className="h-1.5 w-1.5 rounded-full bg-[var(--admin-on-surface-variant)]"
        aria-hidden="true"
      />
      Past
    </span>
  );
}

function locationSubtitle(row: MarketingEventDto): { Icon: typeof MapPin; text: string } {
  if (row.location?.trim()) {
    return { Icon: MapPin, text: row.location.trim() };
  }
  if (row.joinUrl?.trim()) {
    return { Icon: Video, text: "Online" };
  }
  return { Icon: MapPin, text: "Not set" };
}

function TitleCell({ row }: { row: MarketingEventDto }) {
  const subtitle = locationSubtitle(row);
  const SubtitleIcon = subtitle.Icon;
  return (
    <div className="flex items-center gap-3">
      <span
        className="inline-flex h-10 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
        aria-hidden="true"
      >
        {row.coverImageUrl ? (
          <img
            src={row.coverImageUrl}
            alt=""
            className="h-full w-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <ImageIcon className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
        )}
      </span>
      <div className="min-w-0">
        <p className="truncate text-[14px] font-bold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
          {row.title}
        </p>
        <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-[var(--admin-on-surface-variant)]">
          <SubtitleIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {subtitle.text}
        </p>
      </div>
    </div>
  );
}

function isUpcoming(row: MarketingEventDto): boolean {
  if (row.isPast) return false;
  const start = new Date(row.startsAt).getTime();
  return !Number.isNaN(start) && start > Date.now();
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-6 py-5" colSpan={6}>
        <div className="h-12 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </td>
    </tr>
  );
}

export function EventsListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<MarketingEventDto[]>([]);
  const [summary, setSummary] = useState<MarketingEventListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteRow, setDeleteRow] = useState<MarketingEventDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
      setPage(1);
    }, 250);
    return () => {
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [tab, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "100");
      if (debouncedQuery) params.set("q", debouncedQuery);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/events?${params.toString()}`,
      );
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load events.");
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, safePage, pageSize]);

  const rangeStart = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, items.length);
  const hasFilters = Boolean(debouncedQuery || tab !== "ALL");
  const deleteMatches = deleteRow != null && deleteConfirm.trim() === deleteRow.title.trim();

  const tabCount = (id: StatusTab): number => {
    if (id === "ALL") return summary.totalCount;
    if (id === "LIVE") return summary.liveCount;
    if (id === "DRAFT") return summary.draftCount;
    if (id === "UNPUBLISHED") return summary.unpublishedCount;
    return summary.pastCount;
  };

  async function runAction(id: string, path: string, successMessage: string) {
    setActionBusy(id);
    try {
      await clientApi.post<EventResponse>(
        `/api/v1/marketing/events/${id}/${path}`,
        {},
        `marketing-event-${path}`,
        { successMessage },
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  function rowActions(row: MarketingEventDto): DropdownMenuItem[] {
    const actions: DropdownMenuItem[] = [
      {
        key: "edit",
        label: "Edit",
        onSelect: () => {
          router.push(eventHref(row.id));
        },
      },
    ];
    if (row.status === "LIVE") {
      actions.push({
        key: "unpublish",
        label: "Unpublish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "unpublish", "Event unpublished.");
        },
      });
    } else {
      actions.push({
        key: "publish",
        label: "Publish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "publish", "Event published.");
        },
      });
    }
    actions.push({
      key: "delete",
      label: "Delete",
      destructive: true,
      onSelect: () => {
        setDeleteRow(row);
        setDeleteConfirm("");
      },
    });
    return actions;
  }

  async function onDelete() {
    if (!deleteRow) return;
    if (deleteConfirm.trim() !== deleteRow.title.trim()) {
      toast.error("Type the event title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/events/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "marketing-event-delete",
        { successMessage: "Event deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete event.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setTab("ALL");
    setPage(1);
  }

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <nav
            aria-label="Breadcrumb"
            className="mb-2 flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]"
          >
            <Link
              href={MARKETING_HREF}
              prefetch={false}
              className="transition-colors hover:text-[var(--admin-primary)]"
            >
              Marketing
            </Link>
            <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="text-[var(--admin-primary)]">Events</span>
          </nav>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px] md:leading-10">
            Events
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] leading-6 text-[var(--admin-on-surface-variant)]">
            Schedule and promote live or virtual academy events
          </p>
        </div>
        <Link
          href={EVENTS_CREATE_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          Create event
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg bg-[var(--admin-surface-low)] p-1"
            role="tablist"
            aria-label="Event status"
          >
            {TABS.map((entry) => {
              const active = tab === entry.id;
              return (
                <button
                  key={entry.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setTab(entry.id);
                  }}
                  className={[
                    "rounded-md px-3 py-1.5 text-[12px] font-bold uppercase tracking-[0.04em] transition-all md:px-4",
                    active
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {entry.label}
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {formatEventCount(tabCount(entry.id))}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 md:max-w-xs">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search events..."
                className={`${MESSENGER_WIZARD_FIELD_CLASS} pl-9`}
                aria-label="Search events"
              />
            </div>
            <div className="w-[88px]">
              <AdminSelectDropdown
                id="events-page-size"
                label={null}
                ariaLabel="Rows per page"
                value={String(pageSize)}
                options={[...PAGE_SIZE_OPTIONS]}
                onChange={(value) => {
                  setPageSize(Number(value) || 10);
                }}
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] border-collapse text-left">
            <thead>
              <tr className="bg-[var(--admin-surface-low)]">
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Event title
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Starts
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Registrations
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
                <th className="px-6 py-3">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {loading
                ? Array.from({ length: 4 }, (_, index) => (
                    <SkeletonRow key={`sk-${String(index)}`} />
                  ))
                : null}
              {!loading && pageItems.length === 0 ? (
                <tr>
                  <td className="px-6 py-16" colSpan={5}>
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                        <CalendarDays className="h-8 w-8" aria-hidden="true" />
                      </div>
                      <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                        {hasFilters ? "No matching events" : "No events yet"}
                      </h2>
                      <p className="mt-2 text-[14px] leading-5 text-[var(--admin-on-surface-variant)]">
                        {hasFilters
                          ? "Try a different status or search term."
                          : "Create your first academy event and start collecting registrations."}
                      </p>
                      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        {hasFilters ? (
                          <button
                            type="button"
                            onClick={clearFilters}
                            className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)]"
                          >
                            Clear filters
                          </button>
                        ) : (
                          <Link
                            href={EVENTS_CREATE_HREF}
                            prefetch={false}
                            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)]"
                          >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                            Create your first event
                          </Link>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? pageItems.map((row) => {
                    const muted = row.isPast;
                    const upcoming = isUpcoming(row);
                    const pendingLaunch = row.status === "DRAFT" || row.registrationCount === 0;
                    return (
                      <tr
                        key={row.id}
                        className={[
                          "group cursor-pointer transition-colors hover:bg-[var(--admin-surface-low)]",
                          muted ? "opacity-70" : "",
                        ].join(" ")}
                        onClick={() => {
                          router.push(eventHref(row.id));
                        }}
                      >
                        <td className="px-6 py-4">
                          <TitleCell row={row} />
                        </td>
                        <td className="px-6 py-4">
                          <time
                            className="block text-[13px] font-medium text-[var(--admin-on-surface)]"
                            dateTime={row.startsAt}
                            title={row.startsAt}
                          >
                            {formatEventDateTime(row.startsAt)}
                          </time>
                          <span
                            className={[
                              "mt-0.5 block text-[12px]",
                              upcoming
                                ? "font-semibold text-[var(--admin-success)]"
                                : "text-[var(--admin-on-surface-variant)]",
                            ].join(" ")}
                          >
                            {formatEventRelativeFromNow(row.startsAt)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {pendingLaunch ? (
                            <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                              Pending launch
                            </span>
                          ) : (
                            <span className="text-[13px] font-bold tabular-nums text-[var(--admin-on-surface)]">
                              {formatEventCount(row.registrationCount)}{" "}
                              <span className="font-medium text-[var(--admin-on-surface-variant)]">
                                registered
                              </span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {row.isPast ? <PastPill /> : <StatusPill status={row.status} />}
                        </td>
                        <td
                          className="px-6 py-4 text-right"
                          onClick={(event) => {
                            event.stopPropagation();
                          }}
                        >
                          <DropdownMenu
                            label={`Actions for ${row.title}`}
                            align="end"
                            trigger={<MoreVertical className="h-4 w-4" aria-hidden="true" />}
                            triggerClassName="rounded-full p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
                            items={rowActions(row)}
                          />
                        </td>
                      </tr>
                    );
                  })
                : null}
            </tbody>
          </table>
        </div>

        {!loading && items.length > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
            <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
              Showing {String(rangeStart)} to {String(rangeEnd)} of {String(items.length)} events
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={safePage <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
                className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
              <span className="min-w-[4.5rem] text-center text-[12px] font-bold text-[var(--admin-on-surface)]">
                {String(safePage)} / {String(totalPages)}
              </span>
              <button
                type="button"
                disabled={safePage >= totalPages}
                onClick={() => {
                  setPage((current) => Math.min(totalPages, current + 1));
                }}
                className="rounded border border-[var(--admin-border)] bg-[var(--admin-surface)] p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label="Next page"
              >
                <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Total registrations
            </span>
            <Users className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatEventCount(summary.totalRegistrations)}
          </p>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            Across all events in this account
          </p>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Upcoming live
            </span>
            <CalendarDays
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatEventCount(summary.upcomingLiveCount)}
          </p>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            Published events with a future start time
          </p>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Total events
            </span>
            <CalendarDays
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatEventCount(summary.totalCount)}
          </p>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatEventCount(summary.liveCount)} live, {formatEventCount(summary.draftCount)} draft
          </p>
        </div>
      </div>

      {deleteRow ? (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[color-mix(in_srgb,var(--admin-on-surface)_35%,transparent)] p-4"
          role="presentation"
          onClick={() => {
            if (!deleteBusy) {
              setDeleteRow(null);
              setDeleteConfirm("");
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="event-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="event-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete event
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Unpublish first if Live. Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {deleteRow.title}
              </span>{" "}
              to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm event title"
              disabled={deleteBusy}
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-[var(--admin-border)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)]"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteRow(null);
                  setDeleteConfirm("");
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-danger)] disabled:opacity-50"
                disabled={deleteBusy || !deleteMatches}
                onClick={() => {
                  void onDelete();
                }}
              >
                {deleteBusy ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
