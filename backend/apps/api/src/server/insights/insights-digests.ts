export const INSIGHT_DIGEST_TIMEZONES = [
  "UTC",
  "Asia/Kolkata",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Australia/Sydney",
] as const;

export const INSIGHT_DIGEST_WEEKDAYS = [
  { value: "mon", label: "Monday", js: 1 },
  { value: "tue", label: "Tuesday", js: 2 },
  { value: "wed", label: "Wednesday", js: 3 },
  { value: "thu", label: "Thursday", js: 4 },
  { value: "fri", label: "Friday", js: 5 },
  { value: "sat", label: "Saturday", js: 6 },
  { value: "sun", label: "Sunday", js: 0 },
] as const;

export type InsightDigestCadence = "daily" | "weekly" | "monthly";
export type InsightDigestFormat = "inline" | "inline-csv" | "link";
export type InsightDigestPeriod = "30d" | "ytd" | "12m";
export type InsightDigestSendStatus = "delivered" | "failed";

export type InsightDigestSend = {
  at: string;
  status: InsightDigestSendStatus;
  error: string | null;
  test: boolean;
};

export type InsightDigest = {
  id: string;
  name: string;
  sourceSlug: string;
  enabled: boolean;
  includeAlerts: boolean;
  includeKpis: boolean;
  widgetIds: string[];
  period: InsightDigestPeriod;
  format: InsightDigestFormat;
  recipients: string[];
  cadence: InsightDigestCadence;
  weekday: string;
  monthDay: number;
  time: string;
  timezone: string;
  createdAt: string;
  sends: InsightDigestSend[];
};

export type InsightDigestState = {
  items: Record<string, InsightDigest>;
};

export type InsightDigestRecipient = {
  email: string;
  initials: string;
  outsideDomain: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function emptyInsightDigestState(): InsightDigestState {
  return { items: {} };
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));
}

export function emailDomain(value: string): string {
  const parts = normalizeEmail(value).split("@");
  return parts[1] ?? "";
}

