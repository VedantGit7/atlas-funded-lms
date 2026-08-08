import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { resolveGamificationRules } from "./gamification-config.service";
import { applyXpDelta } from "./gamification-xp.service";
import { duplicateQuestKey, questNotFound } from "./gamification.errors";
import { gamificationRepository } from "./gamification.repository";
import { questRepository, type QuestDefinitionRow } from "./quest.repository";
import type {
  createQuestInputSchema,
  postQuestsBodySchema,
  QuestCriteria,
  QuestRewards,
  QuestStep,
  QuestStepProgress,
  updateQuestBodySchema,
} from "./quest.schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function parseCriteria(value: unknown): QuestCriteria {
  return value as QuestCriteria;
}

function parseRewards(value: unknown): QuestRewards {
  return value as QuestRewards;
}

export function toQuestDto(row: QuestDefinitionRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    description: row.description,
    questType: row.quest_type,
    criteria: parseCriteria(row.criteria_json),
    rewards: parseRewards(row.rewards_json),
    startsAt: row.starts_at?.toISOString() ?? null,
    endsAt: row.ends_at?.toISOString() ?? null,
    courseId: row.course_id,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
  };
}

function stepTarget(step: QuestStep): number {
  switch (step.type) {
    case "complete_lessons":
      return step.count;
    case "earn_xp":
      return step.amount;
    case "maintain_streak":
      return step.days;
    case "earn_badge":
      return 1;
    case "complete_assessment":
      return 1;
    case "event_count":
      return step.count;
  }
}

function initialStepProgress(criteria: QuestCriteria): QuestStepProgress[] {
  return criteria.steps.map((step) => ({
    progress: 0,
    target: stepTarget(step),
    completedAt: null,
  }));
}

export async function listQuestsForAdmin(tx: TenantTx) {
  const [quests, counts] = await Promise.all([
    questRepository.listQuests(tx),
    questRepository.countProgressByQuest(tx),
  ]);
  const countsByQuest = new Map(counts.map((row) => [row.quest_id, row]));

  return {
    data: {
      items: quests.map((quest) => ({
        ...toQuestDto(quest),
        startedCount: countsByQuest.get(quest.id)?.started ?? 0,
        completedCount: countsByQuest.get(quest.id)?.completed ?? 0,
      })),
    },
  };
}

export async function createQuest(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof createQuestInputSchema>,
) {
  const existing = await questRepository.findQuestByKey(tx, input.key);
  if (existing) {
    throw duplicateQuestKey();
  }

  const created = await questRepository.insertQuest(tx, {
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    description: input.description ?? null,
    questType: input.questType,
    criteria: input.criteria,
    rewards: input.rewards,
    startsAt: input.startsAt ?? null,
    endsAt: input.endsAt ?? null,
    courseId: input.courseId ?? null,
    status: input.status,
  });

  if (!created) {
    throw questNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "quest.created",
      target: { type: "quest_definition", id: created.id },
      before: null,
      after: toQuestDto(created),
      reason: null,
      metadata: {},
    },
  );

  return { data: toQuestDto(created) };
}

export async function mutateQuests(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof postQuestsBodySchema>,
) {
  return createQuest(tx, ctx, input.quest);
}

export async function updateQuest(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateQuestBodySchema>,
) {
  const before = await questRepository.findQuestById(tx, input.id);
  if (!before) {
    throw questNotFound();
  }

  const updated = await questRepository.updateQuest(tx, {
    id: input.id,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.questType != null ? { questType: input.questType } : {}),
    ...(input.criteria != null ? { criteria: input.criteria } : {}),
    ...(input.rewards != null ? { rewards: input.rewards } : {}),
    ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
    ...(input.courseId !== undefined ? { courseId: input.courseId } : {}),
    ...(input.status != null ? { status: input.status } : {}),
  });

  if (!updated) {
    throw questNotFound();
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "quest.updated",
      target: { type: "quest_definition", id: input.id },
      before: toQuestDto(before),
      after: toQuestDto(updated),
      reason: null,
      metadata: {},
    },
  );

  return { data: toQuestDto(updated) };
}

