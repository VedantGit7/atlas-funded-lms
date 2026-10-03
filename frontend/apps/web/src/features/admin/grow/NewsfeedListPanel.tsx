"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FileText,
  Image as ImageIcon,
  MoreVertical,
  Pin,
  Plus,
  Search,
  Tag,
} from "lucide-react";
import { DropdownMenu, type DropdownMenuItem } from "@atlas/design-system";
import { ClientApiError, clientApi, toast } from "../../../lib/client-api";
import { AdminSelectDropdown } from "../../readiness/components/AdminSelectDropdown";
import { dropdownPanelSurfaceClassName } from "../../studio/courses/admin-form-dropdown-shared";
import { generalSettingsBackLinkClassName } from "../general-settings/general-settings-shared";
import { MESSENGER_WIZARD_FIELD_CLASS } from "./push-wizard-chrome";
import {
  MARKETING_HREF,
  NEWSFEED_CREATE_HREF,
  formatNewsfeedCount,
  formatNewsfeedRelativeTime,
  newsfeedExcerpt,
  newsfeedHref,
  newsfeedStatusLabel,
  newsfeedTypeLabel,
  type NewsfeedListSummary,
  type NewsfeedPostDto,
  type NewsfeedPostStatus,
  type NewsfeedSettingsDto,
} from "./newsfeed-shared";

const DASHBOARD_HREF = "/admin";

type StatusTab = "ALL" | NewsfeedPostStatus;

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
];

type ListResponse = {
  data: {
    items: NewsfeedPostDto[];
    summary: NewsfeedListSummary;
  };
};

type PostResponse = { data: NewsfeedPostDto };
type SettingsResponse = { data: NewsfeedSettingsDto };

const EMPTY_SUMMARY: NewsfeedListSummary = {
  liveCount: 0,
  draftCount: 0,
  unpublishedCount: 0,
  totalCount: 0,
  articleCount: 0,
  promoCount: 0,
  pinnedCount: 0,
  totalSaves: 0,
};

function statusTone(status: NewsfeedPostStatus): "success" | "warning" | "neutral" {
  if (status === "LIVE") return "success";
  if (status === "UNPUBLISHED") return "warning";
  return "neutral";
}

