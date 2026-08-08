import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  batchContentLearnersResponseSchema,
  batchContentResponseSchema,
  batchContentStalledResponseSchema,
  batchDetailResponseSchema,
  batchExamsBelowPassResponseSchema,
  batchExamsListResponseSchema,
  batchExamsMatrixResponseSchema,
  batchLearnerDetailResponseSchema,
  batchLearnersListResponseSchema,
  batchLiveSessionAttendeesListResponseSchema,
  batchLiveSessionDetailResponseSchema,
  batchLiveSessionsAbsenteesResponseSchema,
  batchLiveSessionsListResponseSchema,
  batchLiveSessionsMatrixResponseSchema,
  batchMessagesAudiencesResponseSchema,
  batchMessagesListResponseSchema,
  batchMessagesNudgesResponseSchema,
  batchesCompareResponseSchema,
  batchesListResponseSchema,
  removeBatchLearnerResponseSchema,
  type BatchContentLearnersQuery,
  type BatchMessagesQuery,
  type BatchesCompareQuery,
  type BatchesListQuery,
  type BatchExamsMatrixQuery,
  type BatchExamsQuery,
  type BatchLearnersQuery,
  type BatchLiveSessionAttendeesQuery,
  type BatchLiveSessionsAbsenteesQuery,
  type BatchLiveSessionsMatrixQuery,
  type BatchLiveSessionsQuery,
} from "./batches-roster.dto";
import {
  batchLiveSessionNotFound,
  batchRosterLearnerNotFound,
  batchRosterNotFound,
  batchRosterEmptyAudience,
} from "./batches-roster.errors";
import { batchesRosterRepository, type BatchLearnersFilter } from "./batches-roster.repository";

function defined<T>(value: T, message = "Expected value to be defined"): NonNullable<T> {
  if (value == null) {
    throw new Error(message);
  }
  return value;
}

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

function toLearnerFilter(
  batchId: string,
  input: Partial<{
    learnerName?: string;
    joinedFrom?: string;
    joinedTo?: string;
    minCompletion?: number;
    maxCompletion?: number;
  }>,
): BatchLearnersFilter {
  const filter: BatchLearnersFilter = { batchId };
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.joinedFrom) filter.joinedFrom = input.joinedFrom;
  if (input.joinedTo) filter.joinedTo = input.joinedTo;
  if (input.minCompletion != null) filter.minCompletion = input.minCompletion;
  if (input.maxCompletion != null) filter.maxCompletion = input.maxCompletion;
  return filter;
}

function mapBatchListItem(
  row: Awaited<ReturnType<typeof batchesRosterRepository.listBatches>>[number],
) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    courseId: row.course_id,
    courseTitle: row.course_title,
    status: row.status,
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    memberCount: row.member_count,
    avgContentCompletionPct: row.avg_content_completion_pct,
    avgLiveAttendancePct: row.avg_live_attendance_pct,
    avgTestScorePct: row.avg_test_score_pct,
    lastActivityAt: row.last_activity_at?.toISOString() ?? null,
    health: row.health,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listBatchesRoster(tx: TenantTx, _ctx: ServiceCtx, query: BatchesListQuery) {
  const [totalCount, rows, summary] = await Promise.all([
    batchesRosterRepository.countBatches(tx, query),
    batchesRosterRepository.listBatches(tx, query),
    batchesRosterRepository.summarizeBatches(tx, query),
  ]);

  return batchesListResponseSchema.parse({
    data: {
      items: rows.map(mapBatchListItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        activeBatchCount: summary.active_batch_count,
        totalLearners: summary.total_learners,
        avgContentCompletionPct: summary.avg_content_completion_pct,
        avgLiveAttendancePct: summary.avg_live_attendance_pct,
        atRiskCount: summary.at_risk_count,
        endingSoonCount: summary.ending_soon_count,
      },
    },
  });
}

function learnerAttentionReason(row: {
  activity_at: Date | null;
  content_completion_pct: number;
  live_attendance_pct: number | null;
  test_score_pct: number | null;
}): string {
  const inactive =
    row.activity_at == null || row.activity_at.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000;
  if (inactive) return "Inactive for 14+ days";
  if (row.test_score_pct != null && row.test_score_pct < 40) {
    return `Test score ${String(Math.round(row.test_score_pct))}%`;
  }
  if (row.content_completion_pct < 40) {
    return `Content completion ${String(Math.round(row.content_completion_pct))}%`;
  }
  if (row.live_attendance_pct != null && row.live_attendance_pct < 40) {
    return `Live attendance ${String(Math.round(row.live_attendance_pct))}%`;
  }
  return "Needs attention";
}

function scoreDistributionFromLearners(rows: Array<{ test_score_pct: number | null }>) {
  let below60 = 0;
  let from60to80 = 0;
  let above80 = 0;
  for (const row of rows) {
    if (row.test_score_pct == null) continue;
    if (row.test_score_pct < 60) below60 += 1;
    else if (row.test_score_pct <= 80) from60to80 += 1;
    else above80 += 1;
  }
  return [
    { bucket: "below_60" as const, label: "< 60%", count: below60 },
    { bucket: "from_60_to_80" as const, label: "60 - 80%", count: from60to80 },
    { bucket: "above_80" as const, label: "> 80%", count: above80 },
  ];
}

export async function getBatchDetailedReport(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const learnerQuery = {
    page: 1,
    limit: 100,
    sortBy: "activity_at" as const,
    sortDir: "asc" as const,
    columns: [
      "learner_name",
      "email",
      "activity_at",
      "live_attendance_pct",
      "test_score_pct",
      "content_completion_pct",
      "joined_at",
    ],
    health: "any" as const,
  };

  const [listed, activeLearnerCount, sessionCounts, upcomingSessions, cohortTrend, learners] =
    await Promise.all([
      batchesRosterRepository.listBatches(tx, {
        page: 1,
        limit: 100,
        window: "any",
        health: "any",
        sortBy: "created_at",
        sortDir: "desc",
      }),
      batchesRosterRepository.countActiveLearners(tx, batchId),
      batchesRosterRepository.countLiveSessions(tx, batchId, meta.course_id),
      batchesRosterRepository.listUpcomingSessions(tx, batchId, meta.course_id, 5),
      batchesRosterRepository.listCohortTrend(tx, batchId, meta.course_id),
      batchesRosterRepository.listLearners(tx, batchId, meta.course_id, learnerQuery),
    ]);
  const row = listed.find((item) => item.id === batchId);
  const item = mapBatchListItem(
    row ?? {
      id: meta.id,
      key: meta.key,
      name: meta.name,
      description: meta.description,
      course_id: meta.course_id,
      course_title: meta.course_title,
      status: meta.status,
      starts_at: meta.starts_at,
      ends_at: meta.ends_at,
      member_count: 0,
      avg_content_completion_pct: null,
      avg_live_attendance_pct: null,
      avg_test_score_pct: null,
      last_activity_at: null,
      health: "at_risk",
      created_at: meta.created_at,
    },
  );

  const needsAttention = learners
    .filter((learner) => learner.health === "at_risk" || learner.health === "critical")
    .slice(0, 6)
    .map((learner) => ({
      membershipId: learner.membership_id,
      learnerName: learner.learner_name,
      email: learner.email,
      reason: learnerAttentionReason(learner),
      health: learner.health,
      contentCompletionPct: learner.content_completion_pct,
      liveAttendancePct: learner.live_attendance_pct,
      testScorePct: learner.test_score_pct,
    }));

  const atRiskCount = learners.filter(
    (learner) => learner.health === "at_risk" || learner.health === "critical",
  ).length;

  return batchDetailResponseSchema.parse({
    data: {
      ...item,
      averages: {
        contentCompletionPct: item.avgContentCompletionPct,
        liveAttendancePct: item.avgLiveAttendancePct,
        testScorePct: item.avgTestScorePct,
        activeLearnerCount,
        atRiskCount,
        liveSessionHeldCount: sessionCounts.held_count,
        liveSessionTotalCount: sessionCounts.total_count,
        passMarkPct: 70,
      },
      overview: {
        needsAttention,
        upcomingSessions: upcomingSessions.map((session) => ({
          liveSessionId: session.live_session_id,
          title: session.title,
          scheduledAt: session.scheduled_at?.toISOString() ?? null,
          status: session.status,
          durationMinutes: session.duration_minutes,
        })),
        scoreDistribution: scoreDistributionFromLearners(learners),
        cohortTrend: cohortTrend.map((point, index) => ({
          weekLabel: point.week_label || `W${String(index + 1)}`,
          weekStart: point.week_start.toISOString(),
          contentCompletionPct: point.content_completion_pct,
          liveAttendancePct: point.live_attendance_pct,
          testScorePct: point.test_score_pct,
        })),
      },
    },
  });
}

