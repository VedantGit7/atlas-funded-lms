"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { Bell, ChevronRight, Search, Settings, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  filterNotifications,
  formatNotificationTimestamp,
  getNotificationCategory,
  getNotificationVisual,
  groupNotificationsByDate,
  type InboxItem,
  type NotificationFilter,
  type NotificationPriority,
} from "../notifications-inbox-utils";
import {
  learnerNotificationsBodyClassName,
  learnerNotificationsCaptionClassName,
  learnerNotificationsCardClassName,
  learnerNotificationsCardReadClassName,
  learnerNotificationsCategoryPillClassName,
  learnerNotificationsCaughtUpClassName,
  learnerNotificationsChevronClassName,
  learnerNotificationsClearSearchClassName,
  learnerNotificationsDescriptionClassName,
  learnerNotificationsEmptyShellClassName,
  learnerNotificationsErrorCardClassName,
  learnerNotificationsGroupHeadingClassName,
  learnerNotificationsGroupStickyClassName,
  learnerNotificationsHeaderClassName,
  learnerNotificationsIconAlertShellClassName,
  learnerNotificationsIconDangerShellClassName,
  learnerNotificationsIconShellClassName,
  learnerNotificationsLoadMoreClassName,
  learnerNotificationsMetaClassName,
  learnerNotificationsPageClassName,
  learnerNotificationsRailClassName,
  learnerNotificationsRailDangerClassName,
  learnerNotificationsRailWarningClassName,
  learnerNotificationsSearchFieldClassName,
  learnerNotificationsSearchWrapClassName,
  learnerNotificationsSegmentActiveClassName,
  learnerNotificationsSegmentButtonClassName,
  learnerNotificationsSegmentClassName,
  learnerNotificationsSegmentInactiveClassName,
  learnerNotificationsSettingsLinkClassName,
  learnerNotificationsTitleClassName,
  learnerNotificationsTitleReadClassName,
  learnerNotificationsTitleUnreadClassName,
  learnerNotificationsToolbarClassName,
  learnerNotificationsUnreadDotClassName,
  learnerNotificationsUnreadSpacerClassName,
} from "../notifications-learner-shared";

type LearnerNotificationsClientProps = {
  initialItems: InboxItem[];
  initialNextCursor: string | null;
  initialHasMore: boolean;
};

const FILTER_OPTIONS: ReadonlyArray<{ id: NotificationFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
];

function iconShellForPriority(priority: NotificationPriority): string {
  if (priority === "danger") return learnerNotificationsIconDangerShellClassName;
  if (priority === "warning") return learnerNotificationsIconAlertShellClassName;
  return learnerNotificationsIconShellClassName;
}

function railClassForPriority(priority: NotificationPriority): string | null {
  if (priority === "danger") {
    return `${learnerNotificationsRailClassName} ${learnerNotificationsRailDangerClassName}`;
  }
  if (priority === "warning") {
    return `${learnerNotificationsRailClassName} ${learnerNotificationsRailWarningClassName}`;
  }
  return null;
}

function SettingsLink({ className }: { className?: string }) {
  return (
    <Link
      href="/profile/notifications"
      className={className ?? learnerNotificationsSettingsLinkClassName}
    >
      <Settings className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
      Notification settings
    </Link>
  );
}

