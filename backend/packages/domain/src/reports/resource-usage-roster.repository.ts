import type { TenantTx } from "@atlas/db";
import type {
  ResourceUsageDormantQuery,
  ResourceUsageHistoryQuery,
  ResourceUsageInactiveQuery,
} from "./resource-usage-roster.dto";

const USAGE_HISTORY_KEYS = [
  "usage.storage_gb",
  "usage.total_learners",
  "usage.products",
  "usage.questions",
  "usage.test_submits",
  "usage.message_sends",
  "usage.email_validations",
] as const;

const METRIC_LABELS: Record<string, string> = {
  "usage.storage_gb": "Storage",
  "usage.total_learners": "Total learners",
  "usage.products": "Products",
  "usage.questions": "Questions",
  "usage.test_submits": "Tests taken",
  "usage.message_sends": "Message sends",
  "usage.email_validations": "Email validations",
};

const METRIC_UNITS: Record<string, string> = {
  "usage.storage_gb": "GB",
  "usage.total_learners": "count",
  "usage.products": "count",
  "usage.questions": "count",
  "usage.test_submits": "count",
  "usage.message_sends": "count",
  "usage.email_validations": "count",
};

export type ResourceUsageMeters = {
  storageGb: number;
  activeUsers30d: number;
  currentMau: number;
  totalLearners: number;
  testSubmits: number;
  products: number;
  questions: number;
  messageSends: number;
  bandwidthGb: number;
  drmTokens: number;
  videoTranscodingHours: number;
};

export type ResourceUsageOptimizationCounts = {
  dormantContentCount: number;
  inactiveLearnerCount: number;
  dormantStorageGb: number;
};

export type ResourceUsageHistoryRow = {
  metric_key: string;
  metric_label: string;
  period: string;
  value: number;
  unit: string;
  calculated_at: Date | null;
};

export type ResourceUsageDormantRow = {
  course_id: string;
  title: string;
  status: string;
  lesson_count: number;
  storage_gb: number;
  last_learner_activity_at: Date | null;
  created_at: Date | null;
};

export type ResourceUsageInactiveRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  last_active_at: Date | null;
  created_at: Date;
};

function roundGb(value: number): number {
  return Math.round(value * 100) / 100;
}

function historyValue(metricsJson: unknown, rollupKey: string): number {
  if (!metricsJson || typeof metricsJson !== "object") return 0;
  const obj = metricsJson as Record<string, unknown>;
  if (rollupKey === "usage.message_sends" || rollupKey === "usage.email_validations") {
    return Number(obj["count"] ?? 0);
  }
  return Number(obj["value"] ?? 0);
}

