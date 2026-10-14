import type { TenantTx } from "@atlas/db";
import type { PollRespondentsQuery, PollsListQuery } from "./polls-roster.dto";
import { textColumn } from "./raw-column";
import type {
  PollDetailExtrasRow,
  PollListRow,
  PollOptionBreakdownRow,
  PollOptionExtrasRow,
  PollOptionSegmentRow,
  PollRespondentRow,
  PollRespondentsFilter,
  PollsListSummaryRow,
} from "./polls-roster.repository";
import { mapPollListRow } from "./polls-roster.repository-helpers";

/**
 * Polls: the list, summary, one poll, its respondents and options.
 * Part of pollsRosterRepository.
 */
export const pollsRosterPollsRepository = {
  async countPolls(tx: TenantTx, query: PollsListQuery): Promise<number> {
    const view = query.view;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from polls p
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${query.status ?? null}::text is null or p.status::text = ${query.status ?? null})
        and (${query.pollType ?? null}::text is null or p.poll_type = ${query.pollType ?? null})
        and (
          ${query.q ?? null}::text is null
          or lower(p.title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(p.description, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.createdFrom ?? null}::timestamptz is null
          or p.created_at >= ${query.createdFrom ?? null}::timestamptz
        )
        and (
          ${query.createdTo ?? null}::timestamptz is null
          or p.created_at <= ${query.createdTo ?? null}::timestamptz
        )
        and (
          ${view}::text = 'all'
          or (
            ${view}::text = 'open'
            and p.status::text = 'ACTIVE'
            and (p.closes_at is null or p.closes_at > now())
          )
          or (
            ${view}::text = 'anonymous'
            and p.anonymous_vote = true
          )
          or (
            ${view}::text = 'quiz'
            and p.quiz_mode = true
          )
          or (
            ${view}::text = 'live'
            and p.live_session_id is not null
          )
          or (
            ${view}::text = 'standalone'
            and p.live_session_id is null
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listPolls(tx: TenantTx, query: PollsListQuery): Promise<PollListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const view = query.view;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.title,
        p.description,
        p.poll_type,
        p.status::text as status,
        p.quiz_mode,
        p.allow_multiple_answers,
        p.anonymous_vote,
        p.result_visibility,
        p.layout,
        p.duration_seconds,
        p.live_session_id::text as live_session_id,
        ls.title as live_session_title,
        p.closes_at,
        (
          p.status::text = 'ACTIVE'
          and (p.closes_at is null or p.closes_at > now())
        ) as is_open,
        p.created_at,
        (
          select count(*)::int from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as response_count,
        (
          select count(*)::int from poll_options po
          where po.poll_id = p.id and po.tenant_id = p.tenant_id
        ) as option_count,
        case
          when p.live_session_id is null then null
          when (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = p.live_session_id
              and la.tenant_id = p.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric
                from poll_responses pr
                where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
              )
              / nullif(
                (
                  select count(*)::numeric
                  from live_attendance la
                  where la.live_session_id = p.live_session_id
                    and la.tenant_id = p.tenant_id
                ),
                0
              )
            ) * 100
          )::float
        end as participation_pct
      from polls p
      left join live_sessions ls
        on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${query.status ?? null}::text is null or p.status::text = ${query.status ?? null})
        and (${query.pollType ?? null}::text is null or p.poll_type = ${query.pollType ?? null})
        and (
          ${query.q ?? null}::text is null
          or lower(p.title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(p.description, '')) like '%' || lower(${query.q ?? null}) || '%'
        )
        and (
          ${query.createdFrom ?? null}::timestamptz is null
          or p.created_at >= ${query.createdFrom ?? null}::timestamptz
        )
        and (
          ${query.createdTo ?? null}::timestamptz is null
          or p.created_at <= ${query.createdTo ?? null}::timestamptz
        )
        and (
          ${view}::text = 'all'
          or (
            ${view}::text = 'open'
            and p.status::text = 'ACTIVE'
            and (p.closes_at is null or p.closes_at > now())
          )
          or (
            ${view}::text = 'anonymous'
            and p.anonymous_vote = true
          )
          or (
            ${view}::text = 'quiz'
            and p.quiz_mode = true
          )
          or (
            ${view}::text = 'live'
            and p.live_session_id is not null
          )
          or (
            ${view}::text = 'standalone'
            and p.live_session_id is null
          )
        )
      order by p.created_at desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapPollListRow);
  },

  async summarizePolls(
    tx: TenantTx,
    query: Pick<PollsListQuery, "q" | "status" | "pollType" | "createdFrom" | "createdTo">,
  ): Promise<PollsListSummaryRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with poll_base as (
        select
          p.id,
          p.tenant_id,
          p.status,
          p.quiz_mode,
          p.anonymous_vote,
          p.closes_at,
          p.live_session_id,
          (
            select count(*)::int
            from poll_responses pr
            where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
          ) as response_count,
          case
            when p.live_session_id is null then null
            when (
              select count(*)::int
              from live_attendance la
              where la.live_session_id = p.live_session_id
                and la.tenant_id = p.tenant_id
            ) = 0 then null
            else (
              (
                select count(*)::numeric
                from poll_responses pr
                where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
              )
              / nullif(
                (
                  select count(*)::numeric
                  from live_attendance la
                  where la.live_session_id = p.live_session_id
                    and la.tenant_id = p.tenant_id
                ),
                0
              )
            ) * 100
          end as participation_pct,
          case
            when p.quiz_mode = false then null
            when (
              select count(*)::int
              from poll_responses pr
              where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
            ) = 0 then null
            else (
              (
                select count(*)::numeric
                from poll_responses pr
                join poll_options po
                  on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
                where pr.poll_id = p.id
                  and pr.tenant_id = p.tenant_id
                  and po.is_correct = true
              )
              / nullif(
                (
                  select count(*)::numeric
                  from poll_responses pr
                  where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
                ),
                0
              )
            ) * 100
          end as quiz_correct_pct
        from polls p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (${query.status ?? null}::text is null or p.status::text = ${query.status ?? null})
          and (${query.pollType ?? null}::text is null or p.poll_type = ${query.pollType ?? null})
          and (
            ${query.q ?? null}::text is null
            or lower(p.title) like '%' || lower(${query.q ?? null}) || '%'
            or lower(coalesce(p.description, '')) like '%' || lower(${query.q ?? null}) || '%'
          )
          and (
            ${query.createdFrom ?? null}::timestamptz is null
            or p.created_at >= ${query.createdFrom ?? null}::timestamptz
          )
          and (
            ${query.createdTo ?? null}::timestamptz is null
            or p.created_at <= ${query.createdTo ?? null}::timestamptz
          )
      )
      select
        coalesce(sum(pb.response_count), 0)::int as total_responses,
        count(*)::int as poll_count,
        round(avg(pb.participation_pct) filter (where pb.participation_pct is not null))::float
          as avg_participation_pct,
        count(*) filter (where pb.quiz_mode = true)::int as quiz_poll_count,
        round(avg(pb.quiz_correct_pct) filter (where pb.quiz_correct_pct is not null))::float
          as avg_quiz_correct_pct,
        count(*) filter (
          where pb.status::text = 'ACTIVE'
            and (pb.closes_at is null or pb.closes_at > now())
        )::int as open_now_count,
        count(*) filter (where pb.anonymous_vote = true)::int as anonymous_count
      from poll_base pb
    `;

    const row = rows[0] ?? {};
    return {
      total_responses: Number(row["total_responses"] ?? 0),
      poll_count: Number(row["poll_count"] ?? 0),
      avg_participation_pct:
        row["avg_participation_pct"] == null ? null : Number(row["avg_participation_pct"]),
      quiz_poll_count: Number(row["quiz_poll_count"] ?? 0),
      avg_quiz_correct_pct:
        row["avg_quiz_correct_pct"] == null ? null : Number(row["avg_quiz_correct_pct"]),
      open_now_count: Number(row["open_now_count"] ?? 0),
      anonymous_count: Number(row["anonymous_count"] ?? 0),
    };
  },

  async findPollById(tx: TenantTx, pollId: string): Promise<PollListRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as id,
        p.title,
        p.description,
        p.poll_type,
        p.status::text as status,
        p.quiz_mode,
        p.allow_multiple_answers,
        p.anonymous_vote,
        p.result_visibility,
        p.layout,
        p.duration_seconds,
        p.live_session_id::text as live_session_id,
        ls.title as live_session_title,
        p.closes_at,
        (
          p.status::text = 'ACTIVE'
          and (p.closes_at is null or p.closes_at > now())
        ) as is_open,
        p.created_at,
        (
          select count(*)::int from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as response_count,
        (
          select count(*)::int from poll_options po
          where po.poll_id = p.id and po.tenant_id = p.tenant_id
        ) as option_count,
        case
          when p.live_session_id is null then null
          when (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = p.live_session_id
              and la.tenant_id = p.tenant_id
          ) = 0 then null
          else round(
            (
              (
                select count(*)::numeric
                from poll_responses pr
                where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
              )
              / nullif(
                (
                  select count(*)::numeric
                  from live_attendance la
                  where la.live_session_id = p.live_session_id
                    and la.tenant_id = p.tenant_id
                ),
                0
              )
            ) * 100
          )::float
        end as participation_pct
      from polls p
      left join live_sessions ls
        on ls.id = p.live_session_id and ls.tenant_id = p.tenant_id
      where p.id = ${pollId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return mapPollListRow(row);
  },

  async listOptionBreakdown(tx: TenantTx, pollId: string): Promise<PollOptionBreakdownRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        po.id::text as option_id,
        po.label,
        po.sort_order,
        po.is_correct,
        count(pr.id)::int as count
      from poll_options po
      left join poll_responses pr
        on pr.poll_option_id = po.id and pr.tenant_id = po.tenant_id
      where po.poll_id = ${pollId}::uuid
      group by po.id, po.label, po.sort_order, po.is_correct
      order by po.sort_order asc
    `;
    return rows.map((row) => ({
      option_id: textColumn(row["option_id"]),
      label: textColumn(row["label"]),
      sort_order: Number(row["sort_order"] ?? 0),
      is_correct: Boolean(row["is_correct"]),
      count: Number(row["count"] ?? 0),
    }));
  },

  async getPollDetailExtras(tx: TenantTx, pollId: string): Promise<PollDetailExtrasRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        (
          select count(distinct pr.membership_id)::int
          from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as unique_learner_count,
        case
          when p.live_session_id is null then null
          else (
            select count(*)::int
            from live_attendance la
            where la.live_session_id = p.live_session_id
              and la.tenant_id = p.tenant_id
          )
        end as eligible_count,
        (
          select count(*)::int
          from poll_responses pr
          join poll_options po
            on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
          where pr.poll_id = p.id
            and pr.tenant_id = p.tenant_id
            and po.is_correct = true
        ) as correct_count,
        (
          select percentile_cont(0.5) within group (
            order by extract(epoch from (pr.created_at - p.created_at))
          )::float
          from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as median_response_seconds,
        (
          select min(pr.created_at)
          from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as first_response_at,
        (
          select max(pr.created_at)
          from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as last_response_at,
        coalesce(
          (
            select array_agg(
              greatest(0, extract(epoch from (pr.created_at - p.created_at)))::float
              order by pr.created_at asc
            )
            from poll_responses pr
            where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
          ),
          '{}'::float[]
        ) as response_offsets
      from polls p
      where p.id = ${pollId}::uuid
      limit 1
    `;
    const row = rows[0] ?? {};
    const offsetsRaw = row["response_offsets"];
    const response_offsets = Array.isArray(offsetsRaw)
      ? offsetsRaw.map((value) => Number(value)).filter((value) => Number.isFinite(value))
      : [];
    return {
      unique_learner_count: Number(row["unique_learner_count"] ?? 0),
      eligible_count: row["eligible_count"] == null ? null : Number(row["eligible_count"]),
      correct_count: Number(row["correct_count"] ?? 0),
      median_response_seconds:
        row["median_response_seconds"] == null ? null : Number(row["median_response_seconds"]),
      first_response_at: row["first_response_at"] instanceof Date ? row["first_response_at"] : null,
      last_response_at: row["last_response_at"] instanceof Date ? row["last_response_at"] : null,
      response_offsets,
    };
  },

  async countRespondents(tx: TenantTx, filter: PollRespondentsFilter): Promise<number> {
    const isCorrect = filter.isCorrect ?? "any";
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from poll_responses pr
      join poll_options po on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
      join memberships m on m.id = pr.membership_id and m.tenant_id = pr.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and pr.poll_id = ${filter.pollId}::uuid
        and (
          ${filter.optionId ?? null}::uuid is null
          or pr.poll_option_id = ${filter.optionId ?? null}::uuid
        )
        and (
          ${isCorrect}::text = 'any'
          or (${isCorrect}::text = 'correct' and po.is_correct = true)
          or (${isCorrect}::text = 'incorrect' and po.is_correct = false)
        )
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.respondedFrom ?? null}::timestamptz is null
          or pr.created_at >= ${filter.respondedFrom ?? null}::timestamptz
        )
        and (
          ${filter.respondedTo ?? null}::timestamptz is null
          or pr.created_at <= ${filter.respondedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listRespondents(
    tx: TenantTx,
    pollId: string,
    query: PollRespondentsQuery,
  ): Promise<PollRespondentRow[]> {
    const skip = (query.page - 1) * query.limit;
    const isCorrect = query.isCorrect;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        pr.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        po.id::text as option_id,
        po.label as option_label,
        po.is_correct,
        greatest(0, extract(epoch from (pr.created_at - p.created_at)))::float as response_seconds,
        pr.created_at as responded_at
      from poll_responses pr
      join polls p on p.id = pr.poll_id and p.tenant_id = pr.tenant_id
      join poll_options po on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
      join memberships m on m.id = pr.membership_id and m.tenant_id = pr.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and pr.poll_id = ${pollId}::uuid
        and (
          ${query.optionId ?? null}::uuid is null
          or pr.poll_option_id = ${query.optionId ?? null}::uuid
        )
        and (
          ${isCorrect}::text = 'any'
          or (${isCorrect}::text = 'correct' and po.is_correct = true)
          or (${isCorrect}::text = 'incorrect' and po.is_correct = false)
        )
        and (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (
          ${query.respondedFrom ?? null}::timestamptz is null
          or pr.created_at >= ${query.respondedFrom ?? null}::timestamptz
        )
        and (
          ${query.respondedTo ?? null}::timestamptz is null
          or pr.created_at <= ${query.respondedTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then coalesce(mp.display_name, ap.email, m.invited_email_normalized) end desc nulls last,
        case when ${query.sortBy} = 'option_label' and ${query.sortDir} = 'asc' then po.label end asc,
        case when ${query.sortBy} = 'option_label' and ${query.sortDir} = 'desc' then po.label end desc,
        case when ${query.sortBy} = 'response_seconds' and ${query.sortDir} = 'asc' then extract(epoch from (pr.created_at - p.created_at)) end asc nulls last,
        case when ${query.sortBy} = 'response_seconds' and ${query.sortDir} = 'desc' then extract(epoch from (pr.created_at - p.created_at)) end desc nulls last,
        case when ${query.sortBy} = 'responded_at' and ${query.sortDir} = 'asc' then pr.created_at end asc,
        case when ${query.sortBy} = 'responded_at' and ${query.sortDir} = 'desc' then pr.created_at end desc,
        pr.id desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      membership_id: textColumn(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      option_id: textColumn(row["option_id"]),
      option_label: textColumn(row["option_label"]),
      is_correct: Boolean(row["is_correct"]),
      response_seconds: row["response_seconds"] == null ? null : Number(row["response_seconds"]),
      responded_at: row["responded_at"] as Date,
    }));
  },

  async getOptionExtras(
    tx: TenantTx,
    pollId: string,
    optionId: string,
  ): Promise<PollOptionExtrasRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        (
          select percentile_cont(0.5) within group (
            order by extract(epoch from (pr.created_at - p.created_at))
          )::float
          from poll_responses pr
          where pr.poll_id = p.id
            and pr.tenant_id = p.tenant_id
            and pr.poll_option_id = ${optionId}::uuid
        ) as option_median_response_seconds,
        coalesce(
          (
            select array_agg(
              greatest(0, extract(epoch from (pr.created_at - p.created_at)))::float
              order by pr.created_at asc
            )
            from poll_responses pr
            where pr.poll_id = p.id
              and pr.tenant_id = p.tenant_id
              and pr.poll_option_id = ${optionId}::uuid
          ),
          '{}'::float[]
        ) as option_offsets,
        (
          select percentile_cont(0.5) within group (
            order by extract(epoch from (pr.created_at - p.created_at))
          )::float
          from poll_responses pr
          where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
        ) as overall_median_response_seconds,
        coalesce(
          (
            select array_agg(
              greatest(0, extract(epoch from (pr.created_at - p.created_at)))::float
              order by pr.created_at asc
            )
            from poll_responses pr
            where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
          ),
          '{}'::float[]
        ) as overall_offsets
      from polls p
      where p.id = ${pollId}::uuid
      limit 1
    `;
    const row = rows[0] ?? {};
    const parseOffsets = (raw: unknown) =>
      Array.isArray(raw)
        ? raw.map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];
    return {
      option_median_response_seconds:
        row["option_median_response_seconds"] == null
          ? null
          : Number(row["option_median_response_seconds"]),
      option_offsets: parseOffsets(row["option_offsets"]),
      overall_median_response_seconds:
        row["overall_median_response_seconds"] == null
          ? null
          : Number(row["overall_median_response_seconds"]),
      overall_offsets: parseOffsets(row["overall_offsets"]),
    };
  },

  async listOptionBatchSegments(
    tx: TenantTx,
    pollId: string,
    optionId: string,
  ): Promise<PollOptionSegmentRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with option_voters as (
        select pr.membership_id
        from poll_responses pr
        where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
          and pr.poll_id = ${pollId}::uuid
          and pr.poll_option_id = ${optionId}::uuid
      ),
      assigned as (
        select
          b.id::text as key,
          b.name as label,
          count(distinct ov.membership_id)::int as count
        from option_voters ov
        join batch_memberships bm
          on bm.membership_id = ov.membership_id
          and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
        join batches b
          on b.id = bm.batch_id
          and b.tenant_id = bm.tenant_id
        group by b.id, b.name
      ),
      unassigned as (
        select
          'unassigned'::text as key,
          'No batch'::text as label,
          count(*)::int as count
        from option_voters ov
        where not exists (
          select 1
          from batch_memberships bm
          where bm.membership_id = ov.membership_id
            and bm.tenant_id = current_setting('app.tenant_id', true)::uuid
        )
      )
      select key, label, count
      from (
        select * from assigned
        union all
        select * from unassigned where count > 0
      ) segments
      order by count desc, label asc
      limit 8
    `;
    return rows.map((row) => ({
      key: textColumn(row["key"]),
      label: textColumn(row["label"]),
      count: Number(row["count"] ?? 0),
    }));
  },

  async setPollClosesAt(tx: TenantTx, pollId: string, closesAt: Date): Promise<Date | null> {
    const rows = await tx.$queryRaw<Array<{ closes_at: Date }>>`
      update polls
      set closes_at = ${closesAt}::timestamptz, updated_at = now()
      where id = ${pollId}::uuid
      returning closes_at
    `;
    return rows[0]?.closes_at ?? null;
  },

  async listRecentAnswers(
    tx: TenantTx,
    pollId: string,
    limit = 15,
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      option_id: string;
      option_label: string;
      responded_at: Date;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        pr.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        po.id::text as option_id,
        po.label as option_label,
        pr.created_at as responded_at
      from poll_responses pr
      join poll_options po on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
      join memberships m on m.id = pr.membership_id and m.tenant_id = pr.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and pr.poll_id = ${pollId}::uuid
      order by pr.created_at desc, pr.id desc
      limit ${limit}
    `;
    return rows.map((row) => ({
      membership_id: textColumn(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      option_id: textColumn(row["option_id"]),
      option_label: textColumn(row["option_label"]),
      responded_at: row["responded_at"] as Date,
    }));
  },
};
