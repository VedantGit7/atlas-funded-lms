import type { SalesOpportunityEvidence, SalesInsightSnapshot } from "./insights.repository";
import type { InsightSalesOpportunityBoard } from "./insights.schemas";
import { SALES_OPPORTUNITY_FOOTNOTE } from "./insights-sales-insight";

export const SALES_OPPORTUNITY_EMPTY_CAPTION = "No enrollments recorded.";
export const SALES_OPPORTUNITY_ALL_PAID_CAPTION = "No unconverted trial or free learners.";
export const SALES_OPPORTUNITY_ENROLLMENTS_HREF = "/admin/reports/enrollments";
export const SALES_OPPORTUNITY_PAYMENTS_HREF = "/admin/reports/payments";
export const SALES_OPPORTUNITY_MESSAGE_HREF = "/admin/marketing/messenger/email/create";

function centsToMajor(cents: number): number {
  return Math.round(cents) / 100;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function sharePct(count: number, total: number): number | null {
  if (total <= 0) return null;
  return round1((count / total) * 100);
}

export function buildInsightSalesOpportunity(
  snapshot: Pick<
    SalesInsightSnapshot,
    | "currency"
    | "revenueCents"
    | "paidEnrollmentCount"
    | "trialEnrollmentCount"
    | "freeEnrollmentCount"
    | "offlineEnrollmentCount"
    | "onlineEnrollmentCount"
  >,
  evidence: SalesOpportunityEvidence,
  generatedAt = new Date().toISOString(),
): InsightSalesOpportunityBoard {
  const paid = snapshot.paidEnrollmentCount;
  const trial = snapshot.trialEnrollmentCount;
  const free = snapshot.freeEnrollmentCount;
  const offline = snapshot.offlineEnrollmentCount;
  const online = snapshot.onlineEnrollmentCount;
  const pool = trial + free;
  const exclusiveTotal = paid + trial + free + offline;
  const empty = exclusiveTotal <= 0;
  const allPaid = paid > 0 && trial <= 0 && free <= 0;
  const avgPaidMajor = paid > 0 ? round2(centsToMajor(snapshot.revenueCents) / paid) : null;

  const paidChips: InsightSalesOpportunityBoard["segments"][number]["chips"] = [];
  if (avgPaidMajor != null) {
    paidChips.push({
      label: `avg ${avgPaidMajor.toFixed(2)} ${snapshot.currency}`,
      tone: "neutral",
    });
  }
  if (evidence.paidProductCount > 0) {
    paidChips.push({
      label: `${evidence.paidProductCount} ${evidence.paidProductCount === 1 ? "product" : "products"}`,
      tone: "neutral",
    });
  }

  const trialChips: InsightSalesOpportunityBoard["segments"][number]["chips"] = [
    { label: `${evidence.trialExpiring7d} expiring in 7 days`, tone: "warning" },
    {
      label: `${evidence.trialLapsed} already lapsed`,
      tone: evidence.trialLapsed > 0 ? "warning" : "neutral",
    },
  ];
  const freeChips: InsightSalesOpportunityBoard["segments"][number]["chips"] = [
    { label: `${evidence.freeActive30d} active in 30 days`, tone: "neutral" },
    {
      label: `${evidence.freeDormant} dormant`,
      tone: evidence.freeDormant > 0 ? "warning" : "neutral",
    },
  ];

  const segments: InsightSalesOpportunityBoard["segments"] = [
    {
      id: "paid",
      label: "Paid enrollments",
      count: paid,
      sharePct: sharePct(paid, exclusiveTotal),
      tone: "success",
      collapsed: false,
      collapsedLabel: null,
      body: "Already converted. Shown for scale.",
      caption: null,
      chips: paidChips,
      primaryHref: null,
      primaryLabel: null,
      secondaryHref: SALES_OPPORTUNITY_PAYMENTS_HREF,
      secondaryLabel: "Open Payments",
    },
    {
      id: "trial",
      label: "Trial enrollments",
      count: trial,
      sharePct: sharePct(trial, exclusiveTotal),
      tone: "warning",
      collapsed: trial <= 0,
      collapsedLabel: "No unconverted trial learners",
      body: "In a trial that has not converted. The highest-intent pool on this screen.",
      caption: null,
      chips: trialChips,
      primaryHref: trial > 0 ? SALES_OPPORTUNITY_MESSAGE_HREF : null,
      primaryLabel: trial > 0 ? "Message trial learners" : null,
      secondaryHref: SALES_OPPORTUNITY_ENROLLMENTS_HREF,
      secondaryLabel: "Open Enrollments",
    },
    {
      id: "free",
      label: "Free enrollments",
      count: free,
      sharePct: sharePct(free, exclusiveTotal),
      tone: "warning",
      collapsed: free <= 0,
      collapsedLabel: "No free enrolments",
      body: "Enrolled on a free product. Lower intent, but the largest pool.",
      caption: null,
      chips: freeChips,
      primaryHref: free > 0 ? SALES_OPPORTUNITY_MESSAGE_HREF : null,
      primaryLabel: free > 0 ? "Message active free learners" : null,
      secondaryHref: SALES_OPPORTUNITY_ENROLLMENTS_HREF,
      secondaryLabel: "Open Enrollments",
    },
    {
      id: "offline",
      label: "Offline / manual",
      count: offline,
      sharePct: sharePct(offline, exclusiveTotal),
      tone: "neutral",
      collapsed: false,
      collapsedLabel: null,
      body: "Granted outside checkout, so no payment record exists. Excluded from conversion rate.",
      caption: "These never appear in the pipeline.",
      chips: [],
      primaryHref: null,
      primaryLabel: null,
      secondaryHref: SALES_OPPORTUNITY_ENROLLMENTS_HREF,
      secondaryLabel: "Open Enrollments",
    },
    {
      id: "online",
      label: "Online (paid + free + trial)",
      count: online,
      sharePct: sharePct(online, exclusiveTotal),
      tone: "muted",
      collapsed: false,
      collapsedLabel: null,
      body: "A rollup of the three segments above, shown because the payload includes it.",
      caption: "This double-counts the rows above.",
      chips: [],
      primaryHref: null,
      primaryLabel: null,
      secondaryHref: null,
      secondaryLabel: null,
    },
  ];

  const mixDenom = paid + trial + free;
  const mix: InsightSalesOpportunityBoard["mix"] = [
    { id: "paid", label: "Paid", count: paid, sharePct: sharePct(paid, mixDenom), kind: "online" },
    {
      id: "trial",
      label: "Trial",
      count: trial,
      sharePct: sharePct(trial, mixDenom),
      kind: "online",
    },
    { id: "free", label: "Free", count: free, sharePct: sharePct(free, mixDenom), kind: "online" },
  ];
  const offlineMix: InsightSalesOpportunityBoard["offlineMix"] = {
    id: "offline",
    label: "Offline / manual",
    count: offline,
    sharePct: sharePct(offline, exclusiveTotal),
    kind: "offline",
  };

  return {
    slug: "sales-insight",
    title: "Conversion opportunity",
    generatedAt,
    currency: snapshot.currency,
    enrollmentsHref: SALES_OPPORTUNITY_ENROLLMENTS_HREF,
    paymentsHref: SALES_OPPORTUNITY_PAYMENTS_HREF,
    messageHref: SALES_OPPORTUNITY_MESSAGE_HREF,
    caveat: SALES_OPPORTUNITY_FOOTNOTE,
    empty,
    allPaid,
    caption: empty
      ? SALES_OPPORTUNITY_EMPTY_CAPTION
      : allPaid
        ? SALES_OPPORTUNITY_ALL_PAID_CAPTION
        : "Trial and free are the conversion pool. Paid is shown for scale.",
    pool,
    paid,
    trial,
    free,
    offline,
    online,
    exclusiveTotal,
    avgPaidMajor,
    paidProductCount: evidence.paidProductCount,
    mixCaption:
      "Online mix excludes offline and the Online rollup, because those overlap or sit outside checkout.",
    mix,
    offlineMix,
    segments,
  };
}

export function salesOpportunityToCsv(board: InsightSalesOpportunityBoard): string {
  const lines = [["Segment", "Count", "Share of enrollments"].join(",")];
  for (const row of board.segments) {
    lines.push(
      [row.label, String(row.count), row.sharePct == null ? "-" : `${row.sharePct}%`].join(","),
    );
  }
  return lines.join("\n");
}
