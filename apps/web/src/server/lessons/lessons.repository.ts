import { randomUUID } from "node:crypto";
import type { CourseLifecycleStatus } from "../courses/course-state-guards";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type LessonRow = {
  id: string;
  tenantId: string;
  moduleId: string;
  courseId: string;
  slug: string;
  title: string;
  contentJson: Record<string, unknown> | null;
  videoProvider: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  position: number;
  status: CourseLifecycleStatus;
  courseStatus: CourseLifecycleStatus;
  createdByMembershipId: string | null;
};

function mapContentFields(contentJson: Record<string, unknown> | null): {
  description: string | null;
  lessonType: string | null;
  content: unknown;
  isPreview: boolean;
} {
  if (!contentJson) {
    return { description: null, lessonType: null, content: null, isPreview: false };
  }

  const description =
    typeof contentJson["description"] === "string" ? contentJson["description"] : null;
  const lessonType = typeof contentJson["type"] === "string" ? contentJson["type"] : null;
  const isPreview = contentJson["isPreview"] === true;
  const rest = { ...contentJson };
  delete rest["description"];
  delete rest["type"];
  delete rest["isPreview"];
  const content =
    Object.keys(rest).length > 0 ? rest : contentJson["body"] != null ? contentJson["body"] : null;

  return { description, lessonType, content, isPreview };
}

export function buildLessonContentJson(input: {
  description?: string;
  lessonType?: string;
  content?: unknown;
  isPreview?: boolean;
}): Record<string, unknown> | null {
  const patch: Record<string, unknown> = {};

  if (input.description !== undefined) patch["description"] = input.description;
  if (input.lessonType !== undefined) patch["type"] = input.lessonType;
  if (input.isPreview !== undefined) patch["isPreview"] = input.isPreview;
  if (input.content !== undefined) {
    if (typeof input.content === "string") {
      patch["body"] = input.content;
    } else if (input.content && typeof input.content === "object") {
      Object.assign(patch, input.content as Record<string, unknown>);
    }
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export async function findLessonWithModuleAndCourse(args: {
  tx: Tx;
  lessonId: string;
}): Promise<LessonRow | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      tenant_id: string;
      module_id: string;
      course_id: string;
      slug: string;
      title: string;
      content_json: Record<string, unknown> | null;
      video_provider: string | null;
      video_url: string | null;
      duration_seconds: number | null;
      position: number;
      status: string;
      course_status: string;
      created_by_membership_id: string | null;
    }>
  >`
    select
      l.id::text,
      l.tenant_id::text,
      l.module_id::text,
      m.course_id::text,
      l.slug,
      l.title,
      l.content_json,
      l.video_provider,
      l.video_url,
      l.duration_seconds,
      l.position,
      l.status::text,
      c.status::text as course_status,
      c.created_by_membership_id::text
    from lessons l
    inner join course_modules m
      on m.id = l.module_id
     and m.tenant_id = l.tenant_id
    inner join courses c
      on c.id = m.course_id
     and c.tenant_id = m.tenant_id
    where l.id = ${args.lessonId}::uuid
      and l.deleted_at is null
      and m.deleted_at is null
      and c.deleted_at is null
    limit 1
  `;

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    tenantId: row.tenant_id,
    moduleId: row.module_id,
    courseId: row.course_id,
    slug: row.slug,
    title: row.title,
    contentJson: row.content_json,
    videoProvider: row.video_provider,
    videoUrl: row.video_url,
    durationSeconds: row.duration_seconds,
    position: row.position,
    status: row.status as CourseLifecycleStatus,
    courseStatus: row.course_status as CourseLifecycleStatus,
    createdByMembershipId: row.created_by_membership_id,
  };
}

export async function listLessonsForModuleBuilder(args: { tx: Tx; moduleId: string }) {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      position: number;
      status: string;
      duration_seconds: number | null;
    }>
  >`
    select
      l.id::text,
      l.slug,
      l.title,
      l.position,
      l.status::text,
      l.duration_seconds
    from lessons l
    where l.module_id = ${args.moduleId}::uuid
      and l.deleted_at is null
    order by l.position asc
  `;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    position: row.position,
    status: row.status as CourseLifecycleStatus,
    durationSeconds: row.duration_seconds,
  }));
}

export async function listPublishedLessonsForModule(args: { tx: Tx; moduleId: string }) {
  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      slug: string;
      title: string;
      position: number;
      duration_seconds: number | null;
    }>
  >`
    select
      l.id::text,
      l.slug,
      l.title,
      l.position,
      l.duration_seconds
    from lessons l
    where l.module_id = ${args.moduleId}::uuid
      and l.deleted_at is null
      and l.status = 'PUBLISHED'
    order by l.position asc
  `;

  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    title: row.title,
    position: row.position,
    durationSeconds: row.duration_seconds,
  }));
}

