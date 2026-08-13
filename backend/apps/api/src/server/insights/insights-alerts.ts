export type InsightAlertSeverity = "info" | "warning" | "critical";

export type InsightAlertRuleIcon =
  | "payments"
  | "inbox"
  | "live"
  | "users"
  | "trend"
  | "moderation"
  | "course"
  | "campaign"
  | "message"
  | "activity"
  | "security";

export type InsightAlertMetrics = Record<string, number>;

export type InsightAlertRuleDef = {
  id: string;
  slug: string;
  title: string;
  icon: InsightAlertRuleIcon;
  source: string;
  defaultEnabled: boolean;
  defaultThreshold: number;
  min: number;
  max: number;
  thresholdKind: "count" | "percent" | "none";
  description: string;
  declaredSeverities?: InsightAlertSeverity[];
  evaluate: (
    metrics: InsightAlertMetrics,
    threshold: number,
  ) => {
    firing: boolean;
    severity: InsightAlertSeverity;
    message: string;
    href: string | null;
    value: number;
  };
};

export type InsightAlertFiring = {
  ruleId: string;
  severity: InsightAlertSeverity;
  title: string;
  message: string;
  href: string | null;
  source: string;
  value: number;
  fingerprint: string;
};

export type InsightAlertPersistedItem = {
  firstSeenAt: string;
  lastSeenAt: string;
  seenAt: string | null;
  mutedUntil: string | null;
  resolvedAt: string | null;
  resolvedByLabel: string | null;
  fingerprint: string;
  openedSeverity: InsightAlertSeverity | null;
  peakSeverity: InsightAlertSeverity | null;
};

export type InsightAlertPersistedState = {
  rules: Record<string, { enabled: boolean; threshold: number }>;
  items: Record<string, InsightAlertPersistedItem>;
};

export type InsightAlertItemStatus = "open" | "resolved" | "muted";

export type InsightAlertBoardItem = {
  id: string;
  ruleId: string;
  severity: InsightAlertSeverity;
  title: string;
  message: string;
  href: string | null;
  source: string;
  status: InsightAlertItemStatus;
  firstSeenAt: string;
  lastSeenAt: string;
  seenAt: string | null;
  mutedUntil: string | null;
  resolvedAt: string | null;
  resolvedByLabel: string | null;
  durationSeconds: number | null;
  openedSeverity: InsightAlertSeverity | null;
  peakSeverity: InsightAlertSeverity | null;
};

export type InsightAlertRuleCard = {
  id: string;
  title: string;
  description: string;
  icon: InsightAlertRuleIcon;
  source: string;
  enabled: boolean;
  threshold: number;
  thresholdKind: "count" | "percent" | "none";
  min: number;
  max: number;
  lastFiredAt: string | null;
  health: "healthy" | "firing" | "disabled";
  severities: InsightAlertSeverity[];
  currentValue: number;
  currentCaption: string | null;
};

export type InsightAlertSummary = {
  open: number;
  critical: number;
  warning: number;
  info: number;
  newSinceYesterday: number;
  resolvedThisWeek: number;
  muted: number;
};

function metric(metrics: InsightAlertMetrics, key: string): number {
  return metrics[key] ?? 0;
}

function plural(count: number, singular: string, pluralForm?: string): string {
  return count === 1 ? singular : (pluralForm ?? `${singular}s`);
}

function dropPct(current: number, previous: number): number {
  if (previous <= 0) return 0;
  return Math.round(((previous - current) / previous) * 1000) / 10;
}

function uniqueSeverities(
  rule: InsightAlertRuleDef,
  metrics: InsightAlertMetrics,
): InsightAlertSeverity[] {
  if (rule.declaredSeverities && rule.declaredSeverities.length > 0) {
    const declared = new Set(rule.declaredSeverities);
    return (["critical", "warning", "info"] as const).filter((severity) => declared.has(severity));
  }
  const seen = new Set<InsightAlertSeverity>();
  for (const threshold of [rule.min, rule.defaultThreshold, rule.max]) {
    seen.add(rule.evaluate(metrics, threshold).severity);
  }
  return (["critical", "warning", "info"] as const).filter((severity) => seen.has(severity));
}

function severityRank(severity: InsightAlertSeverity): number {
  if (severity === "critical") return 2;
  if (severity === "warning") return 1;
  return 0;
}

function higherSeverity(
  left: InsightAlertSeverity,
  right: InsightAlertSeverity,
): InsightAlertSeverity {
  return severityRank(left) >= severityRank(right) ? left : right;
}