export async function listBatchLearners(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchLearnersQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const filter = toLearnerFilter(batchId, {
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.joinedFrom ? { joinedFrom: query.joinedFrom } : {}),
    ...(query.joinedTo ? { joinedTo: query.joinedTo } : {}),
    ...(query.minCompletion != null ? { minCompletion: query.minCompletion } : {}),
    ...(query.maxCompletion != null ? { maxCompletion: query.maxCompletion } : {}),
  });

  const [totalCount, rows] = await Promise.all([
    batchesRosterRepository.countLearners(tx, filter),
    batchesRosterRepository.listLearners(tx, batchId, meta.course_id, query),
  ]);

  return batchLearnersListResponseSchema.parse({
    data: {
      batchId,
      batchName: meta.name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        activityAt: row.activity_at?.toISOString() ?? null,
        liveAttendancePct: row.live_attendance_pct,
        liveAttendedCount: row.live_attended_count,
        liveSessionCount: row.live_session_count,
        testScorePct: row.test_score_pct,
        testAttemptCount: row.test_attempt_count,
        contentCompletionPct: row.content_completion_pct,
        completedLessons: row.completed_lessons,
        totalLessons: row.total_lessons,
        joinedAt: row.joined_at.toISOString(),
        health: row.health,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function getBatchLearnerDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  membershipId: string,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const member = await batchesRosterRepository.findBatchMember(tx, batchId, membershipId);
  if (!member) throw batchRosterLearnerNotFound();

  const passMarkPct = 70;
  const learnerQuery = {
    page: 1,
    limit: 100,
    sortBy: "joined_at" as const,
    sortDir: "desc" as const,
    columns: [
      "learner_name",
      "email",
      "activity_at",
      "live_attendance_pct",
      "test_score_pct",
      "content_completion_pct",
      "joined_at",
    ],
    health: "any" as const,
  };

  const [liveAttendance, exams, courseProgress, peers, activityDays, listed] = await Promise.all([
    batchesRosterRepository.listLiveAttendanceForMember(tx, batchId, meta.course_id, membershipId),
    batchesRosterRepository.listExamsForMember(tx, meta.course_id, membershipId),
    batchesRosterRepository.listCourseProgressForMember(tx, meta.course_id, membershipId),
    batchesRosterRepository.listLearners(tx, batchId, meta.course_id, learnerQuery),
    batchesRosterRepository.listActivityDaysForMember(tx, membershipId, meta.course_id, batchId),
    batchesRosterRepository.listBatches(tx, {
      page: 1,
      limit: 100,
      window: "any",
      health: "any",
      sortBy: "created_at",
      sortDir: "desc",
    }),
  ]);

  const batchRow = listed.find((item) => item.id === batchId);
  const primaryCourseId = courseProgress[0]?.course_id ?? meta.course_id;
  const lessonStripRows = primaryCourseId
    ? await batchesRosterRepository.listLessonStripForCourse(tx, primaryCourseId, membershipId)
    : [];

  function classifyAttendance(row: (typeof liveAttendance)[number]) {
    const status = row.status.toLowerCase();
    if (
      status === "upcoming" ||
      row.session_status === "scheduled" ||
      (row.scheduled_at != null && row.scheduled_at.getTime() > Date.now() && row.joined_at == null)
    ) {
      return "upcoming" as const;
    }
    if (["attended", "present", "joined"].includes(status)) {
      const planned = (row.planned_duration_minutes ?? 0) * 60;
      if (
        planned > 0 &&
        row.duration_seconds != null &&
        row.duration_seconds > 0 &&
        row.duration_seconds < planned * 0.5
      ) {
        return "partial" as const;
      }
      return "attended" as const;
    }
    if (status === "partial" || status === "late") return "partial" as const;
    if (row.joined_at != null) {
      const planned = (row.planned_duration_minutes ?? 0) * 60;
      if (planned > 0 && row.duration_seconds != null && row.duration_seconds < planned * 0.5) {
        return "partial" as const;
      }
      return "attended" as const;
    }
    return "absent" as const;
  }

  const classified = liveAttendance.map((row) => ({
    row,
    kind: classifyAttendance(row),
  }));
  const held = classified.filter((item) => item.kind !== "upcoming");
  const liveAttendedCount = held.filter((item) => item.kind === "attended").length;
  const livePartialCount = held.filter((item) => item.kind === "partial").length;
  const liveAbsentCount = held.filter((item) => item.kind === "absent").length;
  const liveSessionCount = held.length;
  const liveAttendancePct =
    liveSessionCount > 0
      ? Math.round(((liveAttendedCount + livePartialCount * 0.5) / liveSessionCount) * 100)
      : null;

  const scoredAttempts = exams.filter((row) => row.score_pct != null);
  const testScorePct =
    scoredAttempts.length > 0
      ? Number(
          (
            scoredAttempts.reduce((sum, row) => sum + (row.score_pct ?? 0), 0) /
            scoredAttempts.length
          ).toFixed(1),
        )
      : null;
  const bestTestScorePct =
    scoredAttempts.length > 0 ? Math.max(...scoredAttempts.map((row) => row.score_pct ?? 0)) : null;

  const primaryProgress = courseProgress[0];
  const contentCompletionPct = primaryProgress?.completion_pct ?? 0;
  const completedLessons = primaryProgress?.completed_lessons ?? 0;
  const totalLessons = primaryProgress?.total_lessons ?? 0;

  const daysInBatch = Math.max(
    0,
    Math.floor((Date.now() - member.joined_at.getTime()) / (1000 * 60 * 60 * 24)),
  );
  const targetDays =
    meta.starts_at && meta.ends_at
      ? Math.max(
          1,
          Math.round((meta.ends_at.getTime() - meta.starts_at.getTime()) / (1000 * 60 * 60 * 24)),
        )
      : null;

  const peer = peers.find((row) => row.membership_id === membershipId);
  const health =
    peer?.health ??
    (() => {
      const flags =
        (contentCompletionPct < 40 ? 1 : 0) +
        (liveAttendancePct != null && liveAttendancePct < 40 ? 1 : 0) +
        (testScorePct != null && testScorePct < 40 ? 1 : 0);
      if (flags >= 2) return "critical" as const;
      if (flags >= 1) return "at_risk" as const;
      if (
        member.activity_at == null ||
        member.activity_at.getTime() < Date.now() - 14 * 24 * 60 * 60 * 1000
      ) {
        return "at_risk" as const;
      }
      return "on_track" as const;
    })();

  function percentileLabel(percentile: number | null): string {
    if (percentile == null) return "No data";
    if (percentile >= 80) return `Top ${String(Math.max(1, 100 - percentile))}%`;
    if (percentile >= 40) return `Average (${String(percentile)}%)`;
    return `Bottom ${String(Math.max(1, percentile))}%`;
  }

  function computePercentile(value: number | null, values: Array<number | null>): number | null {
    if (value == null) return null;
    const numeric = values.filter((item): item is number => item != null);
    if (numeric.length === 0) return null;
    const below = numeric.filter((item) => item < value).length;
    return Math.round((below / numeric.length) * 100);
  }

  const completionPercentile = computePercentile(
    contentCompletionPct,
    peers.map((row) => row.content_completion_pct),
  );
  const testPercentile = computePercentile(
    testScorePct,
    peers.map((row) => row.test_score_pct),
  );
  const attendancePercentile = computePercentile(
    liveAttendancePct,
    peers.map((row) => row.live_attendance_pct),
  );

  const activityMap = new Map(
    activityDays.map((row) => [row.activity_date.toISOString().slice(0, 10), row.event_count]),
  );
  const heatmapCells: Array<{ date: string; count: number }> = [];
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - 83);
  for (let i = 0; i < 84; i += 1) {
    const day = new Date(start);
    day.setUTCDate(start.getUTCDate() + i);
    const key = day.toISOString().slice(0, 10);
    heatmapCells.push({ date: key, count: activityMap.get(key) ?? 0 });
  }
  let longestGapDays: number | null = null;
  let gap = 0;
  for (const cell of heatmapCells) {
    if (cell.count === 0) {
      gap += 1;
      longestGapDays = Math.max(longestGapDays ?? 0, gap);
    } else {
      gap = 0;
    }
  }

  const lastActivityLabel =
    classified.find((item) => item.kind === "attended" || item.kind === "partial")?.row.title ??
    exams[0]?.assessment_title ??
    primaryProgress?.last_lesson_title ??
    null;

  function examOutcome(
    status: string,
    score: number | null,
  ): "passed" | "borderline" | "failed" | "in_progress" | "other" {
    const normalized = status.toUpperCase();
    if (normalized === "STARTED") return "in_progress";
    if (score == null) return "other";
    if (score >= passMarkPct + 5) return "passed";
    if (score >= passMarkPct) return "borderline";
    return "failed";
  }

  function courseStatusLabel(pct: number): "completed" | "in_progress" | "behind" | "not_started" {
    if (pct >= 100) return "completed";
    if (pct <= 0) return "not_started";
    if (pct < 40) return "behind";
    return "in_progress";
  }

  let nextAssigned = false;
  const lessonStrip = lessonStripRows.map((lesson) => {
    const isNext = !lesson.completed && !nextAssigned;
    if (isNext) nextAssigned = true;
    return {
      lessonId: lesson.lesson_id,
      title: lesson.title,
      sortOrder: lesson.sort_order,
      completed: lesson.completed,
      isNext,
    };
  });

  return batchLearnerDetailResponseSchema.parse({
    data: {
      batchId,
      batchKey: meta.key,
      batchName: meta.name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      batchStartsAt: meta.starts_at?.toISOString() ?? null,
      batchEndsAt: meta.ends_at?.toISOString() ?? null,
      membershipId,
      learnerName: member.learner_name,
      email: member.email,
      joinedAt: member.joined_at.toISOString(),
      activityAt: member.activity_at?.toISOString() ?? null,
      health,
      summary: {
        liveAttendancePct,
        liveAttendedCount,
        livePartialCount,
        liveAbsentCount,
        liveSessionCount,
        testScorePct,
        bestTestScorePct,
        testAttemptCount: exams.length,
        contentCompletionPct,
        completedLessons,
        totalLessons,
        daysInBatch,
        targetDays,
        passMarkPct,
        lastActivityLabel,
      },
      cohortAverages: {
        contentCompletionPct: batchRow?.avg_content_completion_pct ?? null,
        liveAttendancePct: batchRow?.avg_live_attendance_pct ?? null,
        testScorePct: batchRow?.avg_test_score_pct ?? null,
      },
      standing: {
        completionPercentile,
        testPercentile,
        attendancePercentile,
        completionLabel: percentileLabel(completionPercentile),
        testLabel: percentileLabel(testPercentile),
        attendanceLabel: percentileLabel(attendancePercentile),
      },
      activityHeatmap: {
        cells: heatmapCells,
        longestGapDays,
      },
      membership: {
        membershipId,
        joinedAt: member.joined_at.toISOString(),
        role: "Learner",
        source: "Batch assignment",
        addedBy: "System",
      },
      liveAttendance: classified.map(({ row, kind }) => ({
        liveSessionId: row.live_session_id,
        title: row.title,
        scheduledAt: row.scheduled_at?.toISOString() ?? null,
        status: row.status,
        sessionStatus: row.session_status,
        sessionKind: row.session_kind,
        joinedAt: row.joined_at?.toISOString() ?? null,
        leftAt: row.left_at?.toISOString() ?? null,
        durationSeconds: row.duration_seconds,
        plannedDurationMinutes: row.planned_duration_minutes,
        attendanceKind: kind,
      })),
      exams: exams.map((row) => ({
        assessmentId: row.assessment_id,
        assessmentTitle: row.assessment_title,
        attemptId: row.attempt_id,
        attemptStatus: row.attempt_status,
        scorePct: row.score_pct == null ? null : row.score_pct,
        submittedAt: row.submitted_at?.toISOString() ?? null,
        startedAt: row.started_at.toISOString(),
        durationSeconds: row.duration_seconds,
        passMarkPct,
        outcome: examOutcome(row.attempt_status, row.score_pct),
      })),
      courseProgress: courseProgress.map((row) => ({
        courseId: row.course_id,
        courseTitle: row.course_title,
        completedLessons: row.completed_lessons,
        totalLessons: row.total_lessons,
        completionPct: row.completion_pct,
        lastLessonTitle: row.last_lesson_title,
        statusLabel: courseStatusLabel(row.completion_pct),
      })),
      lessonStrip,
    },
  });
}

export async function removeBatchLearner(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  membershipId: string,
  _input: { reason: string; notes?: string | undefined },
) {
  void _input;
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();
  const member = await batchesRosterRepository.findBatchMember(tx, batchId, membershipId);
  if (!member) throw batchRosterLearnerNotFound();

  const removed = await batchesRosterRepository.removeBatchMember(tx, batchId, membershipId);
  return removeBatchLearnerResponseSchema.parse({
    data: {
      removed,
      batchId,
      membershipId,
    },
  });
}

export async function resolveBatchMembershipIds(
  tx: TenantTx,
  input: {
    batchId: string;
    membershipIds?: string[];
    learnerName?: string;
    joinedFrom?: string;
    joinedTo?: string;
    minCompletion?: number;
    maxCompletion?: number;
  },
): Promise<string[]> {
  if (input.membershipIds && input.membershipIds.length > 0) {
    return [...new Set(input.membershipIds)];
  }
  const meta = await batchesRosterRepository.findBatchMeta(tx, input.batchId);
  if (!meta) throw batchRosterNotFound();
  const membershipIds = await batchesRosterRepository.listLearnerMembershipIds(
    tx,
    toLearnerFilter(input.batchId, input),
  );
  if (membershipIds.length === 0) throw batchRosterEmptyAudience();
  return membershipIds;
}

function mapBatchLiveSessionItem(
  row: Awaited<ReturnType<typeof batchesRosterRepository.listBatchLiveSessions>>[number],
) {
  return {
    id: row.id,
    title: row.title,
    kind: row.kind,
    status: row.status,
    hostLabel: row.host_label,
    scheduledAt: row.scheduled_at?.toISOString() ?? null,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    plannedDurationMinutes: row.planned_duration_minutes,
    actualDurationMinutes: row.actual_duration_minutes,
    rosterCount: row.roster_count,
    attendedCount: row.attended_count,
    attendanceRatePct: row.attendance_rate_pct,
    avgWatchMinutes: row.avg_watch_minutes,
    lateCount: row.late_count,
    recordingUrl: row.recording_url,
    hasRecording: row.has_recording,
  };
}

export async function listBatchLiveSessions(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchLiveSessionsQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const rosterCount = await batchesRosterRepository.countLearners(tx, { batchId });
  const listQuery = {
    status: query.status,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    page: query.page,
    limit: query.limit,
    rosterCount,
    ...(query.q ? { q: query.q } : {}),
  };

  const [totalCount, items, summary] = await Promise.all([
    batchesRosterRepository.countBatchLiveSessions(tx, batchId, meta.course_id, listQuery),
    batchesRosterRepository.listBatchLiveSessions(tx, batchId, meta.course_id, listQuery),
    batchesRosterRepository.summarizeBatchLiveSessions(tx, batchId, meta.course_id, rosterCount),
  ]);

  return batchLiveSessionsListResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchKey: meta.key,
      batchName: meta.name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      items: items.map(mapBatchLiveSessionItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        avgAttendancePct: summary.avg_attendance_pct,
        sessionsHeldCount: summary.sessions_held_count,
        sessionsTotalCount: summary.sessions_total_count,
        perfectAttendanceCount: summary.perfect_attendance_count,
        missedThreeOrMoreCount: summary.missed_three_or_more_count,
        avgWatchMinutes: summary.avg_watch_minutes,
        plannedWatchMinutes: summary.planned_watch_minutes,
        rosterCount: summary.roster_count,
      },
    },
  });
}