export async function findNextLessonPosition(args: { tx: Tx; moduleId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ max_position: number | null }>>`
    select max(position) as max_position
    from lessons
    where module_id = ${args.moduleId}::uuid
      and deleted_at is null
  `;

  return (rows[0]?.max_position ?? 0) + 1;
}

export async function lessonSlugExists(args: {
  tx: Tx;
  moduleId: string;
  slug: string;
  excludeLessonId?: string;
}): Promise<boolean> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from lessons
    where module_id = ${args.moduleId}::uuid
      and slug = ${args.slug}
      and deleted_at is null
      and (${args.excludeLessonId ?? null}::uuid is null or id <> ${args.excludeLessonId ?? null}::uuid)
    limit 1
  `;

  return rows.length > 0;
}

export async function insertLesson(args: {
  tx: Tx;
  tenantId: string;
  moduleId: string;
  slug: string;
  title: string;
  contentJson: Record<string, unknown> | null;
  videoProvider: string | null;
  videoUrl: string | null;
  durationSeconds: number | null;
  position: number;
}): Promise<{ id: string }> {
  const lessonId = randomUUID();

  await args.tx.$executeRaw`
    insert into lessons (
      id,
      tenant_id,
      module_id,
      slug,
      title,
      content_json,
      video_provider,
      video_url,
      duration_seconds,
      position,
      status,
      created_at,
      updated_at
    )
    values (
      ${lessonId}::uuid,
      ${args.tenantId}::uuid,
      ${args.moduleId}::uuid,
      ${args.slug},
      ${args.title},
      ${args.contentJson == null ? null : JSON.stringify(args.contentJson)}::jsonb,
      ${args.videoProvider},
      ${args.videoUrl},
      ${args.durationSeconds},
      ${args.position},
      'DRAFT'::"PublishStatus",
      now(),
      now()
    )
  `;

  return { id: lessonId };
}

export async function updateLessonRecord(args: {
  tx: Tx;
  lessonId: string;
  slug?: string;
  title?: string;
  contentJson?: Record<string, unknown> | null;
  videoProvider?: string | null;
  videoUrl?: string | null;
  durationSeconds?: number | null;
  position?: number;
}): Promise<void> {
  const contentJsonValue =
    args.contentJson === undefined
      ? null
      : args.contentJson == null
        ? null
        : JSON.stringify(args.contentJson);

  await args.tx.$executeRaw`
    update lessons
    set
      slug = coalesce(${args.slug ?? null}, slug),
      title = coalesce(${args.title ?? null}, title),
      content_json = case
        when ${args.contentJson !== undefined}::boolean then ${contentJsonValue}::jsonb
        else content_json
      end,
      video_provider = case
        when ${args.videoProvider !== undefined}::boolean then ${args.videoProvider ?? null}
        else video_provider
      end,
      video_url = case
        when ${args.videoUrl !== undefined}::boolean then ${args.videoUrl ?? null}
        else video_url
      end,
      duration_seconds = case
        when ${args.durationSeconds !== undefined}::boolean then ${args.durationSeconds ?? null}
        else duration_seconds
      end,
      position = coalesce(${args.position ?? null}, position),
      updated_at = now()
    where id = ${args.lessonId}::uuid
      and deleted_at is null
  `;
}

export async function archiveLessonRecord(args: { tx: Tx; lessonId: string }): Promise<void> {
  await args.tx.$executeRaw`
    update lessons
    set
      deleted_at = now(),
      updated_at = now()
    where id = ${args.lessonId}::uuid
      and deleted_at is null
  `;
}

export async function listPublishedLessonNavigation(args: {
  tx: Tx;
  courseId: string;
  currentLessonId: string;
}): Promise<{ previousLessonId: string | null; nextLessonId: string | null }> {
  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select l.id::text
    from lessons l
    inner join course_modules m
      on m.id = l.module_id
     and m.tenant_id = l.tenant_id
    where m.course_id = ${args.courseId}::uuid
      and m.deleted_at is null
      and m.status = 'PUBLISHED'
      and l.deleted_at is null
      and l.status = 'PUBLISHED'
    order by m.position asc, l.position asc
  `;

  const ids = rows.map((row) => row.id);
  const index = ids.indexOf(args.currentLessonId);

  return {
    previousLessonId: index > 0 ? (ids[index - 1] ?? null) : null,
    nextLessonId: index >= 0 && index < ids.length - 1 ? (ids[index + 1] ?? null) : null,
  };
}

export { mapContentFields };