function severityFromFingerprint(fingerprint: string): InsightAlertSeverity {
  if (fingerprint.startsWith("critical")) return "critical";
  if (fingerprint.startsWith("warning")) return "warning";
  return "info";
}

function insightRuleCaption(
  rule: InsightAlertRuleDef,
  reading: { firing: boolean; severity: InsightAlertSeverity; value: number },
): string | null {
  if (rule.slug === "sales-insight") {
    if (rule.id === "failed-payments") {
      if (!reading.firing) return "Current data would not produce an alert.";
      return `Current data would produce 1 ${reading.severity} alert.`;
    }
    if (rule.id === "pending-orders") {
      if (!reading.firing) return "No pending orders at or above the threshold.";
      return "Current data would produce 1 info alert.";
    }
    if (rule.id === "low-conversion") {
      return `Current 30-day rate is ${reading.value}%.`;
    }
    return null;
  }
  if (rule.slug === "marketing-insight") {
    if (rule.id === "no-form-submissions-30d") {
      if (!reading.firing) return "Current data would not produce an alert.";
      return "Current data would produce 1 warning alert.";
    }
    if (rule.id === "low-cta-click-rate") {
      return `Current click-through rate is ${reading.value}%.`;
    }
  }
  if (rule.slug === "messenger-insight") {
    if (rule.id === "whatsapp-failures") {
      if (!reading.firing) return "Current data would not produce an alert.";
      return `Current data would produce 1 ${reading.severity} alert.`;
    }
  }
  return null;
}

