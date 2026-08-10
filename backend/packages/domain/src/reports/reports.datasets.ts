import type { TenantTx } from "@atlas/db";
import { REPORT_ROW_CAP } from "./reports.contract";
import { reportRowCapExceeded } from "./reports.errors";
import type { ReportDatasetResult } from "./reports.types";

type DatasetParams = Record<string, unknown>;

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function capRows(result: ReportDatasetResult): ReportDatasetResult {
  if (result.rows.length > REPORT_ROW_CAP) {
    throw reportRowCapExceeded();
  }
  return result;
}

function mapRows(rows: Array<Record<string, unknown>>, columns: string[]): ReportDatasetResult {
  return capRows({
    columns,
    rows: rows.map((row) => {
      const mapped: Record<string, unknown> = {};
      for (const column of columns) {
        mapped[column] = row[column] ?? null;
      }
      return mapped;
    }),
  });
}

async function queryEnrollments(tx: TenantTx, params: DatasetParams): Promise<ReportDatasetResult> {
  const courseId = asString(params["courseId"]);
  const status = asString(params["status"]);
  const email = asString(params["email"]);
  const enrolledType = asString(params["enrolledType"]);
  const startDate = asString(params["startDate"]);
  const endDate = asString(params["endDate"]);
  const sortBy = asString(params["sortBy"]) === "expires_at" ? "expires_at" : "enrolled_at";
  const sortDir = asString(params["sortDir"]) === "asc" ? "asc" : "desc";

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      e.id::text as id,
      e.course_id::text as course_id,
      e.membership_id::text as membership_id,
      e.status,
      e.enrolled_type,
      e.enrolled_at,
      e.expires_at,
      c.title as course_title,
      c.title as product_title,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email
    from enrollments e
    join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
    join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where e.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${courseId}::uuid is null or e.course_id = ${courseId}::uuid)
      and (${status}::text is null or e.status = ${status})
      and (${enrolledType}::text is null or e.enrolled_type = ${enrolledType})
      and (
        ${email}::text is null
        or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${email}) || '%'
      )
      and (${startDate}::timestamptz is null or e.enrolled_at >= ${startDate}::timestamptz)
      and (${endDate}::timestamptz is null or e.enrolled_at <= ${endDate}::timestamptz)
    order by
      case when ${sortBy} = 'expires_at' and ${sortDir} = 'asc' then e.expires_at end asc nulls last,
      case when ${sortBy} = 'expires_at' and ${sortDir} = 'desc' then e.expires_at end desc nulls last,
      case when ${sortBy} = 'enrolled_at' and ${sortDir} = 'asc' then e.enrolled_at end asc,
      case when ${sortBy} = 'enrolled_at' and ${sortDir} = 'desc' then e.enrolled_at end desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "id",
    "course_id",
    "course_title",
    "product_title",
    "membership_id",
    "learner_name",
    "email",
    "status",
    "enrolled_type",
    "enrolled_at",
    "expires_at",
  ]);
}

async function queryProgressScore(
  tx: TenantTx,
  params: DatasetParams,
): Promise<ReportDatasetResult> {
  const reportTab = asString(params["reportTab"]) ?? "progress";
  const courseId = asString(params["courseId"]);
  const productId = asString(params["productId"]) ?? courseId;
  const productType = asString(params["productType"]) ?? "course";
  const assessmentId = asString(params["assessmentId"]);
  const learnerName = asString(params["learnerName"]);

  if (reportTab === "scores" || reportTab === "attempts" || reportTab === "item_analysis") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        at.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        a.id::text as assessment_id,
        a.title as assessment_title,
        at.id::text as attempt_id,
        at.status::text as attempt_status,
        at.score_pct as score,
        at.submitted_at,
        at.started_at
      from attempts at
      join assessments a on a.id = at.assessment_id and a.tenant_id = at.tenant_id
      join memberships m on m.id = at.membership_id and m.tenant_id = at.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${assessmentId}::uuid is null or at.assessment_id = ${assessmentId}::uuid)
        and (
          ${learnerName}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerName}) || '%'
        )
      order by coalesce(at.submitted_at, at.started_at) desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "membership_id",
      "learner_name",
      "email",
      "assessment_id",
      "assessment_title",
      "attempt_id",
      "attempt_status",
      "score",
      "submitted_at",
      "started_at",
    ]);
  }

  if (productType === "test_series" && productId) {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        e.id::text as enrollment_id,
        e.membership_id::text as membership_id,
        e.test_series_id::text as product_id,
        ts.title as product_title,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        e.enrolled_type,
        e.status,
        e.enrolled_at,
        e.expires_at,
        (
          select count(*)::int
          from test_series_item_progress p
          join test_series_items i on i.id = p.test_series_item_id and i.tenant_id = p.tenant_id
          where i.test_series_id = e.test_series_id
            and p.membership_id = e.membership_id
            and p.tenant_id = e.tenant_id
            and p.status = 'completed'
        ) as completed_lessons,
        (
          select count(*)::int
          from test_series_items i
          where i.test_series_id = e.test_series_id
            and i.tenant_id = e.tenant_id
        ) as total_lessons
      from test_series_enrollments e
      join test_series ts on ts.id = e.test_series_id and ts.tenant_id = e.tenant_id and ts.deleted_at is null
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.test_series_id = ${productId}::uuid
        and (
          ${learnerName}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerName}) || '%'
        )
      order by e.enrolled_at desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "enrollment_id",
      "membership_id",
      "product_id",
      "product_title",
      "learner_name",
      "email",
      "enrolled_type",
      "status",
      "enrolled_at",
      "expires_at",
      "completed_lessons",
      "total_lessons",
    ]);
  }

  if (productType === "bundle" && productId) {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        e.id::text as enrollment_id,
        e.membership_id::text as membership_id,
        e.bundle_id::text as product_id,
        b.title as product_title,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        e.enrolled_type,
        e.status,
        e.enrolled_at,
        e.expires_at,
        (
          select count(*)::int from bundle_items bi where bi.bundle_id = e.bundle_id and bi.tenant_id = e.tenant_id
        ) as total_lessons,
        0 as completed_lessons
      from bundle_enrollments e
      join bundles b on b.id = e.bundle_id and b.tenant_id = e.tenant_id and b.deleted_at is null
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.bundle_id = ${productId}::uuid
        and (
          ${learnerName}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerName}) || '%'
        )
      order by e.enrolled_at desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "enrollment_id",
      "membership_id",
      "product_id",
      "product_title",
      "learner_name",
      "email",
      "enrolled_type",
      "status",
      "enrolled_at",
      "expires_at",
      "completed_lessons",
      "total_lessons",
    ]);
  }

  if (productType === "subscription" && productId) {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        e.id::text as enrollment_id,
        e.membership_id::text as membership_id,
        e.plan_id::text as product_id,
        p.title as product_title,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        e.enrolled_type,
        e.status,
        e.enrolled_at,
        e.expires_at,
        (
          select count(*)::int from learner_subscription_plan_items i
          where i.plan_id = e.plan_id and i.tenant_id = e.tenant_id
        ) as total_lessons,
        0 as completed_lessons
      from learner_subscription_enrollments e
      join learner_subscription_plans p on p.id = e.plan_id and p.tenant_id = e.tenant_id and p.deleted_at is null
      join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where e.tenant_id = current_setting('app.tenant_id', true)::uuid
        and e.plan_id = ${productId}::uuid
        and (
          ${learnerName}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerName}) || '%'
        )
      order by e.enrolled_at desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "enrollment_id",
      "membership_id",
      "product_id",
      "product_title",
      "learner_name",
      "email",
      "enrolled_type",
      "status",
      "enrolled_at",
      "expires_at",
      "completed_lessons",
      "total_lessons",
    ]);
  }

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    with course_lessons as (
      select l.id, cm.course_id
      from lessons l
      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id
      where l.tenant_id = current_setting('app.tenant_id', true)::uuid
        and l.deleted_at is null
        and cm.deleted_at is null
        and (${productId}::uuid is null or cm.course_id = ${productId}::uuid)
    )
    select
      e.id::text as enrollment_id,
      e.membership_id::text as membership_id,
      e.course_id::text as course_id,
      c.title as course_title,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      e.enrolled_type,
      e.status,
      e.enrolled_at,
      e.expires_at,
      (
        select count(*)::int
        from lesson_progress lp
        join course_lessons cl on cl.id = lp.lesson_id and cl.course_id = e.course_id
        where lp.membership_id = e.membership_id
          and lp.tenant_id = e.tenant_id
          and lp.status = 'completed'
      ) as completed_lessons,
      (
        select count(*)::int from course_lessons cl where cl.course_id = e.course_id
      ) as total_lessons
    from enrollments e
    join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id
    join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where e.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${productId}::uuid is null or e.course_id = ${productId}::uuid)
      and (
        ${learnerName}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${learnerName}) || '%'
      )
    order by e.enrolled_at desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "enrollment_id",
    "membership_id",
    "course_id",
    "course_title",
    "learner_name",
    "email",
    "enrolled_type",
    "status",
    "enrolled_at",
    "expires_at",
    "completed_lessons",
    "total_lessons",
  ]);
}

