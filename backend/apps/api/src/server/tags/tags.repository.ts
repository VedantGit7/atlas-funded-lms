import { randomUUID } from "node:crypto";

type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
  $executeRaw(query: TemplateStringsArray, ...values: unknown[]): Promise<unknown>;
};

export type TagVisibility = "PUBLIC" | "PRIVATE" | "CLASSIFICATION";

export type TagRow = {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: TagVisibility;
  createdAt: Date;
  updatedAt: Date;
};

type TagRowDb = {
  id: string;
  tenant_id: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: string;
  created_at: Date;
  updated_at: Date;
};

function mapTagRow(row: TagRowDb): TagRow {
  const visibility =
    row.visibility === "PRIVATE" || row.visibility === "CLASSIFICATION"
      ? row.visibility
      : "PUBLIC";

  return {
    id: row.id,
    tenantId: row.tenant_id,
    title: row.title,
    slug: row.slug,
    description: row.description,
    visibility,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function slugifyTagTitle(title: string): string {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

export function toApiTagVisibility(value: TagVisibility): "public" | "private" | "classification" {
  if (value === "PRIVATE") return "private";
  if (value === "CLASSIFICATION") return "classification";
  return "public";
}

export function fromApiTagVisibility(value: string): TagVisibility {
  if (value === "private") return "PRIVATE";
  if (value === "classification") return "CLASSIFICATION";
  return "PUBLIC";
}

export async function listTags(args: {
  tx: Tx;
  tenantId: string;
  visibility?: TagVisibility;
  publicOnly?: boolean;
}): Promise<TagRow[]> {
  if (args.publicOnly) {
    const rows = await args.tx.$queryRaw<TagRowDb[]>`
      select
        id::text,
        tenant_id::text,
        title,
        slug,
        description,
        visibility::text,
        created_at,
        updated_at
      from tags
      where tenant_id = ${args.tenantId}::uuid
        and deleted_at is null
        and visibility = 'PUBLIC'::"LessonTagVisibility"
      order by title asc
    `;
    return rows.map(mapTagRow);
  }

  if (args.visibility) {
    const rows = await args.tx.$queryRaw<TagRowDb[]>`
      select
        id::text,
        tenant_id::text,
        title,
        slug,
        description,
        visibility::text,
        created_at,
        updated_at
      from tags
      where tenant_id = ${args.tenantId}::uuid
        and deleted_at is null
        and visibility = ${args.visibility}::"LessonTagVisibility"
      order by title asc
    `;
    return rows.map(mapTagRow);
  }

  const rows = await args.tx.$queryRaw<TagRowDb[]>`
    select
      id::text,
      tenant_id::text,
      title,
      slug,
      description,
      visibility::text,
      created_at,
      updated_at
    from tags
    where tenant_id = ${args.tenantId}::uuid
      and deleted_at is null
    order by title asc
  `;

  return rows.map(mapTagRow);
}

export async function findTagById(args: {
  tx: Tx;
  tenantId: string;
  tagId: string;
}): Promise<TagRow | null> {
  const rows = await args.tx.$queryRaw<TagRowDb[]>`
    select
      id::text,
      tenant_id::text,
      title,
      slug,
      description,
      visibility::text,
      created_at,
      updated_at
    from tags
    where id = ${args.tagId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and deleted_at is null
    limit 1
  `;

  const row = rows[0];
  return row ? mapTagRow(row) : null;
}

export async function tagSlugExists(args: {
  tx: Tx;
  tenantId: string;
  slug: string;
  excludeTagId?: string;
}): Promise<boolean> {
  if (args.excludeTagId) {
    const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
      select id::text
      from tags
      where tenant_id = ${args.tenantId}::uuid
        and slug = ${args.slug}
        and deleted_at is null
        and id <> ${args.excludeTagId}::uuid
      limit 1
    `;
    return rows.length > 0;
  }

  const rows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from tags
    where tenant_id = ${args.tenantId}::uuid
      and slug = ${args.slug}
      and deleted_at is null
    limit 1
  `;

  return rows.length > 0;
}

export async function insertTag(args: {
  tx: Tx;
  tenantId: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: TagVisibility;
}): Promise<TagRow> {
  const id = randomUUID();
  const rows = await args.tx.$queryRaw<TagRowDb[]>`
    insert into tags (
      id,
      tenant_id,
      title,
      slug,
      description,
      visibility
    )
    values (
      ${id}::uuid,
      ${args.tenantId}::uuid,
      ${args.title},
      ${args.slug},
      ${args.description},
      ${args.visibility}::"LessonTagVisibility"
    )
    returning
      id::text,
      tenant_id::text,
      title,
      slug,
      description,
      visibility::text,
      created_at,
      updated_at
  `;

  const row = rows[0];
  if (!row) throw new Error("Failed to create tag.");
  return mapTagRow(row);
}

export async function updateTagRecord(args: {
  tx: Tx;
  tenantId: string;
  tagId: string;
  title: string;
  slug: string;
  description: string | null;
  visibility: TagVisibility;
}): Promise<TagRow | null> {
  const rows = await args.tx.$queryRaw<TagRowDb[]>`
    update tags
    set
      title = ${args.title},
      slug = ${args.slug},
      description = ${args.description},
      visibility = ${args.visibility}::"LessonTagVisibility",
      updated_at = now()
    where id = ${args.tagId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and deleted_at is null
    returning
      id::text,
      tenant_id::text,
      title,
      slug,
      description,
      visibility::text,
      created_at,
      updated_at
  `;

  const row = rows[0];
  return row ? mapTagRow(row) : null;
}

export async function softDeleteTag(args: {
  tx: Tx;
  tenantId: string;
  tagId: string;
}): Promise<boolean> {
  const count = await args.tx.$executeRaw`
    update tags
    set deleted_at = now(), updated_at = now()
    where id = ${args.tagId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and deleted_at is null
  `;

  return Number(count) > 0;
}

export async function listTagsForLesson(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
  publicOnly?: boolean;
}): Promise<TagRow[]> {
  if (args.publicOnly) {
    const rows = await args.tx.$queryRaw<TagRowDb[]>`
      select
        t.id::text,
        t.tenant_id::text,
        t.title,
        t.slug,
        t.description,
        t.visibility::text,
        t.created_at,
        t.updated_at
      from lesson_tags lt
      inner join tags t
        on t.id = lt.tag_id
       and t.tenant_id = lt.tenant_id
      where lt.lesson_id = ${args.lessonId}::uuid
        and lt.tenant_id = ${args.tenantId}::uuid
        and t.deleted_at is null
        and t.visibility = 'PUBLIC'::"LessonTagVisibility"
      order by t.title asc
    `;
    return rows.map(mapTagRow);
  }

  const rows = await args.tx.$queryRaw<TagRowDb[]>`
    select
      t.id::text,
      t.tenant_id::text,
      t.title,
      t.slug,
      t.description,
      t.visibility::text,
      t.created_at,
      t.updated_at
    from lesson_tags lt
    inner join tags t
      on t.id = lt.tag_id
     and t.tenant_id = lt.tenant_id
    where lt.lesson_id = ${args.lessonId}::uuid
      and lt.tenant_id = ${args.tenantId}::uuid
      and t.deleted_at is null
    order by t.title asc
  `;

  return rows.map(mapTagRow);
}

export async function listLessonTagIds(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
}): Promise<string[]> {
  const rows = await args.tx.$queryRaw<Array<{ tag_id: string }>>`
    select tag_id::text
    from lesson_tags
    where lesson_id = ${args.lessonId}::uuid
      and tenant_id = ${args.tenantId}::uuid
  `;

  return rows.map((row) => row.tag_id);
}

export async function replaceLessonTags(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
  tagIds: string[];
}): Promise<void> {
  await args.tx.$executeRaw`
    delete from lesson_tags
    where lesson_id = ${args.lessonId}::uuid
      and tenant_id = ${args.tenantId}::uuid
  `;

  for (const tagId of args.tagIds) {
    await args.tx.$executeRaw`
      insert into lesson_tags (id, tenant_id, lesson_id, tag_id)
      values (${randomUUID()}::uuid, ${args.tenantId}::uuid, ${args.lessonId}::uuid, ${tagId}::uuid)
      on conflict (tenant_id, lesson_id, tag_id) do nothing
    `;
  }
}

export async function attachTagToLesson(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
  tagId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into lesson_tags (id, tenant_id, lesson_id, tag_id)
    values (${randomUUID()}::uuid, ${args.tenantId}::uuid, ${args.lessonId}::uuid, ${args.tagId}::uuid)
    on conflict (tenant_id, lesson_id, tag_id) do nothing
  `;
}

export async function detachTagFromLesson(args: {
  tx: Tx;
  tenantId: string;
  lessonId: string;
  tagId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    delete from lesson_tags
    where lesson_id = ${args.lessonId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and tag_id = ${args.tagId}::uuid
  `;
}

export async function listTagIdsForLessons(args: {
  tx: Tx;
  tenantId: string;
  lessonIds: string[];
  publicOnly?: boolean;
}): Promise<Map<string, TagRow[]>> {
  if (args.lessonIds.length === 0) return new Map();

  const rows = args.publicOnly
    ? await args.tx.$queryRaw<Array<TagRowDb & { lesson_id: string }>>`
        select
          lt.lesson_id::text,
          t.id::text,
          t.tenant_id::text,
          t.title,
          t.slug,
          t.description,
          t.visibility::text,
          t.created_at,
          t.updated_at
        from lesson_tags lt
        inner join tags t
          on t.id = lt.tag_id
         and t.tenant_id = lt.tenant_id
        where lt.tenant_id = ${args.tenantId}::uuid
          and lt.lesson_id = any(${args.lessonIds}::uuid[])
          and t.deleted_at is null
          and t.visibility = 'PUBLIC'::"LessonTagVisibility"
        order by t.title asc
      `
    : await args.tx.$queryRaw<Array<TagRowDb & { lesson_id: string }>>`
        select
          lt.lesson_id::text,
          t.id::text,
          t.tenant_id::text,
          t.title,
          t.slug,
          t.description,
          t.visibility::text,
          t.created_at,
          t.updated_at
        from lesson_tags lt
        inner join tags t
          on t.id = lt.tag_id
         and t.tenant_id = lt.tenant_id
        where lt.tenant_id = ${args.tenantId}::uuid
          and lt.lesson_id = any(${args.lessonIds}::uuid[])
          and t.deleted_at is null
        order by t.title asc
      `;

  const map = new Map<string, TagRow[]>();
  for (const row of rows) {
    const lessonId = row.lesson_id;
    const tags = map.get(lessonId) ?? [];
    tags.push(mapTagRow(row));
    map.set(lessonId, tags);
  }

  return map;
}

export async function validateTagIdsExist(args: {
  tx: Tx;
  tenantId: string;
  tagIds: string[];
}): Promise<boolean> {
  if (args.tagIds.length === 0) return true;

  const rows = await args.tx.$queryRaw<Array<{ count: bigint }>>`
    select count(*)::bigint as count
    from tags
    where tenant_id = ${args.tenantId}::uuid
      and deleted_at is null
      and id = any(${args.tagIds}::uuid[])
  `;

  return Number(rows[0]?.count ?? 0) === args.tagIds.length;
}

export async function listTagsForCourse(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  publicOnly?: boolean;
}): Promise<TagRow[]> {
  if (args.publicOnly) {
    const rows = await args.tx.$queryRaw<TagRowDb[]>`
      select
        t.id::text,
        t.tenant_id::text,
        t.title,
        t.slug,
        t.description,
        t.visibility::text,
        t.created_at,
        t.updated_at
      from course_tags ct
      inner join tags t
        on t.id = ct.tag_id
       and t.tenant_id = ct.tenant_id
      where ct.course_id = ${args.courseId}::uuid
        and ct.tenant_id = ${args.tenantId}::uuid
        and t.deleted_at is null
        and t.visibility = 'PUBLIC'::"LessonTagVisibility"
      order by t.title asc
    `;
    return rows.map(mapTagRow);
  }

  const rows = await args.tx.$queryRaw<TagRowDb[]>`
    select
      t.id::text,
      t.tenant_id::text,
      t.title,
      t.slug,
      t.description,
      t.visibility::text,
      t.created_at,
      t.updated_at
    from course_tags ct
    inner join tags t
      on t.id = ct.tag_id
     and t.tenant_id = ct.tenant_id
    where ct.course_id = ${args.courseId}::uuid
      and ct.tenant_id = ${args.tenantId}::uuid
      and t.deleted_at is null
    order by t.title asc
  `;

  return rows.map(mapTagRow);
}

