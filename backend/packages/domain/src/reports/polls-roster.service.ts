import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  liveSessionPollReportResponseSchema,
  liveSessionsPollsListResponseSchema,
  pollDetailResponseSchema,
  pollLiveMonitorResponseSchema,
  pollNonRespondentsListResponseSchema,
  pollOptionDetailResponseSchema,
  pollRespondentsListResponseSchema,
  pollsCompareResponseSchema,
  pollsListResponseSchema,
  type LiveSessionsPollsListQuery,
  type PollLiveExtendBody,
  type PollNonRespondentsQuery,
  type PollRespondentsQuery,
  type PollsCompareQuery,
  type PollsListQuery,
} from "./polls-roster.dto";
import {
  liveSessionPollReportNotFound,
  pollCompareInsufficient,
  pollOptionNotFound,
  pollRosterNotFound,
  pollRosterRespondentsHidden,
} from "./polls-roster.errors";
import {
  pollsRosterRepository,
  type PollListRow,
  type PollRespondentsFilter,
} from "./polls-roster.repository";

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

function mapPollListItem(row: PollListRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    pollType: row.poll_type,
    status: row.status,
    quizMode: row.quiz_mode,
    allowMultipleAnswers: row.allow_multiple_answers,
    anonymousVote: row.anonymous_vote,
    resultVisibility: row.result_visibility,
    layout: row.layout,
    durationSeconds: row.duration_seconds,
    liveSessionId: row.live_session_id,
    liveSessionTitle: row.live_session_title,
    closesAt: row.closes_at?.toISOString() ?? null,
    isOpen: row.is_open,
    responseCount: row.response_count,
    optionCount: row.option_count,
    participationPct: row.participation_pct,
    createdAt: row.created_at.toISOString(),
  };
}

function toRespondentFilter(
  pollId: string,
  input: Partial<{
    learnerName?: string;
    optionId?: string;
    isCorrect?: "any" | "correct" | "incorrect";
    respondedFrom?: string;
    respondedTo?: string;
  }>,
): PollRespondentsFilter {
  const filter: PollRespondentsFilter = { pollId };
  if (input.learnerName) filter.learnerName = input.learnerName;
  if (input.optionId) filter.optionId = input.optionId;
  if (input.isCorrect) filter.isCorrect = input.isCorrect;
  if (input.respondedFrom) filter.respondedFrom = input.respondedFrom;
  if (input.respondedTo) filter.respondedTo = input.respondedTo;
  return filter;
}

function buildPollTimeline(input: {
  openedAt: Date;
  closedAt: Date | null;
  durationSeconds: number | null;
  offsets: number[];
  totalResponses: number;
}) {
  const maxOffset =
    input.offsets.length > 0 ? Math.max(...input.offsets, 0) : 0;
  const configuredDuration = input.durationSeconds ?? null;
  const closedOffset =
    input.closedAt != null
      ? Math.max(0, (input.closedAt.getTime() - input.openedAt.getTime()) / 1000)
      : null;
  const durationSeconds = Math.max(
    1,
    Math.ceil(
      configuredDuration ??
        closedOffset ??
        (maxOffset > 0 ? maxOffset : 60),
    ),
  );
  const bucketCount = Math.min(12, Math.max(4, Math.ceil(durationSeconds / 5)));
  const bucketSeconds = durationSeconds / bucketCount;
  const counts = Array.from({ length: bucketCount }, () => 0);
  for (const offset of input.offsets) {
    const clamped = Math.min(Math.max(offset, 0), durationSeconds);
    const index = Math.min(bucketCount - 1, Math.floor(clamped / bucketSeconds));
    counts[index] = (counts[index] ?? 0) + 1;
  }
  const points = counts.map((responseCount, index) => ({
    offsetSeconds: Math.round((index + 1) * bucketSeconds * 10) / 10,
    responseCount,
  }));

  const earlyWindow = Math.min(20, durationSeconds);
  const earlyCount = input.offsets.filter((offset) => offset <= earlyWindow).length;
  const earlySharePct =
    input.offsets.length > 0
      ? Math.round((earlyCount / input.offsets.length) * 1000) / 10
      : null;

  const events: Array<{
    kind: "opened" | "half" | "closed";
    at: string;
    label: string;
    detail: string | null;
  }> = [
    {
      kind: "opened",
      at: input.openedAt.toISOString(),
      label: "Poll opened",
      detail: "Voting window started",
    },
  ];

  if (input.totalResponses > 0 && input.offsets.length > 0) {
    const halfTarget = Math.ceil(input.totalResponses / 2);
    let running = 0;
    let halfOffset: number | null = null;
    for (const offset of input.offsets) {
      running += 1;
      if (running >= halfTarget) {
        halfOffset = offset;
        break;
      }
    }
    if (halfOffset != null) {
      events.push({
        kind: "half",
        at: new Date(input.openedAt.getTime() + halfOffset * 1000).toISOString(),
        label: "50% participation reached",
        detail: `${halfTarget} of ${input.totalResponses} responses`,
      });
    }
  }

  if (input.closedAt) {
    events.push({
      kind: "closed",
      at: input.closedAt.toISOString(),
      label: "Poll closed",
      detail: "Voting window ended",
    });
  }

  return {
    bucketSeconds: Math.round(bucketSeconds * 10) / 10,
    durationSeconds,
    points,
    earlySharePct,
    events,
  };
}

