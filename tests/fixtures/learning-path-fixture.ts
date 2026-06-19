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

export type LearningPathFixture = {
  tenantId: string;
  slug: string;
  instructorMembershipId: string;
  instructorPrincipalId: string;
  adminMembershipId: string;
  adminPrincipalId: string;
  learnerMembershipId: string;
  learnerPrincipalId: string;
  otherInstructorMembershipId: string;
  otherInstructorPrincipalId: string;
  draftPathId: string;
  publishedPathId: string;
  publishedCourseId: string;
  publishedAssessmentId: string;
};

async function insertMembership(args: {
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> };
  tenantId: string;
  membershipId: string;
  principalId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into auth_principals (
      id,
      supabase_user_id,
      email,
      email_normalized,
      global_status,
      created_at,
      updated_at
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
      id,
      tenant_id,
      auth_principal_id,
      status,
      joined_at,
      created_at,
      updated_at
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

async function seedWorkflowDefinitions(args: {
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> };
  tenantId: string;
}) {
  await args.tx.$executeRaw`
    insert into workflow_definitions (
      id,
      tenant_id,
      key,
      name,
      definition_json,
      status,
      created_at,
      updated_at
    )
    values (
      ${randomUUID()}::uuid,
      ${args.tenantId}::uuid,
      'learning_path.publish',
      'Learning path publish review',
      '{"targetType":"learning_path","fromState":"DRAFT","reviewState":"REVIEW","approvedState":"PUBLISHED","rejectedState":"DRAFT","actions":["approve","reject","return"]}'::jsonb,
      'ACTIVE',
      now(),
      now()
    )
  `;
}

export async function createLearningPathFixture(): Promise<LearningPathFixture> {
  const base = await createTenantIsolationFixture();
  const tenant = base.tenantA;

  const fixture: LearningPathFixture = {
    tenantId: tenant.tenantId,
    slug: tenant.slug,
    instructorMembershipId: randomUUID(),
    instructorPrincipalId: randomUUID(),
    adminMembershipId: randomUUID(),
    adminPrincipalId: randomUUID(),
    learnerMembershipId: randomUUID(),
    learnerPrincipalId: randomUUID(),
    otherInstructorMembershipId: randomUUID(),
    otherInstructorPrincipalId: randomUUID(),
    draftPathId: randomUUID(),
    publishedPathId: randomUUID(),
    publishedCourseId: randomUUID(),
    publishedAssessmentId: randomUUID(),
  };

  await seedTenantAccessControl({
    tenantId: fixture.tenantId,
    requestId: randomUUID(),
  });

  await withTenantTx(tenantCtx(tenant), async (tx) => {
    for (const membership of [
      {
        membershipId: fixture.instructorMembershipId,
        principalId: fixture.instructorPrincipalId,
      },
      { membershipId: fixture.adminMembershipId, principalId: fixture.adminPrincipalId },
      { membershipId: fixture.learnerMembershipId, principalId: fixture.learnerPrincipalId },
      {
        membershipId: fixture.otherInstructorMembershipId,
        principalId: fixture.otherInstructorPrincipalId,
      },
    ]) {
      await insertMembership({ tx, tenantId: fixture.tenantId, ...membership });
    }

    await assignSystemRoleToMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.instructorMembershipId,
      roleKey: "instructor",
      requestId: randomUUID(),
    });
    await assignSystemRoleToMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.adminMembershipId,
      roleKey: "admin",
      requestId: randomUUID(),
    });
    await assignDefaultLearnerRole({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.learnerMembershipId,
      requestId: randomUUID(),
    });
    await assignSystemRoleToMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.otherInstructorMembershipId,
      roleKey: "instructor",
      requestId: randomUUID(),
    });

    await seedWorkflowDefinitions({ tx, tenantId: fixture.tenantId });

    await tx.$executeRaw`
      insert into courses (
        id, tenant_id, slug, title, description, status, created_by_membership_id, created_at, updated_at
      )
      values (
        ${fixture.publishedCourseId}::uuid,
        ${fixture.tenantId}::uuid,
        ${`course-${fixture.publishedCourseId.slice(0, 8)}`},
        'Published Course',
        'Course for path step',
        'PUBLISHED',
        ${fixture.instructorMembershipId}::uuid,
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into assessments (
        id, tenant_id, slug, title, assessment_type, status, config_json, created_at, updated_at
      )
      values (
        ${fixture.publishedAssessmentId}::uuid,
        ${fixture.tenantId}::uuid,
        ${`assessment-${fixture.publishedAssessmentId.slice(0, 8)}`},
        'Published Assessment',
        'quiz',
        'PUBLISHED',
        ${JSON.stringify({ createdByMembershipId: fixture.instructorMembershipId, passMarkPercent: 70 })}::jsonb,
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into learning_paths (
        id, tenant_id, slug, title, description, path_type, status, created_by_membership_id, created_at, updated_at
      )
      values (
        ${fixture.draftPathId}::uuid,
        ${fixture.tenantId}::uuid,
        ${`draft-path-${fixture.draftPathId.slice(0, 8)}`},
        'Draft Path',
        'Draft learning path',
        'program',
        'DRAFT',
        ${fixture.instructorMembershipId}::uuid,
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into learning_paths (
        id, tenant_id, slug, title, description, path_type, status, created_by_membership_id, created_at, updated_at
      )
      values (
        ${fixture.publishedPathId}::uuid,
        ${fixture.tenantId}::uuid,
        ${`published-path-${fixture.publishedPathId.slice(0, 8)}`},
        'Published Roadmap',
        'Published roadmap path',
        'roadmap',
        'PUBLISHED',
        ${fixture.instructorMembershipId}::uuid,
        now(),
        now()
      )
    `;

    const publishedStepId = randomUUID();
    await tx.$executeRaw`
      insert into path_steps (
        id, tenant_id, path_id, step_type, ref_id, title, position, created_at, updated_at
      )
      values (
        ${publishedStepId}::uuid,
        ${fixture.tenantId}::uuid,
        ${fixture.publishedPathId}::uuid,
        'course',
        ${fixture.publishedCourseId}::uuid,
        'First stage',
        1,
        now(),
        now()
      )
    `;

    await tx.$executeRaw`
      insert into path_step_gates (
        id, tenant_id, path_step_id, gate_type, config_json, created_at, updated_at
      )
      values (
        ${randomUUID()}::uuid,
        ${fixture.tenantId}::uuid,
        ${publishedStepId}::uuid,
        'open',
        '{}'::jsonb,
        now(),
        now()
      )
    `;
  });

  return fixture;
}

export function instructorCtx(fixture: LearningPathFixture, requestId = "req_learning_path") {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.instructorMembershipId,
    requestId,
  };
}

export function learnerCtx(fixture: LearningPathFixture, requestId = "req_learning_path_learner") {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.learnerMembershipId,
    requestId,
  };
}

export function authoringTenantTx(fixture: LearningPathFixture) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.instructorMembershipId,
    requestId: randomUUID(),
  };
}

export function learnerTenantTx(fixture: LearningPathFixture) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.learnerMembershipId,
    requestId: randomUUID(),
  };
}
