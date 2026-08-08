import type { TenantTx } from "@atlas/db";
import type { EnrollmentRosterQuery } from "./enrollments-roster.dto";

export type EnrollmentRosterRow = {
  id: string;
  course_id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  product_title: string;
  enrolled_type: string;
  status: string;
  enrolled_at: Date;
  expires_at: Date | null;
};

export type EnrollmentRosterFilter = {
  enrolledFrom?: string;
  enrolledTo?: string;
  email?: string;
  enrolledType?: string;
  status?: string;
  courseId?: string;
};

function mapRow(row: Record<string, unknown>): EnrollmentRosterRow {
  return {
    id: String(row["id"]),
    course_id: String(row["course_id"]),
    membership_id: String(row["membership_id"]),
    learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
    email: typeof row["email"] === "string" ? row["email"] : null,
    product_title: String(row["product_title"] ?? ""),
    enrolled_type: String(row["enrolled_type"] ?? "free"),
    status: String(row["status"]),
    enrolled_at: row["enrolled_at"] as Date,
    expires_at: row["expires_at"] instanceof Date ? row["expires_at"] : null,
  };
}

export const enrollmentsRosterRepository = {
  async countRoster(tx: TenantTx, filter: EnrollmentRosterFilter): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from enrollments e
      join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.courseId ?? null}::uuid is null or e.course_id = ${filter.courseId ?? null}::uuid)
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
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

  async listRoster(tx: TenantTx, query: EnrollmentRosterQuery): Promise<EnrollmentRosterRow[]> {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        e.id::text as id,
        e.course_id::text as course_id,
        e.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        c.title as product_title,
        e.enrolled_type,
        e.status,
        e.enrolled_at,
        e.expires_at
      from enrollments e
      join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${query.courseId ?? null}::uuid is null or e.course_id = ${query.courseId ?? null}::uuid)
        and (${query.status ?? null}::text is null or e.status = ${query.status ?? null})
        and (${query.enrolledType ?? null}::text is null or e.enrolled_type = ${query.enrolledType ?? null})
        and (
          ${query.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.email ?? null}) || '%'
        )
        and (
          ${query.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${query.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${query.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${query.enrolledTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'asc' then e.expires_at end asc nulls last,
        case when ${query.sortBy} = 'expires_at' and ${query.sortDir} = 'desc' then e.expires_at end desc nulls last,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'asc' then e.enrolled_at end asc,
        case when ${query.sortBy} = 'enrolled_at' and ${query.sortDir} = 'desc' then e.enrolled_at end desc,
        e.id desc
      limit ${query.limit}
      offset ${skip}
    `;
    return rows.map(mapRow);
  },

  async listMembershipIds(tx: TenantTx, filter: EnrollmentRosterFilter): Promise<string[]> {
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct e.membership_id::text as membership_id
      from enrollments e
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.courseId ?? null}::uuid is null or e.course_id = ${filter.courseId ?? null}::uuid)
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
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

  async getOverviewSummary(
    tx: TenantTx,
    filter: EnrollmentRosterFilter,
  ): Promise<{
    totalCount: number;
    activeCount: number;
    expiringSoonCount: number;
  }> {
    const rows = await tx.$queryRaw<
      Array<{ total_count: bigint; active_count: bigint; expiring_soon_count: bigint }>
    >`
      select
        count(*)::bigint as total_count,
        count(*) filter (where e.status = 'active')::bigint as active_count,
        count(*) filter (
          where e.status = 'active'
            and e.expires_at is not null
            and e.expires_at > now()
            and e.expires_at <= now() + interval '7 days'
        )::bigint as expiring_soon_count
      from enrollments e
      join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.courseId ?? null}::uuid is null or e.course_id = ${filter.courseId ?? null}::uuid)
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
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
    return {
      totalCount: Number(rows[0]?.total_count ?? 0),
      activeCount: Number(rows[0]?.active_count ?? 0),
      expiringSoonCount: Number(rows[0]?.expiring_soon_count ?? 0),
    };
  },

  async getOverviewByType(
    tx: TenantTx,
    filter: EnrollmentRosterFilter,
  ): Promise<Array<{ type: string; count: number }>> {
    const rows = await tx.$queryRaw<Array<{ enrolled_type: string; count: bigint }>>`
      select
        e.enrolled_type,
        count(*)::bigint as count
      from enrollments e
      join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.courseId ?? null}::uuid is null or e.course_id = ${filter.courseId ?? null}::uuid)
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and (
          ${filter.enrolledFrom ?? null}::timestamptz is null
          or e.enrolled_at >= ${filter.enrolledFrom ?? null}::timestamptz
        )
        and (
          ${filter.enrolledTo ?? null}::timestamptz is null
          or e.enrolled_at <= ${filter.enrolledTo ?? null}::timestamptz
        )
      group by e.enrolled_type
      order by count desc, e.enrolled_type asc
    `;
    return rows.map((row) => ({
      type: row.enrolled_type,
      count: Number(row.count),
    }));
  },

  async getOverviewTrend(
    tx: TenantTx,
    filter: EnrollmentRosterFilter,
    windowFromIso: string,
    windowToIso: string,
  ): Promise<
    Array<{
      date: string;
      total: number;
      paid: number;
      free: number;
      trial: number;
      offline: number;
    }>
  > {
    const rows = await tx.$queryRaw<
      Array<{
        day: string;
        total: bigint;
        paid: bigint;
        free: bigint;
        trial: bigint;
        offline: bigint;
      }>
    >`
      with days as (
        select generate_series(
          date_trunc('day', ${windowFromIso}::timestamptz),
          date_trunc('day', ${windowToIso}::timestamptz),
          interval '1 day'
        ) as day
      )
      select
        to_char(d.day, 'YYYY-MM-DD') as day,
        count(e.id)::bigint as total,
        count(e.id) filter (where e.enrolled_type = 'paid')::bigint as paid,
        count(e.id) filter (where e.enrolled_type = 'free')::bigint as free,
        count(e.id) filter (where e.enrolled_type = 'trial')::bigint as trial,
        count(e.id) filter (
          where e.enrolled_type in ('offline', 'manual', 'complimentary')
        )::bigint as offline
      from days d
      left join enrollments e
        on e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and date_trunc('day', e.enrolled_at) = d.day
        and (${filter.courseId ?? null}::uuid is null or e.course_id = ${filter.courseId ?? null}::uuid)
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
      left join memberships m
        on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where (
        ${filter.email ?? null}::text is null
        or e.id is null
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${filter.email ?? null}) || '%'
      )
      group by d.day
      order by d.day asc
    `;
    return rows.map((row) => ({
      date: row.day,
      total: Number(row.total),
      paid: Number(row.paid),
      free: Number(row.free),
      trial: Number(row.trial),
      offline: Number(row.offline),
    }));
  },

  async countInWindow(
    tx: TenantTx,
    filter: EnrollmentRosterFilter,
    windowFromIso: string,
    windowToIso: string,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from enrollments e
      join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${filter.courseId ?? null}::uuid is null or e.course_id = ${filter.courseId ?? null}::uuid)
        and (${filter.status ?? null}::text is null or e.status = ${filter.status ?? null})
        and (${filter.enrolledType ?? null}::text is null or e.enrolled_type = ${filter.enrolledType ?? null})
        and (
          ${filter.email ?? null}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.email ?? null}) || '%'
        )
        and e.enrolled_at >= ${windowFromIso}::timestamptz
        and e.enrolled_at <= ${windowToIso}::timestamptz
    `;
    return Number(rows[0]?.count ?? 0);
  },
};
