import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  zoomMeetingDetailResponseSchema,
  zoomMeetingsListResponseSchema,
  zoomParticipantDetailResponseSchema,
  zoomParticipantMatchResponseSchema,
  zoomParticipantsListResponseSchema,
  zoomPeopleListResponseSchema,
  zoomPersonMeetingsResponseSchema,
  type ZoomMeetingsListQuery,
  type ZoomParticipantMatchBody,
  type ZoomParticipantsQuery,
  type ZoomPeopleListQuery,
  type ZoomPersonMeetingsQuery,
} from "./zoom-insights-roster.dto";
import {
  zoomMeetingNotFound,
  zoomParticipantMatchInvalid,
  zoomParticipantNotFound,
} from "./zoom-insights-roster.errors";
import {
  zoomInsightsRosterRepository,
  type ZoomMeetingListRow,
  type ZoomParticipantIntervalRow,
  type ZoomParticipantsFilter,
} from "./zoom-insights-roster.repository";

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

function mapMeetingListItem(row: ZoomMeetingListRow) {
  return {
    id: row.id,
    externalMeetingId: row.external_meeting_id,
    topic: row.topic,
    startedAt: row.started_at?.toISOString() ?? null,
    endedAt: row.ended_at?.toISOString() ?? null,
    durationSeconds: row.duration_seconds,
    attendanceCount: row.attendance_count,
    matchedCount: row.matched_count,
    unmatchedCount: row.unmatched_count,
    totalAttendanceSeconds: row.total_attendance_seconds,
  };
}

function mapConnection(
  connection: Awaited<ReturnType<typeof zoomInsightsRosterRepository.getConnectionMeta>>,
) {
  return {
    status: connection.status,
    connectedAt: connection.connected_at?.toISOString() ?? null,
    lastSyncedAt: connection.last_synced_at?.toISOString() ?? null,
    meetingsImportedToday: connection.meetings_imported_today,
    hasConnectionRecord: connection.has_connection_record,
  };
}

function toParticipantFilter(
  meetingId: string,
  input: Partial<{
    displayName?: string;
    email?: string;
    joinedFrom?: string;
    joinedTo?: string;
    matchState?: "all" | "matched" | "unmatched" | "guest";
    durationBucket?: "any" | "under_10" | "10_to_30" | "over_30";
    rejoinedOnly?: boolean;
  }>,
): ZoomParticipantsFilter {
  const filter: ZoomParticipantsFilter = { meetingId };
  if (input.displayName) filter.displayName = input.displayName;
  if (input.email) filter.email = input.email;
  if (input.joinedFrom) filter.joinedFrom = input.joinedFrom;
  if (input.joinedTo) filter.joinedTo = input.joinedTo;
  if (input.matchState) filter.matchState = input.matchState;
  if (input.durationBucket) filter.durationBucket = input.durationBucket;
  if (input.rejoinedOnly != null) filter.rejoinedOnly = input.rejoinedOnly;
  return filter;
}