function buildOptionTiming(input: {
  openedAt: Date;
  closedAt: Date | null;
  durationSeconds: number | null;
  optionOffsets: number[];
  overallOffsets: number[];
}) {
  const allOffsets = [...input.optionOffsets, ...input.overallOffsets];
  const maxOffset = allOffsets.length > 0 ? Math.max(...allOffsets, 0) : 0;
  const configuredDuration = input.durationSeconds ?? null;
  const closedOffset =
    input.closedAt != null
      ? Math.max(0, (input.closedAt.getTime() - input.openedAt.getTime()) / 1000)
      : null;
  const durationSeconds = Math.max(
    1,
    Math.ceil(
      configuredDuration ?? closedOffset ?? (maxOffset > 0 ? maxOffset : 60),
    ),
  );
  const bucketCount = Math.min(10, Math.max(5, Math.ceil(durationSeconds / 5)));
  const bucketSeconds = durationSeconds / bucketCount;
  const optionCounts = Array.from({ length: bucketCount }, () => 0);
  const overallCounts = Array.from({ length: bucketCount }, () => 0);

  const place = (offsets: number[], counts: number[]) => {
    for (const offset of offsets) {
      const clamped = Math.min(Math.max(offset, 0), durationSeconds);
      const index = Math.min(bucketCount - 1, Math.floor(clamped / bucketSeconds));
      counts[index] = (counts[index] ?? 0) + 1;
    }
  };
  place(input.optionOffsets, optionCounts);
  place(input.overallOffsets, overallCounts);

  return {
    bucketSeconds: Math.round(bucketSeconds * 10) / 10,
    durationSeconds,
    buckets: optionCounts.map((optionCount, index) => ({
      offsetSeconds: Math.round((index + 1) * bucketSeconds * 10) / 10,
      optionCount,
      overallCount: overallCounts[index] ?? 0,
    })),
  };
}

function formatSeconds(value: number): string {
  return `${(Math.round(value * 10) / 10).toFixed(value % 1 === 0 ? 0 : 1)}s`;
}

function buildTimingInsight(
  optionMedian: number | null,
  overallMedian: number | null,
): string | null {
  if (optionMedian == null || overallMedian == null) return null;
  const optionLabel = formatSeconds(optionMedian);
  const overallLabel = formatSeconds(overallMedian);
  if (optionMedian < overallMedian - 0.05) {
    return `Chosen earlier than average — median ${optionLabel} versus ${overallLabel} overall.`;
  }
  if (optionMedian > overallMedian + 0.05) {
    return `Chosen later than average — median ${optionLabel} versus ${overallLabel} overall.`;
  }
  return `Median response time matches the poll average (${optionLabel}).`;
}

export async function listPollsRoster(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PollsListQuery,
) {
  const [totalCount, rows, summary] = await Promise.all([
    pollsRosterRepository.countPolls(tx, query),
    pollsRosterRepository.listPolls(tx, query),
    pollsRosterRepository.summarizePolls(tx, {
      ...(query.q ? { q: query.q } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.pollType ? { pollType: query.pollType } : {}),
      ...(query.createdFrom ? { createdFrom: query.createdFrom } : {}),
      ...(query.createdTo ? { createdTo: query.createdTo } : {}),
    }),
  ]);

  return pollsListResponseSchema.parse({
    data: {
      items: rows.map(mapPollListItem),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      summary: {
        totalResponses: summary.total_responses,
        pollCount: summary.poll_count,
        avgParticipationPct: summary.avg_participation_pct,
        quizPollCount: summary.quiz_poll_count,
        avgQuizCorrectPct: summary.avg_quiz_correct_pct,
        openNowCount: summary.open_now_count,
        anonymousCount: summary.anonymous_count,
      },
    },
  });
}

export async function getPollDetailedReport(
  tx: TenantTx,
  _ctx: ServiceCtx,
  pollId: string,
) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();

  const [options, extras] = await Promise.all([
    pollsRosterRepository.listOptionBreakdown(tx, pollId),
    pollsRosterRepository.getPollDetailExtras(tx, pollId),
  ]);
  const totalResponses = options.reduce((sum, option) => sum + option.count, 0);
  const correctCount = meta.quiz_mode ? extras.correct_count : null;
  const correctPct =
    meta.quiz_mode && totalResponses > 0
      ? Math.round((extras.correct_count / totalResponses) * 1000) / 10
      : null;

  const timeline = buildPollTimeline({
    openedAt: meta.created_at,
    closedAt: meta.closes_at,
    durationSeconds: meta.duration_seconds,
    offsets: extras.response_offsets,
    totalResponses,
  });

  return pollDetailResponseSchema.parse({
    data: {
      ...mapPollListItem(meta),
      totalResponses,
      uniqueLearnerCount: extras.unique_learner_count,
      eligibleCount: extras.eligible_count,
      correctCount,
      correctPct,
      medianResponseSeconds:
        extras.median_response_seconds == null
          ? null
          : Math.round(extras.median_response_seconds * 10) / 10,
      openedAt: meta.created_at.toISOString(),
      closedAt: meta.closes_at?.toISOString() ?? null,
      firstResponseAt: extras.first_response_at?.toISOString() ?? null,
      lastResponseAt: extras.last_response_at?.toISOString() ?? null,
      respondentsHidden: meta.anonymous_vote,
      options: options.map((option) => ({
        optionId: option.option_id,
        label: option.label,
        sortOrder: option.sort_order,
        isCorrect: option.is_correct,
        count: option.count,
        percent:
          totalResponses > 0
            ? Math.round((option.count / totalResponses) * 1000) / 10
            : 0,
      })),
      timeline,
    },
  });
}