async function queryResourceUsage(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const dataset = asString(params["dataset"]);
  const reportTab =
    asString(params["reportTab"]) ??
    (dataset === "metric_history"
      ? "history"
      : dataset === "storage_breakdown"
        ? "storage"
        : dataset === "inactive_learners"
          ? "inactive"
          : dataset === "dormant_content"
            ? "dormant"
            : dataset === "meter_snapshot"
              ? "meter_snapshot"
              : "history");
  const metricKey = asString(params["metricKey"]);
  const q = asString(params["q"]);

  if (reportTab === "meter_snapshot") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select distinct on (ar.rollup_key)
        ar.rollup_key as metric_key,
        case ar.rollup_key
          when 'usage.storage_gb' then 'Storage'
          when 'usage.total_learners' then 'Total learners'
          when 'usage.products' then 'Products'
          when 'usage.questions' then 'Questions'
          when 'usage.test_submits' then 'Tests taken'
          when 'usage.message_sends' then 'Message sends'
          when 'usage.email_validations' then 'Email validations'
          else ar.rollup_key
        end as metric_label,
        coalesce(
          (ar.metrics_json->>'value')::float8,
          (ar.metrics_json->>'count')::float8,
          0
        ) as value,
        case
          when ar.rollup_key = 'usage.storage_gb' then 'GB'
          else 'count'
        end as unit,
        ar.calculated_at
      from analytics_rollups ar
      where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ar.rollup_key like 'usage.%'
        and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
      order by ar.rollup_key asc, ar.calculated_at desc
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, ["metric_key", "metric_label", "value", "unit", "calculated_at"]);
  }

  if (reportTab === "storage") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce(sr.resource_type, 'unknown') as resource_type,
        count(*)::int as object_count,
        round((coalesce(sum(sr.size_bytes), 0)::float8 / 1e9)::numeric, 3)::float8 as storage_gb
      from storage_references sr
      where sr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and sr.deleted_at is null
        and (
          ${q}::text is null
          or lower(coalesce(sr.resource_type, '')) like '%' || lower(${q}) || '%'
        )
      group by coalesce(sr.resource_type, 'unknown')
      order by storage_gb desc, resource_type asc
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, ["resource_type", "object_count", "storage_gb"]);
  }

  if (reportTab === "dormant") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
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
        round(storage_gb::numeric, 2)::float8 as storage_gb,
        last_learner_activity_at,
        created_at
      from course_activity
      where last_learner_activity_at is null
         or last_learner_activity_at < now() - interval '30 days'
      order by storage_gb desc, title asc
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, [
      "course_id",
      "title",
      "status",
      "lesson_count",
      "storage_gb",
      "last_learner_activity_at",
      "created_at",
    ]);
  }

  if (reportTab === "inactive") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
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
        and (m.last_active_at is null or m.last_active_at < now() - interval '90 days')
        and (
          ${q}::text is null
          or lower(coalesce(mp.display_name, '')) like '%' || lower(${q}) || '%'
          or lower(coalesce(ap.email, m.invited_email_normalized, '')) like '%' || lower(${q}) || '%'
        )
      order by m.last_active_at asc nulls first, m.created_at asc
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, [
      "membership_id",
      "learner_name",
      "email",
      "status",
      "last_active_at",
      "created_at",
    ]);
  }

  const usageKeys = [
    "usage.storage_gb",
    "usage.total_learners",
    "usage.products",
    "usage.questions",
    "usage.test_submits",
    "usage.message_sends",
    "usage.email_validations",
  ];

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      ar.rollup_key as metric_key,
      case ar.rollup_key
        when 'usage.storage_gb' then 'Storage'
        when 'usage.total_learners' then 'Total learners'
        when 'usage.products' then 'Products'
        when 'usage.questions' then 'Questions'
        when 'usage.test_submits' then 'Tests taken'
        when 'usage.message_sends' then 'Message sends'
        when 'usage.email_validations' then 'Email validations'
        else ar.rollup_key
      end as metric_label,
      to_char(date_trunc('month', ar.period_start), 'YYYY-MM-DD') as period,
      coalesce(
        (ar.metrics_json->>'value')::float8,
        (ar.metrics_json->>'count')::float8,
        0
      ) as value,
      case
        when ar.rollup_key = 'usage.storage_gb' then 'GB'
        else 'count'
      end as unit,
      ar.calculated_at
    from analytics_rollups ar
    where ar.tenant_id = current_setting('app.tenant_id', true)::uuid
      and ar.rollup_key = any(${usageKeys}::text[])
      and (${metricKey}::text is null or ar.rollup_key = ${metricKey})
      and ar.period_start >= date_trunc('month', now()) - interval '23 months'
    order by ar.period_start desc, ar.rollup_key asc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, ["metric_key", "metric_label", "period", "value", "unit", "calculated_at"]);
}

async function queryExports(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const status = asString(params["status"]);
  const sourceType = asString(params["sourceType"]);
  const definitionKey = asString(params["definitionKey"]);
  const createdFrom = asString(params["createdFrom"]);
  const createdTo = asString(params["createdTo"]);
  const q = asString(params["q"]);

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    with history as (
      select
        'report_run'::text as source_type,
        rr.id,
        rd.key as definition_key,
        rd.title as definition_title,
        rr.status::text as status,
        rr.format::text as format,
        rr.row_count,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as requested_by_name,
        rr.created_at,
        rr.completed_at,
        rr.expires_at,
        (rr.r2_object_key is not null) as has_file
      from report_runs rr
      join report_definitions rd on rd.id = rr.report_definition_id
      left join memberships m on m.id = rr.requested_by_membership_id and m.tenant_id = rr.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where rr.tenant_id = current_setting('app.tenant_id', true)::uuid
      union all
      select
        'export_job'::text as source_type,
        ej.id,
        null::text as definition_key,
        'Data rights export'::text as definition_title,
        ej.status::text as status,
        null::text as format,
        null::int as row_count,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as requested_by_name,
        ej.created_at,
        null::timestamptz as completed_at,
        ej.expires_at,
        (ej.r2_object_key is not null) as has_file
      from export_jobs ej
      left join memberships m on m.id = ej.requested_by_membership_id and m.tenant_id = ej.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where ej.tenant_id = current_setting('app.tenant_id', true)::uuid
    )
    select
      source_type,
      id::text as id,
      definition_key,
      definition_title,
      status,
      format,
      row_count,
      requested_by_name,
      created_at,
      completed_at,
      expires_at,
      has_file
    from history
    where (${sourceType}::text is null or source_type = ${sourceType})
      and (${status}::text is null or status = ${status})
      and (${definitionKey}::text is null or definition_key = ${definitionKey})
      and (
        ${createdFrom}::timestamptz is null
        or created_at >= ${createdFrom}::timestamptz
      )
      and (
        ${createdTo}::timestamptz is null
        or created_at <= ${createdTo}::timestamptz
      )
      and (
        ${q}::text is null
        or lower(coalesce(definition_key, '')) like '%' || lower(${q}) || '%'
        or lower(coalesce(definition_title, '')) like '%' || lower(${q}) || '%'
        or lower(coalesce(requested_by_name, '')) like '%' || lower(${q}) || '%'
        or id::text = ${q}
      )
    order by created_at desc, id desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "source_type",
    "id",
    "definition_key",
    "definition_title",
    "status",
    "format",
    "row_count",
    "requested_by_name",
    "created_at",
    "completed_at",
    "expires_at",
    "has_file",
  ]);
}

