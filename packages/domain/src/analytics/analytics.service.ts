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

  const itemIds = await deps.resolveAssessmentItemIds(tx, query.assessmentId);
  const rows = await analyticsRepository.listItemStatisticsForAssessment(tx, {
    itemIds,
    windowKey: query.windowKey,
    cursor: query.cursor ?? null,
    limit: query.limit,
  });

  const pageRows = rows.slice(0, query.limit);
  const hasNextPage = rows.length > query.limit;
  const nextCursor = hasNextPage ? (pageRows.at(-1)?.id ?? null) : null;
  const references = await deps.resolveItemReferences(
    tx,
    pageRows.map((row) => row.item_id),
  );

  const items = pageRows
    .map((row) => {
      const reference = references.get(row.item_id);
      if (!reference) {
        return null;
      }

      const attemptsCount = row.attempts_count;
      const correctCount = row.correct_count;

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