export async function getBatchLiveSessionsMatrix(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchLiveSessionsMatrixQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const matrix = await batchesRosterRepository.listBatchLiveSessionsMatrix(
    tx,
    batchId,
    meta.course_id,
    {
      limitLearners: query.limitLearners,
      limitSessions: query.limitSessions,
      ...(query.q ? { q: query.q } : {}),
    },
  );

  return batchLiveSessionsMatrixResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchName: meta.name,
      sessions: matrix.sessions.map((session) => ({
        id: session.id,
        title: session.title,
        scheduledAt: session.scheduled_at?.toISOString() ?? null,
        status: session.status,
      })),
      learners: matrix.learners.map((learner) => ({
        membershipId: learner.membership_id,
        learnerName: learner.learner_name,
        email: learner.email,
        cells: learner.cells.map((cell) => ({
          liveSessionId: cell.live_session_id,
          kind: cell.kind,
        })),
        attendedCount: learner.attended_count,
        missedCount: learner.missed_count,
      })),
    },
  });
}

export async function listBatchLiveSessionAbsentees(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchLiveSessionsAbsenteesQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const membershipIds = await batchesRosterRepository.listBatchLiveSessionAbsenteeMembershipIds(
    tx,
    batchId,
    meta.course_id,
    query.minMissed,
  );

  return batchLiveSessionsAbsenteesResponseSchema.parse({
    data: { membershipIds },
  });
}

