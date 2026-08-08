type Tx = {
  $queryRaw<T = unknown>(query: TemplateStringsArray, ...values: unknown[]): Promise<T>;
};

export type ResourceKind = "pdf" | "video" | "link" | "document";
export type ResourceSort = "recent" | "name" | "size";

export type ResourceAssetRow = {
  id: string;
  kind: ResourceKind;
  title: string;
  category: string | null;
  sizeBytes: bigint | null;
  contentType: string | null;
  createdAt: Date;
  courseId: string;
  courseTitle: string;
  lessonId: string;
  lessonTitle: string;
  provider: string;
  objectKeyOrUrl: string;
  totalCount: number;
};

export type ResourceFacetRow = {
  kind: ResourceKind;
  category: string | null;
};

export type ResourceListArgs = {
  tx: Tx;
  membershipId: string;
  limit: number;
  offset: number;
  q: string | null;
  kinds: string[] | null;
  categories: string[] | null;
  sort: ResourceSort;
};

/**
 * Aggregates every published, accessible lesson asset the learner can reach
 * (enrolled + published course/module/lesson) into a flat resource library.
 *
 * `kind` is derived once in SQL from the storage content-type, file name, and
 * external URL so it can be filtered, sorted, and faceted server-side. Tenant
 * isolation relies on the TenantTx (RLS), matching the other learner queries.
 */
export async function listLearnerResources(args: ResourceListArgs): Promise<ResourceAssetRow[]> {
  const q = args.q ? `%${args.q}%` : null;
  const kinds = args.kinds && args.kinds.length > 0 ? args.kinds : null;
  const categories = args.categories && args.categories.length > 0 ? args.categories : null;
  const sort = args.sort;

  const rows = await args.tx.$queryRaw<
    Array<{
      id: string;
      kind: ResourceKind;
      title: string;
      category: string | null;
      size_bytes: bigint | null;
      content_type: string | null;
      created_at: Date;
      course_id: string;
      course_title: string;
      lesson_id: string;
      lesson_title: string;
      provider: string;
      object_key_or_url: string;
      total_count: number;
    }>
  >`
    with base as (
      select
        la.id::text as id,
        case
          when la.provider <> 'r2' and la.object_key_or_url ~* '(youtube\\.com|youtu\\.be|vimeo\\.com|wistia|loom\\.com)' then 'video'
          when la.provider <> 'r2' and la.object_key_or_url ~* '\\.(mp4|mov|webm|m4v)(\\?|$)' then 'video'
          when la.provider <> 'r2' and la.object_key_or_url ~* '^https?://' then 'link'
          when coalesce(sr.content_type, la.metadata_json->>'contentType', '') ilike 'application/pdf%' then 'pdf'
          when coalesce(sr.file_name, la.metadata_json->>'fileName', '') ~* '\\.pdf$' then 'pdf'
          when coalesce(sr.content_type, la.metadata_json->>'contentType', '') ilike 'video/%' then 'video'
          when coalesce(sr.file_name, la.metadata_json->>'fileName', '') ~* '\\.(mp4|mov|webm|m4v|avi)$' then 'video'
          else 'document'
        end as kind,
        coalesce(
          nullif(sr.file_name, ''),
          nullif(la.metadata_json->>'fileName', ''),
          l.title
        ) as title,
        coalesce(c.metadata_json->>'category', c.metadata_json->>'stage') as category,
        sr.size_bytes as size_bytes,
        coalesce(sr.content_type, la.metadata_json->>'contentType') as content_type,
        la.created_at as created_at,
        c.id::text as course_id,
        c.title as course_title,
        l.id::text as lesson_id,
        l.title as lesson_title,
        la.provider as provider,
        la.object_key_or_url as object_key_or_url
      from lesson_assets la
      inner join lessons l
        on l.id = la.lesson_id
       and l.tenant_id = la.tenant_id
       and l.deleted_at is null
       and l.status = 'PUBLISHED'
      inner join course_modules m
        on m.id = l.module_id
       and m.tenant_id = l.tenant_id
       and m.deleted_at is null
       and m.status = 'PUBLISHED'
      inner join courses c
        on c.id = m.course_id
       and c.tenant_id = m.tenant_id
       and c.deleted_at is null
       and c.status = 'PUBLISHED'
      inner join enrollments e
        on e.course_id = c.id
       and e.membership_id = ${args.membershipId}::uuid
       and e.status = 'active'
      left join storage_references sr
        on la.provider = 'r2'
       and sr.id::text = la.object_key_or_url
       and sr.deleted_at is null
      where la.deleted_at is null
    )
    select
      id,
      kind,
      title,
      category,
      size_bytes,
      content_type,
      created_at,
      course_id,
      course_title,
      lesson_id,
      lesson_title,
      provider,
      object_key_or_url,
      cast(count(*) over () as int) as total_count
    from base
    where (${kinds}::text[] is null or kind = any(${kinds}::text[]))
      and (${categories}::text[] is null or category = any(${categories}::text[]))
      and (
        ${q}::text is null
        or title ilike ${q}
        or lesson_title ilike ${q}
        or course_title ilike ${q}
      )
    order by
      (case when ${sort} = 'recent' then extract(epoch from created_at) end) desc nulls last,
      (case when ${sort} = 'name' then lower(title) end) asc nulls last,
      (case when ${sort} = 'size' then size_bytes::double precision end) desc nulls last,
      created_at desc,
      id desc
    limit ${args.limit}
    offset ${args.offset}
  `;

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    title: row.title,
    category: row.category,
    sizeBytes: row.size_bytes,
    contentType: row.content_type,
    createdAt: row.created_at,
    courseId: row.course_id,
    courseTitle: row.course_title,
    lessonId: row.lesson_id,
    lessonTitle: row.lesson_title,
    provider: row.provider,
    objectKeyOrUrl: row.object_key_or_url,
    totalCount: row.total_count,
  }));
}