export async function listPollRespondents(
  tx: TenantTx,
  _ctx: ServiceCtx,
  pollId: string,
  query: PollRespondentsQuery,
) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();

  if (meta.anonymous_vote) {
    return pollRespondentsListResponseSchema.parse({
      data: {
        pollId,
        pollTitle: meta.title,
        anonymousVote: true,
        respondentsHidden: true,
        items: [],
        pageInfo: pageInfo(0, query.page, query.limit),
        columns: query.columns,
      },
    });
  }

  const filter = toRespondentFilter(pollId, {
    ...(query.learnerName ? { learnerName: query.learnerName } : {}),
    ...(query.optionId ? { optionId: query.optionId } : {}),
    ...(query.isCorrect ? { isCorrect: query.isCorrect } : {}),
    ...(query.respondedFrom ? { respondedFrom: query.respondedFrom } : {}),
    ...(query.respondedTo ? { respondedTo: query.respondedTo } : {}),
  });

  const [totalCount, rows] = await Promise.all([
    pollsRosterRepository.countRespondents(tx, filter),
    pollsRosterRepository.listRespondents(tx, pollId, query),
  ]);

  return pollRespondentsListResponseSchema.parse({
    data: {
      pollId,
      pollTitle: meta.title,
      anonymousVote: false,
      respondentsHidden: false,
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        optionId: row.option_id,
        optionLabel: row.option_label,
        isCorrect: meta.quiz_mode ? row.is_correct : null,
        responseSeconds:
          row.response_seconds == null
            ? null
            : Math.round(row.response_seconds * 10) / 10,
        respondedAt: row.responded_at.toISOString(),
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
      columns: query.columns,
    },
  });
}

/** Used when callers insist on identifiable respondents (e.g. messaging). */
export async function assertPollRespondentsVisible(tx: TenantTx, pollId: string) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();
  if (meta.anonymous_vote) throw pollRosterRespondentsHidden();
  return meta;
}

export async function getPollOptionDetail(
  tx: TenantTx,
  _ctx: ServiceCtx,
  pollId: string,
  optionId: string,
) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();

  const [options, extras, segments] = await Promise.all([
    pollsRosterRepository.listOptionBreakdown(tx, pollId),
    pollsRosterRepository.getOptionExtras(tx, pollId, optionId),
    pollsRosterRepository.listOptionBatchSegments(tx, pollId, optionId),
  ]);

  const target = options.find((option) => option.option_id === optionId);
  if (!target) throw pollOptionNotFound();

  const totalResponses = options.reduce((sum, option) => sum + option.count, 0);
  const mappedOptions = options.map((option) => ({
    optionId: option.option_id,
    label: option.label,
    sortOrder: option.sort_order,
    isCorrect: option.is_correct,
    count: option.count,
    percent:
      totalResponses > 0
        ? Math.round((option.count / totalResponses) * 1000) / 10
        : 0,
  }));

  const ranked = [...mappedOptions].sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.sortOrder - b.sortOrder;
  });
  const rankIndex = ranked.findIndex((option) => option.optionId === optionId);
  const rank = rankIndex < 0 ? 1 : rankIndex + 1;
  const next = ranked[rankIndex + 1];
  const votesAheadOfNext =
    next == null ? null : Math.max(0, target.count - next.count);

  const optionMedian =
    extras.option_median_response_seconds == null
      ? null
      : Math.round(extras.option_median_response_seconds * 10) / 10;
  const overallMedian =
    extras.overall_median_response_seconds == null
      ? null
      : Math.round(extras.overall_median_response_seconds * 10) / 10;

  const timing = buildOptionTiming({
    openedAt: meta.created_at,
    closedAt: meta.closes_at,
    durationSeconds: meta.duration_seconds,
    optionOffsets: extras.option_offsets,
    overallOffsets: extras.overall_offsets,
  });

  const optionMapped = mappedOptions.find((option) => option.optionId === optionId)!;

  return pollOptionDetailResponseSchema.parse({
    data: {
      pollId: meta.id,
      pollTitle: meta.title,
      pollDescription: meta.description,
      quizMode: meta.quiz_mode,
      anonymousVote: meta.anonymous_vote,
      isOpen: meta.is_open,
      openedAt: meta.created_at.toISOString(),
      closedAt: meta.closes_at?.toISOString() ?? null,
      respondentsHidden: meta.anonymous_vote,
      option: optionMapped,
      totalResponses,
      optionCount: mappedOptions.length,
      rank,
      votesAheadOfNext,
      medianResponseSeconds: optionMedian,
      overallMedianResponseSeconds: overallMedian,
      timingInsight: buildTimingInsight(optionMedian, overallMedian),
      timing,
      segments: segments.map((segment) => ({
        key: segment.key,
        label: segment.label,
        count: segment.count,
        percent:
          target.count > 0
            ? Math.round((segment.count / target.count) * 1000) / 10
            : 0,
      })),
      siblings: mappedOptions.filter((option) => option.optionId !== optionId),
    },
  });
}

function resolveAudienceSource(meta: {
  live_session_id: string | null;
  attendance_count: number;
  batch_id: string | null;
  batch_member_count: number;
}): "none" | "live_session" | "batch" {
  if (!meta.live_session_id) return "none";
  if (meta.attendance_count > 0) return "live_session";
  if (meta.batch_id && meta.batch_member_count > 0) return "batch";
  return "none";
}