async function queryActiveDevices(
  tx: TenantTx,
  params: DatasetParams,
): Promise<ReportDatasetResult> {
  const membershipId = asString(params["membershipId"]);
  const platform = asString(params["platform"]);
  const email = asString(params["email"]);
  const window = asString(params["window"]) ?? "all";
  const overLimitOnly = params["overLimitOnly"] === true;

  const windowFrom =
    window === "24h"
      ? new Date(Date.now() - 24 * 60 * 60 * 1000)
      : window === "7d"
        ? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        : window === "30d"
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          : null;

  const configRows = await tx.$queryRaw<Array<{ config_json: unknown }>>`
    select config_json
    from tenant_config
    where tenant_id = current_setting('app.tenant_id', true)::uuid
    limit 1
  `;
  const root =
    configRows[0]?.config_json &&
    typeof configRows[0].config_json === "object" &&
    !Array.isArray(configRows[0].config_json)
      ? (configRows[0].config_json as Record<string, unknown>)
      : {};
  const security =
    root["security"] && typeof root["security"] === "object" && !Array.isArray(root["security"])
      ? (root["security"] as Record<string, unknown>)
      : {};
  const rawLimit = security["deviceRegistrationLimit"];
  const parsedLimit =
    typeof rawLimit === "number" ? rawLimit : typeof rawLimit === "string" ? Number(rawLimit) : 1;
  const deviceLimit = Number.isFinite(parsedLimit)
    ? Math.min(10, Math.max(1, Math.trunc(parsedLimit)))
    : 1;

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    with session_base as (
      select
        ds.id::text as id,
        ds.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        ds.platform,
        ds.device_fingerprint,
        ds.user_agent,
        ds.ip_address,
        ds.last_seen_at,
        ds.created_at,
        count(*) over (partition by ds.membership_id)::int as device_count
      from device_sessions ds
      join memberships m on m.id = ds.membership_id and m.tenant_id = ds.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where ds.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${membershipId}::uuid is null or ds.membership_id = ${membershipId}::uuid)
        and (${platform}::text is null or lower(coalesce(ds.platform, '')) = lower(${platform}))
        and (
          ${email}::text is null
          or lower(coalesce(ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${email}) || '%'
        )
        and (
          ${windowFrom}::timestamptz is null
          or ds.last_seen_at >= ${windowFrom}::timestamptz
        )
    )
    select
      id,
      membership_id,
      learner_name,
      email,
      device_count,
      platform,
      device_fingerprint,
      user_agent,
      ip_address,
      last_seen_at,
      created_at,
      case when device_count > ${deviceLimit} then 'over_limit' else 'ok' end as status,
      case when device_count > ${deviceLimit} then 'over_limit' else null end as flags
    from session_base
    where (
      ${overLimitOnly}::boolean = false
      or device_count > ${deviceLimit}
    )
    order by last_seen_at desc
    limit ${REPORT_ROW_CAP}
  `;

  const allColumns = [
    "id",
    "membership_id",
    "learner_name",
    "email",
    "device_count",
    "platform",
    "device_fingerprint",
    "user_agent",
    "ip_address",
    "last_seen_at",
    "created_at",
    "status",
    "flags",
  ];
  const requested = Array.isArray(params["columns"])
    ? params["columns"].filter((value): value is string => typeof value === "string")
    : [];
  const columns =
    requested.length > 0 ? allColumns.filter((column) => requested.includes(column)) : allColumns;

  return mapRows(rows, columns.length > 0 ? columns : allColumns);
}

async function queryPayments(tx: TenantTx, params: DatasetParams): Promise<ReportDatasetResult> {
  const reportTab = asString(params["reportTab"]) ?? "transactions";
  if (reportTab === "instalments") {
    const startDate = asString(params["startDate"]) ?? asString(params["paidFrom"]);
    const endDate = asString(params["endDate"]) ?? asString(params["paidTo"]);
    const status = asString(params["status"]);
    const learnerName = asString(params["learnerName"]);
    const searchQ = asString(params["q"]);
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.id::text as plan_id,
        p.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        p.product_title,
        p.pricing_plan_label,
        p.total_amount_cents,
        p.remaining_amount_cents,
        p.currency,
        p.status,
        p.created_at
      from payment_instalment_plans p
      join memberships m on m.id = p.membership_id and m.tenant_id = p.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${status}::text is null or p.status = ${status})
        and (
          ${learnerName}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerName}) || '%'
        )
        and (
          ${searchQ}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${searchQ}) || '%'
          or lower(coalesce(p.product_title, '')) like '%' || lower(${searchQ}) || '%'
        )
        and (
          ${startDate}::timestamptz is null
          or p.created_at >= ${startDate}::timestamptz
        )
        and (
          ${endDate}::timestamptz is null
          or p.created_at <= ${endDate}::timestamptz
        )
      order by p.created_at desc
      limit ${REPORT_ROW_CAP}
    `;
    const allColumns = [
      "plan_id",
      "membership_id",
      "learner_name",
      "email",
      "product_title",
      "pricing_plan_label",
      "total_amount_cents",
      "remaining_amount_cents",
      "currency",
      "status",
      "created_at",
    ];
    const requested = Array.isArray(params["columns"])
      ? params["columns"].filter((value): value is string => typeof value === "string")
      : [];
    const columns =
      requested.length > 0 ? allColumns.filter((column) => requested.includes(column)) : allColumns;
    return mapRows(rows, columns.length > 0 ? columns : allColumns);
  }

  const status = asString(params["status"]) ?? (reportTab === "invoices" ? "paid" : undefined);
  const gatewayKey = asString(params["gatewayKey"]);
  const productType = asString(params["productType"]);
  const learnerName = asString(params["learnerName"]);
  const searchQ = asString(params["q"]);
  const currency = asString(params["currency"]);
  const startDate = asString(params["startDate"]) ?? asString(params["paidFrom"]);
  const endDate = asString(params["endDate"]) ?? asString(params["paidTo"]);
  const invoicesOnly = reportTab === "invoices";
  const refundsOnly = reportTab === "refunds";

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      po.id::text as id,
      po.membership_id::text as membership_id,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      coalesce(
        po.product_title,
        c.title,
        po.metadata_json->>'productTitle',
        po.metadata_json->>'courseTitle'
      ) as product_title,
      coalesce(po.product_type, po.metadata_json->>'productType', 'course') as product_type,
      coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') as gateway_key,
      coalesce(
        po.coupon_amount_cents,
        nullif(po.metadata_json->>'discountCents', '')::int,
        0
      ) as coupon_amount_cents,
      po.amount_cents,
      po.tax_amount_cents,
      po.currency,
      po.status,
      po.invoice_number,
      po.external_id,
      po.paid_at,
      po.created_at
    from payment_orders po
    left join memberships m on m.id = po.membership_id and m.tenant_id = po.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    left join courses c
      on c.tenant_id = po.tenant_id
      and (po.metadata_json->>'courseId') ~ '^[0-9a-fA-F-]{36}$'
      and c.id = (po.metadata_json->>'courseId')::uuid
    where po.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${status}::text is null or po.status = ${status})
      and (${invoicesOnly}::boolean = false or po.invoice_number is not null)
      and (
        ${refundsOnly}::boolean = false
        or lower(po.status) like '%refund%'
        or coalesce(jsonb_array_length(
          case
            when jsonb_typeof(coalesce(po.metadata_json->'refunds', '[]'::jsonb)) = 'array'
            then coalesce(po.metadata_json->'refunds', '[]'::jsonb)
            else '[]'::jsonb
          end
        ), 0) > 0
      )
      and (
        ${gatewayKey}::text is null
        or coalesce(po.gateway_key, po.metadata_json->>'gatewayKey', po.metadata_json->>'gateway_key') = ${gatewayKey}
      )
      and (
        ${productType}::text is null
        or coalesce(po.product_type, po.metadata_json->>'productType', 'course') = ${productType}
      )
      and (
        ${learnerName}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${learnerName}) || '%'
      )
      and (
        ${currency}::text is null
        or upper(po.currency) = upper(${currency})
      )
      and (
        ${searchQ}::text is null
        or lower(coalesce(po.invoice_number, '')) like '%' || lower(${searchQ}) || '%'
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${searchQ}) || '%'
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${searchQ}) || '%'
        or lower(coalesce(po.billing_name, '')) like '%' || lower(${searchQ}) || '%'
      )
      and (
        ${startDate}::timestamptz is null
        or coalesce(po.paid_at, po.created_at) >= ${startDate}::timestamptz
      )
      and (
        ${endDate}::timestamptz is null
        or coalesce(po.paid_at, po.created_at) <= ${endDate}::timestamptz
      )
    order by coalesce(po.paid_at, po.created_at) desc
    limit ${REPORT_ROW_CAP}
  `;

  const allColumns = [
    "id",
    "membership_id",
    "learner_name",
    "email",
    "product_title",
    "product_type",
    "gateway_key",
    "coupon_amount_cents",
    "amount_cents",
    "tax_amount_cents",
    "currency",
    "status",
    "invoice_number",
    "external_id",
    "paid_at",
    "created_at",
  ];
  const requested = Array.isArray(params["columns"])
    ? params["columns"].filter((value): value is string => typeof value === "string")
    : [];
  const columns =
    requested.length > 0 ? allColumns.filter((column) => requested.includes(column)) : allColumns;
  return mapRows(rows, columns.length > 0 ? columns : allColumns);
}

async function queryBatches(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const batchId = asString(params["batchId"]);
  const learnerName = asString(params["learnerName"]);
  const joinedFrom = asString(params["joinedFrom"]);
  const joinedTo = asString(params["joinedTo"]);
  const status = asString(params["status"]);
  const allActiveBatches = params["allActiveBatches"] === true;
  const batchIdsRaw = params["batchIds"];
  const batchIds = Array.isArray(batchIdsRaw)
    ? batchIdsRaw.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];
  const batchIdsCsv = batchIds.length > 0 ? batchIds.join(",") : null;

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      b.id::text as batch_id,
      b.key as batch_key,
      b.name as batch_name,
      b.status::text as batch_status,
      b.course_id::text as course_id,
      c.title as course_title,
      bm.membership_id::text as membership_id,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      m.last_active_at as activity_at,
      bm.joined_at,
      b.starts_at,
      b.ends_at
    from batches b
    left join courses c on c.id = b.course_id and c.tenant_id = b.tenant_id and c.deleted_at is null
    left join batch_memberships bm on bm.batch_id = b.id and bm.tenant_id = b.tenant_id
    left join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where b.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${batchId}::uuid is null or b.id = ${batchId}::uuid)
      and (
        ${batchIdsCsv}::text is null
        or b.id = any(string_to_array(${batchIdsCsv}, ',')::uuid[])
      )
      and (
        ${allActiveBatches}::boolean = false
        or b.status::text = 'ACTIVE'
      )
      and (${status}::text is null or b.status::text = ${status})
      and (
        ${learnerName}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${learnerName}) || '%'
      )
      and (
        ${joinedFrom}::timestamptz is null
        or bm.joined_at >= ${joinedFrom}::timestamptz
      )
      and (
        ${joinedTo}::timestamptz is null
        or bm.joined_at <= ${joinedTo}::timestamptz
      )
    order by b.created_at desc, bm.joined_at desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "batch_id",
    "batch_key",
    "batch_name",
    "batch_status",
    "course_id",
    "course_title",
    "membership_id",
    "learner_name",
    "email",
    "activity_at",
    "joined_at",
    "starts_at",
    "ends_at",
  ]);
}

async function queryPolls(tx: TenantTx, params: DatasetParams = {}): Promise<ReportDatasetResult> {
  const pollId = asString(params["pollId"]);
  const learnerName = asString(params["learnerName"]);
  const optionId = asString(params["optionId"]);
  const respondedFrom = asString(params["respondedFrom"]);
  const respondedTo = asString(params["respondedTo"]);

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      p.id::text as poll_id,
      p.title as poll_title,
      p.poll_type,
      p.status::text as poll_status,
      p.quiz_mode,
      p.anonymous_vote,
      p.live_session_id::text as live_session_id,
      po.id::text as option_id,
      po.label as option_label,
      po.is_correct,
      case
        when p.anonymous_vote then null
        else pr.membership_id::text
      end as membership_id,
      case
        when p.anonymous_vote then null
        else coalesce(mp.display_name, ap.email, m.invited_email_normalized)
      end as learner_name,
      case
        when p.anonymous_vote then null
        else coalesce(ap.email, m.invited_email_normalized)
      end as email,
      pr.created_at as responded_at
    from polls p
    left join poll_responses pr on pr.poll_id = p.id and pr.tenant_id = p.tenant_id
    left join poll_options po on po.id = pr.poll_option_id and po.tenant_id = p.tenant_id
    left join memberships m on m.id = pr.membership_id and m.tenant_id = pr.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where p.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${pollId}::uuid is null or p.id = ${pollId}::uuid)
      and (${optionId}::uuid is null or pr.poll_option_id = ${optionId}::uuid)
      and (
        ${learnerName}::text is null
        or (
          p.anonymous_vote = false
          and lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${learnerName}) || '%'
        )
      )
      and (
        ${respondedFrom}::timestamptz is null
        or pr.created_at >= ${respondedFrom}::timestamptz
      )
      and (
        ${respondedTo}::timestamptz is null
        or pr.created_at <= ${respondedTo}::timestamptz
      )
    order by p.created_at desc, pr.created_at desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "poll_id",
    "poll_title",
    "poll_type",
    "poll_status",
    "quiz_mode",
    "anonymous_vote",
    "live_session_id",
    "option_id",
    "option_label",
    "is_correct",
    "membership_id",
    "learner_name",
    "email",
    "responded_at",
  ]);
}

async function querySalesMarketing(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const section = asString(params["section"]) ?? "sales";
  const courseId = asString(params["courseId"]);
  const couponId = asString(params["couponId"]);
  const learnerName = asString(params["learnerName"]);
  const email = asString(params["email"]);

  if (section === "coupons") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.id::text as coupon_id,
        c.code,
        c.name,
        c.status,
        c.discount_type,
        c.discount_value,
        c.currency,
        count(r.id)::int as redemption_count,
        coalesce(sum(r.discount_cents), 0)::int as total_discount_cents,
        coalesce(sum(r.final_amount_cents), 0)::int as total_revenue_cents
      from sales_coupons c
      left join sales_coupon_redemptions r on r.coupon_id = c.id and r.tenant_id = c.tenant_id
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${couponId}::uuid is null or c.id = ${couponId}::uuid)
      group by c.id
      order by redemption_count desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "coupon_id",
      "code",
      "name",
      "status",
      "discount_type",
      "discount_value",
      "currency",
      "redemption_count",
      "total_discount_cents",
      "total_revenue_cents",
    ]);
  }

  if (section === "referral-wallet") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        rc.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        rc.code as referral_code,
        (
          select count(*)::int from sales_referral_attributions a
          where a.referrer_membership_id = rc.membership_id and a.signup_credited_at is not null
        ) as successful_referrals,
        (
          select coalesce(sum(t.credits), 0)::int from sales_wallet_transactions t
          where t.membership_id = rc.membership_id
            and t.direction = 'CREDIT'
            and t.reason in ('REFERRAL_SIGNUP', 'REFERRAL_PURCHASE')
        ) as credit_earned,
        coalesce(w.balance_credits, 0)::int as wallet_balance
      from sales_referral_codes rc
      left join sales_wallets w on w.membership_id = rc.membership_id and w.tenant_id = rc.tenant_id
      left join memberships m on m.id = rc.membership_id and m.tenant_id = rc.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where rc.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by successful_referrals desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "membership_id",
      "learner_name",
      "email",
      "referral_code",
      "successful_referrals",
      "credit_earned",
      "wallet_balance",
    ]);
  }

  if (section === "affiliate-products") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        p.course_id::text as course_id,
        coalesce(c.title, 'Untitled') as product_title,
        p.enabled,
        coalesce((
          select count(*)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id
        ), 0) as order_count,
        coalesce((
          select sum(ac.order_amount_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id
        ), 0) as revenue_cents,
        coalesce((
          select sum(ac.commission_cents)::int from sales_affiliate_commissions ac
          where ac.course_id = p.course_id
        ), 0) as commission_cents,
        p.created_at as published_at
      from sales_affiliate_products p
      left join courses c on c.id = p.course_id and c.tenant_id = p.tenant_id
      where p.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by revenue_cents desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "course_id",
      "product_title",
      "enabled",
      "order_count",
      "revenue_cents",
      "commission_cents",
      "published_at",
    ]);
  }

  if (section === "affiliates") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as affiliate_id,
        a.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        a.tier,
        a.status,
        a.coupon_code,
        coalesce((
          select sum(c.order_amount_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
        ), 0) as revenue_contribution_cents,
        coalesce((
          select sum(c.commission_cents)::int from sales_affiliate_commissions c
          where c.affiliate_id = a.id
        ), 0) as commission_earned_cents,
        a.created_at as signed_up_at
      from sales_affiliates a
      left join memberships m on m.id = a.membership_id and m.tenant_id = a.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by commission_earned_cents desc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "affiliate_id",
      "membership_id",
      "learner_name",
      "email",
      "tier",
      "status",
      "coupon_code",
      "revenue_contribution_cents",
      "commission_earned_cents",
      "signed_up_at",
    ]);
  }

  // Default: sales purchasers / product revenue rows
  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      c.id::text as course_id,
      c.title as product_title,
      coalesce(po.membership_id, e.membership_id)::text as membership_id,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      coalesce(po.amount_cents, 0)::int as amount_cents,
      coalesce(po.currency, 'INR') as currency,
      e.enrolled_type,
      coalesce(po.paid_at, po.created_at, e.enrolled_at) as purchased_at
    from courses c
    left join payment_orders po
      on po.tenant_id = c.tenant_id
      and po.status = 'paid'
      and po.membership_id is not null
      and (
        (po.metadata_json->>'courseId') = c.id::text
        or po.product_title = c.title
      )
    left join enrollments e
      on e.course_id = c.id and e.tenant_id = c.tenant_id
      and (po.membership_id is null or e.membership_id = po.membership_id)
    left join memberships m
      on m.id = coalesce(po.membership_id, e.membership_id) and m.tenant_id = c.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where c.tenant_id = current_setting('app.tenant_id', true)::uuid
      and c.deleted_at is null
      and coalesce(po.membership_id, e.membership_id) is not null
      and (${courseId}::uuid is null or c.id = ${courseId}::uuid)
      and (
        ${learnerName}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${learnerName}) || '%'
      )
      and (
        ${email}::text is null
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${email}) || '%'
      )
    order by purchased_at desc nulls last
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "course_id",
    "product_title",
    "membership_id",
    "learner_name",
    "email",
    "amount_cents",
    "currency",
    "enrolled_type",
    "purchased_at",
  ]);
}

async function queryCustomField(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const email = asString(params["email"]);
  const status = asString(params["status"]);
  const signedUpFrom = asString(params["signedUpFrom"]);
  const signedUpTo = asString(params["signedUpTo"]);
  const q = asString(params["q"]);

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      m.id::text as membership_id,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      m.status::text as membership_status,
      coalesce(m.joined_at, m.created_at) as signed_up_at,
      m.last_active_at,
      (
        select count(*)::int from enrollments e
        where e.membership_id = m.id and e.tenant_id = m.tenant_id
      ) as enrollment_count,
      coalesce((
        select sum(po.amount_cents)::int from payment_orders po
        where po.membership_id = m.id and po.tenant_id = m.tenant_id and po.status = 'paid'
      ), 0) as total_spent_cents,
      cfd.key as field_key,
      cfd.label as field_label,
      cfv.value_json
    from memberships m
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    left join custom_field_values cfv
      on cfv.membership_id = m.id and cfv.tenant_id = m.tenant_id
    left join custom_field_definitions cfd
      on cfd.id = cfv.custom_field_definition_id and cfd.tenant_id = cfv.tenant_id
      and cfd.status = 'ACTIVE'
    where m.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${status}::text is null or m.status::text = ${status})
      and (
        ${q}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${q}) || '%'
      )
      and (
        ${email}::text is null
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${email}) || '%'
      )
      and (
        ${signedUpFrom}::timestamptz is null
        or coalesce(m.joined_at, m.created_at) >= ${signedUpFrom}::timestamptz
      )
      and (
        ${signedUpTo}::timestamptz is null
        or coalesce(m.joined_at, m.created_at) <= ${signedUpTo}::timestamptz
      )
    order by coalesce(m.joined_at, m.created_at) desc, cfd.key asc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "membership_id",
    "learner_name",
    "email",
    "membership_status",
    "signed_up_at",
    "last_active_at",
    "enrollment_count",
    "total_spent_cents",
    "field_key",
    "field_label",
    "value_json",
  ]);
}

async function queryZoomInsights(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const dataset = asString(params["dataset"]) ?? asString(params["reportTab"]) ?? "participants";
  const meetingId = asString(params["meetingId"]);
  const displayName = asString(params["displayName"]);
  const email = asString(params["email"]);
  const startedFrom = asString(params["startedFrom"]) ?? asString(params["joinedFrom"]);
  const startedTo = asString(params["startedTo"]) ?? asString(params["joinedTo"]);
  const joinedFrom = asString(params["joinedFrom"]) ?? startedFrom;
  const joinedTo = asString(params["joinedTo"]) ?? startedTo;

  if (dataset === "connection") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        zsr.id::text as sync_run_id,
        zsr.trigger,
        zsr.status,
        zsr.started_at,
        zsr.finished_at,
        zsr.meetings_count,
        zsr.participants_count,
        zsr.skipped_count,
        zsr.error_message
      from zoom_sync_runs zsr
      where zsr.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (
          ${startedFrom}::timestamptz is null
          or zsr.started_at >= ${startedFrom}::timestamptz
        )
        and (
          ${startedTo}::timestamptz is null
          or zsr.started_at <= ${startedTo}::timestamptz
        )
      order by zsr.started_at desc nulls last
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "sync_run_id",
      "trigger",
      "status",
      "started_at",
      "finished_at",
      "meetings_count",
      "participants_count",
      "skipped_count",
      "error_message",
    ]);
  }

  if (dataset === "meetings") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        zm.id::text as meeting_id,
        zm.external_meeting_id,
        zm.topic,
        zm.started_at,
        zm.ended_at,
        case
          when zm.started_at is not null and zm.ended_at is not null
            then greatest(0, extract(epoch from (zm.ended_at - zm.started_at))::int)
          else null
        end as duration_seconds,
        count(zmp.id)::int as attendance_count,
        count(zmp.id) filter (where zmp.membership_id is not null)::int as matched_count,
        count(zmp.id) filter (where zmp.membership_id is null)::int as unmatched_count
      from zoom_meetings zm
      left join zoom_meeting_participants zmp
        on zmp.zoom_meeting_id = zm.id
        and zmp.tenant_id = zm.tenant_id
      where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${meetingId}::uuid is null or zm.id = ${meetingId}::uuid)
        and (
          ${startedFrom}::timestamptz is null
          or zm.started_at >= ${startedFrom}::timestamptz
        )
        and (
          ${startedTo}::timestamptz is null
          or zm.started_at <= ${startedTo}::timestamptz
        )
      group by zm.id
      order by zm.started_at desc nulls last
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "meeting_id",
      "external_meeting_id",
      "topic",
      "started_at",
      "ended_at",
      "duration_seconds",
      "attendance_count",
      "matched_count",
      "unmatched_count",
    ]);
  }

  const unmatchedOnly = dataset === "unmatched";

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      zm.id::text as meeting_id,
      zm.external_meeting_id,
      zm.topic,
      zm.started_at,
      zm.ended_at,
      zmp.membership_id::text as membership_id,
      coalesce(zmp.display_name, mp.display_name) as display_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      zmp.join_time,
      zmp.leave_time,
      zmp.duration_seconds
    from zoom_meetings zm
    left join zoom_meeting_participants zmp
      on zmp.zoom_meeting_id = zm.id
      and zmp.tenant_id = zm.tenant_id
    left join memberships m
      on m.id = zmp.membership_id and m.tenant_id = zmp.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    where zm.tenant_id = current_setting('app.tenant_id', true)::uuid
      and (${meetingId}::uuid is null or zm.id = ${meetingId}::uuid)
      and (
        ${displayName}::text is null
        or lower(coalesce(zmp.display_name, mp.display_name, ''))
          like '%' || lower(${displayName}) || '%'
      )
      and (
        ${email}::text is null
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${email}) || '%'
      )
      and (
        ${joinedFrom}::timestamptz is null
        or zmp.join_time >= ${joinedFrom}::timestamptz
      )
      and (
        ${joinedTo}::timestamptz is null
        or zmp.join_time <= ${joinedTo}::timestamptz
      )
      and (
        ${startedFrom}::timestamptz is null
        or zm.started_at >= ${startedFrom}::timestamptz
      )
      and (
        ${startedTo}::timestamptz is null
        or zm.started_at <= ${startedTo}::timestamptz
      )
      and (
        ${unmatchedOnly}::boolean is not true
        or (zmp.id is not null and zmp.membership_id is null)
      )
    order by zm.started_at desc nulls last, zmp.join_time asc nulls last
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "meeting_id",
    "external_meeting_id",
    "topic",
    "started_at",
    "ended_at",
    "membership_id",
    "display_name",
    "email",
    "join_time",
    "leave_time",
    "duration_seconds",
  ]);
}

async function queryLiveClassAttendance(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const datasetRaw = asString(params["dataset"]) ?? asString(params["reportTab"]) ?? "attendees";
  const dataset =
    datasetRaw === "sessions" || datasetRaw === "learner_summary" || datasetRaw === "series_rollup"
      ? datasetRaw
      : "attendees";

  const sessionId = asString(params["sessionId"]);
  const courseId = asString(params["courseId"]);
  const batchId = asString(params["batchId"]);
  const learnerName = asString(params["learnerName"]);
  const email = asString(params["email"]);
  const status = asString(params["status"]);
  const joinedFrom = asString(params["joinedFrom"]) ?? asString(params["scheduledFrom"]);
  const joinedTo = asString(params["joinedTo"]) ?? asString(params["scheduledTo"]);
  const registrationMode = asString(params["registrationMode"]) ?? "include_never_joined";
  const attendeesOnlyStatus = registrationMode === "attendees_only" ? "attended" : null;

  if (dataset === "sessions") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        ls.id::text as session_id,
        ls.title as session_title,
        ls.status as session_status,
        ls.status,
        ls.course_id::text as course_id,
        c.title as course_title,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
          else null
        end as duration_seconds,
        count(la.id)::int as registered_count,
        count(la.id) filter (where la.status = 'attended')::int as attended_count,
        count(la.id) filter (where la.status in ('registered', 'absent'))::int as never_joined_count,
        case
          when count(la.id) = 0 then null
          else round(
            (count(la.id) filter (where la.status = 'attended')::numeric / nullif(count(la.id), 0)) * 100,
            1
          )::float8
        end as coverage_pct
      from live_sessions ls
      left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${sessionId}::uuid is null or ls.id = ${sessionId}::uuid)
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and (
          ${joinedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) >= ${joinedFrom}::timestamptz
        )
        and (
          ${joinedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) <= ${joinedTo}::timestamptz
        )
      group by ls.id, c.title, b.name
      order by ls.scheduled_at desc nulls last
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, [
      "session_id",
      "session_title",
      "session_status",
      "status",
      "course_id",
      "course_title",
      "batch_id",
      "batch_name",
      "scheduled_at",
      "started_at",
      "ended_at",
      "duration_seconds",
      "registered_count",
      "attended_count",
      "never_joined_count",
      "coverage_pct",
    ]);
  }

  if (dataset === "learner_summary") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        la.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email,
        count(distinct la.live_session_id)::int as sessions_registered,
        count(distinct la.live_session_id) filter (where la.status = 'attended')::int as sessions_attended,
        coalesce(sum(la.duration_seconds) filter (where la.status = 'attended'), 0)::int as duration_seconds,
        case
          when count(distinct la.live_session_id) = 0 then null
          else round(
            (count(distinct la.live_session_id) filter (where la.status = 'attended')::numeric
              / nullif(count(distinct la.live_session_id), 0)) * 100,
            1
          )::float8
        end as coverage_pct,
        min(c.title) as course_title,
        min(b.name) as batch_name
      from live_attendance la
      join live_sessions ls on ls.id = la.live_session_id and ls.tenant_id = la.tenant_id
      left join memberships m on m.id = la.membership_id and m.tenant_id = la.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where la.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${sessionId}::uuid is null or ls.id = ${sessionId}::uuid)
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and (
          ${joinedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at, la.joined_at) >= ${joinedFrom}::timestamptz
        )
        and (
          ${joinedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at, la.joined_at) <= ${joinedTo}::timestamptz
        )
        and (
          ${attendeesOnlyStatus}::text is null
          or la.status = ${attendeesOnlyStatus}
        )
      group by la.membership_id, mp.display_name, ap.email, m.invited_email_normalized
      order by sessions_attended desc, learner_name asc
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, [
      "membership_id",
      "learner_name",
      "email",
      "sessions_registered",
      "sessions_attended",
      "duration_seconds",
      "coverage_pct",
      "course_title",
      "batch_name",
    ]);
  }

  if (dataset === "series_rollup") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce(c.id::text, 'uncategorized') as course_id,
        coalesce(c.title, 'Uncategorized') as course_title,
        coalesce(b.id::text, 'none') as batch_id,
        coalesce(b.name, 'No batch') as batch_name,
        count(distinct ls.id)::int as sessions_count,
        count(la.id)::int as registered_count,
        count(la.id) filter (where la.status = 'attended')::int as attended_count,
        coalesce(sum(la.duration_seconds) filter (where la.status = 'attended'), 0)::int as duration_seconds,
        case
          when count(la.id) = 0 then null
          else round(
            (count(la.id) filter (where la.status = 'attended')::numeric / nullif(count(la.id), 0)) * 100,
            1
          )::float8
        end as coverage_pct
      from live_sessions ls
      left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and (
          ${joinedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) >= ${joinedFrom}::timestamptz
        )
        and (
          ${joinedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) <= ${joinedTo}::timestamptz
        )
      group by c.id, c.title, b.id, b.name
      order by sessions_count desc, course_title asc
      limit ${REPORT_ROW_CAP}
    `;

    return mapRows(rows, [
      "course_id",
      "course_title",
      "batch_id",
      "batch_name",
      "sessions_count",
      "registered_count",
      "attended_count",
      "duration_seconds",
      "coverage_pct",
    ]);
  }

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      ls.id::text as session_id,
      ls.title as session_title,
      ls.status as session_status,
      ls.course_id::text as course_id,
      c.title as course_title,
      ls.batch_id::text as batch_id,
      b.name as batch_name,
      la.membership_id::text as membership_id,
      coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
      coalesce(ap.email, m.invited_email_normalized) as email,
      la.status,
      la.joined_at,
      la.left_at,
      la.duration_seconds,
      la.created_at as registered_at,
      case
        when ls.started_at is null or ls.ended_at is null or la.duration_seconds is null then null
        when extract(epoch from (ls.ended_at - ls.started_at)) <= 0 then null
        else round(
          least(
            100,
            (la.duration_seconds::numeric / nullif(extract(epoch from (ls.ended_at - ls.started_at)), 0)) * 100
          ),
          1
        )::float8
      end as coverage_pct
    from live_sessions ls
    left join live_attendance la
      on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
    left join memberships m
      on m.id = la.membership_id and m.tenant_id = la.tenant_id
    left join member_profiles mp
      on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
    left join auth_principals ap on ap.id = m.auth_principal_id
    left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
    left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
    where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
      and la.id is not null
      and (${sessionId}::uuid is null or ls.id = ${sessionId}::uuid)
      and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
      and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
      and (${status}::text is null or la.status = ${status})
      and (
        ${attendeesOnlyStatus}::text is null
        or la.status = ${attendeesOnlyStatus}
      )
      and (
        ${learnerName}::text is null
        or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${learnerName}) || '%'
      )
      and (
        ${email}::text is null
        or lower(coalesce(ap.email, m.invited_email_normalized, ''))
          like '%' || lower(${email}) || '%'
      )
      and (
        ${joinedFrom}::timestamptz is null
        or coalesce(la.joined_at, ls.scheduled_at) >= ${joinedFrom}::timestamptz
      )
      and (
        ${joinedTo}::timestamptz is null
        or coalesce(la.joined_at, ls.scheduled_at) <= ${joinedTo}::timestamptz
      )
    order by ls.scheduled_at desc nulls last, la.joined_at asc nulls last
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "session_id",
    "session_title",
    "session_status",
    "course_id",
    "course_title",
    "batch_id",
    "batch_name",
    "membership_id",
    "learner_name",
    "email",
    "status",
    "joined_at",
    "left_at",
    "duration_seconds",
    "registered_at",
    "coverage_pct",
  ]);
}

