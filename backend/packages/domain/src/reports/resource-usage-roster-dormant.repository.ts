import type { TenantTx } from "@atlas/db";
import type { ResourceUsageDormantQuery } from "./resource-usage-roster.dto";
import type {
  ResourceUsageDormantRow,
  ResourceUsageDormantSummaryRow,
} from "./resource-usage-roster.repository";
import { roundGb } from "./resource-usage-roster.repository-helpers";

/**
 * Dormant courses: the list, summary, one course and archiving.
 * Part of resourceUsageRosterRepository.
 */
export const resourceUsageRosterDormantRepository = {
  async countDormant(tx: TenantTx, query: ResourceUsageDormantQuery): Promise<number> {
    const rows = await this.listDormantFiltered(tx, query, { countOnly: true });
    return Number(rows[0]?.["count"] ?? 0);
  },

  async listDormant(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
  ): Promise<ResourceUsageDormantRow[]> {
    const rows = await this.listDormantFiltered(tx, query, { countOnly: false });
    return rows.map((row) => ({
      course_id: String(row["course_id"]),
      title: String(row["title"]),
      status: String(row["status"]),
      lesson_count: Number(row["lesson_count"]),
      storage_gb: roundGb(Number(row["storage_gb"])),
      active_enrolment_count: Number(row["active_enrolment_count"]),
      inactive_enrolment_count: Number(row["inactive_enrolment_count"]),
      last_learner_activity_at: (row["last_learner_activity_at"] as Date | null) ?? null,
      dormant_days: Number(row["dormant_days"]),
      created_at: (row["created_at"] as Date | null) ?? null,
    }));
  },

  async listDormantFiltered(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
    opts: { countOnly: boolean },
  ): Promise<Array<Record<string, unknown>>> {
    const q = query.q ?? null;
    const dormantDays = query.dormantDays;
    const minLessons = query.minLessons;
    const includeUnpublished = query.includeUnpublished;
    const includeArchived = query.includeArchived;
    const status = query.status;
    const view = query.view;
    const dormantForMin = query.dormantForMin ?? null;
    const storageMinGb = query.storageMinGb ?? null;
    const enrolmentFilter = query.enrolmentFilter;
    const sort = query.sort;
    const offset = (query.page - 1) * query.limit;

    if (opts.countOnly) {
      return tx.$queryRaw<Array<Record<string, unknown>>>`
        with course_activity as (
          select
            c.id as course_id,
            c.title,
            c.status::text as status,
            c.created_at,
            count(distinct l.id)::int as lesson_count,
            max(lp.last_seen_at) as last_learner_activity_at,
            coalesce((
              select sum(sr.size_bytes)::float8 / 1e9
              from storage_references sr
              where sr.deleted_at is null
                and sr.tenant_id = c.tenant_id
                and (
                  (sr.resource_type = 'course' and sr.resource_id = c.id)
                  or (
                    sr.resource_type = 'course_module'
                    and sr.resource_id in (
                      select cm2.id from course_modules cm2
                      where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                    )
                  )
                  or (
                    sr.resource_type = 'lesson'
                    and sr.resource_id in (
                      select l2.id from lessons l2
                      join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                      where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                        and l2.deleted_at is null and cm3.deleted_at is null
                    )
                  )
                )
            ), 0) as storage_gb,
            coalesce((
              select count(*)::int from enrollments e
              where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status = 'active'
            ), 0) as active_enrolment_count,
            coalesce((
              select count(*)::int from enrollments e
              where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status <> 'active'
            ), 0) as inactive_enrolment_count
          from courses c
          left join course_modules cm
            on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
          left join lessons l
            on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
          left join lesson_progress lp
            on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
          where c.tenant_id = current_setting('app.tenant_id', true)::uuid
            and c.deleted_at is null
            and (
              c.status = 'PUBLISHED'
              or (${includeUnpublished}::boolean and c.status in ('DRAFT', 'REVIEW'))
              or (${includeArchived}::boolean and c.status = 'ARCHIVED')
            )
            and (
              ${q}::text is null
              or lower(c.title) like '%' || lower(${q}) || '%'
            )
          group by c.id, c.title, c.status, c.created_at
        ),
        dormant as (
          select
            *,
            greatest(
              0,
              floor(
                extract(
                  epoch from (
                    now() - coalesce(last_learner_activity_at, created_at, now())
                  )
                ) / 86400
              )
            )::int as dormant_days
          from course_activity
          where lesson_count >= ${minLessons}::int
            and (
              last_learner_activity_at is null
              or last_learner_activity_at < now() - make_interval(days => ${dormantDays}::int)
            )
        )
        select count(*)::bigint as count
        from dormant
        where (
            ${status}::text = 'all'
            or (${status}::text = 'published' and status = 'PUBLISHED')
            or (${status}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
            or (${status}::text = 'archived' and status = 'ARCHIVED')
          )
          and (
            ${view}::text = 'all'
            or (${view}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
            or (${view}::text = 'large' and storage_gb > 1)
            or (${view}::text = 'never_opened' and last_learner_activity_at is null)
          )
          and (${dormantForMin}::int is null or dormant_days >= ${dormantForMin}::int)
          and (${storageMinGb}::float8 is null or storage_gb >= ${storageMinGb}::float8)
          and (
            ${enrolmentFilter}::text = 'any'
            or (${enrolmentFilter}::text = 'zero_active' and active_enrolment_count = 0)
            or (${enrolmentFilter}::text = 'has_active' and active_enrolment_count > 0)
          )
      `;
    }

    return tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_activity as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          count(distinct l.id)::int as lesson_count,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status = 'active'
          ), 0) as active_enrolment_count,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = c.tenant_id and e.course_id = c.id and e.status <> 'active'
          ), 0) as inactive_enrolment_count
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (
            c.status = 'PUBLISHED'
            or (${includeUnpublished}::boolean and c.status in ('DRAFT', 'REVIEW'))
            or (${includeArchived}::boolean and c.status = 'ARCHIVED')
          )
          and (
            ${q}::text is null
            or lower(c.title) like '%' || lower(${q}) || '%'
          )
        group by c.id, c.title, c.status, c.created_at
      ),
      dormant as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  now() - coalesce(last_learner_activity_at, created_at, now())
                )
              ) / 86400
            )
          )::int as dormant_days
        from course_activity
        where lesson_count >= ${minLessons}::int
          and (
            last_learner_activity_at is null
            or last_learner_activity_at < now() - make_interval(days => ${dormantDays}::int)
          )
      )
      select
        course_id::text as course_id,
        title,
        status,
        lesson_count,
        storage_gb,
        active_enrolment_count,
        inactive_enrolment_count,
        last_learner_activity_at,
        dormant_days,
        created_at
      from dormant
      where (
          ${status}::text = 'all'
          or (${status}::text = 'published' and status = 'PUBLISHED')
          or (${status}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
          or (${status}::text = 'archived' and status = 'ARCHIVED')
        )
        and (
          ${view}::text = 'all'
          or (${view}::text = 'unpublished' and status in ('DRAFT', 'REVIEW'))
          or (${view}::text = 'large' and storage_gb > 1)
          or (${view}::text = 'never_opened' and last_learner_activity_at is null)
        )
        and (${dormantForMin}::int is null or dormant_days >= ${dormantForMin}::int)
        and (${storageMinGb}::float8 is null or storage_gb >= ${storageMinGb}::float8)
        and (
          ${enrolmentFilter}::text = 'any'
          or (${enrolmentFilter}::text = 'zero_active' and active_enrolment_count = 0)
          or (${enrolmentFilter}::text = 'has_active' and active_enrolment_count > 0)
        )
      order by
        case when ${sort}::text = 'storage_desc' then storage_gb end desc nulls last,
        case when ${sort}::text = 'dormant_desc' then dormant_days end desc nulls last,
        case when ${sort}::text = 'lessons_desc' then lesson_count end desc nulls last,
        case when ${sort}::text = 'activity_asc' then last_learner_activity_at end asc nulls first,
        case when ${sort}::text = 'title_asc' then title end asc nulls last,
        storage_gb desc,
        title asc
      limit ${query.limit} offset ${offset}
    `;
  },

  async getDormantSummary(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
  ): Promise<ResourceUsageDormantSummaryRow> {
    const dormantDays = query.dormantDays;
    const minLessons = query.minLessons;
    const includeUnpublished = query.includeUnpublished;
    const includeArchived = query.includeArchived;

    const rows = await tx.$queryRaw<Array<ResourceUsageDormantSummaryRow>>`
      with scoped as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          count(distinct l.id)::int as lesson_count,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and sr.tenant_id = c.tenant_id
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and (
            c.status = 'PUBLISHED'
            or (${includeUnpublished}::boolean and c.status in ('DRAFT', 'REVIEW'))
            or (${includeArchived}::boolean and c.status = 'ARCHIVED')
          )
        group by c.id, c.title, c.status, c.created_at
      ),
      dormant as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  now() - coalesce(last_learner_activity_at, created_at, now())
                )
              ) / 86400
            )
          )::int as dormant_days
        from scoped
        where lesson_count >= ${minLessons}::int
          and (
            last_learner_activity_at is null
            or last_learner_activity_at < now() - make_interval(days => ${dormantDays}::int)
          )
      ),
      totals as (
        select
          count(*)::int as total_course_count,
          coalesce(sum(storage_gb), 0)::float8 as total_storage_gb
        from scoped
      )
      select
        (select count(*)::int from dormant) as dormant_course_count,
        (select total_course_count from totals) as total_course_count,
        coalesce((select sum(storage_gb) from dormant), 0)::float8 as storage_held_gb,
        (select total_storage_gb from totals) as total_storage_gb,
        (
          select count(*)::int from dormant where status in ('DRAFT', 'REVIEW')
        ) as unpublished_dormant_count,
        (select max(dormant_days) from dormant) as longest_dormant_days,
        (
          select course_id::text from dormant order by dormant_days desc, storage_gb desc limit 1
        ) as longest_dormant_course_id,
        (
          select title from dormant order by dormant_days desc, storage_gb desc limit 1
        ) as longest_dormant_title,
        coalesce((select sum(lesson_count) from dormant), 0)::int as lessons_affected,
        (select count(*)::int from dormant) as view_all,
        (
          select count(*)::int from dormant where status in ('DRAFT', 'REVIEW')
        ) as view_unpublished,
        (select count(*)::int from dormant where storage_gb > 1) as view_large,
        (
          select count(*)::int from dormant where last_learner_activity_at is null
        ) as view_never_opened
    `;

    const row = rows[0];
    return {
      dormant_course_count: row?.dormant_course_count ?? 0,
      total_course_count: row?.total_course_count ?? 0,
      storage_held_gb: roundGb(row?.storage_held_gb ?? 0),
      total_storage_gb: roundGb(row?.total_storage_gb ?? 0),
      unpublished_dormant_count: row?.unpublished_dormant_count ?? 0,
      longest_dormant_days: row?.longest_dormant_days == null ? null : row.longest_dormant_days,
      longest_dormant_course_id: row?.longest_dormant_course_id ?? null,
      longest_dormant_title: row?.longest_dormant_title ?? null,
      lessons_affected: row?.lessons_affected ?? 0,
      view_all: row?.view_all ?? 0,
      view_unpublished: row?.view_unpublished ?? 0,
      view_large: row?.view_large ?? 0,
      view_never_opened: row?.view_never_opened ?? 0,
    };
  },

  async archiveDormantCourses(
    tx: TenantTx,
    args: {
      courseIds: string[];
      action: "archive" | "unpublish";
      deleteAssets: boolean;
    },
  ): Promise<{
    processedIds: string[];
    skippedIds: string[];
    deletedAssetsGb: number;
  }> {
    const processedIds: string[] = [];
    const skippedIds: string[] = [];
    let deletedAssetsGb = 0;

    for (const courseId of args.courseIds) {
      const existing = await tx.$queryRaw<Array<{ id: string; status: string }>>`
        select id::text as id, status::text as status
        from courses
        where id = ${courseId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
          and deleted_at is null
        limit 1
      `;
      if (!existing[0] || existing[0].status === "ARCHIVED") {
        skippedIds.push(courseId);
        continue;
      }

      if (args.action === "archive") {
        await tx.$executeRaw`
          update courses
          set status = 'ARCHIVED'::"PublishStatus", updated_at = now()
          where id = ${courseId}::uuid
            and tenant_id = current_setting('app.tenant_id', true)::uuid
            and deleted_at is null
        `;
      } else {
        await tx.$executeRaw`
          update courses
          set status = 'DRAFT'::"PublishStatus", updated_at = now()
          where id = ${courseId}::uuid
            and tenant_id = current_setting('app.tenant_id', true)::uuid
            and deleted_at is null
            and status <> 'ARCHIVED'::"PublishStatus"
        `;
      }

      if (args.deleteAssets && args.action === "archive") {
        const sizeRows = await tx.$queryRaw<Array<{ storage_gb: number }>>`
          select coalesce(sum(sr.size_bytes), 0)::float8 / 1e9 as storage_gb
          from storage_references sr
          where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
            and sr.deleted_at is null
            and (
              (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
              or (
                sr.resource_type = 'course_module'
                and sr.resource_id in (
                  select cm.id from course_modules cm
                  where cm.course_id = ${courseId}::uuid
                    and cm.tenant_id = sr.tenant_id
                    and cm.deleted_at is null
                )
              )
              or (
                sr.resource_type = 'lesson'
                and sr.resource_id in (
                  select l.id from lessons l
                  join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                  where cm.course_id = ${courseId}::uuid
                    and l.tenant_id = sr.tenant_id
                    and l.deleted_at is null
                    and cm.deleted_at is null
                )
              )
            )
        `;
        deletedAssetsGb += sizeRows[0]?.storage_gb ?? 0;
        await tx.$executeRaw`
          update storage_references sr
          set deleted_at = now()
          where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
            and sr.deleted_at is null
            and (
              (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
              or (
                sr.resource_type = 'course_module'
                and sr.resource_id in (
                  select cm.id from course_modules cm
                  where cm.course_id = ${courseId}::uuid
                    and cm.tenant_id = sr.tenant_id
                    and cm.deleted_at is null
                )
              )
              or (
                sr.resource_type = 'lesson'
                and sr.resource_id in (
                  select l.id from lessons l
                  join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                  where cm.course_id = ${courseId}::uuid
                    and l.tenant_id = sr.tenant_id
                    and l.deleted_at is null
                    and cm.deleted_at is null
                )
              )
            )
        `;
      }

      processedIds.push(courseId);
    }

    return {
      processedIds,
      skippedIds,
      deletedAssetsGb: roundGb(deletedAssetsGb),
    };
  },

  async getDormantCourseDetail(
    tx: TenantTx,
    courseId: string,
    _dormantDays: number,
  ): Promise<{
    course: {
      course_id: string;
      title: string;
      status: string;
      created_at: Date | null;
      dormant_days: number;
      never_opened: boolean;
      last_learner_activity_at: Date | null;
    } | null;
    summary: {
      storage_gb: number;
      total_tenant_storage_gb: number;
      lesson_count: number;
      lessons_with_assets_count: number;
      file_count: number;
      enrolment_total: number;
      enrolment_active: number;
      enrolment_active_in_90d: number;
    };
    composition: Array<{ key: string; label: string; storage_gb: number }>;
    top_files: Array<{
      file_name: string;
      content_type: string | null;
      asset_type_key: string;
      size_bytes: number;
      lesson_id: string | null;
      lesson_title: string | null;
      uploaded_at: Date | null;
    }>;
    certificates_remain_valid: number;
    lessons: Array<{
      lesson_id: string;
      position: number;
      title: string;
      video_provider: string | null;
      video_url: string | null;
      duration_seconds: number | null;
      storage_gb: number;
      last_opened_at: Date | null;
      has_scorm: boolean;
    }>;
  }> {
    const courseRows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        status: string;
        created_at: Date | null;
        dormant_days: number;
        never_opened: boolean;
        last_learner_activity_at: Date | null;
        storage_gb: number;
        lesson_count: number;
        lessons_with_assets_count: number;
        file_count: number;
        enrolment_total: number;
        enrolment_active: number;
        enrolment_active_in_90d: number;
      }>
    >`
      with course_scope as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          c.tenant_id,
          (
            select max(lp.last_seen_at)
            from lesson_progress lp
            join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
            join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
            where cm.course_id = c.id
              and lp.tenant_id = c.tenant_id
          ) as last_learner_activity_at
        from courses c
        where c.id = ${courseId}::uuid
          and c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
      ),
      course_lessons as (
        select l.id as lesson_id
        from course_scope cs
        join course_modules cm
          on cm.course_id = cs.course_id
          and cm.tenant_id = cs.tenant_id
          and cm.deleted_at is null
        join lessons l
          on l.module_id = cm.id
          and l.tenant_id = cs.tenant_id
          and l.deleted_at is null
      ),
      course_modules_scope as (
        select cm.id as module_id
        from course_scope cs
        join course_modules cm
          on cm.course_id = cs.course_id
          and cm.tenant_id = cs.tenant_id
          and cm.deleted_at is null
      ),
      storage_scope as (
        select sr.*
        from course_scope cs
        join storage_references sr
          on sr.tenant_id = cs.tenant_id
          and sr.deleted_at is null
          and (
            (sr.resource_type = 'course' and sr.resource_id = cs.course_id)
            or (
              sr.resource_type = 'course_module'
              and sr.resource_id in (select module_id from course_modules_scope)
            )
            or (
              sr.resource_type = 'lesson'
              and sr.resource_id in (select lesson_id from course_lessons)
            )
          )
      )
      select
        cs.course_id::text as course_id,
        cs.title,
        cs.status,
        cs.created_at,
        cs.last_learner_activity_at,
        (cs.last_learner_activity_at is null) as never_opened,
        greatest(
          0,
          floor(
            extract(
              epoch from (
                now() - coalesce(cs.last_learner_activity_at, cs.created_at, now())
              )
            ) / 86400
          )
        )::int as dormant_days,
        coalesce((select sum(size_bytes)::float8 / 1e9 from storage_scope), 0) as storage_gb,
        coalesce((select count(*)::int from course_lessons), 0) as lesson_count,
        coalesce((
          select count(distinct sr.resource_id)::int
          from storage_scope sr
          where sr.resource_type = 'lesson'
            and sr.resource_id is not null
        ), 0) as lessons_with_assets_count,
        coalesce((select count(*)::int from storage_scope), 0) as file_count,
        coalesce((
          select count(*)::int from enrollments e
          where e.tenant_id = cs.tenant_id and e.course_id = cs.course_id
        ), 0) as enrolment_total,
        coalesce((
          select count(*)::int from enrollments e
          where e.tenant_id = cs.tenant_id and e.course_id = cs.course_id and e.status = 'active'
        ), 0) as enrolment_active,
        coalesce((
          select count(distinct e.membership_id)::int
          from enrollments e
          where e.tenant_id = cs.tenant_id
            and e.course_id = cs.course_id
            and exists (
              select 1
              from lesson_progress lp
              join course_lessons cl on cl.lesson_id = lp.lesson_id
              where lp.membership_id = e.membership_id
                and lp.tenant_id = e.tenant_id
                and lp.last_seen_at >= now() - interval '90 days'
            )
        ), 0) as enrolment_active_in_90d
      from course_scope cs
    `;

    const courseRow = courseRows[0];
    if (!courseRow) {
      return {
        course: null,
        summary: {
          storage_gb: 0,
          total_tenant_storage_gb: 0,
          lesson_count: 0,
          lessons_with_assets_count: 0,
          file_count: 0,
          enrolment_total: 0,
          enrolment_active: 0,
          enrolment_active_in_90d: 0,
        },
        composition: [],
        top_files: [],
        certificates_remain_valid: 0,
        lessons: [],
      };
    }

    const assetLabels: Record<string, string> = {
      video: "Video",
      documents: "Documents",
      images: "Images",
      audio: "Audio",
      scorm: "SCORM",
      attachments: "Attachments",
      backups: "Backups",
    };

    const [tenantStorageRows, compositionRows, topFileRows, certificateRows, lessonRows] =
      await Promise.all([
        tx.$queryRaw<Array<{ storage_gb: number }>>`
        select coalesce(sum(size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and deleted_at is null
      `,
        tx.$queryRaw<Array<{ asset_key: string; storage_gb: number }>>`
        with course_lessons as (
          select l.id as lesson_id
          from course_modules cm
          join lessons l
            on l.module_id = cm.id
            and l.tenant_id = cm.tenant_id
            and l.deleted_at is null
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        ),
        course_modules_scope as (
          select cm.id as module_id
          from course_modules cm
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        )
        select
          case
            when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
            when lower(coalesce(sr.purpose, '')) like '%scorm%'
              or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
            when sr.content_type like 'video/%' then 'video'
            when sr.content_type like 'audio/%' then 'audio'
            when sr.content_type like 'image/%' then 'images'
            when sr.content_type like 'application/pdf%'
              or sr.content_type like 'text/%'
              or sr.content_type like 'application/msword%'
              or sr.content_type like 'application/vnd.openxmlformats%'
              or sr.content_type like 'application/vnd.ms-%' then 'documents'
            else 'attachments'
          end as asset_key,
          coalesce(sum(sr.size_bytes), 0)::float8 / 1e9 as storage_gb
        from storage_references sr
        where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and sr.deleted_at is null
          and (
            (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
            or (
              sr.resource_type = 'course_module'
              and sr.resource_id in (select module_id from course_modules_scope)
            )
            or (
              sr.resource_type = 'lesson'
              and sr.resource_id in (select lesson_id from course_lessons)
            )
          )
        group by 1
        having coalesce(sum(sr.size_bytes), 0) > 0
        order by storage_gb desc
      `,
        tx.$queryRaw<
          Array<{
            file_name: string;
            content_type: string | null;
            asset_type_key: string;
            size_bytes: number;
            lesson_id: string | null;
            lesson_title: string | null;
            uploaded_at: Date | null;
          }>
        >`
        with course_lessons as (
          select l.id as lesson_id, l.title as lesson_title
          from course_modules cm
          join lessons l
            on l.module_id = cm.id
            and l.tenant_id = cm.tenant_id
            and l.deleted_at is null
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        ),
        course_modules_scope as (
          select cm.id as module_id
          from course_modules cm
          where cm.course_id = ${courseId}::uuid
            and cm.tenant_id = current_setting('app.tenant_id', true)::uuid
            and cm.deleted_at is null
        )
        select
          sr.file_name,
          sr.content_type,
          case
            when lower(coalesce(sr.purpose, '')) like '%backup%' then 'backups'
            when lower(coalesce(sr.purpose, '')) like '%scorm%'
              or lower(coalesce(sr.content_type, '')) like '%scorm%' then 'scorm'
            when sr.content_type like 'video/%' then 'video'
            when sr.content_type like 'audio/%' then 'audio'
            when sr.content_type like 'image/%' then 'images'
            when sr.content_type like 'application/pdf%'
              or sr.content_type like 'text/%'
              or sr.content_type like 'application/msword%'
              or sr.content_type like 'application/vnd.openxmlformats%'
              or sr.content_type like 'application/vnd.ms-%' then 'documents'
            when lower(sr.file_name) like '%.zip' then 'attachments'
            else 'attachments'
          end as asset_type_key,
          sr.size_bytes::float8 as size_bytes,
          case when sr.resource_type = 'lesson' then sr.resource_id::text else null end as lesson_id,
          case when sr.resource_type = 'lesson' then cl.lesson_title else null end as lesson_title,
          sr.created_at as uploaded_at
        from storage_references sr
        left join course_lessons cl on cl.lesson_id = sr.resource_id and sr.resource_type = 'lesson'
        where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and sr.deleted_at is null
          and (
            (sr.resource_type = 'course' and sr.resource_id = ${courseId}::uuid)
            or (
              sr.resource_type = 'course_module'
              and sr.resource_id in (select module_id from course_modules_scope)
            )
            or (
              sr.resource_type = 'lesson'
              and sr.resource_id in (select lesson_id from course_lessons)
            )
          )
        order by sr.size_bytes desc nulls last
        limit 10
      `,
        tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from certificates c
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.status = 'issued'
          and c.revoked_at is null
          and c.metadata_json->'source'->>'type' = 'course'
          and c.metadata_json->'source'->>'id' = ${courseId}
      `,
        tx.$queryRaw<
          Array<{
            lesson_id: string;
            position: number;
            title: string;
            video_provider: string | null;
            video_url: string | null;
            duration_seconds: number | null;
            storage_gb: number;
            last_opened_at: Date | null;
            has_scorm: boolean;
          }>
        >`
        select
          l.id::text as lesson_id,
          l.position,
          l.title,
          l.video_provider,
          l.video_url,
          l.duration_seconds,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.tenant_id = l.tenant_id
              and sr.deleted_at is null
              and sr.resource_type = 'lesson'
              and sr.resource_id = l.id
          ), 0) as storage_gb,
          (
            select max(lp.last_seen_at)
            from lesson_progress lp
            where lp.lesson_id = l.id
              and lp.tenant_id = l.tenant_id
          ) as last_opened_at,
          exists (
            select 1
            from storage_references sr
            where sr.tenant_id = l.tenant_id
              and sr.deleted_at is null
              and sr.resource_type = 'lesson'
              and sr.resource_id = l.id
              and (
                lower(coalesce(sr.purpose, '')) like '%scorm%'
                or lower(coalesce(sr.content_type, '')) like '%scorm%'
              )
          ) as has_scorm
        from lessons l
        join course_modules cm
          on cm.id = l.module_id
          and cm.tenant_id = l.tenant_id
          and cm.deleted_at is null
        where cm.course_id = ${courseId}::uuid
          and l.tenant_id = current_setting('app.tenant_id', true)::uuid
          and l.deleted_at is null
        order by cm.position asc nulls last, l.position asc nulls last, l.title asc
      `,
      ]);

    return {
      course: {
        course_id: courseRow.course_id,
        title: courseRow.title,
        status: courseRow.status,
        created_at: courseRow.created_at,
        dormant_days: courseRow.dormant_days,
        never_opened: courseRow.never_opened,
        last_learner_activity_at: courseRow.last_learner_activity_at,
      },
      summary: {
        storage_gb: roundGb(courseRow.storage_gb),
        total_tenant_storage_gb: roundGb(tenantStorageRows[0]?.storage_gb ?? 0),
        lesson_count: courseRow.lesson_count,
        lessons_with_assets_count: courseRow.lessons_with_assets_count,
        file_count: courseRow.file_count,
        enrolment_total: courseRow.enrolment_total,
        enrolment_active: courseRow.enrolment_active,
        enrolment_active_in_90d: courseRow.enrolment_active_in_90d,
      },
      composition: compositionRows.map((row) => ({
        key: row.asset_key,
        label: assetLabels[row.asset_key] ?? row.asset_key,
        storage_gb: roundGb(row.storage_gb),
      })),
      top_files: topFileRows.map((row) => ({
        file_name: row.file_name,
        content_type: row.content_type,
        asset_type_key: row.asset_type_key,
        size_bytes: row.size_bytes,
        lesson_id: row.lesson_id,
        lesson_title: row.lesson_title,
        uploaded_at: row.uploaded_at,
      })),
      certificates_remain_valid: Number(certificateRows[0]?.count ?? 0),
      lessons: lessonRows.map((row) => ({
        lesson_id: row.lesson_id,
        position: row.position,
        title: row.title,
        video_provider: row.video_provider,
        video_url: row.video_url,
        duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
        storage_gb: roundGb(row.storage_gb),
        last_opened_at: row.last_opened_at,
        has_scorm: row.has_scorm,
      })),
    };
  },
};
