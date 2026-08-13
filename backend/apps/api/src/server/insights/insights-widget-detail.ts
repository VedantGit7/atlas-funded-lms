import { AtlasHttpError } from "@atlas/core/http/errors";
import { computeDeltaAbs, computeDeltaPct, type InsightDashboardRange } from "./insights-range";
import type { InsightWidget, InsightWidgetDetail } from "./insights.schemas";

type DashboardLike = {
  slug: string;
  title: string;
  currency?: string | undefined;
  range?: InsightDashboardRange | undefined;
  generatedAt?: string | undefined;
  widgets: InsightWidget[];
};

type RelatedIcon = InsightWidgetDetail["related"][number]["icon"];

const MONEY_WIDGET_IDS = new Set([
  "monthly-revenue",
  "revenue",
  "revenue-30d",
  "top-products",
  "top-sources",
  "failed-payments",
]);

const AVERAGE_HEADLINE_WIDGET_IDS = new Set(["daily-active-users"]);

/** Sequential funnels and overlapping segments must not be summed into a headline. */
const NON_SUM_WIDGET_IDS = new Set([
  "pipeline",
  "pipeline-30d",
  "opportunity-pool",
  "engagement-funnel",
]);

const DESCRIPTIONS: Record<string, string> = {
  "monthly-revenue":
    "Monthly breakdown of all paid enrollments and trial conversions across all active products.",
  "monthly-enrollments": "Paid versus free enrollments, grouped by period.",
  "failed-payments": "Failed transactions requiring attention.",
  "top-products": "Highest-revenue products in this period.",
  "payment-orders": "Checkout attempts grouped by status.",
  pipeline: "Visited to enrolled, all time. Sequential stages, not independent event counts.",
  "pipeline-30d":
    "Visited to enrolled in the last 30 days. Sequential stages, not independent event counts.",
  "enrollment-channels": "Enrollment volume grouped by acquisition channel.",
  "top-sources": "Attribution sources by event count and attributed revenue.",
  "opportunity-pool":
    "Paid, trial, free, and offline enrollment segments. These overlap and do not sum.",
  "revenue-30d": "Recognized paid revenue in the last 30 days.",
  "paid-orders": "Successful payment orders on record.",
  "failed-orders": "Failed payment orders requiring attention. Higher is worse.",
  "paid-enrollments": "Paid enrollments on record.",
  "trial-free-pool": "Trial and free enrollments that have not converted to paid.",
  "conversion-rate": "Visited-to-enrolled conversion, all time.",
  "conversion-rate-30d": "Visited-to-enrolled conversion in the last 30 days.",
  "enrollments-30d": "New enrollments recorded in the last 30 days.",
  "paid-enrollments-30d": "Paid enrollments recorded in the last 30 days.",
  revenue: "Recognized paid revenue for the selected range.",
  enrollments: "New enrollments recorded in the selected range.",
  learners: "Active learner memberships in this academy.",
  products: "Published catalog items.",
  "current-mau": "Monthly active users in the current calendar month.",
  "active-users-30d": "Distinct active users in the last 30 days.",
  "learning-activity": "All learning events per day in the selected window.",
  "upcoming-live": "Sessions scheduled or currently live.",
  "pending-tasks": "Open ops items across reviews, moderation, and deletions.",
  "active-enrollments": "Open enrollments across published courses.",
  "inactive-learners": "Learners with no recorded activity for 30 days or more. Higher is worse.",
  "assessment-pass-rate": "Share of submitted assessments that passed in the selected window.",
  "lessons-completed": "Lesson completion events in the selected window.",
  "assessments-submitted": "Assessment submissions in the selected window.",
  "assessments-passed": "Assessments that passed in the selected window.",
  "practice-sessions": "Practice session completions in the selected window.",
  "certificates-issued": "Certificates issued in the selected window.",
  "community-posts": "Community posts created in the selected window.",
  "path-steps": "Learning path steps completed in the selected window.",
  "moderation-opened": "Moderation cases opened in the selected window. Higher is worse.",
  "lessons-trend": "Lesson completions per day in the selected window.",
  "assessments-trend": "Assessment submissions per day in the selected window.",
  "daily-active-users": "Unique learners with at least one session in the selected window.",
  "engagement-funnel":
    "Independent learning event counts in the selected window, not a single cohort.",
  "content-health":
    "Signals for dormant content, inactivity, moderation, and upcoming live sessions.",
  "top-courses": "Courses with the most lesson completions in the selected window.",
  sessions: "Total live sessions on record for this academy.",
  "live-now": "Sessions currently marked live.",
  upcoming: "Sessions scheduled in the near window.",
  ended: "Sessions that have ended or completed.",
  "total-attended": "Attendance records marked attended.",
  "total-registered": "Learners registered, attended, or marked absent on a roster.",
  "attendance-rate": "Attended divided by registered or rostered learners.",
  "attendance-rate-30d": "Attendance rate for sessions in the last 30 days.",
  "avg-watch-minutes": "Average watch duration for attended learners, in minutes.",
  "total-watch-hours": "Total attended watch time converted to hours.",
  "sessions-30d": "Live sessions started or scheduled in the last 30 days.",
  "attended-30d": "Attendance records in the last 30 days.",
  "sessions-by-status": "Session counts grouped by live session status.",
  "attended-by-status": "Attendance volume grouped by the parent session status.",
  "daily-attendance":
    "Historical record of learner attendance vs registrations over the last 30 days.",
  "upcoming-sessions": "Sessions that are scheduled or currently live.",
  "recent-sessions": "Recently started or ended live sessions with attendance rates.",
  "low-attendance-sessions": "Ended sessions that finished below the attendance threshold.",
  "attribution-by-source":
    "The same events, split by traffic source. Totals match the medium breakdown; the slices do not add together.",
  "attribution-by-medium":
    "The same events, split by marketing medium. Totals match the source breakdown; the slices do not add together.",
  "daily-leads":
    "Total form completions versus unique person records captured over the last 30 days.",
  "top-campaigns-utm": "UTM campaigns ranked by attributed events and revenue.",
  "top-forms": "Forms ranked by submission volume for the selected window.",
  "top-ctas": "Call-to-action blocks ranked by views and clicks.",
  "top-coupons": "Coupons ranked by redemption volume.",
  "marketing-inventory": "Published versus draft marketing assets that can currently collect.",
  "recent-workflow-runs": "Latest automation runs with status and timing.",
  "attribution-events": "Attribution events recorded for this academy.",
  "attribution-30d": "Attribution events in the last 30 days.",
  "attribution-revenue": "Revenue attributed to tracked marketing sources.",
  contacts: "Unique marketing contacts on record.",
  "contacts-30d": "New contacts captured in the last 30 days.",
  "form-submissions": "Form completions on record.",
  "submissions-30d": "Form completions in the last 30 days.",
  "live-forms": "Published forms that can currently collect leads.",
  "live-ctas": "Published CTAs that can currently collect engagement.",
  "cta-views": "CTA view events on record.",
  "cta-clicks": "CTA click events on record.",
  "cta-click-rate": "CTA clicks divided by CTA views.",
  "published-workflows": "Published marketing automation workflows.",
  "workflow-runs-30d": "Workflow runs in the last 30 days.",
  "coupon-redemptions": "Coupon redemptions on record.",
  "event-registrations": "Event registrations on record.",
  "outbound-sends":
    "Total outbound campaigns sent across email, push, WhatsApp, and announcements.",
  "outbound-reach": "Total recipients reached by outbound campaigns across channels.",
  "email-sent": "Email campaigns that have been sent.",
  "email-reach": "Recipients across all email campaigns on record.",
  "email-reach-30d": "Email recipients reached in the last 30 days.",
  "push-sent": "Push messages that have been sent.",
  "push-reach": "Recipients across all push messages on record.",
  "whatsapp-sent": "WhatsApp campaigns that have been sent.",
  "whatsapp-delivered": "WhatsApp recipients marked delivered.",
  "whatsapp-failed": "WhatsApp recipients that failed delivery. Higher is worse.",
  "whatsapp-delivery-rate": "WhatsApp delivered divided by WhatsApp recipients.",
  announcements: "In-app announcements that have been sent.",
  "inbox-messages": "Inbound learner messages in the messenger inbox.",
  "inbox-30d": "Inbound inbox messages in the last 30 days.",
  "open-conversations": "Open messenger conversation threads.",
  "scheduled-total": "Scheduled email, push, and WhatsApp campaigns combined.",
  "channel-mix-sends": "Outbound campaign sends grouped by channel.",
  "channel-mix-reach": "Outbound recipients grouped by channel.",
  "daily-volume":
    "Daily outbound reach by channel versus inbound inbox messages over the last 30 days. Outbound and inbound use separate axes and cannot be added.",
  "recent-email": "Recent marketing email campaigns with status and recipients.",
  "recent-push": "Recent push messages with channels, status, and recipients.",
  "recent-whatsapp": "Recent WhatsApp campaigns with delivery outcomes.",
  "recent-announcements": "Recent in-app announcements with type and recipients.",
};