/**
 * Distinct (kind, category) pairs across the learner's full resource set so the
 * filter rail can list real categories and file types regardless of the active
 * filters or pagination window.
 */
export async function listLearnerResourceFacets(args: {
  tx: Tx;
  membershipId: string;
}): Promise<ResourceFacetRow[]> {
  const rows = await args.tx.$queryRaw<Array<{ kind: ResourceKind; category: string | null }>>`
    with base as (
      select
        case
          when la.provider <> 'r2' and la.object_key_or_url ~* '(youtube\\.com|youtu\\.be|vimeo\\.com|wistia|loom\\.com)' then 'video'
          when la.provider <> 'r2' and la.object_key_or_url ~* '\\.(mp4|mov|webm|m4v)(\\?|$)' then 'video'
          when la.provider <> 'r2' and la.object_key_or_url ~* '^https?://' then 'link'
          when coalesce(sr.content_type, la.metadata_json->>'contentType', '') ilike 'application/pdf%' then 'pdf'
          when coalesce(sr.file_name, la.metadata_json->>'fileName', '') ~* '\\.pdf$' then 'pdf'
          when coalesce(sr.content_type, la.metadata_json->>'contentType', '') ilike 'video/%' then 'video'
          when coalesce(sr.file_name, la.metadata_json->>'fileName', '') ~* '\\.(mp4|mov|webm|m4v|avi)$' then 'video'
          else 'document'
        end as kind,
        coalesce(c.metadata_json->>'category', c.metadata_json->>'stage') as category
      from lesson_assets la
      inner join lessons l
        on l.id = la.lesson_id
       and l.tenant_id = la.tenant_id
       and l.deleted_at is null
       and l.status = 'PUBLISHED'
      inner join course_modules m
        on m.id = l.module_id
       and m.tenant_id = l.tenant_id
       and m.deleted_at is null
       and m.status = 'PUBLISHED'
      inner join courses c
        on c.id = m.course_id
       and c.tenant_id = m.tenant_id
       and c.deleted_at is null
       and c.status = 'PUBLISHED'
      inner join enrollments e
        on e.course_id = c.id
       and e.membership_id = ${args.membershipId}::uuid
       and e.status = 'active'
      left join storage_references sr
        on la.provider = 'r2'
       and sr.id::text = la.object_key_or_url
       and sr.deleted_at is null
      where la.deleted_at is null
    )
    select distinct kind, category
    from base
  `;

  return rows.map((row) => ({ kind: row.kind, category: row.category }));
}