function buildTimeline(
  startedAt: Date | null,
  endedAt: Date | null,
  intervals: ZoomParticipantIntervalRow[],
) {
  if (!startedAt || !endedAt || endedAt <= startedAt) {
    return {
      timeline: [] as Array<{ minuteOffset: number; at: string; concurrent: number }>,
      peakConcurrent: 0,
      peakAt: null as string | null,
      biggestDropCount: 0,
      biggestDropFrom: null as string | null,
      biggestDropTo: null as string | null,
    };
  }

  const durationMs = endedAt.getTime() - startedAt.getTime();
  const totalMinutes = Math.max(1, Math.ceil(durationMs / 60_000));
  const sampleCount = Math.min(totalMinutes + 1, 90);
  const stepMinutes = Math.max(1, Math.floor(totalMinutes / Math.max(sampleCount - 1, 1)));

  const timeline: Array<{ minuteOffset: number; at: string; concurrent: number }> = [];
  let peakConcurrent = 0;
  let peakAt: string | null = null;
  let biggestDropCount = 0;
  let biggestDropFrom: string | null = null;
  let biggestDropTo: string | null = null;
  let previous: { concurrent: number; at: string } | null = null;

  for (let offset = 0; offset <= totalMinutes; offset += stepMinutes) {
    const atMs = startedAt.getTime() + offset * 60_000;
    const at = new Date(Math.min(atMs, endedAt.getTime()));
    let concurrent = 0;
    for (const interval of intervals) {
      if (!interval.join_time) continue;
      const leave = interval.leave_time ?? endedAt;
      if (interval.join_time <= at && leave >= at) concurrent += 1;
    }
    const atIso = at.toISOString();
    timeline.push({ minuteOffset: offset, at: atIso, concurrent });
    if (concurrent > peakConcurrent) {
      peakConcurrent = concurrent;
      peakAt = atIso;
    }
    if (previous && previous.concurrent - concurrent > biggestDropCount) {
      biggestDropCount = previous.concurrent - concurrent;
      biggestDropFrom = previous.at;
      biggestDropTo = atIso;
    }
    previous = { concurrent, at: atIso };
  }

  if (timeline.length > 0) {
    const lastOffset = totalMinutes;
    const last = timeline[timeline.length - 1];
    if (last && last.minuteOffset !== lastOffset) {
      const at = endedAt;
      let concurrent = 0;
      for (const interval of intervals) {
        if (!interval.join_time) continue;
        const leave = interval.leave_time ?? endedAt;
        if (interval.join_time <= at && leave >= at) concurrent += 1;
      }
      timeline.push({ minuteOffset: lastOffset, at: at.toISOString(), concurrent });
    }
  }

  return {
    timeline,
    peakConcurrent,
    peakAt,
    biggestDropCount,
    biggestDropFrom,
    biggestDropTo,
  };
}

