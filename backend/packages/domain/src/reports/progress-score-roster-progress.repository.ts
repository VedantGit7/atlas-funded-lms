import type { TenantTx } from "@atlas/db";
import type { ProgressLearnersQuery, ProgressProductType } from "./progress-score-roster.dto";
import type {
  ProgressLearnerRow,
  ProgressLearnersFilter,
} from "./progress-score-roster.repository";
import { asUnknownString } from "./progress-score-roster.repository-helpers";

function mapProgressLearnerRows(rows: Array<Record<string, unknown>>): ProgressLearnerRow[] {
  return rows.map((row) => ({
    enrollment_id: asUnknownString(row["enrollment_id"]),
    membership_id: asUnknownString(row["membership_id"]),
    course_id: asUnknownString(row["course_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    completion_pct: Number(row["completion_pct"] ?? 0),
    completed_lessons: Number(row["completed_lessons"] ?? 0),
    total_lessons: Number(row["total_lessons"] ?? 0),
    enrolled_type: asUnknownString(row["enrolled_type"], "free"),
    status: asUnknownString(row["status"]),
    activity_status: (["active", "stalled", "not_started"].includes(
      asUnknownString(row["activity_status"], ""),
    )
      ? asUnknownString(row["activity_status"])
      : Number(row["completion_pct"] ?? 0) === 0
        ? "not_started"
        : "active") as ProgressLearnerRow["activity_status"],
    last_lesson_title:
      typeof row["last_lesson_title"] === "string" ? row["last_lesson_title"] : null,
    last_activity_at: row["last_activity_at"] instanceof Date ? row["last_activity_at"] : null,
    enrolled_at: row["enrolled_at"] as Date,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
  }));
}

/**
 * Learner progress for courses, test series, bundles and subscriptions.
 * Part of progressScoreRosterRepository.
 */
export const progressScoreRosterProgressRepository = {
  async countProgressLearners(tx: TenantTx, filter: ProgressLearnersFilter): Promise<number> {
    if (filter.productType === "course") {
      return this.countCourseProgressLearners(tx, filter);
    }
    if (filter.productType === "test_series") {
      return this.countTestSeriesProgressLearners(tx, filter);
    }
    if (filter.productType === "bundle") {
      return this.countBundleProgressLearners(tx, filter);
    }
    return this.countSubscriptionProgressLearners(tx, filter);
  },

  async countCourseProgressLearners(tx: TenantTx, filter: ProgressLearnersFilter): Promise<number> {
    const view = filter.view ?? "all";
    const completionBand = filter.completionBand ?? null;
    const activityStatus = filter.activityStatus ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with course_lessons as (
        select l.id
        from lessons l
        inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${filter.productId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      roster as (
        select
          e.id as enrollment_id,
          case
            when (select count(*)::int from course_lessons) = 0 then 0
            else round((
              (
                select count(*)::numeric
                from lesson_progress lp
                inner join course_lessons cl on cl.id = lp.lesson_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
                  and lp.status = 'completed'
              ) / (select count(*)::numeric from course_lessons)
            ) * 100)::int
          end as completion_pct,
          greatest(
            e.enrolled_at,
            coalesce(
              (
                select max(coalesce(lp.last_seen_at, lp.updated_at))
                from lesson_progress lp
                inner join course_lessons cl on cl.id = lp.lesson_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
              ),
              e.enrolled_at
            )
          ) as last_activity_at
        from enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.course_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
      ),
      scored as (
        select
          *,
          case
            when completion_pct = 0 then 'not_started'
            when last_activity_at < now() - interval '14 days' then 'stalled'
            else 'active'
          end as activity_status,
          case
            when completion_pct = 0 then 'not_started'
            when completion_pct > 0 and completion_pct < 25 then 'early'
            when completion_pct >= 25 and completion_pct < 75 then 'in_progress'
            when completion_pct >= 75 and completion_pct < 100 then 'nearly_done'
            else 'complete'
          end as completion_band
        from roster
      )
      select count(*)::bigint as count
      from scored
      where (${view}::text = 'all' or
        (${view}::text = 'stalled' and activity_status = 'stalled') or
        (${view}::text = 'not_started' and activity_status = 'not_started') or
        (${view}::text = 'nearly_done' and completion_band = 'nearly_done') or
        (${view}::text = 'completed' and completion_band = 'complete'))
        and (${completionBand}::text is null or completion_band = ${completionBand})
        and (${activityStatus}::text is null or activity_status = ${activityStatus})
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countTestSeriesProgressLearners(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from test_series_enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.test_series_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countBundleProgressLearners(tx: TenantTx, filter: ProgressLearnersFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from bundle_enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.bundle_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countSubscriptionProgressLearners(
    tx: TenantTx,
    filter: ProgressLearnersFilter,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from learner_subscription_enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.plan_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listProgressLearners(
    tx: TenantTx,
    productType: ProgressProductType,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    if (productType === "course") {
      return this.listCourseProgressLearners(tx, productId, query);
    }
    if (productType === "test_series") {
      return this.listTestSeriesProgressLearners(tx, productId, query);
    }
    if (productType === "bundle") {
      return this.listBundleProgressLearners(tx, productId, query);
    }
    return this.listSubscriptionProgressLearners(tx, productId, query);
  },

  async listCourseProgressLearners(
    tx: TenantTx,
    courseId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const view = query.view;
    const completionBand = query.completionBand ?? null;
    const activityStatus = query.activityStatus ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_lessons as (
        select l.id, l.title, m.position as module_position, l.position as lesson_position
        from lessons l
        inner join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${courseId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from lesson_progress lp
            inner join course_lessons cl on cl.id = lp.lesson_id
            where lp.membership_id = e.membership_id
              and lp.tenant_id = e.tenant_id
              and lp.status = 'completed'
          ) as completed_lessons,
          (select count(*)::int from course_lessons) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          (
            select cl.title
            from lesson_progress lp
            inner join course_lessons cl on cl.id = lp.lesson_id
            where lp.membership_id = e.membership_id
              and lp.tenant_id = e.tenant_id
            order by coalesce(lp.last_seen_at, lp.updated_at) desc nulls last
            limit 1
          ) as last_lesson_title,
          greatest(
            e.enrolled_at,
            coalesce(
              (
                select max(coalesce(lp.last_seen_at, lp.updated_at))
                from lesson_progress lp
                inner join course_lessons cl on cl.id = lp.lesson_id
                where lp.membership_id = e.membership_id
                  and lp.tenant_id = e.tenant_id
              ),
              e.enrolled_at
            )
          ) as last_activity_at
        from enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.course_id = ${courseId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      ),
      scored as (
        select
          enrollment_id,
          membership_id,
          course_id,
          learner_name,
          email,
          case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0
          end as completion_pct,
          completed_lessons,
          total_lessons,
          enrolled_type,
          status,
          last_lesson_title,
          last_activity_at,
          enrolled_at,
          expires_at,
          case
            when total_lessons = 0 or completed_lessons = 0 then 'not_started'
            when last_activity_at < now() - interval '14 days' then 'stalled'
            else 'active'
          end as activity_status,
          case
            when total_lessons = 0 or completed_lessons = 0 then 'not_started'
            when round((completed_lessons::numeric / nullif(total_lessons, 0)::numeric) * 100) < 25 then 'early'
            when round((completed_lessons::numeric / nullif(total_lessons, 0)::numeric) * 100) < 75 then 'in_progress'
            when round((completed_lessons::numeric / nullif(total_lessons, 0)::numeric) * 100) < 100 then 'nearly_done'
            else 'complete'
          end as completion_band
        from roster
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        activity_status,
        last_lesson_title,
        last_activity_at,
        enrolled_at,
        expires_at
      from scored
      where (${view}::text = 'all' or
        (${view}::text = 'stalled' and activity_status = 'stalled') or
        (${view}::text = 'not_started' and activity_status = 'not_started') or
        (${view}::text = 'nearly_done' and completion_band = 'nearly_done') or
        (${view}::text = 'completed' and completion_band = 'complete'))
        and (${completionBand}::text is null or completion_band = ${completionBand})
        and (${activityStatus}::text is null or activity_status = ${activityStatus})
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc' then completion_pct end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc' then completion_pct end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'last_activity_at' and ${query.sortDir} = 'asc' then last_activity_at end asc nulls last,
        case when ${query.sortBy} = 'last_activity_at' and ${query.sortDir} = 'desc' then last_activity_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;

    return mapProgressLearnerRows(rows);
  },

  async listTestSeriesProgressLearners(
    tx: TenantTx,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with series_items as (
        select tsi.id
        from test_series_items tsi
        where tsi.test_series_id = ${productId}::uuid
          and tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.test_series_id as course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from test_series_item_progress tip
            inner join series_items si on si.id = tip.test_series_item_id
            where tip.membership_id = e.membership_id
              and tip.tenant_id = e.tenant_id
              and tip.status = 'completed'
          ) as completed_lessons,
          (select count(*)::int from series_items) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at
        from test_series_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.test_series_id = ${productId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        case when total_lessons > 0
          then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
          else 0
        end as completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        enrolled_at,
        expires_at
      from roster
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return mapProgressLearnerRows(rows);
  },

  async listBundleProgressLearners(
    tx: TenantTx,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with bundle_items_cte as (
        select bi.id, bi.item_kind, bi.ref_id
        from bundle_items bi
        where bi.bundle_id = ${productId}::uuid
          and bi.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.bundle_id as course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from bundle_items_cte bi
            where (
              (bi.item_kind = 'course' and (
                select case when lt.total > 0 and lt.completed >= lt.total then true else false end
                from (
                  select
                    (
                      select count(*)::int
                      from lessons l
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = bi.ref_id
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as total,
                    (
                      select count(*)::int
                      from lesson_progress lp
                      join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = bi.ref_id
                        and lp.membership_id = e.membership_id
                        and lp.tenant_id = e.tenant_id
                        and lp.status = 'completed'
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as completed
                ) lt
              ))
              or (bi.item_kind = 'mock_test' and exists (
                select 1
                from attempts at
                join mock_tests mt on mt.assessment_id = at.assessment_id and mt.tenant_id = at.tenant_id
                where mt.id = bi.ref_id
                  and mt.deleted_at is null
                  and at.membership_id = e.membership_id
                  and at.tenant_id = e.tenant_id
                  and (at.submitted_at is not null or at.score_pct is not null)
              ))
              or (bi.item_kind = 'test_series' and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = bi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) > 0
              and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = bi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) = (
                select count(*)::int
                from test_series_item_progress tip
                join test_series_items tsi on tsi.id = tip.test_series_item_id and tsi.tenant_id = tip.tenant_id
                where tsi.test_series_id = bi.ref_id
                  and tip.membership_id = e.membership_id
                  and tip.tenant_id = e.tenant_id
                  and tip.status = 'completed'
              ))
            )
          ) as completed_lessons,
          (select count(*)::int from bundle_items_cte) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at
        from bundle_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.bundle_id = ${productId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        case when total_lessons > 0
          then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
          else 0
        end as completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        enrolled_at,
        expires_at
      from roster
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return mapProgressLearnerRows(rows);
  },

  async listSubscriptionProgressLearners(
    tx: TenantTx,
    productId: string,
    query: ProgressLearnersQuery,
  ): Promise<ProgressLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with plan_items_cte as (
        select lspi.id, lspi.item_kind, lspi.ref_id
        from learner_subscription_plan_items lspi
        where lspi.plan_id = ${productId}::uuid
          and lspi.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      roster as (
        select
          e.id as enrollment_id,
          e.membership_id,
          e.plan_id as course_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          (
            select count(*)::int
            from plan_items_cte pi
            where (
              (pi.item_kind = 'course' and (
                select case when lt.total > 0 and lt.completed >= lt.total then true else false end
                from (
                  select
                    (
                      select count(*)::int
                      from lessons l
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = pi.ref_id
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as total,
                    (
                      select count(*)::int
                      from lesson_progress lp
                      join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id
                      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                      where cm.course_id = pi.ref_id
                        and lp.membership_id = e.membership_id
                        and lp.tenant_id = e.tenant_id
                        and lp.status = 'completed'
                        and l.deleted_at is null
                        and cm.deleted_at is null
                    ) as completed
                ) lt
              ))
              or (pi.item_kind = 'mock_test' and exists (
                select 1
                from attempts at
                join mock_tests mt on mt.assessment_id = at.assessment_id and mt.tenant_id = at.tenant_id
                where mt.id = pi.ref_id
                  and mt.deleted_at is null
                  and at.membership_id = e.membership_id
                  and at.tenant_id = e.tenant_id
                  and (at.submitted_at is not null or at.score_pct is not null)
              ))
              or (pi.item_kind = 'test_series' and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = pi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) > 0
              and (
                select count(*)::int from test_series_items tsi
                where tsi.test_series_id = pi.ref_id
                  and tsi.tenant_id = e.tenant_id
              ) = (
                select count(*)::int
                from test_series_item_progress tip
                join test_series_items tsi on tsi.id = tip.test_series_item_id and tsi.tenant_id = tip.tenant_id
                where tsi.test_series_id = pi.ref_id
                  and tip.membership_id = e.membership_id
                  and tip.tenant_id = e.tenant_id
                  and tip.status = 'completed'
              ))
              or (pi.item_kind = 'bundle' and exists (
                select 1
                from bundle_enrollments be
                where be.bundle_id = pi.ref_id
                  and be.membership_id = e.membership_id
                  and be.tenant_id = e.tenant_id
                  and be.completed_at is not null
              ))
            )
          ) as completed_lessons,
          (select count(*)::int from plan_items_cte) as total_lessons,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at
        from learner_subscription_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.plan_id = ${productId}::uuid
          and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
          and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
          and (
            ${query.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.learnerName ?? null}) || '%'
          )
          and (
            ${query.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${query.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
          )
      )
      select
        enrollment_id::text,
        membership_id::text,
        course_id::text,
        learner_name,
        email,
        case when total_lessons > 0
          then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
          else 0
        end as completion_pct,
        completed_lessons,
        total_lessons,
        enrolled_type,
        status,
        enrolled_at,
        expires_at
      from roster
      order by
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'asc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end asc,
        case when ${query.sortBy} = 'completion_pct' and ${query.sortDir} = 'desc'
          then case when total_lessons > 0
            then round((completed_lessons::numeric / total_lessons::numeric) * 100)::int
            else 0 end end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then enrolled_at end desc,
        enrollment_id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return mapProgressLearnerRows(rows);
  },

  async listProgressMembershipIds(tx: TenantTx, filter: ProgressLearnersFilter): Promise<string[]> {
    if (filter.productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select distinct e.membership_id::text as membership_id
        from test_series_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.test_series_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
        order by membership_id
        limit 2000
      `;
      return rows.map((row) => row.membership_id);
    }
    if (filter.productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select distinct e.membership_id::text as membership_id
        from bundle_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.bundle_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
        order by membership_id
        limit 2000
      `;
      return rows.map((row) => row.membership_id);
    }
    if (filter.productType === "subscription") {
      const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
        select distinct e.membership_id::text as membership_id
        from learner_subscription_enrollments e
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.plan_id = ${filter.productId}::uuid
          and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
          and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
          and (
            ${filter.learnerName ?? null}::text is null
            or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.learnerName ?? null}) || '%'
          )
          and (
            ${filter.enrolledFrom ?? null}::timestamptz is null
            or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
          )
          and (
            ${filter.enrolledTo ?? null}::timestamptz is null
            or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
          )
        order by membership_id
        limit 2000
      `;
      return rows.map((row) => row.membership_id);
    }

    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct e.membership_id::text as membership_id
      from enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.course_id = ${filter.productId}::uuid
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
      order by membership_id
      limit 2000
    `;
    return rows.map((row) => row.membership_id);
  },
};