function numericCell(row: Record<string, string | number | null> | undefined, key: string): number {
  const value = row?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function stringCell(
  row: Record<string, string | number | null> | undefined,
  key: string,
  fallback = "",
): string {
  const value = row?.[key];
  if (value == null) return fallback;
  const text = String(value).trim();
  return text.length > 0 ? text : fallback;
}

function measureKeys(widget: InsightWidget): string[] {
  if (widget.data.measures && widget.data.measures.length > 0) {
    return widget.data.measures;
  }
  return widget.data.columns
    .filter((column) => column.kind === "measure" || column.kind === "number")
    .map((column) => column.key);
}

function primaryMeasureKey(widget: InsightWidget): string | null {
  return measureKeys(widget)[0] ?? null;
}

function sumMeasure(widget: InsightWidget, key: string): number {
  return widget.data.rows.reduce((sum, row) => sum + numericCell(row, key), 0);
}

function isMoneyWidget(widget: InsightWidget): boolean {
  return MONEY_WIDGET_IDS.has(widget.id) || /revenue|amount/i.test(widget.title);
}

function rangeLabels(range: InsightDashboardRange): { current: string; previous: string } {
  if (range === "30d") {
    return { current: "Current (30d)", previous: "Previous (30d)" };
  }
  if (range === "ytd") {
    return { current: "Year to date", previous: "Prior year to date" };
  }
  return { current: "Current (12m)", previous: "Previous (12m)" };
}

function groupByCount(
  widget: InsightWidget,
  dimensionKey: string,
): Array<{ label: string; value: number; share: number }> {
  const totals = new Map<string, number>();
  for (const row of widget.data.rows) {
    const label = stringCell(row, dimensionKey, "Unknown");
    totals.set(label, (totals.get(label) ?? 0) + 1);
  }
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([label, value]) => ({
    label,
    value,
    share: Math.round((value / total) * 1000) / 10,
  }));
}

function groupByDimension(
  widget: InsightWidget,
  dimensionKey: string,
  measureKey: string,
): Array<{ label: string; value: number; share: number }> {
  const totals = new Map<string, number>();
  for (const row of widget.data.rows) {
    const label = stringCell(row, dimensionKey, "Unknown");
    totals.set(label, (totals.get(label) ?? 0) + numericCell(row, measureKey));
  }
  const entries = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, value]) => sum + value, 0) || 1;
  return entries.map(([label, value]) => ({
    label,
    value,
    share: Math.round((value / total) * 1000) / 10,
  }));
}

function splitOptionsFor(widget: InsightWidget): Array<{ id: string; label: string }> {
  const skip = new Set([
    "href",
    "period",
    "attempted",
    "scheduled",
    "starts",
    "value",
    "count",
    "signal",
    "consequence",
    "title",
    "tone",
    "stage",
    "label",
    "source",
    "segment",
    "learner",
  ]);
  const options: Array<{ id: string; label: string }> = [];
  for (const column of widget.data.columns) {
    if (skip.has(column.key)) continue;
    if (column.kind === "measure" || column.kind === "number" || column.kind === "date") continue;
    options.push({ id: column.key, label: column.label });
  }
  if (widget.id === "monthly-enrollments") {
    return [{ id: "enrollment-type", label: "Enrollment type" }];
  }
  return options;
}

function enrollmentTypeSplit(
  widget: InsightWidget,
): Array<{ label: string; value: number; share: number }> {
  const paid = sumMeasure(widget, "paid");
  const free = sumMeasure(widget, "free");
  const total = paid + free || 1;
  return [
    { label: "Paid", value: paid, share: Math.round((paid / total) * 1000) / 10 },
    { label: "Free", value: free, share: Math.round((free / total) * 1000) / 10 },
  ];
}

