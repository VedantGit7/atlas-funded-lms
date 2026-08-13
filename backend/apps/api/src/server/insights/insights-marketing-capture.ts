import type { InsightMarketingCaptureBoard } from "./insights.schemas";

export const MARKETING_CAPTURE_EMPTY = "No capture surfaces published yet";
export const MARKETING_CAPTURE_CHAIN_CAPTION =
  "Contacts include people captured outside these forms, so the final step can exceed the one before it. This is a chain of related measures, not a strict funnel.";
export const MARKETING_CAPTURE_FORMS_HREF = "/admin/marketing/forms";
export const MARKETING_CAPTURE_CTAS_HREF = "/admin/marketing/cta";
/** Aligns with the `low-cta-click-rate` alert default threshold. */
export const MARKETING_CAPTURE_CLICK_RATE_WARN = 5;
export const MARKETING_CAPTURE_UNSTABLE_VIEWS = 100;

export type MarketingCaptureFormInput = {
  id: string;
  title: string;
  status: string;
  submissions: number;
  submissions30d: number;
  lastSubmissionAt: string | null;
  href: string;
};

export type MarketingCaptureCtaInput = {
  id: string;
  title: string;
  ctaType: string;
  status: string;
  views: number;
  clicks: number;
  href: string;
};

export type MarketingCaptureSnapshotInput = {
  formCount: number;
  liveFormCount: number;
  submissionCount: number;
  submissions30d: number;
  contactCount: number;
  ctaCount: number;
  liveCtaCount: number;
  ctaViews: number;
  ctaClicks: number;
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function clickRate(views: number, clicks: number): number | null {
  if (views <= 0) return null;
  return round1((clicks / views) * 100);
}

/** Step-to-step signed change: (next - prev) / prev * 100. */
function connectorDeltaPct(prev: number, next: number): number | null {
  if (prev <= 0) return null;
  return round1(((next - prev) / prev) * 100);
}

function plural(count: number, singular: string, pluralWord: string): string {
  return count === 1 ? singular : pluralWord;
}

function buildChain(
  ctaViews: number,
  ctaClicks: number,
  submissionCount: number,
  contactCount: number,
): InsightMarketingCaptureBoard["chain"] {
  const counts = [
    { id: "cta-views", label: "CTA views", count: ctaViews },
    { id: "cta-clicks", label: "CTA clicks", count: ctaClicks },
    { id: "form-submissions", label: "Form submissions", count: submissionCount },
    { id: "contacts", label: "Contacts created", count: contactCount },
  ];

  const maxCount = Math.max(...counts.map((step) => step.count), 1);

  const drops: Array<{ index: number; drop: number; fromLabel: string; toLabel: string }> = [];
  for (let index = 0; index < counts.length - 1; index += 1) {
    const prev = counts[index];
    const next = counts[index + 1];
    if (!prev || !next) continue;
    if (next.count < prev.count) {
      drops.push({
        index,
        drop: prev.count - next.count,
        fromLabel: prev.label,
        toLabel: next.label,
      });
    }
  }

  const largestDrop =
    drops.length > 0
      ? drops.reduce((best, current) => (current.drop > best.drop ? current : best))
      : null;

  const steps = counts.map((step, index) => {
    const next = counts[index + 1];
    const ratePct = next ? connectorDeltaPct(step.count, next.count) : null;
    return {
      id: step.id,
      label: step.label,
      count: step.count,
      barSharePct: round1((step.count / maxCount) * 100),
      connectorRatePct: ratePct,
      connectorIsLargestDrop: largestDrop?.index === index,
    };
  });

  const dropCaption =
    largestDrop != null
      ? `Largest drop: ${largestDrop.fromLabel} to ${largestDrop.toLabel} (${formatInsightCount(largestDrop.drop)} absolute).`
      : null;

  return {
    steps,
    caption: MARKETING_CAPTURE_CHAIN_CAPTION,
    dropCaption,
  };
}

function formatInsightCount(value: number): string {
  return value.toLocaleString("en-IN");
}

function buildClickRateByType(
  ctas: MarketingCaptureCtaInput[],
  overallRate: number | null,
): InsightMarketingCaptureBoard["clickRateByType"] {
  const byType = new Map<string, { views: number; clicks: number }>();
  for (const cta of ctas) {
    const existing = byType.get(cta.ctaType) ?? { views: 0, clicks: 0 };
    byType.set(cta.ctaType, {
      views: existing.views + cta.views,
      clicks: existing.clicks + cta.clicks,
    });
  }

  const rows = [...byType.entries()]
    .map(([type, totals]) => ({
      type,
      views: totals.views,
      clicks: totals.clicks,
      clickRatePct: clickRate(totals.views, totals.clicks),
      unstable: totals.views > 0 && totals.views < MARKETING_CAPTURE_UNSTABLE_VIEWS,
    }))
    .sort(
      (left, right) =>
        (right.clickRatePct ?? -1) - (left.clickRatePct ?? -1) ||
        right.views - left.views ||
        left.type.localeCompare(right.type),
    );

  let best: (typeof rows)[number] | null = null;
  let worst: (typeof rows)[number] | null = null;
  for (const row of rows) {
    if (row.views <= 0 || row.clickRatePct == null) continue;
    if (!best || row.clickRatePct > (best.clickRatePct ?? -1)) best = row;
    if (!worst || row.clickRatePct < (worst.clickRatePct ?? Infinity)) worst = row;
  }

  let caption: string | null = null;
  if (rows.length === 0) {
    caption = "No CTA types to compare yet.";
  } else if (best && worst && best.type !== worst.type) {
    caption = `Best: ${best.type} (${String(best.clickRatePct ?? 0)}%). Worst: ${worst.type} (${String(worst.clickRatePct ?? 0)}%).`;
  } else if (best) {
    caption = `${best.type} is the only type with recorded views.`;
  }

  const unstableTypes = rows.filter((row) => row.unstable).map((row) => row.type);
  if (unstableTypes.length > 0) {
    const unstableNote = `Rates for ${unstableTypes.join(", ")} are unstable with fewer than ${String(MARKETING_CAPTURE_UNSTABLE_VIEWS)} views.`;
    caption = caption ? `${caption} ${unstableNote}` : unstableNote;
  }

  return {
    rows,
    overallRatePct: overallRate,
    caption,
  };
}

function mapForms(
  forms: MarketingCaptureFormInput[],
  totalSubmissions: number,
): InsightMarketingCaptureBoard["forms"] {
  return forms.map((form) => {
    const isLive = form.status.toUpperCase() === "LIVE";
    const sharePct =
      totalSubmissions > 0 ? round1((form.submissions / totalSubmissions) * 100) : null;
    const zero30dWarning = isLive && form.submissions30d === 0;
    return {
      id: form.id,
      title: form.title,
      status: form.status,
      submissions: form.submissions,
      submissionSharePct: sharePct,
      submissions30d: form.submissions30d,
      submissions30dWarning: zero30dWarning,
      lastSubmissionAt: form.lastSubmissionAt,
      href: form.href,
      isDraft: form.status.toUpperCase() === "DRAFT",
      warningRail: zero30dWarning,
    };
  });
}

function mapCtas(ctas: MarketingCaptureCtaInput[]): InsightMarketingCaptureBoard["ctas"] {
  return ctas.map((cta) => {
    const rate = clickRate(cta.views, cta.clicks);
    const noViews = cta.views <= 0;
    return {
      id: cta.id,
      title: cta.title,
      ctaType: cta.ctaType,
      status: cta.status,
      views: cta.views,
      clicks: cta.clicks,
      clickRatePct: rate,
      clickRateWarning: rate != null && rate < MARKETING_CAPTURE_CLICK_RATE_WARN && cta.views > 0,
      noViews,
      href: cta.href,
    };
  });
}

export function buildInsightMarketingCapture(
  snapshot: MarketingCaptureSnapshotInput,
  forms: MarketingCaptureFormInput[],
  ctas: MarketingCaptureCtaInput[],
  generatedAt = new Date().toISOString(),
): InsightMarketingCaptureBoard {
  const empty = snapshot.formCount <= 0 && snapshot.ctaCount <= 0;
  const overallClickRate = clickRate(snapshot.ctaViews, snapshot.ctaClicks);
  const zeroSubmissionWarning = snapshot.liveFormCount > 0 && snapshot.submissions30d === 0;
  const warningMessage = zeroSubmissionWarning
    ? `${String(snapshot.liveFormCount)} live ${plural(snapshot.liveFormCount, "form", "forms")} but no submissions in the last 30 days.`
    : null;

  const chain = buildChain(
    snapshot.ctaViews,
    snapshot.ctaClicks,
    snapshot.submissionCount,
    snapshot.contactCount,
  );

  const clickRateByType = buildClickRateByType(ctas, overallClickRate);

  return {
    slug: "marketing-insight",
    title: "Capture",
    subtitle: "How forms and CTAs are performing, and where the drop happens.",
    generatedAt,
    empty,
    zeroSubmissionWarning,
    warningMessage,
    warningTitle: zeroSubmissionWarning ? "No form submissions (30d)" : null,
    chainCaption: MARKETING_CAPTURE_CHAIN_CAPTION,
    formsCaption: "Only live forms can collect submissions.",
    manageFormsHref: MARKETING_CAPTURE_FORMS_HREF,
    manageCtasHref: MARKETING_CAPTURE_CTAS_HREF,
    createFormHref: `${MARKETING_CAPTURE_FORMS_HREF}/create`,
    emptyCaption: MARKETING_CAPTURE_EMPTY,
    clickRateWarnThreshold: MARKETING_CAPTURE_CLICK_RATE_WARN,
    unstableViewThreshold: MARKETING_CAPTURE_UNSTABLE_VIEWS,
    overallClickRatePct: overallClickRate,
    ctaViews: snapshot.ctaViews,
    ctaClicks: snapshot.ctaClicks,
    submissionCount: snapshot.submissionCount,
    submissions30d: snapshot.submissions30d,
    submissions30dWarning: zeroSubmissionWarning,
    formCount: snapshot.formCount,
    liveFormCount: snapshot.liveFormCount,
    ctaCount: snapshot.ctaCount,
    liveCtaCount: snapshot.liveCtaCount,
    contactCount: snapshot.contactCount,
    chain,
    forms: mapForms(forms, snapshot.submissionCount),
    ctas: mapCtas(ctas),
    clickRateByType,
  };
}

export function marketingCaptureToCsv(board: InsightMarketingCaptureBoard): string {
  const lines = [
    "Metric,Value",
    `CTA click rate %,${board.overallClickRatePct == null ? "-" : `${board.overallClickRatePct}%`}`,
    `CTA views,${String(board.ctaViews)}`,
    `CTA clicks,${String(board.ctaClicks)}`,
    `Form submissions,${String(board.submissionCount)}`,
    `Submissions (30d),${String(board.submissions30d)}`,
    `Contacts created,${String(board.contactCount)}`,
    "",
    "Form,Status,Submissions,Submissions (30d),Last submission",
    ...board.forms.map((form) =>
      [
        form.title,
        form.status,
        String(form.submissions),
        String(form.submissions30d),
        form.lastSubmissionAt ?? "Never",
      ].join(","),
    ),
    "",
    "CTA,Type,Status,Views,Clicks,Click rate %",
    ...board.ctas.map((cta) =>
      [
        cta.title,
        cta.ctaType,
        cta.status,
        String(cta.views),
        String(cta.clicks),
        cta.clickRatePct == null ? "-" : `${cta.clickRatePct}%`,
      ].join(","),
    ),
    "",
    "CTA type,Views,Clicks,Click rate %",
    ...board.clickRateByType.rows.map((row) =>
      [
        row.type,
        String(row.views),
        String(row.clicks),
        row.clickRatePct == null ? "-" : `${row.clickRatePct}%`,
      ].join(","),
    ),
  ];

  return lines.join("\n");
}
