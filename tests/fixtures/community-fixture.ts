import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  learnerCtx,
  type CourseAuthoringFixture,
} from "./course-authoring-fixture";

export type CommunityFixture = CourseAuthoringFixture & {
  tenantSpaceId: string;
  privateSpaceId: string;
  hallOfFameSpaceId: string;
  hallOfFameLeaderboardId: string;
};

export async function seedCommunityEntitlement(fixture: CommunityFixture) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into entitlements (
        id,
        tenant_id,
        key,
        value_json,
        source,
        starts_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        'community.enable',
        'true'::jsonb,
        'test-fixture',
        now(),
        null,
        now(),
        now()
      )
      on conflict (tenant_id, key) do update set
        value_json = excluded.value_json,
        updated_at = now()
    `;
  });
}

export async function seedPrivateSpacesEntitlement(fixture: CommunityFixture) {
  await withTenantTx(authoringTenantTx(fixture), async (tx) => {
    await tx.$executeRaw`
      insert into entitlements (
        id,
        tenant_id,
        key,
        value_json,
        source,
        starts_at,
        expires_at,
        created_at,
        updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        'community.private_spaces.enable',
        'true'::jsonb,
        'test-fixture',
        now(),
        null,
        now(),
        now()
      )
      on conflict (tenant_id, key) do update set
        value_json = excluded.value_json,
        updated_at = now()
    `;
  });
}

export async function createCommunityFixture(): Promise<CommunityFixture> {
  const base = await createCourseAuthoringFixture();
  const tenantSpaceId = randomUUID();
  const privateSpaceId = randomUUID();
  const hallOfFameSpaceId = randomUUID();
  const hallOfFameLeaderboardId = randomUUID();
  const runId = randomUUID().slice(0, 8);

  await seedCommunityEntitlement(base as CommunityFixture);
  await seedPrivateSpacesEntitlement(base as CommunityFixture);

  await withTenantTx(authoringTenantTx(base), async (tx) => {
    await tx.$executeRaw`
      insert into tenant_config (id, tenant_id, config_json, created_at, updated_at)
      values (
        ${randomUUID()}::uuid,
        ${base.tenantId}::uuid,
        ${JSON.stringify({
          community: {
            hallOfFame: {
              recognitionSpaceSlug: `hof-${runId}`,
              leaderboardKey: `hof-board-${runId}`,
            },
          },
        })}::jsonb,
        now(),
        now()
      )
      on conflict (tenant_id) do update set
        config_json = excluded.config_json,
        updated_at = now()
    `;

    await tx.$executeRaw`
      insert into community_spaces (
        id, tenant_id, slug, name, visibility, created_at, updated_at
      )
      values
        (
          ${tenantSpaceId}::uuid,
          ${base.tenantId}::uuid,
          ${`general-${runId}`},
          'General',
          'TENANT'::"Visibility",
          now(),
          now()
        ),
        (
          ${privateSpaceId}::uuid,
          ${base.tenantId}::uuid,
          ${`private-${runId}`},
          'Private Space',
          'PRIVATE'::"Visibility",
          now(),
          now()
        ),
        (
          ${hallOfFameSpaceId}::uuid,
          ${base.tenantId}::uuid,
          ${`hof-${runId}`},
          'Hall of Fame',
          'TENANT'::"Visibility",
          now(),
          now()
        )
    `;

    await tx.$executeRaw`
      insert into group_memberships (
        id, tenant_id, space_id, membership_id, role_key, joined_at
      )
      values (
        ${randomUUID()}::uuid,
        ${base.tenantId}::uuid,
        ${tenantSpaceId}::uuid,
        ${base.learnerMembershipId}::uuid,
        'member',
        now()
      )
    `;

    await tx.$executeRaw`
      insert into leaderboard_definitions (
        id, tenant_id, key, name, metric_key, window_key, config_json, status, created_at, updated_at
      )
      values (
        ${hallOfFameLeaderboardId}::uuid,
        ${base.tenantId}::uuid,
        ${`hof-board-${runId}`},
        'Hall of Fame Board',
        'xp_total',
        'all_time',
        '{"scopeType":"tenant","privacyMode":"anonymous_rank","maxEntries":10}'::jsonb,
        'ACTIVE'::"EntityStatus",
        now(),
        now()
      )
    `;
  });

  return {
    ...base,
    tenantSpaceId,
    privateSpaceId,
    hallOfFameSpaceId,
    hallOfFameLeaderboardId,
  };
}

export { adminCtx, authoringTenantTx, learnerCtx };