const SESSION_RULES = {
  attendedMinWatchPct: 90,
  partialMinWatchPct: 10,
  warningWatchPct: 50,
  lateJoinGraceMinutes: 5,
} as const;

function sessionIsCancelled(status: string) {
  const s = status.toLowerCase();
  return s === "cancelled" || s === "canceled";
}

function sessionIsUpcoming(status: string, scheduledAt: Date | null, endedAt: Date | null) {
  if (sessionIsCancelled(status) || endedAt) return false;
  const s = status.toLowerCase();
  if (s === "ended" || s === "completed" || s === "live" || s === "in_progress") return false;
  if (s === "scheduled" || s === "upcoming") return true;
  return scheduledAt != null && scheduledAt.getTime() >= Date.now();
}

function buildAttendanceTimeline(
  intervals: Array<{ joined_at: Date; left_at: Date | null; duration_seconds: number | null }>,
  sessionStart: Date | null,
  plannedMinutes: number | null,
) {
  const bucketMinutes = 1;
  const durationMinutes = Math.max(
    1,
    plannedMinutes ??
      (sessionStart
        ? Math.max(
            1,
            Math.ceil(
              (Math.max(...intervals.map((i) => (i.left_at ?? i.joined_at).getTime()), Date.now()) -
                sessionStart.getTime()) /
                60000,
            ),
          )
        : 60),
  );
  const startMs = sessionStart?.getTime() ?? null;
  if (!startMs || intervals.length === 0) {
    return {
      bucketMinutes,
      points: Array.from({ length: Math.min(durationMinutes + 1, 121) }, (_, offsetMinutes) => ({
        offsetMinutes,
        concurrent: 0,
      })),
      dropInsight: null as null | {
        fromOffsetMinutes: number;
        toOffsetMinutes: number;
        learnersLeft: number;
        message: string;
      },
      peakConcurrent: null as number | null,
      peakConcurrentOffsetMinutes: null as number | null,
    };
  }

  const maxOffset = Math.min(Math.max(durationMinutes, 1), 180);
  const points: Array<{ offsetMinutes: number; concurrent: number }> = [];
  let peakConcurrent = 0;
  let peakConcurrentOffsetMinutes = 0;

  for (let offset = 0; offset <= maxOffset; offset += 1) {
    const t = startMs + offset * 60_000;
    let concurrent = 0;
    for (const interval of intervals) {
      const join = interval.joined_at.getTime();
      const leave =
        interval.left_at?.getTime() ??
        (interval.duration_seconds != null
          ? join + interval.duration_seconds * 1000
          : startMs + maxOffset * 60_000);
      if (join <= t && t <= leave) concurrent += 1;
    }
    points.push({ offsetMinutes: offset, concurrent });
    if (concurrent > peakConcurrent) {
      peakConcurrent = concurrent;
      peakConcurrentOffsetMinutes = offset;
    }
  }

  let dropInsight: {
    fromOffsetMinutes: number;
    toOffsetMinutes: number;
    learnersLeft: number;
    message: string;
  } | null = null;
  let bestDrop = 0;
  for (let i = 1; i < points.length; i += 1) {
    const prev = defined(points[i - 1]);
    const curr = defined(points[i]);
    const drop = prev.concurrent - curr.concurrent;
    if (drop > bestDrop && drop >= 3) {
      bestDrop = drop;
      const fromOffsetMinutes = Math.max(0, curr.offsetMinutes - 2);
      const toOffsetMinutes = curr.offsetMinutes;
      dropInsight = {
        fromOffsetMinutes,
        toOffsetMinutes,
        learnersLeft: drop,
        message: `${String(drop)} learners left between ${String(Math.floor(fromOffsetMinutes / 60)).padStart(1, "0")}:${String(fromOffsetMinutes % 60).padStart(2, "0")} and ${String(Math.floor(toOffsetMinutes / 60)).padStart(1, "0")}:${String(toOffsetMinutes % 60).padStart(2, "0")}.`,
      };
    }
  }

  return {
    bucketMinutes,
    points,
    dropInsight,
    peakConcurrent,
    peakConcurrentOffsetMinutes,
  };
}