export const INSIGHT_ALERT_RULES: InsightAlertRuleDef[] = [
  {
    id: "failed-payments",
    slug: "dashboard",
    title: "Failed payments spike",
    icon: "payments",
    source: "Dashboard",
    defaultEnabled: true,
    defaultThreshold: 10,
    min: 1,
    max: 500,
    thresholdKind: "count",
    description:
      "Raise a warning when any payment fails; escalate to critical if {threshold} or more fail in the selected range.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "failedPayments");
      return {
        firing: count > 0,
        severity: count >= threshold ? "critical" : "warning",
        message: `${count} payment${plural(count, "", "s")} failed recently. Recover revenue from Reports → Payments.`,
        href: "/admin/reports/payments",
        value: count,
      };
    },
  },
  {
    id: "pending-tasks",
    slug: "dashboard",
    title: "Stalled ops queue",
    icon: "inbox",
    source: "Admin Console",
    defaultEnabled: true,
    defaultThreshold: 8,
    min: 1,
    max: 200,
    thresholdKind: "count",
    description:
      "Raise a warning when pending reviews, moderation, deletions, and course reviews exceed {threshold}.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "pendingTasks");
      return {
        firing: count > 0,
        severity: count >= threshold * 2 ? "critical" : count >= threshold ? "warning" : "info",
        message: `${count} open ops ${plural(count, "item")} (reviews, moderation, deletions, or course reviews).`,
        href: "/admin/moderation/cases",
        value: count,
      };
    },
  },
  {
    id: "enrollment-drop",
    slug: "dashboard",
    title: "Enrollment drop-off",
    icon: "trend",
    source: "Dashboard",
    defaultEnabled: true,
    defaultThreshold: 40,
    min: 5,
    max: 95,
    thresholdKind: "percent",
    description:
      "Raise a warning when enrollments fall {threshold}% or more versus the previous period.",
    evaluate: (metrics, threshold) => {
      const current = metric(metrics, "enrollmentsInRange");
      const previous = metric(metrics, "previousEnrollmentsInRange");
      const drop = dropPct(current, previous);
      return {
        firing: previous > 0 && drop >= threshold,
        severity: drop >= threshold + 20 ? "critical" : "warning",
        message: `Enrollments dropped ${drop}% versus the previous period (${current} vs ${previous}).`,
        href: "/admin/reports/enrollments",
        value: drop,
      };
    },
  },
  {
    id: "revenue-drop",
    slug: "dashboard",
    title: "Revenue drop",
    icon: "payments",
    source: "Dashboard",
    defaultEnabled: true,
    defaultThreshold: 25,
    min: 5,
    max: 95,
    thresholdKind: "percent",
    description:
      "Raise a warning when paid revenue falls {threshold}% or more versus the previous period.",
    evaluate: (metrics, threshold) => {
      const current = metric(metrics, "paidRevenueInRange");
      const previous = metric(metrics, "previousPaidRevenue");
      const drop = dropPct(current, previous);
      return {
        firing: previous > 0 && drop >= threshold,
        severity: drop >= threshold + 20 ? "critical" : "warning",
        message: `Paid revenue dropped ${drop}% versus the previous period.`,
        href: "/admin/reports/payments",
        value: drop,
      };
    },
  },
  {
    id: "upcoming-live",
    slug: "dashboard",
    title: "Upcoming live classes",
    icon: "live",
    source: "Live",
    defaultEnabled: true,
    defaultThreshold: 1,
    min: 1,
    max: 50,
    thresholdKind: "count",
    description:
      "Raise an info notice when {threshold} or more live sessions are scheduled or live.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "upcomingLive");
      return {
        firing: count >= threshold,
        severity: "info",
        message: `${count} live session${plural(count, "", "s")} scheduled or live.`,
        href: "/admin/live-sessions",
        value: count,
      };
    },
  },
  {
    id: "no-learning-activity",
    slug: "school-vitals",
    title: "No learning activity",
    icon: "activity",
    source: "School Vitals",
    defaultEnabled: true,
    defaultThreshold: 0,
    min: 0,
    max: 0,
    thresholdKind: "none",
    description:
      "Raise an info notice when no lessons, assessments, practice, or community events are recorded.",
    evaluate: (metrics) => {
      const activity = metric(metrics, "learningActivity");
      return {
        firing: activity <= 0,
        severity: "info",
        message:
          "No lessons, assessments, practice, or community events recorded in the last 30 days.",
        href: "/admin/analytics",
        value: activity,
      };
    },
  },
  {
    id: "inactive-learners",
    slug: "school-vitals",
    title: "Inactive learners",
    icon: "users",
    source: "School Vitals",
    defaultEnabled: true,
    defaultThreshold: 25,
    min: 1,
    max: 500,
    thresholdKind: "count",
    description: "Raise a warning when {threshold} or more learners are inactive for 30+ days.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "inactiveLearners");
      return {
        firing: count > 0,
        severity: count >= threshold ? "warning" : "info",
        message: `${count} learner${plural(count, "", "s")} inactive for 30+ days.`,
        href: "/admin/reports/resource-usage/inactive-learners",
        value: count,
      };
    },
  },
  {
    id: "dormant-courses",
    slug: "school-vitals",
    title: "Dormant courses",
    icon: "course",
    source: "School Vitals",
    defaultEnabled: true,
    defaultThreshold: 1,
    min: 1,
    max: 100,
    thresholdKind: "count",
    description:
      "Raise an info notice when {threshold} or more published courses have no learner activity in 30 days.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "dormantCourses");
      return {
        firing: count >= threshold,
        severity: "info",
        message: `${count} published course${plural(count, "", "s")} with no learner activity in 30 days.`,
        href: "/admin/reports/resource-usage/dormant",
        value: count,
      };
    },
  },
  {
    id: "open-moderation",
    slug: "school-vitals",
    title: "Open moderation",
    icon: "moderation",
    source: "School Vitals",
    defaultEnabled: true,
    defaultThreshold: 5,
    min: 1,
    max: 100,
    thresholdKind: "count",
    description: "Raise a warning when open moderation cases reach {threshold}.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "openModeration");
      return {
        firing: count > 0,
        severity: count >= threshold ? "warning" : "info",
        message: `${count} moderation case${plural(count, "", "s")} open or reviewing.`,
        href: "/admin/moderation/cases",
        value: count,
      };
    },
  },
  {
    id: "low-pass-rate",
    slug: "school-vitals",
    title: "Low assessment pass rate",
    icon: "trend",
    source: "School Vitals",
    defaultEnabled: true,
    defaultThreshold: 50,
    min: 5,
    max: 95,
    thresholdKind: "percent",
    description:
      "Raise a warning when the assessment pass rate falls below {threshold}% (with at least 5 submissions).",
    evaluate: (metrics, threshold) => {
      const submitted = metric(metrics, "assessmentsSubmitted");
      const passRate = metric(metrics, "passRate");
      return {
        firing: submitted >= 5 && passRate < threshold,
        severity: "warning",
        message: `Only ${passRate}% of assessments passed in the last 30 days.`,
        href: "/admin/reports/progress-score",
        value: passRate,
      };
    },
  },
  {
    id: "failed-payments",
    slug: "sales-insight",
    title: "Failed payments",
    icon: "payments",
    source: "Sales",
    defaultEnabled: true,
    defaultThreshold: 10,
    min: 1,
    max: 500,
    thresholdKind: "count",
    description: "Raise a warning on any failed payment; escalate to critical at {threshold}.",
    declaredSeverities: ["warning", "critical"],
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "failedPayments");
      return {
        firing: count > 0,
        severity: count >= threshold ? "critical" : "warning",
        message: `${count} payment${plural(count, "", "s")} failed recently. Recover revenue from Reports → Payments.`,
        href: "/admin/reports/payments",
        value: count,
      };
    },
  },
  {
    id: "pending-orders",
    slug: "sales-insight",
    title: "Pending orders",
    icon: "payments",
    source: "Sales",
    defaultEnabled: true,
    defaultThreshold: 1,
    min: 1,
    max: 200,
    thresholdKind: "count",
    description: "Raise an info notice when {threshold} or more orders are pending or processing.",
    declaredSeverities: ["info"],
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "pendingOrders");
      return {
        firing: count >= threshold,
        severity: "info",
        message: `${count} order${plural(count, "", "s")} ${count === 1 ? "is" : "are"} pending or processing.`,
        href: "/admin/reports/payments",
        value: count,
      };
    },
  },
  {
    id: "low-conversion",
    slug: "sales-insight",
    title: "Low conversion (30d)",
    icon: "trend",
    source: "Sales",
    defaultEnabled: true,
    defaultThreshold: 5,
    min: 1,
    max: 50,
    thresholdKind: "percent",
    description:
      "Raise a warning when visit-to-enrollment conversion is below {threshold}% (with at least 10 visits).",
    declaredSeverities: ["warning"],
    evaluate: (metrics, threshold) => {
      const visited = metric(metrics, "pipelineVisited");
      const conversion = metric(metrics, "conversionRate");
      return {
        firing: visited >= 10 && conversion < threshold,
        severity: "warning",
        message: `${conversion}% of visitors enrolled, below your ${threshold}% threshold.`,
        href: "/admin/insights/sales-insight/pipeline",
        value: conversion,
      };
    },
  },
  {
    id: "low-attendance",
    slug: "live-dashboard",
    title: "Low attendance sessions",
    icon: "live",
    source: "Live",
    defaultEnabled: true,
    defaultThreshold: 1,
    min: 1,
    max: 50,
    thresholdKind: "count",
    description:
      "Raise a warning when {threshold} or more ended sessions fall below 50% attendance.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "lowAttendanceSessions");
      return {
        firing: count >= threshold,
        severity: "warning",
        message: `${count} ended session${plural(count, "", "s")} below 50% attendance.`,
        href: "/admin/reports/live-class-attendance",
        value: count,
      };
    },
  },
  {
    id: "upcoming-live",
    slug: "live-dashboard",
    title: "Upcoming live classes",
    icon: "live",
    source: "Live",
    defaultEnabled: true,
    defaultThreshold: 1,
    min: 1,
    max: 50,
    thresholdKind: "count",
    description: "Raise an info notice when {threshold} or more sessions are scheduled.",
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "upcomingLive");
      return {
        firing: count >= threshold,
        severity: "info",
        message: `${count} scheduled session${plural(count, "", "s")} coming up.`,
        href: "/admin/live-sessions",
        value: count,
      };
    },
  },
  {
    id: "no-form-submissions-30d",
    slug: "marketing-insight",
    title: "No form submissions (30d)",
    icon: "campaign",
    source: "Marketing",
    defaultEnabled: true,
    defaultThreshold: 1,
    min: 1,
    max: 20,
    thresholdKind: "count",
    description:
      "Raise a warning when live forms exist but submissions in 30 days are below {threshold}.",
    evaluate: (metrics, threshold) => {
      const liveForms = metric(metrics, "liveForms");
      const submissions = metric(metrics, "submissions30d");
      return {
        firing: liveForms >= threshold && submissions === 0,
        severity: "warning",
        message: `${liveForms} live form${plural(liveForms, "", "s")} but no submissions in the last 30 days.`,
        href: "/admin/marketing/forms",
        value: submissions,
      };
    },
  },
  {
    id: "low-cta-click-rate",
    slug: "marketing-insight",
    title: "Low CTA click rate",
    icon: "campaign",
    source: "Marketing",
    defaultEnabled: true,
    defaultThreshold: 5,
    min: 1,
    max: 50,
    thresholdKind: "percent",
    description:
      "Raise a warning when CTA click-through is below {threshold}% (with at least 20 views).",
    evaluate: (metrics, threshold) => {
      const views = metric(metrics, "ctaViews");
      const rate = metric(metrics, "ctaClickRate");
      const liveCtas = metric(metrics, "liveCtas");
      return {
        firing: liveCtas > 0 && views >= 20 && rate < threshold,
        severity: "warning",
        message: `CTAs are averaging ${rate}% click-through. Review targeting and creative.`,
        href: "/admin/marketing/cta",
        value: rate,
      };
    },
  },
  {
    id: "whatsapp-failures",
    slug: "messenger-insight",
    title: "WhatsApp delivery failures",
    icon: "message",
    source: "Messenger",
    defaultEnabled: true,
    defaultThreshold: 10,
    min: 1,
    max: 200,
    thresholdKind: "count",
    description: "Notify on any failed send; raise it to a warning at {threshold} or more.",
    declaredSeverities: ["info", "warning"],
    evaluate: (metrics, threshold) => {
      const count = metric(metrics, "whatsappFailed");
      return {
        firing: count > 0,
        severity: count >= threshold ? "warning" : "info",
        message: `${count} failed WhatsApp send${plural(count, "", "s")} across campaigns.`,
        href: "/admin/insights/messenger-insight/whatsapp",
        value: count,
      };
    },
  },
  {
    id: "whatsapp-disconnected",
    slug: "messenger-insight",
    title: "WhatsApp not connected",
    icon: "security",
    source: "Messenger",
    defaultEnabled: true,
    defaultThreshold: 0,
    min: 0,
    max: 0,
    thresholdKind: "none",
    description: "Fires whenever the integration is disconnected.",
    declaredSeverities: ["info"],
    evaluate: (metrics) => {
      const connected = metric(metrics, "whatsappConnected");
      const sent = metric(metrics, "whatsappSent");
      const firing = connected === 0;
      return {
        firing,
        severity: "info",
        message:
          sent > 0
            ? "Live syncing is paused. WhatsApp metrics shown are historical and read-only until you reconnect."
            : "Connect WhatsApp Business to send template campaigns and track delivery.",
        href: "/admin/insights/messenger-insight/whatsapp",
        value: connected,
      };
    },
  },
];

