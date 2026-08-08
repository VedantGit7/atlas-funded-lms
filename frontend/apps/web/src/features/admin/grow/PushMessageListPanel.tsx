"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  ExternalLink,
  FlaskConical,
  Globe,
  MoreHorizontal,
  Plus,
  Search,
  Smartphone,
  TabletSmartphone,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  manageDangerButtonClassName,
  managePageDescClassName,
  managePageTitleClassName,
  managePrimaryButtonClassName,
  manageSecondaryButtonClassName,
} from "../manage/manage-ui-shared";
import {
  formatCompactCount,
  formatPushDate,
  formatPushDateTime,
  PUSH_CREATE_HREF,
  pushMessageHref,
  type PushMessageDto,
  type PushMessageStatus,
  type PushMessagesSummary,
} from "./push-message-shared";

const MESSENGER_HREF = "/admin/marketing/messenger";
const PAGE_SIZE = 10;

type StatusTab = "ALL" | PushMessageStatus;
type ColumnId =
  | "title"
  | "status"
  | "channels"
  | "created"
  | "scheduled"
  | "reach"
  | "actions";

const TABS: ReadonlyArray<{ id: StatusTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "SENT", label: "Sent" },
  { id: "SCHEDULED", label: "Scheduled" },
  { id: "DRAFT", label: "Draft" },
];

const COLUMNS: ReadonlyArray<{ id: ColumnId; label: string }> = [
  { id: "title", label: "Title & audience" },
  { id: "status", label: "Status" },
  { id: "channels", label: "Channels" },
  { id: "created", label: "Created" },
  { id: "scheduled", label: "Scheduled / sent" },
  { id: "reach", label: "Reach" },
  { id: "actions", label: "" },
];

type ListResponse = { data: { items: PushMessageDto[]; total: number } };
type SummaryResponse = { data: PushMessagesSummary };

function emptySummary(): PushMessagesSummary {
  return {
    draftCount: 0,
    scheduledCount: 0,
    sentCount: 0,
    totalReach: 0,
    reach30d: 0,
    reachTrendPercent: null,
    channelCoverage: { androidPercent: 0, iosPercent: 0, webPercent: 0 },
    messageCount: 0,
  };
}

function StatusPill({ status }: { status: PushMessageStatus }) {
  const styles =
    status === "SENT"
      ? "border-[color-mix(in_srgb,var(--admin-success)_24%,transparent)] bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
      : status === "SCHEDULED"
        ? "border-[color-mix(in_srgb,var(--admin-warning)_24%,transparent)] bg-[color-mix(in_srgb,var(--admin-warning)_12%,var(--admin-surface))] text-[var(--admin-warning)]"
        : "border-[var(--admin-border)] bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]";
  const dot =
    status === "SENT"
      ? "bg-[var(--admin-success)]"
      : status === "SCHEDULED"
        ? "bg-[var(--admin-warning)] motion-safe:animate-pulse"
        : "bg-[var(--admin-on-surface-variant)]";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${styles}`}
    >
      <span className={`mr-2 h-1.5 w-1.5 rounded-full ${dot}`} aria-hidden="true" />
      {status === "SENT" ? "Sent" : status === "SCHEDULED" ? "Scheduled" : "Draft"}
    </span>
  );
}

function ChannelIcon({
  label,
  Icon,
  enabled,
}: {
  label: string;
  Icon: LucideIcon;
  enabled: boolean;
}) {
  return (
    <div
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded ${
        enabled
          ? "bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] text-[var(--admin-primary)]"
          : "bg-[var(--admin-surface-low)] text-[var(--admin-outline)]"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
      <span className="sr-only">
        {label}
        {enabled ? " enabled" : " disabled"}
      </span>
    </div>
  );
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-[var(--admin-surface-high)] ${className}`}
      aria-hidden="true"
    />
  );
}

