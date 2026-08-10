import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  superLiveInsightsTrendsResponseSchema,
  type SuperLiveInsightsTrendsQuery,
} from "./super-live-insights-trends.dto";
import { superLiveInsightsTrendsRepository } from "./super-live-insights-trends.repository";

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function delta(current: number | null, previous: number | null): number | null {
  if (current == null || previous == null) return null;
  return round1(current - previous);
}

function intDelta(current: number, previous: number): number {
  return current - previous;
}

function sparklineFor(
  id: string,
  periods: Array<{ key: string }>,
  points: Array<{ id: string; period_key: string; avg_rate: number | null }>,
): Array<number | null> {
  const byKey = new Map<string, number | null>();
  for (const point of points) {
    if (point.id !== id) continue;
    byKey.set(point.period_key, point.avg_rate);
  }
  return periods.map((period) => byKey.get(period.key) ?? null);
}

export async function getSuperLiveInsightsTrends(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SuperLiveInsightsTrendsQuery,
) {
  const repo = superLiveInsightsTrendsRepository;
  const filter = {
    startedFrom: query.startedFrom,
    startedTo: query.startedTo,
    courseId: query.courseId ?? null,
    batchId: query.batchId ?? null,
  };
  const prev = repo.previousRange(query.startedFrom, query.startedTo);
  const prevFilter = {
    ...filter,
    startedFrom: prev.from,
    startedTo: prev.to,
  };

  const [
    currentSummary,
    previousSummary,
    periodRows,
    segmentRows,
    dayTimeRows,
    rankedCourses,
    rankedBatches,
  ] = await Promise.all([
    repo.summarizeRange(tx, filter),
    repo.summarizeRange(tx, prevFilter),
    repo.listPeriodAggregates(tx, query),
    repo.listPeriodSegments(tx, query),
    repo.listDayTimeMatrix(tx, query),
    repo.listRankedCourses(tx, query),
    repo.listRankedBatches(tx, query),
  ]);

  const periodStarts = repo.enumeratePeriods(query.startedFrom, query.startedTo, query.granularity);
  const aggByKey = new Map(periodRows.map((row) => [row.period_key, row] as const));
  const segmentsByKey = new Map<string, typeof segmentRows>();
  for (const row of segmentRows) {
    const list = segmentsByKey.get(row.period_key) ?? [];
    list.push(row);
    segmentsByKey.set(row.period_key, list);
  }

  const periods = periodStarts.map(({ key, start }) => {
    const agg = aggByKey.get(key);
    const segments = (segmentsByKey.get(key) ?? []).map((seg) => ({
      key: seg.segment_key,
      label: seg.segment_label,
      sessionCount: seg.session_count,
      attendedCount: seg.attended_count,
      registeredCount: seg.registered_count,
      absentCount: seg.absent_count,
      totalCount: seg.total_count,
      attendanceRate: seg.avg_rate,
    }));
    const end = repo.periodToInclusive(start, query.granularity);
    return {
      key,
      label: repo.formatPeriodLabel(start, query.granularity),
      from: start.toISOString(),
      to: end.toISOString(),
      sessionCount: agg?.session_count ?? 0,
      attendedCount: agg?.attended_count ?? 0,
      registeredCount: agg?.registered_count ?? 0,
      absentCount: agg?.absent_count ?? 0,
      totalCount: agg?.total_count ?? 0,
      attendanceRate: agg?.avg_rate ?? null,
      avgDurationSeconds: agg?.avg_duration_seconds ?? null,
      hasSessions: (agg?.session_count ?? 0) > 0,
      segments,
    };
  });

  const withRates = periods.filter((p) => p.hasSessions && p.attendanceRate != null);
  let largestMovement: {
    fromLabel: string;
    toLabel: string;
    deltaPts: number;
    caption: string;
  } | null = null;
  for (let i = 1; i < withRates.length; i += 1) {
    const prevP = withRates[i - 1];
    const currP = withRates[i];
    if (prevP == null || currP == null) continue;
    const d = round1((currP.attendanceRate ?? 0) - (prevP.attendanceRate ?? 0));
    if (!largestMovement || Math.abs(d) > Math.abs(largestMovement.deltaPts)) {
      const direction = d >= 0 ? "rose" : "fell";
      largestMovement = {
        fromLabel: prevP.label,
        toLabel: currP.label,
        deltaPts: d,
        caption: `Largest move: attendance ${direction} ${Math.abs(d).toFixed(1)} pts from ${prevP.label} to ${currP.label}.`,
      };
    }
  }

  let compositionCaption: string | null = null;
  let maxRegisteredJump = 0;
  for (let i = 1; i < periods.length; i += 1) {
    const prevP = periods[i - 1];
    const currP = periods[i];
    if (prevP == null || currP == null) continue;
    if (!currP.hasSessions || !prevP.hasSessions) continue;
    const jump = currP.registeredCount - prevP.registeredCount;
    if (jump > maxRegisteredJump && jump >= 5) {
      maxRegisteredJump = jump;
      compositionCaption = `Registered (unresolved) grew by ${jump} in ${currP.label} versus ${prevP.label}.`;
    }
  }

  const bestAmongWeeks = [...periods]
    .filter((p) => p.hasSessions && p.attendanceRate != null)
    .sort((a, b) => (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0))[0];

  const days = [...repo.DAY_LABELS];
  const bands = [...repo.BAND_LABELS];
  const cells = dayTimeRows.map((row) => ({
    dayIndex: row.dow,
    bandIndex: row.band,
    dayLabel: days[row.dow] ?? "Day",
    bandLabel: bands[row.band] ?? "Band",
    sessionCount: row.session_count,
    attendanceRate: row.avg_rate,
  }));

  const dayAverages = days.map((_, dayIndex) => {
    const dayCells = cells.filter((c) => c.dayIndex === dayIndex && c.sessionCount > 0);
    if (dayCells.length === 0) return null;
    const weight = dayCells.reduce((sum, c) => sum + c.sessionCount, 0);
    const weighted = dayCells.reduce((sum, c) => sum + (c.attendanceRate ?? 0) * c.sessionCount, 0);
    return weight === 0 ? null : round1(weighted / weight);
  });

  const bandAverages = bands.map((_, bandIndex) => {
    const bandCells = cells.filter((c) => c.bandIndex === bandIndex && c.sessionCount > 0);
    if (bandCells.length === 0) return null;
    const weight = bandCells.reduce((sum, c) => sum + c.sessionCount, 0);
    const weighted = bandCells.reduce(
      (sum, c) => sum + (c.attendanceRate ?? 0) * c.sessionCount,
      0,
    );
    return weight === 0 ? null : round1(weighted / weight);
  });

  const slotsWithRate = cells.filter((c) => c.sessionCount > 0 && c.attendanceRate != null);
  const bestSlot = [...slotsWithRate].sort(
    (a, b) => (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0),
  )[0];
  const worstSlot = [...slotsWithRate].sort(
    (a, b) => (a.attendanceRate ?? 0) - (b.attendanceRate ?? 0),
  )[0];

  const slotsRanked = [...slotsWithRate]
    .sort((a, b) => (b.attendanceRate ?? 0) - (a.attendanceRate ?? 0))
    .map((c) => ({
      dayLabel: c.dayLabel,
      bandLabel: c.bandLabel,
      sessionCount: c.sessionCount,
      attendanceRate: c.attendanceRate,
    }));

  const courseIds = rankedCourses.map((r) => r.id).filter((id) => id !== "none");
  const batchIds = rankedBatches.map((r) => r.id).filter((id) => id !== "none");
  const [courseSparks, batchSparks] = await Promise.all([
    repo.listCourseSparklines(tx, query, courseIds),
    repo.listBatchSparklines(tx, query, batchIds),
  ]);

  const tenantRate = currentSummary.avgAttendanceRate;

  return superLiveInsightsTrendsResponseSchema.parse({
    data: {
      granularity: query.granularity,
      breakDownBy: query.breakDownBy,
      range: { from: query.startedFrom, to: query.startedTo },
      summary: {
        attendanceRate: currentSummary.avgAttendanceRate,
        attendanceRateDeltaPts: delta(
          currentSummary.avgAttendanceRate,
          previousSummary.avgAttendanceRate,
        ),
        sessionCount: currentSummary.sessionCount,
        sessionCountDelta: intDelta(currentSummary.sessionCount, previousSummary.sessionCount),
        totalAttended: currentSummary.totalAttended,
        totalAttendedDelta: intDelta(currentSummary.totalAttended, previousSummary.totalAttended),
        avgDurationSeconds: currentSummary.avgDurationSeconds,
        avgDurationSecondsDelta:
          currentSummary.avgDurationSeconds == null || previousSummary.avgDurationSeconds == null
            ? null
            : intDelta(currentSummary.avgDurationSeconds, previousSummary.avgDurationSeconds),
        bestPeriod:
          bestAmongWeeks?.attendanceRate != null
            ? {
                label: bestAmongWeeks.label,
                from: bestAmongWeeks.from,
                to: bestAmongWeeks.to,
                attendanceRate: bestAmongWeeks.attendanceRate,
              }
            : null,
      },
      periods,
      rangeAverageRate: currentSummary.avgAttendanceRate,
      largestMovement,
      compositionCaption,
      dayTimeMatrix: {
        days,
        bands,
        cells,
        dayAverages,
        bandAverages,
        bestSlotCaption: bestSlot
          ? `${bestSlot.bandLabel} sessions on ${bestSlot.dayLabel} average ${bestSlot.attendanceRate?.toFixed(1) ?? ""}%.`
          : null,
        worstSlotCaption: worstSlot
          ? `${worstSlot.dayLabel} ${worstSlot.bandLabel.toLowerCase()}s average ${worstSlot.attendanceRate?.toFixed(1) ?? ""}%.`
          : null,
        slotsRanked,
      },
      byCourse: rankedCourses.map((row) => ({
        id: row.id,
        title: row.title,
        sessionCount: row.session_count,
        attendanceRate: row.avg_rate,
        deltaVsTenantPts: delta(row.avg_rate, tenantRate),
        sparkline: sparklineFor(row.id, periods, courseSparks),
      })),
      byBatch: rankedBatches.map((row) => ({
        id: row.id,
        title: row.title,
        sessionCount: row.session_count,
        attendanceRate: row.avg_rate,
        deltaVsTenantPts: delta(row.avg_rate, tenantRate),
        sparkline: sparklineFor(row.id, periods, batchSparks),
      })),
    },
  });
}
