import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { SeasonalMultiplier } from "./seasonal.schemas";

export type SeasonalEventRow = {
  id: string;
  key: string;
  name: string;
  status: string;
  starts_at: Date;
  ends_at: Date;
  multiplier_json: unknown;
  linked_quest_ids: unknown;
  linked_leaderboard_key: string | null;
};

export const seasonalRepository = {
  /**
   * Lazy lifecycle transitions (no cron): scheduled events whose window has
   * opened become active; scheduled/active events past their window end.
   * Called before any read that depends on effective status.
   */
  async applyTransitions(tx: TenantTx): Promise<void> {
    await tx.$executeRaw`
      update seasonal_events
      set status = 'active', updated_at = now()
      where status = 'scheduled'
        and starts_at <= now()
        and ends_at > now()
    `;
    await tx.$executeRaw`
      update seasonal_events
      set status = 'ended', updated_at = now()
      where status in ('scheduled', 'active')
        and ends_at <= now()
    `;
  },

  async listEvents(tx: TenantTx) {
    const rows = await tx.$queryRaw<SeasonalEventRow[]>`
      select
        id::text,
        key,
        name,
        status,
        starts_at,
        ends_at,
        multiplier_json,
        linked_quest_ids,
        linked_leaderboard_key
      from seasonal_events
      order by starts_at desc
    `;
    return rows;
  },

  async listActiveEvents(tx: TenantTx) {
    const rows = await tx.$queryRaw<SeasonalEventRow[]>`
      select
        id::text,
        key,
        name,
        status,
        starts_at,
        ends_at,
        multiplier_json,
        linked_quest_ids,
        linked_leaderboard_key
      from seasonal_events
      where status = 'active'
        and starts_at <= now()
        and ends_at > now()
      order by starts_at asc
    `;
    return rows;
  },

  async findEventById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<SeasonalEventRow[]>`
      select
        id::text,
        key,
        name,
        status,
        starts_at,
        ends_at,
        multiplier_json,
        linked_quest_ids,
        linked_leaderboard_key
      from seasonal_events
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findEventByKey(tx: TenantTx, key: string) {
    const rows = await tx.$queryRaw<SeasonalEventRow[]>`
      select
        id::text,
        key,
        name,
        status,
        starts_at,
        ends_at,
        multiplier_json,
        linked_quest_ids,
        linked_leaderboard_key
      from seasonal_events
      where key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertEvent(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      status: string;
      startsAt: string;
      endsAt: string;
      multiplier: SeasonalMultiplier;
      linkedQuestIds: string[];
      linkedLeaderboardKey: string | null;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into seasonal_events (
        id, tenant_id, key, name, status, starts_at, ends_at,
        multiplier_json, linked_quest_ids, linked_leaderboard_key,
        created_at, updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${args.status},
        ${args.startsAt}::timestamptz,
        ${args.endsAt}::timestamptz,
        ${JSON.stringify(args.multiplier)}::jsonb,
        ${JSON.stringify(args.linkedQuestIds)}::jsonb,
        ${args.linkedLeaderboardKey},
        now(),
        now()
      )
    `;
    return seasonalRepository.findEventById(tx, id);
  },

  async updateEvent(
    tx: TenantTx,
    args: {
      id: string;
      name?: string;
      status?: string;
      startsAt?: string;
      endsAt?: string;
      multiplier?: SeasonalMultiplier;
      linkedQuestIds?: string[];
      linkedLeaderboardKey?: string | null;
    },
  ) {
    const current = await seasonalRepository.findEventById(tx, args.id);
    if (!current) return null;

    await tx.$executeRaw`
      update seasonal_events
      set
        name = ${args.name ?? current.name},
        status = ${args.status ?? current.status},
        starts_at = ${args.startsAt ?? current.starts_at.toISOString()}::timestamptz,
        ends_at = ${args.endsAt ?? current.ends_at.toISOString()}::timestamptz,
        multiplier_json = ${JSON.stringify(args.multiplier ?? current.multiplier_json)}::jsonb,
        linked_quest_ids = ${JSON.stringify(
          args.linkedQuestIds ?? current.linked_quest_ids ?? [],
        )}::jsonb,
        linked_leaderboard_key = ${
          args.linkedLeaderboardKey !== undefined
            ? args.linkedLeaderboardKey
            : current.linked_leaderboard_key
        },
        updated_at = now()
      where id = ${args.id}::uuid
    `;

    return seasonalRepository.findEventById(tx, args.id);
  },
};