export function rulesForSlug(slug: string): InsightAlertRuleDef[] {
  return INSIGHT_ALERT_RULES.filter((rule) => rule.slug === slug);
}

export function findInsightAlertRule(slug: string, ruleId: string): InsightAlertRuleDef | null {
  return INSIGHT_ALERT_RULES.find((rule) => rule.slug === slug && rule.id === ruleId) ?? null;
}

export function alertItemKey(slug: string, ruleId: string): string {
  return `${slug}:${ruleId}`;
}

export function emptyInsightAlertState(): InsightAlertPersistedState {
  return { rules: {}, items: {} };
}

export function parseInsightAlertState(raw: unknown): InsightAlertPersistedState {
  if (!raw || typeof raw !== "object") return emptyInsightAlertState();
  const record = raw as Record<string, unknown>;
  const rulesRaw = record["rules"];
  const itemsRaw = record["items"];
  const rules: InsightAlertPersistedState["rules"] = {};
  const items: InsightAlertPersistedState["items"] = {};

  if (rulesRaw && typeof rulesRaw === "object") {
    for (const [key, value] of Object.entries(rulesRaw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const thresholdRaw = row["threshold"];
      const threshold =
        typeof thresholdRaw === "number" && Number.isFinite(thresholdRaw) ? thresholdRaw : null;
      rules[key] = {
        enabled: row["enabled"] !== false,
        threshold: threshold ?? 0,
      };
    }
  }

  if (itemsRaw && typeof itemsRaw === "object") {
    for (const [key, value] of Object.entries(itemsRaw as Record<string, unknown>)) {
      if (!value || typeof value !== "object") continue;
      const row = value as Record<string, unknown>;
      const firstSeenAt = row["firstSeenAt"];
      const lastSeenAt = row["lastSeenAt"];
      if (typeof firstSeenAt !== "string" || typeof lastSeenAt !== "string") continue;
      const seenAt = row["seenAt"];
      const mutedUntil = row["mutedUntil"];
      const resolvedAt = row["resolvedAt"];
      const resolvedByLabel = row["resolvedByLabel"];
      const fingerprint = row["fingerprint"];
      const openedSeverityRaw = row["openedSeverity"];
      const peakSeverityRaw = row["peakSeverity"];
      const openedSeverity =
        openedSeverityRaw === "critical" ||
        openedSeverityRaw === "warning" ||
        openedSeverityRaw === "info"
          ? openedSeverityRaw
          : null;
      const peakSeverity =
        peakSeverityRaw === "critical" ||
        peakSeverityRaw === "warning" ||
        peakSeverityRaw === "info"
          ? peakSeverityRaw
          : null;
      items[key] = {
        firstSeenAt,
        lastSeenAt,
        seenAt: typeof seenAt === "string" ? seenAt : null,
        mutedUntil: typeof mutedUntil === "string" ? mutedUntil : null,
        resolvedAt: typeof resolvedAt === "string" ? resolvedAt : null,
        resolvedByLabel: typeof resolvedByLabel === "string" ? resolvedByLabel : null,
        fingerprint: typeof fingerprint === "string" ? fingerprint : "",
        openedSeverity,
        peakSeverity,
      };
    }
  }

  return { rules, items };
}

function ruleConfig(
  slug: string,
  rule: InsightAlertRuleDef,
  state: InsightAlertPersistedState,
): { enabled: boolean; threshold: number } {
  const stored = state.rules[alertItemKey(slug, rule.id)];
  const threshold =
    stored?.threshold && stored.threshold > 0 ? stored.threshold : rule.defaultThreshold;
  const clamped = Math.min(rule.max, Math.max(rule.min, threshold));
  return {
    enabled: stored?.enabled ?? rule.defaultEnabled,
    threshold: rule.thresholdKind === "none" ? rule.defaultThreshold : clamped,
  };
}

function isMuted(mutedUntil: string | null, now: Date): boolean {
  if (!mutedUntil) return false;
  if (mutedUntil === "forever") return true;
  const until = new Date(mutedUntil);
  if (Number.isNaN(until.getTime())) return false;
  return until.getTime() > now.getTime();
}

function startOfYesterdayUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
}

