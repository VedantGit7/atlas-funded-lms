import { decodeListCursor, encodeListCursor } from "@atlas/membership/schemas/shared";
import type { CourseListQuery } from "./schemas";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type CourseAuthProjection = {
  id: string;
  tenantId: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  metadataJson: Record<string, unknown> | null;
  createdByMembershipId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function learnerMetadataProjection(metadata: Record<string, unknown> | null): {
  coverKey: string | null;
  tags: Record<string, unknown> | undefined;
} {
  if (!metadata) {
    return { coverKey: null, tags: undefined };
  }

  const coverKey =
    typeof metadata["coverKey"] === "string"
      ? metadata["coverKey"]
      : typeof metadata["thumbnailKey"] === "string"
        ? metadata["thumbnailKey"]
        : null;

  const tags =
    metadata["tags"] && typeof metadata["tags"] === "object" && !Array.isArray(metadata["tags"])
      ? (metadata["tags"] as Record<string, unknown>)
      : undefined;

  return { coverKey, tags };
}

type CourseListRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  metadata_json: Record<string, unknown> | null;
  updated_at: Date;
  created_at: Date;
  enrollment_id: string | null;
};

async function queryPublishedCourses(args: {
  tx: Tx;
  membershipId: string;
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
  q: string | null;
  stage: string | null;
  dimension: string | null;
  persona: string | null;
  certificate: boolean | null;
  sort: CourseListQuery["sort"];
}): Promise<CourseListRow[]> {
  const common = {
    membershipId: args.membershipId,
    limit: args.limit + 1,
    cursorAt: args.cursor?.createdAt ?? null,
    cursorId: args.cursor?.id ?? null,
    q: args.q,
    stage: args.stage,
    dimension: args.dimension,
    persona: args.persona,
    certificate: args.certificate,
  };

  if (args.sort === "title_asc") {
    return args.tx.$queryRaw<CourseListRow[]>`
      select
        c.id::text,
        c.slug,
        c.title,
        c.description,
        c.status::text,
        c.metadata_json,
        c.updated_at,
        c.created_at,
        e.id::text as enrollment_id
      from courses c
      left join enrollments e
        on e.course_id = c.id
       and e.membership_id = ${common.membershipId}::uuid
       and e.status = 'active'
      where c.deleted_at is null
        and c.status = 'PUBLISHED'
        and (${common.q}::text is null or c.title ilike ${common.q} or coalesce(c.description, '') ilike ${common.q})
        and (${common.stage}::text is null or c.metadata_json->>'stage' = ${common.stage})
        and (${common.dimension}::text is null or c.metadata_json->>'dimension' = ${common.dimension})
        and (${common.persona}::text is null or c.metadata_json->>'persona' = ${common.persona})
        and (
          ${common.certificate}::boolean is null
          or (
            ${common.certificate}::boolean = true
            and coalesce((c.metadata_json->>'certificate')::boolean, false) = true
          )
          or (
            ${common.certificate}::boolean = false
            and coalesce((c.metadata_json->>'certificate')::boolean, false) = false
          )
        )
      order by c.title asc, c.id asc
      limit ${common.limit}
    `;
  }

  if (args.sort === "title_desc") {
    return args.tx.$queryRaw<CourseListRow[]>`
      select
        c.id::text,
        c.slug,
        c.title,
        c.description,
        c.status::text,
        c.metadata_json,
        c.updated_at,
        c.created_at,
        e.id::text as enrollment_id
      from courses c
      left join enrollments e
        on e.course_id = c.id
       and e.membership_id = ${common.membershipId}::uuid
       and e.status = 'active'
      where c.deleted_at is null
        and c.status = 'PUBLISHED'
        and (${common.q}::text is null or c.title ilike ${common.q} or coalesce(c.description, '') ilike ${common.q})
        and (${common.stage}::text is null or c.metadata_json->>'stage' = ${common.stage})
        and (${common.dimension}::text is null or c.metadata_json->>'dimension' = ${common.dimension})
        and (${common.persona}::text is null or c.metadata_json->>'persona' = ${common.persona})
        and (
          ${common.certificate}::boolean is null
          or (
            ${common.certificate}::boolean = true
            and coalesce((c.metadata_json->>'certificate')::boolean, false) = true
          )
          or (
            ${common.certificate}::boolean = false
            and coalesce((c.metadata_json->>'certificate')::boolean, false) = false
          )
        )
      order by c.title desc, c.id desc
      limit ${common.limit}
    `;
  }

  return args.tx.$queryRaw<CourseListRow[]>`
    select
      c.id::text,
      c.slug,
      c.title,
      c.description,
      c.status::text,
      c.metadata_json,
      c.updated_at,
      c.created_at,
      e.id::text as enrollment_id
    from courses c
    left join enrollments e
      on e.course_id = c.id
     and e.membership_id = ${common.membershipId}::uuid
     and e.status = 'active'
    where c.deleted_at is null
      and c.status = 'PUBLISHED'
      and (${common.q}::text is null or c.title ilike ${common.q} or coalesce(c.description, '') ilike ${common.q})
      and (${common.stage}::text is null or c.metadata_json->>'stage' = ${common.stage})
      and (${common.dimension}::text is null or c.metadata_json->>'dimension' = ${common.dimension})
      and (${common.persona}::text is null or c.metadata_json->>'persona' = ${common.persona})
      and (
        ${common.certificate}::boolean is null
        or (
          ${common.certificate}::boolean = true
          and coalesce((c.metadata_json->>'certificate')::boolean, false) = true
        )
        or (
          ${common.certificate}::boolean = false
          and coalesce((c.metadata_json->>'certificate')::boolean, false) = false
        )
      )
      and (
        ${common.cursorAt}::timestamptz is null
        or (c.updated_at, c.id) < (${common.cursorAt}::timestamptz, ${common.cursorId}::uuid)
      )
    order by c.updated_at desc, c.id desc
    limit ${common.limit}
  `;
}

