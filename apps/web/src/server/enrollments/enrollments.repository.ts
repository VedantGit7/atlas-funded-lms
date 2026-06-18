import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { outbox } from "@atlas/events";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export async function findActiveEnrollment(args: {
  tx: Tx;
  courseId: string;
  membershipId: string;
}): Promise<{ id: string; status: string; enrolledAt: Date } | null> {
  const rows = await args.tx.$queryRaw<Array<{ id: string; status: string; enrolled_at: Date }>>`
    select
      e.id::text,
      e.status,
      e.enrolled_at
    from enrollments e
    where e.course_id = ${args.courseId}::uuid
      and e.membership_id = ${args.membershipId}::uuid
      and e.status = 'active'
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    status: row.status,
    enrolledAt: row.enrolled_at,
  };
}

export async function insertEnrollment(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  membershipId: string;
}): Promise<{ id: string; enrolledAt: Date; created: boolean }> {
  const existing = await findActiveEnrollment({
    tx: args.tx,
    courseId: args.courseId,
    membershipId: args.membershipId,
  });

  if (existing) {
    return {
      id: existing.id,
      enrolledAt: existing.enrolledAt,
      created: false,
    };
  }

  const id = createUuidV7();

  const rows = await args.tx.$queryRaw<Array<{ enrolled_at: Date }>>`
    insert into enrollments (
      id,
      tenant_id,
      course_id,
      membership_id,
      status,
      enrolled_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.courseId}::uuid,
      ${args.membershipId}::uuid,
      'active',
      now()
    )
    returning enrolled_at
  `;

  return {
    id,
    enrolledAt: rows[0]?.enrolled_at ?? new Date(),
    created: true,
  };
}

export async function publishEnrollmentCreatedEvent(args: {
  tx: Tx;
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  };
  enrollmentId: string;
  courseId: string;
}): Promise<void> {
  await outbox.publish(args.tx, {
    ctx: {
      tenantId: args.ctx.tenantId,
      actorMembershipId: args.ctx.actorMembershipId,
      requestId: args.ctx.requestId,
    },
    eventType: "learning.enrollment.created",
    aggregateType: "enrollment",
    aggregateId: args.enrollmentId,
    payload: {
      tenantId: args.ctx.tenantId,
      enrollmentId: args.enrollmentId,
      courseId: args.courseId,
      membershipId: args.ctx.actorMembershipId,
      status: "active",
    },
    idempotencyKey: `${args.ctx.requestId}:learning.enrollment.created:${args.enrollmentId}`,
  });
}
