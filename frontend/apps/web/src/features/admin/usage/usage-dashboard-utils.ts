/**
 * Types and pure helpers for the Usage Insights dashboard.
 *
 * The server assembles real scalar metrics it can source today (subscribed plan
 * + billing dates from tenant subscriptions, active/total members from member
 * stats). Everything the platform does not yet meter (bandwidth, storage, video
 * hours, DRM tokens, message sends, email validations) is reported as zero so
 * the dashboard is honest for a tenant with no metered history.
 */

export type UsageCurrent = {
  bandwidthGb: number;
  testSubmits: number;
  drmTokens: number;
  messageSends: number;
  emailValidations: number;
  totalLearners: number;
  contentStorageGb: number;
  products: number;
  videoTranscodingHours: number;
  questions: number;
};

export type UsagePoint = { period: string; value: number };

export type UsageMau = {
  monthly: UsagePoint[];
  daily: UsagePoint[];
  comparison: {
    current: number;
    m1: number | null;
    m3: number | null;
    m6: number | null;
    m9: number | null;
  };
};

export type UsageHistoryEntry = {
  period: string;
  storageGb: number;
  totalLearners: number;
  products: number;
  questions: number;
  testSubmits: number;
  messageSends: number;
  emailValidations: number;
};

export type UsageLimits = {
  storageGb: number | null;
  mau: number | null;
  bandwidthGb: number | null;
  videoHours: number | null;
};

export type UsageSummary = {
  planName: string | null;
  planStartedAt: string | null;
  nextBillingAt: string | null;
  currentMau: number;
  totalLearners: number;
  totalVideoHours: number;
  totalStorageGb: number;
  /** Plan resource limits (null = unlimited). */
  limits: UsageLimits;
  /** Real values for the current period. */
  current: UsageCurrent;
  /** Real MAU/DAU history from active-day markers. */
  mau: UsageMau;
  /** Monthly gauge snapshots; the current month is always live. */
  history: UsageHistoryEntry[];
};

/** Percentage of a limit consumed, or null when the metric is unlimited. */
export function usagePercent(used: number, limit: number | null): number | null {
  if (limit == null || limit <= 0) {
    return null;
  }
  return Math.min(100, Math.round((used / limit) * 100));
}

export type Granularity = "days" | "weeks" | "months";

export type UsageBucket = {
  /** Stable key for React lists. */
  key: string;
  /** Backend period key: "YYYY-MM-01" (months) or "YYYY-MM-DD" (days/weeks). */
  period: string;
  /** Short axis / column label, e.g. "01 Jul '26". */
  label: string;
  /** True for the most recent (current) bucket. */
  current: boolean;
};

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function pad2(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

export function formatLongDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${SHORT_MONTHS[date.getMonth()] ?? ""} ${String(date.getDate())}, ${String(date.getFullYear())}`;
}

export function formatShortDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return `${pad2(date.getDate())} ${SHORT_MONTHS[date.getMonth()] ?? ""}, ${String(date.getFullYear())}`;
}

/**
 * Build the time buckets for a given granularity, most recent last. Bucket count
 * is fixed per granularity so charts and comparison tiles stay readable.
 */
export function buildBuckets(granularity: Granularity, reference: Date): UsageBucket[] {
  const count = granularity === "days" ? 30 : granularity === "weeks" ? 12 : 12;
  const buckets: UsageBucket[] = [];

  for (let step = count - 1; step >= 0; step -= 1) {
    const date = new Date(reference);
    let label: string;
    let period: string;
    if (granularity === "days" || granularity === "weeks") {
      date.setDate(reference.getDate() - step * (granularity === "weeks" ? 7 : 1));
      label = `${pad2(date.getDate())} ${SHORT_MONTHS[date.getMonth()] ?? ""}`;
      period = `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
    } else {
      date.setDate(1);
      date.setMonth(reference.getMonth() - step);
      label = `01 ${SHORT_MONTHS[date.getMonth()] ?? ""} '${String(date.getFullYear()).slice(2)}`;
      period = `${String(date.getFullYear())}-${pad2(date.getMonth() + 1)}-01`;
    }
    buckets.push({
      key: `${granularity}-${period}`,
      period,
      label,
      current: step === 0,
    });
  }

  return buckets;
}

/** Month columns for the cumulative tables, most recent first. */
export function buildMonthColumns(reference: Date, count: number): UsageBucket[] {
  return buildBuckets("months", reference).slice(-count).reverse();
}

export function formatGb(value: number): string {
  return `${value % 1 === 0 ? String(value) : value.toFixed(2)} GB`;
}

export function formatHours(value: number): string {
  return `${value % 1 === 0 ? String(value) : value.toFixed(1)} hrs`;
}

/** Growth vs. current: current is the only real balance, history is unmetered. */
export function formatGrowthLabel(current: number): string {
  return current > 0 ? "Infinity%" : "0%";
}
