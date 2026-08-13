export const LIVE_SESSION_KPI_IDS = ["sessions", "live-now", "upcoming", "ended"] as const;

export const LIVE_ATTENDANCE_KPI_IDS = [
  "total-attended",
  "total-registered",
  "attendance-rate",
  "attendance-rate-30d",
] as const;

export const LIVE_WATCH_KPI_IDS = [
  "avg-watch-minutes",
  "total-watch-hours",
  "sessions-30d",
  "attended-30d",
] as const;

export const LIVE_PERCENT_KPI_IDS = new Set(["attendance-rate", "attendance-rate-30d"]);

export const LIVE_STATUS_BAR_IDS = new Set(["sessions-by-status", "attended-by-status"]);

export const LIVE_TABLE_IDS = new Set([
  "upcoming-sessions",
  "recent-sessions",
  "low-attendance-sessions",
]);

export const LIVE_DUAL_SERIES_IDS = new Set(["daily-attendance"]);

export const LIVE_COMPARE_PAIR: Record<string, string> = {
  "sessions-by-status": "attended-by-status",
  "attended-by-status": "sessions-by-status",
};

export const LIVE_DASHBOARD_CHART_WIDGET_IDS = [
  "sessions-by-status",
  "attended-by-status",
  "daily-attendance",
  "upcoming-sessions",
  "recent-sessions",
  "low-attendance-sessions",
] as const;

export const LIVE_FIXED_WINDOW_CAPTION =
  "Live Dashboard uses fixed windows shown in each widget title.";

export const LIVE_LEARNER_DETAIL_CAPTION = "Learner-level detail lives in Live Class Attendance.";

export const LIVE_ATTENDANCE_REPORT_HREF = "/admin/reports/live-class-attendance";
export const LIVE_SESSIONS_HREF = "/admin/live-sessions";

export const LIVE_RANGE_SHORT_LABELS: Record<"12m" | "30d" | "ytd", string> = {
  "12m": "12m",
  "30d": "30d",
  ytd: "YTD",
};

export function liveStatusBarTone(label: string): "success" | "warning" | "danger" | "neutral" {
  const normalized = label.toLowerCase();
  if (normalized.includes("live")) return "success";
  if (normalized.includes("sched")) return "warning";
  if (normalized.includes("canc")) return "danger";
  return "neutral";
}

export function liveStatusShortLabel(label: string): string {
  const normalized = label.toLowerCase();
  if (normalized.includes("ended") || normalized.includes("completed")) return "Ended";
  if (normalized.includes("live")) return "Live";
  if (normalized.includes("sched")) return "Sched";
  if (normalized.includes("canc")) return "Canc";
  return label;
}

export function liveOpsMode(metrics: {
  sessionCount: number;
  liveNow: number;
  upcoming: number;
}): "empty" | "quiet" | "active" {
  if (metrics.sessionCount <= 0) return "empty";
  if (metrics.liveNow <= 0 && metrics.upcoming <= 0) return "quiet";
  return "active";
}

export function liveAttendanceRateTone(rate: number): "success" | "warning" | "danger" | "neutral" {
  if (rate >= 70) return "success";
  if (rate >= 50) return "neutral";
  if (rate >= 30) return "warning";
  return "danger";
}