export function LearnerNotificationsClient({
  initialItems,
  initialNextCursor,
  initialHasMore,
}: LearnerNotificationsClientProps) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [items, setItems] = useState(initialItems);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [filter, setFilter] = useState<NotificationFilter>("all");
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<"mark-read" | "load-more" | "generic" | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => filterNotifications(items, filter, query),
    [filter, items, query],
  );
  const groupedItems = useMemo(() => groupNotificationsByDate(visibleItems), [visibleItems]);
  const trimmedQuery = query.trim();
  const isEmptyInbox = items.length === 0;

  function setError(caught: unknown, kind: "mark-read" | "load-more" | "generic" = "generic") {
    setErrorKind(kind);
    if (caught instanceof ClientApiError) {
      setMessage(caught.message);
      setRequestId(caught.requestId);
      return;
    }
    setMessage("Unexpected error.");
    setRequestId(null);
  }

  function dismissError() {
    setMessage(null);
    setRequestId(null);
    setErrorKind(null);
  }

  async function loadMore() {
    if (!hasMore || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setMessage(null);
    setRequestId(null);
    setErrorKind(null);
    try {
      const response = await clientApi.get<{
        data: InboxItem[];
        page: { nextCursor: string | null; hasMore: boolean };
      }>(`/api/v1/me/notifications?limit=25&cursor=${nextCursor}`);
      setItems((current) => [...current, ...response.data]);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(caught, "load-more");
    } finally {
      setLoadingMore(false);
    }
  }

  async function openNotification(item: InboxItem) {
    setMessage(null);
    setRequestId(null);
    setErrorKind(null);
    setOpeningId(item.id);

    // Optimistic unread clear so the learner sees the tap register before navigation.
    if (!item.read) {
      setItems((current) =>
        current.map((entry) =>
          entry.id === item.id
            ? { ...entry, read: true, readAt: entry.readAt ?? new Date().toISOString() }
            : entry,
        ),
      );
    }

    try {
      if (!item.read) {
        const response = await clientApi.post<{
          data: { id: string; read: true; readAt: string };
        }>(`/api/v1/me/notifications/${item.id}/read`, {}, `notification-read-${item.id}`);
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read: true, readAt: response.data.readAt } : entry,
          ),
        );
      }
      router.push(item.actionPath);
    } catch (caught) {
      // Revert optimistic read so the unread mark stays honest when the request fails.
      if (!item.read) {
        setItems((current) =>
          current.map((entry) =>
            entry.id === item.id ? { ...entry, read: false, readAt: null } : entry,
          ),
        );
      }
      setError(caught, "mark-read");
      setOpeningId(null);
    }
  }

  return (
    <div className={learnerNotificationsPageClassName}>
      <header className={learnerNotificationsHeaderClassName}>
        <div>
          <h1 className={learnerNotificationsTitleClassName}>Notifications</h1>
          <p className={learnerNotificationsDescriptionClassName}>
            Updates from your courses, community, and account.
          </p>
          <div className="mt-2 md:hidden">
            <SettingsLink />
          </div>
        </div>
        <div className="hidden md:block">
          <SettingsLink />
        </div>
      </header>

      {!isEmptyInbox ? (
        <div className="flex flex-col gap-2">
          <div className={learnerNotificationsToolbarClassName}>
            <div
              className={learnerNotificationsSegmentClassName}
              role="tablist"
              aria-label="Notification filters"
            >
              {FILTER_OPTIONS.map((option) => {
                const active = filter === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    className={[
                      learnerNotificationsSegmentButtonClassName,
                      active
                        ? learnerNotificationsSegmentActiveClassName
                        : learnerNotificationsSegmentInactiveClassName,
                    ].join(" ")}
                    onClick={() => {
                      setFilter(option.id);
                    }}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <div className={learnerNotificationsSearchWrapClassName}>
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted-foreground)]"
                aria-hidden="true"
                strokeWidth={1.75}
              />
              <input
                type="search"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                }}
                placeholder="Search notifications"
                aria-label="Search notifications"
                className={learnerNotificationsSearchFieldClassName}
              />
              {trimmedQuery ? (
                <button
                  type="button"
                  className={learnerNotificationsClearSearchClassName}
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                  }}
                >
                  <X className="h-4 w-4" aria-hidden="true" strokeWidth={1.75} />
                </button>
              ) : null}
            </div>
          </div>

          {filter === "unread" ? (
            <p className={learnerNotificationsCaptionClassName}>Showing unread only</p>
          ) : null}

          {trimmedQuery ? (
            <div className="flex flex-wrap items-center gap-3">
              <p className={learnerNotificationsCaptionClassName} aria-live="polite">
                {visibleItems.length === 1
                  ? `1 result for "${trimmedQuery}"`
                  : `${String(visibleItems.length)} results for "${trimmedQuery}"`}
              </p>
              <button
                type="button"
                className="text-xs font-medium text-[var(--brand-primary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                onClick={() => {
                  setQuery("");
                }}
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      {message ? (
        <div role="alert" className={learnerNotificationsErrorCardClassName}>
          <p>
            {errorKind === "mark-read"
              ? "We couldn't mark that as read."
              : errorKind === "load-more"
                ? "We couldn't load older notifications."
                : "We couldn't load your notifications."}
          </p>
          {requestId ? (
            <p className="mt-1 font-mono text-[12px] text-[var(--muted-foreground)]">
              Request ID: {requestId}
            </p>
          ) : null}
          {message && errorKind !== "mark-read" && errorKind !== "load-more" ? (
            <p className="mt-1 text-[13px] text-[var(--muted-foreground)]">{message}</p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-3">
            {errorKind === "mark-read" || errorKind === "load-more" ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--brand-primary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                onClick={dismissError}
              >
                Dismiss
              </button>
            ) : null}
            {errorKind === "load-more" ? (
              <button
                type="button"
                className="text-xs font-medium text-[var(--brand-primary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
                onClick={() => void loadMore()}
              >
                Try again
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {isEmptyInbox ? (
        <div className={learnerNotificationsEmptyShellClassName}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--brand-primary)]">
            <Bell className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
          </div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">No notifications yet</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted-foreground)]">
            Updates about your courses, community, and account will appear here.
          </p>
          <div className="mt-4">
            <SettingsLink />
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className={learnerNotificationsEmptyShellClassName}>
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--brand-primary)]">
            {trimmedQuery ? (
              <Search className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
            ) : (
              <Bell className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
            )}
          </div>
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {trimmedQuery ? `No notifications match "${trimmedQuery}"` : "You're caught up"}
          </h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-[var(--muted-foreground)]">
            {trimmedQuery
              ? "Try a different search term or switch back to All."
              : "New updates will show up here when they arrive."}
          </p>
          {trimmedQuery ? (
            <button
              type="button"
              className={`${learnerNotificationsLoadMoreClassName} mt-4 border-[var(--border)]`}
              onClick={() => {
                setQuery("");
              }}
            >
              Clear search
            </button>
          ) : filter === "unread" ? (
            <button
              type="button"
              className={`${learnerNotificationsLoadMoreClassName} mt-4 border-[var(--border)]`}
              onClick={() => {
                setFilter("all");
              }}
            >
              Show all
            </button>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groupedItems.map((group, groupIndex) => (
            <section key={group.key} className="flex flex-col gap-2" aria-label={group.label}>
              <div className={learnerNotificationsGroupStickyClassName}>
                <h2 className={learnerNotificationsGroupHeadingClassName}>{group.label}</h2>
              </div>

              <ul className="flex flex-col gap-2">
                {group.items.map((item, itemIndex) => {
                  const visual = getNotificationVisual(item);
                  const Icon = visual.icon;
                  const rail = railClassForPriority(visual.priority);
                  const category = getNotificationCategory(item.actionPath);
                  const staggerIndex = Math.min(groupIndex * 3 + itemIndex, 7);

                  return (
                    <motion.li
                      key={item.id}
                      initial={reduceMotion ? false : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.15,
                        delay: reduceMotion ? 0 : staggerIndex * 0.03,
                        ease: "easeOut",
                      }}
                    >
                      <button
                        type="button"
                        className={[
                          learnerNotificationsCardClassName,
                          item.read ? learnerNotificationsCardReadClassName : "",
                          openingId === item.id
                            ? "ring-1 ring-[color-mix(in_srgb,var(--brand-primary)_28%,transparent)]"
                            : "",
                        ].join(" ")}
                        onClick={() => void openNotification(item)}
                        aria-busy={openingId === item.id}
                      >
                        {rail ? <span className={rail} aria-hidden="true" /> : null}

                        {!item.read ? (
                          <span
                            className={learnerNotificationsUnreadDotClassName}
                            aria-label="Unread"
                          />
                        ) : (
                          <span
                            className={learnerNotificationsUnreadSpacerClassName}
                            aria-hidden="true"
                          />
                        )}

                        <span className={iconShellForPriority(visual.priority)}>
                          <Icon
                            className="h-5 w-5"
                            aria-hidden="true"
                            strokeWidth={visual.filledIcon ? 2.25 : 1.75}
                          />
                        </span>

                        <span className="min-w-0 flex-1">
                          <span className="mb-0.5 flex items-baseline justify-between gap-3">
                            <span
                              className={
                                item.read
                                  ? learnerNotificationsTitleReadClassName
                                  : learnerNotificationsTitleUnreadClassName
                              }
                            >
                              {item.title}
                            </span>
                            <time
                              dateTime={item.createdAt}
                              className="shrink-0 whitespace-nowrap text-[13px] leading-[18px] text-[var(--muted-foreground)]"
                            >
                              {formatNotificationTimestamp(item.createdAt)}
                            </time>
                          </span>
                          <span className={learnerNotificationsBodyClassName}>{item.body}</span>
                          <span className={learnerNotificationsMetaClassName}>
                            <span className={learnerNotificationsCategoryPillClassName}>
                              {category}
                            </span>
                          </span>
                        </span>

                        <ChevronRight
                          className={learnerNotificationsChevronClassName}
                          aria-hidden="true"
                          strokeWidth={1.75}
                        />
                      </button>
                    </motion.li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!isEmptyInbox && hasMore ? (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            className={learnerNotificationsLoadMoreClassName}
            disabled={loadingMore}
            onClick={() => void loadMore()}
          >
            {loadingMore ? "Loading…" : "Load older notifications"}
          </button>
        </div>
      ) : null}

      {!isEmptyInbox && !hasMore && visibleItems.length > 0 && !trimmedQuery && filter === "all" ? (
        <p className={learnerNotificationsCaughtUpClassName}>You're all caught up</p>
      ) : null}
    </div>
  );
}
