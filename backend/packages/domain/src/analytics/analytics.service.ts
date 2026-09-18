import type { TenantTx } from "@atlas/db";
import type { AnalyticsServiceCtx } from "./analytics.types";
import {
  getDashboardDefinition,
  parseBoundedDateRange,
  resolveTenantSubjectId,
} from "./analytics-definition-registry";
import {
  analyticsCourseScopeRequired,
  invalidAnalyticsDateRange,
  unknownAnalyticsDashboardKey,
} from "./analytics.errors";
import type { AnalyticsDashboardQuery } from "./analytics.dto";
import { analyticsDashboardResponseSchema } from "./analytics.dto";
import { analyticsRepository } from "./analytics.repository";
import {
  buildItemPsychometrics,
  computeDifficulty,
  computeDiscriminationFromLatency,
  computeDiscriminationStub,
  type DistractorRate,
  type ItemPsychometrics,
} from "./analytics-psychometrics";

export function resolveDashboardSubjectScope(args: {
  tenantId: string;
  dashboardKey: string;
  courseId?: string;
}): { subjectType: "tenant" | "course"; subjectId: string } {
  const definition = getDashboardDefinition(args.dashboardKey);
  if (!definition) {
    throw unknownAnalyticsDashboardKey(args.dashboardKey);
  }

  if (definition.scopeType === "course") {
    if (!args.courseId) {
      throw analyticsCourseScopeRequired();
    }

    return { subjectType: "course", subjectId: args.courseId };
  }

  return {
    subjectType: "tenant",
    subjectId: resolveTenantSubjectId(args.tenantId),
  };
}

export async function queryAnalyticsDashboard(
  tx: TenantTx,
  ctx: AnalyticsServiceCtx,
  rawQuery: unknown,
  options?: { bypassRelationshipScope?: boolean },
) {
  const query = rawQuery as AnalyticsDashboardQuery;
  const dashboardKey = query.dashboardKey ?? "tenant.learning";
  const definition = getDashboardDefinition(dashboardKey);

  if (!definition) {
    throw unknownAnalyticsDashboardKey(dashboardKey);
  }

  if (definition.scopeType === "course" && !query.courseId && !options?.bypassRelationshipScope) {
    throw analyticsCourseScopeRequired();
  }

  let dateRange: { from: Date; to: Date };
  try {
    dateRange = parseBoundedDateRange({
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });
  } catch (error) {
    throw invalidAnalyticsDateRange(error instanceof Error ? error.message : "Invalid date range.");
  }

  const subject = resolveDashboardSubjectScope({
    tenantId: ctx.tenantId,
    dashboardKey,
    ...(query.courseId ? { courseId: query.courseId } : {}),
  });

  const rows = await analyticsRepository.listRollups(tx, {
    rollupKeys: definition.rollupKeys,
    subject,
    from: dateRange.from,
    to: dateRange.to,
    cursor: query.cursor ?? null,
    limit: query.limit,
  });

  const pageRows = rows.slice(0, query.limit);
  const hasNextPage = rows.length > query.limit;
  const nextCursor = hasNextPage ? (pageRows.at(-1)?.id ?? null) : null;

  const metrics = pageRows.map((row) => ({
    rollupKey: row.rollup_key,
    periodStart: row.period_start.toISOString(),
    periodEnd: row.period_end.toISOString(),
    count: Number(row.metrics_json["count"] ?? 0),
  }));

  const totalEvents = metrics.reduce((sum, metric) => sum + metric.count, 0);

  return analyticsDashboardResponseSchema.parse({
    data: {
      dashboardKey,
      courseId: subject.subjectType === "course" ? subject.subjectId : null,
      from: dateRange.from.toISOString().slice(0, 10),
      to: dateRange.to.toISOString().slice(0, 10),
      metrics,
      summary: { totalEvents },
      pageInfo: {
        nextCursor,
        hasNextPage,
      },
    },
  });
}

