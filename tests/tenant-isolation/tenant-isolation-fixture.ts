import { randomUUID } from "node:crypto";
import { withPlatformScope, withTenantTx } from "@atlas/db";
import { buildTestTenantSlug } from "../../scripts/db/test-tenant-slugs.mjs";

export type IsolationTenantFixture = {
  tenantId: string;
  slug: string;
  principalId: string;
  membershipId: string;
  courseId: string;
  courseSlug: string;
  searchEntryId: string;
  communitySpaceId: string;
  communitySlug: string;
};

export type TenantIsolationFixture = {
  tenantA: IsolationTenantFixture;
  tenantB: IsolationTenantFixture;
};

function suffix(): string {
  return randomUUID().slice(0, 8);
}

function makeTenant(label: "a" | "b", runId: string): IsolationTenantFixture {
  return {
    tenantId: randomUUID(),
    slug: buildTestTenantSlug(`sprint0-${label}`, runId),
    principalId: randomUUID(),
    membershipId: randomUUID(),
    courseId: randomUUID(),
    courseSlug: `course-${label}-${runId}`,
    searchEntryId: randomUUID(),
    communitySpaceId: randomUUID(),
    communitySlug: `community-${label}-${runId}`,
  };
}

export function tenantCtx(fixture: IsolationTenantFixture, requestId = randomUUID()) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.membershipId,
    requestId,
  };
}

export async function createTenantIsolationFixture(): Promise<TenantIsolationFixture> {
  const runId = suffix();

  const fixture: TenantIsolationFixture = {
    tenantA: makeTenant("a", runId),
    tenantB: makeTenant("b", runId),
  };

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      touchedTenantIds: [fixture.tenantA.tenantId, fixture.tenantB.tenantId],
    },
    "Creating Sprint 0 tenant isolation fixture",
    async (tx) => {
      for (const tenant of [fixture.tenantA, fixture.tenantB]) {
        await tx.$executeRaw`
          INSERT INTO tenants (
            id,
            slug,
            display_name,
            state,
            created_at,
            updated_at
          )
          VALUES (
            ${tenant.tenantId}::uuid,
            ${tenant.slug},
            ${`Sprint 0 ${tenant.slug}`},
            'ACTIVE',
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO auth_principals (
            id,
            supabase_user_id,
            email,
            email_normalized,
            global_status,
            created_at,
            updated_at
          )
          VALUES (
            ${tenant.principalId}::uuid,
            ${randomUUID()}::uuid,
            ${`${tenant.slug}@example.test`},
            ${`${tenant.slug}@example.test`},
            'active',
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO memberships (
            id,
            tenant_id,
            auth_principal_id,
            status,
            joined_at,
            created_at,
            updated_at
          )
          VALUES (
            ${tenant.membershipId}::uuid,
            ${tenant.tenantId}::uuid,
            ${tenant.principalId}::uuid,
            'ACTIVE',
            now(),
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO courses (
            id,
            tenant_id,
            slug,
            title,
            status,
            created_by_membership_id,
            created_at,
            updated_at
          )
          VALUES (
            ${tenant.courseId}::uuid,
            ${tenant.tenantId}::uuid,
            ${tenant.courseSlug},
            ${`Course ${tenant.courseSlug}`},
            'DRAFT',
            ${tenant.membershipId}::uuid,
            now(),
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO search_index_entries (
            id,
            tenant_id,
            source_context,
            source_type,
            source_id,
            title,
            body,
            visibility,
            access_json,
            updated_at
          )
          VALUES (
            ${tenant.searchEntryId}::uuid,
            ${tenant.tenantId}::uuid,
            'learning',
            'course',
            ${tenant.courseId}::uuid,
            ${`Search ${tenant.courseSlug}`},
            ${`Search body ${tenant.courseSlug}`},
            'TENANT',
            '{"requires":["course.read"]}'::jsonb,
            now()
          )
        `;

        await tx.$executeRaw`
          INSERT INTO community_spaces (
            id,
            tenant_id,
            slug,
            name,
            visibility,
            config_json,
            created_at,
            updated_at
          )
          VALUES (
            ${tenant.communitySpaceId}::uuid,
            ${tenant.tenantId}::uuid,
            ${tenant.communitySlug},
            ${`Community ${tenant.communitySlug}`},
            'TENANT',
            '{"posting":"members"}'::jsonb,
            now(),
            now()
          )
        `;
      }
    },
  );

  return fixture;
}

export async function readCourseSlugsAsTenant(tenant: IsolationTenantFixture): Promise<string[]> {
  return withTenantTx(tenantCtx(tenant), async (tx) => {
    const rows = await tx.$queryRaw<Array<{ slug: string }>>`
      SELECT slug
      FROM courses
      ORDER BY slug
    `;

    return rows.map((row) => row.slug);
  });
}