export function recipientInitials(email: string): string {
  const local = normalizeEmail(email).split("@")[0] ?? "";
  const bits = local.split(/[._-]+/).filter(Boolean);
  if (bits.length >= 2) {
    return `${bits[0]?.[0] ?? ""}${bits[1]?.[0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

export function isOutsideDomain(email: string, domains: string[]): boolean {
  const domain = emailDomain(email);
  if (!domain) return true;
  if (domains.length === 0) return false;
  return !domains.some((item) => domain === item || domain.endsWith(`.${item}`));
}

export function parseInsightDigestState(value: unknown): InsightDigestState {
  const record = asRecord(value);
  if (!record) return emptyInsightDigestState();
  const itemsRaw = asRecord(record["items"]);
  if (!itemsRaw) return emptyInsightDigestState();
  const items: Record<string, InsightDigest> = {};
  for (const [id, entry] of Object.entries(itemsRaw)) {
    const parsed = parseDigest(entry, id);
    if (parsed) items[parsed.id] = parsed;
  }
  return { items };
}

function parseDigest(value: unknown, fallbackId: string): InsightDigest | null {
  const record = asRecord(value);
  if (!record) return null;
  const name = asString(record["name"]).trim();
  if (!name) return null;
  const recipientsRaw = record["recipients"];
  const recipients = Array.isArray(recipientsRaw)
    ? recipientsRaw
        .filter((item): item is string => typeof item === "string" && isValidEmail(item))
        .map(normalizeEmail)
    : [];
  const widgetRaw = record["widgetIds"];
  const widgetIds = Array.isArray(widgetRaw)
    ? widgetRaw.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];
  const sendsRaw = record["sends"];
  const sends: InsightDigestSend[] = [];
  if (Array.isArray(sendsRaw)) {
    for (const send of sendsRaw) {
      const row = asRecord(send);
      if (!row) continue;
      const at = asString(row["at"]);
      if (!at) continue;
      sends.push({
        at,
        status: row["status"] === "failed" ? "failed" : "delivered",
        error: typeof row["error"] === "string" ? row["error"] : null,
        test: row["test"] === true,
      });
    }
  }
  const cadence = record["cadence"];
  const format = record["format"];
  const period = record["period"];
  const weekday = asString(record["weekday"], "mon");
  const time = /^\d{2}:\d{2}$/.test(asString(record["time"])) ? asString(record["time"]) : "08:00";
  const timezone = INSIGHT_DIGEST_TIMEZONES.includes(
    asString(record["timezone"]) as (typeof INSIGHT_DIGEST_TIMEZONES)[number],
  )
    ? asString(record["timezone"])
    : "UTC";
  const monthDayRaw = record["monthDay"];
  return {
    id: asString(record["id"], fallbackId),
    name,
    sourceSlug: asString(record["sourceSlug"], "dashboard"),
    enabled: record["enabled"] !== false,
    includeAlerts: record["includeAlerts"] !== false,
    includeKpis: record["includeKpis"] !== false,
    widgetIds,
    period: period === "ytd" || period === "12m" ? period : "30d",
    format: format === "inline-csv" || format === "link" ? format : "inline",
    recipients,
    cadence: cadence === "daily" || cadence === "monthly" ? cadence : "weekly",
    weekday: INSIGHT_DIGEST_WEEKDAYS.some((row) => row.value === weekday) ? weekday : "mon",
    monthDay:
      typeof monthDayRaw === "number" && monthDayRaw >= 1 && monthDayRaw <= 28 ? monthDayRaw : 1,
    time,
    timezone,
    createdAt: asString(record["createdAt"], new Date().toISOString()),
    sends,
  };
}

export function digestList(state: InsightDigestState): InsightDigest[] {
  return Object.values(state["items"]).sort((left, right) =>
    left.createdAt.localeCompare(right.createdAt),
  );
}

export function scheduleLabel(digest: InsightDigest): string {
  const zone = digest.timezone.replace(/_/g, " ");
  if (digest.cadence === "daily") return `Daily, ${digest.time} ${zone}`;
  if (digest.cadence === "monthly") {
    return `${digest.monthDay} of month, ${digest.time} ${zone}`;
  }
  const day =
    INSIGHT_DIGEST_WEEKDAYS.find((row) => row.value === digest.weekday)?.label ?? "Monday";
  return `Every ${day}, ${digest.time} ${zone}`;
}

function zonedParts(
  date: Date,
  timeZone: string,
): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const read = (type: string) => parts.find((part) => part.type === type)?.value ?? "0";
  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday: weekdayMap[read("weekday")] ?? 0,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function wallTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timeZone: string,
): Date {
  let guess = Date.UTC(year, month - 1, day, hour, minute);
  for (let index = 0; index < 4; index += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const actual = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const desired = Date.UTC(year, month - 1, day, hour, minute);
    const delta = desired - actual;
    if (delta === 0) break;
    guess += delta;
  }
  return new Date(guess);
}

export function nextSendAt(digest: InsightDigest, now = new Date()): Date | null {
  if (!digest.enabled) return null;
  const [hourText, minuteText] = digest.time.split(":");
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const weekdayJs = INSIGHT_DIGEST_WEEKDAYS.find((row) => row.value === digest.weekday)?.js ?? 1;
  for (let offset = 0; offset < 62; offset += 1) {
    const probe = new Date(now.getTime() + offset * 24 * 60 * 60 * 1000);
    const parts = zonedParts(probe, digest.timezone);
    const matches =
      digest.cadence === "daily" ||
      (digest.cadence === "weekly" && parts.weekday === weekdayJs) ||
      (digest.cadence === "monthly" && parts.day === digest.monthDay);
    if (!matches) continue;
    const candidate = wallTimeToUtc(
      parts.year,
      parts.month,
      parts.day,
      hour,
      minute,
      digest.timezone,
    );
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  return null;
}

export function lastSend(digest: InsightDigest): InsightDigestSend | null {
  if (digest.sends.length === 0) return null;
  return [...digest.sends].sort((left, right) => right.at.localeCompare(left.at))[0] ?? null;
}

export function digestStatus(
  digest: InsightDigest,
): "delivered" | "failed" | "paused" | "scheduled" {
  if (!digest.enabled) return "paused";
  const latest = lastSend(digest);
  if (!latest) return "scheduled";
  return latest.status;
}

export type HistoryCell = "delivered" | "failed" | "empty";

export function historyCells(digest: InsightDigest, now = new Date(), days = 30): HistoryCell[] {
  const byDay = new Map<string, HistoryCell>();
  for (const send of digest.sends) {
    const day = send.at.slice(0, 10);
    const current = byDay.get(day);
    if (send.status === "failed") {
      byDay.set(day, "failed");
    } else if (current !== "failed") {
      byDay.set(day, "delivered");
    }
  }
  const cells: HistoryCell[] = [];
  for (let index = days - 1; index >= 0; index -= 1) {
    const day = new Date(now.getTime() - index * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    cells.push(byDay.get(day) ?? "empty");
  }
  return cells;
}

export function projectDigestSummary(
  digests: InsightDigest[],
  domains: string[],
  now = new Date(),
): {
  total: number;
  enabled: number;
  paused: number;
  sendsThisMonth: number;
  deliveredThisMonth: number;
  recipients: number;
  outsideDomain: number;
  nextSendAt: string | null;
  nextSendName: string | null;
  failing: number;
} {
  const monthPrefix = now.toISOString().slice(0, 7);
  const emails = new Set<string>();
  let sendsThisMonth = 0;
  let deliveredThisMonth = 0;
  let failing = 0;
  let next: { at: Date; name: string } | null = null;
  for (const digest of digests) {
    for (const email of digest.recipients) emails.add(email);
    if (!digest.enabled) {
      /* paused counted below */
    }
    const latest = lastSend(digest);
    if (digest.enabled && latest?.status === "failed") failing += 1;
    for (const send of digest.sends) {
      if (!send.at.startsWith(monthPrefix)) continue;
      sendsThisMonth += 1;
      if (send.status === "delivered") deliveredThisMonth += 1;
    }
    const upcoming = nextSendAt(digest, now);
    if (upcoming && (!next || upcoming.getTime() < next.at.getTime())) {
      next = { at: upcoming, name: digest.name };
    }
  }
  const outsideDomain = [...emails].filter((email) => isOutsideDomain(email, domains)).length;
  return {
    total: digests.length,
    enabled: digests.filter((item) => item.enabled).length,
    paused: digests.filter((item) => !item.enabled).length,
    sendsThisMonth,
    deliveredThisMonth,
    recipients: emails.size,
    outsideDomain,
    nextSendAt: next?.at.toISOString() ?? null,
    nextSendName: next?.name ?? null,
    failing,
  };
}

export type InsightDigestDraft = {
  name: string;
  sourceSlug: string;
  enabled?: boolean;
  includeAlerts: boolean;
  includeKpis: boolean;
  widgetIds: string[];
  period: InsightDigestPeriod;
  format: InsightDigestFormat;
  recipients: string[];
  cadence: InsightDigestCadence;
  weekday: string;
  monthDay?: number | undefined;
  time: string;
  timezone: string;
};

export function contentsLabel(digest: InsightDigest): string {
  const bits: string[] = [];
  if (digest.includeKpis) bits.push("KPIs");
  if (digest.widgetIds.length > 0) bits.push(`${digest.widgetIds.length} widgets`);
  if (digest.includeAlerts) bits.push("alerts included");
  else bits.push("no alerts");
  if (digest.format === "inline-csv") bits.push("CSV attached");
  if (digest.format === "link") bits.push("link only");
  return bits.join(", ") || "Scheduled snapshot";
}

/** KPI inclusion is independent of chart `widgetIds`. Empty `widgetIds` means every chart. */
export function digestPreviewSelection(
  widgets: Array<{ id: string; defaultViz: string }>,
  options: { includeKpis: boolean; widgetIds: string[] },
): { kpiIds: string[]; chartIds: string[] } {
  const selected = new Set(options.widgetIds);
  const kpiIds = options.includeKpis
    ? widgets
        .filter((widget) => widget.defaultViz === "kpi")
        .slice(0, 8)
        .map((widget) => widget.id)
    : [];
  const charts = widgets.filter((widget) => widget.defaultViz !== "kpi");
  const chartIds = (
    selected.size === 0 ? charts : charts.filter((widget) => selected.has(widget.id))
  )
    .slice(0, 4)
    .map((widget) => widget.id);
  return { kpiIds, chartIds };
}

export function projectDigestItem(
  digest: InsightDigest,
  args: { sourceTitle: string; domains: string[]; now?: Date },
): {
  id: string;
  name: string;
  sourceSlug: string;
  sourceTitle: string;
  enabled: boolean;
  includeAlerts: boolean;
  includeKpis: boolean;
  widgetIds: string[];
  period: InsightDigestPeriod;
  format: InsightDigestFormat;
  recipients: Array<{ email: string; initials: string; outsideDomain: boolean }>;
  cadence: InsightDigestCadence;
  weekday: string;
  monthDay: number;
  time: string;
  timezone: string;
  createdAt: string;
  scheduleLabel: string;
  contentsLabel: string;
  status: ReturnType<typeof digestStatus>;
  lastError: string | null;
  nextSendAt: string | null;
  history: HistoryCell[];
  sends: InsightDigestSend[];
} {
  const now = args.now ?? new Date();
  const latest = lastSend(digest);
  const upcoming = nextSendAt(digest, now);
  return {
    id: digest.id,
    name: digest.name,
    sourceSlug: digest.sourceSlug,
    sourceTitle: args.sourceTitle,
    enabled: digest.enabled,
    includeAlerts: digest.includeAlerts,
    includeKpis: digest.includeKpis,
    widgetIds: digest.widgetIds,
    period: digest.period,
    format: digest.format,
    recipients: digest.recipients.map((email) => ({
      email,
      initials: recipientInitials(email),
      outsideDomain: isOutsideDomain(email, args.domains),
    })),
    cadence: digest.cadence,
    weekday: digest.weekday,
    monthDay: digest.monthDay,
    time: digest.time,
    timezone: digest.timezone,
    createdAt: digest.createdAt,
    scheduleLabel: scheduleLabel(digest),
    contentsLabel: contentsLabel(digest),
    status: digestStatus(digest),
    lastError: latest?.status === "failed" ? latest.error : null,
    nextSendAt: upcoming?.toISOString() ?? null,
    history: historyCells(digest, now),
    sends: digest.sends,
  };
}

export function createDigest(draft: InsightDigestDraft, now = new Date()): InsightDigest {
  return {
    id: `dg_${now.getTime().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    name: draft.name.trim(),
    sourceSlug: draft.sourceSlug,
    enabled: draft.enabled !== false,
    includeAlerts: draft.includeAlerts,
    includeKpis: draft.includeKpis,
    widgetIds: draft.widgetIds,
    period: draft.period,
    format: draft.format,
    recipients: [...new Set(draft.recipients.map(normalizeEmail).filter(isValidEmail))],
    cadence: draft.cadence,
    weekday: draft.weekday,
    monthDay: draft.monthDay ?? 1,
    time: draft.time,
    timezone: draft.timezone,
    createdAt: now.toISOString(),
    sends: [],
  };
}

export function applyDigestMutation(
  state: InsightDigestState,
  action:
    | { type: "create"; digest: InsightDigest }
    | { type: "update"; id: string; digest: InsightDigest }
    | { type: "delete"; id: string }
    | { type: "toggle"; id: string; enabled: boolean }
    | {
        type: "send-test";
        id: string;
        at: string;
        status: InsightDigestSendStatus;
        error?: string | null;
      },
): InsightDigestState {
  const items = { ...state["items"] };
  if (action.type === "create") {
    items[action.digest.id] = action.digest;
    return { items };
  }
  const existing = items[action.id];
  if (!existing) return state;
  if (action.type === "delete") {
    const next: Record<string, InsightDigest> = {};
    for (const [key, value] of Object.entries(items)) {
      if (key !== action.id) next[key] = value;
    }
    return { items: next };
  }
  if (action.type === "toggle") {
    items[action.id] = { ...existing, enabled: action.enabled };
    return { items };
  }
  if (action.type === "send-test") {
    items[action.id] = {
      ...existing,
      sends: [
        ...existing.sends,
        { at: action.at, status: action.status, error: action.error ?? null, test: true },
      ],
    };
    return { items };
  }
  items[action.id] = {
    ...action.digest,
    id: existing.id,
    createdAt: existing.createdAt,
    sends: existing.sends,
  };
  return { items };
}