export async function queryAnalyticsFunnel(
  tx: TenantTx,
  ctx: AnalyticsServiceCtx,
  rawQuery: unknown,
) {
  const query = rawQuery as { funnelKey?: string; from?: string; to?: string };
  const funnelKey = query.funnelKey ?? "learning.engagement";

  const { getFunnelDefinition } = await import("./analytics-definition-registry");
  const definition = getFunnelDefinition(funnelKey);
  if (!definition) {
    const { unknownAnalyticsFunnelKey } = await import("./analytics.errors");
    throw unknownAnalyticsFunnelKey(funnelKey);
  }

  let dateRange: { from: Date; to: Date };
  try {
    dateRange = parseBoundedDateRange({
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });
  } catch (error) {
    throw invalidAnalyticsDateRange(error instanceof Error ? error.message : "Invalid date range.");
  }

  const rows = await analyticsRepository.listFunnelRollups(tx, {
    funnelKey,
    stageKeys: definition.stageKeys,
    from: dateRange.from,
    to: dateRange.to,
  });

  const dayMap = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const dayKey = row.day.toISOString().slice(0, 10);
    const stages = dayMap.get(dayKey) ?? new Map<string, number>();
    stages.set(row.stage_key, row.count);
    dayMap.set(dayKey, stages);
  }

  const days = [...dayMap.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([day, stages]) => ({
      day,
      stages: definition.stageKeys.map((stageKey) => ({
        stageKey,
        count: stages.get(stageKey) ?? 0,
      })),
    }));

  const { analyticsFunnelResponseSchema } = await import("./analytics.dto");

  return analyticsFunnelResponseSchema.parse({
    data: {
      funnelKey,
      from: dateRange.from.toISOString().slice(0, 10),
      to: dateRange.to.toISOString().slice(0, 10),
      days,
    },
  });
}

export type ItemReferenceResolver = (
  tx: TenantTx,
  itemIds: string[],
) => Promise<Map<string, { label: string }>>;

export type AssessmentItemIdsResolver = (tx: TenantTx, assessmentId: string) => Promise<string[]>;

function parseStoredPsychometrics(
  metricsJson: Record<string, unknown> | null,
  attemptsCount: number,
  correctCount: number,
): ItemPsychometrics {
  if (metricsJson && typeof metricsJson["qualityFlag"] === "string") {
    return {
      difficulty:
        typeof metricsJson["difficulty"] === "number"
          ? metricsJson["difficulty"]
          : computeDifficulty(attemptsCount, correctCount),
      discrimination:
        typeof metricsJson["discrimination"] === "number"
          ? metricsJson["discrimination"]
          : computeDiscriminationStub(attemptsCount, correctCount),
      distractorRates: Array.isArray(metricsJson["distractorRates"])
        ? (metricsJson["distractorRates"] as ItemPsychometrics["distractorRates"])
        : null,
      sampleSizeWarning:
        typeof metricsJson["sampleSizeWarning"] === "boolean"
          ? metricsJson["sampleSizeWarning"]
          : attemptsCount < 50,
      qualityFlag: metricsJson["qualityFlag"] as ItemPsychometrics["qualityFlag"],
    };
  }

  return buildItemPsychometrics({ attemptsCount, correctCount });
}

async function enrichItemPsychometrics(
  tx: TenantTx,
  args: {
    itemIds: string[];
    rows: Array<{
      item_id: string;
      attempts_count: number;
      correct_count: number;
      metrics_json: Record<string, unknown> | null;
    }>;
    rollingCutoff: Date | null;
  },
): Promise<Map<string, ItemPsychometrics>> {
  const latencyByItem = await analyticsRepository.getItemLatencyDiscrimination(
    tx,
    args.itemIds,
    args.rollingCutoff,
  );
  const distractorByItem = args.rollingCutoff
    ? await analyticsRepository.getItemDistractorRatesFromAnswers(
        tx,
        args.itemIds,
        args.rollingCutoff,
      )
    : new Map<string, DistractorRate[]>();

  const result = new Map<string, ItemPsychometrics>();

  for (const row of args.rows) {
    const attemptsCount = row.attempts_count;
    const correctCount = row.correct_count;
    const storedMetrics = row.metrics_json;
    const latency = latencyByItem.get(row.item_id);

    const discrimination: number | null =
      attemptsCount >= 10 && latency
        ? (computeDiscriminationFromLatency({
            meanCorrectLatencyMs: latency.meanCorrectLatencyMs,
            meanIncorrectLatencyMs: latency.meanIncorrectLatencyMs,
          }) ?? computeDiscriminationStub(attemptsCount, correctCount))
        : computeDiscriminationStub(attemptsCount, correctCount);

    const rollingDistractors = distractorByItem.get(row.item_id) ?? null;
    const storedDistractors = Array.isArray(storedMetrics?.["distractorRates"])
      ? (storedMetrics["distractorRates"] as Array<{ optionId: string; rate: number }>)
      : null;

    const psychometrics = buildItemPsychometrics({
      attemptsCount,
      correctCount,
      discrimination,
    });

    result.set(row.item_id, {
      ...psychometrics,
      distractorRates: rollingDistractors ?? storedDistractors,
    });
  }

  return result;
}