function relatedFor(widget: InsightWidget, slug: string): InsightWidgetDetail["related"] {
  const items: InsightWidgetDetail["related"] = [];
  const push = (title: string, description: string, href: string, icon: RelatedIcon) => {
    if (items.some((item) => item.href === href)) return;
    items.push({ title, description, href, icon });
  };

  if (widget.href && !widget.href.includes("/insights/")) {
    push("Open related report", "Full ledger for this widget.", widget.href, "receipt");
  }

  if (
    widget.id === "monthly-revenue" ||
    widget.id === "revenue" ||
    widget.id === "payment-orders"
  ) {
    push(
      "Payment detail report",
      "Granular view of individual transactions for reconciliation.",
      "/admin/reports/payments",
      "receipt",
    );
    if (slug !== "sales-insight") {
      push(
        "Sales insight",
        "Pipeline, paid versus free mix, and product revenue.",
        "/admin/insights/sales-insight",
        "forecast",
      );
    }
  }

  if (widget.id === "failed-payments") {
    push(
      "Gateway health",
      "Status mix and recovery paths for declined checkouts.",
      "/admin/reports/payments",
      "wallet",
    );
    push(
      "Payment transactions",
      "Retry patterns and individual failed attempts.",
      "/admin/reports/payments/transactions",
      "history",
    );
  }

  if (widget.id === "monthly-enrollments" || widget.id === "enrollments") {
    push(
      "Enrollment roster",
      "Learner-level enrollment records for this academy.",
      "/admin/reports/enrollments",
      "users",
    );
  }

  if (widget.id === "top-products" || widget.id === "products") {
    push(
      "Sales by product",
      "Revenue share across the published catalog.",
      "/admin/reports/sales-marketing",
      "payments",
    );
  }

  if (widget.id === "upcoming-live" || slug === "live-dashboard") {
    push("Live sessions", "Schedule, attendance, and session ops.", "/admin/live-sessions", "live");
    push(
      "Live class attendance",
      "Learner-level attendance, watch time, and roster detail.",
      "/admin/reports/live-class-attendance",
      "users",
    );
  }

  if (slug === "live-dashboard") {
    push(
      "Now board",
      "Live sessions, next up, and ended today in one ops view.",
      "/admin/insights/live-dashboard/now",
      "live",
    );
    push(
      "Sessions ledger",
      "Every session in the window with turnout and watch time.",
      "/admin/insights/live-dashboard/sessions",
      "history",
    );
    push(
      "Attendance overview",
      "Rostered versus attended, day by day, with gap concentration.",
      "/admin/insights/live-dashboard/attendance",
      "users",
    );
    const widgetHref = (id: string) => `/admin/insights/live-dashboard/widgets/${id}`;
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "daily-attendance": [
        [
          "sessions-by-status",
          "Live sessions by status",
          "Session volume across ended, live, scheduled, and cancelled.",
          "live",
        ],
        [
          "low-attendance-sessions",
          "Low attendance sessions",
          "Ended sessions that finished below the attendance threshold.",
          "warning",
        ],
        [
          "upcoming-sessions",
          "Upcoming / live sessions",
          "What is live now and what is next on the schedule.",
          "history",
        ],
      ],
      "sessions-by-status": [
        [
          "attended-by-status",
          "Attendance by session status",
          "Where attendance concentrates across session statuses.",
          "users",
        ],
        [
          "daily-attendance",
          "Daily attendance (30d)",
          "Attended versus registered over the last 30 days.",
          "history",
        ],
        [
          "recent-sessions",
          "Recent sessions",
          "Latest sessions with attendance rate and watch time.",
          "live",
        ],
      ],
      "attended-by-status": [
        [
          "sessions-by-status",
          "Live sessions by status",
          "Session volume across ended, live, scheduled, and cancelled.",
          "live",
        ],
        [
          "daily-attendance",
          "Daily attendance (30d)",
          "Attended versus registered over the last 30 days.",
          "history",
        ],
      ],
      "upcoming-sessions": [
        ["live-now", "Live now", "Count of sessions currently marked live.", "live"],
        [
          "daily-attendance",
          "Daily attendance (30d)",
          "Attended versus registered over the last 30 days.",
          "history",
        ],
      ],
      "recent-sessions": [
        [
          "low-attendance-sessions",
          "Low attendance sessions",
          "Ended sessions that finished below the attendance threshold.",
          "warning",
        ],
        [
          "daily-attendance",
          "Daily attendance (30d)",
          "Attended versus registered over the last 30 days.",
          "history",
        ],
      ],
      "low-attendance-sessions": [
        [
          "recent-sessions",
          "Recent sessions",
          "Latest sessions with attendance rate and watch time.",
          "live",
        ],
        [
          "attendance-rate",
          "Attendance rate %",
          "Attended divided by registered or rostered learners.",
          "forecast",
        ],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      push(title, description, widgetHref(id), icon);
    }
  }

  if (slug === "marketing-insight") {
    push(
      "Attribution analysis",
      "The same events split by source, medium, and UTM campaign.",
      "/admin/insights/marketing-insight/attribution",
      "campaign",
    );
    push(
      "Marketing forms",
      "Lead capture forms and submission history.",
      "/admin/marketing/forms",
      "campaign",
    );
    push(
      "Form contacts",
      "Person records captured from marketing forms.",
      "/admin/marketing/forms/contacts",
      "users",
    );
    const widgetHref = (id: string) => `/admin/insights/marketing-insight/widgets/${id}`;
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "daily-leads": [
        [
          "attribution-by-source",
          "Attribution by source",
          "View attribution by traffic source and event volume.",
          "campaign",
        ],
        [
          "top-forms",
          "Top forms by submissions",
          "Which forms captured the most completions.",
          "history",
        ],
        [
          "top-campaigns-utm",
          "Top UTM campaigns",
          "Deep analysis of UTM parameters driving form submissions.",
          "forecast",
        ],
      ],
      "attribution-by-source": [
        [
          "attribution-by-medium",
          "Attribution by medium",
          "Compare broader marketing channels for the same events.",
          "campaign",
        ],
        [
          "top-sources",
          "Top sources",
          "Detailed tabular view of source metrics and revenue.",
          "history",
        ],
        [
          "daily-leads",
          "Daily leads (30d)",
          "Submissions versus contacts over the last 30 days.",
          "users",
        ],
      ],
      "attribution-by-medium": [
        [
          "attribution-by-source",
          "Attribution by source",
          "View attribution by traffic source and event volume.",
          "campaign",
        ],
        [
          "top-sources",
          "Top sources",
          "Detailed tabular view of source metrics and revenue.",
          "history",
        ],
        [
          "daily-leads",
          "Daily leads (30d)",
          "Submissions versus contacts over the last 30 days.",
          "users",
        ],
      ],
      "top-forms": [
        [
          "daily-leads",
          "Daily leads (30d)",
          "Submissions versus contacts over the last 30 days.",
          "users",
        ],
        ["top-sources", "Top sources", "Where form traffic is attributed from.", "campaign"],
        [
          "top-ctas",
          "Top CTAs by engagement",
          "Engagement across published call-to-action blocks.",
          "forecast",
        ],
      ],
      "top-sources": [
        [
          "attribution-by-source",
          "Attribution by source",
          "Bar view of the same source split.",
          "campaign",
        ],
        [
          "top-campaigns-utm",
          "Top UTM campaigns",
          "Campaign-level attribution and revenue.",
          "forecast",
        ],
      ],
      "top-campaigns-utm": [
        ["top-sources", "Top sources", "Source-level attribution and revenue.", "campaign"],
        [
          "daily-leads",
          "Daily leads (30d)",
          "Submissions versus contacts over the last 30 days.",
          "users",
        ],
      ],
      "top-ctas": [
        [
          "top-forms",
          "Top forms by submissions",
          "Form performance across capture surfaces.",
          "history",
        ],
        [
          "marketing-inventory",
          "Marketing inventory",
          "Published versus draft assets that can collect.",
          "campaign",
        ],
      ],
      "top-coupons": [
        [
          "recent-workflow-runs",
          "Recent workflow runs",
          "Automation runs tied to offers and capture.",
          "history",
        ],
      ],
      "recent-workflow-runs": [
        ["top-coupons", "Top coupons by redemptions", "Which offers are converting.", "forecast"],
        [
          "marketing-inventory",
          "Marketing inventory",
          "Published versus draft assets that can collect.",
          "campaign",
        ],
      ],
      "marketing-inventory": [
        ["top-forms", "Top forms by submissions", "Live forms ranked by completions.", "history"],
        [
          "top-ctas",
          "Top CTAs by engagement",
          "Engagement across published call-to-action blocks.",
          "forecast",
        ],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      push(title, description, widgetHref(id), icon);
    }
  }

  if (slug === "messenger-insight") {
    const widgetHref = (id: string) => `/admin/insights/messenger-insight/widgets/${id}`;
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "daily-volume": [
        [
          "channel-mix-sends",
          "Sends by channel",
          "How outbound volume splits across channels.",
          "campaign",
        ],
        [
          "channel-mix-reach",
          "Reach by channel",
          "How outbound recipients split across channels.",
          "users",
        ],
        ["inbox-messages", "Inbox messages", "Inbound replies coming back from learners.", "inbox"],
      ],
      "channel-mix-sends": [
        [
          "channel-mix-reach",
          "Reach by channel",
          "Paired recipients view for the same channels.",
          "users",
        ],
        [
          "daily-volume",
          "Daily messaging volume (30d)",
          "Outbound reach and inbound replies over time.",
          "history",
        ],
        [
          "outbound-sends",
          "Outbound campaigns sent",
          "Total campaigns across all channels.",
          "campaign",
        ],
      ],
      "channel-mix-reach": [
        [
          "channel-mix-sends",
          "Sends by channel",
          "Paired sends view for the same channels.",
          "campaign",
        ],
        [
          "daily-volume",
          "Daily messaging volume (30d)",
          "Outbound reach and inbound replies over time.",
          "history",
        ],
        [
          "outbound-reach",
          "Total outbound reach",
          "Recipients across all outbound campaigns.",
          "users",
        ],
      ],
      "recent-email": [
        ["email-sent", "Email campaigns sent", "All-time email campaign count.", "campaign"],
        ["email-reach", "Email recipients", "All-time email reach.", "users"],
        [
          "channel-mix-sends",
          "Sends by channel",
          "Email alongside the other outbound channels.",
          "history",
        ],
      ],
      "recent-push": [
        ["push-sent", "Push messages sent", "All-time push send count.", "campaign"],
        ["push-reach", "Push recipients", "All-time push reach.", "users"],
        [
          "channel-mix-sends",
          "Sends by channel",
          "Push alongside the other outbound channels.",
          "history",
        ],
      ],
      "recent-whatsapp": [
        [
          "whatsapp-delivery-rate",
          "WhatsApp delivery %",
          "Delivered share of WhatsApp recipients.",
          "forecast",
        ],
        [
          "whatsapp-failed",
          "WhatsApp failed",
          "Failed WhatsApp sends that need attention.",
          "warning",
        ],
        [
          "whatsapp-delivered",
          "WhatsApp delivered",
          "Successfully delivered WhatsApp recipients.",
          "campaign",
        ],
      ],
      "recent-announcements": [
        ["announcements", "Announcements sent", "All-time announcement count.", "campaign"],
        [
          "channel-mix-reach",
          "Reach by channel",
          "Announcements in the outbound channel mix.",
          "users",
        ],
      ],
      "whatsapp-failed": [
        [
          "recent-whatsapp",
          "Recent WhatsApp campaigns",
          "Campaign-level delivery and failure counts.",
          "history",
        ],
        [
          "whatsapp-delivery-rate",
          "WhatsApp delivery %",
          "Delivered share of WhatsApp recipients.",
          "forecast",
        ],
      ],
      "whatsapp-delivery-rate": [
        [
          "recent-whatsapp",
          "Recent WhatsApp campaigns",
          "Campaign-level delivery and failure counts.",
          "history",
        ],
        ["whatsapp-failed", "WhatsApp failed", "Failed WhatsApp sends.", "warning"],
      ],
      "inbox-messages": [
        [
          "open-conversations",
          "Open conversations",
          "Active inbound threads waiting on a reply.",
          "inbox",
        ],
        [
          "daily-volume",
          "Daily messaging volume (30d)",
          "Inbox replies plotted against outbound reach.",
          "history",
        ],
      ],
      "open-conversations": [
        ["inbox-messages", "Inbox messages", "All inbound messages on record.", "inbox"],
        ["inbox-30d", "Inbox messages (30d)", "Inbound volume in the last 30 days.", "history"],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      push(title, description, widgetHref(id), icon);
    }
    if (
      widget.id === "whatsapp-failed" ||
      widget.id === "whatsapp-delivery-rate" ||
      widget.id === "whatsapp-delivered" ||
      widget.id === "recent-whatsapp" ||
      widget.id === "whatsapp-sent"
    ) {
      push(
        "WhatsApp delivery",
        "Delivery rate, failures over time, and recent campaigns.",
        "/admin/insights/messenger-insight/whatsapp",
        "campaign",
      );
    }
    push(
      "Messenger inbox",
      "Open conversations and inbound replies.",
      "/admin/insights/messenger-insight/inbox",
      "inbox",
    );
    push(
      "WhatsApp settings",
      "Connect or reconnect WhatsApp Business delivery.",
      "/admin/marketing/messenger/whatsapp",
      "campaign",
    );
  }

  if (slug === "sales-insight") {
    const widgetHref = (id: string) => `/admin/insights/sales-insight/widgets/${id}`;
    if (
      widget.id === "pipeline" ||
      widget.id === "pipeline-30d" ||
      widget.id.startsWith("conversion-rate")
    ) {
      push(
        "Sales pipeline comparison",
        "Visited, started diagnostic, and enrolled. All time against the last 30 days.",
        "/admin/insights/sales-insight/pipeline",
        "forecast",
      );
    }
    if (widget.id === "top-sources" || widget.id === "enrollment-channels") {
      push(
        "Attribution",
        "Which sources bring events, and what revenue is attributed to them.",
        "/admin/insights/sales-insight/attribution",
        "campaign",
      );
    }
    if (
      widget.id === "opportunity-pool" ||
      widget.id === "trial-free-pool" ||
      widget.id === "paid-enrollments"
    ) {
      push(
        "Conversion opportunity",
        "Who is enrolled but not paying, and how they got there.",
        "/admin/insights/sales-insight/opportunity",
        "users",
      );
    }
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "monthly-revenue": [
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Track potential revenue across stages before conversion.",
          "forecast",
        ],
        [
          "failed-payments",
          "Recent failed payments",
          "Monitor subscription churn and checkout drops.",
          "warning",
        ],
        [
          "top-products",
          "Top products by sales",
          "Volume and conversion rates for top-performing SKUs.",
          "payments",
        ],
      ],
      revenue: [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        ["revenue-30d", "Revenue (30d)", "Paid revenue in the last 30 days.", "forecast"],
        [
          "failed-payments",
          "Recent failed payments",
          "Failed transactions requiring attention.",
          "warning",
        ],
      ],
      "revenue-30d": [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        ["revenue", "Revenue (all time)", "Recognized paid revenue on record.", "forecast"],
      ],
      pipeline: [
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "The same sequential funnel limited to the last 30 days.",
          "forecast",
        ],
        [
          "conversion-rate",
          "Conversion rate",
          "Visited-to-enrolled conversion, all time.",
          "forecast",
        ],
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "payments",
        ],
      ],
      "pipeline-30d": [
        [
          "pipeline",
          "Sales pipeline (all time)",
          "The same sequential funnel across all recorded visits.",
          "forecast",
        ],
        [
          "conversion-rate-30d",
          "Conversion rate (30d)",
          "Visited-to-enrolled conversion in the last 30 days.",
          "forecast",
        ],
        [
          "enrollments-30d",
          "Enrollments (30d)",
          "New enrollments recorded in the last 30 days.",
          "users",
        ],
      ],
      "failed-payments": [
        [
          "payment-orders",
          "Orders by status",
          "Checkout attempts grouped by paid, failed, and other statuses.",
          "receipt",
        ],
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        [
          "failed-orders",
          "Failed orders",
          "Count of failed payment orders. Higher is worse.",
          "warning",
        ],
      ],
      "failed-orders": [
        [
          "failed-payments",
          "Recent failed payments",
          "Failed transactions requiring attention.",
          "warning",
        ],
        ["payment-orders", "Orders by status", "Checkout attempts grouped by status.", "receipt"],
      ],
      "top-products": [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        [
          "opportunity-pool",
          "Conversion opportunity",
          "Paid, trial, free, and offline enrollment segments.",
          "users",
        ],
        ["products", "Products", "Published catalog items.", "payments"],
      ],
      "payment-orders": [
        [
          "failed-payments",
          "Recent failed payments",
          "Failed transactions requiring attention.",
          "warning",
        ],
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
      ],
      "enrollment-channels": [
        [
          "top-sources",
          "Top attribution sources",
          "Campaign sources by events and attributed revenue.",
          "campaign",
        ],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
      ],
      "top-sources": [
        [
          "enrollment-channels",
          "Enrollments by channel",
          "Enrollment volume grouped by acquisition channel.",
          "campaign",
        ],
      ],
      "opportunity-pool": [
        [
          "top-products",
          "Top products by sales",
          "Highest-revenue products in this period.",
          "payments",
        ],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
        ["paid-enrollments", "Paid enrollments", "Paid enrollments on record.", "users"],
      ],
      "conversion-rate": [
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
        [
          "conversion-rate-30d",
          "Conversion rate (30d)",
          "Visited-to-enrolled conversion in the last 30 days.",
          "forecast",
        ],
      ],
      "conversion-rate-30d": [
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "Visited to enrolled in the last 30 days.",
          "forecast",
        ],
        [
          "conversion-rate",
          "Conversion rate",
          "Visited-to-enrolled conversion, all time.",
          "forecast",
        ],
      ],
      "paid-orders": [
        [
          "monthly-revenue",
          "Monthly revenue (12 months)",
          "Paid payment orders grouped by month.",
          "forecast",
        ],
        ["payment-orders", "Orders by status", "Checkout attempts grouped by status.", "receipt"],
      ],
      "paid-enrollments": [
        [
          "opportunity-pool",
          "Conversion opportunity",
          "Paid, trial, free, and offline enrollment segments.",
          "users",
        ],
        [
          "top-products",
          "Top products by sales",
          "Highest-revenue products in this period.",
          "payments",
        ],
      ],
      "paid-enrollments-30d": [
        [
          "enrollments-30d",
          "Enrollments (30d)",
          "New enrollments recorded in the last 30 days.",
          "users",
        ],
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "Visited to enrolled in the last 30 days.",
          "forecast",
        ],
      ],
      "enrollments-30d": [
        [
          "pipeline-30d",
          "Sales pipeline (30d)",
          "Visited to enrolled in the last 30 days.",
          "forecast",
        ],
        [
          "paid-enrollments-30d",
          "Paid enrollments (30d)",
          "Paid enrollments in the last 30 days.",
          "users",
        ],
      ],
      "trial-free-pool": [
        [
          "opportunity-pool",
          "Conversion opportunity",
          "Paid, trial, free, and offline enrollment segments.",
          "users",
        ],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
      ],
      products: [
        [
          "top-products",
          "Top products by sales",
          "Highest-revenue products in this period.",
          "payments",
        ],
      ],
      learners: [
        ["paid-enrollments", "Paid enrollments", "Paid enrollments on record.", "users"],
        [
          "pipeline",
          "Sales pipeline (all time)",
          "Visited to enrolled across all recorded visits.",
          "forecast",
        ],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      push(title, description, widgetHref(id), icon);
    }
    if (widget.id === "top-sources" || widget.id === "enrollment-channels") {
      push(
        "Marketing insight",
        "Lead capture, attribution, and campaign performance.",
        "/admin/insights/marketing-insight",
        "campaign",
      );
    }
  }

  if (slug === "school-vitals") {
    const widgetHref = (id: string) => `/admin/insights/school-vitals/widgets/${id}`;
    const neighbors: Record<string, Array<[string, string, string, RelatedIcon]>> = {
      "daily-active-users": [
        [
          "active-enrollments",
          "Active enrollments",
          "Learners currently enrolled in published courses.",
          "users",
        ],
        ["current-mau", "Current MAU", "Active learners in the current calendar month.", "users"],
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
      ],
      "active-users-30d": [
        [
          "daily-active-users",
          "Daily active users",
          "Unique learners with a session in the selected window.",
          "users",
        ],
        ["current-mau", "Current MAU", "Active learners in the current calendar month.", "users"],
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
      ],
      "current-mau": [
        [
          "daily-active-users",
          "Daily active users",
          "Unique learners with a session in the selected window.",
          "users",
        ],
        [
          "active-enrollments",
          "Active enrollments",
          "Learners currently enrolled in published courses.",
          "users",
        ],
      ],
      learners: [
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
        [
          "active-users-30d",
          "Active users (30d)",
          "Distinct learners active in the last 30 days.",
          "users",
        ],
        [
          "active-enrollments",
          "Active enrollments",
          "Learners currently enrolled in published courses.",
          "users",
        ],
      ],
      "inactive-learners": [
        ["learners", "Learners", "Active learner memberships in this academy.", "users"],
        [
          "content-health",
          "Content health",
          "Dormant courses, inactivity, and moderation load.",
          "warning",
        ],
      ],
      "active-enrollments": [
        [
          "daily-active-users",
          "Daily active users",
          "Unique learners with a session in the selected window.",
          "users",
        ],
        ["learners", "Learners", "Active learner memberships in this academy.", "users"],
      ],
      "learning-activity": [
        [
          "lessons-trend",
          "Lessons completed",
          "Lesson completions per day in the selected window.",
          "history",
        ],
        [
          "assessments-trend",
          "Assessments submitted",
          "Assessment submissions per day in the selected window.",
          "history",
        ],
        [
          "top-courses",
          "Top courses",
          "Courses with the most lesson completions in the window.",
          "forecast",
        ],
      ],
      "lessons-trend": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "top-courses",
          "Top courses",
          "Courses with the most lesson completions in the window.",
          "forecast",
        ],
      ],
      "assessments-trend": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
      ],
      "engagement-funnel": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
      ],
      "assessment-pass-rate": [
        [
          "assessments-trend",
          "Assessments submitted",
          "Assessment submissions per day in the selected window.",
          "history",
        ],
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "content-health": [
        [
          "inactive-learners",
          "Inactive learners",
          "Learners with no activity for 30 days or more.",
          "warning",
        ],
        [
          "moderation-opened",
          "Moderation cases opened",
          "Cases opened in the selected window. Higher is worse.",
          "warning",
        ],
        [
          "top-courses",
          "Top courses",
          "Courses with the most lesson completions in the window.",
          "forecast",
        ],
      ],
      "top-courses": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
        [
          "content-health",
          "Content health",
          "Dormant courses, inactivity, and moderation load.",
          "warning",
        ],
      ],
      "moderation-opened": [
        [
          "content-health",
          "Content health",
          "Dormant courses, inactivity, and moderation load.",
          "warning",
        ],
      ],
      "lessons-completed": [
        [
          "lessons-trend",
          "Lessons completed",
          "Lesson completions per day in the selected window.",
          "history",
        ],
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "assessments-submitted": [
        [
          "assessments-trend",
          "Assessments submitted",
          "Assessment submissions per day in the selected window.",
          "history",
        ],
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
      ],
      "assessments-passed": [
        [
          "assessment-pass-rate",
          "Assessment pass rate",
          "Share of submitted assessments that passed.",
          "forecast",
        ],
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "practice-sessions": [
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
      ],
      "certificates-issued": [
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "community-posts": [
        [
          "engagement-funnel",
          "Learning engagement funnel",
          "Independent event counts, not a cohort conversion.",
          "forecast",
        ],
      ],
      "path-steps": [
        [
          "learning-activity",
          "Learning activity",
          "All learning events per day in the selected window.",
          "history",
        ],
      ],
    };
    for (const [id, title, description, icon] of neighbors[widget.id] ?? []) {
      const href =
        id === "engagement-funnel"
          ? "/admin/insights/school-vitals/funnel"
          : id === "content-health"
            ? "/admin/insights/school-vitals/content-health"
            : widgetHref(id);
      push(title, description, href, icon);
    }
  }

  return items.slice(0, 4);
}

