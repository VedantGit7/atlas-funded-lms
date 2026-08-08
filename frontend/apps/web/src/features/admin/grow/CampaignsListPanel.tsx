"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Download,
  Mail,
  Megaphone,
  MessageCircle,
  MoreVertical,
  Plus,
  Search,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import {
  CAMPAIGN_CREATE_HREF,
  MARKETING_HREF,
  campaignAnalyticsHref,
  campaignChannelLabel,
  campaignGoalLabel,
  campaignHref,
  campaignStatusLabel,
  formatCampaignCount,
  formatCampaignRelativeTime,
  formatCompactCount,
  type CampaignChannel,
  type CampaignChannels,
  type CampaignListSummary,
  type CampaignStatus,
  type MarketingCampaignDto,
} from "./campaigns-shared";

type StatusTab = "ALL" | CampaignStatus;

type CampaignsListResponse = {
  data: {
    items: MarketingCampaignDto[];
    summary: CampaignListSummary;
  };
};

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10" },
  { value: "25", label: "25" },
  { value: "50", label: "50" },
] as const;

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All campaigns" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "DRAFT", label: "Draft" },
  { id: "SENT", label: "Completed" },
];

function rowHref(row: MarketingCampaignDto): string {
  return row.status === "SENT" ? campaignAnalyticsHref(row.id) : campaignHref(row.id);
}

function enabledChannels(channels: CampaignChannels): CampaignChannel[] {
  return (Object.keys(channels) as CampaignChannel[]).filter((key) => channels[key]);
}

function channelIcons(channels: CampaignChannels) {
  const enabled = enabledChannels(channels);
  if (enabled.length === 0) {
    return (
      <span className="text-[13px] text-[var(--admin-on-surface-variant)]">Not set</span>
    );
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {enabled.map((channel) => {
        const Icon =
          channel === "email"
            ? Mail
            : channel === "push"
              ? Bell
              : channel === "announcement"
                ? Megaphone
                : MessageCircle;
        return (
          <span
            key={channel}
            className="inline-flex items-center gap-1 text-[var(--admin-on-surface-variant)]"
            title={campaignChannelLabel(channel)}
          >
            <Icon className="h-[16px] w-[16px]" aria-hidden="true" />
            <span className="sr-only">{campaignChannelLabel(channel)}</span>
          </span>
        );
      })}
      <span className="text-[12px] font-semibold text-[var(--admin-on-surface-variant)]">
        {enabled.map(campaignChannelLabel).join(", ")}
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: CampaignStatus }) {
  const tone =
    status === "SENT" ? "success" : status === "SCHEDULED" ? "warning" : "neutral";
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
      {status === "SCHEDULED" ? (
        <span
          className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--admin-warning)]"
          aria-hidden="true"
        />
      ) : null}
      {campaignStatusLabel(status)}
    </span>
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