function StatusPill({ status }: { status: NewsfeedPostStatus }) {
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
        "inline-flex items-center gap-1.5 text-[13px] font-semibold",
        tone === "success"
          ? "text-[var(--admin-success)]"
          : tone === "warning"
            ? "text-[var(--admin-warning)]"
            : "text-[var(--admin-on-surface-variant)]",
      ].join(" ")}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dotClass} ${status === "LIVE" ? "motion-safe:animate-pulse" : ""}`}
        aria-hidden="true"
      />
      {newsfeedStatusLabel(status)}
    </span>
  );
}

function TypePill({ type }: { type: NewsfeedPostDto["postType"] }) {
  return (
    <span
      className={[
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-tight",
        type === "PROMO"
          ? "bg-[color-mix(in_srgb,var(--admin-primary)_14%,var(--admin-surface))] text-[var(--admin-primary)]"
          : "bg-[var(--admin-surface-high)] text-[var(--admin-on-primary-container)]",
      ].join(" ")}
    >
      {newsfeedTypeLabel(type)}
    </span>
  );
}

function TitleCell({ row }: { row: NewsfeedPostDto }) {
  const excerpt = newsfeedExcerpt(row.bodyHtml) || (row.productTitle ? row.productTitle : "");
  return (
    <div className="flex items-center gap-4">
      <span
        className="inline-flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)]"
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
        <div className="flex items-center gap-2">
          <p className="truncate text-[14px] font-semibold text-[var(--admin-on-surface)] transition-colors group-hover:text-[var(--admin-primary)]">
            {row.title}
          </p>
          {row.pinned ? (
            <Pin
              className="h-3.5 w-3.5 shrink-0 fill-[var(--admin-primary)] text-[var(--admin-primary)]"
              aria-label="Pinned"
            />
          ) : null}
        </div>
        {excerpt ? (
          <p className="mt-0.5 truncate text-[12px] text-[var(--admin-on-surface-variant)]">
            {excerpt}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ToggleSwitch(props: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={props.checked}
      aria-label={props.ariaLabel}
      disabled={props.disabled}
      onClick={() => {
        props.onChange(!props.checked);
      }}
      className={[
        "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
        props.checked ? "bg-[var(--admin-primary)]" : "bg-[var(--admin-outline)]",
      ].join(" ")}
    >
      <span
        className={[
          "absolute top-[2px] left-[2px] h-5 w-5 rounded-full bg-[var(--admin-surface)] transition-transform duration-200",
          props.checked ? "translate-x-5" : "translate-x-0",
        ].join(" ")}
        aria-hidden="true"
      />
    </button>
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

export function NewsfeedListPanel() {
  const router = useRouter();
  const [tab, setTab] = useState<StatusTab>("ALL");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [items, setItems] = useState<NewsfeedPostDto[]>([]);
  const [summary, setSummary] = useState<NewsfeedListSummary>(EMPTY_SUMMARY);
  const [settings, setSettings] = useState<NewsfeedSettingsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingsBusy, setSettingsBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deleteRow, setDeleteRow] = useState<NewsfeedPostDto | null>(null);
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

  const loadSettings = useCallback(async () => {
    try {
      const response = await clientApi.get<SettingsResponse>(
        "/api/v1/marketing/newsfeeds/settings",
      );
      setSettings(response.data);
    } catch {
      setSettings({ enabled: false, updatedAt: null });
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("status", tab);
      params.set("limit", "100");
      if (debouncedQuery) params.set("q", debouncedQuery);
      const response = await clientApi.get<ListResponse>(
        `/api/v1/marketing/newsfeeds?${params.toString()}`,
      );
      setItems(response.data.items);
      setSummary(response.data.summary);
    } catch (caught) {
      setItems([]);
      setSummary(EMPTY_SUMMARY);
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not load newsfeed posts.",
      );
    } finally {
      setLoading(false);
    }
  }, [tab, debouncedQuery]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    void load();
  }, [load]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, pageSize]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  async function toggleEnabled(next: boolean) {
    setSettingsBusy(true);
    try {
      const response = await clientApi.patch<SettingsResponse>(
        "/api/v1/marketing/newsfeeds/settings",
        { enabled: next },
        "marketing-newsfeed-settings-toggle",
        {
          successMessage: next
            ? "Newsfeed enabled on learner dashboards."
            : "Newsfeed hidden from learners.",
        },
      );
      setSettings(response.data);
    } catch (caught) {
      toast.error(
        caught instanceof ClientApiError ? caught.message : "Could not update newsfeed settings.",
      );
    } finally {
      setSettingsBusy(false);
    }
  }

  async function publishOrUnpublish(row: NewsfeedPostDto) {
    setActionBusy(row.id);
    try {
      const path =
        row.status === "LIVE"
          ? `/api/v1/marketing/newsfeeds/${row.id}/unpublish`
          : `/api/v1/marketing/newsfeeds/${row.id}/publish`;
      await clientApi.post<PostResponse>(
        path,
        {},
        `marketing-newsfeed-${row.status === "LIVE" ? "unpublish" : "publish"}`,
        {
          successMessage: row.status === "LIVE" ? "Post unpublished." : "Post is live.",
        },
      );
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not update status.");
    } finally {
      setActionBusy(null);
    }
  }

  async function onDelete() {
    if (!deleteRow) return;
    if (deleteConfirm.trim() !== deleteRow.title.trim()) {
      toast.error("Type the post title to confirm delete.");
      return;
    }
    setDeleteBusy(true);
    try {
      await clientApi.post(
        `/api/v1/marketing/newsfeeds/${deleteRow.id}/delete`,
        { titleConfirmation: deleteConfirm.trim() },
        "marketing-newsfeed-delete",
        { successMessage: "Post deleted." },
      );
      setDeleteRow(null);
      setDeleteConfirm("");
      await load();
    } catch (caught) {
      toast.error(caught instanceof ClientApiError ? caught.message : "Could not delete post.");
    } finally {
      setDeleteBusy(false);
    }
  }

  function rowMenuItems(row: NewsfeedPostDto): DropdownMenuItem[] {
    return [
      {
        key: "edit",
        label: "Edit",
        onSelect: () => {
          router.push(newsfeedHref(row.id));
        },
      },
      {
        key: "toggle-status",
        label: row.status === "LIVE" ? "Unpublish" : "Publish",
        disabled: actionBusy === row.id,
        onSelect: () => {
          void publishOrUnpublish(row);
        },
      },
      {
        key: "delete",
        label: "Delete",
        destructive: true,
        disabled: row.status === "LIVE",
        onSelect: () => {
          setDeleteRow(row);
          setDeleteConfirm("");
        },
      },
    ];
  }

  const deleteMatches =
    Boolean(deleteRow) && deleteConfirm.trim() === (deleteRow?.title.trim() ?? "");

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-40 w-40 rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_10%,transparent)] blur-3xl"
        aria-hidden="true"
      />

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Link href={DASHBOARD_HREF} className={generalSettingsBackLinkClassName}>
          <ChevronLeft className="h-4 w-4" />
          Dashboard
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <Link href={MARKETING_HREF} className={generalSettingsBackLinkClassName}>
          Marketing
        </Link>
        <span className="text-[var(--admin-on-surface-variant)]">/</span>
        <span className="font-medium text-[var(--admin-on-surface)]">Newsfeed</span>
      </div>

      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)] md:text-[32px]">
            Newsfeed
          </h1>
          <p className="mt-1 text-[16px] text-[var(--admin-on-surface-variant)]">
            Publish updates and announcements to your learners.
          </p>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">Newsfeed enabled</p>
            <p
              className={[
                "text-xs",
                settings?.enabled
                  ? "text-[var(--admin-on-surface-variant)]"
                  : "text-[var(--admin-danger)]",
              ].join(" ")}
            >
              {settings?.enabled ? "Visible on learner dashboards" : "Hidden from all learners"}
            </p>
          </div>
          <ToggleSwitch
            checked={Boolean(settings?.enabled)}
            disabled={settingsBusy || settings == null}
            ariaLabel="Toggle newsfeed visibility"
            onChange={(next) => {
              void toggleEnabled(next);
            }}
          />
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Live posts
            </span>
            <FileText className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatNewsfeedCount(summary.liveCount)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatNewsfeedCount(summary.pinnedCount)} pinned
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Drafts
            </span>
            <Tag className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatNewsfeedCount(summary.draftCount)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatNewsfeedCount(summary.unpublishedCount)} unpublished
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Content mix
            </span>
            <ImageIcon className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatNewsfeedCount(summary.totalCount)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            {formatNewsfeedCount(summary.articleCount)} articles ·{" "}
            {formatNewsfeedCount(summary.promoCount)} promos
          </p>
        </div>
        <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
              Learner saves
            </span>
            <Bookmark className="h-4 w-4 text-[var(--admin-on-surface-variant)]" />
          </div>
          <p className="text-[28px] font-bold tracking-[-0.02em] text-[var(--admin-on-surface)]">
            {formatNewsfeedCount(summary.totalSaves)}
          </p>
          <p className="mt-2 text-[12px] text-[var(--admin-on-surface-variant)]">
            Honest engagement (bookmarks only)
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-2 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-1 rounded-lg bg-[var(--admin-surface-low)] p-1">
          {TABS.map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setTab(item.id);
                  setPage(1);
                }}
                className={[
                  "rounded-md px-4 py-1.5 text-sm font-semibold transition-colors",
                  active
                    ? "bg-[var(--admin-surface)] text-[var(--admin-primary)] shadow-sm"
                    : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center md:w-auto">
          <div className="relative min-w-0 flex-1 md:w-80">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--admin-on-surface-variant)]"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
              }}
              placeholder="Search posts..."
              className={`${MESSENGER_WIZARD_FIELD_CLASS} pl-9`}
              aria-label="Search newsfeed posts"
            />
          </div>
          <Link
            href={NEWSFEED_CREATE_HREF}
            prefetch={false}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--admin-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-primary)] transition-colors hover:bg-[var(--admin-primary-strong)]"
          >
            <Plus className="h-4 w-4" />
            Create post
          </Link>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-left">
            <thead>
              <tr className="border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,var(--admin-surface))]">
                <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Title
                </th>
                <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Type
                </th>
                <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Status
                </th>
                <th className="px-6 py-4 text-center text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Saves
                </th>
                <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Author
                </th>
                <th className="px-6 py-4 text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Last updated
                </th>
                <th className="px-6 py-4 text-right text-[12px] font-semibold uppercase tracking-wider text-[var(--admin-on-surface-variant)]">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--admin-border)]">
              {loading ? [0, 1, 2].map((key) => <SkeletonRow key={key} />) : null}
              {!loading && pageItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center">
                    <ImageIcon className="mx-auto h-12 w-12 text-[var(--admin-outline)]" />
                    <h2 className="mt-4 text-[20px] font-semibold text-[var(--admin-on-surface)]">
                      No newsfeed posts yet
                    </h2>
                    <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--admin-on-surface-variant)]">
                      Start sharing updates, tips, and promotional announcements with your learners.
                    </p>
                    <Link
                      href={NEWSFEED_CREATE_HREF}
                      prefetch={false}
                      className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--admin-primary)] px-5 py-2.5 text-sm font-bold text-[var(--admin-on-primary)]"
                    >
                      <Plus className="h-4 w-4" />
                      Create your first post
                    </Link>
                  </td>
                </tr>
              ) : null}
              {!loading
                ? pageItems.map((row) => (
                    <tr
                      key={row.id}
                      className="group cursor-pointer transition-colors hover:bg-[color-mix(in_srgb,var(--admin-surface-low)_40%,transparent)]"
                      onClick={() => {
                        router.push(newsfeedHref(row.id));
                      }}
                    >
                      <td className="px-6 py-4">
                        <TitleCell row={row} />
                      </td>
                      <td className="px-6 py-4">
                        <TypePill type={row.postType} />
                      </td>
                      <td className="px-6 py-4">
                        <StatusPill status={row.status} />
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="rounded bg-[var(--admin-surface-low)] px-2 py-1 font-mono text-[12px] font-semibold text-[var(--admin-on-surface)]">
                          {formatNewsfeedCount(row.saveCount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--admin-on-surface)]">
                        {row.authorName?.trim() || "-"}
                      </td>
                      <td className="px-6 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                        {formatNewsfeedRelativeTime(row.updatedAt)}
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
                          triggerClassName="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-low)]"
                          items={rowMenuItems(row)}
                        />
                      </td>
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_20%,var(--admin-surface))] px-6 py-4">
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Showing {pageItems.length} of {items.length} posts
            {summary.totalCount > items.length ? ` (filtered from ${summary.totalCount})` : ""}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <AdminSelectDropdown
              id="newsfeed-page-size"
              label={null}
              ariaLabel="Rows per page"
              value={String(pageSize)}
              options={[...PAGE_SIZE_OPTIONS]}
              onChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
            />
            <div className="flex gap-2">
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] px-3 py-1 text-sm disabled:opacity-50"
                disabled={page <= 1}
                onClick={() => {
                  setPage((current) => Math.max(1, current - 1));
                }}
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--admin-border)] px-3 py-1 text-sm disabled:opacity-50"
                disabled={page >= pageCount}
                onClick={() => {
                  setPage((current) => Math.min(pageCount, current + 1));
                }}
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
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
            aria-labelledby="newsfeed-delete-title"
            className={`admin-theme w-full max-w-md space-y-4 bg-[var(--admin-surface)] p-5 shadow-xl ${dropdownPanelSurfaceClassName}`}
            onClick={(event) => {
              event.stopPropagation();
            }}
          >
            <h2
              id="newsfeed-delete-title"
              className="text-lg font-semibold text-[var(--admin-on-surface)]"
            >
              Delete post
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
              aria-label="Confirm post title"
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
                onClick={() => void onDelete()}
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
