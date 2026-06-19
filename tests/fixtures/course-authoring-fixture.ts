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

export type CourseAuthoringFixture = {
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
  draftCourseId: string;
  workflowDefinitionId: string;
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

async function seedWorkflowDefinition(args: {
  tx: { $executeRaw: (query: TemplateStringsArray, ...values: unknown[]) => Promise<unknown> };
  tenantId: string;
}): Promise<string> {
  const workflowDefinitionId = randomUUID();

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
      ${workflowDefinitionId}::uuid,
      ${args.tenantId}::uuid,
      'course.publish',
      'Course publish review',
      '{"targetType":"course","fromState":"DRAFT","reviewState":"REVIEW","approvedState":"PUBLISHED","rejectedState":"DRAFT","actions":["approve","reject","return"]}'::jsonb,
      'ACTIVE',
      now(),
      now()
    )
  `;

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
      'assessment.publish',
      'Assessment publish review',
      '{"targetType":"assessment","fromState":"DRAFT","reviewState":"REVIEW","approvedState":"PUBLISHED","rejectedState":"DRAFT","actions":["approve","reject","return"]}'::jsonb,
      'ACTIVE',
      now(),
      now()
    )
  `;

  return workflowDefinitionId;
}

export async function createCourseAuthoringFixture(): Promise<CourseAuthoringFixture> {
  const base = await createTenantIsolationFixture();
  const tenant = base.tenantA;
  const runId = randomUUID().slice(0, 8);

  const fixture: CourseAuthoringFixture = {
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
    draftCourseId: randomUUID(),
    workflowDefinitionId: randomUUID(),
  };

  await seedTenantAccessControl({
    tenantId: fixture.tenantId,
    requestId: randomUUID(),
  });

  await withTenantTx(tenantCtx(tenant), async (tx) => {
    await insertMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.instructorMembershipId,
      principalId: fixture.instructorPrincipalId,
    });
    await insertMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.adminMembershipId,
      principalId: fixture.adminPrincipalId,
    });
    await insertMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.learnerMembershipId,
      principalId: fixture.learnerPrincipalId,
    });
    await insertMembership({
      tx,
      tenantId: fixture.tenantId,
      membershipId: fixture.otherInstructorMembershipId,
      principalId: fixture.otherInstructorPrincipalId,
    });

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
      membershipId: fixture.adminMembershipId,
      roleKey: "admin",
      assignedByMembershipId: fixture.adminMembershipId,
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

    fixture.workflowDefinitionId = await seedWorkflowDefinition({
      tx,
      tenantId: fixture.tenantId,
    });

    await tx.$executeRaw`
      insert into courses (
        id,
        tenant_id,
        slug,
        title,
        description,
        status,
        created_by_membership_id,
        created_at,
        updated_at
      )
      values (
        ${fixture.draftCourseId}::uuid,
        ${fixture.tenantId}::uuid,
        ${`instructor-draft-${runId}`},
        'Instructor Draft Course',
        'Owned by instructor',
        'DRAFT',
        ${fixture.instructorMembershipId}::uuid,
        now(),
        now()
      )
    `;
  });

  return fixture;
}

export function adminCtx(fixture: CourseAuthoringFixture, requestId: string = randomUUID()) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.adminMembershipId,
    requestId,
  };
}

export function instructorCtx(fixture: CourseAuthoringFixture, requestId: string = randomUUID()) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.instructorMembershipId,
    requestId,
  };
}

export function learnerCtx(fixture: CourseAuthoringFixture, requestId: string = randomUUID()) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.learnerMembershipId,
    requestId,
  };
}

export function otherInstructorCtx(
  fixture: CourseAuthoringFixture,
  requestId: string = randomUUID(),
) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: fixture.otherInstructorMembershipId,
    requestId,
  };
}

export function authoringTenantTx(
  fixture: CourseAuthoringFixture,
  membershipId: string = fixture.instructorMembershipId,
  requestId: string = randomUUID(),
) {
  return {
    tenantId: fixture.tenantId,
    actorMembershipId: membershipId,
    requestId,
  };
}
