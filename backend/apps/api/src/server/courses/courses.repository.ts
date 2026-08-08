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

export type CourseAccessTier = "FREE" | "PAID";

export type CoursePricing = {
  accessTier: CourseAccessTier;
  priceCents: number | null;
  currency: string | null;
};

/**
 * Reads the freemium pricing attributes from a course's metadata JSON. Courses
 * without an explicit tier are treated as FREE so existing content stays open.
 */
export function readCoursePricing(metadata: Record<string, unknown> | null): CoursePricing {
  const accessTier: CourseAccessTier = metadata?.["accessTier"] === "PAID" ? "PAID" : "FREE";

  const rawPrice = metadata?.["priceCents"];
  const priceCents =
    typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice >= 0
      ? Math.floor(rawPrice)
      : null;

  const rawCurrency = metadata?.["currency"];
  const currency =
    typeof rawCurrency === "string" && rawCurrency.trim().length === 3
      ? rawCurrency.trim().toUpperCase()
      : null;

  return { accessTier, priceCents, currency };
}

export type CourseLevel = "beginner" | "intermediate" | "advanced";

export type CourseCatalogMeta = {
  level: CourseLevel | null;
  category: string | null;
  featured: boolean;
  trending: boolean;
  compareAtPriceCents: number | null;
};

/**
 * Reads catalog presentation attributes from a course's metadata JSON. These
 * are author-controlled hints (level badge, category, featured/trending flags,
 * and the original "compare at" price used to render a discount) and all
 * degrade to null/false when unset.
 */