export async function getBatchLiveSessionDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  sessionId: string,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const session = await batchesRosterRepository.findBatchLiveSession(
    tx,
    batchId,
    meta.course_id,
    sessionId,
  );
  if (!session) throw batchLiveSessionNotFound();

  const rosterCount = await batchesRosterRepository.countLearners(tx, { batchId });
  const plannedMinutes =
    session.actual_duration_minutes ?? session.planned_duration_minutes ?? null;
  const plannedSeconds = plannedMinutes != null ? plannedMinutes * 60 : null;
  const sessionStart = session.started_at ?? session.scheduled_at;
  const sessionEnd =
    session.ended_at ??
    (sessionStart && plannedMinutes != null
      ? new Date(sessionStart.getTime() + plannedMinutes * 60_000)
      : null);
  const isUpcoming = sessionIsUpcoming(session.status, session.scheduled_at, session.ended_at);
  const isCancelled = sessionIsCancelled(session.status);

  const [attendees, intervals, nextSession] = await Promise.all([
    batchesRosterRepository.listBatchLiveSessionAttendeeRows(tx, batchId, sessionId, {
      attendanceKind: "any",
      sortBy: "status",
      sortDir: "asc",
      page: 1,
      limit: 5000,
      plannedSeconds,
      sessionStart,
      sessionEnd,
      isUpcoming,
      isCancelled,
    }),
    batchesRosterRepository.listBatchLiveSessionIntervals(tx, sessionId),
    batchesRosterRepository.findNextBatchLiveSession(
      tx,
      batchId,
      meta.course_id,
      session.scheduled_at ?? session.started_at,
      sessionId,
    ),
  ]);

  const attendedKinds = new Set(["attended", "partial", "excused"]);
  const attendedCount = attendees.filter((row) => attendedKinds.has(row.attendance_kind)).length;
  const absentCount = attendees.filter((row) => row.attendance_kind === "absent").length;
  const watchValues = attendees
    .map((row) => row.duration_seconds)
    .filter((value): value is number => value != null && value > 0);
  const avgWatchMinutes =
    watchValues.length > 0
      ? Math.round(
          (watchValues.reduce((sum, value) => sum + value, 0) / watchValues.length / 60) * 10,
        ) / 10
      : null;
  const lateJoinCount = attendees.filter((row) => row.late).length;
  const leftEarlyCount = attendees.filter((row) => row.left_early).length;
  const timeline = buildAttendanceTimeline(intervals, sessionStart, plannedMinutes);
  const peakAt =
    sessionStart && timeline.peakConcurrentOffsetMinutes != null
      ? new Date(sessionStart.getTime() + timeline.peakConcurrentOffsetMinutes * 60_000)
      : null;

  return batchLiveSessionDetailResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchKey: meta.key,
      batchName: meta.name,
      session: {
        id: session.id,
        title: session.title,
        kind: session.kind,
        status: session.status,
        hostLabel: session.host_label,
        scheduledAt: session.scheduled_at?.toISOString() ?? null,
        startedAt: session.started_at?.toISOString() ?? null,
        endedAt: session.ended_at?.toISOString() ?? null,
        plannedDurationMinutes: session.planned_duration_minutes,
        actualDurationMinutes: session.actual_duration_minutes,
        recordingUrl: session.recording_url,
        hasRecording: session.recording_url != null,
        timezoneLabel: session.timezone_label,
      },
      nextSession: nextSession
        ? {
            id: nextSession.id,
            title: nextSession.title,
            scheduledAt: nextSession.scheduled_at?.toISOString() ?? null,
          }
        : null,
      summary: {
        attendancePct:
          rosterCount > 0 && !isUpcoming && !isCancelled
            ? Math.round((attendedCount / rosterCount) * 1000) / 10
            : null,
        attendedCount,
        rosterCount,
        absentCount,
        avgWatchMinutes: isCancelled || isUpcoming ? null : avgWatchMinutes,
        plannedWatchMinutes: plannedMinutes,
        lateJoinCount: isCancelled || isUpcoming ? 0 : lateJoinCount,
        leftEarlyCount: isCancelled || isUpcoming ? 0 : leftEarlyCount,
        peakConcurrent: isCancelled || isUpcoming ? null : timeline.peakConcurrent,
        peakConcurrentAt: peakAt?.toISOString() ?? null,
        peakConcurrentOffsetMinutes:
          isCancelled || isUpcoming ? null : timeline.peakConcurrentOffsetMinutes,
      },
      timeline: {
        bucketMinutes: timeline.bucketMinutes,
        points: timeline.points,
        dropInsight: isCancelled || isUpcoming ? null : timeline.dropInsight,
      },
      rules: SESSION_RULES,
    },
  });
}