export async function listMyQuests(tx: TenantTx, ctx: ServiceCtx) {
  const now = new Date().toISOString();
  const quests = await questRepository.listActiveQuests(tx, now);
  const progressRows = await questRepository.listProgressForMembership(tx, ctx.actorMembershipId);
  const progressByQuest = new Map(progressRows.map((row) => [row.quest_id, row]));

  return {
    data: {
      items: quests.map((quest) => {
        const progress = progressByQuest.get(quest.id);
        const criteria = parseCriteria(quest.criteria_json);
        const steps =
          (progress?.progress_json as { steps?: QuestStepProgress[] } | null)?.steps ??
          initialStepProgress(criteria);

        return {
          ...toQuestDto(quest),
          progressStatus: progress
            ? (progress.status as "in_progress" | "completed")
            : ("not_started" as const),
          stepProgress: steps,
          completedAt: progress?.completed_at?.toISOString() ?? null,
        };
      }),
    },
  };
}

type QuestEventContext = {
  membershipId: string;
  event: { id: string; eventType: string; payload: unknown };
  /** XP awarded for this event before quest rewards (feeds `earn_xp` steps). */
  pointsAwarded: number;
};

/**
 * Read-only preview of quest step movement for a hypothetical event
 * (used by the admin simulate endpoint). Writes nothing.
 */
export async function previewQuestsForEvent(
  tx: TenantTx,
  args: QuestEventContext,
): Promise<Array<{ key: string; name: string; stepsProgressed: number; wouldComplete: boolean }>> {
  const now = new Date().toISOString();
  const quests = await questRepository.listActiveQuests(tx, now);
  const results: Array<{
    key: string;
    name: string;
    stepsProgressed: number;
    wouldComplete: boolean;
  }> = [];

  for (const quest of quests) {
    const existing = await questRepository.findProgress(tx, {
      questId: quest.id,
      membershipId: args.membershipId,
    });
    if (existing?.status === "completed") continue;

    const criteria = parseCriteria(quest.criteria_json);
    const currentSteps =
      (existing?.progress_json as { steps?: QuestStepProgress[] } | null)?.steps ??
      initialStepProgress(criteria);

    let stepsProgressed = 0;
    let chainBlocked = false;
    const nextSteps: QuestStepProgress[] = [];

    for (const [index, step] of criteria.steps.entries()) {
      const current = currentSteps[index] ?? {
        progress: 0,
        target: stepTarget(step),
        completedAt: null,
      };

      if (quest.quest_type === "chain" && chainBlocked) {
        nextSteps.push(current);
        continue;
      }

      const next = await evaluateStep(tx, args, step, current);
      if (next.progress !== current.progress || next.completedAt !== current.completedAt) {
        stepsProgressed += 1;
      }
      nextSteps.push(next);

      if (quest.quest_type === "chain" && !next.completedAt) {
        chainBlocked = true;
      }
    }

    if (stepsProgressed > 0) {
      results.push({
        key: quest.key,
        name: quest.name,
        stepsProgressed,
        wouldComplete: nextSteps.every((step) => step.completedAt != null),
      });
    }
  }

  return results;
}

async function evaluateStep(
  tx: TenantTx,
  args: QuestEventContext,
  step: QuestStep,
  current: QuestStepProgress,
): Promise<QuestStepProgress> {
  if (current.completedAt) {
    return current;
  }

  let progress = current.progress;

  if (step.type === "complete_lessons" && args.event.eventType === "lesson.completed") {
    const payload = args.event.payload as { courseId?: string };
    if (!step.courseId || payload.courseId === step.courseId) {
      progress += 1;
    }
  } else if (step.type === "earn_xp") {
    progress += args.pointsAwarded;
  } else if (step.type === "maintain_streak") {
    const streak = await gamificationRepository.findStreak(tx, {
      membershipId: args.membershipId,
      streakKey: step.streakKey,
    });
    progress = streak?.current_count ?? 0;
  } else if (step.type === "earn_badge") {
    const earned = await questRepository.hasBadgeAwardByKey(tx, {
      membershipId: args.membershipId,
      badgeKey: step.badgeKey,
    });
    progress = earned ? 1 : 0;
  } else if (step.type === "complete_assessment" && args.event.eventType === "assessment.graded") {
    const payload = args.event.payload as {
      assessmentId?: string;
      score: number;
      possiblePoints: number;
    };
    const percent = payload.possiblePoints > 0 ? (payload.score / payload.possiblePoints) * 100 : 0;
    if (
      (!step.assessmentId || payload.assessmentId === step.assessmentId) &&
      percent >= step.minScorePercent
    ) {
      progress = 1;
    }
  } else if (step.type === "event_count" && args.event.eventType === step.eventType) {
    progress += 1;
  }

  const target = stepTarget(step);
  const clamped = Math.min(progress, target);
  return {
    progress: clamped,
    target,
    completedAt: clamped >= target ? new Date().toISOString() : null,
  };
}