function downloadCsv(rows: MarketingCampaignDto[]) {
  const header = [
    "title",
    "goal",
    "status",
    "audience",
    "reach",
    "touchpoints",
    "channels",
    "scheduled_at",
    "launched_at",
    "updated_at",
  ];
  const lines = [
    header.join(","),
    ...rows.map((row) => {
      const cells = [
        row.title,
        row.goal ?? "",
        row.status,
        row.audienceLabel ?? "",
        String(row.recipientCount),
        String(row.touchpoints.length),
        enabledChannels(row.channels).join("|"),
        row.scheduledAt ?? "",
        row.launchedAt ?? "",
        row.updatedAt,
      ];
      return cells.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",");
    }),
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `campaigns-${new Date().toISOString().slice(0, 10)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function CampaignsListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<MarketingCampaignDto[]>([]);
  const [summary, setSummary] = useState<CampaignListSummary>({
    draftCount: 0,
    scheduledCount: 0,
    sentCount: 0,
    totalCount: 0,
    totalReach: 0,
  });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteRow, setDeleteRow] = useState<MarketingCampaignDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);

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
      params.set("status", "ALL");
      params.set("limit", "100");
      params.set("offset", "0");

      const response = await clientApi.get<CampaignsListResponse>(
        `/api/v1/marketing/campaigns?${params.toString()}`,
      );
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (caught) {
      setItems([]);
      setSummary({
        draftCount: 0,
        scheduledCount: 0,
        sentCount: 0,
        totalCount: 0,
        totalReach: 0,
      });
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load campaigns.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debouncedQuery.toLowerCase();
    return items.filter((item) => {
      if (tab !== "ALL" && item.status !== tab) return false;
      if (!q) return true;
      const haystack = [
        item.title,
        item.audienceLabel ?? "",
        item.goal ? campaignGoalLabel(item.goal) : "",
        campaignStatusLabel(item.status),
        enabledChannels(item.channels).map(campaignChannelLabel).join(" "),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, tab, debouncedQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const rangeStart = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const rangeEnd = Math.min(safePage * pageSize, filtered.length);
  const hasFilters = Boolean(debouncedQuery || tab !== "ALL");
  const deleteMatches =
    deleteRow != null && deleteConfirm.trim() === deleteRow.title.trim();

  const tabCount = (id: StatusTab): number => {
    if (id === "ALL") return summary.totalCount;
    if (id === "DRAFT") return summary.draftCount;
    if (id === "SCHEDULED") return summary.scheduledCount;
    return summary.sentCount;
  };

  function rowActions(row: MarketingCampaignDto): DropdownMenuItem[] {
    return [
      {
        key: "open",
        label: row.status === "SENT" ? "View analytics" : "Open builder",
        onSelect: () => {
          router.push(rowHref(row));
        },
      },
      {
        key: "delete",
        label: "Delete",
        destructive: true,
        onSelect: () => {
          setDeleteRow(row);
          setDeleteConfirm("");
        },
      },
    ];
  }

  async function onDelete() {
    if (!deleteRow) return;
    if (deleteConfirm.trim() !== deleteRow.title.trim()) {
      toast.error("Type the campaign title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/campaigns/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        `campaign-delete-${deleteRow.id}`,
        { successMessage: "Campaign deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not delete campaign.",
      );
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

  const scheduledShare =
    summary.totalCount === 0
      ? 0
      : Math.round((summary.scheduledCount / summary.totalCount) * 100);
  const draftShare =
    summary.totalCount === 0
      ? 0
      : Math.round((summary.draftCount / summary.totalCount) * 100);
  const sentShare =
    summary.totalCount === 0
      ? 0
      : Math.round((summary.sentCount / summary.totalCount) * 100);

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
            <span className="text-[var(--admin-primary)]">Campaigns</span>
          </nav>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px] md:leading-10">
            Campaigns
          </h1>
          <p className="mt-1 max-w-2xl text-[15px] leading-6 text-[var(--admin-on-surface-variant)]">
            Plan coordinated email, push, announcement, and WhatsApp touchpoints in one builder.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              downloadCsv(filtered);
            }}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Download className="h-[18px] w-[18px]" aria-hidden="true" />
            Export CSV
          </button>
          <Link
            href={CAMPAIGN_CREATE_HREF}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
          >
            <Plus className="h-[18px] w-[18px]" aria-hidden="true" />
            New campaign
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="flex flex-col gap-3 border-b border-[var(--admin-border)] px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6 md:py-4">
          <div
            className="flex flex-wrap items-center gap-1"
            role="tablist"
            aria-label="Campaign status"
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
                    "border-b-2 px-3 py-2 text-[12px] font-bold uppercase tracking-[0.04em] transition-colors md:px-4",
                    active
                      ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                      : "border-transparent text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-primary)]",
                  ].join(" ")}
                >
                  {entry.label}
                  <span className="ml-1.5 tabular-nums opacity-70">
                    {tabCount(entry.id)}
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
                placeholder="Search campaigns or audiences..."
                className={`${MESSENGER_WIZARD_FIELD_CLASS} pl-9`}
                aria-label="Search campaigns"
              />
            </div>
            <div className="w-[88px]">
              <AdminSelectDropdown
                id="campaigns-page-size"
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
                  Campaign
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Goal
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Channels
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Reach
                </th>
                <th className="px-6 py-3 text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Touchpoints
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
                  <td className="px-6 py-16" colSpan={8}>
                    <div className="mx-auto flex max-w-md flex-col items-center text-center">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-on-surface-variant)]">
                        <Megaphone className="h-8 w-8" aria-hidden="true" />
                      </div>
                      <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
                        {hasFilters ? "No matching campaigns" : "No campaigns yet"}
                      </h2>
                      <p className="mt-2 text-[14px] leading-5 text-[var(--admin-on-surface-variant)]">
                        {hasFilters
                          ? "Try a different status or search term."
                          : "Create a multi-channel campaign with goals, audience, and a touchpoint timeline."}
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
                            href={CAMPAIGN_CREATE_HREF}
                            prefetch={false}
                            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)]"
                          >
                            <Plus className="h-5 w-5" aria-hidden="true" />
                            Create your first campaign
                          </Link>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors hover:bg-[var(--admin-surface-low)]"
                      onClick={() => {
                        router.push(rowHref(row));
                      }}
                    >
                      <td className="px-6 py-4">
                        <p className="text-[14px] font-bold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
                          {row.title}
                        </p>
                        <p className="mt-0.5 text-[13px] text-[var(--admin-on-surface-variant)]">
                          {row.audienceLabel
                            ? `Audience: ${row.audienceLabel}`
                            : "Audience not set"}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-medium text-[var(--admin-on-surface-variant)]">
                          {campaignGoalLabel(row.goal)}
                        </span>
                      </td>
                      <td className="px-6 py-4">{channelIcons(row.channels)}</td>
                      <td className="px-6 py-4">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] font-bold text-[var(--admin-on-surface)]">
                          {row.recipientCount > 0
                            ? formatCampaignCount(row.recipientCount)
                            : "—"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[13px] text-[var(--admin-on-surface-variant)]">
                          {formatCampaignCount(row.touchpoints.length)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
                          {formatCampaignRelativeTime(row.updatedAt)}
                        </p>
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
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-6">
          <p className="text-[13px] text-[var(--admin-on-surface-variant)]">
            {filtered.length === 0
              ? "Showing 0 campaigns"
              : `Showing ${String(rangeStart)} to ${String(rangeEnd)} of ${String(filtered.length)} campaigns`}
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
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Lifetime reach
            </span>
            <span className="text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
              From launched campaigns
            </span>
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCompactCount(summary.totalReach)}
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)]"
              style={{ width: `${String(Math.min(100, Math.max(sentShare, 8)))}%` }}
            />
          </div>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Scheduled pipeline
            </span>
            <span className="text-[11px] font-bold text-[var(--admin-primary)]">
              {summary.scheduledCount === 0 ? "Clear" : "Queued"}
            </span>
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCampaignCount(summary.scheduledCount)}
          </p>
          <div className="mt-4 h-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full rounded-full bg-[var(--admin-warning)]"
              style={{
                width: `${String(Math.min(100, Math.max(scheduledShare, summary.scheduledCount > 0 ? 12 : 0)))}%`,
              }}
            />
          </div>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            Drafts waiting: {formatCampaignCount(summary.draftCount)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <div className="mb-4 flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Campaign mix
            </span>
            <span className="text-[11px] font-bold text-[var(--admin-on-surface-variant)]">
              {formatCampaignCount(summary.totalCount)} total
            </span>
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            {formatCampaignCount(summary.sentCount)}
            <span className="ml-2 text-[14px] font-semibold text-[var(--admin-on-surface-variant)]">
              completed
            </span>
          </p>
          <div className="mt-4 flex h-1 overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full bg-[var(--admin-success)]"
              style={{ width: `${String(sentShare)}%` }}
            />
            <div
              className="h-full bg-[var(--admin-warning)]"
              style={{ width: `${String(scheduledShare)}%` }}
            />
            <div
              className="h-full bg-[var(--admin-on-surface-variant)] opacity-40"
              style={{ width: `${String(draftShare)}%` }}
            />
          </div>
          <p className="mt-3 text-[12px] text-[var(--admin-on-surface-variant)]">
            Completed / scheduled / draft share of all campaigns
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
            aria-labelledby="campaign-delete-title"
            className="w-full max-w-md rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-lg"
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="campaign-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete campaign
            </h2>
            <p className="mt-2 text-[14px] text-[var(--admin-on-surface-variant)]">
              This permanently deletes{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {deleteRow.title}
              </span>
              . Type the title to confirm.
            </p>
            <input
              type="text"
              value={deleteConfirm}
              onChange={(event) => {
                setDeleteConfirm(event.target.value);
              }}
              className={`${MESSENGER_WIZARD_FIELD_CLASS} mt-4`}
              placeholder={deleteRow.title}
              aria-label="Confirm campaign title"
              disabled={deleteBusy}
            />
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteRow(null);
                  setDeleteConfirm("");
                }}
                className="rounded-lg border border-[var(--admin-border)] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-surface)]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || !deleteMatches}
                onClick={() => {
                  void onDelete();
                }}
                className="rounded-lg bg-[var(--admin-danger,var(--admin-warning))] px-4 py-2 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] disabled:cursor-not-allowed disabled:opacity-50"
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
