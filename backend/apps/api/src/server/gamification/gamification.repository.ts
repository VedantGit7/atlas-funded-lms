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
      sourceEventId: string | null;
      idempotencyKey: string;
      eventType?: string;
    },
  ): Promise<boolean> {
    const id = randomUUID();
    const metadataJson = args.eventType ? JSON.stringify({ eventType: args.eventType }) : null;
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      insert into point_ledger (
        id,
        tenant_id,
        membership_id,
        points,
        reason_key,
        source_event_id,
        idempotency_key,
        metadata_json,
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
        ${metadataJson}::jsonb,
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
    // New rows record the source event type in metadata_json; legacy rows (written
    // before structured metadata) fall back to the historical reason_key prefix match.
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from point_ledger
      where membership_id = ${args.membershipId}::uuid
        and (
          metadata_json ->> 'eventType' = ${args.eventType}
          or (metadata_json is null and reason_key like ${`${args.eventType}%`})
        )
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

  async upsertTenantGamificationConfig(tx: TenantTx, gamificationJson: unknown) {
    await tx.$executeRaw`
      insert into tenant_config (
        id,
        tenant_id,
        config_json,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        app.current_tenant_id(),
        jsonb_build_object('gamification', ${JSON.stringify(gamificationJson)}::jsonb),
        now(),
        now()
      )
      on conflict (tenant_id)
      do update set
        config_json = jsonb_set(
          coalesce(tenant_config.config_json, '{}'::jsonb),
          '{gamification}',
          ${JSON.stringify(gamificationJson)}::jsonb
        ),
        updated_at = now()
    `;
  },

  async listLedgerForMembership(
    tx: TenantTx,
    args: {
      membershipId: string;
      limit: number;
      cursor?: { occurredAt: string; id: string };
    },
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        points: number;
        reason_key: string;
        event_type: string | null;
        occurred_at: Date;
      }>
    >`
      select
        id::text,
        points,
        reason_key,
        metadata_json->>'eventType' as event_type,
        occurred_at
      from point_ledger
      where membership_id = ${args.membershipId}::uuid
        and (
          ${args.cursor?.occurredAt ?? null}::timestamptz is null
          -- Cursor timestamps round-trip through JS Dates (millisecond precision),
          -- so compare at millisecond precision to avoid skipping rows.
          or (date_trunc('milliseconds', occurred_at), id) < (
            ${args.cursor?.occurredAt ?? null}::timestamptz,
            ${args.cursor?.id ?? null}::uuid
          )
        )
      order by occurred_at desc, id desc
      limit ${args.limit + 1}
    `;
    return rows;
  },

  async listBadgeAwardHistory(
    tx: TenantTx,
    args: {
      limit: number;
      badgeId?: string;
      membershipId?: string;
      cursor?: { awardedAt: string; id: string };
    },
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        badge_id: string;
        badge_key: string;
        badge_name: string;
        membership_id: string;
        member_label: string | null;
        awarded_at: Date;
        source_event_id: string | null;
      }>
    >`
      select
        ba.id::text,
        ba.badge_id::text,
        b.key as badge_key,
        b.name as badge_name,
        ba.membership_id::text,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as member_label,
        ba.awarded_at,
        ba.source_event_id::text
      from badge_awards ba
      inner join badges b on b.id = ba.badge_id
      inner join memberships m on m.id = ba.membership_id
      left join member_profiles mp
        on mp.tenant_id = m.tenant_id
       and mp.membership_id = m.id
       and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where (${args.badgeId ?? null}::uuid is null or ba.badge_id = ${args.badgeId ?? null}::uuid)
        and (
          ${args.membershipId ?? null}::uuid is null
          or ba.membership_id = ${args.membershipId ?? null}::uuid
        )
        and (
          ${args.cursor?.awardedAt ?? null}::timestamptz is null
          -- Millisecond precision: cursor values round-trip through JS Dates.
          or (date_trunc('milliseconds', ba.awarded_at), ba.id) < (
            ${args.cursor?.awardedAt ?? null}::timestamptz,
            ${args.cursor?.id ?? null}::uuid
          )
        )
      order by ba.awarded_at desc, ba.id desc
      limit ${args.limit + 1}
    `;
    return rows;
  },

  async deleteBadgeAward(
    tx: TenantTx,
    args: { badgeId: string; membershipId: string },
  ): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      delete from badge_awards
      where badge_id = ${args.badgeId}::uuid
        and membership_id = ${args.membershipId}::uuid
      returning id::text
    `;
    return rows.length > 0;
  },

  async countBadgesByStatus(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ status: string; count: number }>>`
      select status::text, count(*)::int as count
      from badges
      group by status
    `;
    return rows;
  },

  async countLeaderboardsByStatus(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ status: string; count: number }>>`
      select status::text, count(*)::int as count
      from leaderboard_definitions
      group by status
    `;
    return rows;
  },

  async countAwardsSince(tx: TenantTx, sinceIso: string) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from badge_awards
      where awarded_at >= ${sinceIso}::timestamptz
    `;
    return rows[0]?.count ?? 0;
  },

  async countActiveStreaks(tx: TenantTx, sinceDate: string) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from streak_states
      where current_count > 0
        and last_activity_date >= ${sinceDate}::date
    `;
    return rows[0]?.count ?? 0;
  },

  async countGamificationProfiles(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ count: number }>>`
      select count(*)::int as count
      from gamification_profiles
    `;
    return rows[0]?.count ?? 0;
  },

  async sumLedgerPointsSince(tx: TenantTx, sinceIso: string) {
    const rows = await tx.$queryRaw<Array<{ total: number | null }>>`
      select coalesce(sum(points), 0)::int as total
      from point_ledger
      where occurred_at >= ${sinceIso}::timestamptz
    `;
    return rows[0]?.total ?? 0;
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

  async listTopMembershipsByLedgerPoints(
    tx: TenantTx,
    args: {
      limit: number;
      timezone: string;
      startDate: string;
      endDate: string;
      courseId?: string;
    },
  ) {
    if (args.courseId) {
      const rows = await tx.$queryRaw<Array<{ membership_id: string; xp_total: number }>>`
        select pl.membership_id::text, coalesce(sum(pl.points), 0)::int as xp_total
        from point_ledger pl
        inner join enrollments le
          on le.membership_id = pl.membership_id
          and le.course_id = ${args.courseId}::uuid
        where (pl.occurred_at at time zone ${args.timezone})::date >= ${args.startDate}::date
          and (pl.occurred_at at time zone ${args.timezone})::date < ${args.endDate}::date
        group by pl.membership_id
        order by xp_total desc, pl.membership_id asc
        limit ${args.limit}
      `;
      return rows;
    }

    const rows = await tx.$queryRaw<Array<{ membership_id: string; xp_total: number }>>`
      select pl.membership_id::text, coalesce(sum(pl.points), 0)::int as xp_total
      from point_ledger pl
      where (pl.occurred_at at time zone ${args.timezone})::date >= ${args.startDate}::date
        and (pl.occurred_at at time zone ${args.timezone})::date < ${args.endDate}::date
      group by pl.membership_id
      order by xp_total desc, pl.membership_id asc
      limit ${args.limit}
    `;
    return rows;
  },

  /** Daily XP totals for one member across a date window (for the activity heatmap). */
  async sumDailyLedgerForMembership(
    tx: TenantTx,
    args: { membershipId: string; timezone: string; startDate: string; endDate: string },
  ) {
    const rows = await tx.$queryRaw<Array<{ day: string; xp: number }>>`
      select
        (occurred_at at time zone ${args.timezone})::date::text as day,
        coalesce(sum(points), 0)::int as xp
      from point_ledger
      where membership_id = ${args.membershipId}::uuid
        and (occurred_at at time zone ${args.timezone})::date >= ${args.startDate}::date
        and (occurred_at at time zone ${args.timezone})::date < ${args.endDate}::date
      group by 1
      order by 1 asc
    `;
    return rows;
  },

  /** Weekly XP for the member plus their standing among all members with weekly XP. */
  async weeklyXpStanding(
    tx: TenantTx,
    args: { membershipId: string; timezone: string; startDate: string; endDate: string },
  ) {
    const rows = await tx.$queryRaw<Array<{ mine: number; ranked: number; below: number }>>`
      with weekly as (
        select membership_id, sum(points)::int as pts
        from point_ledger
        where (occurred_at at time zone ${args.timezone})::date >= ${args.startDate}::date
          and (occurred_at at time zone ${args.timezone})::date < ${args.endDate}::date
        group by membership_id
      ),
      mine as (
        select coalesce(
          (select pts from weekly where membership_id = ${args.membershipId}::uuid),
          0
        ) as pts
      )
      select
        (select pts from mine) as mine,
        (select count(*)::int from weekly) as ranked,
        (select count(*)::int from weekly w where w.pts < (select pts from mine)) as below
    `;
    return rows[0] ?? { mine: 0, ranked: 0, below: 0 };
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

  async listSpacesForMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ space_id: string }>>`
      select space_id::text
      from group_memberships
      where membership_id = ${membershipId}::uuid
    `;
    return rows.map((row) => row.space_id);
  },

  async findGroupStreak(
    tx: TenantTx,
    args: { spaceId: string; streakKey: string },
  ) {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        current_count: number;
        longest_count: number;
        last_activity_period: string | null;
      }>
    >`
      select
        id::text,
        current_count,
        longest_count,
        last_activity_period
      from group_streak_states
      where space_id = ${args.spaceId}::uuid
        and streak_key = ${args.streakKey}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async upsertGroupStreak(
    tx: TenantTx,
    args: {
      tenantId: string;
      spaceId: string;
      streakKey: string;
      currentCount: number;
      longestCount: number;
      lastActivityPeriod: string;
    },
  ) {
    await tx.$executeRaw`
      insert into group_streak_states (
        id,
        tenant_id,
        space_id,
        streak_key,
        current_count,
        longest_count,
        last_activity_period,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.spaceId}::uuid,
        ${args.streakKey},
        ${args.currentCount},
        ${args.longestCount},
        ${args.lastActivityPeriod},
        now()
      )
      on conflict (tenant_id, space_id, streak_key)
      do update set
        current_count = excluded.current_count,
        longest_count = excluded.longest_count,
        last_activity_period = excluded.last_activity_period,
        updated_at = now()
    `;
  },

  async listTopMembershipsByLedgerPointsForGroup(
    tx: TenantTx,
    args: {
      limit: number;
      timezone: string;
      startDate: string;
      endDate: string;
      spaceId: string;
    },
  ) {
    const rows = await tx.$queryRaw<Array<{ membership_id: string; xp_total: number }>>`
      select pl.membership_id::text, coalesce(sum(pl.points), 0)::int as xp_total
      from point_ledger pl
      inner join group_memberships gm
        on gm.membership_id = pl.membership_id
        and gm.space_id = ${args.spaceId}::uuid
      where (pl.occurred_at at time zone ${args.timezone})::date >= ${args.startDate}::date
        and (pl.occurred_at at time zone ${args.timezone})::date < ${args.endDate}::date
      group by pl.membership_id
      order by xp_total desc, pl.membership_id asc
      limit ${args.limit}
    `;
    return rows;
  },

  async listTopProfilesByXpForGroup(
    tx: TenantTx,
    args: { limit: number; spaceId: string },
  ) {
    const rows = await tx.$queryRaw<Array<{ membership_id: string; xp_total: number }>>`
      select gp.membership_id::text, gp.xp_total
      from gamification_profiles gp
      inner join group_memberships gm
        on gm.membership_id = gp.membership_id
        and gm.space_id = ${args.spaceId}::uuid
      order by gp.xp_total desc, gp.membership_id asc
      limit ${args.limit}
    `;
    return rows;
  },

  async findTenantDisplayName(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ display_name: string }>>`
      select display_name
      from tenants
      limit 1
    `;
    return rows[0]?.display_name ?? "Academy";
  },

  async readTenantHallOfFameConfig(tx: TenantTx) {
    const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
      select config_json
      from tenant_config
      limit 1
    `;

    const configJson = rows[0]?.config_json as
      | { community?: { hallOfFame?: { recognitionSpaceSlug?: string; leaderboardKey?: string } } }
      | undefined;

    return configJson?.community?.hallOfFame ?? {};
  },

  async upsertTenantHallOfFameConfig(
    tx: TenantTx,
    hallOfFame: { recognitionSpaceSlug?: string; leaderboardKey?: string },
  ) {
    await tx.$executeRaw`
      insert into tenant_config (
        id,
        tenant_id,
        config_json,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        app.current_tenant_id(),
        jsonb_build_object(
          'community',
          jsonb_build_object('hallOfFame', ${JSON.stringify(hallOfFame)}::jsonb)
        ),
        now(),
        now()
      )
      on conflict (tenant_id)
      do update set
        config_json = jsonb_set(
          coalesce(tenant_config.config_json, '{}'::jsonb),
          '{community,hallOfFame}',
          ${JSON.stringify(hallOfFame)}::jsonb
        ),
        updated_at = now()
    `;
  },

  async findBadgeAwardForMembership(tx: TenantTx, args: { badgeId: string; membershipId: string }) {
    const rows = await tx.$queryRaw<BadgeAwardRow[]>`
      select badge_id::text, membership_id::text, awarded_at
      from badge_awards
      where badge_id = ${args.badgeId}::uuid
        and membership_id = ${args.membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
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
