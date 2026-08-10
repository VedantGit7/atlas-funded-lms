import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  liveAttendeeDetailResponseSchema,
  liveAttendeesListResponseSchema,
  liveClassSessionLiveMonitorResponseSchema,
  liveLearnerDetailResponseSchema,
  liveLearnersListResponseSchema,
  liveLearnersMatrixResponseSchema,
  liveSeriesDetailResponseSchema,
  liveSeriesListResponseSchema,
  liveSessionDetailResponseSchema,
  liveSessionsListResponseSchema,
  updateLiveClassAttendeeStatusResponseSchema,
  type LiveAttendeesQuery,
  type LiveLearnerDetailQuery,
  type LiveLearnersListQuery,
  type LiveLearnersMatrixQuery,
  type LiveSeriesDetailQuery,
  type LiveSeriesListQuery,
  type LiveSessionsListQuery,
  type UpdateLiveClassAttendeeStatusBody,
} from "./live-class-attendance-roster.dto";
import {
  liveClassAttendanceStatusOverrideFailed,
  liveClassAttendeeNotFound,
  liveClassLearnerNotFound,
  liveClassSeriesNotFound,
  liveClassSessionNotFound,
} from "./live-class-attendance-roster.errors";
import {
  liveClassAttendanceRosterRepository,
  type LiveAttendeesFilter,
  type LiveSessionListRow,
} from "./live-class-attendance-roster.repository";

type AttendanceStatus = "registered" | "attended" | "absent";

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

function mapSessionListItem(row: LiveSessionListRow) {
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
    attendanceCount: row.attendance_count,
    registeredCount: row.registered_count,
    avgCoverageSeconds: row.avg_coverage_seconds,
  };
}

function toAttendeeFilter(
  sessionId: string,
  input: Partial<{
    learnerName?: string;
    email?: string;
    status?: string;
    joinedFrom?: string;
    joinedTo?: string;
  }>,
): LiveAttendeesFilter {
  const filter: LiveAttendeesFilter = { sessionId };
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.email) filter.email = input.email;
  if (input.status) filter.status = input.status;
  if (input.joinedFrom) filter.joinedFrom = input.joinedFrom;
  if (input.joinedTo) filter.joinedTo = input.joinedTo;
  return filter;
}

function normalizeStatus(status: string): AttendanceStatus {
  if (status === "attended" || status === "absent" || status === "registered") return status;
  return "registered";
}

function inferSystemStatus(args: {
  status: string;
  joinedAt: Date | null;
  durationSeconds: number | null;
}): AttendanceStatus {
  if (args.joinedAt != null || (args.durationSeconds != null && args.durationSeconds > 0)) {
    return "attended";
  }
  if (args.status === "absent") return "absent";
  return "registered";
}

function contradictsSystemData(status: AttendanceStatus, systemStatus: AttendanceStatus) {
  return status !== systemStatus;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    const left = sorted[mid - 1];
    const right = sorted[mid];
    if (left === undefined || right === undefined) return null;
    return Math.round((left + right) / 2);
  }
  return sorted[mid] ?? null;
}

function buildStanding(args: {
  status: AttendanceStatus;
  learnerDurationSeconds: number | null;
  cohortDurations: number[];
}) {
  const histogramBuckets = 12;
  const cohortSize = args.cohortDurations.length;
  const medianDurationSeconds = median(args.cohortDurations);

  if (args.status === "absent" || args.status === "registered") {
    return {
      band: "absent" as const,
      label: args.status === "absent" ? "No attendance recorded" : "Not yet attended",
      learnerDurationSeconds: args.learnerDurationSeconds,
      medianDurationSeconds,
      cohortSize,
      histogram: Array.from({ length: histogramBuckets }, () => 0),
      learnerBucketIndex: null,
      medianBucketIndex: null,
    };
  }

  if (cohortSize === 0 || args.learnerDurationSeconds == null || medianDurationSeconds == null) {
    return {
      band: "unavailable" as const,
      label: "Standing unavailable for this session",
      learnerDurationSeconds: args.learnerDurationSeconds,
      medianDurationSeconds,
      cohortSize,
      histogram: Array.from({ length: histogramBuckets }, () => 0),
      learnerBucketIndex: null,
      medianBucketIndex: null,
    };
  }

  const maxDuration = Math.max(...args.cohortDurations, args.learnerDurationSeconds, 1);
  const histogram = Array.from({ length: histogramBuckets }, () => 0);
  for (const duration of args.cohortDurations) {
    const index = Math.min(
      histogramBuckets - 1,
      Math.floor((duration / maxDuration) * histogramBuckets),
    );
    histogram[index] = (histogram[index] ?? 0) + 1;
  }

  const learnerBucketIndex = Math.min(
    histogramBuckets - 1,
    Math.floor((args.learnerDurationSeconds / maxDuration) * histogramBuckets),
  );
  const medianBucketIndex = Math.min(
    histogramBuckets - 1,
    Math.floor((medianDurationSeconds / maxDuration) * histogramBuckets),
  );

  const delta = args.learnerDurationSeconds - medianDurationSeconds;
  const band =
    Math.abs(delta) <= 60
      ? ("at_median" as const)
      : delta > 0
        ? ("above_median" as const)
        : ("below_median" as const);
  const label =
    band === "at_median"
      ? `Near the median of ${formatStandingDuration(medianDurationSeconds)}`
      : band === "above_median"
        ? `Above the median of ${formatStandingDuration(medianDurationSeconds)}`
        : `Below the median of ${formatStandingDuration(medianDurationSeconds)}`;

  return {
    band,
    label,
    learnerDurationSeconds: args.learnerDurationSeconds,
    medianDurationSeconds,
    cohortSize,
    histogram,
    learnerBucketIndex,
    medianBucketIndex,
  };
}

function formatStandingDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  if (minutes > 0) return `${minutes}m ${String(secs).padStart(2, "0")}s`;
  return `${secs}s`;
}

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
  durationSeconds: number | null,
) {
  const bucketMinutes = 1;
  const plannedMinutes =
    durationSeconds != null && durationSeconds > 0
      ? Math.max(1, Math.ceil(durationSeconds / 60))
      : 60;
  const startMs = sessionStart?.getTime() ?? null;
  if (!startMs || intervals.length === 0) {
    return {
      bucketMinutes,
      points: Array.from({ length: Math.min(plannedMinutes + 1, 121) }, (_, offsetMinutes) => ({
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

  const maxOffset = Math.min(Math.max(plannedMinutes, 1), 180);
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
    const prev = points[i - 1];
    const curr = points[i];
    if (prev == null || curr == null) continue;
    const drop = prev.concurrent - curr.concurrent;
    if (drop > bestDrop && drop >= 3) {
      bestDrop = drop;
      const fromOffsetMinutes = Math.max(0, curr.offsetMinutes - 2);
      const toOffsetMinutes = curr.offsetMinutes;
      dropInsight = {
        fromOffsetMinutes,
        toOffsetMinutes,
        learnersLeft: drop,
        message: `${String(drop)} learners left between ${String(Math.floor(fromOffsetMinutes / 60))}:${String(fromOffsetMinutes % 60).padStart(2, "0")} and ${String(Math.floor(toOffsetMinutes / 60))}:${String(toOffsetMinutes % 60).padStart(2, "0")}.`,
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

export async function listLiveClassAttendanceSessions(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: LiveSessionsListQuery,
) {
  const [totalCount, rows, summary] = await Promise.all([
    liveClassAttendanceRosterRepository.countSessions(tx, query),
    liveClassAttendanceRosterRepository.listSessions(tx, query),
    liveClassAttendanceRosterRepository.summarizeSessions(tx, query),
  ]);

  return liveSessionsListResponseSchema.parse({
    data: {
      items: rows.map(mapSessionListItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        sessionsHeld: summary.sessions_held,
        cancelledCount: summary.cancelled_count,
        scheduledAheadCount: summary.scheduled_ahead_count,
        avgAttendancePct: summary.avg_attendance_pct,
        totalAttendedCount: summary.total_attended_count,
        totalRegisteredCount: summary.total_registered_count,
        totalTimeSeconds: summary.total_time_seconds,
        avgCoveragePct: summary.avg_coverage_pct,
        lowTurnoutCount: summary.low_turnout_count,
      },
    },
  });
}

export async function getLiveClassSessionDetailedReport(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const cancelled = sessionIsCancelled(meta.status);
  const upcoming = sessionIsUpcoming(meta.status, meta.scheduled_at, meta.ended_at);

  const [totals, statusCounts, intervals, nextSession, historicalRate] = await Promise.all([
    liveClassAttendanceRosterRepository.sessionAttendanceTotals(tx, sessionId),
    liveClassAttendanceRosterRepository.countByStatus(tx, sessionId),
    cancelled || upcoming
      ? Promise.resolve([])
      : liveClassAttendanceRosterRepository.listAttendanceIntervals(tx, sessionId),
    liveClassAttendanceRosterRepository.findNextSession(tx, sessionId),
    upcoming
      ? liveClassAttendanceRosterRepository.historicalAttendanceRate(tx, sessionId)
      : Promise.resolve(null),
  ]);

  const timeline = buildAttendanceTimeline(
    intervals,
    meta.started_at ?? meta.scheduled_at,
    meta.duration_seconds,
  );

  const startDelayMinutes =
    meta.scheduled_at && meta.started_at
      ? Math.max(0, Math.round((meta.started_at.getTime() - meta.scheduled_at.getTime()) / 60_000))
      : null;

  const avgCoveragePct =
    meta.duration_seconds && meta.duration_seconds > 0 && totals.avgDurationSeconds != null
      ? Math.min(100, Math.round((totals.avgDurationSeconds / meta.duration_seconds) * 1000) / 10)
      : null;

  const absentCount =
    statusCounts.absent +
    (statusCounts.registered > 0 &&
    statusCounts.attended + statusCounts.absent < meta.registered_count
      ? Math.max(0, meta.registered_count - statusCounts.attended - statusCounts.absent)
      : statusCounts.registered);

  const expectedTurnoutPct = upcoming ? historicalRate : null;
  const expectedTurnoutCount =
    upcoming && expectedTurnoutPct != null
      ? Math.round((meta.registered_count * expectedTurnoutPct) / 100)
      : null;

  const peakAt =
    !cancelled && !upcoming && meta.started_at && timeline.peakConcurrentOffsetMinutes != null
      ? new Date(
          meta.started_at.getTime() + timeline.peakConcurrentOffsetMinutes * 60_000,
        ).toISOString()
      : null;

  return liveSessionDetailResponseSchema.parse({
    data: {
      ...mapSessionListItem(meta),
      totalAttendanceSeconds: totals.totalAttendanceSeconds,
      avgDurationSeconds: totals.avgDurationSeconds,
      absentCount:
        cancelled || upcoming
          ? Math.max(0, meta.registered_count - meta.attendance_count)
          : absentCount,
      avgCoveragePct: cancelled || upcoming ? null : avgCoveragePct,
      startDelayMinutes: cancelled || upcoming ? null : startDelayMinutes,
      cancelledAt: cancelled ? ((meta.ended_at ?? meta.scheduled_at)?.toISOString() ?? null) : null,
      nextSessionAt: nextSession?.scheduled_at?.toISOString() ?? null,
      nextSessionTitle: nextSession?.title ?? null,
      expectedTurnoutCount,
      expectedTurnoutPct,
      recordingUrl: null,
      peakConcurrent: cancelled || upcoming ? null : timeline.peakConcurrent,
      peakConcurrentAt: peakAt,
      peakConcurrentOffsetMinutes:
        cancelled || upcoming ? null : timeline.peakConcurrentOffsetMinutes,
      timeline: {
        bucketMinutes: timeline.bucketMinutes,
        points: cancelled || upcoming ? [] : timeline.points,
        dropInsight: cancelled || upcoming ? null : timeline.dropInsight,
      },
    },
  });
}

export async function listLiveClassSessionAttendees(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
  query: LiveAttendeesQuery,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const filter = toAttendeeFilter(sessionId, {
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.email ? { email: query.email } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.joinedFrom ? { joinedFrom: query.joinedFrom } : {}),
    ...(query.joinedTo ? { joinedTo: query.joinedTo } : {}),
  });

  const [totalCount, rows] = await Promise.all([
    liveClassAttendanceRosterRepository.countAttendees(tx, filter),
    liveClassAttendanceRosterRepository.listAttendees(tx, sessionId, query),
  ]);

  return liveAttendeesListResponseSchema.parse({
    data: {
      sessionId,
      sessionTitle: meta.title,
      items: rows.map((row) => ({
        id: row.id,
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        status: row.status,
        joinedAt: row.joined_at?.toISOString() ?? null,
        leftAt: row.left_at?.toISOString() ?? null,
        durationSeconds: row.duration_seconds,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

export async function getLiveClassAttendeeDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
  attendeeId: string,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const attendee = await liveClassAttendanceRosterRepository.findAttendeeById(
    tx,
    sessionId,
    attendeeId,
  );
  if (!attendee) throw liveClassAttendeeNotFound();

  const [cohortDurations, history, historyCounts] = await Promise.all([
    liveClassAttendanceRosterRepository.listSessionAttendedDurations(tx, sessionId),
    liveClassAttendanceRosterRepository.listLearnerAttendanceHistory(tx, {
      sessionId,
      membershipId: attendee.membership_id,
      limit: 10,
    }),
    liveClassAttendanceRosterRepository.countLearnerAttendanceHistory(tx, {
      sessionId,
      membershipId: attendee.membership_id,
    }),
  ]);

  const status = normalizeStatus(attendee.status);
  const systemInferredStatus = inferSystemStatus({
    status: attendee.status,
    joinedAt: attendee.joined_at,
    durationSeconds: attendee.duration_seconds,
  });

  const sessionDurationSeconds = meta.duration_seconds;
  const coveragePct =
    sessionDurationSeconds != null &&
    sessionDurationSeconds > 0 &&
    attendee.duration_seconds != null
      ? Math.min(100, Math.round((attendee.duration_seconds / sessionDurationSeconds) * 1000) / 10)
      : null;

  const joinDelayMinutes =
    meta.started_at && attendee.joined_at
      ? Math.max(0, Math.round((attendee.joined_at.getTime() - meta.started_at.getTime()) / 60_000))
      : null;

  const segments =
    attendee.joined_at != null
      ? [
          {
            id: attendee.id,
            index: 1,
            joinedAt: attendee.joined_at.toISOString(),
            leftAt: attendee.left_at?.toISOString() ?? null,
            durationSeconds: attendee.duration_seconds,
            shareOfSessionPct: coveragePct,
            clientLabel: null as string | null,
          },
        ]
      : [];

  const attendanceRatePct =
    historyCounts.total_sessions > 0
      ? Math.round((historyCounts.attended_count / historyCounts.total_sessions) * 1000) / 10
      : null;

  return liveAttendeeDetailResponseSchema.parse({
    data: {
      id: attendee.id,
      sessionId: meta.id,
      sessionTitle: meta.title,
      sessionStatus: meta.status,
      sessionScheduledAt: meta.scheduled_at?.toISOString() ?? null,
      sessionStartedAt: meta.started_at?.toISOString() ?? null,
      sessionEndedAt: meta.ended_at?.toISOString() ?? null,
      sessionDurationSeconds,
      membershipId: attendee.membership_id,
      learnerName: attendee.learner_name,
      email: attendee.email,
      status,
      systemInferredStatus,
      contradictsSystemData: contradictsSystemData(status, systemInferredStatus),
      registeredAt: attendee.created_at?.toISOString() ?? null,
      batchId: meta.batch_id,
      batchName: meta.batch_name,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      joinedAt: attendee.joined_at?.toISOString() ?? null,
      leftAt: attendee.left_at?.toISOString() ?? null,
      durationSeconds: attendee.duration_seconds,
      coveragePct,
      joinDelayMinutes,
      rejoinCount: Math.max(0, segments.length - 1),
      longestGapSeconds: null,
      overrideReason: attendee.override_reason,
      overriddenAt: attendee.overridden_at?.toISOString() ?? null,
      segments,
      standing: buildStanding({
        status,
        learnerDurationSeconds: attendee.duration_seconds,
        cohortDurations,
      }),
      historySummary: {
        attendedCount: historyCounts.attended_count,
        totalSessions: historyCounts.total_sessions,
        attendanceRatePct,
      },
      history: history.map((row) => ({
        sessionId: row.session_id,
        attendeeId: row.attendee_id,
        title: row.title,
        scheduledAt: row.scheduled_at?.toISOString() ?? null,
        status: row.status,
        coveragePct:
          row.session_duration_seconds != null &&
          row.session_duration_seconds > 0 &&
          row.duration_seconds != null
            ? Math.min(
                100,
                Math.round((row.duration_seconds / row.session_duration_seconds) * 1000) / 10,
              )
            : null,
        durationSeconds: row.duration_seconds,
        isCurrent: row.is_current,
      })),
    },
  });
}

export async function updateLiveClassAttendeeStatus(
  tx: TenantTx,
  ctx: ServiceCtx,
  sessionId: string,
  attendeeId: string,
  body: UpdateLiveClassAttendeeStatusBody,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const attendee = await liveClassAttendanceRosterRepository.findAttendeeById(
    tx,
    sessionId,
    attendeeId,
  );
  if (!attendee) throw liveClassAttendeeNotFound();

  const nextStatus = body.status;
  const systemInferredStatus = inferSystemStatus({
    status: attendee.status,
    joinedAt: attendee.joined_at,
    durationSeconds: attendee.duration_seconds,
  });
  const willContradict = contradictsSystemData(nextStatus, systemInferredStatus);
  const reason = body.reason?.trim() || null;

  if (willContradict && !reason) {
    throw liveClassAttendanceStatusOverrideFailed(
      "A reason is required when the status contradicts recorded join data.",
    );
  }

  const updated = await liveClassAttendanceRosterRepository.updateAttendeeStatus(tx, {
    sessionId,
    attendeeId,
    status: nextStatus,
    reason: willContradict || nextStatus !== normalizeStatus(attendee.status) ? reason : reason,
    actorMembershipId: ctx.actorMembershipId,
  });
  if (!updated) throw liveClassAttendeeNotFound();

  const refreshed = await liveClassAttendanceRosterRepository.findAttendeeById(
    tx,
    sessionId,
    attendeeId,
  );
  if (!refreshed) throw liveClassAttendeeNotFound();

  const status = normalizeStatus(refreshed.status);
  const refreshedSystem = inferSystemStatus({
    status: refreshed.status,
    joinedAt: refreshed.joined_at,
    durationSeconds: refreshed.duration_seconds,
  });

  return updateLiveClassAttendeeStatusResponseSchema.parse({
    data: {
      id: refreshed.id,
      status,
      contradictsSystemData: contradictsSystemData(status, refreshedSystem),
      overrideReason: refreshed.override_reason,
      overriddenAt: refreshed.overridden_at?.toISOString() ?? null,
    },
  });
}

function presenceState(row: {
  joined_at: Date | null;
  left_at: Date | null;
}): "present" | "left" | "not_joined" {
  if (!row.joined_at) return "not_joined";
  if (row.left_at) return "left";
  return "present";
}

function clipTimelinePoints(
  points: Array<{ offsetMinutes: number; concurrent: number }>,
  asOfOffsetMinutes: number,
) {
  if (points.length === 0) return points;
  const clipped = points.filter((p) => p.offsetMinutes <= asOfOffsetMinutes);
  if (clipped.length > 0) return clipped;
  return points.slice(0, 1);
}

export async function getLiveClassSessionLiveMonitor(
  tx: TenantTx,
  _ctx: ServiceCtx,
  sessionId: string,
) {
  const meta = await liveClassAttendanceRosterRepository.findSessionById(tx, sessionId);
  if (!meta) throw liveClassSessionNotFound();

  const now = new Date();
  const status = meta.status.toLowerCase();
  const isEnded =
    Boolean(meta.ended_at) ||
    status === "ended" ||
    status === "completed" ||
    status === "cancelled";
  const isLive =
    !isEnded &&
    (status === "live" ||
      status === "in_progress" ||
      (meta.started_at != null && meta.ended_at == null));
  // Frozen only after the session has actually ended (upcoming uses the live shell).
  const frozen = isEnded;

  const sessionStart = meta.started_at ?? meta.scheduled_at;

  let elapsedSeconds: number | null = null;
  let ranForSeconds: number | null = null;
  if (meta.started_at && meta.ended_at) {
    ranForSeconds = Math.max(
      0,
      Math.floor((meta.ended_at.getTime() - meta.started_at.getTime()) / 1000),
    );
  } else if (meta.started_at && isLive) {
    elapsedSeconds = Math.max(0, Math.floor((now.getTime() - meta.started_at.getTime()) / 1000));
  }

  // Scheduled length for axis: prefer actual run when ended, else 60m (or longer if overrun).
  const plannedMinutes = (() => {
    if (ranForSeconds != null && ranForSeconds > 0) {
      return Math.max(1, Math.ceil(ranForSeconds / 60));
    }
    const elapsedMin = elapsedSeconds != null ? Math.max(1, Math.ceil(elapsedSeconds / 60)) : 0;
    return Math.min(180, Math.max(60, elapsedMin + 5));
  })();

  const [intervals, roster] = await Promise.all([
    liveClassAttendanceRosterRepository.listAttendanceIntervals(tx, sessionId),
    liveClassAttendanceRosterRepository.listLiveMonitorRoster(tx, sessionId),
  ]);

  const timelineFull = buildAttendanceTimeline(intervals, sessionStart, plannedMinutes * 60);

  let asOfOffsetMinutes = plannedMinutes;
  if (sessionStart && isLive) {
    asOfOffsetMinutes = Math.max(
      0,
      Math.min(plannedMinutes, Math.floor((now.getTime() - sessionStart.getTime()) / 60_000)),
    );
  } else if (sessionStart && meta.ended_at) {
    asOfOffsetMinutes = Math.max(
      0,
      Math.min(
        plannedMinutes,
        Math.floor((meta.ended_at.getTime() - sessionStart.getTime()) / 60_000),
      ),
    );
  }

  const points = clipTimelinePoints(timelineFull.points, asOfOffsetMinutes);
  const lastPoint = points.length > 0 ? points[points.length - 1] : undefined;
  const currentConcurrent = lastPoint?.concurrent ?? 0;

  let peakConcurrent = timelineFull.peakConcurrent;
  let peakConcurrentOffsetMinutes = timelineFull.peakConcurrentOffsetMinutes;
  if (isLive && points.length > 0) {
    peakConcurrent = 0;
    peakConcurrentOffsetMinutes = 0;
    for (const p of points) {
      if (p.concurrent >= peakConcurrent) {
        peakConcurrent = p.concurrent;
        peakConcurrentOffsetMinutes = p.offsetMinutes;
      }
    }
  }

  const peakConcurrentAt =
    sessionStart && peakConcurrentOffsetMinutes != null
      ? new Date(sessionStart.getTime() + peakConcurrentOffsetMinutes * 60_000).toISOString()
      : null;

  const fiveMinAgo = now.getTime() - 5 * 60_000;
  let presentCount = 0;
  let leftCount = 0;
  let notJoinedCount = 0;
  let joinedCount = 0;
  let joinedLast5Min = 0;

  const presence = roster.map((row) => {
    const state = presenceState(row);
    if (state === "present") presentCount += 1;
    else if (state === "left") leftCount += 1;
    else notJoinedCount += 1;
    if (row.joined_at) {
      joinedCount += 1;
      if (row.joined_at.getTime() >= fiveMinAgo) joinedLast5Min += 1;
    }
    return {
      membershipId: row.membership_id,
      attendeeId: row.id,
      learnerName: row.learner_name,
      email: row.email,
      state,
      joinedAt: row.joined_at?.toISOString() ?? null,
      leftAt: row.left_at?.toISOString() ?? null,
      durationSeconds: row.duration_seconds,
    };
  });

  const registeredCount = roster.length;
  const ratePct =
    registeredCount === 0 ? null : Math.round((joinedCount / registeredCount) * 1000) / 10;

  type EventRow = {
    kind: "joined" | "left";
    at: Date;
    membershipId: string;
    attendeeId: string;
    learnerName: string | null;
    email: string | null;
    durationSeconds: number | null;
  };
  const events: EventRow[] = [];
  for (const row of roster) {
    if (row.joined_at) {
      events.push({
        kind: "joined",
        at: row.joined_at,
        membershipId: row.membership_id,
        attendeeId: row.id,
        learnerName: row.learner_name,
        email: row.email,
        durationSeconds: row.duration_seconds,
      });
    }
    if (row.left_at) {
      events.push({
        kind: "left",
        at: row.left_at,
        membershipId: row.membership_id,
        attendeeId: row.id,
        learnerName: row.learner_name,
        email: row.email,
        durationSeconds: row.duration_seconds,
      });
    }
  }
  events.sort((a, b) => b.at.getTime() - a.at.getTime());

  const notYetJoined = roster
    .filter((row) => !row.joined_at)
    .map((row) => ({
      membershipId: row.membership_id,
      attendeeId: row.id,
      learnerName: row.learner_name,
      email: row.email,
      batchId: row.batch_id,
      batchName: row.batch_name,
      lastSessionStatus: row.last_session_status,
      attendanceRatePct:
        row.history_total > 0
          ? Math.round((row.history_attended / row.history_total) * 1000) / 10
          : null,
    }));

  return liveClassSessionLiveMonitorResponseSchema.parse({
    data: {
      sessionId: meta.id,
      title: meta.title,
      status: meta.status,
      courseId: meta.course_id,
      courseTitle: meta.course_title,
      batchId: meta.batch_id,
      batchName: meta.batch_name,
      scheduledAt: meta.scheduled_at?.toISOString() ?? null,
      startedAt: meta.started_at?.toISOString() ?? null,
      endedAt: meta.ended_at?.toISOString() ?? null,
      scheduledDurationSeconds: meta.duration_seconds,
      serverNow: now.toISOString(),
      elapsedSeconds,
      ranForSeconds,
      frozen,
      turnout: {
        joinedCount,
        registeredCount,
        presentCount,
        leftCount,
        notJoinedCount,
        ratePct,
        joinedLast5Min,
      },
      timeline: {
        bucketMinutes: timelineFull.bucketMinutes,
        plannedMinutes,
        asOfOffsetMinutes,
        points,
        currentConcurrent,
        peakConcurrent,
        peakConcurrentOffsetMinutes,
        peakConcurrentAt,
      },
      recentEvents: events.slice(0, 24).map((event) => ({
        kind: event.kind,
        at: event.at.toISOString(),
        membershipId: event.membershipId,
        attendeeId: event.attendeeId,
        learnerName: event.learnerName,
        email: event.email,
        durationSeconds: event.durationSeconds,
      })),
      presence,
      notYetJoined,
    },
  });
}

function streakFromRecent(statuses: string[]): {
  streakKind: "attended" | "missed" | "none";
  streakCount: number;
  streakLabel: string;
} {
  if (statuses.length === 0) {
    return { streakKind: "none", streakCount: 0, streakLabel: "—" };
  }
  const first = statuses[0];
  let count = 0;
  for (const status of statuses) {
    if (status !== first) break;
    count += 1;
  }
  if (first === "attended") {
    return {
      streakKind: "attended",
      streakCount: count,
      streakLabel: count === 1 ? "1 in a row" : `${String(count)} in a row`,
    };
  }
  return {
    streakKind: "missed",
    streakCount: count,
    streakLabel: count === 1 ? "Missed last 1" : `Missed last ${String(count)}`,
  };
}

function learnerHealth(
  attendedCount: number,
  registeredCount: number,
  ratePct: number | null,
): "danger" | "warning" | "ok" {
  if (registeredCount > 0 && attendedCount === 0) return "danger";
  if (ratePct != null && ratePct < 40) return "warning";
  return "ok";
}

export async function listLiveClassAttendanceLearners(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: LiveLearnersListQuery,
) {
  const [totalCount, rows, summary] = await Promise.all([
    liveClassAttendanceRosterRepository.countLearnersRollup(tx, {
      q: query.q,
      courseId: query.courseId,
      batchId: query.batchId,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
      attendanceRateBand: query.attendanceRateBand,
      sessionsRegisteredBand: query.sessionsRegisteredBand,
      lastAttended: query.lastAttended,
    }),
    liveClassAttendanceRosterRepository.listLearnersRollup(tx, {
      q: query.q,
      courseId: query.courseId,
      batchId: query.batchId,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
      attendanceRateBand: query.attendanceRateBand,
      sessionsRegisteredBand: query.sessionsRegisteredBand,
      lastAttended: query.lastAttended,
      sortBy: query.sortBy,
      sortDir: query.sortDir,
      limit: query.limit,
      page: query.page,
    }),
    liveClassAttendanceRosterRepository.summarizeLearnersRollup(tx, {
      q: query.q,
      courseId: query.courseId,
      batchId: query.batchId,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
    }),
  ]);

  return liveLearnersListResponseSchema.parse({
    data: {
      items: rows.map((row) => {
        const streak = streakFromRecent(row.recent_statuses);
        const rate = row.attendance_rate_pct;
        return {
          membershipId: row.membership_id,
          learnerName: row.learner_name,
          email: row.email,
          batchId: row.batch_id,
          batchName: row.batch_name,
          registeredCount: row.registered_count,
          attendedCount: row.attended_count,
          absentCount: row.absent_count,
          attendanceRatePct: rate,
          totalTimeSeconds: row.total_time_seconds,
          avgCoveragePct: row.avg_coverage_pct,
          lastAttendedAt: row.last_attended_at?.toISOString() ?? null,
          lastAttendedSessionId: row.last_attended_session_id,
          lastAttendedSessionTitle: row.last_attended_session_title,
          streakKind: streak.streakKind,
          streakCount: streak.streakCount,
          streakLabel: streak.streakLabel,
          health: learnerHealth(row.attended_count, row.registered_count, rate),
        };
      }),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        learnersRegistered: summary.learners_registered,
        avgAttendanceRatePct: summary.avg_attendance_rate_pct,
        neverAttendedCount: summary.never_attended_count,
        perfectAttendanceCount: summary.perfect_attendance_count,
        avgCoveragePct: summary.avg_coverage_pct,
      },
      columns: query.columns,
    },
  });
}

export async function getLiveClassAttendanceLearnersMatrix(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: LiveLearnersMatrixQuery,
) {
  const matrix = await liveClassAttendanceRosterRepository.listLearnersMatrix(tx, {
    q: query.q,
    courseId: query.courseId,
    batchId: query.batchId,
    scheduledFrom: query.scheduledFrom,
    scheduledTo: query.scheduledTo,
    attendanceRateBand: query.attendanceRateBand,
    sessionsRegisteredBand: query.sessionsRegisteredBand,
    lastAttended: query.lastAttended,
    learnerLimit: query.learnerLimit,
    sessionLimit: query.sessionLimit,
  });

  const cellsByMembership = new Map<string, typeof matrix.cells>();
  for (const cell of matrix.cells) {
    const list = cellsByMembership.get(cell.membership_id) ?? [];
    list.push(cell);
    cellsByMembership.set(cell.membership_id, list);
  }

  const attentionRequired = matrix.learners.some(
    (learner) =>
      learner.registered_count > 0 &&
      (learner.attended_count === 0 ||
        (learner.attendance_rate_pct != null && learner.attendance_rate_pct < 40)),
  );

  return liveLearnersMatrixResponseSchema.parse({
    data: {
      sessions: matrix.sessions.map((session) => ({
        sessionId: session.session_id,
        title: session.title,
        scheduledAt: session.scheduled_at?.toISOString() ?? null,
        turnoutRatePct: session.turnout_rate_pct,
      })),
      learners: matrix.learners.map((learner) => {
        const cellMap = new Map(
          (cellsByMembership.get(learner.membership_id) ?? []).map((cell) => [
            cell.session_id,
            cell,
          ]),
        );
        return {
          membershipId: learner.membership_id,
          learnerName: learner.learner_name,
          email: learner.email,
          attendanceRatePct: learner.attendance_rate_pct,
          attendedCount: learner.attended_count,
          registeredCount: learner.registered_count,
          cells: matrix.sessions.map((session) => {
            const cell = cellMap.get(session.session_id);
            return {
              sessionId: session.session_id,
              cell: cell?.cell ?? "not_registered",
              attendeeId: cell?.attendee_id ?? null,
            };
          }),
        };
      }),
      attentionRequired,
    },
  });
}

type LearnerSessionUiStatus = "present" | "absent" | "partial" | "registered";

function coveragePctForSession(
  durationSeconds: number | null,
  sessionDurationSeconds: number | null,
): number | null {
  if (durationSeconds == null || sessionDurationSeconds == null || sessionDurationSeconds <= 0) {
    return null;
  }
  return Math.min(100, Math.round((durationSeconds / sessionDurationSeconds) * 1000) / 10);
}

function mapLearnerSessionStatus(args: {
  status: string;
  joinedAt: Date | null;
  coveragePct: number | null;
}): LearnerSessionUiStatus {
  const attended = args.status === "attended" || args.joinedAt != null;
  if (attended) {
    if (args.coveragePct != null && args.coveragePct < 50) return "partial";
    return "present";
  }
  if (args.status === "absent") return "absent";
  if (args.joinedAt == null) return "absent";
  return "registered";
}

function joinDelayMinutes(startedAt: Date | null, joinedAt: Date | null): number | null {
  if (!startedAt || !joinedAt) return null;
  return Math.round((joinedAt.getTime() - startedAt.getTime()) / 60_000);
}

function leaveEarlyMinutes(endedAt: Date | null, leftAt: Date | null): number | null {
  if (!endedAt || !leftAt) return null;
  return Math.max(0, Math.round((endedAt.getTime() - leftAt.getTime()) / 60_000));
}

function monthKeyFromDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${String(year)}-${month}`;
}

function monthLabelFromKey(key: string): string {
  const [year, month] = key.split("-");
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, 1));
  return date.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function longestAbsenceGap(
  sessionsChrono: Array<{
    status: LearnerSessionUiStatus;
    scheduledAt: Date | null;
  }>,
): {
  missedCount: number;
  label: string;
  fromScheduledAt: string | null;
  toScheduledAt: string | null;
} | null {
  let bestStart = -1;
  let bestLen = 0;
  let runStart = -1;
  let runLen = 0;

  for (let i = 0; i < sessionsChrono.length; i += 1) {
    const session = sessionsChrono[i];
    if (session == null) continue;
    const absent = session.status === "absent";
    if (absent) {
      if (runLen === 0) runStart = i;
      runLen += 1;
      if (runLen > bestLen) {
        bestLen = runLen;
        bestStart = runStart;
      }
    } else {
      runLen = 0;
      runStart = -1;
    }
  }

  if (bestLen < 2 || bestStart < 0) return null;
  const from = sessionsChrono[bestStart]?.scheduledAt ?? null;
  const to = sessionsChrono[bestStart + bestLen - 1]?.scheduledAt ?? null;
  const monthHint = from ? from.toLocaleString("en-US", { month: "long", timeZone: "UTC" }) : null;
  const label = monthHint
    ? `Missed ${String(bestLen)} consecutive sessions in ${monthHint}`
    : `Missed ${String(bestLen)} consecutive sessions`;
  return {
    missedCount: bestLen,
    label,
    fromScheduledAt: from?.toISOString() ?? null,
    toScheduledAt: to?.toISOString() ?? null,
  };
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export async function getLiveClassLearnerAttendanceDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  membershipId: string,
  query: LiveLearnerDetailQuery,
) {
  const identity = await liveClassAttendanceRosterRepository.findLearnerIdentity(tx, membershipId);
  if (!identity) throw liveClassLearnerNotFound();

  const sessions = await liveClassAttendanceRosterRepository.listLearnerDetailSessions(tx, {
    membershipId,
    courseId: query.courseId,
    batchId: query.batchId,
    scheduledFrom: query.scheduledFrom,
    scheduledTo: query.scheduledTo,
  });

  if (sessions.length === 0) {
    return liveLearnerDetailResponseSchema.parse({
      data: {
        membershipId: identity.membership_id,
        learnerName: identity.learner_name,
        email: identity.email,
        batchId: query.batchId ?? null,
        batchName: null,
        courseId: query.courseId ?? null,
        courseTitle: null,
        registeredCount: 0,
        attendedCount: 0,
        absentCount: 0,
        attendanceRatePct: null,
        cohortAvgAttendanceRatePct: null,
        totalTimeSeconds: 0,
        avgCoveragePct: null,
        lastAttendedAt: null,
        lastAttendedSessionId: null,
        lastAttendedSessionTitle: null,
        streakKind: "none",
        streakCount: 0,
        streakLabel: "—",
        atRisk: false,
        neverAttended: false,
        longestGap: null,
        timing: {
          avgJoinDelayMinutes: null,
          avgLeaveEarlyMinutes: null,
          cohortAvgJoinDelayMinutes: null,
          cohortAvgLeaveEarlyMinutes: null,
        },
        monthlyPattern: [],
        strip: [],
        sessions: [],
        related: {
          batchId: query.batchId ?? null,
          batchName: null,
          courseId: query.courseId ?? null,
          courseTitle: null,
        },
      },
    });
  }

  const mapped = sessions.map((row) => {
    const coveragePct = coveragePctForSession(row.duration_seconds, row.session_duration_seconds);
    const status = mapLearnerSessionStatus({
      status: row.status,
      joinedAt: row.joined_at,
      coveragePct,
    });
    const joinDelay = joinDelayMinutes(row.started_at, row.joined_at);
    const leaveEarly = leaveEarlyMinutes(row.ended_at, row.left_at);
    let note: string | null = null;
    if (status === "partial") {
      if (joinDelay != null && joinDelay >= 5) note = "Joined late";
      else if (leaveEarly != null && leaveEarly >= 5) note = "Left early";
      else note = "Brief join";
    }
    return {
      ...row,
      coveragePct,
      uiStatus: status,
      joinDelay,
      leaveEarly,
      note,
    };
  });

  const registeredCount = mapped.length;
  const attendedCount = mapped.filter(
    (row) => row.uiStatus === "present" || row.uiStatus === "partial",
  ).length;
  const absentCount = mapped.filter((row) => row.uiStatus === "absent").length;
  const attendanceRatePct =
    registeredCount > 0 ? Math.round((attendedCount / registeredCount) * 1000) / 10 : null;
  const totalTimeSeconds = mapped.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
  const coverageValues = mapped
    .map((row) => row.coveragePct)
    .filter((value): value is number => value != null);
  const avgCoveragePct = average(coverageValues);

  const recentStatuses = [...mapped]
    .sort((a, b) => {
      const aTime = (a.scheduled_at ?? a.started_at)?.getTime() ?? 0;
      const bTime = (b.scheduled_at ?? b.started_at)?.getTime() ?? 0;
      return bTime - aTime;
    })
    .map((row) =>
      row.uiStatus === "present" || row.uiStatus === "partial" ? "attended" : "missed",
    );
  const streak = streakFromRecent(recentStatuses);

  const lastAttended = mapped
    .filter((row) => row.joined_at != null)
    .sort((a, b) => (b.joined_at?.getTime() ?? 0) - (a.joined_at?.getTime() ?? 0))[0];

  const primary = mapped.find((row) => row.batch_id != null) ?? mapped[0];
  if (primary == null) {
    throw liveClassLearnerNotFound();
  }
  const batchId = primary.batch_id;
  const batchName = primary.batch_name;
  const courseId = primary.course_id;
  const courseTitle = primary.course_title;

  const cohortAvgAttendanceRatePct =
    await liveClassAttendanceRosterRepository.summarizeCohortAttendanceRate(tx, {
      batchId,
      courseId: batchId ? null : courseId,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
    });

  const chronoAsc = [...mapped].sort((a, b) => {
    const aTime = (a.scheduled_at ?? a.started_at)?.getTime() ?? 0;
    const bTime = (b.scheduled_at ?? b.started_at)?.getTime() ?? 0;
    return aTime - bTime;
  });

  const strip = chronoAsc.map((row) => ({
    sessionId: row.session_id,
    attendeeId: row.attendee_id,
    title: row.title,
    scheduledAt: (row.scheduled_at ?? row.started_at)?.toISOString() ?? null,
    status: row.uiStatus,
    coveragePct: row.coveragePct,
  }));

  const longestGap = longestAbsenceGap(
    chronoAsc.map((row) => ({
      status: row.uiStatus,
      scheduledAt: row.scheduled_at ?? row.started_at,
    })),
  );

  const joinDelays = mapped
    .map((row) => row.joinDelay)
    .filter((value): value is number => value != null);
  const leaveEarlys = mapped
    .map((row) => row.leaveEarly)
    .filter((value): value is number => value != null);
  const cohortJoinDelays = mapped
    .map((row) => row.cohort_avg_join_delay_minutes)
    .filter((value): value is number => value != null);
  const cohortLeaveEarlys = mapped
    .map((row) => row.cohort_avg_leave_early_minutes)
    .filter((value): value is number => value != null);

  const monthBuckets = new Map<string, { registered: number; attended: number }>();
  for (const row of chronoAsc) {
    const when = row.scheduled_at ?? row.started_at;
    if (!when) continue;
    const key = monthKeyFromDate(when);
    const bucket = monthBuckets.get(key) ?? { registered: 0, attended: 0 };
    bucket.registered += 1;
    if (row.uiStatus === "present" || row.uiStatus === "partial") bucket.attended += 1;
    monthBuckets.set(key, bucket);
  }
  const monthKeys = [...monthBuckets.keys()].sort();
  const cohortMonthly = await liveClassAttendanceRosterRepository.listCohortMonthlyAttendanceRates(
    tx,
    {
      batchId,
      courseId: batchId ? null : courseId,
      monthKeys,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
    },
  );
  const cohortMonthMap = new Map(cohortMonthly.map((row) => [row.month_key, row.avg_rate]));

  const monthlyPattern = monthKeys.map((key) => {
    const bucket = monthBuckets.get(key) ?? { registered: 0, attended: 0 };
    return {
      monthKey: key,
      label: monthLabelFromKey(key),
      attendanceRatePct:
        bucket.registered > 0
          ? Math.round((bucket.attended / bucket.registered) * 1000) / 10
          : null,
      cohortAvgRatePct: cohortMonthMap.get(key) ?? null,
      registeredCount: bucket.registered,
      attendedCount: bucket.attended,
    };
  });

  const neverAttended = attendedCount === 0 && registeredCount > 0;
  const atRisk = neverAttended || (attendanceRatePct != null && attendanceRatePct < 40);

  return liveLearnerDetailResponseSchema.parse({
    data: {
      membershipId: identity.membership_id,
      learnerName: identity.learner_name,
      email: identity.email,
      batchId,
      batchName,
      courseId,
      courseTitle,
      registeredCount,
      attendedCount,
      absentCount,
      attendanceRatePct,
      cohortAvgAttendanceRatePct,
      totalTimeSeconds,
      avgCoveragePct,
      lastAttendedAt: lastAttended?.joined_at?.toISOString() ?? null,
      lastAttendedSessionId: lastAttended?.session_id ?? null,
      lastAttendedSessionTitle: lastAttended?.title ?? null,
      streakKind: streak.streakKind,
      streakCount: streak.streakCount,
      streakLabel: streak.streakLabel,
      atRisk,
      neverAttended,
      longestGap,
      timing: {
        avgJoinDelayMinutes: average(joinDelays),
        avgLeaveEarlyMinutes: average(leaveEarlys),
        cohortAvgJoinDelayMinutes: average(cohortJoinDelays),
        cohortAvgLeaveEarlyMinutes: average(cohortLeaveEarlys),
      },
      monthlyPattern,
      strip,
      sessions: mapped.map((row) => ({
        sessionId: row.session_id,
        attendeeId: row.attendee_id,
        title: row.title,
        courseTitle: row.course_title,
        batchName: row.batch_name,
        scheduledAt: (row.scheduled_at ?? row.started_at)?.toISOString() ?? null,
        status: row.uiStatus,
        joinedAt: row.joined_at?.toISOString() ?? null,
        leftAt: row.left_at?.toISOString() ?? null,
        durationSeconds: row.duration_seconds,
        coveragePct: row.coveragePct,
        joinDelayMinutes: row.joinDelay,
        leaveEarlyMinutes: row.leaveEarly,
        cohortAvgDurationSeconds: row.cohort_avg_duration_seconds,
        note: row.note,
      })),
      related: {
        batchId,
        batchName,
        courseId,
        courseTitle,
      },
    },
  });
}

function turnoutPct(attended: number, registered: number): number | null {
  if (registered <= 0) return null;
  return Math.round((attended / registered) * 1000) / 10;
}

function buildSeriesDropOff(
  rows: Array<{
    series_id: string;
    session_id: string;
    scheduled_at: Date | null;
    membership_id: string;
    attended: boolean;
  }>,
  maxOrdinal = 6,
) {
  const bySeries = new Map<
    string,
    Map<string, { scheduledAt: Date | null; attendees: Set<string>; registrants: Set<string> }>
  >();

  for (const row of rows) {
    let sessions = bySeries.get(row.series_id);
    if (!sessions) {
      sessions = new Map();
      bySeries.set(row.series_id, sessions);
    }
    let session = sessions.get(row.session_id);
    if (!session) {
      session = {
        scheduledAt: row.scheduled_at,
        attendees: new Set(),
        registrants: new Set(),
      };
      sessions.set(row.session_id, session);
    }
    session.registrants.add(row.membership_id);
    if (row.attended) session.attendees.add(row.membership_id);
  }

  const ordinalCohortTotals = new Map<number, { retained: number; cohort: number }>();

  for (const sessions of bySeries.values()) {
    const ordered = [...sessions.entries()].sort((a, b) => {
      const aTime = a[1].scheduledAt?.getTime() ?? 0;
      const bTime = b[1].scheduledAt?.getTime() ?? 0;
      return aTime - bTime;
    });
    if (ordered.length === 0) continue;
    const firstOrdered = ordered[0];
    if (firstOrdered == null) continue;
    const cohort = firstOrdered[1].registrants;
    if (cohort.size === 0) continue;

    for (let i = 0; i < Math.min(ordered.length, maxOrdinal); i += 1) {
      const ordinal = i + 1;
      const orderedEntry = ordered[i];
      if (orderedEntry == null) continue;
      const session = orderedEntry[1];
      let retained = 0;
      for (const membershipId of cohort) {
        if (session.attendees.has(membershipId)) retained += 1;
      }
      const bucket = ordinalCohortTotals.get(ordinal) ?? { retained: 0, cohort: 0 };
      bucket.retained += retained;
      bucket.cohort += cohort.size;
      ordinalCohortTotals.set(ordinal, bucket);
    }
  }

  const stages = [...ordinalCohortTotals.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ordinal, bucket]) => ({
      ordinal,
      label: ordinal >= maxOrdinal ? `S${String(maxOrdinal)}+` : `S${String(ordinal)}`,
      retentionPct:
        bucket.cohort > 0 ? Math.round((bucket.retained / bucket.cohort) * 1000) / 10 : null,
    }));

  let biggestDrop: {
    fromOrdinal: number;
    toOrdinal: number;
    dropPts: number;
    label: string;
  } | null = null;

  for (let i = 1; i < stages.length; i += 1) {
    const prev = stages[i - 1];
    const curr = stages[i];
    if (prev == null || curr == null) continue;
    if (prev.retentionPct == null || curr.retentionPct == null) continue;
    const drop = Math.round((prev.retentionPct - curr.retentionPct) * 10) / 10;
    if (drop <= 0) continue;
    if (!biggestDrop || drop > biggestDrop.dropPts) {
      biggestDrop = {
        fromOrdinal: prev.ordinal,
        toOrdinal: curr.ordinal,
        dropPts: drop,
        label: `Session ${String(curr.ordinal)} (−${String(drop)}%)`,
      };
    }
  }

  return { stages, biggestDrop };
}

export async function listLiveClassAttendanceSeries(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: LiveSeriesListQuery,
) {
  const [sessionRows, dropOffRows] = await Promise.all([
    liveClassAttendanceRosterRepository.listSeriesSessionStats(tx, {
      groupBy: query.groupBy,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
    }),
    liveClassAttendanceRosterRepository.listSeriesDropOffMembershipAttendance(tx, {
      groupBy: query.groupBy,
      scheduledFrom: query.scheduledFrom,
      scheduledTo: query.scheduledTo,
      maxOrdinal: 6,
    }),
  ]);

  type Acc = {
    seriesId: string;
    title: string;
    subtitle: string | null;
    secondaryId: string | null;
    sessions: typeof sessionRows;
  };

  const bySeries = new Map<string, Acc>();
  for (const row of sessionRows) {
    let acc = bySeries.get(row.series_id);
    if (!acc) {
      acc = {
        seriesId: row.series_id,
        title: row.series_title,
        subtitle: row.secondary_title,
        secondaryId: row.secondary_id,
        sessions: [],
      };
      bySeries.set(row.series_id, acc);
    }
    acc.sessions.push(row);
    if (!acc.subtitle && row.secondary_title) acc.subtitle = row.secondary_title;
    if (!acc.secondaryId && row.secondary_id) acc.secondaryId = row.secondary_id;
  }

  const seriesIds = [...bySeries.keys()];
  const neverRows = await liveClassAttendanceRosterRepository.listSeriesNeverAttendingCounts(tx, {
    groupBy: query.groupBy,
    seriesIds,
    scheduledFrom: query.scheduledFrom,
    scheduledTo: query.scheduledTo,
  });
  const neverMap = new Map(neverRows.map((row) => [row.series_id, row.never_count]));

  const now = Date.now();
  let items = [...bySeries.values()].map((acc) => {
    const sessionsTotal = acc.sessions.length;
    const cancelledSessions = acc.sessions.filter((s) => sessionIsCancelled(s.status));
    const heldSessions = acc.sessions.filter((s) => !sessionIsCancelled(s.status));
    const heldPastOrLive = heldSessions.filter((s) => {
      const status = s.status.toLowerCase();
      return (
        status === "ended" ||
        status === "completed" ||
        status === "live" ||
        status === "in_progress" ||
        (s.scheduled_at != null && s.scheduled_at.getTime() <= now)
      );
    });

    const registrations = heldSessions.reduce((sum, s) => sum + s.registered_count, 0);
    const attended = heldSessions.reduce((sum, s) => sum + s.attended_count, 0);
    const avgTurnoutPct = turnoutPct(attended, registrations);

    const coverageValues = heldSessions
      .map((s) => s.avg_coverage_pct)
      .filter((v): v is number => v != null);
    const avgCoveragePct =
      coverageValues.length > 0
        ? Math.round((coverageValues.reduce((a, b) => a + b, 0) / coverageValues.length) * 10) / 10
        : null;

    const sparkline = heldSessions.map((s) =>
      sessionIsCancelled(s.status) ? null : turnoutPct(s.attended_count, s.registered_count),
    );

    const firstRate = sparkline.find((v) => v != null) ?? null;
    const lastRate = [...sparkline].reverse().find((v) => v != null) ?? null;
    const trendDeltaPts =
      firstRate != null && lastRate != null ? Math.round((lastRate - firstRate) * 10) / 10 : null;

    const upcoming = heldSessions
      .filter((s) => s.scheduled_at != null && s.scheduled_at.getTime() > now)
      .sort((a, b) => (a.scheduled_at?.getTime() ?? 0) - (b.scheduled_at?.getTime() ?? 0))[0];

    const finished =
      upcoming == null &&
      heldSessions.length > 0 &&
      heldSessions.every((s) => {
        const status = s.status.toLowerCase();
        return status === "ended" || status === "completed" || sessionIsCancelled(s.status);
      });

    return {
      seriesId: acc.seriesId,
      groupBy: query.groupBy,
      title: acc.title,
      subtitle: acc.subtitle,
      secondaryId: acc.secondaryId,
      sessionsHeld: heldPastOrLive.length,
      sessionsTotal,
      cancelledCount: cancelledSessions.length,
      registrations,
      avgTurnoutPct,
      avgCoveragePct,
      neverAttendingCount: neverMap.get(acc.seriesId) ?? 0,
      trendDeltaPts,
      sparkline,
      nextSessionId: upcoming?.session_id ?? null,
      nextSessionAt: upcoming?.scheduled_at?.toISOString() ?? null,
      nextSessionTitle: upcoming?.session_title ?? null,
      status: finished ? "finished" : "running",
    };
  });

  if (query.q) {
    const needle = query.q.toLowerCase();
    items = items.filter(
      (item) =>
        item.title.toLowerCase().includes(needle) ||
        (item.subtitle ?? "").toLowerCase().includes(needle),
    );
  }

  const sortDir = query.sortDir === "asc" ? 1 : -1;
  items.sort((a, b) => {
    const cmp = (() => {
      switch (query.sortBy) {
        case "sessions_held":
          return a.sessionsHeld - b.sessionsHeld;
        case "registrations":
          return a.registrations - b.registrations;
        case "never_attending":
          return a.neverAttendingCount - b.neverAttendingCount;
        case "title":
          return a.title.localeCompare(b.title);
        case "avg_turnout":
        default: {
          const av = a.avgTurnoutPct;
          const bv = b.avgTurnoutPct;
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          return av - bv;
        }
      }
    })();
    if (cmp !== 0) return cmp * sortDir;
    return a.title.localeCompare(b.title);
  });

  const totalCount = items.length;
  const skip = (query.page - 1) * query.limit;
  const pageItems = items.slice(skip, skip + query.limit);

  const withRates = items.filter((item) => item.avgTurnoutPct != null);
  const best = [...withRates].sort((a, b) => (b.avgTurnoutPct ?? 0) - (a.avgTurnoutPct ?? 0))[0];
  const weakest = [...withRates].sort((a, b) => (a.avgTurnoutPct ?? 0) - (b.avgTurnoutPct ?? 0))[0];

  const avgTurnoutPct =
    withRates.length > 0
      ? Math.round(
          (withRates.reduce((sum, item) => sum + (item.avgTurnoutPct ?? 0), 0) / withRates.length) *
            10,
        ) / 10
      : null;

  const trendValues = items.map((item) => item.trendDeltaPts).filter((v): v is number => v != null);
  const turnoutTrendPts =
    trendValues.length > 0
      ? Math.round((trendValues.reduce((sum, v) => sum + v, 0) / trendValues.length) * 10) / 10
      : null;

  const dropOff = buildSeriesDropOff(dropOffRows, 6);

  return liveSeriesListResponseSchema.parse({
    data: {
      groupBy: query.groupBy,
      items: pageItems,
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        seriesCount: totalCount,
        runningCount: items.filter((item) => item.status === "running").length,
        finishedCount: items.filter((item) => item.status === "finished").length,
        sessionsCount: items.reduce((sum, item) => sum + item.sessionsTotal, 0),
        registrationsCount: items.reduce((sum, item) => sum + item.registrations, 0),
        avgTurnoutPct,
        bestSeries:
          best && best.avgTurnoutPct != null
            ? {
                seriesId: best.seriesId,
                title: best.title,
                avgTurnoutPct: best.avgTurnoutPct,
              }
            : null,
        weakestSeries:
          weakest && weakest.avgTurnoutPct != null
            ? {
                seriesId: weakest.seriesId,
                title: weakest.title,
                avgTurnoutPct: weakest.avgTurnoutPct,
              }
            : null,
        turnoutTrendPts,
      },
      dropOff,
    },
  });
}

export async function getLiveClassAttendanceSeriesDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  seriesId: string,
  query: LiveSeriesDetailQuery,
) {
  const sessionRows = await liveClassAttendanceRosterRepository.listSeriesSessionStats(tx, {
    groupBy: query.groupBy,
    scheduledFrom: query.scheduledFrom,
    scheduledTo: query.scheduledTo,
  });
  const rows = sessionRows.filter((row) => row.series_id === seriesId);
  if (rows.length === 0) {
    throw liveClassSeriesNotFound();
  }

  const firstRow = rows[0];
  if (firstRow == null) {
    throw liveClassSeriesNotFound();
  }
  const title = firstRow.series_title;
  const subtitle = rows.find((row) => row.secondary_title)?.secondary_title ?? null;

  const sessions = rows.map((row, index) => {
    const cancelled = sessionIsCancelled(row.status);
    return {
      sessionId: row.session_id,
      ordinal: index + 1,
      title: row.session_title,
      scheduledAt: row.scheduled_at?.toISOString() ?? null,
      status: row.status,
      cancelled,
      registeredCount: row.registered_count,
      attendedCount: row.attended_count,
      turnoutPct: cancelled ? null : turnoutPct(row.attended_count, row.registered_count),
      avgCoveragePct: cancelled ? null : row.avg_coverage_pct,
    };
  });

  const active = sessions.filter((s) => !s.cancelled);
  const registrations = active.reduce((sum, s) => sum + s.registeredCount, 0);
  const attended = active.reduce((sum, s) => sum + s.attendedCount, 0);
  const avgTurnoutPct = turnoutPct(attended, registrations);

  let steepestDrop: {
    fromOrdinal: number;
    toOrdinal: number;
    dropPts: number;
    message: string;
  } | null = null;

  for (let i = 1; i < sessions.length; i += 1) {
    const prev = sessions[i - 1];
    const curr = sessions[i];
    if (prev == null || curr == null) continue;
    if (prev.cancelled || curr.cancelled) continue;
    if (prev.turnoutPct == null || curr.turnoutPct == null) continue;
    const drop = Math.round((prev.turnoutPct - curr.turnoutPct) * 10) / 10;
    if (drop <= 0) continue;
    if (!steepestDrop || drop > steepestDrop.dropPts) {
      steepestDrop = {
        fromOrdinal: prev.ordinal,
        toOrdinal: curr.ordinal,
        dropPts: drop,
        message: `Turnout dropped ${String(drop)} points between session ${String(prev.ordinal)} and session ${String(curr.ordinal)}.`,
      };
    }
  }

  return liveSeriesDetailResponseSchema.parse({
    data: {
      seriesId,
      groupBy: query.groupBy,
      title,
      subtitle,
      avgTurnoutPct,
      steepestDrop,
      sessions,
    },
  });
}
