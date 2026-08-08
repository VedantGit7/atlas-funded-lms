import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import type { QuestCriteria, QuestRewards, QuestStepProgress } from "./quest.schemas";

export type QuestDefinitionRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  status: string;
  quest_type: string;
  criteria_json: unknown;
  rewards_json: unknown;
  starts_at: Date | null;
  ends_at: Date | null;
  course_id: string | null;
};

export type QuestProgressRow = {
  id: string;
  quest_id: string;
  membership_id: string;
  status: string;
  progress_json: unknown;
  completed_at: Date | null;
};

export const questRepository = {
  async listQuests(tx: TenantTx) {
    const rows = await tx.$queryRaw<QuestDefinitionRow[]>`
      select
        id::text,
        key,
        name,
        description,
        status::text,
        quest_type,
        criteria_json,
        rewards_json,
        starts_at,
        ends_at,
        course_id::text
      from quest_definitions
      order by created_at asc
    `;
    return rows;
  },

  async listActiveQuests(tx: TenantTx, nowIso: string) {
    const rows = await tx.$queryRaw<QuestDefinitionRow[]>`
      select
        id::text,
        key,
        name,
        description,
        status::text,
        quest_type,
        criteria_json,
        rewards_json,
        starts_at,
        ends_at,
        course_id::text
      from quest_definitions
      where status = 'ACTIVE'
        and (starts_at is null or starts_at <= ${nowIso}::timestamptz)
        and (ends_at is null or ends_at >= ${nowIso}::timestamptz)
      order by created_at asc
    `;
    return rows;
  },

  async findQuestById(tx: TenantTx, id: string) {
    const rows = await tx.$queryRaw<QuestDefinitionRow[]>`
      select
        id::text,
        key,
        name,
        description,
        status::text,
        quest_type,
        criteria_json,
        rewards_json,
        starts_at,
        ends_at,
        course_id::text
      from quest_definitions
      where id = ${id}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async findQuestByKey(tx: TenantTx, key: string) {
    const rows = await tx.$queryRaw<QuestDefinitionRow[]>`
      select
        id::text,
        key,
        name,
        description,
        status::text,
        quest_type,
        criteria_json,
        rewards_json,
        starts_at,
        ends_at,
        course_id::text
      from quest_definitions
      where key = ${key}
      limit 1
    `;
    return rows[0] ?? null;
  },

  async insertQuest(
    tx: TenantTx,
    args: {
      tenantId: string;
      key: string;
      name: string;
      description: string | null;
      questType: string;
      criteria: QuestCriteria;
      rewards: QuestRewards;
      startsAt: string | null;
      endsAt: string | null;
      courseId: string | null;
      status: string;
    },
  ) {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into quest_definitions (
        id,
        tenant_id,
        key,
        name,
        description,
        status,
        quest_type,
        criteria_json,
        rewards_json,
        starts_at,
        ends_at,
        course_id,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${args.tenantId}::uuid,
        ${args.key},
        ${args.name},
        ${args.description},
        ${args.status}::"EntityStatus",
        ${args.questType},
        ${JSON.stringify(args.criteria)}::jsonb,
        ${JSON.stringify(args.rewards)}::jsonb,
        ${args.startsAt}::timestamptz,
        ${args.endsAt}::timestamptz,
        ${args.courseId}::uuid,
        now(),
        now()
      )
    `;
    return questRepository.findQuestById(tx, id);
  },

  async updateQuest(
    tx: TenantTx,
    args: {
      id: string;
      name?: string;
      description?: string | null;
      questType?: string;
      criteria?: QuestCriteria;
      rewards?: QuestRewards;
      startsAt?: string | null;
      endsAt?: string | null;
      courseId?: string | null;
      status?: string;
    },
  ) {
    const current = await questRepository.findQuestById(tx, args.id);
    if (!current) return null;

    await tx.$executeRaw`
      update quest_definitions
      set
        name = ${args.name ?? current.name},
        description = ${args.description !== undefined ? args.description : current.description},
        quest_type = ${args.questType ?? current.quest_type},
        criteria_json = ${JSON.stringify(args.criteria ?? current.criteria_json)}::jsonb,
        rewards_json = ${JSON.stringify(args.rewards ?? current.rewards_json)}::jsonb,
        starts_at = ${
          args.startsAt !== undefined ? args.startsAt : (current.starts_at?.toISOString() ?? null)
        }::timestamptz,
        ends_at = ${
          args.endsAt !== undefined ? args.endsAt : (current.ends_at?.toISOString() ?? null)
        }::timestamptz,
        course_id = ${args.courseId !== undefined ? args.courseId : current.course_id}::uuid,
        status = ${args.status ?? current.status}::"EntityStatus",
        updated_at = now()
      where id = ${args.id}::uuid
    `;

    return questRepository.findQuestById(tx, args.id);
  },

  async countProgressByQuest(tx: TenantTx) {
    const rows = await tx.$queryRaw<
      Array<{ quest_id: string; started: number; completed: number }>
    >`
      select
        quest_id::text,
        count(*)::int as started,
        count(*) filter (where status = 'completed')::int as completed
      from quest_progress
      group by quest_id
    `;
    return rows;
  },

  async findProgress(tx: TenantTx, args: { questId: string; membershipId: string }) {
    const rows = await tx.$queryRaw<QuestProgressRow[]>`
      select
        id::text,
        quest_id::text,
        membership_id::text,
        status,
        progress_json,
        completed_at
      from quest_progress
      where quest_id = ${args.questId}::uuid
        and membership_id = ${args.membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listProgressForMembership(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<QuestProgressRow[]>`
      select
        id::text,
        quest_id::text,
        membership_id::text,
        status,
        progress_json,
        completed_at
      from quest_progress
      where membership_id = ${membershipId}::uuid
    `;
    return rows;
  },

  async upsertProgress(
    tx: TenantTx,
    args: {
      tenantId: string;
      questId: string;
      membershipId: string;
      status: string;
      steps: QuestStepProgress[];
      completedAt: string | null;
    },
  ) {
    await tx.$executeRaw`
      insert into quest_progress (
        id,
        tenant_id,
        quest_id,
        membership_id,
        status,
        progress_json,
        completed_at,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${args.tenantId}::uuid,
        ${args.questId}::uuid,
        ${args.membershipId}::uuid,
        ${args.status},
        ${JSON.stringify({ steps: args.steps })}::jsonb,
        ${args.completedAt}::timestamptz,
        now(),
        now()
      )
      on conflict (tenant_id, quest_id, membership_id)
      do update set
        status = excluded.status,
        progress_json = excluded.progress_json,
        completed_at = excluded.completed_at,
        updated_at = now()
    `;
  },

  async hasBadgeAwardByKey(tx: TenantTx, args: { membershipId: string; badgeKey: string }) {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      select ba.id::text
      from badge_awards ba
      inner join badges b on b.id = ba.badge_id
      where ba.membership_id = ${args.membershipId}::uuid
        and b.key = ${args.badgeKey}
      limit 1
    `;
    return rows.length > 0;
  },
};
