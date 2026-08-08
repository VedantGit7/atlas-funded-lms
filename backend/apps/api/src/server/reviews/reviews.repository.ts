import { createUuidV7 } from "@atlas/core/id/uuid-v7";
import { decodeListCursor, encodeListCursor } from "@atlas/membership/schemas/shared";
import { outbox } from "@atlas/events";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type CourseReviewRecord = {
  id: string;
  rating: number;
  comment: string | null;
  authorName: string | null;
  membershipId: string;
  createdAt: Date;
  updatedAt: Date;
};

function mapRow(row: {
  id: string;
  rating: number;
  comment: string | null;
  author_name: string | null;
  membership_id: string;
  created_at: Date;
  updated_at: Date;
}): CourseReviewRecord {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    authorName: row.author_name,
    membershipId: row.membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertCourseReview(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  membershipId: string;
  rating: number;
  comment: string | null;
}): Promise<{ id: string; createdAt: Date; updatedAt: Date; created: boolean }> {
  const id = createUuidV7();
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; created_at: Date; updated_at: Date; created: boolean }>
  >`
    insert into course_reviews (
      id, tenant_id, course_id, membership_id, rating, comment, status, created_at, updated_at
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.courseId}::uuid,
      ${args.membershipId}::uuid,
      ${args.rating},
      ${args.comment},
      'PENDING',
      now(),
      now()
    )
    on conflict (tenant_id, course_id, membership_id)
    do update set
      rating = excluded.rating,
      comment = excluded.comment,
      status = 'PENDING',
      updated_at = now()
    returning id::text, created_at, updated_at, (xmax = 0) as created
  `;

  const row = rows[0];
  return {
    id: row?.id ?? id,
    createdAt: row?.created_at ?? new Date(),
    updatedAt: row?.updated_at ?? new Date(),
    created: row?.created ?? true,
  };
}

export async function findMyCourseReview(args: {
  tx: Tx;
  courseId: string;
  membershipId: string;
}): Promise<CourseReviewRecord | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      rating: number;
      comment: string | null;
      author_name: string | null;
      membership_id: string;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select
      cr.id::text,
      cr.rating,
      cr.comment,
      mp.display_name as author_name,
      cr.membership_id::text,
      cr.created_at,
      cr.updated_at
    from course_reviews cr
    left join member_profiles mp
      on mp.membership_id = cr.membership_id
     and mp.tenant_id = cr.tenant_id
    where cr.course_id = ${args.courseId}::uuid
      and cr.membership_id = ${args.membershipId}::uuid
    limit 1
  `;

  const row = rows[0];
  return row ? mapRow(row) : null;
}

export async function getCourseReviewAggregate(args: {
  tx: Tx;
  courseId: string;
}): Promise<{ average: number | null; count: number }> {
  const rows = await args.tx.$queryRaw<Array<{ average: number | null; count: bigint }>>`
    select
      round(avg(cr.rating)::numeric, 2)::float8 as average,
      count(*)::bigint as count
    from course_reviews cr
    where cr.course_id = ${args.courseId}::uuid
      and coalesce(cr.status, 'APPROVED') = 'APPROVED'
  `;

  const row = rows[0];
  return {
    average: row?.average ?? null,
    count: row ? Number(row.count) : 0,
  };
}

export async function listCourseReviews(args: {
  tx: Tx;
  courseId: string;
  viewerMembershipId: string;
  limit: number;
  cursor?: string;
}): Promise<{
  items: CourseReviewRecord[];
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}> {
  const cursor = args.cursor ? decodeListCursor(args.cursor) : null;
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      rating: number;
      comment: string | null;
      author_name: string | null;
      membership_id: string;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select
      cr.id::text,
      cr.rating,
      cr.comment,
      mp.display_name as author_name,
      cr.membership_id::text,
      cr.created_at,
      cr.updated_at
    from course_reviews cr
    left join member_profiles mp
      on mp.membership_id = cr.membership_id
     and mp.tenant_id = cr.tenant_id
    where cr.course_id = ${args.courseId}::uuid
      and coalesce(cr.status, 'APPROVED') = 'APPROVED'
      and (
        ${cursor?.createdAt ?? null}::timestamptz is null
        or (cr.created_at, cr.id) < (${cursor?.createdAt ?? null}::timestamptz, ${cursor?.id ?? null}::uuid)
      )
    order by cr.created_at desc, cr.id desc
    limit ${args.limit + 1}
  `;

  const hasNextPage = rows.length > args.limit;
  const pageRows = hasNextPage ? rows.slice(0, args.limit) : rows;
  const last = pageRows[pageRows.length - 1];

  return {
    items: pageRows.map(mapRow),
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last ? encodeListCursor({ createdAt: last.created_at, id: last.id }) : null,
    },
  };
}

export async function publishCourseReviewCreatedEvent(args: {
  tx: Tx;
  ctx: { tenantId: string; actorMembershipId: string; requestId: string };
  reviewId: string;
  courseId: string;
  membershipId: string;
  rating: number;
}): Promise<void> {
  await outbox.publish(args.tx, {
    ctx: {
      tenantId: args.ctx.tenantId,
      actorMembershipId: args.ctx.actorMembershipId,
      requestId: args.ctx.requestId,
    },
    eventType: "learning.course_review.created",
    aggregateType: "course_review",
    aggregateId: args.reviewId,
    payload: {
      tenantId: args.ctx.tenantId,
      reviewId: args.reviewId,
      courseId: args.courseId,
      membershipId: args.membershipId,
      rating: args.rating,
    },
    idempotencyKey: `${args.ctx.requestId}:learning.course_review.created:${args.reviewId}`,
  });
}
