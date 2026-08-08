"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Eye,
  Megaphone,
  MoreVertical,
  Search,
  Send,
  Target,
  Trash2,
  UserCheck,
  Users,
} from "lucide-react";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import {
  managePageDescClassName,
  managePageTitleClassName,
} from "../manage/manage-ui-shared";
import {
  ANNOUNCEMENTS_CREATE_HREF,
  announcementTypeLabel,
  formatAnnouncementDate,
  formatAnnouncementDateTime,
  formatAnnouncementMonthLabel,
  formatRecipientCount,
  MESSENGER_HREF,
  recentAnnouncementMonths,
  type AnnouncementDto,
  type AnnouncementType,
} from "./announcements-shared";

type AudienceTab = "ALL" | AnnouncementType;

const TABS: ReadonlyArray<{ id: AudienceTab; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "GENERAL", label: "General" },
  { id: "BATCH", label: "Batch" },
];

type ListResponse = { data: { items: AnnouncementDto[] } };

function SkeletonCard() {
  return (
    <div
      className="flex gap-5 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4"
      aria-hidden="true"
    >
      <div className="h-16 w-16 shrink-0 animate-pulse rounded-lg bg-[var(--admin-surface-high)]" />
      <div className="min-w-0 flex-1 space-y-3 py-1">
        <div className="h-5 w-2/3 max-w-sm animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="h-4 w-full animate-pulse rounded bg-[var(--admin-surface-high)]" />
        <div className="h-4 w-1/2 animate-pulse rounded bg-[var(--admin-surface-high)]" />
      </div>
    </div>
  );
}

