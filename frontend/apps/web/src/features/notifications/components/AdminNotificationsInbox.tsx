"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bell,
  CheckCheck,
  ChevronDown,
  MoreVertical,
  Search,
  Settings2,
} from "lucide-react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { notificationInboxItemSchema } from "@atlas/contracts/notifications/notification.dto";
import {
  filterNotifications,
  formatNotificationTimestamp,
  getNotificationCategory,
  getNotificationVisual,
  groupNotificationsByDate,
  type NotificationFilter,
  type NotificationPriority,
} from "../notifications-inbox-utils";
import {
  ghostButtonClassName,
  iconButtonClassName,
  notificationsCardActionsClassName,
  notificationsCardBodyClassName,
  notificationsCardClassName,
  notificationsCardDangerStripeClassName,
  notificationsCardMetaClassName,
  notificationsCardTitleClassName,
  notificationsCardUnreadStripeClassName,
  notificationsEmptyShellClassName,
  notificationsFilterTabActiveClassName,
  notificationsFilterTabClassName,
  notificationsFilterTabInactiveClassName,
  notificationsGroupDividerClassName,
  notificationsGroupHeadingClassName,
  notificationsIconDangerShellClassName,
  notificationsIconShellClassName,
  notificationsPageShellClassName,
  notificationsSearchFieldClassName,
  notificationsToolbarClassName,
  notificationsUnreadDotClassName,
  outlineButtonClassName,
  primaryButtonClassName,
} from "../notifications-admin-shared";

type InboxItem = z.infer<typeof notificationInboxItemSchema>;

type NotificationListResponse = {
  data: InboxItem[];
  page: { nextCursor: string | null; hasMore: boolean };
};

type AdminNotificationsInboxProps = {
  initialItems?: InboxItem[];
  initialNextCursor?: string | null;
  initialHasMore?: boolean;
};

const FILTER_OPTIONS: ReadonlyArray<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

function stripeClassName(priority: NotificationPriority, unread: boolean): string | null {
  if (priority === "danger") return notificationsCardDangerStripeClassName;
  if (unread) return notificationsCardUnreadStripeClassName;
  return null;
}

function iconShellClassName(priority: NotificationPriority): string {
  return priority === "danger" || priority === "warning"
    ? notificationsIconDangerShellClassName
    : notificationsIconShellClassName;
}

function NotificationsLoadingSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-label="Loading notifications">
      {[0, 1].map((groupIndex) => (
        <div key={groupIndex} className="space-y-3">
          <div className="flex items-center gap-4 py-1">
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--admin-surface-high)]" />
            <div className="h-px flex-1 bg-[var(--admin-border)]" />
          </div>
          <ul className="space-y-3">
            {[0, 1].map((itemIndex) => (
              <li
                key={itemIndex}
                className="flex animate-pulse items-start gap-4 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-variant)] p-4"
              >
                <div className="h-10 w-10 rounded-full bg-[var(--admin-surface-high)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-40 rounded bg-[var(--admin-surface-high)]" />
                  <div className="h-3 w-full rounded bg-[var(--admin-surface-high)]" />
                  <div className="h-3 w-32 rounded bg-[var(--admin-surface-high)]" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function AdminNotificationsInbox({
  initialItems,
  initialNextCursor = null,
  initialHasMore = false,
}: AdminNotificationsInboxProps) {
  const router = useRouter();
  const [items, setItems] = useState<InboxItem[]>(initialItems ?? []);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loadingInitial, setLoadingInitial] = useState(initialItems === undefined);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  function setError(caught: unknown) {
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  useEffect(() => {
    if (initialItems !== undefined) {
      return;
    }

    let cancelled = false;

    async function loadInitial() {
      setLoadingInitial(true);
      setMessage(null);
      setRequestId(null);

      try {
        const response = await clientApi.get<NotificationListResponse>(
          "/api/v1/me/notifications?limit=25",
        );
        if (cancelled) return;
        setItems(response.data);
        setNextCursor(response.page.nextCursor);
        setHasMore(response.page.hasMore);
      } catch (caught) {
        if (cancelled) return;
        setError(caught);
      } finally {
        if (!cancelled) {
          setLoadingInitial(false);
        }
      }
    }

    void loadInitial();

    return () => {
      cancelled = true;
    };
  }, [initialItems]);

  const unreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  const visibleItems = useMemo(
    () => filterNotifications(items, filter, query),
    [filter, items, query],
  );

  const groupedItems = useMemo(() => groupNotificationsByDate(visibleItems), [visibleItems]);

  async function retryInitialLoad() {
    setLoadingInitial(true);
    setMessage(null);
    setRequestId(null);

    try {
      const response = await clientApi.get<NotificationListResponse>(
        "/api/v1/me/notifications?limit=25",
      );
      setItems(response.data);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoadingInitial(false);
    }
  }

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMessage(null);
    try {
      const response = await clientApi.get<{
        data: InboxItem[];
        page: { nextCursor: string | null; hasMore: boolean };
      }>(`/api/v1/me/notifications?limit=25&cursor=${nextCursor}`);
      setItems((current) => [...current, ...response.data]);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(caught);
    } finally {
      setLoadingMore(false);
    }
  }

  async function markItemRead(item: InboxItem) {
    if (item.read) return item;
    const response = await clientApi.post<{
      data: { id: string; read: true; readAt: string };
    }>(`/api/v1/me/notifications/${item.id}/read`, {}, `notification-read-${item.id}`);
    const updated = { ...item, read: true, readAt: response.data.readAt };
    setItems((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    return updated;
  }

  async function openNotification(item: InboxItem) {
    setMessage(null);
    setRequestId(null);
    setFocusedId(item.id);
    try {
      await markItemRead(item);
      router.push(item.actionPath);
    } catch (caught) {
      setError(caught);
    }
  }

  async function markAllRead() {
    const unreadItems = items.filter((item) => !item.read);
    if (unreadItems.length === 0 || markingAllRead) return;

    setMarkingAllRead(true);
    setMessage(null);
    setRequestId(null);

    try {
      const readAt = new Date().toISOString();
      await Promise.all(
        unreadItems.map((item) =>
          clientApi.post<{ data: { id: string; read: true; readAt: string } }>(
            `/api/v1/me/notifications/${item.id}/read`,
            {},
            `notification-read-all-${item.id}`,
          ),
        ),
      );
      setItems((current) =>
        current.map((item) =>
          item.read ? item : { ...item, read: true, readAt: item.readAt ?? readAt },
        ),
      );
    } catch (caught) {
      setError(caught);
    } finally {
      setMarkingAllRead(false);
    }
  }

  return (
    <div className={notificationsPageShellClassName}>
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold leading-8 tracking-[-0.02em] text-[var(--admin-primary)]">
            Notifications
          </h1>
          <p className="mt-1 text-sm leading-5 text-[var(--admin-on-surface-variant)]">
            Review account alerts, admin activity, and system updates in one place.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/admin/notifications/templates"
            className={`${outlineButtonClassName} inline-flex items-center gap-2 px-3 py-2 text-[13px]`}
          >
            <Settings2 className="h-4 w-4" aria-hidden="true" />
            Templates
          </Link>
        </div>
      </header>

      <div className="relative">
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
          placeholder="Search notifications..."
          aria-label="Search notifications"
          className={`${notificationsSearchFieldClassName} w-full sm:max-w-xs`}
        />
      </div>

      <div className={notificationsToolbarClassName}>
        <div className="flex gap-4" role="tablist" aria-label="Notification filters">
          {FILTER_OPTIONS.map((option) => {
            const active = filter === option.id;
            return (
              <button
                key={option.id}
                type="button"
                role="tab"
                aria-selected={active}
                className={[
                  notificationsFilterTabClassName,
                  active
                    ? notificationsFilterTabActiveClassName
                    : notificationsFilterTabInactiveClassName,
                ].join(" ")}
                onClick={() => {
                  setFilter(option.id);
                }}
              >
                {option.label}
                {option.id === "unread" && unreadCount > 0 ? ` (${String(unreadCount)})` : null}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className={`${ghostButtonClassName} inline-flex items-center gap-2 px-0 py-1 text-[12px] font-medium`}
          disabled={unreadCount === 0 || markingAllRead}
          onClick={() => void markAllRead()}
        >
          <CheckCheck className="h-4 w-4" aria-hidden="true" />
          {markingAllRead ? "Marking read..." : "Mark all as read"}
        </button>
      </div>

      {message ? (
        <div
          role="alert"
          className="rounded-lg border border-[color-mix(in_srgb,var(--admin-danger)_28%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          <p>
            {message}
            {requestId ? ` (Request ID: ${requestId})` : null}
          </p>
          {items.length === 0 && !loadingInitial ? (
            <button
              type="button"
              className={`${outlineButtonClassName} mt-3 border-[var(--admin-danger)] text-[var(--admin-danger)]`}
              onClick={() => void retryInitialLoad()}
            >
              Try again
            </button>
          ) : null}
        </div>
      ) : null}

      {loadingInitial ? (
        <NotificationsLoadingSkeleton />
      ) : message && items.length === 0 ? null : visibleItems.length === 0 ? (
        <div className={notificationsEmptyShellClassName}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--admin-surface-low)] text-[var(--admin-primary)]">
            <Bell className="h-5 w-5" aria-hidden="true" />
          </div>
          <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
            {message
              ? "Could not load notifications"
              : query.trim() || filter === "unread"
                ? "No matching notifications"
                : "No notifications yet"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-5 text-[var(--admin-on-surface-variant)]">
            {message
              ? "Use Try again above, or check that the notifications service is available."
              : query.trim()
                ? "Try a different search term or switch back to All."
                : filter === "unread"
                  ? "You are caught up. New alerts will appear here."
                  : "When something needs your attention, it will show up in this inbox."}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {groupedItems.map((group) => (
            <section key={group.key} className="space-y-3" aria-label={group.label}>
              <div className="flex items-center gap-4 py-1">
                <span className={notificationsGroupHeadingClassName}>{group.label}</span>
                <div className={notificationsGroupDividerClassName} aria-hidden="true" />
              </div>

              <ul className="space-y-3">
                {group.items.map((item) => {
                  const visual = getNotificationVisual(item);
                  const Icon = visual.icon;
                  const stripe = stripeClassName(visual.priority, !item.read);
                  const category = getNotificationCategory(item.actionPath);
                  const showPrimaryAction =
                    visual.priority === "danger" &&
                    (item.actionPath.includes("/settings") ||
                      item.actionPath.includes("/profile") ||
                      item.actionPath.includes("/billing") ||
                      item.actionPath.includes("/account"));

                  return (
                    <li key={item.id}>
                      <article
                        className={[
                          notificationsCardClassName,
                          focusedId === item.id
                            ? "ring-1 ring-[color-mix(in_srgb,var(--admin-primary)_24%,transparent)]"
                            : "",
                        ].join(" ")}
                      >
                        {stripe ? <div className={stripe} aria-hidden="true" /> : null}

                        <button
                          type="button"
                          className="flex min-w-0 flex-1 items-start gap-4 text-left"
                          onClick={() => void openNotification(item)}
                        >
                          <div className={iconShellClassName(visual.priority)}>
                            <Icon className="h-5 w-5" aria-hidden="true" strokeWidth={visual.filledIcon ? 2.25 : 2} />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <h3 className={notificationsCardTitleClassName}>{item.title}</h3>
                              {!item.read ? (
                                <span
                                  className={notificationsUnreadDotClassName}
                                  aria-label="Unread"
                                />
                              ) : null}
                            </div>
                            <p className={notificationsCardBodyClassName}>{item.body}</p>
                            <p className={notificationsCardMetaClassName}>
                              {formatNotificationTimestamp(item.createdAt)} · {category}
                            </p>

                            {showPrimaryAction ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <span className={primaryButtonClassName}>Manage</span>
                              </div>
                            ) : null}
                          </div>
                        </button>

                        <div className={notificationsCardActionsClassName}>
                          <button
                            type="button"
                            className={iconButtonClassName}
                            aria-label="Archive notification"
                            disabled
                            title="Archive coming soon"
                          >
                            <Archive className="h-4 w-4" aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className={iconButtonClassName}
                            aria-label="More actions"
                            disabled
                            title="More actions coming soon"
                          >
                            <MoreVertical className="h-4 w-4" aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {hasMore ? (
        <div className="flex justify-center pt-2">
          <button
            type="button"
            className={`${ghostButtonClassName} inline-flex items-center gap-2`}
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading..." : "Show older notifications"}
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
