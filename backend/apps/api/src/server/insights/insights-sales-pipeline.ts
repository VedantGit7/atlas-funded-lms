import type { SalesInsightSnapshot } from "./insights.repository";
import type { InsightSalesPipelineBoard } from "./insights.schemas";
import {
  SALES_PIPELINE_EMPTY_CAPTION,
  salesConversionDisplay,
  salesConversionRate,
  salesDropoffCount,
  salesFormatPct,
  salesFormatSignedPts,
  salesLeakCaption,
  salesPipelinePairCaption,
  salesStepConversionPct,
  type SalesPipelineCounts,
} from "./insights-sales-insight";

export const SALES_PIPELINE_STAGES = [
  {
    key: "visited",
    label: "Visited",
    href: "/admin/insights/sales-insight/widgets/pipeline",
  },
  {
    key: "started-diagnostic",
    label: "Started diagnostic",
    href: "/admin/insights/sales-insight/widgets/pipeline",
  },
  {
    key: "enrolled",
    label: "Enrolled",
    href: "/admin/reports/enrollments",
  },
] as const;

export const SALES_PIPELINE_ENROLLMENTS_HREF = "/admin/reports/enrollments";
export const SALES_PIPELINE_SETTINGS_HREF = "/admin/insights/sales-insight/settings";
export const SALES_PIPELINE_CAVEAT =
  "Visited, started diagnostic, and enrolled are sequential. Later stages are subsets of earlier ones.";

type StageKey = (typeof SALES_PIPELINE_STAGES)[number]["key"];

function stageCount(pipeline: SalesPipelineCounts, key: StageKey): number {
  if (key === "visited") return pipeline.visited;
  if (key === "started-diagnostic") return pipeline.startedDiagnostic;
  return pipeline.enrolled;
}

function priorCount(pipeline: SalesPipelineCounts, key: StageKey): number | null {
  if (key === "visited") return null;
  if (key === "started-diagnostic") return pipeline.visited;
  return pipeline.startedDiagnostic;
}

function windowBoard(
  id: "all-time" | "30d",
  label: string,
  pipeline: SalesPipelineCounts,
): InsightSalesPipelineBoard["allTime"] {
  const conversionPct = salesConversionRate(pipeline.visited, pipeline.enrolled);
  return {
    id,
    label,
    visited: pipeline.visited,
    startedDiagnostic: pipeline.startedDiagnostic,
    enrolled: pipeline.enrolled,
    conversionPct,
    conversionDisplay: salesConversionDisplay(pipeline.visited, pipeline.enrolled),
    empty: pipeline.visited <= 0,
  };
}

function dropoffRateDisplay(from: number, drop: number): string {
  return salesFormatPct(salesStepConversionPct(from, drop));
}

