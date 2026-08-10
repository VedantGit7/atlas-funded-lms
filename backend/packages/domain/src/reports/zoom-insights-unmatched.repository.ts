import type { TenantTx } from "@atlas/db";
import type { ZoomMatchingRulesBody, ZoomUnmatchedListQuery } from "./zoom-insights-roster.dto";

export type ZoomUnmatchedIdentityRow = {
  identity_key: string;
  display_name: string | null;
  email: string | null;
  external_user_id: string | null;
  meetings_attended: number;
  total_duration_seconds: number;
  first_seen_at: Date | null;
  last_seen_at: Date | null;
  representative_meeting_id: string;
  representative_participant_id: string;
  other_unmatched_meeting_count: number;
  join_record_count: number;
};

export type ZoomMembershipCandidateRow = {
  membership_id: string;
  display_name: string | null;
  email: string | null;
  email_normalized: string | null;
  name_normalized: string | null;
};

export type ZoomMatchingRulesStored = {
  matchOnExactEmail: boolean;
  matchOnNormalizedDisplayName: boolean;
  matchOnEmailDomainPlusEnrollment: boolean;
  autoMatchHighConfidenceOnImport: boolean;
  guestEmailDomains: string[];
};

export const DEFAULT_ZOOM_MATCHING_RULES: ZoomMatchingRulesStored = {
  matchOnExactEmail: true,
  matchOnNormalizedDisplayName: true,
  matchOnEmailDomainPlusEnrollment: false,
  autoMatchHighConfidenceOnImport: false,
  guestEmailDomains: ["gmail.com", "outlook.com"],
};

function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed;
  }
  return null;
}

function mapUnmatchedRow(row: Record<string, unknown>): ZoomUnmatchedIdentityRow {
  return {
    identity_key: typeof row["identity_key"] === "string" ? row["identity_key"] : "",
    display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    external_user_id: typeof row["external_user_id"] === "string" ? row["external_user_id"] : null,
    meetings_attended: Number(row["meetings_attended"] ?? 0),
    total_duration_seconds: Number(row["total_duration_seconds"] ?? 0),
    first_seen_at: asDate(row["first_seen_at"]),
    last_seen_at: asDate(row["last_seen_at"]),
    representative_meeting_id:
      typeof row["representative_meeting_id"] === "string" ? row["representative_meeting_id"] : "",
    representative_participant_id:
      typeof row["representative_participant_id"] === "string"
        ? row["representative_participant_id"]
        : "",
    other_unmatched_meeting_count: Number(row["other_unmatched_meeting_count"] ?? 0),
    join_record_count: Number(row["join_record_count"] ?? 0),
  };
}