export async function listBatchLiveSessionAttendees(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  sessionId: string,
  query: BatchLiveSessionAttendeesQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const session = await batchesRosterRepository.findBatchLiveSession(
    tx,
    batchId,
    meta.course_id,
    sessionId,
  );
  if (!session) throw batchLiveSessionNotFound();

  const plannedMinutes =
    session.actual_duration_minutes ?? session.planned_duration_minutes ?? null;
  const plannedSeconds = plannedMinutes != null ? plannedMinutes * 60 : null;
  const sessionStart = session.started_at ?? session.scheduled_at;
  const sessionEnd =
    session.ended_at ??
    (sessionStart && plannedMinutes != null
      ? new Date(sessionStart.getTime() + plannedMinutes * 60_000)
      : null);
  const isUpcoming = sessionIsUpcoming(session.status, session.scheduled_at, session.ended_at);
  const isCancelled = sessionIsCancelled(session.status);

  const baseQuery = {
    attendanceKind: query.attendanceKind,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    plannedSeconds,
    sessionStart,
    sessionEnd,
    isUpcoming,
    isCancelled,
    ...(query.q ? { q: query.q } : {}),
  };

  const [totalCount, items] = await Promise.all([
    batchesRosterRepository.countBatchLiveSessionAttendees(tx, batchId, sessionId, baseQuery),
    batchesRosterRepository.listBatchLiveSessionAttendeeRows(tx, batchId, sessionId, {
      ...baseQuery,
      page: query.page,
      limit: query.limit,
    }),
  ]);

  return batchLiveSessionAttendeesListResponseSchema.parse({
    data: {
      sessionId: session.id,
      sessionTitle: session.title,
      items: items.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        attendanceKind: row.attendance_kind,
        healthRail: row.health_rail,
        joinedAt: row.joined_at?.toISOString() ?? null,
        leftAt: row.left_at?.toISOString() ?? null,
        watchSeconds: row.duration_seconds,
        watchMinutes:
          row.duration_seconds == null ? null : Math.round((row.duration_seconds / 60) * 10) / 10,
        plannedMinutes,
        watchPct: row.watch_pct,
        late: row.late,
        leftEarly: row.left_early,
        rejoins: row.rejoins,
        deviceLabel: row.device_label,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

function assessmentTypeLabel(type: string): "exam" | "quiz" | "other" {
  const t = type.toLowerCase();
  if (t.includes("exam") || t === "final") return "exam";
  if (t.includes("quiz") || t === "practice") return "quiz";
  return "other";
}

function shortAssessmentTitle(title: string): string {
  if (title.length <= 18) return title;
  return `${title.slice(0, 15)}...`;
}

export async function listBatchExams(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchExamsQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const rosterCount = await batchesRosterRepository.countLearners(tx, { batchId });
  const listQuery = {
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    ...(query.q ? { q: query.q } : {}),
  };

  const [summary, assessments] = await Promise.all([
    batchesRosterRepository.summarizeBatchExams(tx, batchId, meta.course_id, rosterCount),
    batchesRosterRepository.listBatchExamAssessments(
      tx,
      batchId,
      meta.course_id,
      rosterCount,
      listQuery,
    ),
  ]);

  return batchExamsListResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchKey: meta.key,
      batchName: meta.name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      summary: {
        avgScorePct: summary.avg_score_pct,
        passMarkPct: summary.pass_mark_pct,
        passRatePct: summary.pass_rate_pct,
        passedLearnerCount: summary.passed_learner_count,
        rosterCount: summary.roster_count,
        attemptCount: summary.attempt_count,
        attemptsPerLearner: summary.attempts_per_learner,
        awaitingGradingCount: summary.awaiting_grading_count,
        notAttemptedCount: summary.not_attempted_count,
        assessmentCount: summary.assessment_count,
      },
      assessments: assessments.map((row) => ({
        assessmentId: row.assessment_id,
        title: row.title,
        assessmentType: row.assessment_type,
        typeLabel: assessmentTypeLabel(row.assessment_type),
        releasedAt: row.released_at?.toISOString() ?? null,
        passMarkPct: row.pass_mark_pct,
        rosterCount: row.roster_count,
        attemptedCount: row.attempted_count,
        attemptedPct: row.attempted_pct,
        avgScorePct: row.avg_score_pct,
        passRatePct: row.pass_rate_pct,
        highScorePct: row.high_score_pct,
        lowScorePct: row.low_score_pct,
        awaitingGradingCount: row.awaiting_grading_count,
        healthRail: row.health_rail,
        distribution: {
          min: row.dist_min,
          q1: row.dist_q1,
          median: row.dist_median,
          q3: row.dist_q3,
          max: row.dist_max,
        },
      })),
    },
  });
}

export async function getBatchExamsMatrix(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchExamsMatrixQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const matrix = await batchesRosterRepository.listBatchExamsMatrix(tx, batchId, meta.course_id, {
    limitLearners: query.limitLearners,
    ...(query.q ? { q: query.q } : {}),
  });

  const learnerAvgs = matrix.learners
    .map((l) => l.avg_score_pct)
    .filter((v): v is number => v != null);
  const cohortAvg =
    learnerAvgs.length > 0
      ? Math.round((learnerAvgs.reduce((a, b) => a + b, 0) / learnerAvgs.length) * 10) / 10
      : null;

  return batchExamsMatrixResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchName: meta.name,
      passMarkPct: matrix.pass_mark_pct,
      assessments: matrix.assessments.map((a) => ({
        assessmentId: a.assessment_id,
        title: a.title,
        shortTitle: shortAssessmentTitle(a.title),
        avgScorePct: a.avg_score_pct,
      })),
      learners: matrix.learners.map((learner) => ({
        membershipId: learner.membership_id,
        learnerName: learner.learner_name,
        email: learner.email,
        avgScorePct: learner.avg_score_pct,
        healthRail: learner.health_rail,
        cells: learner.cells.map((cell) => ({
          assessmentId: cell.assessment_id,
          kind: cell.kind,
          scorePct: cell.score_pct,
          attemptCount: cell.attempt_count,
        })),
      })),
      cohortAvgScorePct: cohortAvg,
    },
  });
}

export async function listBatchExamsBelowPass(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const passMarkPct = 70;
  const membershipIds = await batchesRosterRepository.listBatchExamsBelowPassMembershipIds(
    tx,
    batchId,
    meta.course_id,
    passMarkPct,
  );

  return batchExamsBelowPassResponseSchema.parse({
    data: { membershipIds, passMarkPct },
  });
}

const STALLED_DAYS = 14;

