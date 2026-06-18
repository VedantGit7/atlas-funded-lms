import { randomUUID } from "node:crypto";
import { assignDefaultLearnerRole, seedTenantAccessControl } from "@atlas/access";
import { withPlatformScope, withTenantTx } from "@atlas/db";
import {
  createTenantIsolationFixture,
  tenantCtx,
} from "../tenant-isolation/tenant-isolation-fixture";

export type CourseEnrollmentFixture = {
  tenantId: string;
  slug: string;
  principalId: string;
  membershipId: string;
  publishedCourseId: string;
  publishedCourseSlug: string;
  draftCourseId: string;
  draftCourseSlug: string;
  archivedCourseId: string;
  moduleId: string;
  lessonId: string;
};

async function insertCourse(args: {
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> };
  tenantId: string;
  courseId: string;
  slug: string;
  title: string;
  status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
  createdByMembershipId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into courses (
      id,
      tenant_id,
      slug,
      title,
      description,
      status,
      metadata_json,
      created_by_membership_id,
      created_at,
      updated_at
    )
    values (
      ${args.courseId}::uuid,
      ${args.tenantId}::uuid,
      ${args.slug},
      ${args.title},
      ${`Description for ${args.title}`},
      ${args.status}::"PublishStatus",
      ${JSON.stringify(args.metadata ?? {})}::jsonb,
      ${args.createdByMembershipId}::uuid,
      now(),
      now()
    )
  `;
}

export async function createCourseEnrollmentFixture(): Promise<CourseEnrollmentFixture> {
  const base = await createTenantIsolationFixture();
  const tenant = base.tenantA;
  const runId = randomUUID().slice(0, 8);

  const fixture: CourseEnrollmentFixture = {
    tenantId: tenant.tenantId,
    slug: tenant.slug,
    principalId: tenant.principalId,
    membershipId: tenant.membershipId,
    publishedCourseId: randomUUID(),
    publishedCourseSlug: `published-${runId}`,
    draftCourseId: randomUUID(),
    draftCourseSlug: `draft-${runId}`,
    archivedCourseId: randomUUID(),
    moduleId: randomUUID(),
    lessonId: randomUUID(),
  };

  await seedTenantAccessControl({
    tenantId: fixture.tenantId,
    requestId: randomUUID(),
  });

  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await assignDefaultLearnerRole({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.membershipId,
    });

    await insertCourse({
      tx,
      tenantId: fixture.tenantId,
      courseId: fixture.publishedCourseId,
      slug: fixture.publishedCourseSlug,
      title: `Published ${runId}`,
      status: "PUBLISHED",
      createdByMembershipId: fixture.membershipId,
      metadata: { stage: "foundation", certificate: true },
    });

    await insertCourse({
      tx,
      tenantId: fixture.tenantId,
      courseId: fixture.draftCourseId,
      slug: fixture.draftCourseSlug,
      title: `Draft ${runId}`,
      status: "DRAFT",
      createdByMembershipId: fixture.membershipId,
    });

    await insertCourse({
      tx,
      tenantId: fixture.tenantId,
      courseId: fixture.archivedCourseId,
      slug: `archived-${runId}`,
      title: `Archived ${runId}`,
      status: "ARCHIVED",
      createdByMembershipId: fixture.membershipId,
    });

    await tx.$executeRaw`
      insert into course_modules (
        id,
        tenant_id,
        course_id,
        title,
        position,
        status,
        created_at,
        updated_at
      )
      values (
        ${fixture.moduleId}::uuid,
        ${fixture.tenantId}::uuid,
        ${fixture.publishedCourseId}::uuid,
        'Module 1',
        1,
        'PUBLISHED',
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into lessons (
        id,
        tenant_id,
        module_id,
        slug,
        title,
        position,
        status,
        content_json,
        created_at,
        updated_at
      )
      values (
        ${fixture.lessonId}::uuid,
        ${fixture.tenantId}::uuid,
        ${fixture.moduleId}::uuid,
        'lesson-1',
        'Lesson 1',
        1,
        'PUBLISHED',
        '{"type":"text","body":"secret lesson body"}'::jsonb,
        now(),
        now()
      )
    `;
  });

  return fixture;
}

import type { IsolationTenantFixture } from "../tenant-isolation/tenant-isolation-fixture";

export async function seedPublishedCourseForTenantB(): Promise<{
  tenantB: IsolationTenantFixture;
  publishedCourseId: string;
}> {
  const base = await createTenantIsolationFixture();
  const publishedCourseId = randomUUID();

  await seedTenantAccessControl({
    tenantId: base.tenantB.tenantId,
    requestId: randomUUID(),
  });

  await withPlatformScope(
    {
      principalId: randomUUID(),
      requestId: randomUUID(),
      requiredPermission: "platform.tenant.manage",
      platformPermissions: ["platform.tenant.manage"],
      touchedTenantIds: [base.tenantB.tenantId],
    },
    "Seed tenant B published course",
    async (tx) => {
      await tx.$executeRaw`
        insert into courses (
          id,
          tenant_id,
          slug,
          title,
          status,
          created_by_membership_id,
          created_at,
          updated_at
        )
        values (
          ${publishedCourseId}::uuid,
          ${base.tenantB.tenantId}::uuid,
          ${`tenant-b-published-${randomUUID().slice(0, 8)}`},
          'Tenant B Published Course',
          'PUBLISHED',
          ${base.tenantB.membershipId}::uuid,
          now(),
          now()
        )
      `;
    },
  );

  return {
    tenantB: base.tenantB,
    publishedCourseId,
  };
}