export function readCourseCatalogMeta(metadata: Record<string, unknown> | null): CourseCatalogMeta {
  const rawLevel = typeof metadata?.["level"] === "string" ? metadata["level"].toLowerCase() : null;
  const level: CourseLevel | null =
    rawLevel === "beginner" || rawLevel === "intermediate" || rawLevel === "advanced" ? rawLevel : null;

  const category =
    typeof metadata?.["category"] === "string"
      ? metadata["category"]
      : typeof metadata?.["stage"] === "string"
        ? metadata["stage"]
        : null;

  const rawCompare = metadata?.["compareAtPriceCents"];
  const compareAtPriceCents =
    typeof rawCompare === "number" && Number.isFinite(rawCompare) && rawCompare >= 0
      ? Math.floor(rawCompare)
      : null;

  return {
    level,
    category,
    featured: metadata?.["featured"] === true,
    trending: metadata?.["trending"] === true,
    compareAtPriceCents,
  };
}

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
  instructor_name: string | null;
  instructor_avatar_key: string | null;
  duration_seconds: bigint | null;
  student_count: bigint;
  progress_pct: number | null;
  rating_average: number | null;
  rating_count: bigint;
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
        e.id::text as enrollment_id,
        mp.display_name as instructor_name,
        mp.avatar_key as instructor_avatar_key,
        (
          select coalesce(sum(l.duration_seconds), 0)::bigint
          from lessons l
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
          where cm.course_id = c.id
            and cm.status = 'PUBLISHED' and cm.deleted_at is null
            and l.status = 'PUBLISHED' and l.deleted_at is null
        ) as duration_seconds,
        (
          select count(*)::bigint
          from enrollments en
          where en.course_id = c.id and en.status = 'active'
        ) as student_count,
        (
          select round(avg(lp.progress_pct))::int
          from lesson_progress lp
          join lessons l2 on l2.id = lp.lesson_id and l2.tenant_id = lp.tenant_id
          join course_modules cm2 on cm2.id = l2.module_id and cm2.tenant_id = l2.tenant_id
          where cm2.course_id = c.id
            and lp.membership_id = ${common.membershipId}::uuid
        ) as progress_pct,
        (
          select round(avg(cr.rating)::numeric, 2)::float8
          from course_reviews cr
          where cr.course_id = c.id
        ) as rating_average,
        (
          select count(*)::bigint
          from course_reviews cr
          where cr.course_id = c.id
        ) as rating_count
      from courses c
      left join enrollments e
        on e.course_id = c.id
       and e.membership_id = ${common.membershipId}::uuid
       and e.status = 'active'
      left join member_profiles mp
        on mp.membership_id = c.created_by_membership_id
       and mp.tenant_id = c.tenant_id
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
        e.id::text as enrollment_id,
        mp.display_name as instructor_name,
        mp.avatar_key as instructor_avatar_key,
        (
          select coalesce(sum(l.duration_seconds), 0)::bigint
          from lessons l
          join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
          where cm.course_id = c.id
            and cm.status = 'PUBLISHED' and cm.deleted_at is null
            and l.status = 'PUBLISHED' and l.deleted_at is null
        ) as duration_seconds,
        (
          select count(*)::bigint
          from enrollments en
          where en.course_id = c.id and en.status = 'active'
        ) as student_count,
        (
          select round(avg(lp.progress_pct))::int
          from lesson_progress lp
          join lessons l2 on l2.id = lp.lesson_id and l2.tenant_id = lp.tenant_id
          join course_modules cm2 on cm2.id = l2.module_id and cm2.tenant_id = l2.tenant_id
          where cm2.course_id = c.id
            and lp.membership_id = ${common.membershipId}::uuid
        ) as progress_pct,
        (
          select round(avg(cr.rating)::numeric, 2)::float8
          from course_reviews cr
          where cr.course_id = c.id
        ) as rating_average,
        (
          select count(*)::bigint
          from course_reviews cr
          where cr.course_id = c.id
        ) as rating_count
      from courses c
      left join enrollments e
        on e.course_id = c.id
       and e.membership_id = ${common.membershipId}::uuid
       and e.status = 'active'
      left join member_profiles mp
        on mp.membership_id = c.created_by_membership_id
       and mp.tenant_id = c.tenant_id
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
      e.id::text as enrollment_id,
      mp.display_name as instructor_name,
      mp.avatar_key as instructor_avatar_key,
      (
        select coalesce(sum(l.duration_seconds), 0)::bigint
        from lessons l
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
        where cm.course_id = c.id
          and cm.status = 'PUBLISHED' and cm.deleted_at is null
          and l.status = 'PUBLISHED' and l.deleted_at is null
      ) as duration_seconds,
      (
        select count(*)::bigint
        from enrollments en
        where en.course_id = c.id and en.status = 'active'
      ) as student_count,
      (
        select round(avg(lp.progress_pct))::int
        from lesson_progress lp
        join lessons l2 on l2.id = lp.lesson_id and l2.tenant_id = lp.tenant_id
        join course_modules cm2 on cm2.id = l2.module_id and cm2.tenant_id = l2.tenant_id
        where cm2.course_id = c.id
          and lp.membership_id = ${common.membershipId}::uuid
      ) as progress_pct,
      (
        select round(avg(cr.rating)::numeric, 2)::float8
        from course_reviews cr
        where cr.course_id = c.id
      ) as rating_average,
      (
        select count(*)::bigint
        from course_reviews cr
        where cr.course_id = c.id
      ) as rating_count
    from courses c
    left join enrollments e
      on e.course_id = c.id
     and e.membership_id = ${common.membershipId}::uuid
     and e.status = 'active'
    left join member_profiles mp
      on mp.membership_id = c.created_by_membership_id
     and mp.tenant_id = c.tenant_id
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
    accessTier: CourseAccessTier;
    priceCents: number | null;
    currency: string | null;
    locked: boolean;
    level: CourseLevel | null;
    category: string | null;
    featured: boolean;
    trending: boolean;
    compareAtPriceCents: number | null;
    durationSeconds: number | null;
    studentCount: number;
    instructor: { name: string | null; avatarKey: string | null } | null;
    progressPct: number | null;
    ratingAverage: number | null;
    ratingCount: number;
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
    const pricing = readCoursePricing(row.metadata_json);
    const catalog = readCourseCatalogMeta(row.metadata_json);
    const enrollmentStatus = row.enrollment_id
      ? ("enrolled" as const)
      : ("not_enrolled" as const);
    const durationSeconds = row.duration_seconds != null ? Number(row.duration_seconds) : null;
    const instructor =
      row.instructor_name != null || row.instructor_avatar_key != null
        ? { name: row.instructor_name, avatarKey: row.instructor_avatar_key }
        : null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: "PUBLISHED" as const,
      coverKey: meta.coverKey,
      tags: meta.tags,
      accessTier: pricing.accessTier,
      priceCents: pricing.priceCents,
      currency: pricing.currency,
      locked: pricing.accessTier === "PAID" && enrollmentStatus !== "enrolled",
      level: catalog.level,
      category: catalog.category,
      featured: catalog.featured,
      trending: catalog.trending,
      compareAtPriceCents: catalog.compareAtPriceCents,
      durationSeconds: durationSeconds != null && durationSeconds > 0 ? durationSeconds : null,
      studentCount: Number(row.student_count),
      instructor,
      progressPct: enrollmentStatus === "enrolled" && row.progress_pct != null ? row.progress_pct : null,
      ratingAverage: row.rating_average,
      ratingCount: Number(row.rating_count),
      enrollmentStatus,
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
    contentKind: "standard" | "scorm";
    scormLaunchReady: boolean;
  }>
> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      title: string;
      position: number;
      content_kind: string;
      scorm_launch_path: string | null;
      lesson_count: bigint;
    }>
  >`
    select
      m.id::text,
      m.title,
      m.position,
      m.content_kind::text,
      m.scorm_launch_path,
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
    group by m.id, m.title, m.position, m.content_kind, m.scorm_launch_path
    order by m.position asc
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    position: row.position,
    lessonCount: Number(row.lesson_count),
    contentKind: row.content_kind === "SCORM" ? ("scorm" as const) : ("standard" as const),
    scormLaunchReady: row.content_kind === "SCORM" && row.scorm_launch_path != null,
  }));
}
