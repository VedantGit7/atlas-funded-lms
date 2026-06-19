import { randomUUID } from "node:crypto";
import { withTenantTx } from "@atlas/db";
import {
  adminCtx,
  authoringTenantTx,
  createCourseAuthoringFixture,
  instructorCtx,
  learnerCtx,
  type CourseAuthoringFixture,
} from "./course-authoring-fixture";

export type CompetencyConfigFixture = CourseAuthoringFixture;

export async function createCompetencyConfigFixture(): Promise<CompetencyConfigFixture> {
  return createCourseAuthoringFixture();
}

export { adminCtx, instructorCtx, learnerCtx, authoringTenantTx };

export async function seedDimension(
  fixture: CompetencyConfigFixture,
  args: { key: string; name: string },
) {
  const id = randomUUID();
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    await tx.$executeRaw`
      insert into competency_dimensions (
        id,
        tenant_id,
        key,
        name,
        description,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${fixture.tenantId}::uuid,
        ${args.key},
        ${args.name},
        null,
        now(),
        now()
      )
    `;
  });
  return id;
}

export async function seedScoringProfile(
  fixture: CompetencyConfigFixture,
  args: { key: string; name: string },
) {
  const id = randomUUID();
  await withTenantTx(authoringTenantTx(fixture, fixture.adminMembershipId), async (tx) => {
    await tx.$executeRaw`
      insert into scoring_profiles (
        id,
        tenant_id,
        key,
        name,
        status,
        created_at,
        updated_at
      )
      values (
        ${id}::uuid,
        ${fixture.tenantId}::uuid,
        ${args.key},
        ${args.name},
        'ACTIVE',
        now(),
        now()
      )
    `;
  });
  return id;
}
