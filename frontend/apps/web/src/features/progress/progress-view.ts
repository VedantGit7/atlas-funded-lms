/**
 * Presentation + data-shaping helpers for the learner Progress surface.
 *
 * Everything here is pure and token-agnostic: colours live in the components as
 * design tokens so light/dark swap automatically. These helpers only turn the
 * raw API payloads (daily XP, competency snapshots) into the geometry the
 * charts and heatmap render.
 */

export type ActivityDay = {
  date: string;
  xp: number;
};

/** Intensity bucket for a heatmap cell: 0 = idle, 1-4 = increasing activity. */
export type HeatmapLevel = 0 | 1 | 2 | 3 | 4;

export type HeatmapCell = {
  date: string;
  xp: number;
  level: HeatmapLevel;
  /** False for trailing cells that sit in the future (padding to fill the grid). */
  inRange: boolean;
};

export type HeatmapModel = {
  weeks: HeatmapCell[][];
  monthLabels: { column: number; label: string }[];
  maxXp: number;
};

export type WeekBucket = {
  weekStart: string;
  label: string;
  xp: number;
};

const HEATMAP_WEEKS = 53;
const DAYS_PER_WEEK = 7;
const MONTHS = [
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
] as const;

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

function toISODate(date: Date): string {
  const year = String(date.getFullYear());
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date: Date, amount: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function bucketLevel(xp: number, maxXp: number): HeatmapLevel {
  if (xp <= 0 || maxXp <= 0) return 0;
  const ratio = xp / maxXp;
  if (ratio <= 0.25) return 1;
  if (ratio <= 0.5) return 2;
  if (ratio <= 0.75) return 3;
  return 4;
}

/**
 * Builds a GitHub-style contribution grid: 53 week columns x 7 day rows
 * (Sunday top), aligned so the final column ends on the current week.
 */
export function buildActivityHeatmap(days: ActivityDay[], rangeEnd: string): HeatmapModel {
  const xpByDate = new Map(days.map((day) => [day.date, day.xp]));
  const today = parseISODate(rangeEnd);
  const gridEnd = addDays(today, 6 - today.getDay());
  const totalCells = HEATMAP_WEEKS * DAYS_PER_WEEK;
  const gridStart = addDays(gridEnd, -(totalCells - 1));
  const maxXp = days.reduce((max, day) => Math.max(max, day.xp), 0);

  const weeks: HeatmapCell[][] = [];
  const monthLabels: { column: number; label: string }[] = [];
  let previousMonth = -1;

  for (let column = 0; column < HEATMAP_WEEKS; column += 1) {
    const week: HeatmapCell[] = [];
    for (let row = 0; row < DAYS_PER_WEEK; row += 1) {
      const date = addDays(gridStart, column * DAYS_PER_WEEK + row);
      const iso = toISODate(date);
      const inRange = date.getTime() <= today.getTime();
      const xp = inRange ? (xpByDate.get(iso) ?? 0) : 0;
      week.push({ date: iso, xp, level: bucketLevel(xp, maxXp), inRange });
    }

    const columnStart = addDays(gridStart, column * DAYS_PER_WEEK);
    const month = columnStart.getMonth();
    if (month !== previousMonth && columnStart.getTime() <= today.getTime()) {
      monthLabels.push({ column, label: MONTHS[month] ?? "" });
      previousMonth = month;
    }

    weeks.push(week);
  }

  return { weeks, monthLabels, maxXp };
}

/** Sums the trailing `weekCount` weeks of daily XP for the momentum chart. */
export function buildWeeklyXp(days: ActivityDay[], rangeEnd: string, weekCount = 8): WeekBucket[] {
  const { weeks } = buildActivityHeatmap(days, rangeEnd);
  const trailing = weeks.slice(-weekCount);
  return trailing.map((week) => {
    const xp = week.reduce((sum, cell) => sum + cell.xp, 0);
    const weekStart = week[0]?.date ?? rangeEnd;
    return { xp, weekStart, label: formatShortDate(weekStart) };
  });
}

/** Thousands-grouped XP, e.g. 14280 -> "14,280". */
export function formatXp(value: number): string {
  return value.toLocaleString(undefined);
}

/** Zero-padded two-digit count for hero stats, e.g. 6 -> "06". */
export function padCount(value: number): string {
  return value < 10 ? `0${String(value)}` : String(value);
}

/** Short month/day label used on chart axes and week ticks. */
export function formatShortDate(iso: string): string {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/** Full, human date for tooltips / captions, e.g. "Mar 4, 2026". */
export function formatFullDate(iso: string): string {
  const date = parseISODate(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Turns a config rule key ("level_14", "daily_learning") into a readable label
 * ("Level 14", "Daily Learning"). Values are tenant-configured, so this only
 * reformats casing and never invents copy.
 */
export function humanizeKey(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .replace(/[_-]+/g, " ")
    .trim()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}
