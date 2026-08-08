import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  CalendarDays,
  GraduationCap,
  Settings,
  ShieldCheck,
  Users,
} from "lucide-react";
import type { z } from "zod";
import type { notificationInboxItemSchema } from "@atlas/contracts/notifications/notification.dto";

export type InboxItem = z.infer<typeof notificationInboxItemSchema>;

export type NotificationFilter = "all" | "unread";

export type NotificationPriority = "default" | "warning" | "danger";

export type NotificationVisual = {
  icon: LucideIcon;
  priority: NotificationPriority;
  category: string;
  filledIcon: boolean;
};

export type NotificationDateGroup = {
  key: string;
  label: string;
  items: InboxItem[];
};

const DANGER_KEYWORDS =
  /\b(renewal|payment|subscription|failed|error|urgent|expir|overdue|suspended)\b/i;
const WARNING_KEYWORDS =
  /\b(warning|review|pending|action required|attention|verify|confirm)\b/i;

export function getNotificationPriority(title: string, body: string): NotificationPriority {
  const text = `${title} ${body}`;
  if (DANGER_KEYWORDS.test(text)) return "danger";
  if (WARNING_KEYWORDS.test(text)) return "warning";
  return "default";
}

export function getNotificationCategory(actionPath: string): string {
  const path = actionPath.toLowerCase();
  if (path.includes("/courses") || path.includes("/studio") || path.includes("/learning")) {
    return "Courses";
  }
  if (path.includes("/community") || path.includes("/discussions") || path.includes("/forum")) {
    return "Community";
  }
  if (path.includes("/calendar") || path.includes("/events") || path.includes("/webinar")) {
    return "Events";
  }
  if (
    path.includes("/settings") ||
    path.includes("/profile") ||
    path.includes("/billing") ||
    path.includes("/account") ||
    path.includes("/subscription")
  ) {
    return "Account";
  }
  if (path.startsWith("/admin")) return "Admin";
  return "General";
}

export function getNotificationVisual(item: InboxItem): NotificationVisual {
  const path = item.actionPath.toLowerCase();
  const priority = getNotificationPriority(item.title, item.body);
  const category = getNotificationCategory(item.actionPath);

  if (priority === "danger" || priority === "warning") {
    return { icon: AlertTriangle, priority, category, filledIcon: true };
  }
  if (path.includes("/courses") || path.includes("/studio") || path.includes("/learning")) {
    return { icon: GraduationCap, priority, category, filledIcon: true };
  }
  if (path.includes("/community") || path.includes("/discussions")) {
    return { icon: Users, priority, category, filledIcon: false };
  }
  if (path.includes("/calendar") || path.includes("/events")) {
    return { icon: CalendarDays, priority, category, filledIcon: false };
  }
  if (path.startsWith("/admin")) {
    return { icon: ShieldCheck, priority, category, filledIcon: false };
  }
  if (path.includes("/settings") || path.includes("/profile") || path.includes("/account")) {
    return { icon: Settings, priority, category, filledIcon: false };
  }
  return { icon: Bell, priority, category, filledIcon: false };
}

export function formatNotificationTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday);
  startOfYesterday.setDate(startOfYesterday.getDate() - 1);

  const time = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  if (date >= startOfToday) {
    const diffMinutes = Math.round((date.getTime() - now.getTime()) / (1000 * 60));
    if (Math.abs(diffMinutes) < 60) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(
        diffMinutes,
        "minute",
      );
    }
    const diffHours = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60));
    if (Math.abs(diffHours) < 24) {
      return new Intl.RelativeTimeFormat(undefined, { numeric: "auto" }).format(diffHours, "hour");
    }
  }

  if (date >= startOfYesterday && date < startOfToday) {
    return `Yesterday at ${time}`;
  }

  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function groupLabelForDate(date: Date, now: Date): string {
  const today = startOfDay(now).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const value = startOfDay(date).getTime();

  if (value === today) return "Today";
  if (value === yesterday) return "Yesterday";

  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function groupNotificationsByDate(items: InboxItem[], now = new Date()): NotificationDateGroup[] {
  const groups = new Map<string, NotificationDateGroup>();

  for (const item of items) {
    const createdAt = new Date(item.createdAt);
    const label = groupLabelForDate(createdAt, now);
    const key = startOfDay(createdAt).toISOString();
    const existing = groups.get(key);

    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(key, { key, label, items: [item] });
  }

  return [...groups.values()].sort(
    (left, right) => new Date(right.key).getTime() - new Date(left.key).getTime(),
  );
}

export function filterNotifications(
  items: InboxItem[],
  filter: NotificationFilter,
  query: string,
): InboxItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return items.filter((item) => {
    if (filter === "unread" && item.read) return false;
    if (!normalizedQuery) return true;

    const haystack = `${item.title} ${item.body} ${getNotificationCategory(item.actionPath)}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