export function PushMessageListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<PushMessageDto[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<PushMessagesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState<Set<ColumnId>>(new Set());
  const [columnsOpen, setColumnsOpen] = useState(false);
  const [createdOnOpen, setCreatedOnOpen] = useState(false);
  const [createdOn, setCreatedOn] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [settingsRow, setSettingsRow] = useState<PushMessageDto | null>(null);
  const [settingsTitle, setSettingsTitle] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);
  const columnsRef = useRef<HTMLDivElement>(null);
  const createdOnRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

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
  }, [tab, createdOn]);

  const loadSummary = useCallback(async () => {
    try {
      const response = await clientApi.get<SummaryResponse>(
        "/api/v1/marketing/push-messages-summary",
      );
      setSummary(response.data);
    } catch {
      setSummary(emptySummary());
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", String(PAGE_SIZE));
      params.set("offset", String((page - 1) * PAGE_SIZE));
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (createdOn) params.set("createdOn", createdOn);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/push-messages?${params.toString()}`,
      );
      setItems(response.data.items);
      setTotal(response.data.total);
    } catch (caught) {
      setItems([]);
      setTotal(0);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load push messages.",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery, createdOn, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    if (!columnsOpen && !createdOnOpen && !menuId) return;
    function onPointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (columnsOpen && !columnsRef.current?.contains(target)) setColumnsOpen(false);
      if (createdOnOpen && !createdOnRef.current?.contains(target)) setCreatedOnOpen(false);
      if (menuId && !menuRef.current?.contains(target)) setMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setColumnsOpen(false);
        setCreatedOnOpen(false);
        setMenuId(null);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [columnsOpen, createdOnOpen, menuId]);

  const visibleColumns = useMemo(
    () => COLUMNS.filter((column) => !hidden.has(column.id)),
    [hidden],
  );

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const stats = summary ?? emptySummary();

  const pageNumbers = useMemo(() => {
    if (pageCount <= 5) {
      return Array.from({ length: pageCount }, (_, index) => index + 1);
    }
    const pages = new Set<number>([1, pageCount, page, page - 1, page + 1]);
    return [...pages].filter((value) => value >= 1 && value <= pageCount).sort((a, b) => a - b);
  }, [page, pageCount]);

  function toggleColumn(id: ColumnId) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else if (id !== "title" && id !== "actions" && visibleColumns.length > 3) next.add(id);
      return next;
    });
  }

  function openSettings(row: PushMessageDto) {
    setSettingsRow(row);
    setSettingsTitle(row.title);
    setDeleteConfirm("");
    setMenuId(null);
  }

  async function saveSettingsTitle() {
    if (!settingsRow) return;
    const trimmed = settingsTitle.trim();
    if (!trimmed) {
      toast.error("Title cannot be empty.");
      return;
    }
    setSettingsBusy(true);
    try {
      await clientApi.patch(
        `/api/v1/marketing/push-messages/${settingsRow.id}`,
        { title: trimmed },
        `push-message-title-${settingsRow.id}`,
      );
      setSettingsRow(null);
      await Promise.all([load(), loadSummary()]);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update title.");
    } finally {
      setSettingsBusy(false);
    }
  }

  async function deleteFromSettings() {
    if (!settingsRow) return;
    if (deleteConfirm !== settingsRow.title) {
      toast.error("Type the exact title to confirm deletion.");
      return;
    }
    setSettingsBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/push-messages/${settingsRow.id}/delete`,
        { titleConfirmation: deleteConfirm },
        `push-message-delete-${settingsRow.id}`,
      );
      setSettingsRow(null);
      await Promise.all([load(), loadSummary()]);
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete message.");
    } finally {
      setSettingsBusy(false);
    }
  }

  const weakestChannel =
    stats.channelCoverage.iosPercent <= stats.channelCoverage.androidPercent &&
    stats.channelCoverage.iosPercent <= stats.channelCoverage.webPercent
      ? "iOS"
      : stats.channelCoverage.androidPercent <= stats.channelCoverage.webPercent
        ? "Android"
        : "Web";

  return (
    <div className="mx-auto w-full max-w-[1440px] space-y-6 pb-10">
      <Link href={MESSENGER_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Messenger
      </Link>

      <header className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className={`${managePageTitleClassName} text-3xl tracking-tight md:text-[2rem]`}>
              Push Messages
            </h1>
            <span className="inline-flex items-center gap-1 rounded bg-[color-mix(in_srgb,var(--admin-warning)_14%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[var(--admin-warning)]">
              <FlaskConical className="h-3 w-3" aria-hidden="true" />
              Beta
            </span>
          </div>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Design and dispatch high-visibility alerts.{" "}
            <span className="font-semibold text-[var(--admin-warning)]">Note:</span> Delivery runs
            through in-app notifications today. Android, iOS, and Web flags are stored for device
            adapters.
          </p>
        </div>
        <Link
          href={PUSH_CREATE_HREF}
          prefetch={false}
          className={`${managePrimaryButtonClassName} shrink-0 rounded-xl bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] hover:opacity-100`}
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          New push message
        </Link>
      </header>

      <div className="flex flex-col gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="Push message status"
          className="flex flex-wrap items-center gap-1 rounded-lg bg-[var(--admin-surface-low)] p-1"
        >
          {TABS.map((entry) => {
            const active = tab === entry.id;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(entry.id)}
                className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                  active
                    ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-high)]"
                }`}
              >
                {entry.label}
              </button>
            );
          })}
        </div>

        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center md:w-auto">
          <div className="relative w-full sm:max-w-sm">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title..."
              aria-label="Search by title"
              className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)] focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20"
            />
          </div>

          <div className="flex items-center gap-2">
            <div ref={createdOnRef} className="relative">
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={createdOnOpen}
                onClick={() => {
                  setColumnsOpen(false);
                  setCreatedOnOpen((open) => !open);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] px-4 py-2 text-xs font-semibold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
              >
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                {createdOn ? formatPushDate(`${createdOn}T00:00:00.000Z`) : "Created on"}
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <div
                className={[
                  "absolute right-0 z-20 w-64 origin-top-right space-y-3 bg-[var(--admin-surface)] p-3 shadow-lg",
                  dropdownPanelSurfaceClassName,
                  "transition-[opacity,transform] duration-150",
                  createdOnOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-1 opacity-0",
                ].join(" ")}
                style={{ top: "calc(100% + 6px)" }}
              >
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-[var(--admin-on-surface-variant)]">
                    Filter by created date
                  </span>
                  <input
                    type="date"
                    value={createdOn}
                    onChange={(event) => setCreatedOn(event.target.value)}
                    className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2 text-sm text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                  />
                </label>
                {createdOn ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
                    onClick={() => setCreatedOn("")}
                  >
                    Clear date
                  </button>
                ) : null}
              </div>
            </div>

            <div ref={columnsRef} className="relative">
              <button
                type="button"
                aria-label="Column visibility"
                aria-haspopup="menu"
                aria-expanded={columnsOpen}
                title="Column visibility"
                onClick={() => {
                  setCreatedOnOpen(false);
                  setColumnsOpen((open) => !open);
                }}
                className="rounded-lg border border-[var(--admin-border)] p-2 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
              >
                <Columns3 className="h-5 w-5" aria-hidden="true" />
              </button>
              <div
                role="menu"
                aria-label="Toggle columns"
                className={[
                  "absolute right-0 z-20 w-56 origin-top-right bg-[var(--admin-surface)] p-1.5 shadow-lg",
                  dropdownPanelSurfaceClassName,
                  "transition-[opacity,transform] duration-150",
                  columnsOpen
                    ? "pointer-events-auto translate-y-0 opacity-100"
                    : "pointer-events-none -translate-y-1 opacity-0",
                ].join(" ")}
                style={{ top: "calc(100% + 6px)" }}
              >
                {COLUMNS.filter((column) => column.id !== "actions").map((column) => (
                  <label
                    key={column.id}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                  >
                    <input
                      type="checkbox"
                      checked={!hidden.has(column.id)}
                      disabled={column.id === "title"}
                      onChange={() => toggleColumn(column.id)}
                      className="h-4 w-4 accent-[var(--admin-primary)]"
                    />
                    {column.label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <SkeletonBlock className="h-72 w-full" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-40" />
          </div>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-16 text-center">
          <p className="text-lg font-semibold text-[var(--admin-on-surface)]">No push messages found</p>
          <p className="max-w-md text-sm text-[var(--admin-on-surface-variant)]">
            {query.trim() || createdOn || tab !== "ALL"
              ? "Try another search term or clear filters."
              : "Create a campaign to reach learners with time-sensitive alerts."}
          </p>
          {query.trim() || createdOn || tab !== "ALL" ? (
            <button
              type="button"
              className="text-sm font-semibold text-[var(--admin-primary)] hover:underline"
              onClick={() => {
                setQuery("");
                setCreatedOn("");
                setTab("ALL");
              }}
            >
              Clear filters
            </button>
          ) : (
            <Link
              href={PUSH_CREATE_HREF}
              prefetch={false}
              className={`${managePrimaryButtonClassName} bg-[var(--admin-primary)] text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)] hover:opacity-100`}
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              New push message
            </Link>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_70%,var(--admin-surface))]">
                  {visibleColumns.map((column) => (
                    <th
                      key={column.id}
                      className={`whitespace-nowrap px-6 py-4 text-xs font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)] ${
                        column.id === "reach" || column.id === "actions" ? "text-right" : ""
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {items.map((row) => (
                  <tr
                    key={row.id}
                    className="group transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_45%,transparent)]"
                  >
                    {visibleColumns.map((column) => (
                      <td key={column.id} className="px-6 py-5 align-middle">
                        {column.id === "title" ? (
                          <div className="flex min-w-[14rem] flex-col">
                            <Link
                              href={pushMessageHref(row.id)}
                              prefetch={false}
                              className="text-base font-semibold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                            >
                              {row.title}
                            </Link>
                            <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--admin-on-surface-variant)]">
                              <Users className="h-3.5 w-3.5" aria-hidden="true" />
                              {row.audienceLabel ?? "Audience not set"}
                            </span>
                          </div>
                        ) : column.id === "status" ? (
                          <StatusPill status={row.status} />
                        ) : column.id === "channels" ? (
                          <div className="flex items-center gap-1.5">
                            <ChannelIcon
                              label="Android"
                              Icon={TabletSmartphone}
                              enabled={row.channels.android}
                            />
                            <ChannelIcon
                              label="iOS"
                              Icon={Smartphone}
                              enabled={row.channels.ios}
                            />
                            <ChannelIcon label="Web" Icon={Globe} enabled={row.channels.web} />
                          </div>
                        ) : column.id === "created" ? (
                          <span className="text-[var(--admin-on-surface-variant)]">
                            {formatPushDate(row.createdAt)}
                          </span>
                        ) : column.id === "scheduled" ? (
                          <span
                            className={
                              row.sentAt || row.scheduledAt
                                ? "font-medium text-[var(--admin-on-surface)]"
                                : "italic text-[var(--admin-outline)]"
                            }
                          >
                            {row.status === "SENT"
                              ? formatPushDateTime(row.sentAt)
                              : row.scheduledAt
                                ? formatPushDateTime(row.scheduledAt)
                                : "Not set"}
                          </span>
                        ) : column.id === "reach" ? (
                          <div className="text-right font-mono text-xs font-bold tabular-nums text-[var(--admin-on-surface)]">
                            {formatCompactCount(row.recipientCount)}
                          </div>
                        ) : (
                          <div
                            ref={menuId === row.id ? menuRef : undefined}
                            className="relative flex items-center justify-end gap-1"
                          >
                            <Link
                              href={pushMessageHref(row.id)}
                              prefetch={false}
                              title="Open details"
                              aria-label={`Open ${row.title}`}
                              className="rounded p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                            >
                              <ExternalLink className="h-5 w-5" aria-hidden="true" />
                            </Link>
                            <button
                              type="button"
                              aria-label={`Actions for ${row.title}`}
                              aria-haspopup="menu"
                              aria-expanded={menuId === row.id}
                              className="rounded p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]"
                              onClick={() =>
                                setMenuId((current) => (current === row.id ? null : row.id))
                              }
                            >
                              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                            </button>
                            {menuId === row.id ? (
                              <div
                                role="menu"
                                className={[
                                  "absolute right-0 z-20 w-44 origin-top-right bg-[var(--admin-surface)] p-1.5 shadow-lg",
                                  dropdownPanelSurfaceClassName,
                                ].join(" ")}
                                style={{ top: "calc(100% + 4px)" }}
                              >
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => {
                                    setMenuId(null);
                                    router.push(pushMessageHref(row.id));
                                  }}
                                >
                                  {row.status === "DRAFT" ? "Continue" : "Open"}
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="flex w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-[var(--admin-surface-high)]"
                                  onClick={() => openSettings(row)}
                                >
                                  Settings
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Showing{" "}
              <span className="font-semibold text-[var(--admin-on-surface)]">
                {rangeStart}-{rangeEnd}
              </span>{" "}
              of <span className="font-semibold text-[var(--admin-on-surface)]">{total}</span>{" "}
              campaigns
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label="Previous page"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:text-[var(--admin-outline)]"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>
              {pageNumbers.map((pageNumber, index) => {
                const previous = pageNumbers[index - 1];
                const showEllipsis = previous != null && pageNumber - previous > 1;
                return (
                  <span key={pageNumber} className="contents">
                    {showEllipsis ? (
                      <span className="px-2 text-[var(--admin-outline)]" aria-hidden="true">
                        ...
                      </span>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`Page ${pageNumber}`}
                      aria-current={page === pageNumber ? "page" : undefined}
                      onClick={() => setPage(pageNumber)}
                      className={`h-8 w-8 rounded text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] ${
                        page === pageNumber
                          ? "bg-[var(--admin-primary)] text-[var(--admin-on-primary)]"
                          : "text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface-low)]"
                      }`}
                    >
                      {pageNumber}
                    </button>
                  </span>
                );
              })}
              <button
                type="button"
                aria-label="Next page"
                disabled={page >= pageCount}
                onClick={() => setPage((current) => Math.min(pageCount, current + 1))}
                className="rounded p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] disabled:cursor-not-allowed disabled:text-[var(--admin-outline)]"
              >
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="relative overflow-hidden rounded-xl border border-[var(--admin-primary-container)] bg-[color-mix(in_srgb,var(--admin-primary-container)_28%,var(--admin-surface))] p-6">
          <div className="relative z-[1]">
            <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-[var(--admin-primary)]">
              <TrendingUp className="h-5 w-5" aria-hidden="true" />
              Channel coverage
            </h2>
            <p className="mb-4 text-sm text-[var(--admin-on-primary-container)]">
              {stats.messageCount === 0
                ? "No campaigns yet. Start with a multi-channel push to build coverage."
                : `${weakestChannel} is selected on ${
                    weakestChannel === "iOS"
                      ? stats.channelCoverage.iosPercent
                      : weakestChannel === "Android"
                        ? stats.channelCoverage.androidPercent
                        : stats.channelCoverage.webPercent
                  }% of campaigns. Broaden channel selection to expand reach.`}
            </p>
            <Link
              href={PUSH_CREATE_HREF}
              prefetch={false}
              className="text-xs font-semibold text-[var(--admin-primary)] hover:underline"
            >
              Create campaign
            </Link>
          </div>
          <TabletSmartphone
            className="pointer-events-none absolute -bottom-4 -right-4 h-[7.5rem] w-[7.5rem] text-[var(--admin-primary)] opacity-10"
            strokeWidth={1}
            aria-hidden="true"
          />
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
            Total deliveries (30d)
          </h2>
          <div className="mb-3 flex items-end gap-3">
            <span className="text-4xl font-bold tabular-nums leading-none text-[var(--admin-on-surface)]">
              {formatCompactCount(stats.reach30d)}
            </span>
            {stats.reachTrendPercent != null ? (
              <span
                className={`mb-1 inline-flex items-center gap-0.5 text-xs font-semibold ${
                  stats.reachTrendPercent >= 0
                    ? "text-[var(--admin-success)]"
                    : "text-[var(--admin-danger)]"
                }`}
              >
                <TrendingUp className="h-4 w-4" aria-hidden="true" />
                {stats.reachTrendPercent > 0 ? "+" : ""}
                {stats.reachTrendPercent}%
              </span>
            ) : null}
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-low)]">
            <div
              className="h-full rounded-full bg-[var(--admin-primary)] transition-[width] duration-500"
              style={{
                width: `${Math.min(
                  100,
                  stats.totalReach > 0
                    ? Math.round((stats.reach30d / Math.max(stats.totalReach, 1)) * 100)
                    : 0,
                )}%`,
              }}
            />
          </div>
          <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">
            Lifetime reach {formatCompactCount(stats.totalReach)}
          </p>
        </div>

        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-[var(--admin-on-surface-variant)]">
            Campaign mix
          </h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--admin-on-surface-variant)]">Sent</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-[var(--admin-on-surface)]">
                {stats.sentCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--admin-on-surface-variant)]">Scheduled</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-[var(--admin-on-surface)]">
                {stats.scheduledCount}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--admin-on-surface-variant)]">Drafts</span>
              <span className="font-mono text-xs font-semibold tabular-nums text-[var(--admin-on-surface)]">
                {stats.draftCount}
              </span>
            </div>
          </div>
        </div>
      </section>

      {settingsRow ? (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <button
            type="button"
            aria-label="Close settings"
            className="absolute inset-0 bg-[var(--admin-scrim)]"
            disabled={settingsBusy}
            onClick={() => {
              if (!settingsBusy) setSettingsRow(null);
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Push message settings"
            className="relative z-10 w-full max-w-md space-y-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Settings</h2>
            <label className="block text-sm">
              <span className="mb-1.5 block font-medium text-[var(--admin-on-surface)]">Title</span>
              <input
                type="text"
                value={settingsTitle}
                maxLength={200}
                disabled={settingsBusy}
                onChange={(event) => setSettingsTitle(event.target.value)}
                className="w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
              />
            </label>
            <button
              type="button"
              disabled={settingsBusy}
              className={managePrimaryButtonClassName}
              onClick={() => {
                void saveSettingsTitle();
              }}
            >
              Save title
            </button>

            <div className="border-t border-[var(--admin-border)] pt-4">
              <p className="text-sm font-bold text-[var(--admin-danger)]">Delete</p>
              <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
                Type{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">
                  {settingsRow.title}
                </span>{" "}
                to confirm.
              </p>
              <input
                type="text"
                value={deleteConfirm}
                disabled={settingsBusy}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                className="mt-2 w-full rounded-lg border border-[var(--admin-outline)] bg-[var(--admin-surface)] px-3 py-2.5 text-[var(--admin-on-surface)] outline-none focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/30"
                placeholder="Exact title"
              />
              <button
                type="button"
                disabled={settingsBusy || deleteConfirm !== settingsRow.title}
                className={`${manageDangerButtonClassName} mt-3`}
                onClick={() => {
                  void deleteFromSettings();
                }}
              >
                Delete permanently
              </button>
              <button
                type="button"
                disabled={settingsBusy}
                className={`${manageSecondaryButtonClassName} mt-2 w-full`}
                onClick={() => setSettingsRow(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