export function buildInsightSalesPipeline(
  snapshot: Pick<SalesInsightSnapshot, "pipeline" | "pipeline30d">,
  generatedAt = new Date().toISOString(),
): InsightSalesPipelineBoard {
  const allTime = snapshot.pipeline;
  const recent = snapshot.pipeline30d;
  const conversionAllPct = salesConversionRate(allTime.visited, allTime.enrolled);
  const conversion30dPct = salesConversionRate(recent.visited, recent.enrolled);
  const differencePts =
    conversionAllPct == null || conversion30dPct == null
      ? null
      : conversion30dPct - conversionAllPct;
  const empty = allTime.visited <= 0 && recent.visited <= 0;
  const caption = salesPipelinePairCaption(allTime, recent) ?? SALES_PIPELINE_EMPTY_CAPTION;
  const leakCaption = salesLeakCaption(allTime, recent);

  const stages = SALES_PIPELINE_STAGES.map((stage) => {
    const allTimeCount = stageCount(allTime, stage.key);
    const recentCount = stageCount(recent, stage.key);
    const allPrior = priorCount(allTime, stage.key);
    const recentPrior = priorCount(recent, stage.key);
    const allTimeConvPct = allPrior == null ? null : salesStepConversionPct(allPrior, allTimeCount);
    const recentConvPct =
      recentPrior == null ? null : salesStepConversionPct(recentPrior, recentCount);
    const deltaPts =
      allTimeConvPct == null || recentConvPct == null
        ? null
        : Math.round((recentConvPct - allTimeConvPct) * 10) / 10;
    return {
      key: stage.key,
      label: stage.label,
      href: stage.href,
      allTimeCount,
      recentCount,
      allTimeConvPct,
      recentConvPct,
      allTimeConvDisplay: salesFormatPct(allTimeConvPct),
      recentConvDisplay: salesFormatPct(recentConvPct),
      deltaPts,
      deltaDisplay: salesFormatSignedPts(deltaPts),
    };
  });

  const dropoffs = [
    {
      id: "visited-to-started",
      fromKey: "visited" as const,
      toKey: "started-diagnostic" as const,
      label: "Visited to started diagnostic",
      allTimeCount: salesDropoffCount(allTime.visited, allTime.startedDiagnostic),
      allTimeRateDisplay: dropoffRateDisplay(
        allTime.visited,
        salesDropoffCount(allTime.visited, allTime.startedDiagnostic),
      ),
      recentCount: salesDropoffCount(recent.visited, recent.startedDiagnostic),
      recentRateDisplay: dropoffRateDisplay(
        recent.visited,
        salesDropoffCount(recent.visited, recent.startedDiagnostic),
      ),
    },
    {
      id: "started-to-enrolled",
      fromKey: "started-diagnostic" as const,
      toKey: "enrolled" as const,
      label: "Started diagnostic to enrolled",
      allTimeCount: salesDropoffCount(allTime.startedDiagnostic, allTime.enrolled),
      allTimeRateDisplay: dropoffRateDisplay(
        allTime.startedDiagnostic,
        salesDropoffCount(allTime.startedDiagnostic, allTime.enrolled),
      ),
      recentCount: salesDropoffCount(recent.startedDiagnostic, recent.enrolled),
      recentRateDisplay: dropoffRateDisplay(
        recent.startedDiagnostic,
        salesDropoffCount(recent.startedDiagnostic, recent.enrolled),
      ),
    },
  ];

  let differenceTone: InsightSalesPipelineBoard["differenceTone"] = "empty";
  if (differencePts != null) {
    if (differencePts > 0) differenceTone = "up";
    else if (differencePts < 0) differenceTone = "down";
    else differenceTone = "flat";
  }

  return {
    slug: "sales-insight",
    title: "Sales pipeline",
    generatedAt,
    enrollmentsHref: SALES_PIPELINE_ENROLLMENTS_HREF,
    settingsHref: SALES_PIPELINE_SETTINGS_HREF,
    caveat: SALES_PIPELINE_CAVEAT,
    empty,
    caption,
    leakCaption,
    conversionAllPct,
    conversionAllDisplay: salesConversionDisplay(allTime.visited, allTime.enrolled),
    conversion30dPct,
    conversion30dDisplay: salesConversionDisplay(recent.visited, recent.enrolled),
    differencePts,
    differenceDisplay: salesFormatSignedPts(differencePts),
    differenceTone,
    visited30d: recent.visited,
    enrolled30d: recent.enrolled,
    allTime: windowBoard("all-time", "All time", allTime),
    recent: windowBoard("30d", "Last 30 days", recent),
    stages,
    dropoffs,
  };
}

export function salesPipelineToCsv(board: InsightSalesPipelineBoard): string {
  const lines = [
    [
      "Stage",
      "All-time count",
      "All-time conversion",
      "30-day count",
      "30-day conversion",
      "Difference",
    ].join(","),
  ];
  for (const stage of board.stages) {
    lines.push(
      [
        stage.label,
        String(stage.allTimeCount),
        stage.allTimeConvDisplay,
        String(stage.recentCount),
        stage.recentConvDisplay,
        stage.deltaDisplay,
      ].join(","),
    );
  }
  return lines.join("\n");
}