function formatNoteValue(widget: InsightWidget, value: number, currency?: string): string {
  if (isMoneyWidget(widget)) {
    const amount = value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return currency ? `${amount} ${currency}` : amount;
  }
  return value.toLocaleString("en-US");
}

function formatNotePeriod(period: string): string {
  const date = new Date(period.includes("T") ? period : `${period}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return period.slice(0, 7);
  return date.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function seriesInsightNote(
  widget: InsightWidget,
  measureKey: string,
  currency?: string,
): string | null {
  if (widget.footnote) return widget.footnote;
  const rows = widget.data.rows;
  if (rows.length < 2) return null;
  const values = rows.map((row) => numericCell(row, measureKey));
  let peakIndex = 0;
  for (let index = 1; index < values.length; index += 1) {
    if ((values[index] ?? 0) > (values[peakIndex] ?? 0)) peakIndex = index;
  }
  const peak = rows[peakIndex];
  if (!peak) return null;
  const trailing = values.slice(-3);
  const falling =
    trailing.length === 3 &&
    (trailing[0] ?? 0) > (trailing[1] ?? 0) &&
    (trailing[1] ?? 0) > (trailing[2] ?? 0);
  const periodLabel = formatNotePeriod(stringCell(peak, "period"));
  const peakLabel = formatNoteValue(widget, numericCell(peak, measureKey), currency);
  if (falling) {
    if (isMoneyWidget(widget)) {
      return `Revenue fell for two consecutive months after peaking at ${peakLabel} in ${periodLabel}.`;
    }
    return `Peaked at ${peakLabel} in ${periodLabel} and has fallen for two consecutive periods.`;
  }
  return `Peak period ${periodLabel} recorded ${peakLabel}.`;
}

function failureInsight(
  widget: InsightWidget,
  paymentOrders: InsightWidget | undefined,
  dashboard?: DashboardLike,
): InsightWidgetDetail["failureRate"] {
  if (widget.id === "whatsapp-failed" || widget.id === "whatsapp-delivery-rate") {
    const deliveredWidget = dashboard?.widgets.find((item) => item.id === "whatsapp-delivered");
    const failedWidget = dashboard?.widgets.find((item) => item.id === "whatsapp-failed");
    const rateWidget = dashboard?.widgets.find((item) => item.id === "whatsapp-delivery-rate");
    const delivered =
      deliveredWidget != null ? numericCell(deliveredWidget.data.rows[0], "value") : 0;
    const failed = failedWidget != null ? numericCell(failedWidget.data.rows[0], "value") : 0;
    const recipients = delivered + failed;
    if (recipients <= 0) return null;
    const failurePct = Math.round((failed / recipients) * 1000) / 10;
    const deliveryPct =
      rateWidget != null
        ? numericCell(rateWidget.data.rows[0], "value")
        : Math.round((delivered / recipients) * 1000) / 10;
    return {
      currentPct: failurePct,
      previousPct: null,
      deltaPct: null,
      note: `${String(failed)} failed of ${String(recipients)} recipients (${String(deliveryPct)}% delivered).`,
    };
  }

  if (widget.id !== "failed-payments") return null;
  const reasonSplit = groupByCount(widget, "reason");
  const gatewaySplit = groupByCount(widget, "gateway");
  const topReason = reasonSplit[0];
  const topGateway = gatewaySplit[0];
  const noteParts: string[] = [];
  if (topReason) {
    noteParts.push(`Most common reason: ${topReason.label} (${String(topReason.share)}%).`);
  }
  if (topGateway) {
    noteParts.push(`Highest volume gateway: ${topGateway.label}.`);
  }

  let currentPct: number | null = null;
  if (paymentOrders) {
    const failed = paymentOrders.data.rows
      .filter((row) => stringCell(row, "label").toLowerCase() === "failed")
      .reduce((sum, row) => sum + numericCell(row, "value"), 0);
    const total = sumMeasure(paymentOrders, "value");
    if (total > 0) currentPct = Math.round((failed / total) * 1000) / 10;
  } else if (widget.data.rows.length > 0) {
    currentPct = 100;
  }

  if (currentPct == null) return null;
  return {
    currentPct,
    previousPct: null,
    deltaPct: null,
    note: noteParts.join(" ") || null,
  };
}

function aggregateMeasure(widget: InsightWidget, key: string): number {
  if (widget.defaultViz === "kpi") {
    return numericCell(widget.data.rows[0], "value");
  }
  if (AVERAGE_HEADLINE_WIDGET_IDS.has(widget.id)) {
    const values = widget.data.rows.map((row) => numericCell(row, key));
    if (values.length === 0) return 0;
    return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
  }
  if (NON_SUM_WIDGET_IDS.has(widget.id) || widget.defaultViz === "funnel") {
    return numericCell(widget.data.rows[widget.data.rows.length - 1], key);
  }
  return sumMeasure(widget, key);
}

function buildComparison(
  widget: InsightWidget,
  range: InsightDashboardRange,
): InsightWidgetDetail["comparison"] {
  if (NON_SUM_WIDGET_IDS.has(widget.id) || widget.defaultViz === "funnel") return null;
  const measureKey = primaryMeasureKey(widget);
  if (!measureKey) return null;
  const current = aggregateMeasure(widget, measureKey);
  const labels = rangeLabels(range);
  let previous: number | null = null;
  if (widget.deltaPct != null && widget.deltaPct !== -100) {
    previous = current / (1 + widget.deltaPct / 100);
  } else if (
    !AVERAGE_HEADLINE_WIDGET_IDS.has(widget.id) &&
    widget.deltaAbs != null &&
    Number.isFinite(widget.deltaAbs)
  ) {
    previous = current - widget.deltaAbs;
  }
  if (previous == null || !Number.isFinite(previous)) return null;
  const roundedPrevious = Math.round(previous * 100) / 100;
  return {
    currentLabel: AVERAGE_HEADLINE_WIDGET_IDS.has(widget.id)
      ? `Average (${labels.current})`
      : labels.current,
    previousLabel: labels.previous,
    current,
    previous: roundedPrevious,
    deltaAbs: computeDeltaAbs(current, roundedPrevious),
    deltaPct: widget.deltaPct ?? computeDeltaPct(current, roundedPrevious),
    unit: isMoneyWidget(widget) ? "money" : "count",
  };
}

function widgetNotFoundError(widgetId: string) {
  return new AtlasHttpError({
    code: "PERMISSION_DENIED",
    status: 404,
    message: `Insight widget not found: ${widgetId}`,
  });
}

function liveDailyAttendanceNote(widget: InsightWidget): string | null {
  if (widget.id !== "daily-attendance") return null;
  const rows = widget.data.rows;
  if (rows.length < 14) return null;
  const firstHalf = rows.slice(0, Math.floor(rows.length / 2));
  const secondHalf = rows.slice(Math.floor(rows.length / 2));
  const gap = (slice: typeof rows) => {
    const attended = slice.reduce((sum, row) => sum + numericCell(row, "attended"), 0);
    const registered = slice.reduce((sum, row) => sum + numericCell(row, "registered"), 0);
    return Math.max(registered - attended, 0);
  };
  const earlyGap = Math.round(gap(firstHalf) / Math.max(firstHalf.length, 1));
  const lateGap = Math.round(gap(secondHalf) / Math.max(secondHalf.length, 1));
  if (lateGap <= earlyGap) return null;
  return `The attended-to-registered gap widened from ${String(earlyGap)} to ${String(lateGap)} learners per day over the last two weeks.`;
}

function marketingDailyLeadsNote(widget: InsightWidget): string | null {
  if (widget.id !== "daily-leads") return null;
  const rows = widget.data.rows;
  if (rows.length < 14) return null;
  const firstHalf = rows.slice(0, Math.floor(rows.length / 2));
  const secondHalf = rows.slice(Math.floor(rows.length / 2));
  const avgGap = (slice: typeof rows) => {
    const submissions = slice.reduce((sum, row) => sum + numericCell(row, "submissions"), 0);
    const contacts = slice.reduce((sum, row) => sum + numericCell(row, "contacts"), 0);
    return Math.max(submissions - contacts, 0) / Math.max(slice.length, 1);
  };
  const earlyGap = Math.round(avgGap(firstHalf));
  const lateGap = Math.round(avgGap(secondHalf));
  if (lateGap <= earlyGap) return null;
  return `Submissions and contacts diverged further in the second half of the window (about ${String(lateGap)} repeat submissions per day versus ${String(earlyGap)} earlier), suggesting more resubmits from the same people.`;
}

function messengerDailyVolumeNote(widget: InsightWidget): string | null {
  if (widget.id !== "daily-volume") return null;
  const rows = widget.data.rows;
  if (rows.length < 14) return null;
  const outbound = (row: (typeof rows)[number]) =>
    numericCell(row, "email") + numericCell(row, "push") + numericCell(row, "whatsapp");
  const firstHalf = rows.slice(0, Math.floor(rows.length / 2));
  const secondHalf = rows.slice(Math.floor(rows.length / 2));
  const avg = (slice: typeof rows, pick: (row: (typeof rows)[number]) => number) =>
    slice.reduce((sum, row) => sum + pick(row), 0) / Math.max(slice.length, 1);
  const earlyOutbound = Math.round(avg(firstHalf, outbound));
  const lateOutbound = Math.round(avg(secondHalf, outbound));
  const earlyInbox = Math.round(avg(firstHalf, (row) => numericCell(row, "inbox")));
  const lateInbox = Math.round(avg(secondHalf, (row) => numericCell(row, "inbox")));
  if (lateOutbound <= earlyOutbound && lateInbox <= earlyInbox) return null;
  return `Outbound reach averaged ${String(lateOutbound)} recipients/day in the second half versus ${String(earlyOutbound)} earlier; inbox replies averaged ${String(lateInbox)} versus ${String(earlyInbox)}.`;
}

function liveStatusSplit(
  widget: InsightWidget,
): Array<{ label: string; value: number; share: number }> {
  const measure = primaryMeasureKey(widget) ?? "value";
  return groupByDimension(widget, "label", measure);
}

function resolvePairedWidget(
  dashboard: DashboardLike,
  widget: InsightWidget,
): InsightWidget | null {
  if (dashboard.slug === "live-dashboard") {
    if (widget.id === "sessions-by-status") {
      return dashboard.widgets.find((item) => item.id === "attended-by-status") ?? null;
    }
    if (widget.id === "attended-by-status") {
      return dashboard.widgets.find((item) => item.id === "sessions-by-status") ?? null;
    }
    return null;
  }
  if (dashboard.slug === "marketing-insight") {
    if (widget.id === "attribution-by-source") {
      return dashboard.widgets.find((item) => item.id === "attribution-by-medium") ?? null;
    }
    if (widget.id === "attribution-by-medium") {
      return dashboard.widgets.find((item) => item.id === "attribution-by-source") ?? null;
    }
    return null;
  }
  if (dashboard.slug === "messenger-insight") {
    if (widget.id === "channel-mix-sends") {
      return dashboard.widgets.find((item) => item.id === "channel-mix-reach") ?? null;
    }
    if (widget.id === "channel-mix-reach") {
      return dashboard.widgets.find((item) => item.id === "channel-mix-sends") ?? null;
    }
    return null;
  }
  return null;
}

export function buildInsightWidgetDetail(
  dashboard: DashboardLike,
  widgetId: string,
): InsightWidgetDetail {
  const widget = dashboard.widgets.find((item) => item.id === widgetId);
  if (!widget) throw widgetNotFoundError(widgetId);

  const range = dashboard.range ?? "12m";
  const measureKey = primaryMeasureKey(widget);
  const options = splitOptionsFor(widget);
  const splits: InsightWidgetDetail["splits"] = {};
  if (widget.id === "monthly-enrollments") {
    splits["enrollment-type"] = enrollmentTypeSplit(widget);
  } else if (widget.id === "failed-payments") {
    for (const option of options) {
      splits[option.id] = groupByCount(widget, option.id);
    }
  } else if (
    dashboard.slug === "live-dashboard" &&
    (widget.id === "sessions-by-status" || widget.id === "attended-by-status")
  ) {
    splits["status"] = liveStatusSplit(widget);
  } else if (measureKey) {
    for (const option of options) {
      splits[option.id] = groupByDimension(widget, option.id, measureKey);
    }
  }

  const values =
    measureKey != null ? widget.data.rows.map((row) => numericCell(row, measureKey)) : [];
  const outboundDailyValues =
    widget.id === "daily-volume"
      ? widget.data.rows.map(
          (row) =>
            numericCell(row, "email") + numericCell(row, "push") + numericCell(row, "whatsapp"),
        )
      : null;
  const average =
    outboundDailyValues != null && outboundDailyValues.length > 0
      ? outboundDailyValues.reduce((sum, value) => sum + value, 0) / outboundDailyValues.length
      : values.length > 0 && !NON_SUM_WIDGET_IDS.has(widget.id) && widget.defaultViz !== "funnel"
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null;

  const paymentOrders = dashboard.widgets.find((item) => item.id === "payment-orders");
  const pairedWidget = resolvePairedWidget(dashboard, widget);
  const secondaryTotal =
    widget.id === "daily-attendance"
      ? sumMeasure(widget, "registered")
      : widget.id === "daily-leads"
        ? sumMeasure(widget, "contacts")
        : widget.id === "daily-volume"
          ? sumMeasure(widget, "inbox")
          : pairedWidget
            ? sumMeasure(pairedWidget, primaryMeasureKey(pairedWidget) ?? "value")
            : null;
  const secondaryAverage =
    widget.id === "daily-attendance" && widget.data.rows.length > 0
      ? sumMeasure(widget, "registered") / widget.data.rows.length
      : widget.id === "daily-leads" && widget.data.rows.length > 0
        ? sumMeasure(widget, "contacts") / widget.data.rows.length
        : widget.id === "daily-volume" && widget.data.rows.length > 0
          ? sumMeasure(widget, "inbox") / widget.data.rows.length
          : null;

  const liveNote = liveDailyAttendanceNote(widget);
  const marketingNote = marketingDailyLeadsNote(widget);
  const messengerNote = messengerDailyVolumeNote(widget);
  const insightNote =
    liveNote ??
    marketingNote ??
    messengerNote ??
    (widget.footnote
      ? widget.footnote
      : measureKey
        ? seriesInsightNote(widget, measureKey, dashboard.currency)
        : null);

  const splitOptions =
    dashboard.slug === "live-dashboard" &&
    (widget.id === "sessions-by-status" || widget.id === "attended-by-status")
      ? [{ id: "status", label: "Status" }]
      : options;

  return {
    slug: dashboard.slug,
    sectionTitle: dashboard.title,
    ...(dashboard.currency ? { currency: dashboard.currency } : {}),
    range,
    generatedAt: dashboard.generatedAt ?? new Date().toISOString(),
    widget,
    description: DESCRIPTIONS[widget.id] ?? widget.title,
    comparison: buildComparison(widget, range),
    average,
    insightNote,
    splitOptions,
    splits,
    related: relatedFor(widget, dashboard.slug),
    failureRate: failureInsight(widget, paymentOrders, dashboard),
    pairedWidget,
    secondaryAverage,
    secondaryTotal,
  };
}
