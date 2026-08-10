import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  superLiveInsightDetailResponseSchema,
  superLiveInsightsListResponseSchema,
  type SuperLiveInsightsListQuery,
} from "./super-live-insights-roster.dto";
import { superLiveSessionNotFound } from "./super-live-insights-roster.errors";
import {
  superLiveInsightsRosterRepository,
  type SuperLiveInsightRow,
} from "./super-live-insights-roster.repository";

function pageInfo(totalCount: number, page: number, limit: number) {
  const totalPages = totalCount === 0 ? 0 : Math.ceil(totalCount / limit);
  return {
    page,
    pageSize: limit,
    totalCount,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
}

function mapInsightItem(row: SuperLiveInsightRow) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    courseId: row.course_id,
    courseTitle: row.course_title,
    batchId: row.batch_id,
    batchName: row.batch_name,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    attendedCount: row.attended_count,
    registeredCount: row.registered_count,
    absentCount: row.absent_count,
    totalCount: row.total_count,
    avgDurationSeconds: row.avg_duration_seconds,
    attendanceRate: row.attendance_rate,
  };
}

export async function listSuperLiveInsights(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SuperLiveInsightsListQuery,
) {
  const [totalCount, rows, summary] = await Promise.all([
    superLiveInsightsRosterRepository.countSessions(tx, query),
    superLiveInsightsRosterRepository.listSessions(tx, query),
    superLiveInsightsRosterRepository.summarizeSessions(tx, query),
  ]);

  return superLiveInsightsListResponseSchema.parse({
    data: {
      items: rows.map(mapInsightItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
      summary,
    },
  });
}

export async function getSuperLiveInsightDetail(tx: TenantTx, _ctx: ServiceCtx, sessionId: string) {
  const meta = await superLiveInsightsRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw superLiveSessionNotFound();

  const context = await superLiveInsightsRosterRepository.getSessionInsightContext(tx, meta);

  return superLiveInsightDetailResponseSchema.parse({
    data: {
      session: mapInsightItem(meta),
      context: {
        courseAvgAttendanceRate: context.courseAvgAttendanceRate,
        tenantAvgAttendanceRate: context.tenantAvgAttendanceRate,
        courseRateP25: context.courseRateP25,
        courseRateP75: context.courseRateP75,
        courseAvgDurationSeconds: context.courseAvgDurationSeconds,
        durationCoveragePct: context.durationCoveragePct,
        rateDeltaVsCourse: context.rateDeltaVsCourse,
        courseRankCaption: context.courseRankCaption,
        estimatedTurnout: context.estimatedTurnout,
        cancelledAt: context.cancelledAt?.toISOString() ?? null,
        series: context.series.map((item) => ({
          id: item.id,
          title: item.title,
          scheduledAt: item.scheduledAt?.toISOString() ?? null,
          attendanceRate: item.attendanceRate,
          isCurrent: item.isCurrent,
        })),
        trend: context.trend.map((item) => ({
          id: item.id,
          title: item.title,
          label: item.label,
          attendanceRate: item.attendanceRate,
          isCurrent: item.isCurrent,
          isFuture: item.isFuture,
        })),
        trendDeltaPoints: context.trendDeltaPoints,
      },
    },
  });
}