export async function queryDashboardDrillDown(
  tx: TenantTx,
  ctx: AnalyticsServiceCtx,
  rawQuery: unknown,
) {
  const { analyticsDashboardDrillDownQuerySchema, analyticsDashboardDrillDownResponseSchema } =
    await import("./analytics.dto");

  const query = analyticsDashboardDrillDownQuerySchema.parse(rawQuery);
  const { members, capped } = await analyticsRepository.listDrillDownMembers(tx, {
    rollupKey: query.rollupKey,
    day: query.day,
    courseId: query.courseId ?? null,
    limit: query.limit,
  });

  return analyticsDashboardDrillDownResponseSchema.parse({
    data: {
      rollupKey: query.rollupKey,
      day: query.day,
      members,
      capped,
    },
  });
}

export async function queryItemStatistics(
  tx: TenantTx,
  ctx: AnalyticsServiceCtx,
  rawQuery: unknown,
  deps: {
    resolveAssessmentItemIds: AssessmentItemIdsResolver;
    resolveItemReferences: ItemReferenceResolver;
  },
) {
  const { analyticsItemStatisticsQuerySchema, analyticsItemStatisticsResponseSchema } =
    await import("./analytics.dto");
  const query = analyticsItemStatisticsQuerySchema.parse(rawQuery);

  const { itemStatisticWindowCutoff, isRollingItemStatisticWindow } =
    await import("./analytics-window");

  const itemIds = await deps.resolveAssessmentItemIds(tx, query.assessmentId);
  const rollingCutoff = isRollingItemStatisticWindow(query.windowKey)
    ? itemStatisticWindowCutoff(query.windowKey)
    : null;

  const rows = await analyticsRepository.listItemStatisticsForAssessment(tx, {
    itemIds,
    windowKey: query.windowKey,
    cursor: query.cursor ?? null,
    limit: query.limit,
    rollingCutoff,
  });

  const pageRows = rows.slice(0, query.limit);
  const hasNextPage = rows.length > query.limit;
  const nextCursor = hasNextPage ? (pageRows.at(-1)?.id ?? null) : null;
  const references = await deps.resolveItemReferences(
    tx,
    pageRows.map((row) => row.item_id),
  );

  const psychometricsByItem = await enrichItemPsychometrics(tx, {
    itemIds: pageRows.map((row) => row.item_id),
    rows: pageRows,
    rollingCutoff,
  });

  const items = pageRows
    .map((row) => {
      const reference = references.get(row.item_id);
      if (!reference) {
        return null;
      }

      const attemptsCount = row.attempts_count;
      const correctCount = row.correct_count;
      const psychometrics =
        psychometricsByItem.get(row.item_id) ??
        parseStoredPsychometrics(row.metrics_json, attemptsCount, correctCount);

      return {
        itemReference: {
          itemId: row.item_id,
          label: reference.label,
        },
        attemptsCount,
        correctCount,
        accuracy: attemptsCount > 0 ? correctCount / attemptsCount : null,
        averageLatencyMs: row.avg_latency_ms,
        calculatedAt: row.calculated_at.toISOString(),
        windowKey: query.windowKey,
        difficulty: psychometrics.difficulty,
        discrimination: psychometrics.discrimination,
        distractorRates: psychometrics.distractorRates,
        sampleSizeWarning: psychometrics.sampleSizeWarning,
        qualityFlag: psychometrics.qualityFlag,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  return analyticsItemStatisticsResponseSchema.parse({
    data: {
      assessmentId: query.assessmentId,
      windowKey: query.windowKey,
      items,
      pageInfo: {
        nextCursor,
        hasNextPage,
      },
    },
  });
}