function weekAgo(now: Date): Date {
  return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
}

function durationSeconds(fromIso: string, toIso: string | null, now: Date): number | null {
  const from = new Date(fromIso);
  const to = toIso ? new Date(toIso) : now;
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null;
  return Math.max(0, Math.round((to.getTime() - from.getTime()) / 1000));
}

export function fillRuleDescription(
  description: string,
  threshold: number,
  kind: InsightAlertRuleDef["thresholdKind"],
): string {
  if (kind === "none") return description.replace("{threshold}", "the configured");
  const label = kind === "percent" ? `${threshold}%` : String(threshold);
  return description.replace("{threshold}", label);
}

export function evaluateInsightAlertRules(
  slug: string,
  metrics: InsightAlertMetrics,
  state: InsightAlertPersistedState,
): InsightAlertFiring[] {
  const firings: InsightAlertFiring[] = [];
  for (const rule of rulesForSlug(slug)) {
    const config = ruleConfig(slug, rule, state);
    if (!config.enabled) continue;
    const result = rule.evaluate(metrics, config.threshold);
    if (!result.firing) continue;
    firings.push({
      ruleId: rule.id,
      severity: result.severity,
      title: rule.title,
      message: result.message,
      href: result.href,
      source: rule.source,
      value: result.value,
      fingerprint: `${result.severity}:${result.value}`,
    });
  }
  return firings;
}