export const resourceUsageRosterRepository = {
  async getMeters(tx: TenantTx): Promise<ResourceUsageMeters> {
    const rows = await tx.$queryRaw<
      Array<{
        current_mau: number;
        active_users_30d: number;
        total_learners: number;
        storage_gb: number;
        products: number;
        questions: number;
        test_submits: number;
        message_sends: number;
      }>
    >`
      select
        (
          select count(*)::int
          from memberships m
          where m.status = 'ACTIVE'
            and m.last_active_at >= date_trunc('month', now())
        ) as current_mau,
        (
          select count(distinct membership_id)::int
          from tenant_active_days
          where day >= current_date - 29
        ) as active_users_30d,
        (
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          where m.status = 'ACTIVE'
        ) as total_learners,
        (
          select coalesce(sum(size_bytes), 0)::float8 / 1e9
          from storage_references
          where deleted_at is null
        ) as storage_gb,
        (
          select count(*)::int
          from courses
          where status = 'PUBLISHED' and deleted_at is null
        ) as products,
        (
          select count(*)::int
          from items
          where deleted_at is null
        ) as questions,
        (
          select count(*)::int
          from attempts
          where submitted_at is not null
        ) as test_submits,
        (
          select coalesce((metrics_json->>'count')::int, 0)::int
          from analytics_rollups
          where rollup_key = 'usage.message_sends'
            and period_start = date_trunc('month', now())
          limit 1
        ) as message_sends
    `;

    const row = rows[0];
    return {
      storageGb: roundGb(row?.storage_gb ?? 0),
      activeUsers30d: row?.active_users_30d ?? 0,
      currentMau: row?.current_mau ?? 0,
      totalLearners: row?.total_learners ?? 0,
      testSubmits: row?.test_submits ?? 0,
      products: row?.products ?? 0,
      questions: row?.questions ?? 0,
      messageSends: row?.message_sends ?? 0,
      // Tier-B: not metered yet (CDN/DRM/transcoding pipelines).
      bandwidthGb: 0,
      drmTokens: 0,
      videoTranscodingHours: 0,
    };
  },

  async getOptimizationCounts(tx: TenantTx): Promise<ResourceUsageOptimizationCounts> {
    const rows = await tx.$queryRaw<
      Array<{
        dormant_content_count: number;
        dormant_storage_gb: number;
        inactive_learner_count: number;
      }>
    >`
      with course_activity as (
        select
          c.id as course_id,
          max(lp.last_seen_at) as last_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm.id from course_modules cm
                    where cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l.id from lessons l
                    join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
                    where cm.course_id = c.id and l.tenant_id = c.tenant_id and l.deleted_at is null
                      and cm.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and c.status = 'PUBLISHED'
        group by c.id
      )
      select
        (
          select count(*)::int
          from course_activity
          where last_activity_at is null
             or last_activity_at < now() - interval '30 days'
        ) as dormant_content_count,
        (
          select coalesce(sum(storage_gb), 0)::float8
          from course_activity
          where last_activity_at is null
             or last_activity_at < now() - interval '30 days'
        ) as dormant_storage_gb,
        (
          select count(distinct m.id)::int
          from memberships m
          join user_roles ur on ur.membership_id = m.id
          join roles r on r.id = ur.role_id and r.key = 'learner'
          where m.status = 'ACTIVE'
            and (m.last_active_at is null or m.last_active_at < now() - interval '30 days')
        ) as inactive_learner_count
    `;

    const row = rows[0];
    return {
      dormantContentCount: row?.dormant_content_count ?? 0,
      inactiveLearnerCount: row?.inactive_learner_count ?? 0,
      dormantStorageGb: roundGb(row?.dormant_storage_gb ?? 0),
    };
  },

  async countHistory(tx: TenantTx, query: ResourceUsageHistoryQuery): Promise<number> {
    const metricKey = query.metricKey ?? null;
    const keys = [...USAGE_HISTORY_KEYS];
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*)::bigint as count
      from analytics_rollups ar
      where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ar.rollup_key = any(${keys}::text[])
        and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
        and ar.period_start >= date_trunc('month', now()) - interval '23 months'
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listHistory(
    tx: TenantTx,
    query: ResourceUsageHistoryQuery,
  ): Promise<ResourceUsageHistoryRow[]> {
    const metricKey = query.metricKey ?? null;
    const keys = [...USAGE_HISTORY_KEYS];
    const offset = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<
      Array<{
        rollup_key: string;
        period: string;
        metrics_json: unknown;
        calculated_at: Date | null;
      }>
    >`
      select
        ar.rollup_key,
        to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD') as period,
        ar.metrics_json,
        ar.calculated_at
      from analytics_rollups ar
      where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ar.rollup_key = any(${keys}::text[])
        and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
        and ar.period_start >= date_trunc('month', now()) - interval '23 months'
      order by ar.period_start desc, ar.rollup_key asc
      limit ${query.limit} offset ${offset}
    `;

    return rows.map((row) => ({
      metric_key: row.rollup_key,
      metric_label: METRIC_LABELS[row.rollup_key] ?? row.rollup_key,
      period: row.period,
      value: historyValue(row.metrics_json, row.rollup_key),
      unit: METRIC_UNITS[row.rollup_key] ?? "count",
      calculated_at: row.calculated_at,
    }));
  },

  async countDormant(tx: TenantTx, query: ResourceUsageDormantQuery): Promise<number> {
    const q = query.q ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with course_activity as (
        select
          c.id,
          c.title,
          max(lp.last_seen_at) as last_activity_at
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and c.status = 'PUBLISHED'
          and (
            ${q}::text is null
            or lower(c.title) like '%' || lower(${q}) || '%'
          )
        group by c.id, c.title
      )
      select count(*)::bigint as count
      from course_activity
      where last_activity_at is null
         or last_activity_at < now() - interval '30 days'
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listDormant(
    tx: TenantTx,
    query: ResourceUsageDormantQuery,
  ): Promise<ResourceUsageDormantRow[]> {
    const q = query.q ?? null;
    const offset = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<
      Array<{
        course_id: string;
        title: string;
        status: string;
        lesson_count: number;
        storage_gb: number;
        last_learner_activity_at: Date | null;
        created_at: Date | null;
      }>
    >`
      with course_activity as (
        select
          c.id as course_id,
          c.title,
          c.status::text as status,
          c.created_at,
          count(distinct l.id)::int as lesson_count,
          max(lp.last_seen_at) as last_learner_activity_at,
          coalesce((
            select sum(sr.size_bytes)::float8 / 1e9
            from storage_references sr
            where sr.deleted_at is null
              and (
                (sr.resource_type = 'course' and sr.resource_id = c.id)
                or (
                  sr.resource_type = 'course_module'
                  and sr.resource_id in (
                    select cm2.id from course_modules cm2
                    where cm2.course_id = c.id and cm2.tenant_id = c.tenant_id and cm2.deleted_at is null
                  )
                )
                or (
                  sr.resource_type = 'lesson'
                  and sr.resource_id in (
                    select l2.id from lessons l2
                    join course_modules cm3 on cm3.id = l2.module_id and cm3.tenant_id = l2.tenant_id
                    where cm3.course_id = c.id and l2.tenant_id = c.tenant_id
                      and l2.deleted_at is null and cm3.deleted_at is null
                  )
                )
              )
          ), 0) as storage_gb
        from courses c
        left join course_modules cm
          on cm.course_id = c.id and cm.tenant_id = c.tenant_id and cm.deleted_at is null
        left join lessons l
          on l.module_id = cm.id and l.tenant_id = c.tenant_id and l.deleted_at is null
        left join lesson_progress lp
          on lp.lesson_id = l.id and lp.tenant_id = c.tenant_id
        where c.tenant_id = current_setting('app.tenant_id', true)::uuid
          and c.deleted_at is null
          and c.status = 'PUBLISHED'
          and (
            ${q}::text is null
            or lower(c.title) like '%' || lower(${q}) || '%'
          )
        group by c.id, c.title, c.status, c.created_at
      )
      select
        course_id::text as course_id,
        title,
        status,
        lesson_count,
        storage_gb,
        last_learner_activity_at,
        created_at
      from course_activity
      where last_learner_activity_at is null
         or last_learner_activity_at < now() - interval '30 days'
      order by storage_gb desc, title asc
      limit ${query.limit} offset ${offset}
    `;

    return rows.map((row) => ({
      ...row,
      storage_gb: roundGb(row.storage_gb),
    }));
  },

  async countInactive(tx: TenantTx, query: ResourceUsageInactiveQuery): Promise<number> {
    const q = query.q ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(distinct m.id)::bigint as count
      from memberships m
      join user_roles ur on ur.membership_id = m.id
      join roles r on r.id = ur.role_id and r.key = 'learner'
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.status = 'ACTIVE'
        and (m.last_active_at is null or m.last_active_at < now() - interval '30 days')
        and (
          ${q}::text is null
          or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listInactive(
    tx: TenantTx,
    query: ResourceUsageInactiveQuery,
  ): Promise<ResourceUsageInactiveRow[]> {
    const q = query.q ?? null;
    const offset = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<
      Array<{
        membership_id: string;
        learner_name: string | null;
        email: string | null;
        status: string;
        last_active_at: Date | null;
        created_at: Date;
      }>
    >`
      select
        m.id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        m.status::text as status,
        m.last_active_at,
        m.created_at
      from memberships m
      join user_roles ur on ur.membership_id = m.id
      join roles r on r.id = ur.role_id and r.key = 'learner'
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.tenant_id = current_setting('app.tenant_id', true)::uuid
        and m.status = 'ACTIVE'
        and (m.last_active_at is null or m.last_active_at < now() - interval '30 days')
        and (
          ${q}::text is null
          or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
        )
      order by m.last_active_at asc nulls first, m.created_at asc
      limit ${query.limit} offset ${offset}
    `;
    return rows;
  },
};

export { METRIC_LABELS, METRIC_UNITS, USAGE_HISTORY_KEYS };
