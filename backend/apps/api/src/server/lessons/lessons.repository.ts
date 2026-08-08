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

function parseLessonContentJson(value: unknown): Record<string, unknown> | null {
  if (value == null) return null;

  if (typeof value === "string") {
    try {
      const parsed: unknown = JSON.parse(value);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function resolveStoredLessonType(contentJson: Record<string, unknown> | null): string | null {
  if (!contentJson) return null;
  if (typeof contentJson["type"] === "string") return contentJson["type"];
  if (typeof contentJson["lessonType"] === "string") return contentJson["lessonType"];
  return null;
}

function inferLessonTypeFromFileName(fileName: string): string | null {
  const normalized = fileName.toLowerCase();
  if (normalized.endsWith(".pdf")) return "pdf";
  if (/\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(normalized)) return "audio";
  if (/\.(ppt|pptx|key)$/i.test(normalized)) return "slides";
  if (/\.(mp4|mov|webm|m4v|avi)$/i.test(normalized)) return "video";
  return null;
}

export function resolveLessonType(args: {
  contentJson: unknown;
  videoUrl?: string | null | undefined;
  videoProvider?: string | null | undefined;
  assetFileHint?: string | null | undefined;
}): string | null {
  const contentJson = parseLessonContentJson(args.contentJson);
  const stored = resolveStoredLessonType(contentJson);
  if (stored) return stored;

  if (args.videoUrl?.trim() || args.videoProvider?.trim()) return "video";

  const fileName = (
    typeof contentJson?.["primaryAssetFileName"] === "string"
      ? contentJson["primaryAssetFileName"]
      : typeof args.assetFileHint === "string"
        ? args.assetFileHint
        : ""
  ).toLowerCase();

  const inferredFromFile = inferLessonTypeFromFileName(fileName);
  if (inferredFromFile) return inferredFromFile;

  if (!contentJson) return null;

  if (contentJson["live"] && typeof contentJson["live"] === "object") return "live";
  if (typeof contentJson["assessmentId"] === "string" && contentJson["assessmentId"].trim()) {
    return "section_quiz";
  }

  const body = typeof contentJson["body"] === "string" ? contentJson["body"].trim() : "";
  if (body.length > 0) return "article";

  return null;
}

export function ensureLessonTypeInContentJson(args: {
  contentJson: Record<string, unknown> | null;
  videoUrl?: string | null | undefined;
  videoProvider?: string | null | undefined;
  assetFileHint?: string | null | undefined;
}): Record<string, unknown> | null {
  const resolved = resolveLessonType({
    contentJson: args.contentJson,
    videoUrl: args.videoUrl,
    videoProvider: args.videoProvider,
    assetFileHint: args.assetFileHint,
  });

  if (!resolved) return args.contentJson;
  if (resolveStoredLessonType(parseLessonContentJson(args.contentJson))) {
    return args.contentJson;
  }

  return mergeLessonContentJson(args.contentJson, { lessonType: resolved });
}

function mapContentFields(contentJson: unknown): {
  description: string | null;
  lessonType: string | null;
  content: unknown;
  isPreview: boolean;
} {
  const parsed = parseLessonContentJson(contentJson);
  if (!parsed) {
    return { description: null, lessonType: null, content: null, isPreview: false };
  }

  const description = typeof parsed["description"] === "string" ? parsed["description"] : null;
  const lessonType = resolveStoredLessonType(parsed);
  const isPreview = parsed["isPreview"] === true;
  const rest = { ...parsed };
  delete rest["description"];
  delete rest["type"];
  delete rest["lessonType"];
  delete rest["isPreview"];
  const content =
    Object.keys(rest).length > 0 ? rest : parsed["body"] != null ? parsed["body"] : null;

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

export function mergeLessonContentJson(
  existing: Record<string, unknown> | null,
  input: {
    description?: string;
    lessonType?: string;
    content?: unknown;
    isPreview?: boolean;
  },
): Record<string, unknown> | null {
  const merged: Record<string, unknown> = existing ? { ...existing } : {};

  if (input.description !== undefined) {
    merged["description"] = input.description;
  }
  if (input.lessonType !== undefined) {
    merged["type"] = input.lessonType;
    delete merged["lessonType"];
  }
  if (input.isPreview !== undefined) {
    merged["isPreview"] = input.isPreview;
  }
  if (input.content !== undefined) {
    if (typeof input.content === "string") {
      merged["body"] = input.content;
    } else if (
      input.content &&
      typeof input.content === "object" &&
      !Array.isArray(input.content)
    ) {
      for (const [key, value] of Object.entries(input.content as Record<string, unknown>)) {
        if (value === undefined) continue;
        merged[key] = value;
      }
    }
  }

  return Object.keys(merged).length > 0 ? merged : null;
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

export async function listLessonsForModuleBuilder(args: {
  tx: Tx;
  moduleId: string;
  tagId?: string | undefined;
}) {
  type LessonOutlineRow = {
    id: string;
    slug: string;
    title: string;
    position: number;
    status: string;
    duration_seconds: number | null;
    content_json: unknown;
    video_provider: string | null;
    video_url: string | null;
    asset_file_hint: string | null;
  };

  function mapLessonOutlineRow(row: LessonOutlineRow) {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      position: row.position,
      status: row.status as CourseLifecycleStatus,
      lessonType: resolveLessonType({
        contentJson: row.content_json,
        videoUrl: row.video_url,
        videoProvider: row.video_provider,
        assetFileHint: row.asset_file_hint,
      }),
      videoUrl: row.video_url,
      durationSeconds: row.duration_seconds,
      hiddenFromSyllabus: parseLessonContentJson(row.content_json)?.["displayInSyllabus"] === false,
    };
  }

  if (args.tagId) {
    const rows = await args.tx.$queryRaw<LessonOutlineRow[]>`
      select
        l.id::text,
        l.slug,
        l.title,
        l.position,
        l.status::text,
        l.duration_seconds,
        l.content_json,
        l.video_provider,
        l.video_url,
        (
          select coalesce(
            nullif(la.metadata_json->>'fileName', ''),
            nullif(la.object_key_or_url, '')
          )
          from lesson_assets la
          where la.lesson_id = l.id
            and la.deleted_at is null
          order by
            case when la.asset_type = 'lesson.asset' then 0 else 1 end,
            coalesce((la.metadata_json->>'displayOrder')::int, 0) asc,
            la.created_at asc
          limit 1
        ) as asset_file_hint
      from lessons l
      where l.module_id = ${args.moduleId}::uuid
        and l.deleted_at is null
        and exists (
          select 1
          from lesson_tags lt
          inner join tags t
            on t.id = lt.tag_id
           and t.tenant_id = lt.tenant_id
          where lt.lesson_id = l.id
            and lt.tenant_id = l.tenant_id
            and lt.tag_id = ${args.tagId}::uuid
            and t.deleted_at is null
        )
      order by l.position asc
    `;

    return rows.map(mapLessonOutlineRow);
  }

  const rows = await args.tx.$queryRaw<LessonOutlineRow[]>`
    select
      l.id::text,
      l.slug,
      l.title,
      l.position,
      l.status::text,
      l.duration_seconds,
      l.content_json,
      l.video_provider,
      l.video_url,
      (
        select coalesce(
          nullif(la.metadata_json->>'fileName', ''),
          nullif(la.object_key_or_url, '')
        )
        from lesson_assets la
        where la.lesson_id = l.id
          and la.deleted_at is null
        order by
          case when la.asset_type = 'lesson.asset' then 0 else 1 end,
          coalesce((la.metadata_json->>'displayOrder')::int, 0) asc,
          la.created_at asc
        limit 1
      ) as asset_file_hint
    from lessons l
    where l.module_id = ${args.moduleId}::uuid
      and l.deleted_at is null
    order by l.position asc
  `;

  return rows.map(mapLessonOutlineRow);
}

export async function repositionLessonInModule(args: {
  tx: Tx;
  moduleId: string;
  lessonId: string;
  targetPosition: number;
}): Promise<void> {
  const rows = await args.tx.$queryRaw<Array<{ id: string; position: number }>>`
    select id::text, position
    from lessons
    where module_id = ${args.moduleId}::uuid
      and deleted_at is null
    order by position asc, created_at asc
  `;

  const currentIndex = rows.findIndex((row) => row.id === args.lessonId);
  if (currentIndex === -1) return;

  const clampedTarget = Math.max(1, Math.min(args.targetPosition, rows.length));
  const targetIndex = clampedTarget - 1;
  if (currentIndex === targetIndex) return;

  const reordered = [...rows];
  const [moved] = reordered.splice(currentIndex, 1);
  if (!moved) return;
  reordered.splice(targetIndex, 0, moved);

  for (let index = 0; index < reordered.length; index += 1) {
    const row = reordered[index];
    const nextPosition = index + 1;
    if (!row || row.position === nextPosition) continue;

    await args.tx.$executeRaw`
      update lessons
      set
        position = ${nextPosition},
        updated_at = now()
      where id = ${row.id}::uuid
    `;
  }
}

export async function moveLessonToModule(args: {
  tx: Tx;
  lessonId: string;
  sourceModuleId: string;
  targetModuleId: string;
  targetPosition?: number;
}): Promise<void> {
  await args.tx.$executeRaw`
    update lessons
    set
      module_id = ${args.targetModuleId}::uuid,
      updated_at = now()
    where id = ${args.lessonId}::uuid
      and deleted_at is null
  `;

  await compactActiveLessonPositions({ tx: args.tx, moduleId: args.sourceModuleId });

  const targetRows = await args.tx.$queryRaw<Array<{ id: string }>>`
    select id::text
    from lessons
    where module_id = ${args.targetModuleId}::uuid
      and deleted_at is null
    order by position asc, created_at asc
  `;

  const targetPosition = args.targetPosition ?? targetRows.length;
  await repositionLessonInModule({
    tx: args.tx,
    moduleId: args.targetModuleId,
    lessonId: args.lessonId,
    targetPosition,
  });
}

export async function listPublishedLessonsForModule(args: {
  tx: Tx;
  moduleId: string;
  tagId?: string | undefined;
  publicTagFilter?: boolean | undefined;
}) {
  if (args.tagId && args.publicTagFilter) {
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
        and coalesce((l.content_json->>'displayInSyllabus')::boolean, true) = true
        and exists (
          select 1
          from lesson_tags lt
          inner join tags t
            on t.id = lt.tag_id
           and t.tenant_id = lt.tenant_id
          where lt.lesson_id = l.id
            and lt.tenant_id = l.tenant_id
            and lt.tag_id = ${args.tagId}::uuid
            and t.deleted_at is null
            and t.visibility = 'PUBLIC'::"LessonTagVisibility"
        )
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

  if (args.tagId) {
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
        and coalesce((l.content_json->>'displayInSyllabus')::boolean, true) = true
        and exists (
          select 1
          from lesson_tags lt
          inner join tags t
            on t.id = lt.tag_id
           and t.tenant_id = lt.tenant_id
          where lt.lesson_id = l.id
            and lt.tenant_id = l.tenant_id
            and lt.tag_id = ${args.tagId}::uuid
            and t.deleted_at is null
        )
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
      and coalesce((l.content_json->>'displayInSyllabus')::boolean, true) = true
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

const ARCHIVED_LESSON_POSITION_OFFSET = 1_000_000;

async function allocateArchivedLessonPosition(args: { tx: Tx; moduleId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ next_position: number }>>`
    select coalesce(max(l.position), ${ARCHIVED_LESSON_POSITION_OFFSET - 1}) + 1 as next_position
    from lessons l
    where l.module_id = ${args.moduleId}::uuid
      and l.deleted_at is not null
  `;

  return rows[0]?.next_position ?? ARCHIVED_LESSON_POSITION_OFFSET;
}

export async function releaseArchivedLessonPositions(args: { tx: Tx; moduleId: string }) {
  await args.tx.$executeRaw`
    update lessons
    set
      position = position + ${ARCHIVED_LESSON_POSITION_OFFSET},
      updated_at = now()
    where module_id = ${args.moduleId}::uuid
      and deleted_at is not null
      and position < ${ARCHIVED_LESSON_POSITION_OFFSET}
  `;
}

export async function compactActiveLessonPositions(args: { tx: Tx; moduleId: string }) {
  const rows = await args.tx.$queryRaw<Array<{ id: string; position: number }>>`
    select id::text, position
    from lessons
    where module_id = ${args.moduleId}::uuid
      and deleted_at is null
    order by position asc, created_at asc
  `;

  for (let index = 0; index < rows.length; index += 1) {
    const nextPosition = index + 1;
    const row = rows[index];
    if (!row || row.position === nextPosition) continue;

    await args.tx.$executeRaw`
      update lessons
      set
        position = ${nextPosition},
        updated_at = now()
      where id = ${row.id}::uuid
    `;
  }
}

export async function prepareLessonPositionsForModule(args: { tx: Tx; moduleId: string }) {
  await releaseArchivedLessonPositions(args);
  await compactActiveLessonPositions(args);
}

export async function findNextLessonPosition(args: { tx: Tx; moduleId: string }): Promise<number> {
  const rows = await args.tx.$queryRaw<Array<{ position: number }>>`
    select position
    from lessons
    where module_id = ${args.moduleId}::uuid
      and deleted_at is null
    order by position asc
  `;

  return rows.length + 1;
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

export async function archiveLessonRecord(args: {
  tx: Tx;
  lessonId: string;
  moduleId: string;
}): Promise<void> {
  const archivedPosition = await allocateArchivedLessonPosition({
    tx: args.tx,
    moduleId: args.moduleId,
  });

  await args.tx.$executeRaw`
    update lessons
    set
      deleted_at = now(),
      updated_at = now(),
      position = ${archivedPosition}
    where id = ${args.lessonId}::uuid
      and deleted_at is null
  `;

  await compactActiveLessonPositions({ tx: args.tx, moduleId: args.moduleId });
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

export async function findResumeLessonIdForLearner(args: {
  tx: Tx;
  courseId: string;
  membershipId: string;
}): Promise<string | null> {
  const rows = await args.tx.$queryRaw<
    Array<{
      lesson_id: string;
      status: string | null;
      last_seen_at: Date | null;
    }>
  >`
    with ordered_lessons as (
      select
        l.id::text as lesson_id,
        row_number() over (order by m.position asc, l.position asc) as ord
      from lessons l
      inner join course_modules m
        on m.id = l.module_id
       and m.tenant_id = l.tenant_id
      where m.course_id = ${args.courseId}::uuid
        and m.deleted_at is null
        and m.status = 'PUBLISHED'
        and l.deleted_at is null
        and l.status = 'PUBLISHED'
    )
    select
      ol.lesson_id,
      lp.status,
      lp.last_seen_at
    from ordered_lessons ol
    left join lesson_progress lp
      on lp.lesson_id = ol.lesson_id::uuid
     and lp.membership_id = ${args.membershipId}::uuid
    order by ol.ord asc
  `;

  if (rows.length === 0) {
    return null;
  }

  const inProgress = rows
    .filter((row) => row.status === "in_progress")
    .sort((left, right) => {
      const leftTime = left.last_seen_at?.getTime() ?? 0;
      const rightTime = right.last_seen_at?.getTime() ?? 0;
      return rightTime - leftTime;
    });

  if (inProgress[0]) {
    return inProgress[0].lesson_id;
  }

  const nextIncomplete = rows.find((row) => row.status !== "completed");
  return nextIncomplete?.lesson_id ?? rows[0]?.lesson_id ?? null;
}

export { mapContentFields };