async function grantQuestRewards(
  tx: TenantTx,
  ctx: ServiceCtx,
  quest: QuestDefinitionRow,
  membershipId: string,
): Promise<void> {
  const rewards = parseRewards(quest.rewards_json);

  if (rewards.xp && rewards.xp > 0) {
    const inserted = await gamificationRepository.insertPointLedger(tx, {
      tenantId: ctx.tenantId,
      membershipId,
      points: rewards.xp,
      reasonKey: `quest_reward.${quest.key}`,
      sourceEventId: null,
      idempotencyKey: `quest-reward:${quest.id}:${membershipId}`,
      eventType: "quest.completed",
    });

    if (inserted) {
      const rules = await resolveGamificationRules(tx);
      await applyXpDelta(tx, ctx, {
        membershipId,
        points: rewards.xp,
        levelThresholds: rules.levelThresholds,
      });
    }
  }

  if (rewards.badgeKey) {
    const badge = await gamificationRepository.findBadgeByKey(tx, rewards.badgeKey);
    if (badge) {
      const inserted = await gamificationRepository.insertBadgeAward(tx, {
        tenantId: ctx.tenantId,
        badgeId: badge.id,
        membershipId,
      });
      if (inserted) {
        await outbox.publish(tx, {
          ctx: {
            tenantId: ctx.tenantId,
            actorMembershipId: membershipId,
            requestId: ctx.requestId,
          },
          eventType: "badge.awarded",
          aggregateType: "badge_award",
          aggregateId: badge.id,
          payload: { badgeId: badge.id, membershipId },
          idempotencyKey: `badge.awarded:${badge.id}:${membershipId}`,
        });
      }
    }
  }
}

export async function evaluateQuestsForEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  args: QuestEventContext,
): Promise<void> {
  const now = new Date().toISOString();
  const quests = await questRepository.listActiveQuests(tx, now);
  if (quests.length === 0) {
    return;
  }

  for (const quest of quests) {
    const existing = await questRepository.findProgress(tx, {
      questId: quest.id,
      membershipId: args.membershipId,
    });

    if (existing?.status === "completed") {
      continue;
    }

    const criteria = parseCriteria(quest.criteria_json);
    const currentSteps =
      (existing?.progress_json as { steps?: QuestStepProgress[] } | null)?.steps ??
      initialStepProgress(criteria);

    const nextSteps: QuestStepProgress[] = [];
    let changed = existing == null;
    let chainBlocked = false;

    for (const [index, step] of criteria.steps.entries()) {
      const current = currentSteps[index] ?? {
        progress: 0,
        target: stepTarget(step),
        completedAt: null,
      };

      // Chain quests unlock steps in order; later steps stay frozen.
      if (quest.quest_type === "chain" && chainBlocked) {
        nextSteps.push(current);
        continue;
      }

      const next = await evaluateStep(tx, args, step, current);
      if (next.progress !== current.progress || next.completedAt !== current.completedAt) {
        changed = true;
      }
      nextSteps.push(next);

      if (quest.quest_type === "chain" && !next.completedAt) {
        chainBlocked = true;
      }
    }

    const allComplete = nextSteps.every((step) => step.completedAt != null);
    if (!changed && !allComplete) {
      continue;
    }

    // Only track members once they make progress toward the quest.
    const hasAnyProgress = nextSteps.some((step) => step.progress > 0) || existing != null;
    if (!hasAnyProgress) {
      continue;
    }

    const completedAt = allComplete ? new Date().toISOString() : null;
    await questRepository.upsertProgress(tx, {
      tenantId: ctx.tenantId,
      questId: quest.id,
      membershipId: args.membershipId,
      status: allComplete ? "completed" : "in_progress",
      steps: nextSteps,
      completedAt,
    });

    if (allComplete) {
      await outbox.publish(tx, {
        ctx: {
          tenantId: ctx.tenantId,
          actorMembershipId: args.membershipId,
          requestId: ctx.requestId,
        },
        eventType: "quest.completed",
        aggregateType: "quest_progress",
        aggregateId: quest.id,
        payload: {
          questId: quest.id,
          questKey: quest.key,
          membershipId: args.membershipId,
        },
        idempotencyKey: `quest.completed:${quest.id}:${args.membershipId}`,
      });

      await grantQuestRewards(tx, ctx, quest, args.membershipId);
    }
  }
}