export async function listZoomInsightsMeetings(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ZoomMeetingsListQuery,
) {
  const [totalCount, rows, connection, summary] = await Promise.all([
    zoomInsightsRosterRepository.countMeetings(tx, query),
    zoomInsightsRosterRepository.listMeetings(tx, query),
    zoomInsightsRosterRepository.getConnectionMeta(tx),
    zoomInsightsRosterRepository.summarizeMeetings(tx, query),
  ]);

  return zoomMeetingsListResponseSchema.parse({
    data: {
      items: rows.map(mapMeetingListItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      connectionStatus: connection.status,
      connection: mapConnection(connection),
      summary: {
        meetingCount: summary.meeting_count,
        participantCount: summary.participant_count,
        matchedCount: summary.matched_count,
        unmatchedCount: summary.unmatched_count,
        totalAttendanceSeconds: summary.total_attendance_seconds,
        avgAttendancePerMeeting: summary.avg_attendance_per_meeting,
        avgDurationSeconds: summary.avg_duration_seconds,
      },
    },
  });
}

export async function getZoomMeetingDetailedReport(
  tx: TenantTx,
  _ctx: ServiceCtx,
  meetingId: string,
) {
  const meta = await zoomInsightsRosterRepository.findMeetingById(tx, meetingId);
  if (!meta) throw zoomMeetingNotFound();

  const [totals, connection, intervals] = await Promise.all([
    zoomInsightsRosterRepository.meetingAttendanceTotals(tx, meetingId),
    zoomInsightsRosterRepository.getConnectionMeta(tx),
    zoomInsightsRosterRepository.listParticipantIntervals(tx, meetingId),
  ]);

  const timeline = buildTimeline(meta.started_at, meta.ended_at, intervals);

  return zoomMeetingDetailResponseSchema.parse({
    data: {
      ...mapMeetingListItem(meta),
      avgDurationSeconds: totals.avgDurationSeconds,
      connection: mapConnection(connection),
      timeline: timeline.timeline,
      peakConcurrent: timeline.peakConcurrent,
      peakAt: timeline.peakAt,
      biggestDropCount: timeline.biggestDropCount,
      biggestDropFrom: timeline.biggestDropFrom,
      biggestDropTo: timeline.biggestDropTo,
      linkedSession: null,
    },
  });
}

export async function listZoomMeetingParticipants(
  tx: TenantTx,
  _ctx: ServiceCtx,
  meetingId: string,
  query: ZoomParticipantsQuery,
) {
  const meta = await zoomInsightsRosterRepository.findMeetingById(tx, meetingId);
  if (!meta) throw zoomMeetingNotFound();

  const filter = toParticipantFilter(meetingId, {
    ...(query.displayName ? { displayName: query.displayName } : {}),
    ...(query.email ? { email: query.email } : {}),
    ...(query.joinedFrom ? { joinedFrom: query.joinedFrom } : {}),
    ...(query.joinedTo ? { joinedTo: query.joinedTo } : {}),
    matchState: query.matchState,
    durationBucket: query.durationBucket,
    rejoinedOnly: query.rejoinedOnly,
  });

  const [totalCount, rows, participantSummary] = await Promise.all([
    zoomInsightsRosterRepository.countParticipants(tx, filter),
    zoomInsightsRosterRepository.listParticipants(tx, meetingId, query),
    zoomInsightsRosterRepository.summarizeParticipants(tx, meetingId),
  ]);

  return zoomParticipantsListResponseSchema.parse({
    data: {
      meetingId,
      topic: meta.topic,
      meetingDurationSeconds: meta.duration_seconds,
      items: rows.map((row) => ({
        id: row.id,
        membershipId: row.membership_id,
        externalUserId: row.external_user_id,
        displayName: row.display_name,
        zoomDisplayName:
          row.membership_id && row.zoom_display_name && row.zoom_display_name !== row.display_name
            ? row.zoom_display_name
            : null,
        email: row.email,
        joinTime: row.join_time?.toISOString() ?? null,
        leaveTime: row.leave_time?.toISOString() ?? null,
        durationSeconds: row.duration_seconds,
        matchState: row.match_state,
        sessionCount: row.session_count,
        rejoinCount: row.rejoin_count,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
      summary: participantSummary,
    },
  });
}

function inferDeviceHint(displayName: string | null): "mobile" | "tablet" | "desktop" | "unknown" {
  const value = (displayName ?? "").toLowerCase();
  if (!value) return "unknown";
  if (
    value.includes("iphone") ||
    value.includes("android") ||
    value.includes("mobile") ||
    value.includes("phone")
  ) {
    return "mobile";
  }
  if (value.includes("ipad") || value.includes("tablet")) return "tablet";
  if (value.includes("mac") || value.includes("windows") || value.includes("desktop")) {
    return "desktop";
  }
  return "unknown";
}

function longestGapSeconds(
  sessions: Array<{ join_time: Date | null; leave_time: Date | null }>,
): number | null {
  if (sessions.length < 2) return null;
  let longest: number | null = null;
  for (let index = 1; index < sessions.length; index += 1) {
    const previousLeave = sessions[index - 1]?.leave_time;
    const nextJoin = sessions[index]?.join_time;
    if (!previousLeave || !nextJoin) continue;
    const gap = Math.max(0, Math.floor((nextJoin.getTime() - previousLeave.getTime()) / 1000));
    if (longest == null || gap > longest) longest = gap;
  }
  return longest;
}

export async function getZoomMeetingParticipantDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  meetingId: string,
  participantId: string,
) {
  const meta = await zoomInsightsRosterRepository.findMeetingById(tx, meetingId);
  if (!meta) throw zoomMeetingNotFound();

  const identity = await zoomInsightsRosterRepository.findParticipantIdentityDetail(
    tx,
    meetingId,
    participantId,
  );
  if (!identity) throw zoomParticipantNotFound();

  const [history, otherUnmatchedMeetingCount] = await Promise.all([
    zoomInsightsRosterRepository.listParticipantAttendanceHistory(tx, {
      meetingId,
      membershipId: identity.membership_id,
      externalUserId: identity.external_user_id,
      limit: 8,
    }),
    zoomInsightsRosterRepository.countOtherUnmatchedMeetingsForIdentity(tx, {
      meetingId,
      externalUserId: identity.external_user_id,
      email: identity.email,
      displayName: identity.display_name,
    }),
  ]);

  const meetingDuration = meta.duration_seconds;
  const coveragePercent =
    meetingDuration != null && meetingDuration > 0
      ? Math.round((identity.total_duration_seconds / meetingDuration) * 1000) / 10
      : null;

  const enrollmentStatus =
    identity.match_state !== "matched"
      ? "unlinked"
      : identity.membership_status === "ACTIVE"
        ? "active"
        : identity.membership_status
          ? "inactive"
          : "unknown";

  return zoomParticipantDetailResponseSchema.parse({
    data: {
      id: participantId,
      meetingId,
      meetingTopic: meta.topic,
      meetingExternalId: meta.external_meeting_id,
      meetingStartedAt: meta.started_at?.toISOString() ?? null,
      meetingEndedAt: meta.ended_at?.toISOString() ?? null,
      meetingDurationSeconds: meetingDuration,
      membershipId: identity.membership_id,
      externalUserId: identity.external_user_id,
      displayName: identity.display_name,
      zoomDisplayName:
        identity.zoom_display_name && identity.zoom_display_name !== identity.display_name
          ? identity.zoom_display_name
          : identity.zoom_display_name,
      email: identity.email,
      matchState: identity.match_state,
      totalDurationSeconds: identity.total_duration_seconds,
      coveragePercent,
      sessionCount: identity.session_count,
      rejoinCount: identity.rejoin_count,
      firstJoinedAt: identity.first_joined_at?.toISOString() ?? null,
      lastLeftAt: identity.last_left_at?.toISOString() ?? null,
      longestGapSeconds: longestGapSeconds(identity.sessions),
      deviceHint: inferDeviceHint(identity.zoom_display_name ?? identity.display_name),
      sessions: identity.sessions.map((session, index) => ({
        id: session.id,
        index: index + 1,
        joinTime: session.join_time?.toISOString() ?? null,
        leaveTime: session.leave_time?.toISOString() ?? null,
        durationSeconds: session.duration_seconds,
        shareOfMeeting:
          meetingDuration != null && meetingDuration > 0 && session.duration_seconds != null
            ? Math.round((session.duration_seconds / meetingDuration) * 1000) / 10
            : null,
        deviceHint: inferDeviceHint(session.display_name),
      })),
      attendanceHistory: history.map((row) => ({
        meetingId: row.meeting_id,
        topic: row.topic,
        startedAt: row.started_at?.toISOString() ?? null,
        coveragePercent:
          row.meeting_duration_seconds != null &&
          row.meeting_duration_seconds > 0 &&
          row.duration_seconds != null
            ? Math.round((row.duration_seconds / row.meeting_duration_seconds) * 1000) / 10
            : null,
        isCurrent: row.is_current,
      })),
      lmsCrossCheck: {
        enrollmentStatus,
        matchMethod: identity.membership_id
          ? "membership"
          : identity.email
            ? "exact_email"
            : "none",
        zoomDurationSeconds: identity.total_duration_seconds,
        lmsDurationSeconds: null,
        discrepancySeconds: null,
      },
      otherUnmatchedMeetingCount,
    },
  });
}

export async function mutateZoomMeetingParticipantMatch(
  tx: TenantTx,
  _ctx: ServiceCtx,
  meetingId: string,
  participantId: string,
  input: ZoomParticipantMatchBody,
) {
  const meta = await zoomInsightsRosterRepository.findMeetingById(tx, meetingId);
  if (!meta) throw zoomMeetingNotFound();

  const identity = await zoomInsightsRosterRepository.findParticipantIdentityDetail(
    tx,
    meetingId,
    participantId,
  );
  if (!identity) throw zoomParticipantNotFound();

  if (input.action === "match") {
    if (!input.membershipId) {
      throw zoomParticipantMatchInvalid("membershipId is required when matching a learner.");
    }
    const result = await zoomInsightsRosterRepository.matchParticipantIdentity(tx, {
      meetingId,
      identityKey: identity.identity_key,
      membershipId: input.membershipId,
      applyToOtherMeetings: input.applyToOtherMeetings,
      externalUserId: identity.external_user_id,
      email: identity.email,
      displayName: identity.display_name,
    });
    if (result.updatedRowCount === 0) {
      throw zoomParticipantMatchInvalid(
        "Could not match this participant to the selected learner.",
      );
    }
    return zoomParticipantMatchResponseSchema.parse({
      data: {
        participantId,
        matchState: "matched",
        membershipId: input.membershipId,
        updatedRowCount: result.updatedRowCount,
        updatedMeetingCount: result.updatedMeetingCount,
      },
    });
  }

  if (input.action === "unlink") {
    const result = await zoomInsightsRosterRepository.unlinkParticipantIdentity(tx, {
      meetingId,
      identityKey: identity.identity_key,
    });
    return zoomParticipantMatchResponseSchema.parse({
      data: {
        participantId,
        matchState: "unmatched",
        membershipId: null,
        updatedRowCount: result.updatedRowCount,
        updatedMeetingCount: result.updatedRowCount > 0 ? 1 : 0,
      },
    });
  }

  const result = await zoomInsightsRosterRepository.markParticipantIdentityGuest(tx, {
    meetingId,
    identityKey: identity.identity_key,
  });
  return zoomParticipantMatchResponseSchema.parse({
    data: {
      participantId,
      matchState: "guest",
      membershipId: null,
      updatedRowCount: result.updatedRowCount,
      updatedMeetingCount: result.updatedRowCount > 0 ? 1 : 0,
    },
  });
}

function buildAttendancePulse(
  meetings: Array<{ started_at: Date | null; coverage_percent: number | null }>,
  attendedFrom?: string,
  attendedTo?: string,
) {
  const end = attendedTo ? new Date(attendedTo) : new Date();
  const start = attendedFrom
    ? new Date(attendedFrom)
    : new Date(end.getTime() - 89 * 24 * 60 * 60 * 1000);

  const byDay = new Map<string, { coverage: number; count: number }>();
  for (const meeting of meetings) {
    if (!meeting.started_at) continue;
    const key = meeting.started_at.toISOString().slice(0, 10);
    const coverage = meeting.coverage_percent ?? 0;
    const existing = byDay.get(key);
    if (!existing) {
      byDay.set(key, { coverage, count: 1 });
    } else {
      existing.coverage = Math.max(existing.coverage, coverage);
      existing.count += 1;
    }
  }

  const cells: Array<{
    date: string;
    state: "high" | "partial" | "missed" | "none";
    coveragePercent: number | null;
    meetingCount: number;
  }> = [];

  const cursor = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()),
  );
  const endDay = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  // Cap pulse grid to 90 days for UI density.
  let safety = 0;
  while (cursor <= endDay && safety < 90) {
    const key = cursor.toISOString().slice(0, 10);
    const day = byDay.get(key);
    if (!day) {
      cells.push({ date: key, state: "none", coveragePercent: null, meetingCount: 0 });
    } else if (day.coverage >= 80) {
      cells.push({
        date: key,
        state: "high",
        coveragePercent: day.coverage,
        meetingCount: day.count,
      });
    } else if (day.coverage > 0) {
      cells.push({
        date: key,
        state: "partial",
        coveragePercent: day.coverage,
        meetingCount: day.count,
      });
    } else {
      cells.push({
        date: key,
        state: "missed",
        coveragePercent: 0,
        meetingCount: day.count,
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    safety += 1;
  }
  return cells;
}

export async function listZoomInsightsPeople(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ZoomPeopleListQuery,
) {
  const [totalCount, rows, connection, summary, meetingsInRange] = await Promise.all([
    zoomInsightsRosterRepository.countPeople(tx, query),
    zoomInsightsRosterRepository.listPeople(tx, query),
    zoomInsightsRosterRepository.getConnectionMeta(tx),
    zoomInsightsRosterRepository.summarizePeople(tx, query),
    zoomInsightsRosterRepository.countMeetingsInRange(tx, query.attendedFrom, query.attendedTo),
  ]);

  return zoomPeopleListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        identityKey: row.identity_key,
        membershipId: row.membership_id,
        externalUserId: row.external_user_id,
        displayName: row.display_name,
        zoomDisplayName:
          row.membership_id && row.zoom_display_name && row.zoom_display_name !== row.display_name
            ? row.zoom_display_name
            : null,
        email: row.email,
        matchState: row.match_state,
        meetingsAttended: row.meetings_attended,
        meetingsInRange,
        totalDurationSeconds: row.total_duration_seconds,
        avgDurationSeconds: row.avg_duration_seconds,
        avgCoveragePercent: row.avg_coverage_percent,
        firstSeenAt: row.first_seen_at?.toISOString() ?? null,
        lastSeenAt: row.last_seen_at?.toISOString() ?? null,
        representativeMeetingId: row.representative_meeting_id,
        representativeParticipantId: row.representative_participant_id,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      connectionStatus: connection.status,
      connection: mapConnection(connection),
      summary: {
        peopleCount: summary.people_count,
        matchedCount: summary.matched_count,
        unmatchedCount: summary.unmatched_count,
        guestCount: summary.guest_count,
        avgMeetingsAttended: summary.avg_meetings_attended,
        totalDurationSeconds: summary.total_duration_seconds,
        avgCoveragePercent: summary.avg_coverage_percent,
        attendedOnceOnlyCount: summary.attended_once_only_count,
        meetingsInRange,
      },
      range: {
        attendedFrom: query.attendedFrom ?? null,
        attendedTo: query.attendedTo ?? null,
      },
    },
  });
}

export async function getZoomPersonMeetings(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: ZoomPersonMeetingsQuery,
) {
  const { person, meetings } = await zoomInsightsRosterRepository.listPersonMeetings(tx, query);
  if (!person) throw zoomParticipantNotFound();

  const totalDuration = meetings.reduce((sum, meeting) => sum + (meeting.duration_seconds ?? 0), 0);
  const coverageValues = meetings
    .map((meeting) => meeting.coverage_percent)
    .filter((value): value is number => value != null);
  const avgCoverage =
    coverageValues.length === 0
      ? null
      : Math.round(
          (coverageValues.reduce((sum, value) => sum + value, 0) / coverageValues.length) * 10,
        ) / 10;

  return zoomPersonMeetingsResponseSchema.parse({
    data: {
      identityKey: person.identity_key,
      membershipId: person.membership_id,
      displayName: person.display_name,
      email: person.email,
      matchState: person.match_state,
      totalMeetings: meetings.length,
      totalDurationSeconds: totalDuration,
      avgCoveragePercent: avgCoverage,
      meetings: meetings.map((meeting) => ({
        meetingId: meeting.meeting_id,
        participantId: meeting.participant_id,
        topic: meeting.topic,
        externalMeetingId: meeting.external_meeting_id,
        startedAt: meeting.started_at?.toISOString() ?? null,
        durationSeconds: meeting.duration_seconds,
        coveragePercent: meeting.coverage_percent,
        rejoinCount: meeting.rejoin_count,
      })),
      attendancePulse: buildAttendancePulse(meetings, query.attendedFrom, query.attendedTo),
      representativeMeetingId: person.representative_meeting_id,
      representativeParticipantId: person.representative_participant_id,
    },
  });
}
