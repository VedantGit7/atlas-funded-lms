// Poisons this module for any client bundle. Audit finding M9: nothing at the
// language level stopped a server module being pulled into a client component,
// so a leak of service code -- and whatever secrets or privileged queries it
// closes over -- would only have shown up as a runtime surprise.
import "server-only";

import { randomUUID } from "node:crypto";
import { decodeListCursor, encodeListCursor } from "@atlas/membership/schemas/shared";
import type { StudioCourseListQuery } from "./course-authoring-schemas";
import type { CourseLifecycleStatus } from "./course-state-guards";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

type CourseRow = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  metadata_json: Record<string, unknown> | null;
  updated_at: Date;
  created_at: Date;
};

function metadataProjection(metadata: Record<string, unknown> | null): {
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

export function buildMetadataPatch(input: {
  shortDescription?: string;
  coverKey?: string;
  thumbnailAssetId?: string;
  estimatedDuration?: number;
  level?: string;
  stage?: string;
  tags?: Record<string, unknown>;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (input.shortDescription !== undefined) patch["shortDescription"] = input.shortDescription;
  if (input.coverKey !== undefined) patch["coverKey"] = input.coverKey;
  if (input.thumbnailAssetId !== undefined) patch["thumbnailAssetId"] = input.thumbnailAssetId;
  if (input.estimatedDuration !== undefined) patch["estimatedDuration"] = input.estimatedDuration;
  if (input.level !== undefined) patch["level"] = input.level;
  if (input.stage !== undefined) patch["stage"] = input.stage;
  if (input.tags !== undefined) patch["tags"] = input.tags;

  return patch;
}

async function queryStudioCourses(args: {
  tx: Tx;
  ownerMembershipId: string;
  limit: number;
  cursor: { createdAt: Date; id: string } | null;
  q: string | null;
  status: CourseLifecycleStatus | null;
  sort: StudioCourseListQuery["sort"];
}): Promise<CourseRow[]> {
  const common = {
    ownerMembershipId: args.ownerMembershipId,
    limit: args.limit + 1,
    cursorAt: args.cursor?.createdAt ?? null,
    cursorId: args.cursor?.id ?? null,
    q: args.q,
    status: args.status,
  };

  if (args.sort === "title_asc") {
    return args.tx.$queryRaw<CourseRow[]>`
      select
        c.id::text,
        c.slug,
        c.title,
        c.description,
        c.status::text,
        c.metadata_json,
        c.updated_at,
        c.created_at
      from courses c
      where c.deleted_at is null
        and c.created_by_membership_id = ${common.ownerMembershipId}::uuid
        and (${common.status}::text is null or c.status::text = ${common.status})
        and (${common.q}::text is null or c.title ilike ${common.q} or coalesce(c.description, '') ilike ${common.q})
      order by c.title asc, c.id asc
      limit ${common.limit}
    `;
  }

  if (args.sort === "title_desc") {
    return args.tx.$queryRaw<CourseRow[]>`
      select
        c.id::text,
        c.slug,
        c.title,
        c.description,
        c.status::text,
        c.metadata_json,
        c.updated_at,
        c.created_at
      from courses c
      where c.deleted_at is null
        and c.created_by_membership_id = ${common.ownerMembershipId}::uuid
        and (${common.status}::text is null or c.status::text = ${common.status})
        and (${common.q}::text is null or c.title ilike ${common.q} or coalesce(c.description, '') ilike ${common.q})
      order by c.title desc, c.id desc
      limit ${common.limit}
    `;
  }

  return args.tx.$queryRaw<CourseRow[]>`
    select
      c.id::text,
      c.slug,
      c.title,
      c.description,
      c.status::text,
      c.metadata_json,
      c.updated_at,
      c.created_at
    from courses c
    where c.deleted_at is null
      and c.created_by_membership_id = ${common.ownerMembershipId}::uuid
      and (${common.status}::text is null or c.status::text = ${common.status})
      and (${common.q}::text is null or c.title ilike ${common.q} or coalesce(c.description, '') ilike ${common.q})
      and (
        ${common.cursorAt}::timestamptz is null
        or (c.updated_at, c.id) < (${common.cursorAt}::timestamptz, ${common.cursorId}::uuid)
      )
    order by c.updated_at desc, c.id desc
    limit ${common.limit}
  `;
}

export async function listStudioCoursesPaginated(args: {
  tx: Tx;
  ownerMembershipId: string;
  query: StudioCourseListQuery;
}) {
  const limit = args.query.limit;
  const cursor = args.query.cursor ? decodeListCursor(args.query.cursor) : null;
  const q = args.query.q ? `%${args.query.q}%` : null;
  const status = args.query.status ?? null;

  const rows = await queryStudioCourses({
    tx: args.tx,
    ownerMembershipId: args.ownerMembershipId,
    limit,
    cursor,
    q,
    status,
    sort: args.query.sort,
  });

  const hasNextPage = rows.length > limit;
  const pageRows = hasNextPage ? rows.slice(0, limit) : rows;

  const items = pageRows.map((row) => {
    const meta = metadataProjection(row.metadata_json);
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      description: row.description,
      status: row.status as CourseLifecycleStatus,
      coverKey: meta.coverKey,
      tags: meta.tags,
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

export async function insertCourseDraft(args: {
  tx: Tx;
  tenantId: string;
  ownerMembershipId: string;
  slug: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
}): Promise<{ id: string }> {
  const courseId = randomUUID();

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
      ${courseId}::uuid,
      ${args.tenantId}::uuid,
      ${args.slug},
      ${args.title},
      ${args.description},
      'DRAFT'::"PublishStatus",
      ${JSON.stringify(args.metadata)}::jsonb,
      ${args.ownerMembershipId}::uuid,
      now(),
      now()
    )
  `;

  return { id: courseId };
}

export async function updateCourseRecord(args: {
  tx: Tx;
  courseId: string;
  slug?: string;
  title?: string;
  description?: string | null;
  metadataPatch?: Record<string, unknown>;
}): Promise<void> {
  const rows = await args.tx.$queryRaw<Array<{ metadata_json: Record<string, unknown> | null }>>`
    select metadata_json
    from courses
    where id = ${args.courseId}::uuid
      and deleted_at is null
    limit 1
  `;

  const existing = rows[0];
  if (!existing) return;

  const mergedMetadata =
    args.metadataPatch != null
      ? {
          ...(existing.metadata_json ?? {}),
          ...args.metadataPatch,
        }
      : existing.metadata_json;

  await args.tx.$executeRaw`
    update courses
    set
      slug = coalesce(${args.slug ?? null}, slug),
      title = coalesce(${args.title ?? null}, title),
      description = coalesce(${args.description ?? null}, description),
      metadata_json = ${mergedMetadata == null ? null : JSON.stringify(mergedMetadata)}::jsonb,
      updated_at = now()
    where id = ${args.courseId}::uuid
      and deleted_at is null
  `;
}

export async function archiveCourseRecord(args: { tx: Tx; courseId: string }): Promise<void> {
  await args.tx.$executeRaw`
    update courses
    set
      status = 'ARCHIVED'::"PublishStatus",
      deleted_at = now(),
      updated_at = now()
    where id = ${args.courseId}::uuid
      and deleted_at is null
  `;
}

export async function updateCourseStatus(args: {
  tx: Tx;
  courseId: string;
  status: CourseLifecycleStatus;
}): Promise<void> {
  await args.tx.$executeRaw`
    update courses
    set
      status = ${args.status}::"PublishStatus",
      updated_at = now()
    where id = ${args.courseId}::uuid
      and deleted_at is null
  `;
}

export async function courseSlugExists(args: {
  tx: Tx;
  slug: string;
  excludeCourseId?: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from courses
    where slug = ${args.slug}
      and deleted_at is null
      and (${args.excludeCourseId ?? null}::uuid is null or id <> ${args.excludeCourseId ?? null}::uuid)
    limit 1
  `;

  return rows.length > 0;
}

export async function countActiveEnrollments(args: { tx: Tx; courseId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from enrollments
    where course_id = ${args.courseId}::uuid
      and status = 'active'
  `;

  return Number(rows[0]?.count ?? 0n);
}

export async function listCourseModulesForBuilder(args: { tx: Tx; courseId: string }) {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      title: string;
      position: number;
      status: string;
      lesson_count: bigint;
    }>
  >`
    select
      m.id::text,
      m.title,
      m.position,
      m.status::text,
      count(l.id) filter (where l.deleted_at is null)::bigint as lesson_count
    from course_modules m
    left join lessons l
      on l.module_id = m.id
     and l.tenant_id = m.tenant_id
    where m.course_id = ${args.courseId}::uuid
      and m.deleted_at is null
    group by m.id, m.title, m.position, m.status
    order by m.position asc
  `;

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    position: row.position,
    status: row.status as CourseLifecycleStatus,
    lessonCount: Number(row.lesson_count),
  }));
}

export async function findNextModulePosition(args: { tx: Tx; courseId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ max_position: number | null }>>`
    select max(position) as max_position
    from course_modules
    where course_id = ${args.courseId}::uuid
      and deleted_at is null
  `;

  return (rows[0]?.max_position ?? 0) + 1;
}

export async function insertCourseModule(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  title: string;
  position: number;
}): Promise<{ id: string }> {
  const moduleId = randomUUID();

  await args.tx.$executeRaw`
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
      ${moduleId}::uuid,
      ${args.tenantId}::uuid,
      ${args.courseId}::uuid,
      ${args.title},
      ${args.position},
      'DRAFT'::"PublishStatus",
      now(),
      now()
    )
  `;

  return { id: moduleId };
}

export async function findModuleWithCourse(args: { tx: Tx; moduleId: string }): Promise<{
  id: string;
  tenantId: string;
  courseId: string;
  title: string;
  position: number;
  status: CourseLifecycleStatus;
  courseStatus: CourseLifecycleStatus;
  createdByMembershipId: string | null;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      course_id: string;
      title: string;
      position: number;
      status: string;
      course_status: string;
      created_by_membership_id: string | null;
    }>
  >`
    select
      m.id::text,
      m.tenant_id::text,
      m.course_id::text,
      m.title,
      m.position,
      m.status::text,
      c.status::text as course_status,
      c.created_by_membership_id::text
    from course_modules m
    inner join courses c
      on c.id = m.course_id
     and c.tenant_id = m.tenant_id
    where m.id = ${args.moduleId}::uuid
      and m.deleted_at is null
      and c.deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    courseId: row.course_id,
    title: row.title,
    position: row.position,
    status: row.status as CourseLifecycleStatus,
    courseStatus: row.course_status as CourseLifecycleStatus,
    createdByMembershipId: row.created_by_membership_id,
  };
}

export async function updateCourseModuleRecord(args: {
  tx: Tx;
  moduleId: string;
  title?: string;
  position?: number;
}): Promise<void> {
  await args.tx.$executeRaw`
    update course_modules
    set
      title = coalesce(${args.title ?? null}, title),
      position = coalesce(${args.position ?? null}, position),
      updated_at = now()
    where id = ${args.moduleId}::uuid
      and deleted_at is null
  `;
}

export async function archiveCourseModuleRecord(args: { tx: Tx; moduleId: string }): Promise<void> {
  await args.tx.$executeRaw`
    update course_modules
    set
      deleted_at = now(),
      updated_at = now()
    where id = ${args.moduleId}::uuid
      and deleted_at is null
  `;
}

export async function countModuleLessons(args: { tx: Tx; moduleId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from lessons
    where module_id = ${args.moduleId}::uuid
      and deleted_at is null
  `;

  return Number(rows[0]?.count ?? 0n);
}

export async function findWorkflowDefinitionByKey(args: { tx: Tx; key: string }): Promise<{
  id: string;
  definitionJson: Record<string, unknown>;
} | null> {
  const rows = await args.tx.$queryRaw<
    Array<{ id: string; definition_json: Record<string, unknown> }>
  >`
    select
      id::text,
      definition_json
    from workflow_definitions
    where key = ${args.key}
      and status = 'ACTIVE'
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    definitionJson: row.definition_json,
  };
}

export async function insertWorkflowTransition(args: {
  tx: Tx;
  tenantId: string;
  workflowDefinitionId: string;
  targetType: string;
  targetId: string;
  fromState: string;
  toState: string;
  actorMembershipId: string;
  reason: string | null;
  metadata?: Record<string, unknown>;
}): Promise<{ id: string }> {
  const transitionId = randomUUID();

  await args.tx.$executeRaw`
    insert into workflow_transitions (
      id,
      tenant_id,
      workflow_definition_id,
      target_type,
      target_id,
      from_state,
      to_state,
      actor_membership_id,
      reason,
      metadata_json,
      occurred_at
    )
    values (
      ${transitionId}::uuid,
      ${args.tenantId}::uuid,
      ${args.workflowDefinitionId}::uuid,
      ${args.targetType},
      ${args.targetId}::uuid,
      ${args.fromState},
      ${args.toState},
      ${args.actorMembershipId}::uuid,
      ${args.reason},
      ${args.metadata == null ? null : JSON.stringify(args.metadata)}::jsonb,
      now()
    )
  `;

  return { id: transitionId };
}

export { metadataProjection };
