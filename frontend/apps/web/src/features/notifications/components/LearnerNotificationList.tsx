"use client";

import { cn } from "@atlas/design-system/lib/cn";
import {
  formatNotificationTimestamp,
  getNotificationVisual,
  type InboxItem,
} from "../notifications-inbox-utils";

/**
 * The rows of the learner bell's panel. Loaded only when the panel opens, so
 * the notification icons and date helpers stay out of every learner page's
 * first load (audit H16 budget).
 */
export function LearnerNotificationList({
  items,
  onOpen,
}: {
  items: InboxItem[];
  onOpen: (item: InboxItem) => void;
}) {
  return (
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
                onOpen(item);
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
                      : "bg-[var(--muted)] text-[var(--primary)]",
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
                      item.read ? "font-medium text-[var(--muted-foreground)]" : "font-semibold",
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
  );
}
