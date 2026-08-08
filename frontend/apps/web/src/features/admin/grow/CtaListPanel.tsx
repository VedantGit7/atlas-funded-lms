"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Eye,
  Megaphone,
  MousePointerClick,
  MoreVertical,
  PanelBottom,
  PanelTop,
  Plus,
  Search,
  Square,
  TrendingUp,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import {
  CTA_CREATE_HREF,
  MARKETING_HREF,
  ctaHref,
  ctaStatusLabel,
  ctaTypeLabel,
  formatCompactCtaCount,
  formatCtaCount,
  formatCtaRelativeTime,
  type CtaDto,
  type CtaListSummary,
  type CtaStatus,
  type CtaType,
} from "./cta-shared";

type StatusTab = "ALL" | CtaStatus;
type TypeFilter = "ALL" | CtaType;

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
] as const;

const TYPE_FILTER_OPTIONS: ReadonlyArray<{ value: TypeFilter; label: string }> = [
  { value: "ALL", label: "All types" },
  { value: "POPUP", label: "Pop-up" },
  { value: "STICKY", label: "Sticky banner" },
  { value: "SLIDE_IN", label: "Slide-in" },
  { value: "EMBEDDED_BUTTON", label: "Embedded button" },
];

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "LIVE", label: "Live" },
  { id: "DRAFT", label: "Draft" },
  { id: "UNPUBLISHED", label: "Unpublished" },
];

type ListResponse = {
  data: {
    items: CtaDto[];
    summary: CtaListSummary;
  };
};

type CtaResponse = { data: CtaDto };

const EMPTY_SUMMARY: CtaListSummary = {
  liveCount: 0,
  draftCount: 0,
  unpublishedCount: 0,
  totalCount: 0,
  totalViews: 0,
  totalClicks: 0,
  avgClickRate: 0,
  topType: null,
};

function ctaTypeIcon(type: CtaType) {
  switch (type) {
    case "POPUP":
      return Square;
    case "STICKY":
      return PanelTop;
    case "SLIDE_IN":
      return PanelBottom;
    case "EMBEDDED_BUTTON":
      return MousePointerClick;
    default:
      return Megaphone;
  }
}

function StatusPill({ status }: { status: CtaStatus }) {
  const tone =
    status === "LIVE" ? "success" : status === "UNPUBLISHED" ? "warning" : "neutral";
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
      {ctaStatusLabel(status)}
    </span>
  );
}

function TypeCell({ type }: { type: CtaType }) {
  const Icon = ctaTypeIcon(type);
  return (
    <div className="flex items-center gap-2">
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
        aria-hidden="true"
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[13px] font-medium text-[var(--admin-on-surface-variant)]">
        {ctaTypeLabel(type)}
      </span>
    </div>
  );
}

function ClickRateCell({ rate }: { rate: number }) {
  const clamped = Math.min(100, Math.max(0, rate));
  return (
    <div className="min-w-[7rem] space-y-1.5">
      <span className="text-[13px] font-bold tabular-nums text-[var(--admin-on-surface)]">
        {rate}%
      </span>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
        <div
          className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-300"
          style={{ width: `${String(clamped)}%` }}
        />
      </div>
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr aria-hidden="true">
      <td className="px-6 py-5" colSpan={7}>
        <div className="h-12 animate-pulse rounded-xl bg-[var(--admin-surface-high)]" />
      </td>
    </tr>
  );
}