export async function listPollNonRespondents(
  tx: TenantTx,
  _ctx: ServiceCtx,
  pollId: string,
  query: PollNonRespondentsQuery,
) {
  const poll = await pollsRosterRepository.findPollById(tx, pollId);
  if (!poll) throw pollRosterNotFound();

  const audienceMeta = await pollsRosterRepository.getNonRespondentsAudienceMeta(tx, pollId);
  if (!audienceMeta) throw pollRosterNotFound();

  const audienceSource = resolveAudienceSource(audienceMeta);

  if (audienceSource === "none") {
    return pollNonRespondentsListResponseSchema.parse({
      data: {
        pollId,
        summary: {
          audienceKnown: false,
          audienceSource: "none",
          liveSessionId: audienceMeta.live_session_id,
          liveSessionTitle: audienceMeta.live_session_title,
          batchId: audienceMeta.batch_id,
          batchName: audienceMeta.batch_name,
          pollTitle: poll.title,
          pollIsOpen: poll.is_open,
          anonymousVote: poll.anonymous_vote,
          eligibleCount: 0,
          respondentCount: 0,
          nonRespondentCount: 0,
          presentNonRespondentCount: 0,
          absentNonRespondentCount: 0,
        },
        items: [],
        pageInfo: pageInfo(0, query.page, query.limit),
      },
    });
  }

  const [summary, totalCount, rows] = await Promise.all([
    pollsRosterRepository.summarizeNonRespondents(tx, pollId, audienceSource),
    pollsRosterRepository.countNonRespondents(tx, pollId, audienceSource, query),
    pollsRosterRepository.listNonRespondents(tx, pollId, audienceSource, query),
  ]);

  return pollNonRespondentsListResponseSchema.parse({
    data: {
      pollId,
      summary: {
        audienceKnown: true,
        audienceSource,
        liveSessionId: audienceMeta.live_session_id,
        liveSessionTitle: audienceMeta.live_session_title,
        batchId: audienceMeta.batch_id,
        batchName: audienceMeta.batch_name,
        pollTitle: poll.title,
        pollIsOpen: poll.is_open,
        anonymousVote: poll.anonymous_vote,
        eligibleCount: summary.eligible_count,
        respondentCount: summary.respondent_count,
        nonRespondentCount: summary.non_respondent_count,
        presentNonRespondentCount: summary.present_non_respondent_count,
        absentNonRespondentCount: summary.absent_non_respondent_count,
      },
      items: rows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        email: row.email,
        batchId: row.batch_id,
        batchName: row.batch_name,
        presence: row.presence,
        watchSeconds: row.watch_seconds,
        pollsAnswered: row.polls_answered,
        lastResponseAt: row.last_response_at?.toISOString() ?? null,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const sum = values.reduce((acc, value) => acc + value, 0);
  return Math.round((sum / values.length) * 10) / 10;
}

export async function getPollLiveMonitor(
  tx: TenantTx,
  _ctx: ServiceCtx,
  pollId: string,
) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();

  const [options, extras, recentRows] = await Promise.all([
    pollsRosterRepository.listOptionBreakdown(tx, pollId),
    pollsRosterRepository.getPollDetailExtras(tx, pollId),
    meta.anonymous_vote
      ? Promise.resolve([])
      : pollsRosterRepository.listRecentAnswers(tx, pollId, 15),
  ]);

  const totalResponses = options.reduce((sum, option) => sum + option.count, 0);
  const correctPct =
    meta.quiz_mode && totalResponses > 0
      ? Math.round((extras.correct_count / totalResponses) * 1000) / 10
      : null;

  const timeline = buildPollTimeline({
    openedAt: meta.created_at,
    closedAt: meta.closes_at && !meta.is_open ? meta.closes_at : null,
    durationSeconds: meta.duration_seconds,
    offsets: extras.response_offsets,
    totalResponses,
  });

  const serverNow = new Date();
  const elapsedSeconds = Math.max(
    0,
    (serverNow.getTime() - meta.created_at.getTime()) / 1000,
  );
  const recentResponseCount = extras.response_offsets.filter(
    (offset) => offset >= elapsedSeconds - 10 && offset <= elapsedSeconds + 1,
  ).length;

  const secondsRemaining =
    meta.is_open && meta.closes_at
      ? Math.max(0, Math.ceil((meta.closes_at.getTime() - serverNow.getTime()) / 1000))
      : null;

  const ranForSeconds = !meta.is_open
    ? Math.round(
        Math.max(
          0,
          ((meta.closes_at?.getTime() ?? serverNow.getTime()) -
            meta.created_at.getTime()) /
            1000,
        ),
      )
    : null;

  const showCorrectAnswers =
    meta.quiz_mode &&
    (!meta.is_open || meta.result_visibility !== "after_poll_ends");

  const eligibleCount = extras.eligible_count;
  const participationPct =
    eligibleCount != null && eligibleCount > 0
      ? Math.round((totalResponses / eligibleCount) * 1000) / 10
      : meta.participation_pct;

  return pollLiveMonitorResponseSchema.parse({
    data: {
      pollId: meta.id,
      title: meta.title,
      description: meta.description,
      quizMode: meta.quiz_mode,
      anonymousVote: meta.anonymous_vote,
      resultVisibility: meta.result_visibility,
      isOpen: meta.is_open,
      durationSeconds: meta.duration_seconds,
      openedAt: meta.created_at.toISOString(),
      closedAt: meta.closes_at?.toISOString() ?? null,
      closesAt: meta.closes_at?.toISOString() ?? null,
      liveSessionId: meta.live_session_id,
      liveSessionTitle: meta.live_session_title,
      serverNow: serverNow.toISOString(),
      secondsRemaining,
      ranForSeconds,
      totalResponses,
      eligibleCount,
      participationPct,
      avgResponseSeconds: mean(extras.response_offsets),
      correctPct,
      recentResponseCount,
      showCorrectAnswers,
      options: options.map((option) => ({
        optionId: option.option_id,
        label: option.label,
        sortOrder: option.sort_order,
        isCorrect: option.is_correct,
        count: option.count,
        percent:
          totalResponses > 0
            ? Math.round((option.count / totalResponses) * 1000) / 10
            : 0,
      })),
      timeline: {
        bucketSeconds: timeline.bucketSeconds,
        durationSeconds: timeline.durationSeconds,
        points: timeline.points,
      },
      recentAnswers: recentRows.map((row) => ({
        membershipId: row.membership_id,
        learnerName: row.learner_name,
        optionId: row.option_id,
        optionLabel: row.option_label,
        respondedAt: row.responded_at.toISOString(),
      })),
      events: timeline.events,
    },
  });
}

export async function closePollLive(
  tx: TenantTx,
  ctx: ServiceCtx,
  pollId: string,
) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();
  const closed = await pollsRosterRepository.setPollClosesAt(tx, pollId, new Date());
  if (!closed) throw pollRosterNotFound();
  return getPollLiveMonitor(tx, ctx, pollId);
}

export async function extendPollLive(
  tx: TenantTx,
  ctx: ServiceCtx,
  pollId: string,
  body: PollLiveExtendBody,
) {
  const meta = await pollsRosterRepository.findPollById(tx, pollId);
  if (!meta) throw pollRosterNotFound();

  const now = Date.now();
  const base =
    meta.closes_at && meta.closes_at.getTime() > now
      ? meta.closes_at.getTime()
      : now;
  const nextClosesAt = new Date(base + body.seconds * 1000);
  const updated = await pollsRosterRepository.setPollClosesAt(tx, pollId, nextClosesAt);
  if (!updated) throw pollRosterNotFound();
  return getPollLiveMonitor(tx, ctx, pollId);
}

function buildSessionAttendanceCurve(
  intervals: Array<{ joined_at: Date; left_at: Date | null; duration_seconds: number | null }>,
  sessionStart: Date,
  durationSeconds: number,
) {
  const bucketSeconds = Math.max(30, Math.round(durationSeconds / 60) || 60);
  const pointCount = Math.min(121, Math.floor(durationSeconds / bucketSeconds) + 1);
  const startMs = sessionStart.getTime();
  const points: Array<{ offsetSeconds: number; concurrent: number }> = [];

  for (let i = 0; i < pointCount; i += 1) {
    const offsetSeconds = Math.min(durationSeconds, i * bucketSeconds);
    const t = startMs + offsetSeconds * 1000;
    let concurrent = 0;
    for (const interval of intervals) {
      const join = interval.joined_at.getTime();
      const leave =
        interval.left_at?.getTime() ??
        (interval.duration_seconds != null
          ? join + interval.duration_seconds * 1000
          : startMs + durationSeconds * 1000);
      if (join <= t && t <= leave) concurrent += 1;
    }
    points.push({ offsetSeconds, concurrent });
  }

  return { bucketSeconds, points };
}

export async function getLiveSessionPollReport(
  tx: TenantTx,
  _ctx: ServiceCtx,
  liveSessionId: string,
) {
  const session = await pollsRosterRepository.findLiveSessionForPollReport(tx, liveSessionId);
  if (!session) throw liveSessionPollReportNotFound();

  const polls = await pollsRosterRepository.listPollsForLiveSession(tx, liveSessionId);
  const eligibleCount = session.attendance_count > 0 ? session.attendance_count : null;

  const pollBlocks = await Promise.all(
    polls.map(async (poll) => {
      const [options, extras] = await Promise.all([
        pollsRosterRepository.listOptionBreakdown(tx, poll.id),
        pollsRosterRepository.getPollDetailExtras(tx, poll.id),
      ]);
      const responseCount = options.reduce((sum, option) => sum + option.count, 0);
      const correctPct =
        poll.quiz_mode && responseCount > 0
          ? Math.round((extras.correct_count / responseCount) * 1000) / 10
          : null;
      return {
        pollId: poll.id,
        title: poll.title,
        description: poll.description,
        quizMode: poll.quiz_mode,
        anonymousVote: poll.anonymous_vote,
        isOpen: poll.is_open,
        pollType: poll.poll_type,
        openedAt: poll.created_at.toISOString(),
        closedAt: poll.closes_at?.toISOString() ?? null,
        responseCount,
        eligibleCount: extras.eligible_count ?? eligibleCount,
        participationPct: poll.participation_pct,
        correctPct,
        options: options.map((option) => ({
          optionId: option.option_id,
          label: option.label,
          sortOrder: option.sort_order,
          isCorrect: option.is_correct,
          count: option.count,
          percent:
            responseCount > 0
              ? Math.round((option.count / responseCount) * 1000) / 10
              : 0,
        })),
      };
    }),
  );

  const quizCount = pollBlocks.filter((poll) => poll.quizMode).length;
  const opinionCount = pollBlocks.length - quizCount;
  const participationValues = pollBlocks
    .map((poll) => poll.participationPct)
    .filter((value): value is number => value != null);
  const avgParticipationPct =
    participationValues.length > 0
      ? Math.round(
          (participationValues.reduce((sum, value) => sum + value, 0) /
            participationValues.length) *
            10,
        ) / 10
      : null;

  const sortedByResponses = [...pollBlocks].sort(
    (a, b) => b.responseCount - a.responseCount || a.title.localeCompare(b.title),
  );
  const mostAnswered = sortedByResponses[0]
    ? {
        pollId: sortedByResponses[0].pollId,
        title: sortedByResponses[0].title,
        responseCount: sortedByResponses[0].responseCount,
      }
    : null;
  const leastAnswered =
    sortedByResponses.length > 0
      ? {
          pollId: sortedByResponses[sortedByResponses.length - 1]!.pollId,
          title: sortedByResponses[sortedByResponses.length - 1]!.title,
          responseCount: sortedByResponses[sortedByResponses.length - 1]!.responseCount,
        }
      : null;

  const answeredEveryPollCount =
    pollBlocks.some((poll) => !poll.anonymousVote)
      ? await pollsRosterRepository.countAnsweredEveryTrackedPoll(tx, liveSessionId)
      : 0;

  const sessionStart =
    session.started_at ?? session.scheduled_at ?? polls[0]?.created_at ?? new Date();
  const plannedSeconds =
    session.planned_duration_minutes != null
      ? session.planned_duration_minutes * 60
      : null;
  const endedAt = session.ended_at;
  const derivedDuration =
    endedAt != null
      ? Math.max(60, Math.round((endedAt.getTime() - sessionStart.getTime()) / 1000))
      : null;
  const lastPollClose = polls.reduce<number | null>((max, poll) => {
    const closeMs = (poll.closes_at ?? poll.created_at).getTime();
    if (max == null || closeMs > max) return closeMs;
    return max;
  }, null);
  const durationSeconds = Math.max(
    60,
    plannedSeconds ??
      derivedDuration ??
      (lastPollClose != null
        ? Math.round((lastPollClose - sessionStart.getTime()) / 1000)
        : 3600),
  );

  const intervals = await pollsRosterRepository.listLiveSessionAttendanceIntervals(
    tx,
    liveSessionId,
  );
  const attendance = buildSessionAttendanceCurve(intervals, sessionStart, durationSeconds);

  const timelinePolls = pollBlocks.map((poll) => {
    const openedMs = new Date(poll.openedAt).getTime();
    const closedMs = poll.closedAt
      ? new Date(poll.closedAt).getTime()
      : openedMs + Math.min(120, durationSeconds) * 1000;
    const offsetStartSeconds = Math.max(
      0,
      Math.min(durationSeconds, (openedMs - sessionStart.getTime()) / 1000),
    );
    const offsetEndSeconds = Math.max(
      offsetStartSeconds + 30,
      Math.min(durationSeconds, (closedMs - sessionStart.getTime()) / 1000),
    );
    return {
      pollId: poll.pollId,
      title: poll.title,
      offsetStartSeconds: Math.round(offsetStartSeconds * 10) / 10,
      offsetEndSeconds: Math.round(offsetEndSeconds * 10) / 10,
      participationPct: poll.participationPct,
      responseCount: poll.responseCount,
    };
  });

  let insight: string | null = null;
  if (pollBlocks.length >= 2) {
    const first = pollBlocks[0]!;
    const last = pollBlocks[pollBlocks.length - 1]!;
    if (first.participationPct != null && last.participationPct != null) {
      if (last.participationPct < first.participationPct - 5) {
        insight = `Participation fell with each poll — ${first.participationPct}% on the first, ${last.participationPct}% on the last.`;
      } else if (last.participationPct > first.participationPct + 5) {
        insight = `Participation rose across polls — ${first.participationPct}% on the first, ${last.participationPct}% on the last.`;
      } else {
        insight = `Participation stayed near ${avgParticipationPct ?? first.participationPct}% across ${pollBlocks.length} polls.`;
      }
    }
  }

  const MATRIX_LIMIT = 300;
  const [attendees, responses] = await Promise.all([
    pollsRosterRepository.listLiveSessionAttendees(tx, liveSessionId, MATRIX_LIMIT + 1),
    pollsRosterRepository.listLiveSessionPollResponses(tx, liveSessionId),
  ]);
  const truncated = attendees.length > MATRIX_LIMIT;
  const matrixAttendees = truncated ? attendees.slice(0, MATRIX_LIMIT) : attendees;

  const responseMap = new Map<string, boolean | null>();
  for (const row of responses) {
    responseMap.set(`${row.membership_id}:${row.poll_id}`, row.is_correct);
  }

  const trackedPollCount = pollBlocks.filter((poll) => !poll.anonymousVote).length;
  const matrixLearners = matrixAttendees.map((attendee) => {
    let answeredCount = 0;
    const cells = pollBlocks.map((poll) => {
      if (poll.anonymousVote) {
        return { pollId: poll.pollId, kind: "anonymous" as const };
      }
      const key = `${attendee.membership_id}:${poll.pollId}`;
      if (!responseMap.has(key)) {
        return { pollId: poll.pollId, kind: "missed" as const };
      }
      answeredCount += 1;
      const isCorrect = responseMap.get(key);
      if (poll.quizMode && isCorrect === true) {
        return { pollId: poll.pollId, kind: "correct" as const };
      }
      if (poll.quizMode && isCorrect === false) {
        return { pollId: poll.pollId, kind: "incorrect" as const };
      }
      return { pollId: poll.pollId, kind: "answered" as const };
    });
    return {
      membershipId: attendee.membership_id,
      learnerName: attendee.learner_name,
      email: attendee.email,
      cells,
      answeredCount,
      trackedPollCount,
    };
  });

  return liveSessionPollReportResponseSchema.parse({
    data: {
      session: {
        id: session.id,
        title: session.title,
        status: session.status,
        scheduledAt: session.scheduled_at?.toISOString() ?? null,
        startedAt: session.started_at?.toISOString() ?? null,
        endedAt: session.ended_at?.toISOString() ?? null,
        durationSeconds,
        attendanceCount: session.attendance_count,
        hostLabel: session.host_label,
        courseId: session.course_id,
        courseTitle: session.course_title,
        batchId: session.batch_id,
        batchName: session.batch_name,
        recordingUrl: session.recording_url,
        hasRecording: session.recording_url != null,
        timezoneLabel: session.timezone_label,
      },
      summary: {
        pollsRun: pollBlocks.length,
        opinionCount,
        quizCount,
        avgParticipationPct,
        mostAnswered: pollBlocks.length > 0 ? mostAnswered : null,
        leastAnswered: pollBlocks.length > 1 ? leastAnswered : mostAnswered,
        answeredEveryPollCount,
      },
      timeline: {
        durationSeconds,
        insight,
        attendance,
        polls: timelinePolls,
      },
      polls: pollBlocks,
      matrix: {
        polls: pollBlocks.map((poll) => ({
          pollId: poll.pollId,
          title: poll.title,
          openedAt: poll.openedAt,
          anonymousVote: poll.anonymousVote,
          quizMode: poll.quizMode,
          participationPct: poll.participationPct,
        })),
        learners: matrixLearners,
        truncated,
      },
    },
  });
}

export async function listLiveSessionsWithPolls(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: LiveSessionsPollsListQuery,
) {
  const filter = query.q ? { q: query.q } : {};
  const [totalCount, rows] = await Promise.all([
    pollsRosterRepository.countLiveSessionsWithPolls(tx, filter),
    pollsRosterRepository.listLiveSessionsWithPolls(tx, {
      ...filter,
      page: query.page,
      limit: query.limit,
    }),
  ]);

  return liveSessionsPollsListResponseSchema.parse({
    data: {
      items: rows.map((row) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        scheduledAt: row.scheduled_at?.toISOString() ?? null,
        startedAt: row.started_at?.toISOString() ?? null,
        endedAt: row.ended_at?.toISOString() ?? null,
        hostLabel: row.host_label,
        attendanceCount: row.attendance_count,
        pollCount: row.poll_count,
        quizPollCount: row.quiz_poll_count,
        totalResponses: row.total_responses,
        avgParticipationPct:
          row.avg_participation_pct == null
            ? null
            : Math.round(row.avg_participation_pct * 10) / 10,
        batchId: row.batch_id,
        batchName: row.batch_name,
        courseTitle: row.course_title,
      })),
      pageInfo: pageInfo(totalCount, query.page, query.limit),
    },
  });
}