async function querySuperLiveInsights(
  tx: TenantTx,
  params: DatasetParams = {},
): Promise<ReportDatasetResult> {
  const datasetRaw =
    asString(params["dataset"]) ?? asString(params["reportTab"]) ?? "session_metrics";
  const dataset =
    datasetRaw === "trend_series" ||
    datasetRaw === "series_rollup" ||
    datasetRaw === "outlier_findings"
      ? datasetRaw
      : "session_metrics";

  const sessionId = asString(params["sessionId"]);
  const status = asString(params["status"]);
  const q = asString(params["q"]);
  const courseId = asString(params["courseId"]);
  const batchId = asString(params["batchId"]);
  const startedFrom = asString(params["startedFrom"]) ?? asString(params["scheduledFrom"]);
  const startedTo = asString(params["startedTo"]) ?? asString(params["scheduledTo"]);
  const includeBenchmarks = params["includeBenchmarks"] === true;
  const seriesKind = asString(params["seriesKind"]) === "batch" ? "batch" : "course";
  const granularityRaw = asString(params["granularity"]) ?? "week";
  const truncUnit =
    granularityRaw === "day" ? "day" : granularityRaw === "month" ? "month" : "week";

  const sessionIds = Array.isArray(params["sessionIds"])
    ? params["sessionIds"].filter((id): id is string => typeof id === "string")
    : [];
  const sessionIdsCsv = sessionIds.length > 0 ? sessionIds.join(",") : null;

  const minAttendedRaw = params["minAttended"];
  const minAttended =
    typeof minAttendedRaw === "number"
      ? minAttendedRaw
      : typeof minAttendedRaw === "string" && minAttendedRaw.length > 0
        ? Number(minAttendedRaw)
        : null;
  const minAttendedValue = minAttended != null && Number.isFinite(minAttended) ? minAttended : null;

  if (dataset === "trend_series") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with session_metrics as (
        select
          date_trunc(${truncUnit}, coalesce(ls.started_at, ls.scheduled_at)) as period_start,
          ls.id,
          count(la.id) filter (where la.status = 'attended')::int as attended_count,
          count(la.id)::int as total_count
        from live_sessions ls
        left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
          and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
          and (
            ${startedFrom}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${startedFrom}::timestamptz
          )
          and (
            ${startedTo}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${startedTo}::timestamptz
          )
        group by 1, ls.id
      )
      select
        period_start,
        count(*)::int as session_count,
        coalesce(sum(attended_count), 0)::int as attended_count,
        coalesce(sum(total_count), 0)::int as total_count,
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as attendance_rate
      from session_metrics
      where period_start is not null
      group by period_start
      order by period_start asc
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "period_start",
      "session_count",
      "attended_count",
      "total_count",
      "attendance_rate",
    ]);
  }

  if (dataset === "series_rollup") {
    if (seriesKind === "batch") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          coalesce(b.name, 'Unassigned batch') as series_title,
          ls.batch_id::text as series_id,
          count(distinct ls.id)::int as session_count,
          count(la.id) filter (where la.status = 'attended')::int as attended_count,
          count(la.id) filter (where la.status = 'registered')::int as registered_count,
          count(la.id) filter (where la.status = 'absent')::int as absent_count,
          count(la.id)::int as total_count,
          case
            when count(la.id) = 0 then null
            else round(
              (count(la.id) filter (where la.status = 'attended')::numeric / nullif(count(la.id), 0)) * 100,
              1
            )::float8
          end as attendance_rate
        from live_sessions ls
        left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (
            ${startedFrom}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${startedFrom}::timestamptz
          )
          and (
            ${startedTo}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${startedTo}::timestamptz
          )
        group by ls.batch_id, b.name
        order by attendance_rate desc nulls last
        limit ${REPORT_ROW_CAP}
      `;
      return mapRows(rows, [
        "series_title",
        "series_id",
        "session_count",
        "attended_count",
        "registered_count",
        "absent_count",
        "total_count",
        "attendance_rate",
      ]);
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        coalesce(c.title, 'Unassigned course') as series_title,
        ls.course_id::text as series_id,
        count(distinct ls.id)::int as session_count,
        count(la.id) filter (where la.status = 'attended')::int as attended_count,
        count(la.id) filter (where la.status = 'registered')::int as registered_count,
        count(la.id) filter (where la.status = 'absent')::int as absent_count,
        count(la.id)::int as total_count,
        case
          when count(la.id) = 0 then null
          else round(
            (count(la.id) filter (where la.status = 'attended')::numeric / nullif(count(la.id), 0)) * 100,
            1
          )::float8
        end as attendance_rate
      from live_sessions ls
      left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and ls.status <> 'cancelled'
        and (
          ${startedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) >= ${startedFrom}::timestamptz
        )
        and (
          ${startedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) <= ${startedTo}::timestamptz
        )
      group by ls.course_id, c.title
      order by attendance_rate desc nulls last
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "series_title",
      "series_id",
      "session_count",
      "attended_count",
      "registered_count",
      "absent_count",
      "total_count",
      "attendance_rate",
    ]);
  }

  if (dataset === "outlier_findings") {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with session_base as (
        select
          ls.id,
          ls.title,
          c.title as course_title,
          b.name as batch_name,
          ls.scheduled_at,
          count(la.id) filter (where la.status = 'attended')::int as attended_count,
          count(la.id) filter (where la.status = 'registered')::int as registered_count,
          count(la.id) filter (where la.status = 'absent')::int as absent_count,
          count(la.id)::int as total_count,
          case
            when count(la.id) = 0 then null
            else round(
              (count(la.id) filter (where la.status = 'attended')::numeric / nullif(count(la.id), 0)) * 100,
              1
            )::float8
          end as attendance_rate,
          case
            when ls.started_at is not null and ls.scheduled_at is not null
              then floor(extract(epoch from (ls.started_at - ls.scheduled_at)))::int
            else null
          end as start_delay_seconds,
          round(avg(la.duration_seconds) filter (
            where la.status = 'attended' and la.duration_seconds is not null
          ))::int as avg_duration_seconds,
          case
            when ls.started_at is not null and ls.ended_at is not null
              then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
            else null
          end as duration_seconds,
          ls.course_id
        from live_sessions ls
        left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
        left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
        left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
        where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
          and ls.status <> 'cancelled'
          and (
            ${startedFrom}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) >= ${startedFrom}::timestamptz
          )
          and (
            ${startedTo}::timestamptz is null
            or coalesce(ls.started_at, ls.scheduled_at) <= ${startedTo}::timestamptz
          )
        group by ls.id, ls.title, c.title, b.name, ls.scheduled_at, ls.started_at, ls.ended_at, ls.course_id
      ),
      course_rates as (
        select
          course_id,
          case
            when coalesce(sum(total_count), 0) = 0 then null
            else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
          end as course_avg_rate
        from session_base
        where course_id is not null
        group by course_id
      )
      select
        case
          when sb.total_count = 0 then 'no_records'
          when sb.start_delay_seconds is not null and sb.start_delay_seconds >= 900 then 'started_late'
          when sb.total_count > 0 and (sb.registered_count::numeric / nullif(sb.total_count, 0)) * 100 >= 20
            then 'unresolved'
          when sb.avg_duration_seconds is not null and sb.duration_seconds is not null and sb.duration_seconds > 0
            and (sb.avg_duration_seconds::numeric / sb.duration_seconds) * 100 < 25
            then 'short_duration'
          when sb.attendance_rate is not null and cr.course_avg_rate is not null
            and (cr.course_avg_rate - sb.attendance_rate) >= 20
            then 'far_below'
          when sb.attendance_rate is not null and cr.course_avg_rate is not null
            and (sb.attendance_rate - cr.course_avg_rate) >= 20
            then 'far_above'
          else null
        end as category,
        case
          when sb.total_count = 0 then 'worth_checking'
          when sb.start_delay_seconds is not null and sb.start_delay_seconds >= 900 then 'data_quality'
          when sb.total_count > 0 and (sb.registered_count::numeric / nullif(sb.total_count, 0)) * 100 >= 20
            then 'notable'
          when sb.avg_duration_seconds is not null and sb.duration_seconds is not null and sb.duration_seconds > 0
            and (sb.avg_duration_seconds::numeric / sb.duration_seconds) * 100 < 25
            then 'notable'
          when sb.attendance_rate is not null and cr.course_avg_rate is not null
            and (cr.course_avg_rate - sb.attendance_rate) >= 20
            then 'data_quality'
          when sb.attendance_rate is not null and cr.course_avg_rate is not null
            and (sb.attendance_rate - cr.course_avg_rate) >= 20
            then 'worth_checking'
          else null
        end as severity,
        sb.title as session_title,
        sb.course_title,
        sb.batch_name,
        sb.scheduled_at,
        sb.attendance_rate,
        cr.course_avg_rate,
        sb.title as title
      from session_base sb
      left join course_rates cr on cr.course_id = sb.course_id
      where (
        sb.total_count = 0
        or (sb.start_delay_seconds is not null and sb.start_delay_seconds >= 900)
        or (sb.total_count > 0 and (sb.registered_count::numeric / nullif(sb.total_count, 0)) * 100 >= 20)
        or (
          sb.avg_duration_seconds is not null and sb.duration_seconds is not null and sb.duration_seconds > 0
          and (sb.avg_duration_seconds::numeric / sb.duration_seconds) * 100 < 25
        )
        or (
          sb.attendance_rate is not null and cr.course_avg_rate is not null
          and abs(sb.attendance_rate - cr.course_avg_rate) >= 20
        )
      )
      order by sb.scheduled_at desc nulls last
      limit ${REPORT_ROW_CAP}
    `;
    return mapRows(rows, [
      "category",
      "severity",
      "title",
      "session_title",
      "course_title",
      "batch_name",
      "scheduled_at",
      "attendance_rate",
      "course_avg_rate",
    ]);
  }

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    with session_rows as (
      select
        ls.id::text as session_id,
        ls.title,
        ls.status,
        ls.course_id::text as course_id,
        c.title as course_title,
        ls.batch_id::text as batch_id,
        b.name as batch_name,
        ls.scheduled_at,
        ls.started_at,
        ls.ended_at,
        case
          when ls.started_at is not null and ls.ended_at is not null
            then greatest(0, floor(extract(epoch from (ls.ended_at - ls.started_at)))::int)
          else null
        end as duration_seconds,
        count(la.id) filter (where la.status = 'attended')::int as attended_count,
        count(la.id) filter (where la.status = 'registered')::int as registered_count,
        count(la.id) filter (where la.status = 'absent')::int as absent_count,
        count(la.id)::int as total_count,
        round(avg(la.duration_seconds) filter (
          where la.status = 'attended' and la.duration_seconds is not null
        ))::int as avg_duration_seconds,
        case
          when count(la.id) = 0 then null
          else round(
            (count(la.id) filter (where la.status = 'attended')::numeric / nullif(count(la.id), 0)) * 100,
            1
          )::float8
        end as attendance_rate,
        ls.course_id as course_uuid
      from live_sessions ls
      left join live_attendance la on la.live_session_id = ls.id and la.tenant_id = ls.tenant_id
      left join courses c on c.id = ls.course_id and c.tenant_id = ls.tenant_id
      left join batches b on b.id = ls.batch_id and b.tenant_id = ls.tenant_id
      where ls.tenant_id = current_setting('app.tenant_id', true)::uuid
        and (${sessionId}::uuid is null or ls.id = ${sessionId}::uuid)
        and (${sessionIdsCsv}::text is null or ls.id::text = any(string_to_array(${sessionIdsCsv}, ',')))
        and (${status}::text is null or ls.status = ${status})
        and (${courseId}::uuid is null or ls.course_id = ${courseId}::uuid)
        and (${batchId}::uuid is null or ls.batch_id = ${batchId}::uuid)
        and (
          ${q}::text is null
          or lower(ls.title) like '%' || lower(${q}) || '%'
        )
        and (
          ${startedFrom}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) >= ${startedFrom}::timestamptz
        )
        and (
          ${startedTo}::timestamptz is null
          or coalesce(ls.started_at, ls.scheduled_at) <= ${startedTo}::timestamptz
        )
      group by
        ls.id, ls.title, ls.status, ls.course_id, c.title, ls.batch_id, b.name,
        ls.scheduled_at, ls.started_at, ls.ended_at
      having (
        ${minAttendedValue}::int is null
        or count(la.id) filter (where la.status = 'attended') >= ${minAttendedValue}::int
      )
    ),
    tenant_avg as (
      select
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as tenant_avg_rate
      from session_rows
    ),
    course_avg as (
      select
        course_uuid,
        case
          when coalesce(sum(total_count), 0) = 0 then null
          else round((sum(attended_count)::numeric / nullif(sum(total_count), 0)) * 100, 1)::float8
        end as course_avg_rate
      from session_rows
      where course_uuid is not null
      group by course_uuid
    )
    select
      sr.session_id,
      sr.title,
      sr.status,
      sr.course_id,
      sr.course_title,
      sr.batch_id,
      sr.batch_name,
      sr.scheduled_at,
      sr.started_at,
      sr.ended_at,
      sr.duration_seconds,
      sr.attended_count,
      sr.registered_count,
      sr.absent_count,
      sr.total_count,
      sr.avg_duration_seconds,
      sr.attendance_rate,
      ta.tenant_avg_rate,
      ca.course_avg_rate
    from session_rows sr
    cross join tenant_avg ta
    left join course_avg ca on ca.course_uuid = sr.course_uuid
    order by sr.scheduled_at desc nulls last
    limit ${REPORT_ROW_CAP}
  `;

  const columns = [
    "session_id",
    "title",
    "status",
    "course_id",
    "course_title",
    "batch_id",
    "batch_name",
    "scheduled_at",
    "started_at",
    "ended_at",
    "duration_seconds",
    "attended_count",
    "registered_count",
    "absent_count",
    "total_count",
    "avg_duration_seconds",
    "attendance_rate",
  ];
  if (includeBenchmarks) {
    columns.push("tenant_avg_rate", "course_avg_rate");
  }
  return mapRows(rows, columns);
}

async function queryAssessmentItems(tx: TenantTx): Promise<ReportDatasetResult> {
  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      is2.item_id::text as item_id,
      is2.window_key,
      is2.attempts_count,
      is2.correct_count,
      is2.avg_latency_ms,
      is2.calculated_at
    from item_statistics is2
    where is2.tenant_id = current_setting('app.tenant_id', true)::uuid
    order by is2.calculated_at desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "item_id",
    "window_key",
    "attempts_count",
    "correct_count",
    "avg_latency_ms",
    "calculated_at",
  ]);
}

async function queryCertificates(tx: TenantTx): Promise<ReportDatasetResult> {
  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      c.id::text as certificate_id,
      c.membership_id::text as membership_id,
      c.status,
      c.issued_at,
      c.expires_at,
      c.revoked_at
    from certificates c
    where c.tenant_id = current_setting('app.tenant_id', true)::uuid
    order by c.issued_at desc nulls last
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "certificate_id",
    "membership_id",
    "status",
    "issued_at",
    "expires_at",
    "revoked_at",
  ]);
}

async function queryAtRiskRoster(
  tx: TenantTx,
  params: DatasetParams,
): Promise<ReportDatasetResult> {
  const status = asString(params["status"]) ?? "open";

  const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
    select
      aa.id::text as alert_id,
      ar.key as rule_key,
      ar.name as rule_name,
      aa.membership_id::text as membership_id,
      aa.status,
      aa.triggered_at,
      aa.acknowledged_at
    from at_risk_alerts aa
    join at_risk_rules ar on ar.id = aa.at_risk_rule_id and ar.tenant_id = aa.tenant_id
    where aa.tenant_id = current_setting('app.tenant_id', true)::uuid
      and aa.status = ${status}
    order by aa.triggered_at desc
    limit ${REPORT_ROW_CAP}
  `;

  return mapRows(rows, [
    "alert_id",
    "rule_key",
    "rule_name",
    "membership_id",
    "status",
    "triggered_at",
    "acknowledged_at",
  ]);
}

const DATASET_BUILDERS: Record<
  string,
  (tx: TenantTx, params: DatasetParams) => Promise<ReportDatasetResult>
> = {
  enrollments: queryEnrollments,
  "progress-score": queryProgressScore,
  "resource-usage": queryResourceUsage,
  exports: queryExports,
  "active-devices": queryActiveDevices,
  payments: queryPayments,
  batches: queryBatches,
  polls: queryPolls,
  "sales-marketing": querySalesMarketing,
  "custom-field": queryCustomField,
  "zoom-insights": queryZoomInsights,
  "live-class-attendance": queryLiveClassAttendance,
  "super-live-insights": querySuperLiveInsights,
  "assessment-items": queryAssessmentItems,
  certificates: queryCertificates,
  "at-risk-roster": queryAtRiskRoster,
};

export async function buildReportDataset(
  tx: TenantTx,
  args: {
    datasetKey: string;
    params: DatasetParams;
  },
): Promise<ReportDatasetResult> {
  const builder = DATASET_BUILDERS[args.datasetKey];
  if (!builder) {
    throw new Error(`UNKNOWN_REPORT_DATASET:${args.datasetKey}`);
  }

  return builder(tx, args.params);
}

export { DATASET_BUILDERS };
