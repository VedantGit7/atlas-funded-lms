import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  DEFAULT_OUTLIER_THRESHOLDS,
  outlierThresholdsSchema,
  superLiveInsightsOutliersPreviewResponseSchema,
  superLiveInsightsOutliersResponseSchema,
  type OutlierCategory,
  type OutlierSeverity,
  type OutlierThresholds,
  type SuperLiveInsightsOutliersPreviewQuery,
  type SuperLiveInsightsOutliersQuery,
} from "./super-live-insights-outliers.dto";
import {
  superLiveInsightsOutliersRepository,
  type OutlierSessionRow,
} from "./super-live-insights-outliers.repository";

type FindingCategory = Exclude<OutlierCategory, "all">;

type EvidenceTone = "success" | "warning" | "danger" | "muted" | "ink";

type Finding = {
  id: string;
  sessionId: string;
  category: FindingCategory;
  severity: OutlierSeverity;
  title: string;
  sessionTitle: string;
  courseTitle: string | null;
  batchName: string | null;
  scheduledAt: string | null;
  evidence: Array<{ label: string; tone: EvidenceTone }>;
  composition: {
    attendedCount: number;
    registeredCount: number;
    absentCount: number;
    totalCount: number;
  };
  metrics: {
    attendanceRate: number | null;
    courseAvgRate: number | null;
    avgDurationSeconds: number | null;
    sessionDurationSeconds: number | null;
    startDelaySeconds: number | null;
  };
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function formatRate(value: number): string {
  return `${round1(value).toFixed(1)}%`;
}

function formatDurationMinutes(seconds: number): string {
  const minutes = Math.max(0, Math.round(seconds / 60));
  return `${minutes}m`;
}

function resolveThresholds(partial: {
  rateDeltaPts?: number | undefined;
  unresolvedPct?: number | undefined;
  shortDurationPct?: number | undefined;
  lateStartMinutes?: number | undefined;
  ignoreSmallSessions?: boolean | undefined;
  minRecords?: number | undefined;
}): OutlierThresholds {
  return outlierThresholdsSchema.parse({
    rateDeltaPts: partial.rateDeltaPts ?? DEFAULT_OUTLIER_THRESHOLDS.rateDeltaPts,
    unresolvedPct: partial.unresolvedPct ?? DEFAULT_OUTLIER_THRESHOLDS.unresolvedPct,
    shortDurationPct: partial.shortDurationPct ?? DEFAULT_OUTLIER_THRESHOLDS.shortDurationPct,
    lateStartMinutes: partial.lateStartMinutes ?? DEFAULT_OUTLIER_THRESHOLDS.lateStartMinutes,
    ignoreSmallSessions:
      partial.ignoreSmallSessions ?? DEFAULT_OUTLIER_THRESHOLDS.ignoreSmallSessions,
    minRecords: partial.minRecords ?? DEFAULT_OUTLIER_THRESHOLDS.minRecords,
  });
}

function compositionOf(row: OutlierSessionRow) {
  return {
    attendedCount: row.attended_count,
    registeredCount: row.registered_count,
    absentCount: row.absent_count,
    totalCount: row.total_count,
  };
}

function metricsOf(row: OutlierSessionRow) {
  return {
    attendanceRate: row.attendance_rate,
    courseAvgRate: row.course_avg_rate,
    avgDurationSeconds: row.avg_duration_seconds,
    sessionDurationSeconds: row.duration_seconds,
    startDelaySeconds: row.start_delay_seconds,
  };
}

function baseFinding(
  row: OutlierSessionRow,
  category: FindingCategory,
  severity: OutlierSeverity,
  title: string,
  evidence: Finding["evidence"],
): Finding {
  return {
    id: `${row.id}:${category}`,
    sessionId: row.id,
    category,
    severity,
    title,
    sessionTitle: row.title,
    courseTitle: row.course_title,
    batchName: row.batch_name,
    scheduledAt: row.scheduled_at?.toISOString() ?? row.started_at?.toISOString() ?? null,
    evidence,
    composition: compositionOf(row),
    metrics: metricsOf(row),
  };
}

function shouldSkipNoisy(row: OutlierSessionRow, thresholds: OutlierThresholds): boolean {
  return (
    thresholds.ignoreSmallSessions && row.total_count > 0 && row.total_count < thresholds.minRecords
  );
}

export function detectOutlierFindings(
  rows: OutlierSessionRow[],
  thresholds: OutlierThresholds,
): Finding[] {
  const findings: Finding[] = [];
  const lateStartSeconds = thresholds.lateStartMinutes * 60;

  for (const row of rows) {
    const noisy = shouldSkipNoisy(row, thresholds);
    const rate = row.attendance_rate;
    const courseAvg = row.course_avg_rate;

    if (!noisy && rate != null && courseAvg != null) {
      const delta = round1(rate - courseAvg);
      if (delta <= -thresholds.rateDeltaPts) {
        findings.push(
          baseFinding(
            row,
            "far_below",
            "data_quality",
            `Attendance fell to ${formatRate(rate)}, ${round1(Math.abs(delta))} points below this course's average`,
            [
              { label: `${row.attended_count} attended`, tone: "success" },
              { label: `${row.registered_count} unresolved`, tone: "warning" },
              { label: `${row.absent_count} absent`, tone: "danger" },
              { label: `rate ${formatRate(rate)}`, tone: "ink" },
              { label: `course avg ${formatRate(courseAvg)}`, tone: "muted" },
            ],
          ),
        );
      } else if (delta >= thresholds.rateDeltaPts) {
        findings.push(
          baseFinding(
            row,
            "far_above",
            "worth_checking",
            `Attendance spiked to ${formatRate(rate)}, ${round1(delta)} points above average`,
            [
              { label: `${row.attended_count} attended`, tone: "success" },
              { label: `rate ${formatRate(rate)}`, tone: "ink" },
              { label: `course avg ${formatRate(courseAvg)}`, tone: "muted" },
            ],
          ),
        );
      }
    }

    if (!noisy && row.total_count > 0) {
      const unresolvedPct = (row.registered_count / row.total_count) * 100;
      if (unresolvedPct >= thresholds.unresolvedPct) {
        findings.push(
          baseFinding(
            row,
            "unresolved",
            "notable",
            `Unresolved records: ${row.registered_count} records sitting at status registered`,
            [
              {
                label: `${row.registered_count} unresolved records`,
                tone: "warning",
              },
            ],
          ),
        );
      }
    }

    if (row.total_count === 0) {
      const expected = Math.max(row.expected_registrations, 0);
      findings.push(
        baseFinding(
          row,
          "no_records",
          "worth_checking",
          "No attendance records recorded for this session",
          [
            { label: "0 records", tone: "ink" },
            {
              label:
                expected > 0
                  ? `for a session with ${expected} registrations expected`
                  : "no attendance rows were written",
              tone: "muted",
            },
          ],
        ),
      );
    }

    if (
      !noisy &&
      row.avg_duration_seconds != null &&
      row.duration_seconds != null &&
      row.duration_seconds > 0
    ) {
      const coveragePct = (row.avg_duration_seconds / row.duration_seconds) * 100;
      if (coveragePct < thresholds.shortDurationPct) {
        findings.push(
          baseFinding(
            row,
            "short_duration",
            "notable",
            `Very short average duration (${formatDurationMinutes(row.avg_duration_seconds)})`,
            [
              {
                label: `Avg dur: ${formatDurationMinutes(row.avg_duration_seconds)}`,
                tone: "warning",
              },
              {
                label: `Session len: ${formatDurationMinutes(row.duration_seconds)}`,
                tone: "muted",
              },
            ],
          ),
        );
      }
    }

    if (row.start_delay_seconds != null && row.start_delay_seconds >= lateStartSeconds) {
      findings.push(
        baseFinding(
          row,
          "started_late",
          "data_quality",
          `Session started very late (${formatDurationMinutes(row.start_delay_seconds)})`,
          [
            {
              label: `Started ${formatDurationMinutes(row.start_delay_seconds)} late`,
              tone: "danger",
            },
            ...(row.attendance_rate != null
              ? [{ label: `rate ${formatRate(row.attendance_rate)}`, tone: "muted" as const }]
              : []),
          ],
        ),
      );
    }
  }

  return findings.sort((a, b) => {
    const aTime = a.scheduledAt ? Date.parse(a.scheduledAt) : 0;
    const bTime = b.scheduledAt ? Date.parse(b.scheduledAt) : 0;
    return bTime - aTime;
  });
}

function emptyCounts() {
  return {
    all: 0,
    far_below: 0,
    far_above: 0,
    unresolved: 0,
    no_records: 0,
    short_duration: 0,
    started_late: 0,
  };
}

function countFindings(findings: Finding[]) {
  const counts = emptyCounts();
  counts.all = findings.length;
  for (const finding of findings) {
    counts[finding.category] += 1;
  }
  return counts;
}

function dataQualityImpact(findings: Finding[]): number {
  const dataQualityCategories = new Set<FindingCategory>([
    "unresolved",
    "no_records",
    "short_duration",
    "started_late",
  ]);
  const seen = new Set<string>();
  let total = 0;
  for (const finding of findings) {
    if (!dataQualityCategories.has(finding.category)) continue;
    if (seen.has(finding.sessionId)) continue;
    seen.add(finding.sessionId);
    total += finding.composition.totalCount;
  }
  return total;
}

async function loadFindings(
  tx: TenantTx,
  startedFrom: string,
  startedTo: string,
  thresholds: OutlierThresholds,
) {
  const rows = await superLiveInsightsOutliersRepository.listSessionsInRange(
    tx,
    startedFrom,
    startedTo,
  );
  return detectOutlierFindings(rows, thresholds);
}

export async function getSuperLiveInsightsOutliers(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SuperLiveInsightsOutliersQuery,
) {
  const thresholds = resolveThresholds(query);
  const allFindings = await loadFindings(tx, query.startedFrom, query.startedTo, thresholds);
  const counts = countFindings(allFindings);
  const findings =
    query.category === "all"
      ? allFindings
      : allFindings.filter((finding) => finding.category === query.category);

  return superLiveInsightsOutliersResponseSchema.parse({
    data: {
      category: query.category,
      thresholds,
      counts,
      dataQualityRecordsAffected: dataQualityImpact(allFindings),
      findings,
    },
  });
}

export async function previewSuperLiveInsightsOutliers(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: SuperLiveInsightsOutliersPreviewQuery,
) {
  const thresholds = resolveThresholds(query);
  const findings = await loadFindings(tx, query.startedFrom, query.startedTo, thresholds);
  return superLiveInsightsOutliersPreviewResponseSchema.parse({
    data: {
      findingCount: findings.length,
      thresholds,
    },
  });
}