function normalizeOptionLabel(label: string): string {
  return label.trim().toLowerCase().replace(/\s+/g, " ");
}

function earlyShareFromOffsets(offsets: number[], durationSeconds: number | null): number | null {
  if (offsets.length === 0) return null;
  const duration =
    durationSeconds != null && durationSeconds > 0
      ? durationSeconds
      : Math.max(...offsets, 20);
  const earlyWindow = Math.min(20, duration);
  const earlyCount = offsets.filter((offset) => offset <= earlyWindow).length;
  return Math.round((earlyCount / offsets.length) * 1000) / 10;
}

function optionsAreAligned(
  polls: Array<{ options: Array<{ label: string; sortOrder: number }> }>,
  alignBy: "label" | "order",
): boolean {
  if (polls.length < 2) return false;
  const first = polls[0]!;
  if (alignBy === "order") {
    return polls.every(
      (poll) =>
        poll.options.length === first.options.length &&
        poll.options.every(
          (option, index) =>
            normalizeOptionLabel(option.label) ===
            normalizeOptionLabel(first.options[index]?.label ?? ""),
        ),
    );
  }
  const firstSet = new Set(first.options.map((option) => normalizeOptionLabel(option.label)));
  if (firstSet.size === 0) return false;
  return polls.every((poll) => {
    const set = new Set(poll.options.map((option) => normalizeOptionLabel(option.label)));
    if (set.size !== firstSet.size) return false;
    for (const label of firstSet) {
      if (!set.has(label)) return false;
    }
    return true;
  });
}

