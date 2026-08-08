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
  enrolledType?: string;
  expiresAt?: Date | null;
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
  const enrolledType = args.enrolledType?.trim() || "free";
  const expiresAt = args.expiresAt ?? null;

  const rows = await args.tx.$queryRaw<Array<{ enrolled_at: Date }>>`
    insert into enrollments (
      id,
      tenant_id,
      course_id,
      membership_id,
      status,
      enrolled_type,
      enrolled_at,
      expires_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.courseId}::uuid,
      ${args.membershipId}::uuid,
      'active',
      ${enrolledType},
      now(),
      ${expiresAt}::timestamptz
    )
    returning enrolled_at
  `;

  return {
    id,
    enrolledAt: rows[0]?.enrolled_at ?? new Date(),
    created: true,
  };
}

import { dispatchMarketingIntegrationWebhooks } from "../marketing-integrations/marketing-integrations.dispatch";
import type { TenantTx } from "@atlas/db";

export async function publishEnrollmentCreatedEvent(args: {
  tx: Tx;
  ctx: {
    tenantId: string;
    actorMembershipId: string;
    requestId: string;
  };
  enrollmentId: string;
  courseId: string;
  membershipId: string;
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
      membershipId: args.membershipId,
      status: "active",
    },
    idempotencyKey: `${args.ctx.requestId}:learning.enrollment.created:${args.enrollmentId}`,
  });

  try {
    const memberRows = await args.tx.$queryRaw<
      Array<{ email: string | null; display_name: string | null }>
    >`
      select
        coalesce(ap.email, m.invited_email_normalized) as email,
        mp.display_name
      from memberships m
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join member_profiles mp
        on mp.tenant_id = m.tenant_id
       and mp.membership_id = m.id
       and mp.deleted_at is null
      where m.id = ${args.membershipId}::uuid
      limit 1
    `;
    await dispatchMarketingIntegrationWebhooks(
      args.tx as TenantTx,
      { tenantId: args.ctx.tenantId },
      "purchase",
      {
        email: memberRows[0]?.email ?? null,
        name: memberRows[0]?.display_name ?? null,
        membershipId: args.membershipId,
        courseId: args.courseId,
        enrollmentId: args.enrollmentId,
        source: "enrollment",
      },
    );
  } catch {
    // Webhook fan-out must never block enrollment.
  }
}

function decodeListCursor(cursor: string): { enrolledAt: Date; id: string } {
  const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
    enrolledAt: string;
    id: string;
  };
  return { enrolledAt: new Date(parsed.enrolledAt), id: parsed.id };
}

function encodeListCursor(value: { enrolledAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ enrolledAt: value.enrolledAt.toISOString(), id: value.id }),
  ).toString("base64url");
}

export async function listEnrollmentsForCourse(args: {
  tx: Tx;
  courseId: string;
  limit: number;
  cursor?: string;
}): Promise<{
  items: Array<{
    id: string;
    courseId: string;
    membershipId: string;
    displayName: string | null;
    status: string;
    enrolledAt: Date;
  }>;
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}> {
  const cursor = args.cursor ? decodeListCursor(args.cursor) : null;
  const limit = args.limit;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      course_id: string;
      membership_id: string;
      display_name: string | null;
      status: string;
      enrolled_at: Date;
    }>
  >`
    select
      e.id::text,
      e.course_id::text,
      e.membership_id::text,
      mp.display_name,
      e.status,
      e.enrolled_at
    from enrollments e
    left join member_profiles mp
      on mp.membership_id = e.membership_id
     and mp.tenant_id = e.tenant_id
    where e.course_id = ${args.courseId}::uuid
      and e.status = 'active'
      and (
        ${cursor?.enrolledAt ?? null}::timestamptz is null
        or e.enrolled_at < ${cursor?.enrolledAt ?? null}::timestamptz
        or (e.enrolled_at = ${cursor?.enrolledAt ?? null}::timestamptz and e.id::text < ${cursor?.id ?? null}::text)
      )
    order by e.enrolled_at desc, e.id desc
    limit ${limit + 1}
  `;

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      membershipId: row.membership_id,
      displayName: row.display_name,
      status: row.status,
      enrolledAt: row.enrolled_at,
    })),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeListCursor({ enrolledAt: last.enrolled_at, id: last.id })
          : null,
    },
  };
}

export async function findEnrollmentById(args: {
  tx: Tx;
  enrollmentId: string;
}): Promise<{
  id: string;
  courseId: string;
  membershipId: string;
  status: string;
  tenantId: string;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      course_id: string;
      membership_id: string;
      status: string;
      tenant_id: string;
    }>
  >`
    select
      e.id::text,
      e.course_id::text,
      e.membership_id::text,
      e.status,
      e.tenant_id::text
    from enrollments e
    where e.id = ${args.enrollmentId}::uuid
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    courseId: row.course_id,
    membershipId: row.membership_id,
    status: row.status,
    tenantId: row.tenant_id,
  };
}

export async function cancelEnrollment(args: {
  tx: Tx;
  enrollmentId: string;
}): Promise<boolean> {
  const result = await args.tx.$executeRaw`
    update enrollments
    set status = 'cancelled'
    where id = ${args.enrollmentId}::uuid
      and status = 'active'
  `;

  return Number(result) > 0;
}

export async function listEnrollmentsForMember(args: {
  tx: Tx;
  membershipId: string;
  limit: number;
  cursor?: string;
}): Promise<{
  items: Array<{
    id: string;
    courseId: string;
    membershipId: string;
    displayName: string | null;
    status: string;
    enrolledAt: Date;
  }>;
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}> {
  const cursor = args.cursor ? decodeListCursor(args.cursor) : null;
  const limit = args.limit;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      course_id: string;
      membership_id: string;
      display_name: string | null;
      status: string;
      enrolled_at: Date;
    }>
  >`
    select
      e.id::text,
      e.course_id::text,
      e.membership_id::text,
      mp.display_name,
      e.status,
      e.enrolled_at
    from enrollments e
    left join member_profiles mp
      on mp.membership_id = e.membership_id
     and mp.tenant_id = e.tenant_id
    where e.membership_id = ${args.membershipId}::uuid
      and e.status = 'active'
      and (
        ${cursor?.enrolledAt ?? null}::timestamptz is null
        or e.enrolled_at < ${cursor?.enrolledAt ?? null}::timestamptz
        or (e.enrolled_at = ${cursor?.enrolledAt ?? null}::timestamptz and e.id::text < ${cursor?.id ?? null}::text)
      )
    order by e.enrolled_at desc, e.id desc
    limit ${limit + 1}
  `;

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map((row) => ({
      id: row.id,
      courseId: row.course_id,
      membershipId: row.membership_id,
      displayName: row.display_name,
      status: row.status,
      enrolledAt: row.enrolled_at,
    })),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeListCursor({ enrolledAt: last.enrolled_at, id: last.id })
          : null,
    },
  };
}
