import type { TenantTx } from "@atlas/db";
import type { ResourceUsageInactiveQuery } from "./resource-usage-roster.dto";
import type {
  ResourceUsageInactiveRow,
  ResourceUsageInactiveSummaryRow,
} from "./resource-usage-roster.repository";

/**
 * Inactive learners: the list, summary, deactivation and recent messages.
 * Part of resourceUsageRosterRepository.
 */
export const resourceUsageRosterInactiveRepository = {
  async countInactive(tx: TenantTx, query: ResourceUsageInactiveQuery): Promise<number> {
    const rows = await this.listInactiveFiltered(tx, query, { countOnly: true });
    return Number(rows[0]?.["count"] ?? 0);
  },

  async listInactive(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
  ): Promise<ResourceUsageInactiveRow[]> {
    const rows = await this.listInactiveFiltered(tx, query, { countOnly: false });
    return rows.map((row) => ({
      membership_id: String(row["membership_id"]),
      learner_name: (row["learner_name"] as string | null) ?? null,
      email: (row["email"] as string | null) ?? null,
      status: String(row["status"]),
      activity_label: row["activity_label"] as "inactive" | "dormant" | "never_active",
      enrolment_count: Number(row["enrolment_count"]),
      last_active_at: (row["last_active_at"] as Date | null) ?? null,
      inactive_days: Number(row["inactive_days"]),
      created_at: row["created_at"] as Date,
      has_paid: Boolean(row["has_paid"]),
    }));
  },

  async listInactiveFiltered(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
    opts: { countOnly: boolean },
  ): Promise<Array<Record<string, unknown>>> {
    const q = query.q ?? null;
    const inactiveDays = query.inactiveDays;
    const view = query.view;
    const activityStatus = query.activityStatus;
    const inactiveForMin = query.inactiveForMin ?? null;
    const enrolmentFilter = query.enrolmentFilter;
    const paidFilter = query.paidFilter;
    const includeInvited = query.includeInvitedNeverSignedIn;
    const excludePaid = query.excludeActivePaidEnrolment;
    const sort = query.sort;
    const offset = (query.page - 1) * query.limit;

    if (opts.countOnly) {
      return tx.$queryRaw<Array<Record<string, unknown>>>`
        with learner_base as (
          select
            m.id as membership_id,
            m.status::text as status,
            m.last_active_at,
            m.created_at,
            coalesce((
              select count(*)::int from enrollments e
              where e.tenant_id = m.tenant_id and e.membership_id = m.id
            ), 0) as enrolment_count,
            exists (
              select 1 from payment_orders po
              where po.tenant_id = m.tenant_id
                and po.membership_id = m.id
                and po.status = 'paid'
            ) or exists (
              select 1 from enrollments e
              where e.tenant_id = m.tenant_id
                and e.membership_id = m.id
                and e.enrolled_type = 'paid'
                and e.status = 'active'
            ) as has_paid,
            exists (
              select 1 from enrollments e
              where e.tenant_id = m.tenant_id
                and e.membership_id = m.id
                and e.enrolled_type = 'paid'
                and e.status = 'active'
            ) as has_active_paid_enrolment
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          left join member_profiles mp
            on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
          left join auth_principals ap on ap.id = m.auth_principal_id
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and (
              m.status = 'ACTIVE'
              or (
                ${includeInvited}::boolean
                and m.status = 'INVITED'
                and m.last_active_at is null
              )
            )
            and (m.last_active_at is null or m.last_active_at < now() - make_interval(days => ${inactiveDays}::int))
            and (
              ${q}::text is null
              or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
              or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
            )
        ),
        inactive as (
          select
            *,
            greatest(
              0,
              floor(
                extract(
                  epoch from (
                    now() - coalesce(last_active_at, created_at, now())
                  )
                ) / 86400
              )
            )::int as inactive_days,
            case
              when last_active_at is null then 'never_active'
              when greatest(
                0,
                floor(
                  extract(
                    epoch from (now() - coalesce(last_active_at, created_at, now()))
                  ) / 86400
                )
              ) >= 365 then 'dormant'
              else 'inactive'
            end as activity_label
          from learner_base
          where (
            not ${excludePaid}::boolean
            or not has_active_paid_enrolment
          )
        )
        select count(*)::bigint as count
        from inactive
        where (
            ${view}::text = 'all'
            or (${view}::text = 'never_active' and activity_label = 'never_active')
            or (${view}::text = 'paid_holding' and has_paid)
          )
          and (
            ${activityStatus}::text = 'any'
            or (${activityStatus}::text = 'inactive' and activity_label = 'inactive')
            or (${activityStatus}::text = 'dormant' and activity_label = 'dormant')
            or (${activityStatus}::text = 'never_active' and activity_label = 'never_active')
          )
          and (${inactiveForMin}::int is null or inactive_days >= ${inactiveForMin}::int)
          and (
            ${enrolmentFilter}::text = 'any'
            or (${enrolmentFilter}::text = 'has_enrolments' and enrolment_count > 0)
            or (${enrolmentFilter}::text = 'zero_enrolments' and enrolment_count = 0)
          )
          and (
            ${paidFilter}::text = 'any'
            or (${paidFilter}::text = 'has_paid' and has_paid)
            or (${paidFilter}::text = 'never_paid' and not has_paid)
          )
      `;
    }

    return tx.$queryRaw<Array<Record<string, unknown>>>`
      with learner_base as (
        select
          m.id as membership_id,
          m.status::text as status,
          m.last_active_at,
          m.created_at,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = m.tenant_id and e.membership_id = m.id
          ), 0) as enrolment_count,
          exists (
            select 1 from payment_orders po
            where po.tenant_id = m.tenant_id
              and po.membership_id = m.id
              and po.status = 'paid'
          ) or exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_paid,
          exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_active_paid_enrolment
        from memberships m
        join user_roles ur on ur.membership_id = m.id
        join roles r on r.id = ur.role_id and r.key = 'learner'
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            m.status = 'ACTIVE'
            or (
              ${includeInvited}::boolean
              and m.status = 'INVITED'
              and m.last_active_at is null
            )
          )
          and (m.last_active_at is null or m.last_active_at < now() - make_interval(days => ${inactiveDays}::int))
          and (
            ${q}::text is null
            or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
            or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
          )
      ),
      inactive as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (
                  now() - coalesce(last_active_at, created_at, now())
                )
              ) / 86400
            )
          )::int as inactive_days,
          case
            when last_active_at is null then 'never_active'
            when greatest(
              0,
              floor(
                extract(
                  epoch from (now() - coalesce(last_active_at, created_at, now()))
                ) / 86400
              )
            ) >= 365 then 'dormant'
            else 'inactive'
          end as activity_label
        from learner_base
        where (
          not ${excludePaid}::boolean
          or not has_active_paid_enrolment
        )
      )
      select
        membership_id::text as membership_id,
        learner_name,
        email,
        status,
        activity_label,
        enrolment_count,
        last_active_at,
        inactive_days,
        created_at,
        has_paid
      from inactive
      where (
          ${view}::text = 'all'
          or (${view}::text = 'never_active' and activity_label = 'never_active')
          or (${view}::text = 'paid_holding' and has_paid)
        )
        and (
          ${activityStatus}::text = 'any'
          or (${activityStatus}::text = 'inactive' and activity_label = 'inactive')
          or (${activityStatus}::text = 'dormant' and activity_label = 'dormant')
          or (${activityStatus}::text = 'never_active' and activity_label = 'never_active')
        )
        and (${inactiveForMin}::int is null or inactive_days >= ${inactiveForMin}::int)
        and (
          ${enrolmentFilter}::text = 'any'
          or (${enrolmentFilter}::text = 'has_enrolments' and enrolment_count > 0)
          or (${enrolmentFilter}::text = 'zero_enrolments' and enrolment_count = 0)
        )
        and (
          ${paidFilter}::text = 'any'
          or (${paidFilter}::text = 'has_paid' and has_paid)
          or (${paidFilter}::text = 'never_paid' and not has_paid)
        )
      order by
        case when ${sort}::text = 'inactive_desc' then inactive_days end desc nulls last,
        case when ${sort}::text = 'inactive_asc' then inactive_days end asc nulls last,
        case when ${sort}::text = 'activity_asc' then last_active_at end asc nulls first,
        case when ${sort}::text = 'name_asc' then learner_name end asc nulls last,
        case when ${sort}::text = 'enrolments_desc' then enrolment_count end desc nulls last,
        case when ${sort}::text = 'signed_up_asc' then created_at end asc nulls last,
        inactive_days desc,
        learner_name asc
      limit ${query.limit} offset ${offset}
    `;
  },

  async getInactiveSummary(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
  ): Promise<ResourceUsageInactiveSummaryRow> {
    const inactiveDays = query.inactiveDays;
    const includeInvited = query.includeInvitedNeverSignedIn;
    const excludePaid = query.excludeActivePaidEnrolment;

    const rows = await tx.$queryRaw<Array<ResourceUsageInactiveSummaryRow>>`
      with learner_base as (
        select
          m.id as membership_id,
          m.last_active_at,
          m.created_at,
          coalesce((
            select count(*)::int from enrollments e
            where e.tenant_id = m.tenant_id and e.membership_id = m.id
          ), 0) as enrolment_count,
          exists (
            select 1 from payment_orders po
            where po.tenant_id = m.tenant_id
              and po.membership_id = m.id
              and po.status = 'paid'
          ) or exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_paid,
          exists (
            select 1 from enrollments e
            where e.tenant_id = m.tenant_id
              and e.membership_id = m.id
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) as has_active_paid_enrolment
        from memberships m
        join user_roles ur on ur.membership_id = m.id
        join roles r on r.id = ur.role_id and r.key = 'learner'
        where m.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            m.status = 'ACTIVE'
            or (
              ${includeInvited}::boolean
              and m.status = 'INVITED'
              and m.last_active_at is null
            )
          )
      ),
      inactive as (
        select
          *,
          greatest(
            0,
            floor(
              extract(
                epoch from (now() - coalesce(last_active_at, created_at, now()))
              ) / 86400
            )
          )::int as inactive_days
        from learner_base
        where (last_active_at is null or last_active_at < now() - make_interval(days => ${inactiveDays}::int))
          and (
            not ${excludePaid}::boolean
            or not has_active_paid_enrolment
          )
      )
      select
        (select count(*)::int from inactive) as inactive_learner_count,
        (
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          where m.tenant_id = current_setting('app.tenant_id', true)::uuid
            and m.status in ('ACTIVE', 'INVITED')
        ) as total_learner_count,
        (select count(*)::int from inactive where last_active_at is null) as never_active_count,
        (select count(*)::int from inactive where inactive_days >= 365) as inactive_over_year_count,
        (select coalesce(sum(enrolment_count), 0)::int from inactive) as enrolments_held,
        (select count(*)::int from inactive where has_paid) as paid_among_them,
        (select count(*)::int from inactive) as view_all,
        (select count(*)::int from inactive where last_active_at is null) as view_never_active,
        (select count(*)::int from inactive where has_paid) as view_paid_holding
    `;

    return (
      rows[0] ?? {
        inactive_learner_count: 0,
        total_learner_count: 0,
        never_active_count: 0,
        inactive_over_year_count: 0,
        enrolments_held: 0,
        paid_among_them: 0,
        view_all: 0,
        view_never_active: 0,
        view_paid_holding: 0,
      }
    );
  },

  async deactivateInactiveLearners(
    tx: TenantTx,
    args: {
      membershipIds: string[];
      excludePaid: boolean;
    },
  ): Promise<{
    processedIds: string[];
    skippedIds: string[];
    excludedPaidIds: string[];
  }> {
    const processedIds: string[] = [];
    const skippedIds: string[] = [];
    const excludedPaidIds: string[] = [];

    for (const membershipId of args.membershipIds) {
      if (args.excludePaid) {
        const paidRows = await tx.$queryRaw<Array<{ has_paid: boolean }>>`
          select exists (
            select 1 from enrollments e
            where e.tenant_id = current_setting('app.tenant_id', true)::uuid
              and e.membership_id = ${membershipId}::uuid
              and e.enrolled_type = 'paid'
              and e.status = 'active'
          ) or exists (
            select 1 from payment_orders po
            where po.tenant_id = current_setting('app.tenant_id', true)::uuid
              and po.membership_id = ${membershipId}::uuid
              and po.status = 'paid'
          ) as has_paid
        `;
        if (paidRows[0]?.has_paid) {
          excludedPaidIds.push(membershipId);
          continue;
        }
      }

      const updated = await tx.$queryRaw<Array<{ id: string }>>`
        update memberships
        set
          status = 'SUSPENDED',
          suspended_at = now(),
          updated_at = now()
        where tenant_id = current_setting('app.tenant_id', true)::uuid
          and id = ${membershipId}::uuid
          and status in ('ACTIVE', 'INVITED')
        returning id::text
      `;

      if (updated[0]) {
        processedIds.push(membershipId);
      } else {
        skippedIds.push(membershipId);
      }
    }

    return { processedIds, skippedIds, excludedPaidIds };
  },

  async listRecentlyMessagedMembershipIds(
    tx: TenantTx,
    membershipIds: string[],
    withinDays: number,
  ): Promise<string[]> {
    if (membershipIds.length === 0 || withinDays <= 0) return [];
    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct nd.membership_id::text as membership_id
      from notification_dispatches nd
      where nd.tenant_id = current_setting('app.tenant_id', true)::uuid
        and nd.membership_id = any(${membershipIds}::uuid[])
        and nd.template_key like 'reports.resource-usage.inactive%'
        and nd.created_at >= now() - make_interval(days => ${withinDays}::int)
    `;
    return rows.map((row) => row.membership_id);
  },
};
