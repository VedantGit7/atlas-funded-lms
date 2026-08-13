"use client";

/**
 * Learner header notification preview.
 *
 * Same interaction model as the admin popover (click bell → panel), restyled
 * for the learner shell: brand tokens, no mark-all-read, footer to the inbox.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, Loader2, Settings } from "lucide-react";
import { cn, dropdownPanelEnterEndClassName } from "@atlas/design-system";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  formatNotificationTimestamp,
  getNotificationVisual,
  type InboxItem,
} from "../notifications-inbox-utils";

type NotificationListResponse = {
  data: InboxItem[];
  page: { nextCursor: string | null; hasMore: boolean };
};

type LearnerNotificationPopoverProps = {
  initialUnreadCount?: number | null;
};

const PREVIEW_LIMIT = 8;

function countUnread(items: InboxItem[]): number {
  return items.filter((item) => !item.read).length;
}

export function LearnerNotificationPopover({
  initialUnreadCount = null,
}: LearnerNotificationPopoverProps) {
  const router = useRouter();
  const panelId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<InboxItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badgeUnread, setBadgeUnread] = useState(() =>
    initialUnreadCount != null && initialUnreadCount > 0 ? initialUnreadCount : 0,
  );

  const loadPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await clientApi.get<NotificationListResponse>(
        `/api/v1/me/notifications?limit=${PREVIEW_LIMIT}`,
      );
      setItems(response.data);
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
      setBadgeUnread(countUnread(response.data));
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshBadge() {
      try {
        const response = await clientApi.get<NotificationListResponse>(
          `/api/v1/me/notifications?limit=${PREVIEW_LIMIT}`,
        );
        if (!cancelled) {
          setBadgeUnread(countUnread(response.data));
        }
      } catch {
        // Badge is non-critical; ignore transient failures.
      }
    }

    void refreshBadge();
    const interval = window.setInterval(() => {
      void refreshBadge();
    }, 60_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!open) return;

    void loadPreview();

    const frame = window.requestAnimationFrame(() => {
      headingRef.current?.focus();
    });

    function onPointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, loadPreview]);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await clientApi.get<NotificationListResponse>(
        `/api/v1/me/notifications?limit=${PREVIEW_LIMIT}&cursor=${nextCursor}`,
      );
      setItems((prev) => {
        const merged = [...prev, ...response.data];
        setBadgeUnread(countUnread(merged));
        return merged;
      });
      setNextCursor(response.page.nextCursor);
      setHasMore(response.page.hasMore);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Unable to load more.");
    } finally {
      setLoadingMore(false);
    }
  }

  async function openItem(item: InboxItem) {
    if (!item.read) {
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, read: true, readAt: new Date().toISOString() } : row,
        ),
      );
      setBadgeUnread((count) => Math.max(0, count - 1));

      try {
        await clientApi.post<{ data: { id: string; read: true; readAt: string } }>(
          `/api/v1/me/notifications/${item.id}/read`,
          {},
          `notification-read-${item.id}`,
        );
      } catch {
        // Still navigate even if mark-read fails; revert local unread state.
        setItems((prev) =>
          prev.map((row) => (row.id === item.id ? { ...row, read: false, readAt: null } : row)),
        );
        setBadgeUnread((count) => count + 1);
      }
    }
    setOpen(false);
    router.push(item.actionPath || "/notifications");
  }

  const badgeLabel =
    badgeUnread > 0
      ? `Notifications, ${badgeUnread > 99 ? "99+" : String(badgeUnread)} unread`
      : "Notifications";

  return (
    <div className="relative" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={badgeLabel}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-full text-[var(--muted-foreground)] transition-colors duration-150 ease-out",
          "hover:bg-[var(--muted)] hover:text-[var(--foreground)]",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]",
          open ? "bg-[var(--muted)] text-[var(--foreground)]" : "",
        )}
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Bell className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
        {badgeUnread > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--foreground)] px-1 text-[10px] font-bold leading-none text-[var(--background)] ring-2 ring-[var(--background)]"
            aria-hidden="true"
          >
            {badgeUnread > 9 ? "9+" : String(badgeUnread)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Notifications"
          aria-modal="false"
          className={cn(
            dropdownPanelEnterEndClassName,
            "absolute right-0 top-[calc(100%+10px)] z-50 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-[var(--radius)] border border-[var(--border)] bg-[var(--card)] shadow-[0_18px_45px_color-mix(in_srgb,var(--foreground)_14%,transparent)]",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--border)] px-4 py-3">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-sm font-semibold text-[var(--foreground)] outline-none"
            >
              Notifications
            </h2>
            <Link
              href="/profile/notifications"
              prefetch={false}
              onClick={() => {
                setOpen(false);
              }}
              className="inline-flex min-h-8 items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-[var(--brand-primary)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              <Settings className="h-3.5 w-3.5" aria-hidden="true" strokeWidth={1.75} />
              Settings
            </Link>
          </div>

          <div className="max-h-[min(70vh,22rem)] overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading notifications">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex animate-pulse gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--muted)]" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-2/3 rounded bg-[var(--muted)]" />
                      <div className="h-3 w-full rounded bg-[var(--muted)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--destructive)]" role="alert">
                {error}
              </p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--muted)] text-[var(--brand-primary)]">
                  <Bell className="h-5 w-5" aria-hidden="true" strokeWidth={1.75} />
                </div>
                <p className="text-sm font-medium text-[var(--foreground)]">All caught up</p>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Updates from your courses and community will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--border)]" role="list">
                {items.map((item, index) => {
                  const visual = getNotificationVisual(item);
                  const Icon = visual.icon;
                  return (
                    <li
                      key={item.id}
                      className="motion-safe:animate-[admin-fade-in_0.2s_ease-out_both]"
                      style={{ animationDelay: `${Math.min(index, 6) * 30}ms` }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          void openItem(item);
                        }}
                        className={cn(
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors duration-150 ease-out hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--ring)] active:scale-[0.99]",
                          item.read ? "opacity-90" : "",
                        )}
                      >
                        <span
                          className={cn(
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            visual.priority === "danger"
                              ? "bg-[color-mix(in_srgb,var(--destructive)_14%,var(--muted))] text-[var(--destructive)]"
                              : visual.priority === "warning"
                                ? "bg-[color-mix(in_srgb,var(--warning)_14%,var(--muted))] text-[var(--warning)]"
                                : "bg-[var(--muted)] text-[var(--brand-primary)]",
                          )}
                        >
                          <Icon
                            className="h-4 w-4"
                            aria-hidden="true"
                            strokeWidth={visual.filledIcon ? 2.25 : 1.75}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={cn(
                                "truncate text-sm text-[var(--foreground)]",
                                item.read
                                  ? "font-medium text-[var(--muted-foreground)]"
                                  : "font-semibold",
                              )}
                            >
                              {item.title}
                            </span>
                            {!item.read ? (
                              <span
                                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--brand-primary)]"
                                aria-label="Unread"
                              />
                            ) : null}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--muted-foreground)]">
                            {item.body}
                          </span>
                          <span className="mt-1.5 block text-[11px] text-[var(--muted-foreground)]">
                            {formatNotificationTimestamp(item.createdAt)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            {error && items.length > 0 ? (
              <p className="border-t border-[var(--border)] px-4 py-2 text-xs text-[var(--destructive)]">
                {error}
              </p>
            ) : null}

            {hasMore ? (
              <div className="border-t border-[var(--border)] p-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    void loadMore();
                  }}
                  className="flex min-h-10 w-full items-center justify-center gap-2 rounded-[var(--radius)] px-3 py-2 text-xs font-medium text-[var(--brand-primary)] transition-colors hover:bg-[var(--muted)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)] disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    "Load older"
                  )}
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--border)] bg-[var(--muted)] p-2">
            <Link
              href="/notifications"
              prefetch={false}
              onClick={() => {
                setOpen(false);
              }}
              className="flex min-h-10 w-full items-center justify-center rounded-[var(--radius)] bg-[var(--brand-primary)] px-3 py-2.5 text-xs font-semibold text-[var(--primary-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ring)]"
            >
              Open notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
