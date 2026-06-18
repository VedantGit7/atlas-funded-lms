import { randomUUID } from "node:crypto";
import {
  assignDefaultLearnerRole,
  assignSystemRoleToMembership,
  seedTenantAccessControl,
} from "@atlas/access";
import { withTenantTx } from "@atlas/db";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../tenant-isolation/tenant-isolation-fixture";

export type LessonEngineFixture = {
  tenantId: string;
  slug: string;
  instructorMembershipId: string;
  instructorPrincipalId: string;
  learnerMembershipId: string;
  learnerPrincipalId: string;
  otherInstructorMembershipId: string;
  otherInstructorPrincipalId: string;
  draftCourseId: string;
  draftModuleId: string;
  draftLessonId: string;
  publishedCourseId: string;
  publishedModuleId: string;
  publishedLessonId: string;
};

async function insertMembership(args: {
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> };
  tenantId: string;
  membershipId: string;
  principalId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into auth_principals (
      id, supabase_user_id, email, email_normalized, global_status, created_at, updated_at
    )
    values (
      ${args.principalId}::uuid,
      ${randomUUID()}::uuid,
      ${`member-${args.membershipId.slice(0, 8)}@example.test`},
      ${`member-${args.membershipId.slice(0, 8)}@example.test`},
      'active',
      now(),
      now()
    )
    on conflict do nothing
  `;

  await args.tx.$executeRaw`
    insert into memberships (
      id, tenant_id, auth_principal_id, status, joined_at, created_at, updated_at
    )
    values (
      ${args.membershipId}::uuid,
      ${args.tenantId}::uuid,
      ${args.principalId}::uuid,
      'ACTIVE',
      now(),
      now(),
      now()
    )
  `;
}

export async function createLessonEngineFixture(): Promise<LessonEngineFixture> {
  const base = await createTenantIsolationFixture();
  const tenant = base.tenantA;
  const runId = randomUUID().slice(0, 8);

  const fixture: LessonEngineFixture = {
    tenantId: tenant.tenantId,
    slug: tenant.slug,
    instructorMembershipId: randomUUID(),
    instructorPrincipalId: randomUUID(),
    learnerMembershipId: randomUUID(),
    learnerPrincipalId: randomUUID(),
    otherInstructorMembershipId: randomUUID(),
    otherInstructorPrincipalId: randomUUID(),
    draftCourseId: randomUUID(),
    draftModuleId: randomUUID(),
    draftLessonId: randomUUID(),
    publishedCourseId: randomUUID(),
    publishedModuleId: randomUUID(),
    publishedLessonId: randomUUID(),
  };

  await seedTenantAccessControl({
    tenantId: fixture.tenantId,
    requestId: randomUUID(),
  });

  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const member of [
      {
        membershipId: fixture.instructorMembershipId,
        principalId: fixture.instructorPrincipalId,
      },
      {
        membershipId: fixture.learnerMembershipId,
        principalId: fixture.learnerPrincipalId,
      },
      {
        membershipId: fixture.otherInstructorMembershipId,
        principalId: fixture.otherInstructorPrincipalId,
      },
    ]) {
      await insertMembership({ tx, tenantId: fixture.tenantId, ...member });
    }

    await assignSystemRoleToMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.instructorMembershipId,
      roleKey: "instructor",
      assignedByMembershipId: fixture.instructorMembershipId,
    });
    await assignSystemRoleToMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.otherInstructorMembershipId,
      roleKey: "instructor",
      assignedByMembershipId: fixture.otherInstructorMembershipId,
    });
    await assignDefaultLearnerRole({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.learnerMembershipId,
    });

    await tx.$executeRaw`
      insert into courses (id, tenant_id, slug, title, status, created_by_membership_id, created_at, updated_at)
      values
        (${fixture.draftCourseId}::uuid, ${fixture.tenantId}::uuid, ${`draft-${runId}`}, 'Draft Course', 'DRAFT', ${fixture.instructorMembershipId}::uuid, now(), now()),
        (${fixture.publishedCourseId}::uuid, ${fixture.tenantId}::uuid, ${`published-${runId}`}, 'Published Course', 'PUBLISHED', ${fixture.instructorMembershipId}::uuid, now(), now())
    `;

    await tx.$executeRaw`
      insert into course_modules (id, tenant_id, course_id, title, position, status, created_at, updated_at)
      values
        (${fixture.draftModuleId}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftCourseId}::uuid, 'Draft Module', 1, 'DRAFT', now(), now()),
        (${fixture.publishedModuleId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedCourseId}::uuid, 'Published Module', 1, 'PUBLISHED', now(), now())
    `;

    await tx.$executeRaw`
      insert into lessons (id, tenant_id, module_id, slug, title, position, status, content_json, duration_seconds, created_at, updated_at)
      values
        (${fixture.draftLessonId}::uuid, ${fixture.tenantId}::uuid, ${fixture.draftModuleId}::uuid, 'draft-lesson', 'Draft Lesson', 1, 'DRAFT', '{"type":"text","body":"draft secret"}'::jsonb, 600, now(), now()),
        (${fixture.publishedLessonId}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedModuleId}::uuid, 'published-lesson', 'Published Lesson', 1, 'PUBLISHED', '{"type":"text","body":"learner secret"}'::jsonb, 600, now(), now())
    `;

    await tx.$executeRaw`
      insert into enrollments (id, tenant_id, course_id, membership_id, status, enrolled_at)
      values (${randomUUID()}::uuid, ${fixture.tenantId}::uuid, ${fixture.publishedCourseId}::uuid, ${fixture.learnerMembershipId}::uuid, 'active', now())
    `;

    await tx.$executeRaw`
      insert into lesson_assets (id, tenant_id, lesson_id, asset_type, provider, object_key_or_url, metadata_json, created_at)
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        ${fixture.publishedLessonId}::uuid,
        'link',
        'external',
        'https://example.com/published-resource.pdf',
        '{"fileName":"Published Resource","displayOrder":1}'::jsonb,
        now()
      )
    `;
  });

  return fixture;
}

export function instructorCtx(fixture: LessonEngineFixture, requestId = randomUUID()) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.instructorMembershipId,
    requestId,
  };
}

export function learnerCtx(fixture: LessonEngineFixture, requestId = randomUUID()) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.learnerMembershipId,
    requestId,
  };
}

export function lessonTenantTx(
  fixture: LessonEngineFixture,
  membershipId: string = fixture.instructorMembershipId,
  requestId = randomUUID(),
) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: membershipId,
    requestId,
  };
}