function formatDurationLabel(seconds: number | null): string | null {
  if (seconds == null || seconds <= 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${String(hours)}h ${remMins.toString().padStart(2, "0")}m`;
  }
  return `${String(mins)}m ${secs.toString().padStart(2, "0")}s`;
}

function lessonTypeLabel(
  type: "video" | "article" | "quiz" | "project" | "interactive" | "other",
): string {
  if (type === "video") return "Video";
  if (type === "article") return "Article";
  if (type === "quiz") return "Quiz";
  if (type === "project") return "Project";
  if (type === "interactive") return "Interactive";
  return "Lesson";
}

function computeWeeksBehind(
  avgCompletionPct: number | null,
  startsAt: Date | null,
  endsAt: Date | null,
): { weeksBehind: number | null; paceLabel: string | null } {
  if (avgCompletionPct == null || !startsAt || !endsAt) {
    return { weeksBehind: null, paceLabel: null };
  }
  const windowMs = endsAt.getTime() - startsAt.getTime();
  if (windowMs <= 0) return { weeksBehind: null, paceLabel: null };
  const elapsed = Math.min(windowMs, Math.max(0, Date.now() - startsAt.getTime()));
  const expectedPct = (elapsed / windowMs) * 100;
  const deltaPct = expectedPct - avgCompletionPct;
  if (Math.abs(deltaPct) < 1) {
    return { weeksBehind: 0, paceLabel: "Cohort is on schedule." };
  }
  const weeksInWindow = windowMs / (7 * 24 * 60 * 60 * 1000);
  const weeksBehind = Math.round((deltaPct / 100) * weeksInWindow * 10) / 10;
  if (weeksBehind > 0) {
    return {
      weeksBehind,
      paceLabel: `Cohort is ${String(weeksBehind)} week${weeksBehind === 1 ? "" : "s"} behind schedule.`,
    };
  }
  const ahead = Math.abs(weeksBehind);
  return {
    weeksBehind,
    paceLabel: `Cohort is ${String(ahead)} week${ahead === 1 ? "" : "s"} ahead of schedule.`,
  };
}

export async function getBatchContentReport(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const rosterCount = await batchesRosterRepository.countLearners(tx, { batchId });
  const [summary, funnel, paceSeries] = await Promise.all([
    batchesRosterRepository.summarizeBatchContent(
      tx,
      batchId,
      meta.course_id,
      rosterCount,
      STALLED_DAYS,
    ),
    meta.course_id
      ? batchesRosterRepository.listBatchContentFunnel(tx, batchId, meta.course_id, rosterCount)
      : Promise.resolve([]),
    batchesRosterRepository.listBatchContentPaceSeries(
      tx,
      batchId,
      meta.course_id,
      meta.starts_at,
      meta.ends_at,
    ),
  ]);

  const { weeksBehind, paceLabel } = computeWeeksBehind(
    summary.avg_completion_pct,
    meta.starts_at,
    meta.ends_at,
  );

  const modulesMap = new Map<
    string,
    {
      moduleId: string;
      title: string;
      position: number;
      lessons: Array<{
        lessonId: string;
        moduleId: string;
        moduleTitle: string;
        modulePosition: number;
        lessonPosition: number;
        sequenceNumber: number;
        title: string;
        lessonType: "video" | "article" | "quiz" | "project" | "interactive" | "other";
        typeLabel: string;
        completedCount: number;
        rosterCount: number;
        completionPct: number | null;
        medianDurationSeconds: number | null;
        medianDurationLabel: string | null;
        dropOffPct: number | null;
        healthRail: "none" | "warning" | "danger";
      }>;
    }
  >();

  let previousPct: number | null = null;
  for (const row of funnel) {
    const completionPct =
      rosterCount > 0 ? Math.round((row.completed_count / rosterCount) * 1000) / 10 : null;
    const dropOffPct =
      previousPct != null && completionPct != null
        ? Math.round((previousPct - completionPct) * 10) / 10
        : null;
    let healthRail: "none" | "warning" | "danger" = "none";
    if (dropOffPct != null && dropOffPct >= 25) healthRail = "danger";
    else if (dropOffPct != null && dropOffPct >= 12) healthRail = "warning";
    else if (completionPct != null && completionPct < 55) healthRail = "warning";

    const lesson = {
      lessonId: row.lesson_id,
      moduleId: row.module_id,
      moduleTitle: row.module_title,
      modulePosition: row.module_position,
      lessonPosition: row.lesson_position,
      sequenceNumber: row.sequence_number,
      title: row.title,
      lessonType: row.lesson_type,
      typeLabel: lessonTypeLabel(row.lesson_type),
      completedCount: row.completed_count,
      rosterCount,
      completionPct,
      medianDurationSeconds: row.median_duration_seconds,
      medianDurationLabel: formatDurationLabel(row.median_duration_seconds),
      dropOffPct,
      healthRail,
    };

    const existing = modulesMap.get(row.module_id);
    if (existing) {
      existing.lessons.push(lesson);
    } else {
      modulesMap.set(row.module_id, {
        moduleId: row.module_id,
        title: row.module_title,
        position: row.module_position,
        lessons: [lesson],
      });
    }
    previousPct = completionPct;
  }

  return batchContentResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchKey: meta.key,
      batchName: meta.name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      startsAt: meta.starts_at?.toISOString() ?? null,
      endsAt: meta.ends_at?.toISOString() ?? null,
      summary: {
        avgCompletionPct: summary.avg_completion_pct,
        avgCompletedLessons: summary.avg_completed_lessons,
        totalLessons: summary.total_lessons,
        finishedCount: summary.finished_count,
        stalledCount: summary.stalled_count,
        neverStartedCount: summary.never_started_count,
        medianDaysToFinish: summary.median_days_to_finish,
        rosterCount,
        stalledDaysThreshold: STALLED_DAYS,
        weeksBehindSchedule: weeksBehind,
        paceLabel,
      },
      completionSpread: {
        band0to25: summary.band_0_25,
        band26to50: summary.band_26_50,
        band51to75: summary.band_51_75,
        band76to100: summary.band_76_100,
      },
      paceSeries: paceSeries.map((point) => ({
        weekLabel: point.week_label,
        weekStart: point.week_start.toISOString(),
        completionPct: point.completion_pct,
        expectedPct: point.expected_pct,
      })),
      modules: [...modulesMap.values()].sort((a, b) => a.position - b.position),
    },
  });
}

export async function listBatchContentLearners(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchContentLearnersQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const listQuery = {
    view: query.view,
    sortBy: query.sortBy,
    sortDir: query.sortDir,
    limit: query.limit,
    page: query.page,
    ...(query.q ? { q: query.q } : {}),
  };

  const { items, totalCount } = await batchesRosterRepository.listBatchContentLearners(
    tx,
    batchId,
    meta.course_id,
    listQuery,
    STALLED_DAYS,
  );

  const endsAt = meta.ends_at;

  return batchContentLearnersResponseSchema.parse({
    data: {
      batchId: meta.id,
      items: items.map((row) => {
        const remaining = Math.max(0, row.total_lessons - row.completed_lessons);
        let projectedFinishAt: string | null = null;
        let projectedFinishLabel = "-";
        let willFinishInWindow: boolean | null = null;
        let activityStatus: "active" | "stalled" | "never_started" | "finished";

        if (row.total_lessons > 0 && row.completed_lessons >= row.total_lessons) {
          activityStatus = "finished";
          projectedFinishLabel = "Finished";
          willFinishInWindow = true;
        } else if (row.completed_lessons === 0) {
          activityStatus = "never_started";
          projectedFinishLabel = "Not started";
          willFinishInWindow = null;
        } else if (row.days_since_activity != null && row.days_since_activity >= STALLED_DAYS) {
          activityStatus = "stalled";
        } else {
          activityStatus = "active";
        }

        if (
          activityStatus !== "finished" &&
          activityStatus !== "never_started" &&
          row.lessons_per_day != null &&
          row.lessons_per_day > 0
        ) {
          const daysNeeded = remaining / row.lessons_per_day;
          const projected = new Date(Date.now() + daysNeeded * 86400000);
          projectedFinishAt = projected.toISOString();
          if (endsAt && projected.getTime() > endsAt.getTime()) {
            projectedFinishLabel = "Will not finish in window";
            willFinishInWindow = false;
          } else {
            projectedFinishLabel = projected.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
            willFinishInWindow = endsAt ? true : null;
          }
        } else if (activityStatus === "stalled" && endsAt) {
          projectedFinishLabel = "Will not finish in window";
          willFinishInWindow = false;
        }

        let healthRail: "none" | "success" | "warning" | "danger" = "none";
        if (activityStatus === "finished" || row.completion_pct >= 76) {
          healthRail = "success";
        } else if (willFinishInWindow === false || activityStatus === "stalled") {
          healthRail =
            row.days_since_activity != null && row.days_since_activity >= 21 ? "danger" : "warning";
        } else if (row.completion_pct < 40) {
          healthRail = "warning";
        }

        return {
          membershipId: row.membership_id,
          learnerName: row.learner_name,
          email: row.email,
          completionPct: row.completion_pct,
          completedLessons: row.completed_lessons,
          totalLessons: row.total_lessons,
          lastLessonTitle: row.last_lesson_title,
          lastLessonSequence: row.last_lesson_sequence,
          lastActivityAt: row.last_activity_at?.toISOString() ?? null,
          daysSinceActivity: row.days_since_activity,
          projectedFinishAt,
          projectedFinishLabel,
          willFinishInWindow,
          activityStatus,
          healthRail,
        };
      }),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function listBatchContentStalled(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const membershipIds = await batchesRosterRepository.listBatchContentStalledMembershipIds(
    tx,
    batchId,
    meta.course_id,
    STALLED_DAYS,
  );

  return batchContentStalledResponseSchema.parse({
    data: {
      membershipIds,
      stalledDaysThreshold: STALLED_DAYS,
    },
  });
}

const DEFAULT_NUDGES = [
  {
    id: "missed_two_sessions",
    title: "Missed two sessions",
    triggerKey: "missed_two_sessions",
    triggerLabel: "2 missed in 7 days",
    enabled: true,
  },
  {
    id: "below_pass_quiz",
    title: "Performance alert",
    triggerKey: "below_pass_quiz",
    triggerLabel: "<50% quiz score",
    enabled: true,
  },
  {
    id: "stalled_content",
    title: "Stalled on content",
    triggerKey: "stalled_content",
    triggerLabel: "No lesson in 14 days",
    enabled: false,
  },
] as const;

function readNudgesFromMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [...DEFAULT_NUDGES];
  }
  const record = metadata as Record<string, unknown>;
  const raw = record["messageNudges"];
  if (!Array.isArray(raw) || raw.length === 0) return [...DEFAULT_NUDGES];
  return raw
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const row = item as Record<string, unknown>;
      const id = typeof row["id"] === "string" ? row["id"] : null;
      const title = typeof row["title"] === "string" ? row["title"] : null;
      const triggerKey = typeof row["triggerKey"] === "string" ? row["triggerKey"] : null;
      const triggerLabel = typeof row["triggerLabel"] === "string" ? row["triggerLabel"] : null;
      if (!id || !title || !triggerKey || !triggerLabel) return null;
      return {
        id,
        title,
        triggerKey,
        triggerLabel,
        enabled: Boolean(row["enabled"]),
      };
    })
    .filter((item): item is (typeof DEFAULT_NUDGES)[number] => item != null);
}

export async function listBatchMessages(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  query: BatchMessagesQuery,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const rosterCount = await batchesRosterRepository.countLearners(tx, { batchId });
  const { items, totalCount } = await batchesRosterRepository.listBatchMessageHistory(tx, batchId, {
    page: query.page,
    limit: query.limit,
  });

  return batchMessagesListResponseSchema.parse({
    data: {
      batchId: meta.id,
      batchKey: meta.key,
      batchName: meta.name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      rosterCount,
      items: items.map((row) => ({
        sendGroupId: row.send_group_id,
        subject: row.subject,
        audienceLabel: row.audience_label,
        recipientCount: row.recipient_count,
        deliveredCount: row.delivered_count,
        skippedCount: row.skipped_count,
        failedCount: row.failed_count,
        openedCount: null,
        clickedCount: null,
        channels: row.channels.filter(
          (channel): channel is "email" | "in_app" => channel === "email" || channel === "in_app",
        ),
        status: row.status,
        sentAt: row.sent_at?.toISOString() ?? null,
        scheduledAt: row.scheduled_at?.toISOString() ?? null,
        sentByLabel: row.sent_by_label,
        isAutomated: row.is_automated,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

export async function listBatchMessageAudiences(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const [wholeBatch, atRisk, missedLast, belowPass, stalled] = await Promise.all([
    batchesRosterRepository.listLearnerMembershipIds(tx, { batchId }),
    batchesRosterRepository.listBatchAtRiskMembershipIds(tx, batchId, meta.course_id),
    batchesRosterRepository.listMissedLastSessionMembershipIds(tx, batchId, meta.course_id),
    batchesRosterRepository.listBatchExamsBelowPassMembershipIds(tx, batchId, meta.course_id, 70),
    batchesRosterRepository.listBatchContentStalledMembershipIds(
      tx,
      batchId,
      meta.course_id,
      STALLED_DAYS,
    ),
  ]);

  return batchMessagesAudiencesResponseSchema.parse({
    data: {
      batchId: meta.id,
      audiences: [
        {
          key: "whole_batch",
          label: `Whole batch (${String(wholeBatch.length)})`,
          count: wholeBatch.length,
          membershipIds: wholeBatch,
        },
        {
          key: "at_risk",
          label: `At risk (${String(atRisk.length)})`,
          count: atRisk.length,
          membershipIds: atRisk,
        },
        {
          key: "missed_last_session",
          label: `Missed last session (${String(missedLast.length)})`,
          count: missedLast.length,
          membershipIds: missedLast,
        },
        {
          key: "below_pass",
          label: `Below pass mark (${String(belowPass.length)})`,
          count: belowPass.length,
          membershipIds: belowPass,
        },
        {
          key: "stalled",
          label: `Stalled on content (${String(stalled.length)})`,
          count: stalled.length,
          membershipIds: stalled,
        },
      ],
    },
  });
}

export async function listBatchMessageNudges(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  return batchMessagesNudgesResponseSchema.parse({
    data: {
      batchId: meta.id,
      nudges: readNudgesFromMetadata(meta.metadata_json),
    },
  });
}

export async function updateBatchMessageNudges(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  nudges: Array<{
    id: string;
    title: string;
    triggerKey: string;
    triggerLabel: string;
    enabled: boolean;
  }>,
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const existing =
    meta.metadata_json &&
    typeof meta.metadata_json === "object" &&
    !Array.isArray(meta.metadata_json)
      ? { ...(meta.metadata_json as Record<string, unknown>) }
      : {};
  existing["messageNudges"] = nudges;
  await batchesRosterRepository.updateBatchMetadata(tx, batchId, existing);

  return batchMessagesNudgesResponseSchema.parse({
    data: {
      batchId: meta.id,
      nudges,
    },
  });
}

function formatAbsoluteWeekLabel(weekStart: Date): string {
  return weekStart.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

async function loadBatchCompareItem(
  tx: TenantTx,
  batchId: string,
  normalize: BatchesCompareQuery["normalize"],
) {
  const meta = await batchesRosterRepository.findBatchMeta(tx, batchId);
  if (!meta) throw batchRosterNotFound();

  const rosterCount = await batchesRosterRepository.countLearners(tx, { batchId });
  const [content, exams, live, activeLast14Days, atRiskIds, paceSeries] = await Promise.all([
    batchesRosterRepository.summarizeBatchContent(
      tx,
      batchId,
      meta.course_id,
      rosterCount,
      STALLED_DAYS,
    ),
    batchesRosterRepository.summarizeBatchExams(tx, batchId, meta.course_id, rosterCount),
    batchesRosterRepository.summarizeBatchLiveSessions(tx, batchId, meta.course_id, rosterCount),
    batchesRosterRepository.countActiveLearners(tx, batchId),
    batchesRosterRepository.listBatchAtRiskMembershipIds(tx, batchId, meta.course_id),
    batchesRosterRepository.listBatchContentPaceSeries(
      tx,
      batchId,
      meta.course_id,
      meta.starts_at,
      meta.ends_at,
    ),
  ]);

  const now = Date.now();
  const startsMs = meta.starts_at?.getTime() ?? null;
  const endsMs = meta.ends_at?.getTime() ?? null;
  const isRunning = (startsMs == null || startsMs <= now) && (endsMs == null || endsMs >= now);

  let currentWeekIndex: number | null = null;
  if (isRunning && startsMs != null) {
    currentWeekIndex = Math.max(0, Math.floor((now - startsMs) / (7 * 24 * 60 * 60 * 1000)));
  }

  const trend = paceSeries.map((point, index) => {
    const weekIndex = index;
    const weekLabel =
      normalize === "absolute_dates"
        ? formatAbsoluteWeekLabel(point.week_start)
        : `Week ${String(weekIndex + 1)}`;
    return {
      weekIndex,
      weekLabel,
      weekStart: point.week_start.toISOString(),
      contentCompletionPct: point.completion_pct,
    };
  });

  if (currentWeekIndex != null && trend.length > 0 && currentWeekIndex >= trend.length) {
    currentWeekIndex = trend.length - 1;
  }

  return {
    id: meta.id,
    key: meta.key,
    name: meta.name,
    status: meta.status,
    startsAt: meta.starts_at?.toISOString() ?? null,
    endsAt: meta.ends_at?.toISOString() ?? null,
    isRunning,
    currentWeekIndex,
    metrics: {
      learners: rosterCount,
      contentCompletionPct: content.avg_completion_pct,
      liveAttendancePct: live.avg_attendance_pct,
      testScorePct: exams.avg_score_pct,
      passRatePct: exams.pass_rate_pct,
      activeLast14Days,
      atRiskLearners: atRiskIds.length,
      sessionsHeld: live.sessions_held_count,
      avgWatchMinutes: live.avg_watch_minutes,
      medianDaysToFinish: content.median_days_to_finish,
    },
    completionSpread: {
      band0to25: content.band_0_25,
      band26to50: content.band_26_50,
      band51to75: content.band_51_75,
      band76to100: content.band_76_100,
    },
    trend,
  };
}

export async function compareBatches(tx: TenantTx, _ctx: ServiceCtx, query: BatchesCompareQuery) {
  const items = [];
  for (const batchId of query.batchIds) {
    items.push(await loadBatchCompareItem(tx, batchId, query.normalize));
  }

  return batchesCompareResponseSchema.parse({
    data: {
      normalize: query.normalize,
      items,
    },
  });
}
