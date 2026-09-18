import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  createPollBodySchema,
  pollListResponseSchema,
  pollRespondentViewResponseSchema,
  pollResponseSchema,
  pollResultsResponseSchema,
  respondPollBodySchema,
  respondPollResponseSchema,
  updatePollBodySchema,
} from "./polls.dto";
import { enrollmentRequired, pollClosed, pollNotFound, pollOptionNotFound } from "./polls.errors";
import { pollsRepository, type PollOptionRow, type PollRow } from "./polls.repository";

function toPollDto(poll: PollRow, options: PollOptionRow[]) {
  return {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    pollType: poll.poll_type,
    status: poll.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    quizMode: poll.quiz_mode,
    allowMultipleAnswers: poll.allow_multiple_answers,
    anonymousVote: poll.anonymous_vote,
    resultVisibility: poll.result_visibility,
    layout: poll.layout,
    durationSeconds: poll.duration_seconds,
    liveSessionId: poll.live_session_id,
    closesAt: poll.closes_at?.toISOString() ?? null,
    options: options.map((option) => ({
      id: option.id,
      label: option.label,
      sortOrder: option.sort_order,
      isCorrect: option.is_correct,
    })),
    createdAt: poll.created_at.toISOString(),
  };
}

export async function createPoll(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createPollBodySchema.parse(rawBody);
  const result = await pollsRepository.insertPoll(tx, {
    title: body.title,
    description: body.description ?? null,
    pollType: body.pollType,
    status: body.status,
    quizMode: body.quizMode,
    allowMultipleAnswers: body.allowMultipleAnswers,
    anonymousVote: body.anonymousVote,
    resultVisibility: body.resultVisibility,
    layout: body.layout,
    durationSeconds: body.durationSeconds ?? null,
    liveSessionId: body.liveSessionId ?? null,
    closesAt: body.closesAt ? new Date(body.closesAt) : null,
    options: body.options.map((option) => ({
      label: option.label,
      sortOrder: option.sortOrder,
      isCorrect: option.isCorrect,
    })),
  });

  return pollResponseSchema.parse({
    data: toPollDto(result.poll, result.options),
  });
}

export async function listPolls(tx: TenantTx, _ctx: ServiceCtx) {
  const polls = await pollsRepository.listPolls(tx);
  const items = await Promise.all(
    polls.map(async (poll) => {
      const options = await pollsRepository.listOptionsForPoll(tx, poll.id);
      return toPollDto(poll, options);
    }),
  );

  return pollListResponseSchema.parse({ data: { items } });
}

export async function getPoll(tx: TenantTx, _ctx: ServiceCtx, pollId: string) {
  const poll = await pollsRepository.findPollById(tx, pollId);
  if (!poll) throw pollNotFound();
  const options = await pollsRepository.listOptionsForPoll(tx, pollId);
  return pollResponseSchema.parse({ data: toPollDto(poll, options) });
}

/**
 * Read a poll as a respondent.
 *
 * Mirrors the guards in `respondToPoll` rather than those in `getPoll`: a
 * learner may only see a poll they could actually answer, so an archived,
 * inactive or closed poll is a 404-equivalent here even though an admin can
 * still read it. Returns the learner-safe projection, which omits isCorrect.
 */
export async function getPollForRespondent(tx: TenantTx, ctx: ServiceCtx, pollId: string) {
  const poll = await pollsRepository.findPollById(tx, pollId);
  if (!poll) throw pollNotFound();
  if (poll.status !== "ACTIVE") throw pollClosed();
  if (poll.closes_at && poll.closes_at.getTime() < Date.now()) throw pollClosed();

  const enrolled = await pollsRepository.hasActiveEnrollment(tx, ctx.actorMembershipId);
  if (!enrolled) throw enrollmentRequired();

  const options = await pollsRepository.listOptionsForPoll(tx, pollId);
  return pollRespondentViewResponseSchema.parse({
    data: {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      allowMultipleAnswers: poll.allow_multiple_answers,
      anonymousVote: poll.anonymous_vote,
      closesAt: poll.closes_at?.toISOString() ?? null,
      options: options.map((option) => ({
        id: option.id,
        label: option.label,
        sortOrder: option.sort_order,
      })),
    },
  });
}

export async function updatePoll(tx: TenantTx, _ctx: ServiceCtx, pollId: string, rawBody: unknown) {
  const body = updatePollBodySchema.parse(rawBody);
  const poll = await pollsRepository.updatePoll(tx, pollId, {
    ...(body.title !== undefined ? { title: body.title } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.quizMode !== undefined ? { quizMode: body.quizMode } : {}),
    ...(body.allowMultipleAnswers !== undefined
      ? { allowMultipleAnswers: body.allowMultipleAnswers }
      : {}),
    ...(body.anonymousVote !== undefined ? { anonymousVote: body.anonymousVote } : {}),
    ...(body.resultVisibility !== undefined ? { resultVisibility: body.resultVisibility } : {}),
    ...(body.layout !== undefined ? { layout: body.layout } : {}),
    ...(body.durationSeconds !== undefined ? { durationSeconds: body.durationSeconds } : {}),
    ...(body.liveSessionId !== undefined ? { liveSessionId: body.liveSessionId } : {}),
    ...(body.closesAt !== undefined
      ? { closesAt: body.closesAt ? new Date(body.closesAt) : null }
      : {}),
  });
  if (!poll) throw pollNotFound();
  const options = await pollsRepository.listOptionsForPoll(tx, pollId);
  return pollResponseSchema.parse({ data: toPollDto(poll, options) });
}

export async function deletePoll(tx: TenantTx, _ctx: ServiceCtx, pollId: string) {
  const deleted = await pollsRepository.deletePoll(tx, pollId);
  if (!deleted) throw pollNotFound();
  return { data: { deleted: true } };
}

export async function respondToPoll(
  tx: TenantTx,
  ctx: ServiceCtx,
  pollId: string,
  rawBody: unknown,
) {
  const body = respondPollBodySchema.parse(rawBody);
  const poll = await pollsRepository.findPollById(tx, pollId);
  if (!poll) throw pollNotFound();
  if (poll.closes_at && poll.closes_at.getTime() < Date.now()) throw pollClosed();
  if (poll.status !== "ACTIVE") throw pollClosed();

  const enrolled = await pollsRepository.hasActiveEnrollment(tx, ctx.actorMembershipId);
  if (!enrolled) throw enrollmentRequired();

  const validOption = await pollsRepository.optionBelongsToPoll(tx, pollId, body.pollOptionId);
  if (!validOption) throw pollOptionNotFound();

  await pollsRepository.insertResponse(tx, {
    pollId,
    pollOptionId: body.pollOptionId,
    membershipId: ctx.actorMembershipId,
  });

  return respondPollResponseSchema.parse({
    data: {
      pollId,
      pollOptionId: body.pollOptionId,
      membershipId: ctx.actorMembershipId,
    },
  });
}

export async function getPollResults(tx: TenantTx, _ctx: ServiceCtx, pollId: string) {
  const poll = await pollsRepository.findPollById(tx, pollId);
  if (!poll) throw pollNotFound();

  const options = await pollsRepository.getResults(tx, pollId);
  const totalResponses = options.reduce((sum, option) => sum + option.count, 0);

  return pollResultsResponseSchema.parse({
    data: {
      pollId,
      totalResponses,
      options: options.map((option) => ({
        optionId: option.optionId,
        label: option.label,
        count: option.count,
        isCorrect: option.isCorrect,
        percent: totalResponses > 0 ? Math.round((option.count / totalResponses) * 1000) / 10 : 0,
      })),
    },
  });
}
