import type { TenantTx } from "@atlas/db";
import type { ZoomParticipantsQuery } from "./zoom-insights-roster.dto";
import type {
  ZoomParticipantHistoryRow,
  ZoomParticipantIdentityDetail,
  ZoomParticipantRow,
  ZoomParticipantsFilter,
} from "./zoom-insights-roster.repository";

function mapParticipantRow(row: Record<string, unknown>): ZoomParticipantRow {
  const matchStateRaw = typeof row["match_state"] === "string" ? row["match_state"] : "unmatched";
  const matchState =
    matchStateRaw === "matched" || matchStateRaw === "guest" ? matchStateRaw : "unmatched";
  return {
    id: String(row["id"]),
    membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : null,
    external_user_id: typeof row["external_user_id"] === "string" ? row["external_user_id"] : null,
    display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
    zoom_display_name:
      typeof row["zoom_display_name"] === "string" ? row["zoom_display_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    join_time: row["join_time"] instanceof Date ? row["join_time"] : null,
    leave_time: row["leave_time"] instanceof Date ? row["leave_time"] : null,
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    session_count: Number(row["session_count"] ?? 1),
    rejoin_count: Number(row["rejoin_count"] ?? 0),
    match_state: matchState,
  };
}

/**
 * Participants, one identity's detail, and matching identities to learners.
 * Part of zoomInsightsRosterRepository.
 */
export const zoomInsightsRosterParticipantsRepository = {
  async countParticipants(tx: TenantTx, filter: ZoomParticipantsFilter): Promise<number> {
    const matchState = filter.matchState ?? "all";
    const durationBucket = filter.durationBucket ?? "any";
    const rejoinedOnly = filter.rejoinedOnly ?? false;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with sessions as (
        select
          zmp.id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(zmp.display_name, mp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          zmp.duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${filter.meetingId}::uuid
          and (
            ${filter.displayName ?? null}::text is null
            or lower(coalesce(zmp.display_name, mp.display_name, ''))
              like '%' || lower(${filter.displayName ?? null}) || '%'
          )
          and (
            ${filter.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${filter.email ?? null}) || '%'
          )
          and (
            ${filter.joinedFrom ?? null}::timestamptz is null
            or zmp.join_time >= ${filter.joinedFrom ?? null}::timestamptz
          )
          and (
            ${filter.joinedTo ?? null}::timestamptz is null
            or zmp.join_time <= ${filter.joinedTo ?? null}::timestamptz
          )
      ),
      aggregated as (
        select
          identity_key,
          max(membership_id::text) as membership_id,
          max(email) as email,
          max(display_name) as display_name,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          count(*)::int as session_count
        from sessions
        group by identity_key
      ),
      classified as (
        select
          *,
          case
            when membership_id is not null then 'matched'
            when email is null
              or lower(coalesce(display_name, '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from aggregated
      )
      select count(*)::bigint as count
      from classified
      where (
        ${matchState} = 'all'
        or match_state = ${matchState}
      )
      and (
        ${durationBucket} = 'any'
        or (${durationBucket} = 'under_10' and duration_seconds < 600)
        or (${durationBucket} = '10_to_30' and duration_seconds >= 600 and duration_seconds <= 1800)
        or (${durationBucket} = 'over_30' and duration_seconds > 1800)
      )
      and (
        ${rejoinedOnly} = false
        or session_count > 1
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async summarizeParticipants(
    tx: TenantTx,
    meetingId: string,
  ): Promise<{ matchedCount: number; unmatchedCount: number; guestCount: number }> {
    const rows = await tx.$queryRaw<
      Array<{ matched_count: number; unmatched_count: number; guest_count: number }>
    >`
      with sessions as (
        select
          zmp.membership_id,
          zmp.external_user_id,
          coalesce(zmp.display_name, mp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.zoom_meeting_id = ${meetingId}::uuid
          and zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      aggregated as (
        select
          identity_key,
          max(membership_id::text) as membership_id,
          max(email) as email,
          max(display_name) as display_name
        from sessions
        group by identity_key
      )
      select
        count(*) filter (where membership_id is not null)::int as matched_count,
        count(*) filter (
          where membership_id is null
            and email is not null
            and lower(coalesce(display_name, '')) not like 'guest%'
        )::int as unmatched_count,
        count(*) filter (
          where membership_id is null
            and (
              email is null
              or lower(coalesce(display_name, '')) like 'guest%'
            )
        )::int as guest_count
      from aggregated
    `;
    return {
      matchedCount: rows[0]?.matched_count ?? 0,
      unmatchedCount: rows[0]?.unmatched_count ?? 0,
      guestCount: rows[0]?.guest_count ?? 0,
    };
  },

  async listParticipants(
    tx: TenantTx,
    meetingId: string,
    query: ZoomParticipantsQuery,
  ): Promise<ZoomParticipantRow[]> {
    const skip = (query.page - 1) * query.limit;
    const sortBy = query.sortBy;
    const sortDir = query.sortDir;
    const matchState = query.matchState;
    const durationBucket = query.durationBucket;
    const rejoinedOnly = query.rejoinedOnly;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.membership_id,
          zmp.external_user_id,
          zmp.display_name as zoom_display_name,
          coalesce(mp.display_name, zmp.display_name) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          zmp.join_time,
          zmp.leave_time,
          zmp.duration_seconds,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${meetingId}::uuid
          and (
            ${query.displayName ?? null}::text is null
            or lower(coalesce(zmp.display_name, mp.display_name, ''))
              like '%' || lower(${query.displayName ?? null}) || '%'
          )
          and (
            ${query.email ?? null}::text is null
            or lower(coalesce(ap.email, m.invited_email_normalized, ''))
              like '%' || lower(${query.email ?? null}) || '%'
          )
          and (
            ${query.joinedFrom ?? null}::timestamptz is null
            or zmp.join_time >= ${query.joinedFrom ?? null}::timestamptz
          )
          and (
            ${query.joinedTo ?? null}::timestamptz is null
            or zmp.join_time <= ${query.joinedTo ?? null}::timestamptz
          )
      ),
      aggregated as (
        select
          (array_agg(id::text order by join_time asc nulls last))[1] as id,
          max(membership_id::text) as membership_id,
          max(external_user_id) as external_user_id,
          max(display_name) as display_name,
          max(zoom_display_name) as zoom_display_name,
          max(email) as email,
          min(join_time) as join_time,
          max(leave_time) as leave_time,
          coalesce(sum(duration_seconds), 0)::int as duration_seconds,
          count(*)::int as session_count,
          greatest(count(*)::int - 1, 0)::int as rejoin_count
        from sessions
        group by identity_key
      ),
      classified as (
        select
          *,
          case
            when membership_id is not null then 'matched'
            when email is null
              or lower(coalesce(display_name, '')) like 'guest%'
              then 'guest'
            else 'unmatched'
          end as match_state
        from aggregated
      )
      select *
      from classified
      where (
        ${matchState} = 'all'
        or match_state = ${matchState}
      )
      and (
        ${durationBucket} = 'any'
        or (${durationBucket} = 'under_10' and duration_seconds < 600)
        or (${durationBucket} = '10_to_30' and duration_seconds >= 600 and duration_seconds <= 1800)
        or (${durationBucket} = 'over_30' and duration_seconds > 1800)
      )
      and (
        ${rejoinedOnly} = false
        or session_count > 1
      )
      order by
        case when ${sortBy} = 'display_name' and ${sortDir} = 'asc' then display_name end asc nulls last,
        case when ${sortBy} = 'display_name' and ${sortDir} = 'desc' then display_name end desc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'asc' then email end asc nulls last,
        case when ${sortBy} = 'email' and ${sortDir} = 'desc' then email end desc nulls last,
        case when ${sortBy} = 'join_time' and ${sortDir} = 'asc' then join_time end asc nulls last,
        case when ${sortBy} = 'join_time' and ${sortDir} = 'desc' then join_time end desc nulls last,
        case when ${sortBy} = 'leave_time' and ${sortDir} = 'asc' then leave_time end asc nulls last,
        case when ${sortBy} = 'leave_time' and ${sortDir} = 'desc' then leave_time end desc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'asc' then duration_seconds end asc nulls last,
        case when ${sortBy} = 'duration_seconds' and ${sortDir} = 'desc' then duration_seconds end desc nulls last,
        case when ${sortBy} = 'rejoins' and ${sortDir} = 'asc' then rejoin_count end asc nulls last,
        case when ${sortBy} = 'rejoins' and ${sortDir} = 'desc' then rejoin_count end desc nulls last,
        join_time asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map(mapParticipantRow);
  },

  async findParticipantIdentityDetail(
    tx: TenantTx,
    meetingId: string,
    participantId: string,
  ): Promise<ZoomParticipantIdentityDetail | null> {
    const seedRows = await tx.$queryRaw<
      Array<{
        identity_key: string;
        membership_id: string | null;
        external_user_id: string | null;
        display_name: string | null;
        zoom_display_name: string | null;
        email: string | null;
        membership_status: string | null;
      }>
    >`
      select
        coalesce(
          'm:' || zmp.membership_id::text,
          'e:' || nullif(zmp.external_user_id, ''),
          'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
            || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
        ) as identity_key,
        zmp.membership_id::text as membership_id,
        zmp.external_user_id,
        coalesce(mp.display_name, zmp.display_name) as display_name,
        zmp.display_name as zoom_display_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        m.status::text as membership_status
      from zoom_meeting_participants zmp
      left join memberships m
        on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zmp.zoom_meeting_id = ${meetingId}::uuid
        and zmp.id = ${participantId}::uuid
      limit 1
    `;
    const seed = seedRows[0];
    if (!seed) return null;

    const sessionRows = await tx.$queryRaw<
      Array<{
        id: string;
        join_time: Date | null;
        leave_time: Date | null;
        duration_seconds: number | null;
        display_name: string | null;
        membership_id: string | null;
        email: string | null;
      }>
    >`
      with sessions as (
        select
          zmp.id::text as id,
          zmp.join_time,
          zmp.leave_time,
          zmp.duration_seconds,
          zmp.display_name,
          zmp.membership_id::text as membership_id,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) as identity_key
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${meetingId}::uuid
      )
      select id, join_time, leave_time, duration_seconds, display_name, membership_id, email
      from sessions
      where identity_key = ${seed.identity_key}
      order by join_time asc nulls last, id asc
    `;

    if (sessionRows.length === 0) return null;

    const membershipId =
      sessionRows.find((row) => row.membership_id)?.membership_id ?? seed.membership_id;
    const email = sessionRows.find((row) => row.email)?.email ?? seed.email;
    const displayName = seed.display_name;
    const matchState: "matched" | "unmatched" | "guest" = membershipId
      ? "matched"
      : !email || (displayName != null && displayName.toLowerCase().startsWith("guest"))
        ? "guest"
        : "unmatched";

    const totalDuration = sessionRows.reduce((sum, row) => sum + (row.duration_seconds ?? 0), 0);
    const joins = sessionRows
      .map((row) => row.join_time)
      .filter((value): value is Date => value != null);
    const leaves = sessionRows
      .map((row) => row.leave_time)
      .filter((value): value is Date => value != null);

    return {
      identity_key: seed.identity_key,
      membership_id: membershipId,
      external_user_id: seed.external_user_id,
      display_name: displayName,
      zoom_display_name: seed.zoom_display_name,
      email,
      membership_status: seed.membership_status,
      match_state: matchState,
      total_duration_seconds: totalDuration,
      session_count: sessionRows.length,
      rejoin_count: Math.max(sessionRows.length - 1, 0),
      first_joined_at:
        joins.length > 0 ? new Date(Math.min(...joins.map((d) => d.getTime()))) : null,
      last_left_at:
        leaves.length > 0 ? new Date(Math.max(...leaves.map((d) => d.getTime()))) : null,
      sessions: sessionRows.map((row) => ({
        id: row.id,
        join_time: row.join_time,
        leave_time: row.leave_time,
        duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
        display_name: row.display_name,
      })),
    };
  },

  async listParticipantAttendanceHistory(
    tx: TenantTx,
    args: {
      meetingId: string;
      membershipId: string | null;
      externalUserId: string | null;
      limit?: number;
    },
  ): Promise<ZoomParticipantHistoryRow[]> {
    if (!args.membershipId && !args.externalUserId) return [];
    const limit = args.limit ?? 8;
    const rows = await tx.$queryRaw<
      Array<{
        meeting_id: string;
        topic: string | null;
        started_at: Date | null;
        duration_seconds: number | null;
        meeting_duration_seconds: number | null;
        is_current: boolean;
      }>
    >`
      select
        zm.id::text as meeting_id,
        zm.topic,
        zm.started_at,
        coalesce(sum(zmp.duration_seconds), 0)::int as duration_seconds,
        zm.duration_seconds as meeting_duration_seconds,
        (zm.id = ${args.meetingId}::uuid) as is_current
      from zoom_meetings zm
      join zoom_meeting_participants zmp
        on zmp.zoom_meeting_id = zm.id
       and zmp.tenant_id = zm.tenant_id
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          (${args.membershipId ?? null}::uuid is not null and zmp.membership_id = ${args.membershipId ?? null}::uuid)
          or (
            ${args.externalUserId ?? null}::text is not null
            and zmp.external_user_id = ${args.externalUserId ?? null}
          )
        )
      group by zm.id, zm.topic, zm.started_at, zm.duration_seconds
      order by zm.started_at desc nulls last
      limit ${limit}
    `;
    return rows.map((row) => ({
      meeting_id: row.meeting_id,
      topic: row.topic,
      started_at: row.started_at,
      duration_seconds: row.duration_seconds == null ? null : row.duration_seconds,
      meeting_duration_seconds:
        row.meeting_duration_seconds == null ? null : row.meeting_duration_seconds,
      is_current: row.is_current,
    }));
  },

  async countOtherUnmatchedMeetingsForIdentity(
    tx: TenantTx,
    args: {
      meetingId: string;
      externalUserId: string | null;
      email: string | null;
      displayName: string | null;
    },
  ): Promise<number> {
    if (!args.externalUserId && !args.email && !args.displayName) return 0;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(distinct zmp.zoom_meeting_id)::bigint as count
      from zoom_meeting_participants zmp
      left join memberships m
        on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zmp.zoom_meeting_id <> ${args.meetingId}::uuid
        and zmp.membership_id is null
        and (
          (
            ${args.externalUserId ?? null}::text is not null
            and zmp.external_user_id = ${args.externalUserId ?? null}
          )
          or (
            ${args.email ?? null}::text is not null
            and lower(coalesce(ap.email, m.invited_email_normalized, '')) = lower(${args.email ?? null})
          )
          or (
            ${args.displayName ?? null}::text is not null
            and lower(coalesce(zmp.display_name, '')) = lower(${args.displayName ?? null})
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async matchParticipantIdentity(
    tx: TenantTx,
    args: {
      meetingId: string;
      identityKey: string;
      membershipId: string;
      applyToOtherMeetings: boolean;
      externalUserId: string | null;
      email: string | null;
      displayName: string | null;
    },
  ): Promise<{ updatedRowCount: number; updatedMeetingCount: number }> {
    const membership = await tx.$queryRaw<Array<{ id: string }>>`
      select id::text as id
      from memberships
      where tenant_id = current_setting('app.tenant_id', true)::uuid
        and id = ${args.membershipId}::uuid
        and status = 'ACTIVE'
      limit 1
    `;
    if (!membership[0]) {
      return { updatedRowCount: 0, updatedMeetingCount: 0 };
    }

    const meetingRows = await tx.$queryRaw<Array<{ id: string }>>`
      with target as (
        select zmp.id
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${args.meetingId}::uuid
          and coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) = ${args.identityKey}
      )
      update zoom_meeting_participants zmp
      set membership_id = ${args.membershipId}::uuid,
          updated_at = now()
      from target
      where zmp.id = target.id
      returning zmp.id::text as id
    `;

    let otherRows: Array<{ id: string; meeting_id: string }> = [];
    if (args.applyToOtherMeetings) {
      otherRows = await tx.$queryRaw<Array<{ id: string; meeting_id: string }>>`
        update zoom_meeting_participants zmp
        set membership_id = ${args.membershipId}::uuid,
            updated_at = now()
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id <> ${args.meetingId}::uuid
          and zmp.membership_id is null
          and (
            (
              ${args.externalUserId ?? null}::text is not null
              and zmp.external_user_id = ${args.externalUserId ?? null}
            )
            or (
              ${args.displayName ?? null}::text is not null
              and lower(coalesce(zmp.display_name, '')) = lower(${args.displayName ?? null})
            )
          )
        returning zmp.id::text as id, zmp.zoom_meeting_id::text as meeting_id
      `;
    }

    const meetingIds = new Set<string>([args.meetingId]);
    for (const row of otherRows) meetingIds.add(row.meeting_id);
    return {
      updatedRowCount: meetingRows.length + otherRows.length,
      updatedMeetingCount: meetingIds.size,
    };
  },

  async unlinkParticipantIdentity(
    tx: TenantTx,
    args: { meetingId: string; identityKey: string },
  ): Promise<{ updatedRowCount: number }> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      with target as (
        select zmp.id
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${args.meetingId}::uuid
          and coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) = ${args.identityKey}
      )
      update zoom_meeting_participants zmp
      set membership_id = null,
          updated_at = now()
      from target
      where zmp.id = target.id
      returning zmp.id::text as id
    `;
    return { updatedRowCount: rows.length };
  },

  async markParticipantIdentityGuest(
    tx: TenantTx,
    args: { meetingId: string; identityKey: string },
  ): Promise<{ updatedRowCount: number }> {
    const rows = await tx.$queryRaw<Array<{ id: string }>>`
      with target as (
        select zmp.id, zmp.display_name
        from zoom_meeting_participants zmp
        left join memberships m
          on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.zoom_meeting_id = ${args.meetingId}::uuid
          and coalesce(
            'm:' || zmp.membership_id::text,
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, mp.display_name, ''))
              || '|' || lower(coalesce(ap.email, m.invited_email_normalized, ''))
          ) = ${args.identityKey}
      )
      update zoom_meeting_participants zmp
      set membership_id = null,
          display_name = case
            when lower(coalesce(target.display_name, '')) like 'guest%' then target.display_name
            when coalesce(target.display_name, '') = '' then 'Guest'
            else 'Guest · ' || target.display_name
          end,
          updated_at = now()
      from target
      where zmp.id = target.id
      returning zmp.id::text as id
    `;
    return { updatedRowCount: rows.length };
  },
};
