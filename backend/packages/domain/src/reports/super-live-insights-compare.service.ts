import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  superLiveInsightsCompareCandidatesResponseSchema,
  superLiveInsightsCompareResponseSchema,
  type SuperLiveInsightsCompareCandidatesQuery,
  type SuperLiveInsightsCompareQuery,
} from "./super-live-insights-compare.dto";
import {
  superLiveCompareNotFound,
  superLiveCompareTooFew,
} from "./super-live-insights-compare.errors";
import {
  superLiveInsightsCompareRepository,
  type CompareSessionRow,
  type CompareSeriesRow,
} from "./super-live-insights-compare.repository";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function coveragePct(
  avgDurationSeconds: number | null,
  sessionDurationSeconds: number | null,
): number | null {
  if (avgDurationSeconds == null || sessionDurationSeconds == null || sessionDurationSeconds <= 0) {
    return null;
  }
  return round1(Math.min(100, (avgDurationSeconds / sessionDurationSeconds) * 100));
}

function formatScheduledSlot(date: Date | null): string | null {
  if (!date) return null;
  return date.toLocaleString("en-GB", {
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

function compositionCaption(
  items: Array<{
    title: string;
    metrics: { attendanceRate: number | null };
    composition: { registeredCount: number; absentCount: number; totalCount: number };
  }>,
): string | null {
  if (items.length < 2) return null;
  for (let i = 0; i < items.length; i += 1) {
    for (let j = i + 1; j < items.length; j += 1) {
      const a = items[i];
      const b = items[j];
      if (a == null || b == null) continue;
      if (a.metrics.attendanceRate == null || b.metrics.attendanceRate == null) continue;
      if (Math.abs(a.metrics.attendanceRate - b.metrics.attendanceRate) > 1.5) continue;
      const aRegShare =
        a.composition.totalCount > 0 ? a.composition.registeredCount / a.composition.totalCount : 0;
      const bRegShare =
        b.composition.totalCount > 0 ? b.composition.registeredCount / b.composition.totalCount : 0;
      if (Math.abs(aRegShare - bRegShare) < 0.08) continue;
      return `${a.title} and ${b.title} share a similar attendance rate but differ in unresolved versus absent mix.`;
    }
  }
  return null;
}

function mapSessionItem(row: CompareSessionRow, colorIndex: number) {
  const cov = coveragePct(row.avg_duration_seconds, row.duration_seconds);
  return {
    id: row.id,
    title: row.title,
    subtitle: [row.course_title, row.batch_name].filter(Boolean).join(" · ") || null,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    courseTitle: row.course_title,
    batchName: row.batch_name,
    colorIndex,
    metrics: {
      totalRecords: row.total_count,
      attendedCount: row.attended_count,
      registeredCount: row.registered_count,
      absentCount: row.absent_count,
      attendanceRate: row.attendance_rate,
      avgDurationSeconds: row.avg_duration_seconds,
      sessionDurationSeconds: row.duration_seconds,
      coveragePct: cov,
      startDelaySeconds: row.start_delay_seconds,
      scheduledSlot: formatScheduledSlot(row.scheduled_at),
      sessionsHeld: null,
    },
    composition: {
      attendedCount: row.attended_count,
      registeredCount: row.registered_count,
      absentCount: row.absent_count,
      totalCount: row.total_count,
    },
  };
}

function mapSeriesItem(
  row: CompareSeriesRow,
  colorIndex: number,
  trend: Array<{ index: number; label: string; attendanceRate: number | null }>,
) {
  return {
    id: row.id,
    title: row.title,
    subtitle: `${row.session_count} sessions`,
    scheduledAt: null,
    courseTitle: null,
    batchName: null,
    colorIndex,
    metrics: {
      totalRecords: row.total_count,
      attendedCount: row.attended_count,
      registeredCount: row.registered_count,
      absentCount: row.absent_count,
      attendanceRate: row.avg_rate,
      avgDurationSeconds: row.avg_duration_seconds,
      sessionDurationSeconds: row.avg_session_duration_seconds,
      coveragePct: row.avg_coverage_pct,
      startDelaySeconds: row.avg_start_delay_seconds,
      scheduledSlot: null,
      sessionsHeld: row.session_count,
    },
    composition: {
      attendedCount: row.attended_count,
      registeredCount: row.registered_count,
      absentCount: row.absent_count,
      totalCount: row.total_count,
    },
    trend,
  };
}

export async function getSuperLiveInsightsCompare(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SuperLiveInsightsCompareQuery,
) {
  if (query.ids.length < 2) throw superLiveCompareTooFew();

  const tenantAverages = await superLiveInsightsCompareRepository.tenantAverages(tx);

  if (query.mode === "series") {
    const kind = query.seriesKind ?? "course";
    const [rows, trends] = await Promise.all([
      superLiveInsightsCompareRepository.listSeriesByIds(tx, kind, query.ids),
      superLiveInsightsCompareRepository.listSeriesTrends(tx, kind, query.ids),
    ]);
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered = query.ids.map((id) => byId.get(id)).filter(Boolean) as CompareSeriesRow[];
    if (ordered.length !== query.ids.length) throw superLiveCompareNotFound();

    const trendsBySeries = new Map<
      string,
      Array<{ index: number; label: string; attendanceRate: number | null }>
    >();
    for (const point of trends) {
      const list = trendsBySeries.get(point.series_id) ?? [];
      list.push({
        index: point.idx,
        label: `S${point.idx}`,
        attendanceRate: point.attendance_rate,
      });
      trendsBySeries.set(point.series_id, list);
    }

    const items = ordered.map((row, index) =>
      mapSeriesItem(row, index, trendsBySeries.get(row.id) ?? []),
    );

    return superLiveInsightsCompareResponseSchema.parse({
      data: {
        mode: "series",
        seriesKind: kind,
        items,
        tenantAverages,
        compositionCaption: compositionCaption(items),
      },
    });
  }

  const rows = await superLiveInsightsCompareRepository.listSessionsByIds(tx, query.ids);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const ordered = query.ids.map((id) => byId.get(id)).filter(Boolean) as CompareSessionRow[];
  if (ordered.length !== query.ids.length) throw superLiveCompareNotFound();

  const items = ordered.map((row, index) => mapSessionItem(row, index));

  return superLiveInsightsCompareResponseSchema.parse({
    data: {
      mode: "sessions",
      seriesKind: null,
      items,
      tenantAverages,
      compositionCaption: compositionCaption(items),
    },
  });
}

export async function listSuperLiveInsightsCompareCandidates(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SuperLiveInsightsCompareCandidatesQuery,
) {
  const rows = await superLiveInsightsCompareRepository.listCandidates(tx, query);
  return superLiveInsightsCompareCandidatesResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        groupLabel: row.group_label,
        scheduledAt: row.scheduled_at?.toISOString() ?? null,
        attendanceRate: row.attendance_rate,
        sessionCount: row.session_count,
      })),
    },
  });
}
