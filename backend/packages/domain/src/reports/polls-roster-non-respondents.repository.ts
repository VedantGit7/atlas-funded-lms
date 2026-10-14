import type { TenantTx } from "@atlas/db";
import type { PollNonRespondentsQuery } from "./polls-roster.dto";
import { textColumn } from "./raw-column";

/**
 * A poll's non-respondents and their audience.
 * Part of pollsRosterRepository.
 */
export const pollsRosterNonRespondentsRepository = {
  async getNonRespondentsAudienceMeta(
    tx: TenantTx,
    pollId: string,
  ): Promise<{
    live_session_id: string | null;
    live_session_title: string | null;
    batch_id: string | null;
    batch_name: string | null;
    attendance_count: number;
    batch_member_count: number;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.live_session_id::text as live_session_id,
        ls.title as live_session_title,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        coalesce(
          (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = p.live_session_id
              and la.tenant_id = p.tenant_id
          ),
          0
        ) as attendance_count,
        coalesce(
          (
            select count(*)::int
            from batch_memberships bm
            where ls.batch_id is not null
              and bm.batch_id = ls.batch_id
              and bm.tenant_id = p.tenant_id
          ),
          0
        ) as batch_member_count
      from polls p
      left join live_sessions ls
        on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
      left join batches b
        on b.id = ls.batch_id and b.tenant_id = p.tenant_id
      where p.id = ${pollId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return {
      live_session_id: typeof row["live_session_id"] === "string" ? row["live_session_id"] : null,
      live_session_title:
        typeof row["live_session_title"] === "string" ? row["live_session_title"] : null,
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      attendance_count: Number(row["attendance_count"] ?? 0),
      batch_member_count: Number(row["batch_member_count"] ?? 0),
    };
  },

  async summarizeNonRespondents(
    tx: TenantTx,
    pollId: string,
    source: "live_session" | "batch",
  ): Promise<{
    eligible_count: number;
    respondent_count: number;
    non_respondent_count: number;
    present_non_respondent_count: number;
    absent_non_respondent_count: number;
  }> {
    const rows =
      source === "live_session"
        ? await tx.$queryRaw<Array<Record<string, unknown>>>`
            with eligible as (
              select
                la.membership_id,
                case
                  when la.joined_at is not null or lower(la.status) = 'attended' then true
                  else false
                end as is_present
              from polls p
              join live_attendance la
                on la.live_session_id = p.live_session_id
                and la.tenant_id = p.tenant_id
              where p.id = ${pollId}::uuid
            ),
            non_respondents as (
              select e.*
              from eligible e
              where not exists (
                select 1
                from poll_responses pr
                where pr.poll_id = ${pollId}::uuid
                  and pr.membership_id = e.membership_id
                  and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
              )
            )
            select
              (select count(*)::int from eligible) as eligible_count,
              (
                select count(distinct pr.membership_id)::int
                from poll_responses pr
                where pr.poll_id = ${pollId}::uuid
                  and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
                  and exists (
                    select 1 from eligible e where e.membership_id = pr.membership_id
                  )
              ) as respondent_count,
              (select count(*)::int from non_respondents) as non_respondent_count,
              (
                select count(*)::int from non_respondents where is_present = true
              ) as present_non_respondent_count,
              (
                select count(*)::int from non_respondents where is_present = false
              ) as absent_non_respondent_count
          `
        : await tx.$queryRaw<Array<Record<string, unknown>>>`
            with eligible as (
              select
                bm.membership_id,
                false as is_present
              from polls p
              join live_sessions ls
                on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
              join batch_memberships bm
                on bm.batch_id = ls.batch_id and bm.tenant_id = p.tenant_id
              where p.id = ${pollId}::uuid
                and ls.batch_id is not null
            ),
            non_respondents as (
              select e.*
              from eligible e
              where not exists (
                select 1
                from poll_responses pr
                where pr.poll_id = ${pollId}::uuid
                  and pr.membership_id = e.membership_id
                  and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
              )
            )
            select
              (select count(*)::int from eligible) as eligible_count,
              (
                select count(distinct pr.membership_id)::int
                from poll_responses pr
                where pr.poll_id = ${pollId}::uuid
                  and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
                  and exists (
                    select 1 from eligible e where e.membership_id = pr.membership_id
                  )
              ) as respondent_count,
              (select count(*)::int from non_respondents) as non_respondent_count,
              0::int as present_non_respondent_count,
              (select count(*)::int from non_respondents) as absent_non_respondent_count
          `;

    const row = rows[0] ?? {};
    return {
      eligible_count: Number(row["eligible_count"] ?? 0),
      respondent_count: Number(row["respondent_count"] ?? 0),
      non_respondent_count: Number(row["non_respondent_count"] ?? 0),
      present_non_respondent_count: Number(row["present_non_respondent_count"] ?? 0),
      absent_non_respondent_count: Number(row["absent_non_respondent_count"] ?? 0),
    };
  },

  async countNonRespondents(
    tx: TenantTx,
    pollId: string,
    source: "live_session" | "batch",
    query: PollNonRespondentsQuery,
  ): Promise<number> {
    const presence = query.excludeAbsent ? "present" : query.presence;
    const rows =
      source === "live_session"
        ? await tx.$queryRaw<Array<{ count: bigint }>>`
            with eligible as (
              select
                la.membership_id,
                case
                  when la.joined_at is not null or lower(la.status) = 'attended' then 'present'
                  else 'absent'
                end as presence
              from polls p
              join live_attendance la
                on la.live_session_id = p.live_session_id
                and la.tenant_id = p.tenant_id
              where p.id = ${pollId}::uuid
            )
            select count(*)::bigint as count
            from eligible e
            join memberships m on m.id = e.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
            left join member_profiles mp
              on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
            left join auth_principals ap on ap.id = m.auth_principal_id
            where not exists (
              select 1
              from poll_responses pr
              where pr.poll_id = ${pollId}::uuid
                and pr.membership_id = e.membership_id
                and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
            and (
              ${presence}::text = 'any'
              or e.presence = ${presence}::text
            )
            and (
              ${query.q ?? null}::text is null
              or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
                like '%' || lower(${query.q ?? null}) || '%'
            )
          `
        : await tx.$queryRaw<Array<{ count: bigint }>>`
            with eligible as (
              select
                bm.membership_id,
                'absent'::text as presence
              from polls p
              join live_sessions ls
                on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
              join batch_memberships bm
                on bm.batch_id = ls.batch_id and bm.tenant_id = p.tenant_id
              where p.id = ${pollId}::uuid
                and ls.batch_id is not null
            )
            select count(*)::bigint as count
            from eligible e
            join memberships m on m.id = e.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
            left join member_profiles mp
              on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
            left join auth_principals ap on ap.id = m.auth_principal_id
            where not exists (
              select 1
              from poll_responses pr
              where pr.poll_id = ${pollId}::uuid
                and pr.membership_id = e.membership_id
                and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
            and (
              ${presence}::text = 'any'
              or e.presence = ${presence}::text
            )
            and (
              ${query.q ?? null}::text is null
              or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
                like '%' || lower(${query.q ?? null}) || '%'
            )
          `;
    return Number(rows[0]?.count ?? 0);
  },

  async listNonRespondents(
    tx: TenantTx,
    pollId: string,
    source: "live_session" | "batch",
    query: PollNonRespondentsQuery,
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      batch_id: string | null;
      batch_name: string | null;
      presence: "present" | "absent";
      watch_seconds: number | null;
      polls_answered: number;
      last_response_at: Date | null;
    }>
  > {
    const skip = (query.page - 1) * query.limit;
    const presence = query.excludeAbsent ? "present" : query.presence;
    const rows =
      source === "live_session"
        ? await tx.$queryRaw<Array<Record<string, unknown>>>`
            with eligible as (
              select
                la.membership_id,
                la.duration_seconds,
                case
                  when la.joined_at is not null or lower(la.status) = 'attended' then 'present'
                  else 'absent'
                end as presence
              from polls p
              join live_attendance la
                on la.live_session_id = p.live_session_id
                and la.tenant_id = p.tenant_id
              where p.id = ${pollId}::uuid
            )
            select
              e.membership_id::text as membership_id,
              coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
              coalesce(ap.email, m.invited_email_normalized) as email,
              b.id::text as batch_id,
              b.name as batch_name,
              e.presence,
              e.duration_seconds as watch_seconds,
              (
                select count(*)::int
                from poll_responses pr2
                join polls p2 on p2.id = pr2.poll_id and p2.tenant_id = pr2.tenant_id
                where pr2.membership_id = e.membership_id
                  and pr2.tenant_id = current_setting('app.tenant_id', true)::uuid
                  and p2.live_session_id = (
                    select live_session_id from polls where id = ${pollId}::uuid
                  )
              ) as polls_answered,
              (
                select max(pr3.created_at)
                from poll_responses pr3
                where pr3.membership_id = e.membership_id
                  and pr3.tenant_id = current_setting('app.tenant_id', true)::uuid
              ) as last_response_at
            from eligible e
            join memberships m on m.id = e.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
            left join member_profiles mp
              on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
            left join auth_principals ap on ap.id = m.auth_principal_id
            left join lateral (
              select bm.batch_id
              from batch_memberships bm
              where bm.membership_id = e.membership_id
                and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
              order by bm.joined_at desc nulls last
              limit 1
            ) latest_batch on true
            left join batches b
              on b.id = latest_batch.batch_id
              and b.tenant_id = current_setting('app.tenant_id', true)::uuid
            where not exists (
              select 1
              from poll_responses pr
              where pr.poll_id = ${pollId}::uuid
                and pr.membership_id = e.membership_id
                and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
            and (
              ${presence}::text = 'any'
              or e.presence = ${presence}::text
            )
            and (
              ${query.q ?? null}::text is null
              or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
                like '%' || lower(${query.q ?? null}) || '%'
            )
            order by
              case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end asc nulls last,
              case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end desc nulls last,
              case when ${query.sortBy} = 'batch_name' and ${query.sortDir} = 'asc' then b.name end asc nulls last,
              case when ${query.sortBy} = 'batch_name' and ${query.sortDir} = 'desc' then b.name end desc nulls last,
              case when ${query.sortBy} = 'presence' and ${query.sortDir} = 'asc' then e.presence end asc,
              case when ${query.sortBy} = 'presence' and ${query.sortDir} = 'desc' then e.presence end desc,
              case when ${query.sortBy} = 'watch_seconds' and ${query.sortDir} = 'asc' then e.duration_seconds end asc nulls last,
              case when ${query.sortBy} = 'watch_seconds' and ${query.sortDir} = 'desc' then e.duration_seconds end desc nulls last,
              case when ${query.sortBy} = 'polls_answered' and ${query.sortDir} = 'asc'
                then (
                  select count(*)::int
                  from poll_responses pr2
                  join polls p2 on p2.id = pr2.poll_id and p2.tenant_id = pr2.tenant_id
                  where pr2.membership_id = e.membership_id
                    and pr2.tenant_id = current_setting('app.tenant_id', true)::uuid
                    and p2.live_session_id = (select live_session_id from polls where id = ${pollId}::uuid)
                )
              end asc,
              case when ${query.sortBy} = 'polls_answered' and ${query.sortDir} = 'desc'
                then (
                  select count(*)::int
                  from poll_responses pr2
                  join polls p2 on p2.id = pr2.poll_id and p2.tenant_id = pr2.tenant_id
                  where pr2.membership_id = e.membership_id
                    and pr2.tenant_id = current_setting('app.tenant_id', true)::uuid
                    and p2.live_session_id = (select live_session_id from polls where id = ${pollId}::uuid)
                )
              end desc,
              case when ${query.sortBy} = 'last_response_at' and ${query.sortDir} = 'asc'
                then (
                  select max(pr3.created_at)
                  from poll_responses pr3
                  where pr3.membership_id = e.membership_id
                    and pr3.tenant_id = current_setting('app.tenant_id', true)::uuid
                )
              end asc nulls last,
              case when ${query.sortBy} = 'last_response_at' and ${query.sortDir} = 'desc'
                then (
                  select max(pr3.created_at)
                  from poll_responses pr3
                  where pr3.membership_id = e.membership_id
                    and pr3.tenant_id = current_setting('app.tenant_id', true)::uuid
                )
              end desc nulls last,
              e.membership_id asc
            limit ${query.limit}
            offset ${skip}
          `
        : await tx.$queryRaw<Array<Record<string, unknown>>>`
            with eligible as (
              select
                bm.membership_id,
                null::int as duration_seconds,
                'absent'::text as presence,
                ls.batch_id
              from polls p
              join live_sessions ls
                on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
              join batch_memberships bm
                on bm.batch_id = ls.batch_id and bm.tenant_id = p.tenant_id
              where p.id = ${pollId}::uuid
                and ls.batch_id is not null
            )
            select
              e.membership_id::text as membership_id,
              coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
              coalesce(ap.email, m.invited_email_normalized) as email,
              b.id::text as batch_id,
              b.name as batch_name,
              e.presence,
              e.duration_seconds as watch_seconds,
              (
                select count(*)::int
                from poll_responses pr2
                join polls p2 on p2.id = pr2.poll_id and p2.tenant_id = pr2.tenant_id
                where pr2.membership_id = e.membership_id
                  and pr2.tenant_id = current_setting('app.tenant_id', true)::uuid
                  and p2.live_session_id = (
                    select live_session_id from polls where id = ${pollId}::uuid
                  )
              ) as polls_answered,
              (
                select max(pr3.created_at)
                from poll_responses pr3
                where pr3.membership_id = e.membership_id
                  and pr3.tenant_id = current_setting('app.tenant_id', true)::uuid
              ) as last_response_at
            from eligible e
            join memberships m on m.id = e.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
            left join member_profiles mp
              on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
            left join auth_principals ap on ap.id = m.auth_principal_id
            left join batches b
              on b.id = e.batch_id
              and b.tenant_id = current_setting('app.tenant_id', true)::uuid
            where not exists (
              select 1
              from poll_responses pr
              where pr.poll_id = ${pollId}::uuid
                and pr.membership_id = e.membership_id
                and pr.tenant_id = current_setting('app.tenant_id', true)::uuid
            )
            and (
              ${presence}::text = 'any'
              or e.presence = ${presence}::text
            )
            and (
              ${query.q ?? null}::text is null
              or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
                like '%' || lower(${query.q ?? null}) || '%'
            )
            order by
              case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end asc nulls last,
              case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end desc nulls last,
              case when ${query.sortBy} = 'batch_name' and ${query.sortDir} = 'asc' then b.name end asc nulls last,
              case when ${query.sortBy} = 'batch_name' and ${query.sortDir} = 'desc' then b.name end desc nulls last,
              e.membership_id asc
            limit ${query.limit}
            offset ${skip}
          `;

    return rows.map((row) => ({
      membership_id: textColumn(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      presence: row["presence"] === "present" ? ("present" as const) : ("absent" as const),
      watch_seconds: row["watch_seconds"] == null ? null : Number(row["watch_seconds"]),
      polls_answered: Number(row["polls_answered"] ?? 0),
      last_response_at: row["last_response_at"] instanceof Date ? row["last_response_at"] : null,
    }));
  },
};