export function projectInsightAlertBoard(args: {
  slug: string;
  metrics: InsightAlertMetrics;
  state: InsightAlertPersistedState;
  now?: Date;
  autoResolveLabel?: string;
}): {
  items: InsightAlertBoardItem[];
  rules: InsightAlertRuleCard[];
  summary: InsightAlertSummary;
  nextState: InsightAlertPersistedState;
} {
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const autoResolveLabel = args.autoResolveLabel ?? "Automatically";
  const slug = args.slug;
  const nextItems: InsightAlertPersistedState["items"] = { ...args.state.items };
  const firingByRule = new Map(
    evaluateInsightAlertRules(slug, args.metrics, args.state).map((firing) => [
      firing.ruleId,
      firing,
    ]),
  );

  const items: InsightAlertBoardItem[] = [];

  for (const rule of rulesForSlug(slug)) {
    const key = alertItemKey(slug, rule.id);
    const firing = firingByRule.get(rule.id) ?? null;
    const previous = nextItems[key];

    if (firing) {
      const muted = isMuted(previous?.mutedUntil ?? null, now);
      const sameFingerprint =
        previous?.fingerprint === firing.fingerprint && previous.resolvedAt != null;
      let status: InsightAlertItemStatus = "open";
      if (muted) status = "muted";
      else if (sameFingerprint) status = "resolved";

      const firstSeenAt = previous?.firstSeenAt ?? nowIso;
      const seenAt = previous?.seenAt ?? null;
      const openedSeverity = previous?.openedSeverity ?? firing.severity;
      const peakSeverity = previous?.peakSeverity
        ? higherSeverity(previous.peakSeverity, firing.severity)
        : firing.severity;
      const persisted: InsightAlertPersistedItem = {
        firstSeenAt,
        lastSeenAt: nowIso,
        seenAt,
        mutedUntil: muted ? (previous?.mutedUntil ?? null) : null,
        resolvedAt: status === "resolved" ? (previous?.resolvedAt ?? nowIso) : null,
        resolvedByLabel: status === "resolved" ? (previous?.resolvedByLabel ?? null) : null,
        fingerprint: firing.fingerprint,
        openedSeverity,
        peakSeverity,
      };
      nextItems[key] = persisted;

      items.push({
        id: key,
        ruleId: rule.id,
        severity: firing.severity,
        title: firing.title,
        message: firing.message,
        href: firing.href,
        source: firing.source,
        status,
        firstSeenAt,
        lastSeenAt: nowIso,
        seenAt,
        mutedUntil: persisted.mutedUntil,
        resolvedAt: persisted.resolvedAt,
        resolvedByLabel: persisted.resolvedByLabel,
        durationSeconds: durationSeconds(firstSeenAt, persisted.resolvedAt, now),
        openedSeverity,
        peakSeverity,
      });
      continue;
    }

    if (!previous) continue;

    const resolvedAt = previous.resolvedAt ?? nowIso;
    const resolvedByLabel = previous.resolvedAt ? previous.resolvedByLabel : autoResolveLabel;
    const clearedSeverity = previous.peakSeverity ?? severityFromFingerprint(previous.fingerprint);
    nextItems[key] = {
      ...previous,
      lastSeenAt: previous.lastSeenAt,
      mutedUntil: null,
      resolvedAt,
      resolvedByLabel,
      openedSeverity: previous.openedSeverity ?? severityFromFingerprint(previous.fingerprint),
      peakSeverity: clearedSeverity,
    };

    const def = rule;
    items.push({
      id: key,
      ruleId: rule.id,
      severity: clearedSeverity,
      title: def.title,
      message: "Condition cleared; the metric is back within the rule threshold.",
      href: null,
      source: def.source,
      status: "resolved",
      firstSeenAt: previous.firstSeenAt,
      lastSeenAt: previous.lastSeenAt,
      seenAt: previous.seenAt,
      mutedUntil: null,
      resolvedAt,
      resolvedByLabel,
      durationSeconds: durationSeconds(previous.firstSeenAt, resolvedAt, now),
      openedSeverity: previous.openedSeverity ?? severityFromFingerprint(previous.fingerprint),
      peakSeverity: previous.peakSeverity ?? clearedSeverity,
    });
  }

  const rules: InsightAlertRuleCard[] = rulesForSlug(slug).map((rule) => {
    const key = alertItemKey(slug, rule.id);
    const config = ruleConfig(slug, rule, args.state);
    const boardItem = items.find((item) => item.ruleId === rule.id);
    const reading = rule.evaluate(args.metrics, config.threshold);
    const health: InsightAlertRuleCard["health"] = !config.enabled
      ? "disabled"
      : boardItem?.status === "open"
        ? "firing"
        : "healthy";
    return {
      id: rule.id,
      title: rule.title,
      description: fillRuleDescription(rule.description, config.threshold, rule.thresholdKind),
      icon: rule.icon,
      source: rule.source,
      enabled: config.enabled,
      threshold: config.threshold,
      thresholdKind: rule.thresholdKind,
      min: rule.min,
      max: rule.max,
      lastFiredAt:
        boardItem && boardItem.status !== "resolved"
          ? boardItem.lastSeenAt
          : (nextItems[key]?.lastSeenAt ?? null),
      health,
      severities: uniqueSeverities(rule, args.metrics),
      currentValue: reading.value,
      currentCaption: insightRuleCaption(rule, reading),
    };
  });

  const yesterday = startOfYesterdayUtc(now).toISOString();
  const week = weekAgo(now).toISOString();
  const openItems = items.filter((item) => item.status === "open");
  const summary: InsightAlertSummary = {
    open: openItems.length,
    critical: openItems.filter((item) => item.severity === "critical").length,
    warning: openItems.filter((item) => item.severity === "warning").length,
    info: openItems.filter((item) => item.severity === "info").length,
    newSinceYesterday: openItems.filter((item) => item.firstSeenAt >= yesterday).length,
    resolvedThisWeek: items.filter(
      (item) => item.status === "resolved" && item.resolvedAt != null && item.resolvedAt >= week,
    ).length,
    muted: items.filter((item) => item.status === "muted").length,
  };

  return {
    items,
    rules,
    summary,
    nextState: {
      rules: args.state.rules,
      items: nextItems,
    },
  };
}

