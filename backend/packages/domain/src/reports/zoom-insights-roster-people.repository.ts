import type { TenantTx } from "@atlas/db";
import type { ZoomPeopleListQuery, ZoomPersonMeetingsQuery } from "./zoom-insights-roster.dto";
import type {
  ZoomPeopleSummaryRow,
  ZoomPersonListRow,
  ZoomPersonMeetingRow,
} from "./zoom-insights-roster.repository";

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapPersonListRow(row: Record<string, unknown>): ZoomPersonListRow {
  return {
    identity_key: typeof row["identity_key"] === "string" ? row["identity_key"] : "",
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    external_user_id: typeof row["external_user_id"] === "string" ? row["external_user_id"] : null,
    display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
    zoom_display_name:
      typeof row["zoom_display_name"] === "string" ? row["zoom_display_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    match_state:
      row["match_state"] === "matched" ||
      row["match_state"] === "unmatched" ||
      row["match_state"] === "guest"
        ? row["match_state"]
        : "unmatched",
    meetings_attended: Number(row["meetings_attended"] ?? 0),
    total_duration_seconds: Number(row["total_duration_seconds"] ?? 0),
    avg_duration_seconds:
      row["avg_duration_seconds"] == null ? null : Number(row["avg_duration_seconds"]),
    avg_coverage_percent:
      row["avg_coverage_percent"] == null ? null : Number(row["avg_coverage_percent"]),
    first_seen_at: asDate(row["first_seen_at"]),
    last_seen_at: asDate(row["last_seen_at"]),
    representative_meeting_id:
      typeof row["representative_meeting_id"] === "string" ? row["representative_meeting_id"] : "",
    representative_participant_id:
      typeof row["representative_participant_id"] === "string"
        ? row["representative_participant_id"]
        : "",
  };
}

function mapPersonMeetingRow(row: Record<string, unknown>): ZoomPersonMeetingRow {
  return {
    meeting_id: typeof row["meeting_id"] === "string" ? row["meeting_id"] : "",
    participant_id: typeof row["participant_id"] === "string" ? row["participant_id"] : "",
    topic: typeof row["topic"] === "string" ? row["topic"] : null,
    external_meeting_id:
      typeof row["external_meeting_id"] === "string" ? row["external_meeting_id"] : "",
    started_at: asDate(row["started_at"]),
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    coverage_percent: row["coverage_percent"] == null ? null : Number(row["coverage_percent"]),
    rejoin_count: Number(row["rejoin_count"] ?? 0),
  };
}

/**
 * People across meetings and one person's meetings.
 * Part of zoomInsightsRosterRepository.
 */
export const zoomInsightsRosterPeopleRepository = {
  async countMeetingsInRange(
    tx: TenantTx,
    attendedFrom?: string,
    attendedTo?: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from zoom_meetings zm
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${attendedFrom ?? null}::timestamptz is null
          or zm.started_at >= ${attendedFrom ?? null}::timestamptz
        )
        and (
          ${attendedTo ?? null}::timestamptz is null
          or zm.started_at <= ${attendedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async countPeople(tx: TenantTx, query: ZoomPeopleListQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      per_meeting as (
        select
          identity_key,
          zoom_meeting_id,
          max(membership_id::text) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds,
          min(join_time) as first_join,
          max(leave_time) as last_leave,
          (array_agg(id::text order by join_time asc nulls last))[1] as participant_id
        from sessions
        group by identity_key, zoom_meeting_id
      ),
      people as (
        select
          identity_key,
          max(membership_id) as membership_id,
          max(display_name) as display_name,
          max(email) as email,
          count(*)::int as meetings_attended,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          case
            when count(*) filter (where meeting_duration_seconds > 0) = 0 then null
            else round(
              (
                avg(
                  least(
                    100.0,
                    (duration_seconds::float8 * 100.0) / nullif(meeting_duration_seconds, 0)
                  )
                ) filter (where meeting_duration_seconds > 0)
              )::numeric,
              1
            )::float8
          end as avg_coverage_percent,
          case
            when max(membership_id) is not null then 'matched'
            when max(email) is null
              or lower(coalesce(max(display_name), '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from per_meeting
        group by identity_key
      )
      select count(*)::bigint as count
      from people
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(display_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(email, '')) like '%' || lower(${query.q ?? null}) || '%'
      )
      and (
        ${query.matchState} = 'all'
        or match_state = ${query.matchState}
      )
      and (
        ${query.meetingsMin ?? null}::int is null
        or meetings_attended >= ${query.meetingsMin ?? null}::int
      )
      and (
        ${query.meetingsMax ?? null}::int is null
        or meetings_attended <= ${query.meetingsMax ?? null}::int
      )
      and (
        ${query.coverageMin ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) >= ${query.coverageMin ?? null}::float8
      )
      and (
        ${query.coverageMax ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) <= ${query.coverageMax ?? null}::float8
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listPeople(tx: TenantTx, query: ZoomPeopleListQuery): Promise<ZoomPersonListRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      per_meeting as (
        select
          identity_key,
          zoom_meeting_id,
          max(membership_id::text) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds,
          min(join_time) as first_join,
          max(coalesce(leave_time, join_time)) as last_leave,
          (array_agg(id::text order by join_time asc nulls last))[1] as participant_id
        from sessions
        group by identity_key, zoom_meeting_id
      ),
      people as (
        select
          identity_key,
          max(membership_id) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          count(*)::int as meetings_attended,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          case
            when count(*) = 0 then null
            else round(avg(duration_seconds))::int
          end as avg_duration_seconds,
          case
            when count(*) filter (where meeting_duration_seconds > 0) = 0 then null
            else round(
              (
                avg(
                  least(
                    100.0,
                    (duration_seconds::float8 * 100.0) / nullif(meeting_duration_seconds, 0)
                  )
                ) filter (where meeting_duration_seconds > 0)
              )::numeric,
              1
            )::float8
          end as avg_coverage_percent,
          min(first_join) as first_seen_at,
          max(last_leave) as last_seen_at,
          (array_agg(zoom_meeting_id::text order by last_leave desc nulls last))[1]
            as representative_meeting_id,
          (array_agg(participant_id order by last_leave desc nulls last))[1]
            as representative_participant_id,
          case
            when max(membership_id) is not null then 'matched'
            when max(email) is null
              or lower(coalesce(max(display_name), '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from per_meeting
        group by identity_key
      )
      select *
      from people
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(display_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(email, '')) like '%' || lower(${query.q ?? null}) || '%'
      )
      and (
        ${query.matchState} = 'all'
        or match_state = ${query.matchState}
      )
      and (
        ${query.meetingsMin ?? null}::int is null
        or meetings_attended >= ${query.meetingsMin ?? null}::int
      )
      and (
        ${query.meetingsMax ?? null}::int is null
        or meetings_attended <= ${query.meetingsMax ?? null}::int
      )
      and (
        ${query.coverageMin ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) >= ${query.coverageMin ?? null}::float8
      )
      and (
        ${query.coverageMax ?? null}::float8 is null
        or coalesce(avg_coverage_percent, 0) <= ${query.coverageMax ?? null}::float8
      )
      order by
        case when ${sortBy} = 'display_name' and ${sortDir} = 'asc' then display_name end asc nulls last,
        case when ${sortBy} = 'display_name' and ${sortDir} = 'desc' then display_name end desc nulls last,
        case when ${sortBy} = 'meetings_attended' and ${sortDir} = 'asc' then meetings_attended end asc,
        case when ${sortBy} = 'meetings_attended' and ${sortDir} = 'desc' then meetings_attended end desc,
        case when ${sortBy} = 'total_time' and ${sortDir} = 'asc' then total_duration_seconds end asc,
        case when ${sortBy} = 'total_time' and ${sortDir} = 'desc' then total_duration_seconds end desc,
        case when ${sortBy} = 'avg_duration' and ${sortDir} = 'asc' then avg_duration_seconds end asc nulls last,
        case when ${sortBy} = 'avg_duration' and ${sortDir} = 'desc' then avg_duration_seconds end desc nulls last,
        case when ${sortBy} = 'avg_coverage' and ${sortDir} = 'asc' then avg_coverage_percent end asc nulls last,
        case when ${sortBy} = 'avg_coverage' and ${sortDir} = 'desc' then avg_coverage_percent end desc nulls last,
        case when ${sortBy} = 'first_seen' and ${sortDir} = 'asc' then first_seen_at end asc nulls last,
        case when ${sortBy} = 'first_seen' and ${sortDir} = 'desc' then first_seen_at end desc nulls last,
        case when ${sortBy} = 'last_seen' and ${sortDir} = 'asc' then last_seen_at end asc nulls last,
        case when ${sortBy} = 'last_seen' and ${sortDir} = 'desc' then last_seen_at end desc nulls last,
        meetings_attended desc,
        display_name asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapPersonListRow);
  },

  async summarizePeople(tx: TenantTx, query: ZoomPeopleListQuery): Promise<ZoomPeopleSummaryRow> {
    const rows = await tx.$queryRaw<
      Array<{
        people_count: number;
        matched_count: number;
        unmatched_count: number;
        guest_count: number;
        avg_meetings_attended: number | null;
        total_duration_seconds: number;
        avg_coverage_percent: number | null;
        attended_once_only_count: number;
      }>
    >`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      per_meeting as (
        select
          identity_key,
          zoom_meeting_id,
          max(membership_id::text) as membership_id,
          max(display_name) as display_name,
          max(email) as email,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds
        from sessions
        group by identity_key, zoom_meeting_id
      ),
      people as (
        select
          identity_key,
          count(*)::int as meetings_attended,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          case
            when count(*) filter (where meeting_duration_seconds > 0) = 0 then null
            else (
              avg(
                least(
                  100.0,
                  (duration_seconds::float8 * 100.0) / nullif(meeting_duration_seconds, 0)
                )
              ) filter (where meeting_duration_seconds > 0)
            )::float8
          end as avg_coverage_percent,
          case
            when max(membership_id) is not null then 'matched'
            when max(email) is null
              or lower(coalesce(max(display_name), '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from per_meeting
        group by identity_key
      )
      select
        count(*)::int as people_count,
        count(*) filter (where match_state = 'matched')::int as matched_count,
        count(*) filter (where match_state = 'unmatched')::int as unmatched_count,
        count(*) filter (where match_state = 'guest')::int as guest_count,
        case
          when count(*) = 0 then null
          else round(avg(meetings_attended)::numeric, 1)::float8
        end as avg_meetings_attended,
        coalesce(sum(total_duration_seconds), 0)::int as total_duration_seconds,
        case
          when count(*) filter (where avg_coverage_percent is not null) = 0 then null
          else round(
            (avg(avg_coverage_percent) filter (where avg_coverage_percent is not null))::numeric,
            1
          )::float8
        end as avg_coverage_percent,
        count(*) filter (where meetings_attended = 1)::int as attended_once_only_count
      from people
    `;

    const row = rows[0];
    return {
      people_count: row?.people_count ?? 0,
      matched_count: row?.matched_count ?? 0,
      unmatched_count: row?.unmatched_count ?? 0,
      guest_count: row?.guest_count ?? 0,
      avg_meetings_attended: row?.avg_meetings_attended == null ? null : row.avg_meetings_attended,
      total_duration_seconds: row?.total_duration_seconds ?? 0,
      avg_coverage_percent: row?.avg_coverage_percent == null ? null : row.avg_coverage_percent,
      attended_once_only_count: row?.attended_once_only_count ?? 0,
    };
  },

  async listPersonMeetings(
    tx: TenantTx,
    query: ZoomPersonMeetingsQuery,
  ): Promise<{
    person: {
      identity_key: string;
      membership_id: string | null;
      display_name: string | null;
      email: string | null;
      match_state: "matched" | "unmatched" | "guest";
      representative_meeting_id: string | null;
      representative_participant_id: string | null;
    } | null;
    meetings: ZoomPersonMeetingRow[];
  }> {
    const meetingRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.membership_id,
          zmp.external_user_id,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          zm.topic,
          zm.external_meeting_id,
          zm.started_at,
          case
            when zm.started_at is not null and zm.ended_at is not null
              then greatest(0, floor(extract(epoch from (zm.ended_at - zm.started_at)))::int)
            else null
          end as meeting_duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      filtered as (
        select * from sessions where identity_key = ${query.identityKey}
      ),
      per_meeting as (
        select
          zoom_meeting_id,
          (array_agg(id::text order by join_time asc nulls last))[1] as participant_id,
          max(membership_id::text) as membership_id,
          max(display_name) as display_name,
          max(email) as email,
          max(topic) as topic,
          max(external_meeting_id) as external_meeting_id,
          max(started_at) as started_at,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          max(meeting_duration_seconds) as meeting_duration_seconds,
          greatest(count(*)::int - 1, 0)::int as rejoin_count
        from filtered
        group by zoom_meeting_id
      )
      select
        zoom_meeting_id::text as meeting_id,
        participant_id,
        membership_id,
        display_name,
        email,
        topic,
        external_meeting_id,
        started_at,
        duration_seconds,
        case
          when meeting_duration_seconds is null or meeting_duration_seconds <= 0 then null
          else round(
            least(100.0, (duration_seconds::float8 * 100.0) / meeting_duration_seconds)::numeric,
            1
          )::float8
        end as coverage_percent,
        rejoin_count
      from per_meeting
      order by started_at desc nulls last
    `;

    if (meetingRows.length === 0) {
      return { person: null, meetings: [] };
    }

    const meetings = meetingRows.map(mapPersonMeetingRow);
    const first = meetingRows[0];
    if (first == null) {
      return { person: null, meetings: [] };
    }
    const anyMembership = meetingRows.find(
      (row) => typeof row["membership_id"] === "string" && row["membership_id"],
    );
    const displayName = typeof first["display_name"] === "string" ? first["display_name"] : null;
    const email =
      (typeof anyMembership?.["email"] === "string" ? anyMembership["email"] : null) ??
      (typeof first["email"] === "string" ? first["email"] : null);
    const membership =
      typeof anyMembership?.["membership_id"] === "string" ? anyMembership["membership_id"] : null;
    const matchState: "matched" | "unmatched" | "guest" = membership
      ? "matched"
      : !email || (displayName != null && displayName.toLowerCase().startsWith("guest"))
        ? "guest"
        : "unmatched";

    return {
      person: {
        identity_key: query.identityKey,
        membership_id: membership,
        display_name: displayName,
        email,
        match_state: matchState,
        representative_meeting_id: meetings[0]?.meeting_id ?? null,
        representative_participant_id: meetings[0]?.participant_id ?? null,
      },
      meetings,
    };
  },
};
