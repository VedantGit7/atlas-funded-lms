import type { TenantTx } from "@atlas/db";
import type { BatchesListQuery } from "./batches-roster.dto";
import type {
  BatchesListSummaryRow,
  BatchListRow,
  CohortTrendRow,
  LiveSessionCounts,
  UpcomingSessionRow,
} from "./batches-roster.repository";
import { asUnknownString } from "./batches-roster.repository-helpers";

/**
 * The batches list, its summary, and the header facts on a batch report.
 * Part of batchesRosterRepository.
 */
export const batchesRosterOverviewRepository = {
  async findBatchMeta(
    tx: TenantTx,
    batchId: string,
  ): Promise<{
    id: string;
    key: string;
    name: string;
    description: string | null;
    course_id: string | null;
    course_title: string | null;
    status: string;
    starts_at: Date | null;
    ends_at: Date | null;
    created_at: Date;
    metadata_json: unknown;
  } | null> {
    const rows = await tx.$queryRaw<
      Array<{
        id: string;
        key: string;
        name: string;
        description: string | null;
        course_id: string | null;
        course_title: string | null;
        status: string;
        starts_at: Date | null;
        ends_at: Date | null;
        created_at: Date;
        metadata_json: unknown;
      }>
    >`
      select
        b.id::text as id,
        b.key,
        b.name,
        b.description,
        b.course_id::text as course_id,
        c.title as course_title,
        b.status::text as status,
        b.starts_at,
        b.ends_at,
        b.created_at,
        b.metadata_json
      from batches b
      left join courses c on c.id = b.course_id and c.tenant_id = b.tenant_id and c.deleted_at is null
      where b.id = ${batchId}::uuid
      limit 1
    `;
    return rows[0] ?? null;
  },

  async countBatches(tx: TenantTx, query: BatchesListQuery): Promise<number> {
    const window = query.window;
    const health = query.health;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with batch_base as (
        select
          b.id,
          b.course_id,
          b.status,
          b.starts_at,
          b.ends_at,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = b.id and bm.tenant_id = b.tenant_id
          ) as member_count
        from batches b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or b.status::text = ${query.status ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(b.name) like '%' || lower(${query.q ?? null}) || '%'
            or lower(b.key) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${window}::text = 'any'
            or (
              ${window}::text = 'running'
              and (b.starts_at is null or b.starts_at <= now())
              and (b.ends_at is null or b.ends_at >= now())
            )
            or (
              ${window}::text = 'starting_soon'
              and b.starts_at is not null
              and b.starts_at > now()
              and b.starts_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ending_soon'
              and b.ends_at is not null
              and b.ends_at >= now()
              and b.ends_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ended'
              and b.ends_at is not null
              and b.ends_at < now()
            )
          )
      ),
      batch_metrics as (
        select
          bb.id,
          bb.status,
          bb.ends_at,
          (
            select max(m.last_active_at)
            from batch_memberships bm
            join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
            where bm.batch_id = bb.id and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select round(avg(learner.completion_pct))::float
            from (
              select
                case when totals.total_lessons > 0
                  then round((completed.completed_lessons::numeric / totals.total_lessons::numeric) * 100)
                  else 0
                end as completion_pct
              from batch_memberships bm
              left join lateral (
                select count(*)::int as total_lessons
                from lessons l
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                where cm.course_id = bb.course_id
                  and l.deleted_at is null
                  and cm.deleted_at is null
              ) totals on true
              left join lateral (
                select count(*)::int as completed_lessons
                from lesson_progress lp
                join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
                where lp.membership_id = bm.membership_id
                  and lp.tenant_id = bm.tenant_id
                  and lp.status = 'completed'
                  and cm.course_id = bb.course_id
              ) completed on true
              where bm.batch_id = bb.id
                and bb.course_id is not null
            ) learner
          ) as avg_content_completion_pct,
          (
            select round(avg(
              case when sess.session_count > 0
                then (att.attended_count::numeric / sess.session_count::numeric) * 100
                else null
              end
            ))::float
            from batch_memberships bm
            left join lateral (
              select count(*)::int as session_count
              from live_sessions ls
              where ls.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
            ) sess on true
            left join lateral (
              select count(*)::int as attended_count
              from live_attendance la
              join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
                and (
                  la.status in ('attended', 'present', 'joined')
                  or la.joined_at is not null
                )
            ) att on true
            where bm.batch_id = bb.id
          ) as avg_live_attendance_pct,
          (
            select round(avg(latest.score_pct)::numeric, 1)::float
            from batch_memberships bm
            join lateral (
              select at.score_pct
              from attempts at
              where at.membership_id = bm.membership_id
                and at.tenant_id = bm.tenant_id
                and at.score_pct is not null
                and (
                  bb.course_id is null
                  or exists (
                    select 1
                    from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = bb.course_id
                      and l.deleted_at is null
                      and coalesce(
                        l.content_json->'content'->>'assessmentId',
                        l.content_json->>'assessmentId'
                      ) = at.assessment_id::text
                  )
                )
              order by coalesce(at.submitted_at, at.started_at) desc
              limit 1
            ) latest on true
            where bm.batch_id = bb.id
          ) as avg_test_score_pct
        from batch_base bb
      ),
      batch_scored as (
        select
          bm.*,
          case
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when bm.last_activity_at is null or bm.last_activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from batch_metrics bm
      )
      select count(*)::bigint as count
      from batch_scored bs
      where (
        ${health}::text = 'any'
        or bs.health = ${health}
        or (${health}::text = 'needs_attention' and bs.health in ('at_risk', 'critical'))
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async summarizeBatches(tx: TenantTx, query: BatchesListQuery): Promise<BatchesListSummaryRow> {
    const window = query.window;
    const health = query.health;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with batch_base as (
        select
          b.id,
          b.course_id,
          b.status,
          b.starts_at,
          b.ends_at,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = b.id and bm.tenant_id = b.tenant_id
          ) as member_count
        from batches b
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or b.status::text = ${query.status ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(b.name) like '%' || lower(${query.q ?? null}) || '%'
            or lower(b.key) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${window}::text = 'any'
            or (
              ${window}::text = 'running'
              and (b.starts_at is null or b.starts_at <= now())
              and (b.ends_at is null or b.ends_at >= now())
            )
            or (
              ${window}::text = 'starting_soon'
              and b.starts_at is not null
              and b.starts_at > now()
              and b.starts_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ending_soon'
              and b.ends_at is not null
              and b.ends_at >= now()
              and b.ends_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ended'
              and b.ends_at is not null
              and b.ends_at < now()
            )
          )
      ),
      batch_metrics as (
        select
          bb.id,
          bb.status,
          bb.ends_at,
          bb.member_count,
          (
            select max(m.last_active_at)
            from batch_memberships bm
            join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
            where bm.batch_id = bb.id and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select round(avg(learner.completion_pct))::float
            from (
              select
                case when totals.total_lessons > 0
                  then round((completed.completed_lessons::numeric / totals.total_lessons::numeric) * 100)
                  else 0
                end as completion_pct
              from batch_memberships bm
              left join lateral (
                select count(*)::int as total_lessons
                from lessons l
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                where cm.course_id = bb.course_id
                  and l.deleted_at is null
                  and cm.deleted_at is null
              ) totals on true
              left join lateral (
                select count(*)::int as completed_lessons
                from lesson_progress lp
                join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
                where lp.membership_id = bm.membership_id
                  and lp.tenant_id = bm.tenant_id
                  and lp.status = 'completed'
                  and cm.course_id = bb.course_id
              ) completed on true
              where bm.batch_id = bb.id
                and bb.course_id is not null
            ) learner
          ) as avg_content_completion_pct,
          (
            select round(avg(
              case when sess.session_count > 0
                then (att.attended_count::numeric / sess.session_count::numeric) * 100
                else null
              end
            ))::float
            from batch_memberships bm
            left join lateral (
              select count(*)::int as session_count
              from live_sessions ls
              where ls.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
            ) sess on true
            left join lateral (
              select count(*)::int as attended_count
              from live_attendance la
              join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
                and (
                  la.status in ('attended', 'present', 'joined')
                  or la.joined_at is not null
                )
            ) att on true
            where bm.batch_id = bb.id
          ) as avg_live_attendance_pct,
          (
            select round(avg(latest.score_pct)::numeric, 1)::float
            from batch_memberships bm
            join lateral (
              select at.score_pct
              from attempts at
              where at.membership_id = bm.membership_id
                and at.tenant_id = bm.tenant_id
                and at.score_pct is not null
                and (
                  bb.course_id is null
                  or exists (
                    select 1
                    from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = bb.course_id
                      and l.deleted_at is null
                      and coalesce(
                        l.content_json->'content'->>'assessmentId',
                        l.content_json->>'assessmentId'
                      ) = at.assessment_id::text
                  )
                )
              order by coalesce(at.submitted_at, at.started_at) desc
              limit 1
            ) latest on true
            where bm.batch_id = bb.id
          ) as avg_test_score_pct
        from batch_base bb
      ),
      batch_scored as (
        select
          bm.*,
          case
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when bm.last_activity_at is null or bm.last_activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from batch_metrics bm
      )
      select
        coalesce(count(*) filter (where bs.status = 'ACTIVE'), 0)::int as active_batch_count,
        coalesce(sum(bs.member_count), 0)::int as total_learners,
        round(avg(bs.avg_content_completion_pct)::numeric, 1)::float as avg_content_completion_pct,
        round(avg(bs.avg_live_attendance_pct)::numeric, 1)::float as avg_live_attendance_pct,
        coalesce(count(*) filter (where bs.health in ('at_risk', 'critical')), 0)::int as at_risk_count,
        coalesce(
          count(*) filter (
            where bs.ends_at is not null
              and bs.ends_at >= now()
              and bs.ends_at <= now() + interval '30 days'
          ),
          0
        )::int as ending_soon_count
      from batch_scored bs
      where (
        ${health}::text = 'any'
        or bs.health = ${health}
        or (${health}::text = 'needs_attention' and bs.health in ('at_risk', 'critical'))
      )
    `;

    const row = rows[0] ?? {};
    return {
      active_batch_count: Number(row["active_batch_count"] ?? 0),
      total_learners: Number(row["total_learners"] ?? 0),
      avg_content_completion_pct:
        row["avg_content_completion_pct"] == null
          ? null
          : Number(row["avg_content_completion_pct"]),
      avg_live_attendance_pct:
        row["avg_live_attendance_pct"] == null ? null : Number(row["avg_live_attendance_pct"]),
      at_risk_count: Number(row["at_risk_count"] ?? 0),
      ending_soon_count: Number(row["ending_soon_count"] ?? 0),
    };
  },

  async listBatches(tx: TenantTx, query: BatchesListQuery): Promise<BatchListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const window = query.window;
    const health = query.health;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with batch_base as (
        select
          b.id,
          b.key,
          b.name,
          b.description,
          b.course_id,
          b.status,
          b.starts_at,
          b.ends_at,
          b.created_at,
          c.title as course_title,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = b.id and bm.tenant_id = b.tenant_id
          ) as member_count
        from batches b
        left join courses c on c.id = b.course_id and c.tenant_id = b.tenant_id and c.deleted_at is null
        where b.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or b.status::text = ${query.status ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(b.name) like '%' || lower(${query.q ?? null}) || '%'
            or lower(b.key) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${window}::text = 'any'
            or (
              ${window}::text = 'running'
              and (b.starts_at is null or b.starts_at <= now())
              and (b.ends_at is null or b.ends_at >= now())
            )
            or (
              ${window}::text = 'starting_soon'
              and b.starts_at is not null
              and b.starts_at > now()
              and b.starts_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ending_soon'
              and b.ends_at is not null
              and b.ends_at >= now()
              and b.ends_at <= now() + interval '30 days'
            )
            or (
              ${window}::text = 'ended'
              and b.ends_at is not null
              and b.ends_at < now()
            )
          )
      ),
      batch_metrics as (
        select
          bb.id,
          bb.key,
          bb.name,
          bb.description,
          bb.course_id,
          bb.course_title,
          bb.status,
          bb.starts_at,
          bb.ends_at,
          bb.member_count,
          bb.created_at,
          (
            select max(m.last_active_at)
            from batch_memberships bm
            join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
            where bm.batch_id = bb.id and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
          ) as last_activity_at,
          (
            select round(avg(learner.completion_pct))::float
            from (
              select
                case when totals.total_lessons > 0
                  then round((completed.completed_lessons::numeric / totals.total_lessons::numeric) * 100)
                  else 0
                end as completion_pct
              from batch_memberships bm
              left join lateral (
                select count(*)::int as total_lessons
                from lessons l
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                where cm.course_id = bb.course_id
                  and l.deleted_at is null
                  and cm.deleted_at is null
              ) totals on true
              left join lateral (
                select count(*)::int as completed_lessons
                from lesson_progress lp
                join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
                join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
                where lp.membership_id = bm.membership_id
                  and lp.tenant_id = bm.tenant_id
                  and lp.status = 'completed'
                  and cm.course_id = bb.course_id
              ) completed on true
              where bm.batch_id = bb.id
                and bb.course_id is not null
            ) learner
          ) as avg_content_completion_pct,
          (
            select round(avg(
              case when sess.session_count > 0
                then (att.attended_count::numeric / sess.session_count::numeric) * 100
                else null
              end
            ))::float
            from batch_memberships bm
            left join lateral (
              select count(*)::int as session_count
              from live_sessions ls
              where ls.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
            ) sess on true
            left join lateral (
              select count(*)::int as attended_count
              from live_attendance la
              join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
              where la.membership_id = bm.membership_id
                and la.tenant_id = bm.tenant_id
                and (
                  ls.batch_id = bb.id
                  or (bb.course_id is not null and ls.course_id = bb.course_id)
                )
                and (
                  la.status in ('attended', 'present', 'joined')
                  or la.joined_at is not null
                )
            ) att on true
            where bm.batch_id = bb.id
          ) as avg_live_attendance_pct,
          (
            select round(avg(latest.score_pct)::numeric, 1)::float
            from batch_memberships bm
            join lateral (
              select at.score_pct
              from attempts at
              where at.membership_id = bm.membership_id
                and at.tenant_id = bm.tenant_id
                and at.score_pct is not null
                and (
                  bb.course_id is null
                  or exists (
                    select 1
                    from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = bb.course_id
                      and l.deleted_at is null
                      and coalesce(
                        l.content_json->'content'->>'assessmentId',
                        l.content_json->>'assessmentId'
                      ) = at.assessment_id::text
                  )
                )
              order by coalesce(at.submitted_at, at.started_at) desc
              limit 1
            ) latest on true
            where bm.batch_id = bb.id
          ) as avg_test_score_pct
        from batch_base bb
      ),
      batch_scored as (
        select
          bm.*,
          case
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 2 then 'critical'
            when (
              (case when bm.avg_content_completion_pct is not null and bm.avg_content_completion_pct < 40 then 1 else 0 end)
              + (case when bm.avg_live_attendance_pct is not null and bm.avg_live_attendance_pct < 40 then 1 else 0 end)
              + (case when bm.avg_test_score_pct is not null and bm.avg_test_score_pct < 40 then 1 else 0 end)
            ) >= 1 then 'at_risk'
            when bm.last_activity_at is null or bm.last_activity_at < now() - interval '14 days' then 'at_risk'
            else 'on_track'
          end as health
        from batch_metrics bm
      )
      select
        bs.id::text as id,
        bs.key,
        bs.name,
        bs.description,
        bs.course_id::text as course_id,
        bs.course_title,
        bs.status::text as status,
        bs.starts_at,
        bs.ends_at,
        bs.member_count,
        bs.created_at,
        bs.last_activity_at,
        bs.avg_content_completion_pct,
        bs.avg_live_attendance_pct,
        bs.avg_test_score_pct,
        bs.health
      from batch_scored bs
      where (
        ${health}::text = 'any'
        or bs.health = ${health}
        or (${health}::text = 'needs_attention' and bs.health in ('at_risk', 'critical'))
      )
      order by
        case when ${sortBy} = 'member_count' and ${sortDir} = 'asc' then bs.member_count end asc nulls last,
        case when ${sortBy} = 'member_count' and ${sortDir} = 'desc' then bs.member_count end desc nulls last,
        case when ${sortBy} = 'avg_content_completion_pct' and ${sortDir} = 'asc' then bs.avg_content_completion_pct end asc nulls last,
        case when ${sortBy} = 'avg_content_completion_pct' and ${sortDir} = 'desc' then bs.avg_content_completion_pct end desc nulls last,
        case when ${sortBy} = 'avg_live_attendance_pct' and ${sortDir} = 'asc' then bs.avg_live_attendance_pct end asc nulls last,
        case when ${sortBy} = 'avg_live_attendance_pct' and ${sortDir} = 'desc' then bs.avg_live_attendance_pct end desc nulls last,
        case when ${sortBy} = 'avg_test_score_pct' and ${sortDir} = 'asc' then bs.avg_test_score_pct end asc nulls last,
        case when ${sortBy} = 'avg_test_score_pct' and ${sortDir} = 'desc' then bs.avg_test_score_pct end desc nulls last,
        case when ${sortBy} = 'starts_at' and ${sortDir} = 'asc' then bs.starts_at end asc nulls last,
        case when ${sortBy} = 'starts_at' and ${sortDir} = 'desc' then bs.starts_at end desc nulls last,
        case when ${sortBy} = 'name' and ${sortDir} = 'asc' then lower(bs.name) end asc,
        case when ${sortBy} = 'name' and ${sortDir} = 'desc' then lower(bs.name) end desc,
        case when ${sortBy} = 'created_at' and ${sortDir} = 'asc' then bs.created_at end asc,
        case when ${sortBy} = 'created_at' and ${sortDir} = 'desc' then bs.created_at end desc,
        bs.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => {
      const healthValue = asUnknownString(row["health"], "on_track");
      const healthNormalized =
        healthValue === "critical" || healthValue === "at_risk" || healthValue === "on_track"
          ? healthValue
          : "on_track";
      return {
        id: asUnknownString(row["id"]),
        key: asUnknownString(row["key"]),
        name: asUnknownString(row["name"]),
        description: typeof row["description"] === "string" ? row["description"] : null,
        course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
        course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
        status: asUnknownString(row["status"]),
        starts_at: row["starts_at"] instanceof Date ? row["starts_at"] : null,
        ends_at: row["ends_at"] instanceof Date ? row["ends_at"] : null,
        member_count: Number(row["member_count"] ?? 0),
        avg_content_completion_pct:
          row["avg_content_completion_pct"] == null
            ? null
            : Number(row["avg_content_completion_pct"]),
        avg_live_attendance_pct:
          row["avg_live_attendance_pct"] == null ? null : Number(row["avg_live_attendance_pct"]),
        avg_test_score_pct:
          row["avg_test_score_pct"] == null ? null : Number(row["avg_test_score_pct"]),
        last_activity_at: row["last_activity_at"] instanceof Date ? row["last_activity_at"] : null,
        health: healthNormalized,
        created_at: row["created_at"] as Date,
      };
    });
  },

  async countActiveLearners(tx: TenantTx, batchId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      where bm.batch_id = ${batchId}::uuid
        and m.last_active_at is not null
        and m.last_active_at >= now() - interval '14 days'
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countLiveSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
  ): Promise<LiveSessionCounts> {
    const rows = await tx.$queryRaw<Array<{ total_count: number; held_count: number }>>`
      select
        count(*)::int as total_count,
        count(*) filter (
          where ls.status in ('ended', 'completed', 'live', 'in_progress')
            or ls.ended_at is not null
            or ls.started_at is not null
            or (ls.scheduled_at is not null and ls.scheduled_at < now())
        )::int as held_count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
    `;
    return {
      total_count: rows[0]?.total_count ?? 0,
      held_count: rows[0]?.held_count ?? 0,
    };
  },

  async listUpcomingSessions(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    limit = 5,
  ): Promise<UpcomingSessionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as live_session_id,
        ls.title,
        ls.scheduled_at,
        ls.status,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(1, round(extract(epoch from (ls.ended_at - ls.started_at)) / 60.0)::int)
          else null
        end as duration_minutes
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ls.batch_id = ${batchId}::uuid
          or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
        )
        and (
          ls.status in ('scheduled', 'upcoming')
          or (ls.scheduled_at is not null and ls.scheduled_at >= now() and ls.ended_at is null)
        )
      order by coalesce(ls.scheduled_at, ls.created_at) asc
      limit ${limit}
    `;
    return rows.map((row) => ({
      live_session_id: asUnknownString(row["live_session_id"]),
      title: asUnknownString(row["title"], "Live session"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      status: asUnknownString(row["status"], "scheduled"),
      duration_minutes: row["duration_minutes"] == null ? null : Number(row["duration_minutes"]),
    }));
  },

  async listCohortTrend(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
  ): Promise<CohortTrendRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with week_spine as (
        select generate_series(
          date_trunc('week', now() - interval '11 weeks'),
          date_trunc('week', now()),
          interval '1 week'
        ) as week_start
      ),
      session_weeks as (
        select
          date_trunc('week', coalesce(ls.scheduled_at, ls.started_at, ls.created_at)) as week_start,
          ls.id as live_session_id,
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = ls.id
              and la.tenant_id = ls.tenant_id
              and (
                la.status in ('attended', 'present', 'joined')
                or la.joined_at is not null
              )
          ) as attended_count,
          (
            select count(*)::int
            from batch_memberships bm
            where bm.batch_id = ${batchId}::uuid
              and bm.tenant_id = ls.tenant_id
          ) as member_count
        from live_sessions ls
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ls.batch_id = ${batchId}::uuid
            or (${courseId ?? null}::uuid is not null and ls.course_id = ${courseId ?? null}::uuid)
          )
          and coalesce(ls.scheduled_at, ls.started_at, ls.created_at) >= now() - interval '12 weeks'
      ),
      attendance_by_week as (
        select
          week_start,
          case
            when sum(member_count) > 0
              then round((sum(attended_count)::numeric / nullif(sum(member_count), 0)::numeric) * 100)::int
            else null
          end as live_attendance_pct
        from session_weeks
        group by week_start
      ),
      completion_by_week as (
        select
          date_trunc('week', lp.completed_at) as week_start,
          count(*)::int as completions
        from lesson_progress lp
        join lessons l on l.id = lp.lesson_id and l.tenant_id = lp.tenant_id and l.deleted_at is null
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        join batch_memberships bm
          on bm.membership_id = lp.membership_id and bm.tenant_id = lp.tenant_id
        where lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and bm.batch_id = ${batchId}::uuid
          and lp.status = 'completed'
          and lp.completed_at is not null
          and lp.completed_at >= now() - interval '12 weeks'
          and (${courseId ?? null}::uuid is null or cm.course_id = ${courseId ?? null}::uuid)
        group by date_trunc('week', lp.completed_at)
      ),
      max_completions as (
        select greatest(1, coalesce(max(completions), 1))::numeric as peak
        from completion_by_week
      )
      select
        ws.week_start,
        to_char(ws.week_start, '"W"IW') as week_label,
        case
          when cbw.completions is null then null
          else round((cbw.completions::numeric / mc.peak) * 100)::int
        end as content_completion_pct,
        abw.live_attendance_pct,
        null::float as test_score_pct
      from week_spine ws
      cross join max_completions mc
      left join attendance_by_week abw on abw.week_start = ws.week_start
      left join completion_by_week cbw on cbw.week_start = ws.week_start
      order by ws.week_start asc
    `;

    return rows.map((row, index) => ({
      week_start: row["week_start"] as Date,
      week_label:
        typeof row["week_label"] === "string" ? row["week_label"] : `W${String(index + 1)}`,
      content_completion_pct:
        row["content_completion_pct"] == null ? null : Number(row["content_completion_pct"]),
      live_attendance_pct:
        row["live_attendance_pct"] == null ? null : Number(row["live_attendance_pct"]),
      test_score_pct: row["test_score_pct"] == null ? null : Number(row["test_score_pct"]),
    }));
  },
};