function buildTrendInsight(
  polls: Array<{
    title: string;
    openedAt: string;
    options: Array<{ label: string; percent: number }>;
  }>,
  optionsAligned: boolean,
): string | null {
  if (!optionsAligned || polls.length < 3) return null;
  const titleKey = normalizeOptionLabel(polls[0]!.title);
  if (!polls.every((poll) => normalizeOptionLabel(poll.title) === titleKey)) return null;

  const chronological = [...polls].sort(
    (a, b) => new Date(a.openedAt).getTime() - new Date(b.openedAt).getTime(),
  );
  const earliest = chronological[0]!;
  const latest = chronological[chronological.length - 1]!;
  let bestLabel = "";
  let bestDelta = 0;
  for (const option of earliest.options) {
    const key = normalizeOptionLabel(option.label);
    const later = latest.options.find(
      (candidate) => normalizeOptionLabel(candidate.label) === key,
    );
    if (!later) continue;
    const delta = later.percent - option.percent;
    if (Math.abs(delta) > Math.abs(bestDelta)) {
      bestDelta = delta;
      bestLabel = option.label;
    }
  }
  if (!bestLabel || Math.abs(bestDelta) < 0.5) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const direction = bestDelta > 0 ? "rose" : "fell";
  const pts = Math.round(Math.abs(bestDelta) * 10) / 10;
  return `${bestLabel} ${direction} ${pts} points between ${fmt(earliest.openedAt)} and ${fmt(latest.openedAt)}.`;
}

