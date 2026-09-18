// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { BadgeCriteria } from "./gamification.schemas";
import type { LeaderboardConfig } from "./gamification.types";

export type GamificationProfileRow = {
  id: string;
  membership_id: string;
  xp_total: number;
  level_key: string | null;
};

export type BadgeRow = {
  id: string;
  key: string;
  name: string;
  icon_key: string | null;
  criteria_json: unknown;
  status: string;
};

export type BadgeAwardRow = {
  badge_id: string;
  membership_id: string;
  awarded_at: Date;
};

export type StreakStateRow = {
  id: string;
  streak_key: string;
  current_count: number;
  longest_count: number;
  last_activity_date: Date | null;
};

export type LeaderboardRow = {
  id: string;
  key: string;
  name: string;
  metric_key: string;
  window_key: string;
  config_json: unknown;
  status: string;
};

export type LeaderboardSnapshotRow = {
  period_key: string;
  snapshot_json: unknown;
  calculated_at: Date;
};

function parseCriteria(value: unknown): BadgeCriteria {
  return value as BadgeCriteria;
}

function parseLeaderboardConfig(value: unknown): LeaderboardConfig {
  return value as LeaderboardConfig;
}

export const gamificationRepository = {
  async findProfileByMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<GamificationProfileRow[]>`
      select
        id::text,
        membership_id::text,
        xp_total,
        level_key
      from gamification_profiles
      where membership_id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertProfile(tx: TenantTx, args: { tenantId: string; membershipId: string }) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into gamification_profiles (
        id,
        tenant_id,
        membership_id,
        xp_total,
        level_key,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        0,
        'level_1',
        now(),
        now()
      )
      on conflict (tenant_id, membership_id) do nothing
    `;

    return gamificationRepository.findProfileByMembership(tx, args.membershipId);
  },

  async updateProfileXp(
    tx: TenantTx,
    args: { membershipId: string; xpTotal: number; levelKey: string },
  ) {
    await tx.$executeRaw`
      update gamification_profiles
      set
        xp_total = ${args.xpTotal},
        level_key = ${args.levelKey},
        updated_at = now()
      where membership_id = ${args.membershipId}::uuid
    `;
  },

  async insertPointLedger(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      points: number;
      reasonKey: string;
      sourceEventId: string;
      idempotencyKey: string;
    },
  ): Promise<boolean> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into point_ledger (
        id,
        tenant_id,
        membership_id,
        points,
        reason_key,
        source_event_id,
        idempotency_key,
        occurred_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.points},
        ${args.reasonKey},
        ${args.sourceEventId}::uuid,
        ${args.idempotencyKey},
        now()
      )
      on conflict (tenant_id, idempotency_key) do nothing
      returning id::text
    `;

    return rows.length > 0;
  },

  async sumLedgerPointsForMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ total: number | null }>>`
      select coalesce(sum(points), 0)::int as total
      from point_ledger
      where membership_id = ${membershipId}::uuid
    `;
    return rows[0]?.total ?? 0;
  },

  async countLedgerByEventType(tx: TenantTx, args: { membershipId: string; eventType: string }) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from point_ledger
      where membership_id = ${args.membershipId}::uuid
        and reason_key like ${`${args.eventType}%`}
    `;
    return rows[0]?.count ?? 0;
  },

  async listBadges(tx: TenantTx) {
    const rows = await tx.$queryRaw<BadgeRow[]>`
      select
        id::text,
        key,
        name,
        icon_key,
        criteria_json,
        status::text
      from badges
      order by created_at asc
    `;
    return rows;
  },

  async findBadgeById(tx: TenantTx, badgeId: string) {
    const rows = await tx.$queryRaw<BadgeRow[]>`
      select
        id::text,
        key,
        name,
        icon_key,
        criteria_json,
        status::text
      from badges
      where id = ${badgeId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findBadgeByKey(tx: TenantTx, key: string) {
    const rows = await tx.$queryRaw<BadgeRow[]>`
      select
        id::text,
        key,
        name,
        icon_key,
        criteria_json,
        status::text
      from badges
      where key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertBadge(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      iconKey?: string | null;
      criteria: BadgeCriteria;
      status: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into badges (
        id,
        tenant_id,
        key,
        name,
        icon_key,
        criteria_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${args.iconKey ?? null},
        ${JSON.stringify(args.criteria)}::jsonb,
        ${args.status}::"EntityStatus",
        now(),
        now()
      )
    `;
    return gamificationRepository.findBadgeById(tx, id);
  },

  async updateBadge(
    tx: TenantTx,
    args: {
      id: string;
      name?: string;
      iconKey?: string | null;
      criteria?: BadgeCriteria;
      status?: string;
    },
  ) {
    const current = await gamificationRepository.findBadgeById(tx, args.id);
    if (!current) return null;

    await tx.$executeRaw`
      update badges
      set
        name = ${args.name ?? current.name},
        icon_key = ${args.iconKey !== undefined ? args.iconKey : current.icon_key},
        criteria_json = ${JSON.stringify(args.criteria ?? parseCriteria(current.criteria_json))}::jsonb,
        status = ${args.status ?? current.status}::"EntityStatus",
        updated_at = now()
      where id = ${args.id}::uuid
    `;

    return gamificationRepository.findBadgeById(tx, args.id);
  },

  async listBadgeAwardsForMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<BadgeAwardRow[]>`
      select
        badge_id::text,
        membership_id::text,
        awarded_at
      from badge_awards
      where membership_id = ${membershipId}::uuid
    `;
    return rows;
  },

  async insertBadgeAward(
    tx: TenantTx,
    args: {
      tenantId: string;
      badgeId: string;
      membershipId: string;
      sourceEventId?: string | null;
    },
  ): Promise<boolean> {
    const id = randomUUID();
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into badge_awards (
        id,
        tenant_id,
        badge_id,
        membership_id,
        awarded_at,
        source_event_id
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.badgeId}::uuid,
        ${args.membershipId}::uuid,
        now(),
        ${args.sourceEventId ?? null}::uuid
      )
      on conflict (tenant_id, badge_id, membership_id) do nothing
      returning id::text
    `;
    return rows.length > 0;
  },

  async findStreak(tx: TenantTx, args: { membershipId: string; streakKey: string }) {
    const rows = await tx.$queryRaw<StreakStateRow[]>`
      select
        id::text,
        streak_key,
        current_count,
        longest_count,
        last_activity_date
      from streak_states
      where membership_id = ${args.membershipId}::uuid
        and streak_key = ${args.streakKey}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listStreaks(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<StreakStateRow[]>`
      select
        id::text,
        streak_key,
        current_count,
        longest_count,
        last_activity_date
      from streak_states
      where membership_id = ${membershipId}::uuid
      order by streak_key asc
    `;
    return rows;
  },

  async upsertStreak(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      streakKey: string;
      currentCount: number;
      longestCount: number;
      lastActivityDate: string;
    },
  ) {
    const existing = await gamificationRepository.findStreak(tx, {
      membershipId: args.membershipId,
      streakKey: args.streakKey,
    });

    if (existing) {
      await tx.$executeRaw`
        update streak_states
        set
          current_count = ${args.currentCount},
          longest_count = ${args.longestCount},
          last_activity_date = ${args.lastActivityDate}::date,
          updated_at = now()
        where id = ${existing.id}::uuid
      `;
      return;
    }

    await tx.$executeRaw`
      insert into streak_states (
        id,
        tenant_id,
        membership_id,
        streak_key,
        current_count,
        longest_count,
        last_activity_date,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.membershipId}::uuid,
        ${args.streakKey},
        ${args.currentCount},
        ${args.longestCount},
        ${args.lastActivityDate}::date,
        now()
      )
    `;
  },

  async countAvailableFreezes(tx: TenantTx, args: { membershipId: string; streakKey: string }) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from streak_freezes
      where membership_id = ${args.membershipId}::uuid
        and streak_key = ${args.streakKey}
        and status = 'available'
    `;
    return rows[0]?.count ?? 0;
  },

  async findFreezeUsedForDate(
    tx: TenantTx,
    args: { membershipId: string; streakKey: string; usedForDate: string },
  ) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from streak_freezes
      where membership_id = ${args.membershipId}::uuid
        and streak_key = ${args.streakKey}
        and used_for_date = ${args.usedForDate}::date
      limit 1
    `;
    return rows[0] ?? null;
  },

  async consumeAvailableFreeze(
    tx: TenantTx,
    args: { membershipId: string; streakKey: string; usedForDate: string },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      update streak_freezes
      set
        status = 'used',
        used_for_date = ${args.usedForDate}::date,
        updated_at = now()
      where id = (
        select id
        from streak_freezes
        where membership_id = ${args.membershipId}::uuid
          and streak_key = ${args.streakKey}
          and status = 'available'
        order by created_at asc
        limit 1
        for update
      )
      returning id::text
    `;
    return rows.length > 0;
  },

  async seedFreezesIfMissing(
    tx: TenantTx,
    args: {
      tenantId: string;
      membershipId: string;
      streakKey: string;
      inventory: number;
    },
  ) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from streak_freezes
      where membership_id = ${args.membershipId}::uuid
        and streak_key = ${args.streakKey}
    `;

    const existing = rows[0]?.count ?? 0;
    const toCreate = Math.max(0, args.inventory - existing);

    for (let index = 0; index < toCreate; index += 1) {
      await tx.$executeRaw`
        insert into streak_freezes (
          id,
          tenant_id,
          membership_id,
          streak_key,
          status,
          created_at,
          updated_at
        )
        values (
          ${randomUUID()}::uuid,
          ${args.tenantId}::uuid,
          ${args.membershipId}::uuid,
          ${args.streakKey},
          'available',
          now(),
          now()
        )
      `;
    }
  },

  async listLeaderboards(tx: TenantTx) {
    const rows = await tx.$queryRaw<LeaderboardRow[]>`
      select
        id::text,
        key,
        name,
        metric_key,
        window_key,
        config_json,
        status::text
      from leaderboard_definitions
      order by created_at asc
    `;
    return rows;
  },

  async findLeaderboardById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<LeaderboardRow[]>`
      select
        id::text,
        key,
        name,
        metric_key,
        window_key,
        config_json,
        status::text
      from leaderboard_definitions
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findLeaderboardByKey(tx: TenantTx, key: string) {
    const rows = await tx.$queryRaw<LeaderboardRow[]>`
      select
        id::text,
        key,
        name,
        metric_key,
        window_key,
        config_json,
        status::text
      from leaderboard_definitions
      where key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertLeaderboard(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      metricKey: string;
      windowKey: string;
      config: LeaderboardConfig;
      status: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into leaderboard_definitions (
        id,
        tenant_id,
        key,
        name,
        metric_key,
        window_key,
        config_json,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${args.metricKey},
        ${args.windowKey},
        ${JSON.stringify(args.config)}::jsonb,
        ${args.status}::"EntityStatus",
        now(),
        now()
      )
    `;
    return gamificationRepository.findLeaderboardById(tx, id);
  },

  async updateLeaderboard(
    tx: TenantTx,
    args: {
      id: string;
      name?: string;
      windowKey?: string;
      config?: LeaderboardConfig;
      status?: string;
    },
  ) {
    const current = await gamificationRepository.findLeaderboardById(tx, args.id);
    if (!current) return null;

    await tx.$executeRaw`
      update leaderboard_definitions
      set
        name = ${args.name ?? current.name},
        window_key = ${args.windowKey ?? current.window_key},
        config_json = ${JSON.stringify(args.config ?? parseLeaderboardConfig(current.config_json))}::jsonb,
        status = ${args.status ?? current.status}::"EntityStatus",
        updated_at = now()
      where id = ${args.id}::uuid
    `;

    return gamificationRepository.findLeaderboardById(tx, args.id);
  },

  async upsertLeaderboardSnapshot(
    tx: TenantTx,
    args: {
      tenantId: string;
      leaderboardId: string;
      periodKey: string;
      snapshotJson: unknown;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into leaderboard_snapshots (
        id,
        tenant_id,
        leaderboard_id,
        period_key,
        snapshot_json,
        calculated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.leaderboardId}::uuid,
        ${args.periodKey},
        ${JSON.stringify(args.snapshotJson)}::jsonb,
        now()
      )
      on conflict (tenant_id, leaderboard_id, period_key)
      do update set
        snapshot_json = excluded.snapshot_json,
        calculated_at = excluded.calculated_at
    `;
  },

  async findLeaderboardSnapshot(tx: TenantTx, args: { leaderboardId: string; periodKey: string }) {
    const rows = await tx.$queryRaw<LeaderboardSnapshotRow[]>`
      select period_key, snapshot_json, calculated_at
      from leaderboard_snapshots
      where leaderboard_id = ${args.leaderboardId}::uuid
        and period_key = ${args.periodKey}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listTopProfilesByXp(tx: TenantTx, args: { limit: number; courseId?: string }) {
    if (args.courseId) {
      const rows = await tx.$queryRaw<Array<{ membership_id: string; xp_total: number }>>`
        select gp.membership_id::text, gp.xp_total
        from gamification_profiles gp
        inner join enrollments le
          on le.membership_id = gp.membership_id
          and le.course_id = ${args.courseId}::uuid
        order by gp.xp_total desc, gp.membership_id asc
        limit ${args.limit}
      `;
      return rows;
    }

    const rows = await tx.$queryRaw<Array<{ membership_id: string; xp_total: number }>>`
      select membership_id::text, xp_total
      from gamification_profiles
      order by xp_total desc, membership_id asc
      limit ${args.limit}
    `;
    return rows;
  },

  async countBadgeAwardsForMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from badge_awards
      where membership_id = ${membershipId}::uuid
    `;
    return rows[0]?.count ?? 0;
  },

  async membershipIsActive(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ status: string }>>`
      select status::text
      from memberships
      where id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0]?.status === "ACTIVE";
  },
};

export function toBadgeDto(row: BadgeRow, award?: BadgeAwardRow | null) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    iconKey: row.icon_key,
    criteria: parseCriteria(row.criteria_json),
    status: row.status as "ACTIVE" | "INACTIVE",
    ...(award
      ? { awarded: true, awardedAt: award.awarded_at.toISOString() }
      : { awarded: false, awardedAt: null }),
  };
}

export function toLeaderboardDto(row: LeaderboardRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    metricKey: "xp_total" as const,
    windowKey: row.window_key as "all_time" | "weekly" | "monthly",
    config: parseLeaderboardConfig(row.config_json),
    status: row.status as "ACTIVE" | "INACTIVE",
  };
}