export const zoomInsightsUnmatchedRepository = {
  async listUnmatchedIdentities(
    tx: TenantTx,
    query: ZoomUnmatchedListQuery,
  ): Promise<ZoomUnmatchedIdentityRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with sessions as (
        select
          zmp.id,
          zmp.zoom_meeting_id,
          zmp.external_user_id,
          zmp.display_name,
          nullif(lower(trim(coalesce(zmp.email, ''))), '') as email,
          coalesce(zmp.duration_seconds, 0)::int as duration_seconds,
          zmp.join_time,
          zmp.leave_time,
          coalesce(
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, ''))
              || '|' || coalesce(nullif(lower(trim(coalesce(zmp.email, ''))), ''), '')
          ) as identity_key
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.membership_id is null
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      people as (
        select
          identity_key,
          max(display_name) as display_name,
          max(email) as email,
          max(external_user_id) as external_user_id,
          count(distinct zoom_meeting_id)::int as meetings_attended,
          count(*)::int as join_record_count,
          coalesce(sum(duration_seconds), 0)::int as total_duration_seconds,
          min(join_time) as first_seen_at,
          max(coalesce(leave_time, join_time)) as last_seen_at,
          (array_agg(zoom_meeting_id::text order by join_time desc nulls last))[1]
            as representative_meeting_id,
          (array_agg(id::text order by join_time desc nulls last))[1]
            as representative_participant_id,
          greatest(count(distinct zoom_meeting_id)::int - 1, 0)::int
            as other_unmatched_meeting_count
        from sessions
        group by identity_key
      )
      select *
      from people
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(display_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(email, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(external_user_id, '')) like '%' || lower(${query.q ?? null}) || '%'
      )
      order by meetings_attended desc, last_seen_at desc nulls last, display_name asc nulls last
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapUnmatchedRow);
  },

  async countUnmatchedIdentities(tx: TenantTx, query: ZoomUnmatchedListQuery): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with sessions as (
        select
          coalesce(
            'e:' || nullif(zmp.external_user_id, ''),
            'n:' || lower(coalesce(zmp.display_name, ''))
              || '|' || coalesce(nullif(lower(trim(coalesce(zmp.email, ''))), ''), '')
          ) as identity_key,
          zmp.display_name,
          nullif(lower(trim(coalesce(zmp.email, ''))), '') as email,
          zmp.external_user_id
        from zoom_meeting_participants zmp
        join zoom_meetings zm
          on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
        where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and zmp.membership_id is null
          and (
            ${query.attendedFrom ?? null}::timestamptz is null
            or zm.started_at >= ${query.attendedFrom ?? null}::timestamptz
          )
          and (
            ${query.attendedTo ?? null}::timestamptz is null
            or zm.started_at <= ${query.attendedTo ?? null}::timestamptz
          )
      ),
      people as (
        select
          identity_key,
          max(display_name) as display_name,
          max(email) as email,
          max(external_user_id) as external_user_id
        from sessions
        group by identity_key
      )
      select count(*)::bigint as count
      from people
      where (
        ${query.q ?? null}::text is null
        or lower(coalesce(display_name, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(email, '')) like '%' || lower(${query.q ?? null}) || '%'
        or lower(coalesce(external_user_id, '')) like '%' || lower(${query.q ?? null}) || '%'
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async summarizeUnmatchedScope(
    tx: TenantTx,
    attendedFrom?: string,
    attendedTo?: string,
  ): Promise<{
    meeting_count: number;
    join_record_count: number;
    attendance_not_counted_seconds: number;
  }> {
    const rows = await tx.$queryRaw<
      Array<{
        meeting_count: number;
        join_record_count: number;
        attendance_not_counted_seconds: number;
      }>
    >`
      select
        (
          select count(distinct zmp.zoom_meeting_id)::int
          from zoom_meeting_participants zmp
          join zoom_meetings zm
            on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
          where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
            and zmp.membership_id is null
            and (
              ${attendedFrom ?? null}::timestamptz is null
              or zm.started_at >= ${attendedFrom ?? null}::timestamptz
            )
            and (
              ${attendedTo ?? null}::timestamptz is null
              or zm.started_at <= ${attendedTo ?? null}::timestamptz
            )
        ) as meeting_count,
        (
          select count(*)::int
          from zoom_meeting_participants zmp
          join zoom_meetings zm
            on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
          where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
            and zmp.membership_id is null
            and (
              ${attendedFrom ?? null}::timestamptz is null
              or zm.started_at >= ${attendedFrom ?? null}::timestamptz
            )
            and (
              ${attendedTo ?? null}::timestamptz is null
              or zm.started_at <= ${attendedTo ?? null}::timestamptz
            )
        ) as join_record_count,
        (
          select coalesce(sum(zmp.duration_seconds), 0)::int
          from zoom_meeting_participants zmp
          join zoom_meetings zm
            on zm.id = zmp.zoom_meeting_id and zm.tenant_id = zmp.tenant_id
          where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
            and zmp.membership_id is null
            and (
              ${attendedFrom ?? null}::timestamptz is null
              or zm.started_at >= ${attendedFrom ?? null}::timestamptz
            )
            and (
              ${attendedTo ?? null}::timestamptz is null
              or zm.started_at <= ${attendedTo ?? null}::timestamptz
            )
        ) as attendance_not_counted_seconds
    `;
    const row = rows[0];
    return {
      meeting_count: row?.meeting_count ?? 0,
      join_record_count: row?.join_record_count ?? 0,
      attendance_not_counted_seconds: row?.attendance_not_counted_seconds ?? 0,
    };
  },

  async countReconciledLast30Days(tx: TenantTx): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(distinct
        coalesce(
          'm:' || zmp.membership_id::text,
          'e:' || nullif(zmp.external_user_id, ''),
          'n:' || lower(coalesce(zmp.display_name, ''))
            || '|' || coalesce(nullif(lower(trim(coalesce(zmp.email, ''))), ''), '')
        )
      )::bigint as count
      from zoom_meeting_participants zmp
      where zmp.tenant_id = current_setting('app.tenant_id', true)::uuid
        and zmp.membership_id is not null
        and zmp.updated_at >= now() - interval '30 days'
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async findMembershipCandidates(
    tx: TenantTx,
    args: { emails: string[]; names: string[] },
  ): Promise<ZoomMembershipCandidateRow[]> {
    const emails = args.emails.filter(Boolean);
    const names = args.names.filter(Boolean);
    if (emails.length === 0 && names.length === 0) return [];

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        m.id::text as membership_id,
        mp.display_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        lower(coalesce(ap.email_normalized, m.invited_email_normalized, ap.email, ''))
          as email_normalized,
        lower(regexp_replace(coalesce(mp.display_name, ''), '[^a-z0-9]+', '', 'gi'))
          as name_normalized
      from memberships m
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.status = 'ACTIVE'
        and (
          (
            cardinality(${emails}::text[]) > 0
            and lower(coalesce(ap.email_normalized, m.invited_email_normalized, ap.email, ''))
              = any(${emails}::text[])
          )
          or (
            cardinality(${names}::text[]) > 0
            and lower(regexp_replace(coalesce(mp.display_name, ''), '[^a-z0-9]+', '', 'gi'))
              = any(${names}::text[])
          )
        )
      limit 500
    `;

    return rows.map((row) => ({
      membership_id: typeof row["membership_id"] === "string" ? row["membership_id"] : "",
      display_name: typeof row["display_name"] === "string" ? row["display_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      email_normalized:
        typeof row["email_normalized"] === "string" ? row["email_normalized"] : null,
      name_normalized: typeof row["name_normalized"] === "string" ? row["name_normalized"] : null,
    }));
  },

  async getMatchingRules(tx: TenantTx): Promise<ZoomMatchingRulesStored> {
    const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
      select config_json
      from tenant_config
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const root =
      rows[0]?.config_json &&
      typeof rows[0].config_json === "object" &&
      !Array.isArray(rows[0].config_json)
        ? (rows[0].config_json as Record<string, unknown>)
        : {};
    const zoomInsights =
      root["zoomInsights"] &&
      typeof root["zoomInsights"] === "object" &&
      !Array.isArray(root["zoomInsights"])
        ? (root["zoomInsights"] as Record<string, unknown>)
        : {};
    const rules =
      zoomInsights["matchingRules"] &&
      typeof zoomInsights["matchingRules"] === "object" &&
      !Array.isArray(zoomInsights["matchingRules"])
        ? (zoomInsights["matchingRules"] as Record<string, unknown>)
        : {};

    const domains = Array.isArray(rules["guestEmailDomains"])
      ? rules["guestEmailDomains"]
          .filter((value): value is string => typeof value === "string")
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
      : DEFAULT_ZOOM_MATCHING_RULES.guestEmailDomains;

    return {
      matchOnExactEmail:
        typeof rules["matchOnExactEmail"] === "boolean"
          ? rules["matchOnExactEmail"]
          : DEFAULT_ZOOM_MATCHING_RULES.matchOnExactEmail,
      matchOnNormalizedDisplayName:
        typeof rules["matchOnNormalizedDisplayName"] === "boolean"
          ? rules["matchOnNormalizedDisplayName"]
          : DEFAULT_ZOOM_MATCHING_RULES.matchOnNormalizedDisplayName,
      matchOnEmailDomainPlusEnrollment:
        typeof rules["matchOnEmailDomainPlusEnrollment"] === "boolean"
          ? rules["matchOnEmailDomainPlusEnrollment"]
          : DEFAULT_ZOOM_MATCHING_RULES.matchOnEmailDomainPlusEnrollment,
      autoMatchHighConfidenceOnImport:
        typeof rules["autoMatchHighConfidenceOnImport"] === "boolean"
          ? rules["autoMatchHighConfidenceOnImport"]
          : DEFAULT_ZOOM_MATCHING_RULES.autoMatchHighConfidenceOnImport,
      guestEmailDomains: domains,
    };
  },

  async saveMatchingRules(tx: TenantTx, body: ZoomMatchingRulesBody): Promise<void> {
    const rows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
      select config_json
      from tenant_config
      where tenant_id = current_setting('app.tenant_id', true)::uuid
      limit 1
    `;
    const existing =
      rows[0]?.config_json &&
      typeof rows[0].config_json === "object" &&
      !Array.isArray(rows[0].config_json)
        ? (rows[0].config_json as Record<string, unknown>)
        : {};
    const zoomInsights =
      existing["zoomInsights"] &&
      typeof existing["zoomInsights"] === "object" &&
      !Array.isArray(existing["zoomInsights"])
        ? (existing["zoomInsights"] as Record<string, unknown>)
        : {};

    const nextConfig = {
      ...existing,
      zoomInsights: {
        ...zoomInsights,
        matchingRules: {
          matchOnExactEmail: body.matchOnExactEmail,
          matchOnNormalizedDisplayName: body.matchOnNormalizedDisplayName,
          matchOnEmailDomainPlusEnrollment: body.matchOnEmailDomainPlusEnrollment,
          autoMatchHighConfidenceOnImport: body.autoMatchHighConfidenceOnImport,
          guestEmailDomains: body.guestEmailDomains,
        },
      },
    };

    await tx.$executeRaw`
      insert into tenant_config (
        id,
        tenant_id,
        config_json,
        created_at,
        updated_at
      )
      values (
        gen_random_uuid(),
        current_setting('app.tenant_id', true)::uuid,
        ${JSON.stringify(nextConfig)}::jsonb,
        now(),
        now()
      )
      on conflict (tenant_id) do update set
        config_json = excluded.config_json,
        updated_at = now()
    `;
  },
};