export async function listCourseTagIds(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
}): Promise<string[]> {
  const rows = await args.tx.$queryRaw<Array<{ tag_id: string }>>`
    select tag_id::text
    from course_tags
    where course_id = ${args.courseId}::uuid
      and tenant_id = ${args.tenantId}::uuid
  `;

  return rows.map((row) => row.tag_id);
}

export async function replaceCourseTags(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  tagIds: string[];
}): Promise<void> {
  await args.tx.$executeRaw`
    delete from course_tags
    where course_id = ${args.courseId}::uuid
      and tenant_id = ${args.tenantId}::uuid
  `;

  for (const tagId of args.tagIds) {
    await args.tx.$executeRaw`
      insert into course_tags (id, tenant_id, course_id, tag_id)
      values (${randomUUID()}::uuid, ${args.tenantId}::uuid, ${args.courseId}::uuid, ${tagId}::uuid)
      on conflict (tenant_id, course_id, tag_id) do nothing
    `;
  }
}

export async function attachTagToCourse(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  tagId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    insert into course_tags (id, tenant_id, course_id, tag_id)
    values (${randomUUID()}::uuid, ${args.tenantId}::uuid, ${args.courseId}::uuid, ${args.tagId}::uuid)
    on conflict (tenant_id, course_id, tag_id) do nothing
  `;
}

export async function detachTagFromCourse(args: {
  tx: Tx;
  tenantId: string;
  courseId: string;
  tagId: string;
}): Promise<void> {
  await args.tx.$executeRaw`
    delete from course_tags
    where course_id = ${args.courseId}::uuid
      and tenant_id = ${args.tenantId}::uuid
      and tag_id = ${args.tagId}::uuid
  `;
}
