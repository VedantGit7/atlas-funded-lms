import type { TenantTx } from "@atlas/db";
import type {
  PollNonRespondentsQuery,
  PollRespondentsQuery,
  PollsListQuery,
} from "./polls-roster.dto";
import { textColumn } from "./raw-column";

export type PollListRow = {
  id: string;
  title: string;
  description: string | null;
  poll_type: string;
  status: string;
  quiz_mode: boolean;
  allow_multiple_answers: boolean;
  anonymous_vote: boolean;
  result_visibility: string;
  layout: string;
  duration_seconds: number | null;
  live_session_id: string | null;
  live_session_title: string | null;
  closes_at: Date | null;
  is_open: boolean;
  response_count: number;
  option_count: number;
  participation_pct: number | null;
  created_at: Date;
};

export type PollsListSummaryRow = {
  total_responses: number;
  poll_count: number;
  avg_participation_pct: number | null;
  quiz_poll_count: number;
  avg_quiz_correct_pct: number | null;
  open_now_count: number;
  anonymous_count: number;
};

export type PollOptionBreakdownRow = {
  option_id: string;
  label: string;
  sort_order: number;
  is_correct: boolean;
  count: number;
};

export type PollRespondentRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  option_id: string;
  option_label: string;
  is_correct: boolean;
  response_seconds: number | null;
  responded_at: Date;
};

export type PollRespondentsFilter = {
  pollId: string;
  learnerName?: string;
  optionId?: string;
  isCorrect?: "any" | "correct" | "incorrect";
  respondedFrom?: string;
  respondedTo?: string;
};

export type PollDetailExtrasRow = {
  unique_learner_count: number;
  eligible_count: number | null;
  correct_count: number;
  median_response_seconds: number | null;
  first_response_at: Date | null;
  last_response_at: Date | null;
  response_offsets: number[];
};

export type PollOptionExtrasRow = {
  option_median_response_seconds: number | null;
  option_offsets: number[];
  overall_median_response_seconds: number | null;
  overall_offsets: number[];
};

export type PollOptionSegmentRow = {
  key: string;
  label: string;
  count: number;
};