export async function findCourseAuthProjection(args: {
  tx: Tx;
  courseId: string;
}): Promise<CourseAuthProjection | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      slug: string;
      title: string;
      description: string | null;
      status: string;
      metadata_json: Record<string, unknown> | null;
      created_by_membership_id: string | null;
      created_at: Date;
      updated_at: Date;
    }>
  >`
    select
      c.id::text,
      c.tenant_id::text,
      c.slug,
      c.title,
      c.description,
      c.status::text,
      c.metadata_json,
      c.created_by_membership_id::text,
      c.created_at,
      c.updated_at
    from courses c
    where c.id = ${args.courseId}::uuid
      and c.deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    status: row.status,
    metadataJson: row.metadata_json,
    createdByMembershipId: row.created_by_membership_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findEnrollmentForMembership(args: {
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

export async function listPublishedCoursesPaginated(args: {
  tx: Tx;
  membershipId: string;
  query: CourseListQuery;
}): Promise<{
  items: Array<{
    id: string;
    slug: string;
    title: string;
    description: string | null;
    status: "PUBLISHED";
    coverKey: string | null;
    tags: Record<string, unknown> | undefined;
    enrollmentStatus: "enrolled" | "not_enrolled";
    updatedAt: Date;
    createdAt: Date;
  }>;
  pageInfo: { nextCursor: string | null; hasNextPage: boolean };
}> {
  const limit = args.query.limit;
  const cursor = args.query.cursor ? decodeListCursor(args.query.cursor) : null;
  const q = args.query.q ? `%${args.query.q}%` : null;
  const stage = args.query.stage ?? null;
  const dimension = args.query.dimension ?? null;
  const persona = args.query.persona ?? null;
  const certificate =
    args.query.certificate === "true" ? true : args.query.certificate === "false" ? false : null;

  const rows = await queryPublishedCourses({
    tx: args.tx,
    membershipId: args.membershipId,
    limit,
    cursor,
    q,
    stage,
    dimension,
    persona,
    certificate,
    sort: args.query.sort,
  });

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

  const items = pageRows.map((row) => {
    const meta = learnerMetadataProjection(row.metadata_json);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: "PUBLISHED" as const,
      coverKey: meta.coverKey,
      tags: meta.tags,
      enrollmentStatus: row.enrollment_id ? ("enrolled" as const) : ("not_enrolled" as const),
      updatedAt: row.updated_at,
      createdAt: row.created_at,
    };
  });

  const last = pageRows[pageRows.length - 1];

  return {
    items,
    pageInfo: {
      hasNextPage,
      nextCursor:
        hasNextPage && last
          ? encodeListCursor({
              createdAt: last.updated_at,
              id: last.id,
            })
          : null,
    },
  };
}

export async function listPublishedCourseModules(args: { tx: Tx; courseId: string }): Promise<
  Array<{
    id: string;
    title: string;
    position: number;
    lessonCount: number;
  }>
> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      title: string;
      position: number;
      lesson_count: bigint;
    }>
  >`
    select
      m.id::text,
      m.title,
      m.position,
      count(l.id) filter (
        where l.deleted_at is null
          and l.status = 'PUBLISHED'
      )::bigint as lesson_count
    from course_modules m
    left join lessons l
      on l.module_id = m.id
     and l.tenant_id = m.tenant_id
    where m.course_id = ${args.courseId}::uuid
      and m.deleted_at is null
      and m.status = 'PUBLISHED'
    group by m.id, m.title, m.position
    order by m.position asc
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    position: row.position,
    lessonCount: Number(row.lesson_count),
  }));
}
