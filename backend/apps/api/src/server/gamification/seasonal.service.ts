import type { TenantTx } from "@atlas/db";
import type { z } from "zod";
import { auditWriter } from "@atlas/audit";
import { duplicateSeasonalKey, seasonalEventNotFound } from "./gamification.errors";
import { seasonalRepository, type SeasonalEventRow } from "./seasonal.repository";
import type {
  postSeasonalEventsBodySchema,
  SeasonalMultiplier,
  SeasonalStatus,
  updateSeasonalEventBodySchema,
} from "./seasonal.schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function parseMultiplier(value: unknown): SeasonalMultiplier {
  const parsed = value as Partial<SeasonalMultiplier> | null;
  return {
    xpMultiplier: parsed?.xpMultiplier ?? 1,
    applyToStreakBonuses: parsed?.applyToStreakBonuses ?? true,
  };
}

export function toSeasonalEventDto(row: SeasonalEventRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    status: row.status as SeasonalStatus,
    startsAt: row.starts_at.toISOString(),
    endsAt: row.ends_at.toISOString(),
    multiplier: parseMultiplier(row.multiplier_json),
    linkedQuestIds: (row.linked_quest_ids as string[] | null) ?? [],
    linkedLeaderboardKey: row.linked_leaderboard_key,
  };
}

function writeSeasonalAudit(
  tx: TenantTx,
  ctx: ServiceCtx,
  entry: { action: string; targetId: string; before: unknown; after: unknown },
) {
  return auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: entry.action,
      target: { type: "seasonal_event", id: entry.targetId },
      before: entry.before,
      after: entry.after,
      reason: null,
      metadata: {},
    },
  );
}

export async function listSeasonalEvents(tx: TenantTx) {
  await seasonalRepository.applyTransitions(tx);
  const rows = await seasonalRepository.listEvents(tx);
  return { data: { items: rows.map(toSeasonalEventDto) } };
}

export async function mutateSeasonalEvents(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof postSeasonalEventsBodySchema>,
) {
  if (input.operation === "create") {
    const existing = await seasonalRepository.findEventByKey(tx, input.event.key);
    if (existing) {
      throw duplicateSeasonalKey();
    }

    const created = await seasonalRepository.insertEvent(tx, {
      tenantId: ctx.tenantId,
      key: input.event.key,
      name: input.event.name,
      status: input.event.status,
      startsAt: input.event.startsAt,
      endsAt: input.event.endsAt,
      multiplier: input.event.multiplier,
      linkedQuestIds: input.event.linkedQuestIds,
      linkedLeaderboardKey: input.event.linkedLeaderboardKey ?? null,
    });

    if (!created) {
      throw seasonalEventNotFound();
    }

    await writeSeasonalAudit(tx, ctx, {
      action: "seasonal_event.created",
      targetId: created.id,
      before: null,
      after: toSeasonalEventDto(created),
    });

    await seasonalRepository.applyTransitions(tx);
    const fresh = await seasonalRepository.findEventById(tx, created.id);
    return { data: toSeasonalEventDto(fresh ?? created) };
  }

  // clone: copy multiplier/links from an existing event into a new season window.
  const source = await seasonalRepository.findEventById(tx, input.id);
  if (!source) {
    throw seasonalEventNotFound();
  }

  const existing = await seasonalRepository.findEventByKey(tx, input.key);
  if (existing) {
    throw duplicateSeasonalKey();
  }

  const created = await seasonalRepository.insertEvent(tx, {
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
    status: "scheduled",
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    multiplier: parseMultiplier(source.multiplier_json),
    linkedQuestIds: (source.linked_quest_ids as string[] | null) ?? [],
    linkedLeaderboardKey: source.linked_leaderboard_key,
  });

  if (!created) {
    throw seasonalEventNotFound();
  }

  await writeSeasonalAudit(tx, ctx, {
    action: "seasonal_event.cloned",
    targetId: created.id,
    before: toSeasonalEventDto(source),
    after: toSeasonalEventDto(created),
  });

  await seasonalRepository.applyTransitions(tx);
  const fresh = await seasonalRepository.findEventById(tx, created.id);
  return { data: toSeasonalEventDto(fresh ?? created) };
}

export async function updateSeasonalEvent(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: z.output<typeof updateSeasonalEventBodySchema>,
) {
  const before = await seasonalRepository.findEventById(tx, input.id);
  if (!before) {
    throw seasonalEventNotFound();
  }

  const updated = await seasonalRepository.updateEvent(tx, {
    id: input.id,
    ...(input.name != null ? { name: input.name } : {}),
    ...(input.status != null ? { status: input.status } : {}),
    ...(input.startsAt != null ? { startsAt: input.startsAt } : {}),
    ...(input.endsAt != null ? { endsAt: input.endsAt } : {}),
    ...(input.multiplier != null ? { multiplier: input.multiplier } : {}),
    ...(input.linkedQuestIds != null ? { linkedQuestIds: input.linkedQuestIds } : {}),
    ...(input.linkedLeaderboardKey !== undefined
      ? { linkedLeaderboardKey: input.linkedLeaderboardKey }
      : {}),
  });

  if (!updated) {
    throw seasonalEventNotFound();
  }

  await writeSeasonalAudit(tx, ctx, {
    action: "seasonal_event.updated",
    targetId: input.id,
    before: toSeasonalEventDto(before),
    after: toSeasonalEventDto(updated),
  });

  await seasonalRepository.applyTransitions(tx);
  const fresh = await seasonalRepository.findEventById(tx, input.id);
  return { data: toSeasonalEventDto(fresh ?? updated) };
}

export async function getMyActiveSeasonalEvent(tx: TenantTx) {
  await seasonalRepository.applyTransitions(tx);
  const events = await seasonalRepository.listActiveEvents(tx);
  const event = events[0];

  return {
    data: {
      event: event
        ? {
            key: event.key,
            name: event.name,
            endsAt: event.ends_at.toISOString(),
            xpMultiplier: parseMultiplier(event.multiplier_json).xpMultiplier,
          }
        : null,
    },
  };
}

export type ResolvedSeasonalMultiplier = {
  xpMultiplier: number;
  applyToStreakBonuses: boolean;
};

/**
 * Engine hook: the effective multiplier for XP accrual right now. When several
 * events overlap, the strongest multiplier wins.
 */
export async function resolveSeasonalMultiplier(tx: TenantTx): Promise<ResolvedSeasonalMultiplier> {
  await seasonalRepository.applyTransitions(tx);
  const events = await seasonalRepository.listActiveEvents(tx);

  let result: ResolvedSeasonalMultiplier = { xpMultiplier: 1, applyToStreakBonuses: true };
  for (const event of events) {
    const multiplier = parseMultiplier(event.multiplier_json);
    if (multiplier.xpMultiplier > result.xpMultiplier) {
      result = {
        xpMultiplier: multiplier.xpMultiplier,
        applyToStreakBonuses: multiplier.applyToStreakBonuses,
      };
    }
  }

  return result;
}