function mapPollListRow(row: Record<string, unknown>): PollListRow {
  return {
    id: textColumn(row["id"]),
    title: textColumn(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    poll_type: textColumn(row["poll_type"], "multiple_choice"),
    status: textColumn(row["status"]),
    quiz_mode: Boolean(row["quiz_mode"]),
    allow_multiple_answers: Boolean(row["allow_multiple_answers"]),
    anonymous_vote: Boolean(row["anonymous_vote"]),
    result_visibility: textColumn(row["result_visibility"], "after_vote"),
    layout: textColumn(row["layout"], "list"),
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    live_session_id: typeof row["live_session_id"] === "string" ? row["live_session_id"] : null,
    live_session_title:
      typeof row["live_session_title"] === "string" ? row["live_session_title"] : null,
    closes_at: row["closes_at"] instanceof Date ? row["closes_at"] : null,
    is_open: Boolean(row["is_open"]),
    response_count: Number(row["response_count"] ?? 0),
    option_count: Number(row["option_count"] ?? 0),
    participation_pct: row["participation_pct"] == null ? null : Number(row["participation_pct"]),
    created_at: row["created_at"] as Date,
  };
}

export const pollsRosterRepository = {
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

  async findLiveSessionForPollReport(
    tx: TenantTx,
    liveSessionId: string,
  ): Promise<{
    id: string;
    title: string;
    status: string;
    scheduled_at: Date | null;
    started_at: Date | null;
    ended_at: Date | null;
    host_label: string | null;
    recording_url: string | null;
    timezone_label: string | null;
    planned_duration_minutes: number | null;
    batch_id: string | null;
    batch_name: string | null;
    course_id: string | null;
    course_title: string | null;
    attendance_count: number;
  } | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        ls.course_id::text as course_id,
        c.title as course_title,
        coalesce(
          nullif(ls.metadata_json->>'host', ''),
          nullif(ls.metadata_json->>'hostName', ''),
          nullif(ls.metadata_json->>'host_label', ''),
          nullif(ls.metadata_json->>'instructor', ''),
          null
        ) as host_label,
        coalesce(
          nullif(ls.metadata_json->>'recordingUrl', ''),
          nullif(ls.metadata_json->>'recording_url', ''),
          nullif(ls.metadata_json->>'recording', ''),
          null
        ) as recording_url,
        coalesce(
          nullif(ls.metadata_json->>'timezone', ''),
          nullif(ls.metadata_json->>'timezoneLabel', ''),
          null
        ) as timezone_label,
        case
          when (ls.metadata_json->>'durationMinutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'durationMinutes')::int
          when (ls.metadata_json->>'duration_minutes') ~ '^[0-9]+$'
            then (ls.metadata_json->>'duration_minutes')::int
          else null
        end as planned_duration_minutes,
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as attendance_count
      from live_sessions ls
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.id = ${liveSessionId}::uuid
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    const recordingUrl =
      typeof row["recording_url"] === "string" && row["recording_url"].length > 0
        ? row["recording_url"]
        : null;
    return {
      id: textColumn(row["id"]),
      title: textColumn(row["title"], "Live session"),
      status: textColumn(row["status"], "scheduled"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
      recording_url: recordingUrl,
      timezone_label: typeof row["timezone_label"] === "string" ? row["timezone_label"] : null,
      planned_duration_minutes:
        row["planned_duration_minutes"] == null ? null : Number(row["planned_duration_minutes"]),
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      course_id: typeof row["course_id"] === "string" ? row["course_id"] : null,
      course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
      attendance_count: Number(row["attendance_count"] ?? 0),
    };
  },

  async listPollsForLiveSession(tx: TenantTx, liveSessionId: string): Promise<PollListRow[]> {
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
        and p.live_session_id = ${liveSessionId}::uuid
      order by p.created_at asc, p.id asc
    `;
    return rows.map(mapPollListRow);
  },

  async listLiveSessionAttendanceIntervals(
    tx: TenantTx,
    liveSessionId: string,
  ): Promise<Array<{ joined_at: Date; left_at: Date | null; duration_seconds: number | null }>> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.joined_at,
        la.left_at,
        la.duration_seconds
      from live_attendance la
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${liveSessionId}::uuid
        and la.joined_at is not null
    `;
    return rows
      .filter((row) => row["joined_at"] instanceof Date)
      .map((row) => ({
        joined_at: row["joined_at"] as Date,
        left_at: row["left_at"] instanceof Date ? row["left_at"] : null,
        duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      }));
  },

  async listLiveSessionAttendees(
    tx: TenantTx,
    liveSessionId: string,
    limit = 300,
  ): Promise<
    Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from live_attendance la
      join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and la.live_session_id = ${liveSessionId}::uuid
      order by lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, '')) asc
      limit ${limit}
    `;
    return rows.map((row) => ({
      membership_id: textColumn(row["membership_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
    }));
  },

  async listLiveSessionPollResponses(
    tx: TenantTx,
    liveSessionId: string,
  ): Promise<
    Array<{
      poll_id: string;
      membership_id: string;
      is_correct: boolean | null;
    }>
  > {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        pr.poll_id::text as poll_id,
        pr.membership_id::text as membership_id,
        case
          when p.quiz_mode then po.is_correct
          else null
        end as is_correct
      from poll_responses pr
      join polls p on p.id = pr.poll_id and p.tenant_id = pr.tenant_id
      join poll_options po on po.id = pr.poll_option_id and po.tenant_id = pr.tenant_id
      where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and p.live_session_id = ${liveSessionId}::uuid
        and p.anonymous_vote = false
    `;
    return rows.map((row) => ({
      poll_id: textColumn(row["poll_id"]),
      membership_id: textColumn(row["membership_id"]),
      is_correct: row["is_correct"] == null ? null : Boolean(row["is_correct"]),
    }));
  },

  async countAnsweredEveryTrackedPoll(tx: TenantTx, liveSessionId: string): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with tracked_polls as (
        select p.id
        from polls p
        where p.tenant_id = current_setting('app.tenant_id', true)::uuid
          and p.live_session_id = ${liveSessionId}::uuid
          and p.anonymous_vote = false
      ),
      tracked_count as (
        select count(*)::int as n from tracked_polls
      ),
      attendees as (
        select distinct la.membership_id
        from live_attendance la
        where la.tenant_id = current_setting('app.tenant_id', true)::uuid
          and la.live_session_id = ${liveSessionId}::uuid
      ),
      answered as (
        select pr.membership_id, count(distinct pr.poll_id)::int as answered_n
        from poll_responses pr
        join tracked_polls tp on tp.id = pr.poll_id
        where pr.tenant_id = current_setting('app.tenant_id', true)::uuid
        group by pr.membership_id
      )
      select count(*)::bigint as count
      from attendees a
      join answered ans on ans.membership_id = a.membership_id
      cross join tracked_count tc
      where tc.n > 0
        and ans.answered_n >= tc.n
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countLiveSessionsWithPolls(tx: TenantTx, query: { q?: string }): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from live_sessions ls
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and exists (
          select 1 from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(ls.metadata_json->>'host', '')) like '%' || lower(${query.q ?? null}) || '%'
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listLiveSessionsWithPolls(
    tx: TenantTx,
    query: { q?: string; page: number; limit: number },
  ): Promise<
    Array<{
      id: string;
      title: string;
      status: string;
      scheduled_at: Date | null;
      started_at: Date | null;
      ended_at: Date | null;
      host_label: string | null;
      attendance_count: number;
      poll_count: number;
      quiz_poll_count: number;
      total_responses: number;
      avg_participation_pct: number | null;
      batch_id: string | null;
      batch_name: string | null;
      course_title: string | null;
    }>
  > {
    const offset = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as id,
        ls.title,
        ls.status,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        c.title as course_title,
        coalesce(
          nullif(ls.metadata_json->>'host', ''),
          nullif(ls.metadata_json->>'hostName', ''),
          nullif(ls.metadata_json->>'host_label', ''),
          nullif(ls.metadata_json->>'instructor', ''),
          null
        ) as host_label,
        (
          select count(*)::int
          from live_attendance la
          where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        ) as attendance_count,
        (
          select count(*)::int from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
        ) as poll_count,
        (
          select count(*)::int from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id and p.quiz_mode = true
        ) as quiz_poll_count,
        (
          select count(*)::int
          from poll_responses pr
          join polls p on p.id = pr.poll_id and p.tenant_id = pr.tenant_id
          where p.live_session_id = ls.id and pr.tenant_id = ls.tenant_id
        ) as total_responses,
        (
          select avg(part.pct)::float
          from (
            select
              case
                when att.n = 0 then null
                else round((resp.n::numeric / att.n::numeric) * 100, 1)::float
              end as pct
            from polls p
            cross join lateral (
              select count(*)::int as n
              from live_attendance la
              where la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
            ) att
            cross join lateral (
              select count(*)::int as n
              from poll_responses pr
              where pr.poll_id = p.id and pr.tenant_id = p.tenant_id
            ) resp
            where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
          ) part
          where part.pct is not null
        ) as avg_participation_pct
      from live_sessions ls
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and exists (
          select 1 from polls p
          where p.live_session_id = ls.id and p.tenant_id = ls.tenant_id
        )
        and (
          ${query.q ?? null}::text is null
          or lower(ls.title) like '%' || lower(${query.q ?? null}) || '%'
          or lower(coalesce(ls.metadata_json->>'host', ls.metadata_json->>'hostName', ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
      order by coalesce(ls.started_at, ls.scheduled_at, ls.created_at) desc, ls.id desc
      limit ${query.limit}
      offset ${offset}
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      title: textColumn(row["title"], "Live session"),
      status: textColumn(row["status"], "scheduled"),
      scheduled_at: row["scheduled_at"] instanceof Date ? row["scheduled_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      ended_at: row["ended_at"] instanceof Date ? row["ended_at"] : null,
      host_label: typeof row["host_label"] === "string" ? row["host_label"] : null,
      attendance_count: Number(row["attendance_count"] ?? 0),
      poll_count: Number(row["poll_count"] ?? 0),
      quiz_poll_count: Number(row["quiz_poll_count"] ?? 0),
      total_responses: Number(row["total_responses"] ?? 0),
      avg_participation_pct:
        row["avg_participation_pct"] == null ? null : Number(row["avg_participation_pct"]),
      batch_id: typeof row["batch_id"] === "string" ? row["batch_id"] : null,
      batch_name: typeof row["batch_name"] === "string" ? row["batch_name"] : null,
      course_title: typeof row["course_title"] === "string" ? row["course_title"] : null,
    }));
  },
};