export async function comparePolls(
  tx: TenantTx,
  _ctx: ServiceCtx,
  query: PollsCompareQuery,
) {
  if (query.pollIds.length < 2 || query.pollIds.length > 4) {
    throw pollCompareInsufficient();
  }

  const loaded = await Promise.all(
    query.pollIds.map(async (pollId, index) => {
      const meta = await pollsRosterRepository.findPollById(tx, pollId);
      if (!meta) throw pollRosterNotFound();
      const [optionRows, extras] = await Promise.all([
        pollsRosterRepository.listOptionBreakdown(tx, pollId),
        pollsRosterRepository.getPollDetailExtras(tx, pollId),
      ]);
      const totalResponses = optionRows.reduce((sum, option) => sum + option.count, 0);
      const options = optionRows.map((option) => ({
        optionId: option.option_id,
        label: option.label,
        sortOrder: option.sort_order,
        isCorrect: option.is_correct,
        count: option.count,
        percent:
          totalResponses > 0
            ? Math.round((option.count / totalResponses) * 1000) / 10
            : 0,
      }));
      const correctPct =
        meta.quiz_mode && totalResponses > 0
          ? Math.round((extras.correct_count / totalResponses) * 1000) / 10
          : null;
      const eligibleCount = extras.eligible_count;
      const uniqueLearners = extras.unique_learner_count;
      const participationPct =
        meta.participation_pct != null
          ? Math.round(meta.participation_pct * 10) / 10
          : eligibleCount != null && eligibleCount > 0
            ? Math.round((uniqueLearners / eligibleCount) * 1000) / 10
            : null;
      const nonRespondentCount =
        eligibleCount == null ? null : Math.max(0, eligibleCount - uniqueLearners);

      return {
        index,
        id: meta.id,
        title: meta.title,
        shortName: `Poll ${index + 1}`,
        quizMode: meta.quiz_mode,
        anonymousVote: meta.anonymous_vote,
        liveSessionId: meta.live_session_id,
        liveSessionTitle: meta.live_session_title,
        createdAt: meta.created_at.toISOString(),
        openedAt: meta.created_at.toISOString(),
        closedAt: meta.closes_at?.toISOString() ?? null,
        responseCount: totalResponses,
        eligibleCount,
        participationPct,
        medianResponseSeconds:
          extras.median_response_seconds == null
            ? null
            : Math.round(extras.median_response_seconds * 10) / 10,
        correctPct,
        earlySharePct: earlyShareFromOffsets(
          extras.response_offsets,
          meta.duration_seconds,
        ),
        nonRespondentCount,
        options,
      };
    }),
  );

  const optionsAligned = optionsAreAligned(loaded, query.alignBy);
  const left = loaded[0]!;

  const optionRows = optionsAligned
    ? (() => {
        if (query.alignBy === "order") {
          return left.options.map((leftOption, optionIndex) => {
            const cells = loaded.map((poll, pollIndex) => {
              const option = poll.options[optionIndex] ?? null;
              const percent = option?.percent ?? null;
              const leftPercent = leftOption.percent;
              return {
                pollId: poll.id,
                optionId: option?.optionId ?? null,
                label: option?.label ?? null,
                count: option?.count ?? null,
                percent,
                isCorrect: option?.isCorrect ?? null,
                deltaPctVsLeft:
                  pollIndex === 0 || percent == null
                    ? null
                    : Math.round((percent - leftPercent) * 10) / 10,
              };
            });
            return {
              key: `order:${optionIndex}`,
              label: leftOption.label,
              cells,
            };
          });
        }

        return left.options.map((leftOption) => {
          const key = normalizeOptionLabel(leftOption.label);
          const cells = loaded.map((poll, pollIndex) => {
            const option =
              poll.options.find(
                (candidate) => normalizeOptionLabel(candidate.label) === key,
              ) ?? null;
            const percent = option?.percent ?? null;
            return {
              pollId: poll.id,
              optionId: option?.optionId ?? null,
              label: option?.label ?? null,
              count: option?.count ?? null,
              percent,
              isCorrect: option?.isCorrect ?? null,
              deltaPctVsLeft:
                pollIndex === 0 || percent == null
                  ? null
                  : Math.round((percent - leftOption.percent) * 10) / 10,
            };
          });
          return {
            key: `label:${key}`,
            label: leftOption.label,
            cells,
          };
        });
      })()
    : [];

  const trendInsight = buildTrendInsight(loaded, optionsAligned);

  return pollsCompareResponseSchema.parse({
    data: {
      alignBy: query.alignBy,
      optionsAligned,
      polls: loaded.map(
        ({
          index: _index,
          ...poll
        }) => poll,
      ),
      optionRows,
      trendInsight,
    },
  });
}