export function CtaListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<CtaDto[]>([]);
  const [summary, setSummary] = useState<CtaListSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteRow, setDeleteRow] = useState<CtaDto | null>(null);
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
  }, [tab, typeFilter, pageSize]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "100");
      if (typeFilter !== "ALL") params.set("ctaType", typeFilter);
      if (debouncedQuery) params.set("q", debouncedQuery);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/ctas?${params.toString()}`,
      );
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not load CTAs.");
    } finally {
      setLoading(false);
    }
  }, [tab, typeFilter, debouncedQuery]);

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
  const hasFilters = Boolean(debouncedQuery || tab !== "ALL" || typeFilter !== "ALL");
  const deleteMatches =
    deleteRow != null && deleteConfirm.trim() === deleteRow.title.trim();

  const tabCount = (id: StatusTab): number => {
    if (id === "ALL") return summary.totalCount;
    if (id === "LIVE") return summary.liveCount;
    if (id === "DRAFT") return summary.draftCount;
    return summary.unpublishedCount;
  };

  async function runAction(id: string, path: string, successMessage: string) {
    setActionBusy(id);
    try {
      await clientApi.post<CtaResponse>(
        `/api/v1/marketing/ctas/${id}/${path}`,
        {},
        `cta-${path}`,
        { successMessage },
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Action failed.");
    } finally {
      setActionBusy(null);
    }
  }

  function rowActions(row: CtaDto): DropdownMenuItem[] {
    const actions: DropdownMenuItem[] = [
      {
        key: "edit",
        label: "Edit",
        onSelect: () => {
          router.push(ctaHref(row.id));
        },
      },
    ];
    if (row.status === "LIVE") {
      actions.push({
        key: "unpublish",
        label: "Unpublish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "unpublish", "CTA unpublished.");
        },
      });
    } else {
      actions.push({
        key: "publish",
        label: "Publish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void runAction(row.id, "publish", "CTA published.");
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
      toast.error("Type the CTA title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/ctas/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "cta-delete",
        { successMessage: "CTA deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete CTA.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setDebouncedQuery("");
    setTab("ALL");
    setTypeFilter("ALL");
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
            <span className="text-[var(--admin-primary)]">CTA</span>
          </nav>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px] md:leading-10">
            CTA
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] leading-6 text-[var(--admin-on-surface-variant)]">
            Pop-ups, sticky banners, slide-ins, and embedded buttons. Connect Live forms, set
            targeting, publish, then track views and click rate.
          </p>
        </div>
        <Link
          href={CTA_CREATE_HREF}
          prefetch={false}
          className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
        >
          <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
          Create CTA
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
          <div
            className="flex flex-wrap items-center gap-1 rounded-lg bg-[var(--admin-surface-low)] p-1"
            role="tablist"
            aria-label="CTA status"
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
                    {formatCtaCount(tabCount(entry.id))}
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
                placeholder="Search CTAs..."
                className={`${MESSENGER_WIZARD_FIELD_CLASS} pl-9`}
                aria-label="Search CTAs"
              />
            </div>
            <div className="min-w-[10rem]">
              <AdminSelectDropdown
                id="cta-type-filter"
                label={null}
                ariaLabel="Filter by CTA type"
                value={typeFilter}
                options={[...TYPE_FILTER_OPTIONS]}
                onChange={(value) => {
                  setTypeFilter(value as TypeFilter);
                }}
              />
            </div>
            <div className="w-[88px]">
              <AdminSelectDropdown
                id="cta-page-size"
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
                  Title
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Type
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Views
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Click rate
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Updated
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
                  <td className="px-6 py-16" colSpan={7}>
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                        <Megaphone className="h-8 w-8" aria-hidden="true" />
                      </div>
                      <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                        {hasFilters ? "No matching CTAs" : "No CTAs yet"}
                      </h2>
                      <p className="mt-2 text-[14px] leading-5 text-[var(--admin-on-surface-variant)]">
                        {hasFilters
                          ? "Try a different status, type, or search term."
                          : "Create your first pop-up, banner, slide-in, or embedded button CTA."}
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
                            href={CTA_CREATE_HREF}
                            prefetch={false}
                            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)]"
                          >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                            Create your first CTA
                          </Link>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? pageItems.map((row) => {
                    const muted = row.status !== "LIVE";
                    return (
                      <tr
                        key={row.id}
                        className="group cursor-pointer transition-colors hover:bg-[var(--admin-surface-low)]"
                        onClick={() => {
                          router.push(ctaHref(row.id));
                        }}
                      >
                        <td className="px-6 py-4">
                          <p
                            className={[
                              "text-[14px] font-bold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]",
                              muted ? "opacity-85" : "",
                            ].join(" ")}
                          >
                            {row.title}
                          </p>
                          {row.description ? (
                            <p className="mt-0.5 line-clamp-1 text-[13px] text-[var(--admin-on-surface-variant)]">
                              {row.description}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[13px] text-[var(--admin-on-surface-variant)]">
                              No admin description
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <TypeCell type={row.ctaType} />
                        </td>
                        <td className="px-6 py-4">
                          <StatusPill status={row.status} />
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-[13px] font-bold tabular-nums text-[var(--admin-on-surface)]">
                            {formatCtaCount(row.viewCount)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <ClickRateCell rate={row.clickRate} />
                        </td>
                        <td className="px-6 py-4">
                          <time
                            className="text-[13px] text-[var(--admin-on-surface-variant)]"
                            dateTime={row.updatedAt}
                            title={row.updatedAt}
                          >
                            {formatCtaRelativeTime(row.updatedAt)}
                          </time>
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
              Showing {String(rangeStart)} to {String(rangeEnd)} of {String(items.length)} CTAs
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
              Total views
            </span>
            <Eye className="h-4 w-4 text-[var(--admin-on-surface-variant)]" aria-hidden="true" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCompactCtaCount(summary.totalViews)}
          </p>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            Across {formatCtaCount(summary.totalCount)} CTAs in this list
          </p>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Avg click rate
            </span>
            <TrendingUp
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {summary.avgClickRate}%
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)]"
              style={{
                width: `${String(Math.min(100, Math.max(0, summary.avgClickRate)))}%`,
              }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Top type
            </span>
            <Megaphone
              className="h-4 w-4 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {summary.topType ? ctaTypeLabel(summary.topType) : "None"}
          </p>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            Most used CTA format in your account
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
            aria-labelledby="cta-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="cta-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete CTA
            </h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Unpublish first if Live. Type{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">{deleteRow.title}</span>{" "}
              to confirm.
            </p>
            <input
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={MESSENGER_WIZARD_FIELD_CLASS}
              aria-label="Confirm CTA title"
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
                className="rounded-xl bg-[var(--admin-danger)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] disabled:opacity-50"
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
