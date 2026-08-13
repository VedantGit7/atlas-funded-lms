import type { InsightDashboardRange } from "./admin-insights-api";

let insightNumberLocale = "en-US";

export function setInsightNumberFormat(format: "international" | "european"): void {
  insightNumberLocale = format === "european" ? "de-DE" : "en-US";
}

export function formatInsightNumber(value: number, fractionDigits = 0): string {
  return value.toLocaleString(insightNumberLocale, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

export function formatInsightMoney(value: number): string {
  return value.toLocaleString(insightNumberLocale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatInsightMoneyWithCode(value: number, currency?: string): string {
  const amount = formatInsightMoney(value);
  return currency ? `${amount} ${currency}` : amount;
}

export function formatRelativeTime(iso: string, now = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const diffMs = date.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  if (Math.abs(diffMinutes) < 60) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffMinutes, "minute");
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  if (Math.abs(diffHours) < 24) {
    return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffHours, "hour");
  }
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(diffDays, "day");
}

export function formatPeriodLabel(period: string, range: InsightDashboardRange): string {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  if (range === "30d") {
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleDateString(undefined, { month: "short" });
}

export function formatPeriodLong(period: string): string {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function widgetToCsv(
  columns: Array<{ key: string; label: string }>,
  rows: Array<Record<string, string | number | null>>,
): string {
  const lines = [columns.map((column) => csvEscape(column.label)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((column) => csvEscape(row[column.key] ?? "")).join(","));
  }
  return lines.join("\n");
}

export function csvEscape(value: string | number | null | undefined): string {
  const raw = value == null ? "" : String(value);
  if (/[",\n]/.test(raw)) return `"${raw.replace(/"/g, '""')}"`;
  return raw;
}

export function formatDurationHms(totalSeconds: number | null): string {
  if (totalSeconds == null || !Number.isFinite(totalSeconds)) return "";
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return [hours, minutes, rest].map((part) => String(part).padStart(2, "0")).join(":");
}

export function formatMutedUntil(value: string | null, now = new Date()): string {
  if (!value) return "";
  if (value === "forever") return "Forever";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  if (date.getTime() < now.getTime()) return "Expired";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function dashboardToCsv(
  title: string,
  generatedAt: string | undefined,
  widgets: Array<{
    title: string;
    data: {
      columns: Array<{ key: string; label: string }>;
      rows: Array<Record<string, string | number | null>>;
    };
  }>,
): string {
  const lines: string[] = [`# ${title}`, `# Generated ${generatedAt ?? ""}`, ""];
  for (const widget of widgets) {
    lines.push(`# ${widget.title}`);
    lines.push(widgetToCsv(widget.data.columns, widget.data.rows));
    lines.push("");
  }
  return lines.join("\n");
}

export function dashboardDescription(slug: string): string {
  if (slug === "dashboard") return "Revenue, learners, and operations at a glance.";
  if (slug === "school-vitals") {
    return "Whether learners are showing up, moving through content, and passing.";
  }
  if (slug === "sales-insight") {
    return "Where revenue comes from, and where it leaks.";
  }
  if (slug === "live-dashboard") {
    return "Real-time session monitoring and attendance metrics.";
  }
  if (slug === "marketing-insight") {
    return "Where traffic is attributed from, what captures it, and whether the automation is running.";
  }
  if (slug === "messenger-insight") {
    return "What the academy is sending, whether it arrived, and what is coming back.";
  }
  return "Live insight widgets across your academy.";
}
