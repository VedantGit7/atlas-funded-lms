"use client";

/**
 * Admin header notification preview.
 *
 * Pattern (industry standard): click the bell → lightweight popover with recent
 * items + Load more + footer link to the full notification center. Prefer click
 * over hover (touch-safe, keyboard-accessible, no accidental opens).
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
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

const PREVIEW_LIMIT = 8;

function unreadCount(items: InboxItem[]): number {
  return items.filter((item) => !item.read).length;
}

export function AdminNotificationPopover() {
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
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [badgeUnread, setBadgeUnread] = useState(0);

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
      setBadgeUnread(unreadCount(response.data));
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Unable to load notifications.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Lightweight badge poll so the red dot stays accurate without opening the panel.
  useEffect(() => {
    let cancelled = false;

    async function refreshBadge() {
      try {
        const response = await clientApi.get<NotificationListResponse>(
          `/api/v1/me/notifications?limit=${PREVIEW_LIMIT}`,
        );
        if (!cancelled) {
          setBadgeUnread(unreadCount(response.data));
        }
      } catch {
        // Badge is non-critical; ignore transient failures.
      }
    }

    void refreshBadge();
    const interval = window.setInterval(() => void refreshBadge(), 60_000);
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
        setBadgeUnread(unreadCount(merged));
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
      try {
        await clientApi.post<{ data: { id: string; read: true; readAt: string } }>(
          `/api/v1/me/notifications/${item.id}/read`,
          {},
          `notification-read-${item.id}`,
        );
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, read: true, readAt: new Date().toISOString() } : row,
          ),
        );
        setBadgeUnread((count) => Math.max(0, count - 1));
      } catch {
        // Still navigate even if mark-read fails.
      }
    }
    setOpen(false);
    router.push(item.actionPath || "/admin/notifications");
  }

  async function markAllRead() {
    const unread = items.filter((item) => !item.read);
    if (unread.length === 0 || markingAll) return;
    setMarkingAll(true);
    try {
      await Promise.all(
        unread.map((item) =>
          clientApi.post(
            `/api/v1/me/notifications/${item.id}/read`,
            {},
            `notification-read-${item.id}`,
          ),
        ),
      );
      setItems((prev) =>
        prev.map((row) =>
          row.read ? row : { ...row, read: true, readAt: new Date().toISOString() },
        ),
      );
      setBadgeUnread(0);
    } catch (caught) {
      setError(caught instanceof ClientApiError ? caught.message : "Unable to mark all as read.");
    } finally {
      setMarkingAll(false);
    }
  }

  const badgeLabel =
    badgeUnread > 0
      ? `Notifications, ${badgeUnread > 99 ? "99+" : badgeUnread} unread`
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
        className="relative rounded-full p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--admin-bg)]"
        onClick={() => {
          setOpen((value) => !value);
        }}
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {badgeUnread > 0 ? (
          <span
            className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--admin-danger)] px-1 text-[10px] font-bold leading-none text-white ring-2 ring-[var(--admin-bg)]"
            aria-hidden="true"
          >
            {badgeUnread > 9 ? "9+" : badgeUnread}
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
            "absolute right-0 top-[calc(100%+10px)] z-50 flex w-[min(100vw-2rem,22rem)] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl",
          )}
        >
          <div className="flex items-center justify-between gap-2 border-b border-[var(--admin-border)] px-4 py-3">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="text-sm font-bold text-[var(--admin-on-surface)] outline-none"
            >
              Notifications
            </h2>
            <button
              type="button"
              disabled={markingAll || badgeUnread === 0}
              onClick={() => {
                void markAllRead();
              }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--admin-primary)] transition-colors hover:bg-[var(--admin-primary-container)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Mark all read
            </button>
          </div>

          <div className="max-h-[min(70vh,22rem)] overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="space-y-3 p-4" aria-busy="true" aria-label="Loading notifications">
                {[0, 1, 2].map((index) => (
                  <div key={index} className="flex animate-pulse gap-3">
                    <div className="h-9 w-9 shrink-0 rounded-full bg-[var(--admin-surface-high)]" />
                    <div className="flex-1 space-y-2 py-1">
                      <div className="h-3 w-2/3 rounded bg-[var(--admin-surface-high)]" />
                      <div className="h-3 w-full rounded bg-[var(--admin-surface-high)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : error && items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-[var(--admin-danger)]" role="alert">
                {error}
              </p>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--admin-primary-container)] text-[var(--admin-primary)]">
                  <Bell className="h-5 w-5" aria-hidden="true" />
                </div>
                <p className="text-sm font-medium text-[var(--admin-on-surface)]">All caught up</p>
                <p className="text-xs text-[var(--admin-on-surface-variant)]">
                  New alerts will show up here.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-[var(--admin-border)]" role="list">
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
                        className={[
                          "flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--admin-surface-high)]",
                          item.read ? "opacity-80" : "",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full",
                            visual.priority === "danger" || visual.priority === "warning"
                              ? "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]"
                              : "bg-[var(--admin-primary-container)] text-[var(--admin-primary)]",
                          ].join(" ")}
                        >
                          <Icon
                            className="h-4 w-4"
                            aria-hidden="true"
                            strokeWidth={visual.filledIcon ? 2.25 : 2}
                          />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span
                              className={[
                                "truncate text-sm text-[var(--admin-on-surface)]",
                                item.read ? "font-medium" : "font-bold",
                              ].join(" ")}
                            >
                              {item.title}
                            </span>
                            {!item.read ? (
                              <span
                                className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--admin-primary)]"
                                aria-label="Unread"
                              />
                            ) : null}
                          </span>
                          <span className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-[var(--admin-on-surface-variant)]">
                            {item.body}
                          </span>
                          <span className="mt-1.5 block text-[11px] text-[var(--admin-on-surface-variant)]/80">
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
              <p className="border-t border-[var(--admin-border)] px-4 py-2 text-xs text-[var(--admin-danger)]">
                {error}
              </p>
            ) : null}

            {hasMore ? (
              <div className="border-t border-[var(--admin-border)] p-2">
                <button
                  type="button"
                  disabled={loadingMore}
                  onClick={() => {
                    void loadMore();
                  }}
                  className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-60"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
                      Loading…
                    </>
                  ) : (
                    "Load more"
                  )}
                </button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-2">
            <Link
              href="/admin/notifications"
              prefetch={false}
              onClick={() => {
                setOpen(false);
              }}
              className="flex w-full items-center justify-center rounded-lg bg-[var(--admin-primary)] px-3 py-2.5 text-xs font-bold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--admin-primary)] focus-visible:ring-offset-2"
            >
              Open notification center
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