export function applyInsightAlertMutation(args: {
  slug: string;
  state: InsightAlertPersistedState;
  action:
    | { type: "mute"; ruleId: string; muteUntil: string }
    | { type: "unmute"; ruleId: string }
    | { type: "resolve"; ruleId: string; resolvedByLabel: string }
    | { type: "mark-seen"; ruleId: string }
    | { type: "mark-all-seen" }
    | { type: "toggle-rule"; ruleId: string; enabled: boolean }
    | { type: "set-threshold"; ruleId: string; threshold: number };
  now?: Date;
}): InsightAlertPersistedState {
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const next: InsightAlertPersistedState = {
    rules: { ...args.state.rules },
    items: { ...args.state.items },
  };

  const touchItem = (ruleId: string): InsightAlertPersistedItem => {
    const key = alertItemKey(args.slug, ruleId);
    const existing = next.items[key];
    if (existing) return existing;
    const created: InsightAlertPersistedItem = {
      firstSeenAt: nowIso,
      lastSeenAt: nowIso,
      seenAt: null,
      mutedUntil: null,
      resolvedAt: null,
      resolvedByLabel: null,
      fingerprint: "",
      openedSeverity: null,
      peakSeverity: null,
    };
    next.items[key] = created;
    return created;
  };

  const action = args.action;
  if (action.type === "mute") {
    const item = touchItem(action.ruleId);
    const key = alertItemKey(args.slug, action.ruleId);
    next.items[key] = {
      ...item,
      mutedUntil: action.muteUntil,
      resolvedAt: null,
      resolvedByLabel: null,
    };
    return next;
  }
  if (action.type === "unmute") {
    const item = next.items[alertItemKey(args.slug, action.ruleId)];
    if (item) {
      next.items[alertItemKey(args.slug, action.ruleId)] = { ...item, mutedUntil: null };
    }
    return next;
  }
  if (action.type === "resolve") {
    const item = touchItem(action.ruleId);
    next.items[alertItemKey(args.slug, action.ruleId)] = {
      ...item,
      mutedUntil: null,
      resolvedAt: nowIso,
      resolvedByLabel: action.resolvedByLabel,
      seenAt: item.seenAt ?? nowIso,
    };
    return next;
  }
  if (action.type === "mark-seen") {
    const item = next.items[alertItemKey(args.slug, action.ruleId)];
    if (item) {
      next.items[alertItemKey(args.slug, action.ruleId)] = { ...item, seenAt: nowIso };
    }
    return next;
  }
  if (action.type === "mark-all-seen") {
    for (const [key, item] of Object.entries(next.items)) {
      if (item.resolvedAt || isMuted(item.mutedUntil, now)) continue;
      next.items[key] = { ...item, seenAt: nowIso };
    }
    return next;
  }
  if (action.type === "toggle-rule") {
    const rule = findInsightAlertRule(args.slug, action.ruleId);
    const key = alertItemKey(args.slug, action.ruleId);
    const current = next.rules[key];
    next.rules[key] = {
      enabled: action.enabled,
      threshold:
        current?.threshold && current.threshold > 0
          ? current.threshold
          : (rule?.defaultThreshold ?? 0),
    };
    return next;
  }

  const rule = findInsightAlertRule(args.slug, action.ruleId);
  const key = alertItemKey(args.slug, action.ruleId);
  const current = next.rules[key];
  const min = rule?.min ?? 0;
  const max = rule?.max ?? action.threshold;
  next.rules[key] = {
    enabled: current?.enabled ?? rule?.defaultEnabled ?? true,
    threshold: Math.min(max, Math.max(min, action.threshold)),
  };
  return next;
}

export function muteUntilIso(muteFor: "1d" | "7d" | "forever", now = new Date()): string {
  if (muteFor === "forever") return "forever";
  const ms = muteFor === "1d" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

export function openAlertsFromBoard(items: InsightAlertBoardItem[]): Array<{
  id: string;
  severity: InsightAlertSeverity;
  title: string;
  message: string;
  href: string | null;
}> {
  return items
    .filter((item) => item.status === "open")
    .map((item) => ({
      id: item.ruleId,
      severity: item.severity,
      title: item.title,
      message: item.message,
      href: item.href,
    }));
}