function TypePill({ type }: { type: AnnouncementType }) {
  const isGeneral = type === "GENERAL";
  return (
    <span
      className={[
        "shrink-0 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
        isGeneral
          ? "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      {announcementTypeLabel(type)}
    </span>
  );
}

function AnnouncementThumb({ item }: { item: AnnouncementDto }) {
  if (item.imageUrl) {
    return (
      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)]">
        {/* Announcement images are JPEG data URLs or external http(s) URLs */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={item.imageUrl} alt="" className="h-full w-full object-cover" />
      </div>
    );
  }

  return (
    <div
      className={[
        "flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--admin-border)]",
        item.type === "GENERAL"
          ? "bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[var(--admin-primary)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
      aria-hidden="true"
    >
      {item.type === "BATCH" ? (
        <Target className="h-7 w-7" />
      ) : (
        <Megaphone className="h-7 w-7" />
      )}
    </div>
  );
}

function MonthFilter({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = value ? formatAnnouncementMonthLabel(value) : "Any month";

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-[12px] font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)]"
      >
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        {label}
        <ChevronDown
          className={[
            "h-4 w-4 transition-transform duration-200 motion-safe:duration-200",
            open ? "rotate-180" : "",
          ].join(" ")}
          aria-hidden="true"
        />
      </button>
      <div
        role="listbox"
        aria-label="Filter by month"
        className={[
          "absolute right-0 z-20 mt-1.5 max-h-64 w-48 overflow-y-auto bg-[var(--admin-surface)] p-1.5 shadow-lg",
          dropdownPanelSurfaceClassName,
          "transition-[opacity,transform] duration-150 motion-safe:duration-150 motion-safe:origin-top",
          open
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none -translate-y-1 opacity-0",
        ].join(" ")}
      >
        <button
          type="button"
          role="option"
          aria-selected={!value}
          className="flex w-full rounded-lg px-3 py-2 text-left text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
          onClick={() => {
            onChange("");
            setOpen(false);
          }}
        >
          Any month
        </button>
        {options.map((month) => (
          <button
            key={month}
            type="button"
            role="option"
            aria-selected={value === month}
            className={[
              "flex w-full rounded-lg px-3 py-2 text-left text-sm transition-colors hover:bg-[var(--admin-surface-high)]",
              value === month
                ? "font-bold text-[var(--admin-primary)]"
                : "text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              onChange(month);
              setOpen(false);
            }}
          >
            {formatAnnouncementMonthLabel(month)}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AnnouncementsListPanel() {
  const [tab, setTab] = useState<AudienceTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<AnnouncementDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [createdMonth, setCreatedMonth] = useState("");
  const [menuId, setMenuId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<AnnouncementDto | null>(null);
  const [deleteRow, setDeleteRow] = useState<AnnouncementDto | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const monthOptions = useMemo(() => recentAnnouncementMonths(12), []);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!menuId) return;
    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuId]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("type", tab);
      params.set("limit", "50");
      if (debouncedQuery) params.set("q", debouncedQuery);
      if (createdMonth) params.set("createdMonth", createdMonth);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/announcements?${params.toString()}`,
      );
      setItems(response.data.items);
    } catch (caught) {
      setItems([]);
      toast.error(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not load announcements.",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery, createdMonth]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasFilters = Boolean(query.trim() || createdMonth || tab !== "ALL");
  const deleteMatches =
    deleteRow != null && deleteConfirm.trim() === deleteRow.title.trim();

  async function onDelete() {
    if (!deleteRow || !deleteMatches) {
      toast.error("Type the announcement title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/announcements/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "announcement-delete",
        { successMessage: "Announcement deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError
          ? caught.message
          : "Could not delete announcement.",
      );
    } finally {
      setDeleteBusy(false);
    }
  }

  function clearFilters() {
    setQuery("");
    setCreatedMonth("");
    setTab("ALL");
  }

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 top-6 h-52 w-52 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,transparent)] opacity-45 blur-[88px] motion-reduce:hidden"
        aria-hidden="true"
      />

      <Link href={MESSENGER_HREF} prefetch={false} className={generalSettingsBackLinkClassName}>
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Back to Messenger Hub
      </Link>

      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h1 className={managePageTitleClassName}>Announcements</h1>
          <p className={`${managePageDescClassName} max-w-2xl`}>
            Send an in-app announcement to all learners or a targeted batch
          </p>
        </div>
        <Link
          href={ANNOUNCEMENTS_CREATE_HREF}
          prefetch={false}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-6 py-3 text-[12px] font-bold uppercase tracking-[0.04em] text-[var(--admin-on-primary)] shadow-[0_8px_20px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)] transition-colors hover:bg-[var(--admin-primary-strong)]"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Create
        </Link>
      </header>

      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 shadow-[0_1px_0_color-mix(in_srgb,var(--admin-on-surface)_4%,transparent)]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div
            role="tablist"
            aria-label="Announcement type"
            className="flex items-center gap-1 rounded-lg bg-[var(--admin-surface-low)] p-1"
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
                  className={[
                    "rounded-md px-4 py-1.5 text-[12px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)]",
                    active
                      ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                      : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                  ].join(" ")}
                >
                  {entry.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:w-64">
              <label className="sr-only" htmlFor="announcements-search">
                Search announcements
              </label>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-outline)]"
                aria-hidden="true"
              />
              <input
                id="announcements-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search announcements…"
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-2 pl-10 pr-4 text-[13px] text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] placeholder:text-[var(--admin-on-surface-variant)]/60 focus:border-[var(--admin-primary)] focus:ring-2 focus:ring-[var(--admin-primary)]/20"
              />
            </div>
            <MonthFilter
              value={createdMonth}
              options={monthOptions}
              onChange={setCreatedMonth}
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4" aria-busy="true" aria-live="polite">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-20 text-center">
          <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-[var(--admin-surface-low)]">
            <Megaphone className="h-12 w-12 text-[var(--admin-outline)]" aria-hidden="true" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--admin-on-surface)]">
            No announcements found
          </h2>
          <p className="mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
            {hasFilters
              ? "Try adjusting your filters or search terms to find what you are looking for."
              : "Create your first in-app announcement to reach learners."}
          </p>
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="mt-4 text-sm font-bold text-[var(--admin-primary)] hover:underline"
            >
              Clear filters
            </button>
          ) : (
            <Link
              href={ANNOUNCEMENTS_CREATE_HREF}
              prefetch={false}
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-[12px] font-bold text-[var(--admin-on-primary)] hover:bg-[var(--admin-primary-strong)]"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Create announcement
            </Link>
          )}
        </div>
      ) : (
        <ul className="space-y-4">
          {items.map((row) => {
            const menuOpen = menuId === row.id;
            return (
              <li key={row.id}>
                <article
                  className="group relative flex gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4 transition-[border-color,box-shadow,transform] duration-200 hover:border-[color-mix(in_srgb,var(--admin-primary)_40%,var(--admin-border))] hover:shadow-md motion-safe:hover:-translate-y-0.5 sm:gap-5"
                >
                  <AnnouncementThumb item={row} />

                  <div className="min-w-0 flex-1">
                    <div className="mb-1 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3">
                        <h2 className="truncate text-base font-bold text-[var(--admin-on-surface)] sm:text-lg">
                          {row.title}
                        </h2>
                        <TypePill type={row.type} />
                      </div>
                      <time
                        dateTime={row.createdAt}
                        className="shrink-0 text-[13px] text-[var(--admin-on-surface-variant)] opacity-70"
                        title={formatAnnouncementDateTime(row.createdAt)}
                      >
                        {formatAnnouncementDate(row.createdAt)}
                      </time>
                    </div>

                    <p className="mb-3 line-clamp-2 text-sm text-[var(--admin-on-surface-variant)]">
                      {row.message}
                    </p>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[var(--admin-on-surface-variant)]">
                      <div className="flex items-center gap-1.5">
                        {row.type === "BATCH" ? (
                          <Target className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Users className="h-4 w-4" aria-hidden="true" />
                        )}
                        <span className="text-[12px] font-bold">{row.audienceLabel}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <UserCheck className="h-4 w-4" aria-hidden="true" />
                        <span className="text-[12px] font-bold">
                          {formatRecipientCount(row.recipientCount)} recipients
                        </span>
                      </div>
                    </div>
                  </div>

                  <div
                    ref={menuOpen ? menuRef : undefined}
                    className="relative flex shrink-0 flex-col items-end"
                  >
                    <button
                      type="button"
                      aria-label={`Actions for ${row.title}`}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                      onClick={() =>
                        setMenuId((current) => (current === row.id ? null : row.id))
                      }
                      className="rounded-lg p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)] hover:text-[var(--admin-on-surface)]"
                    >
                      <MoreVertical className="h-5 w-5" aria-hidden="true" />
                    </button>

                    {menuOpen ? (
                      <div
                        role="menu"
                        className={[
                          "absolute right-0 top-10 z-20 w-48 overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-xl",
                          dropdownPanelSurfaceClassName,
                          "motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)] motion-safe:origin-top",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-low)]"
                          onClick={() => {
                            setMenuId(null);
                            setPreviewRow(row);
                          }}
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          Preview
                        </button>
                        <div className="my-1 h-px bg-[var(--admin-border)]" aria-hidden="true" />
                        <button
                          type="button"
                          role="menuitem"
                          className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-[var(--admin-danger)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_6%,var(--admin-surface))]"
                          onClick={() => {
                            setMenuId(null);
                            setDeleteRow(row);
                            setDeleteConfirm("");
                          }}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                          Delete
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {previewRow ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close preview"
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-[2px]"
            onClick={() => setPreviewRow(null)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="preview-announcement-title"
            className="admin-theme relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
          >
            <div className="border-b border-[var(--admin-border)] p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <TypePill type={previewRow.type} />
                <time
                  dateTime={previewRow.createdAt}
                  className="text-[12px] text-[var(--admin-on-surface-variant)]"
                >
                  {formatAnnouncementDateTime(previewRow.createdAt)}
                </time>
              </div>
              <h2
                id="preview-announcement-title"
                className="text-lg font-bold text-[var(--admin-on-surface)]"
              >
                {previewRow.title}
              </h2>
            </div>
            <div className="space-y-4 p-5 sm:p-6">
              {previewRow.imageUrl ? (
                <div className="aspect-[2/1] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewRow.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : null}
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
                {previewRow.message}
              </p>
              <dl className="grid gap-2 rounded-xl bg-[var(--admin-surface-low)] p-4 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--admin-on-surface-variant)]">Audience</dt>
                  <dd className="font-semibold text-[var(--admin-on-surface)]">
                    {previewRow.audienceLabel}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-[var(--admin-on-surface-variant)]">Recipients</dt>
                  <dd className="font-semibold text-[var(--admin-on-surface)]">
                    {formatRecipientCount(previewRow.recipientCount)}
                  </dd>
                </div>
                {previewRow.deepLink ? (
                  <div className="flex justify-between gap-3">
                    <dt className="text-[var(--admin-on-surface-variant)]">Deep link</dt>
                    <dd className="max-w-[60%] truncate font-mono text-[12px] text-[var(--admin-primary)]">
                      {previewRow.deepLink}
                    </dd>
                  </div>
                ) : null}
              </dl>
              <p className="text-[12px] text-[var(--admin-on-surface-variant)]">
                Announcements are sent once and cannot be edited after delivery.
              </p>
            </div>
            <div className="flex justify-end border-t border-[var(--admin-border)] px-5 py-4 sm:px-6">
              <button
                type="button"
                onClick={() => setPreviewRow(null)}
                className="rounded-lg px-5 py-2 text-[12px] font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteRow ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center p-4 sm:items-center">
          <button
            type="button"
            aria-label="Close delete dialog"
            className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-[2px]"
            onClick={() => {
              if (!deleteBusy) {
                setDeleteRow(null);
                setDeleteConfirm("");
              }
            }}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-announcement-title"
            className="admin-theme relative z-10 w-full max-w-md overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl"
          >
            <div className="border-b border-[var(--admin-border)] p-6">
              <div className="mb-2 flex items-center gap-3 text-[var(--admin-danger)]">
                <Trash2 className="h-5 w-5" aria-hidden="true" />
                <h2
                  id="delete-announcement-title"
                  className="text-lg font-bold text-[var(--admin-on-surface)]"
                >
                  Delete announcement
                </h2>
              </div>
              <p className="text-sm text-[var(--admin-on-surface-variant)]">
                This removes the announcement from admin history. Inbox items already delivered
                to learners are not recalled.
              </p>
            </div>
            <div className="space-y-3 bg-[var(--admin-surface-low)] p-6">
              <label
                htmlFor="delete-announcement-confirm"
                className="block text-[12px] font-bold text-[var(--admin-on-surface)]"
              >
                Type the announcement title to confirm
              </label>
              <p className="rounded-lg bg-[var(--admin-surface-high)] px-3 py-2 text-[13px] italic text-[var(--admin-on-surface-variant)]">
                {deleteRow.title}
              </p>
              <input
                id="delete-announcement-confirm"
                type="text"
                value={deleteConfirm}
                onChange={(event) => setDeleteConfirm(event.target.value)}
                placeholder="Type title here…"
                className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2.5 text-sm text-[var(--admin-on-surface)] outline-none transition-[border-color,box-shadow] focus:border-[var(--admin-danger)] focus:ring-2 focus:ring-[var(--admin-danger)]/20"
              />
            </div>
            <div className="flex justify-end gap-3 p-6">
              <button
                type="button"
                disabled={deleteBusy}
                onClick={() => {
                  setDeleteRow(null);
                  setDeleteConfirm("");
                }}
                className="rounded-lg px-5 py-2 text-[12px] font-bold text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteBusy || !deleteMatches}
                onClick={() => void onDelete()}
                className="rounded-lg bg-[var(--admin-danger)] px-5 py-2 text-[12px] font-bold text-[var(--admin-on-primary)] transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                Confirm delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
