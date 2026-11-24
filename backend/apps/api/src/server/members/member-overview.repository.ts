import type { TenantTx } from "@atlas/db";

/** Reads for the admin member page. Every query is scoped by RLS to the tenant. */
export const memberOverviewRepository = {
  async findIdentity(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ email: string | null; last_active_at: Date | null }>>`
      select
        ap.email,
        (
          select max(lp.last_seen_at)
          from lesson_progress lp
          where lp.membership_id = m.id
        ) as last_active_at
      from memberships m
      left join auth_principals ap on ap.id = m.auth_principal_id
      where m.id = ${membershipId}::uuid
      limit 1
    `;
    return rows[0] ?? { email: null, last_active_at: null };
  },

  async listCourses(tx: TenantTx, membershipId: string, limit: number) {
    return tx.$queryRaw<
      Array<{
        enrollment_id: string;
        course_id: string;
        title: string;
        status: string;
        enrolled_at: Date;
        completed_at: Date | null;
        total_lessons: bigint;
        completed_lessons: bigint;
      }>
    >`
      select
        e.id::text as enrollment_id,
        e.course_id::text as course_id,
        c.title,
        e.status,
        e.enrolled_at,
        e.completed_at,
        (
          select count(*)::bigint
          from lessons l
          join course_modules cm on cm.id = l.module_id
          where cm.course_id = e.course_id
            and l.deleted_at is null
            and cm.deleted_at is null
        ) as total_lessons,
        (
          select count(*)::bigint
          from lesson_progress lp
          join lessons l on l.id = lp.lesson_id
          join course_modules cm on cm.id = l.module_id
          where cm.course_id = e.course_id
            and lp.membership_id = e.membership_id
            and lp.status = 'completed'
            and l.deleted_at is null
            and cm.deleted_at is null
        ) as completed_lessons
      from enrollments e
      join courses c on c.id = e.course_id
      where e.membership_id = ${membershipId}::uuid
      order by e.enrolled_at desc
      limit ${limit}
    `;
  },

  async listAssessments(tx: TenantTx, membershipId: string, limit: number) {
    return tx.$queryRaw<
      Array<{
        attempt_id: string;
        assessment_title: string;
        status: "SUBMITTED" | "GRADED";
        score_pct: unknown;
        submitted_at: Date | null;
      }>
    >`
      select
        a.id::text as attempt_id,
        s.title as assessment_title,
        a.status::text as status,
        a.score_pct,
        a.submitted_at
      from attempts a
      join assessments s on s.id = a.assessment_id
      where a.membership_id = ${membershipId}::uuid
        and a.status in ('SUBMITTED', 'GRADED')
      order by a.submitted_at desc nulls last, a.started_at desc
      limit ${limit}
    `;
  },

  async countAssessments(tx: TenantTx, membershipId: string) {
    const rows = await tx.$queryRaw<Array<{ taken: bigint; average: unknown }>>`
      select count(*)::bigint as taken, avg(a.score_pct) filter (where a.score_pct is not null) as average
      from attempts a
      where a.membership_id = ${membershipId}::uuid
        and a.status in ('SUBMITTED', 'GRADED')
    `;
    return rows[0] ?? { taken: 0n, average: null };
  },

  async listPayments(tx: TenantTx, membershipId: string, limit: number) {
    return tx.$queryRaw<
      Array<{
        id: string;
        product_title: string | null;
        amount_cents: number;
        currency: string;
        status: string;
        created_at: Date;
        paid_at: Date | null;
      }>
    >`
      select id::text, product_title, amount_cents, currency, status, created_at, paid_at
      from payment_orders
      where membership_id = ${membershipId}::uuid
      order by created_at desc
      limit ${limit}
    `;
  },

  /** Recent events from the learner's own records, newest first. */
  async listActivity(tx: TenantTx, membershipId: string, includePayments: boolean, limit: number) {
    return tx.$queryRaw<Array<{ kind: string; title: string | null; occurred_at: Date }>>`
      select kind, title, occurred_at from (
        select 'enrolled' as kind, c.title, e.enrolled_at as occurred_at
        from enrollments e
        join courses c on c.id = e.course_id
        where e.membership_id = ${membershipId}::uuid
        union all
        select 'lesson_completed', l.title, lp.completed_at
        from lesson_progress lp
        join lessons l on l.id = lp.lesson_id
        where lp.membership_id = ${membershipId}::uuid
          and lp.status = 'completed'
          and lp.completed_at is not null
        union all
        select 'assessment_submitted', s.title, a.submitted_at
        from attempts a
        join assessments s on s.id = a.assessment_id
        where a.membership_id = ${membershipId}::uuid
          and a.submitted_at is not null
        union all
        select 'payment', coalesce(po.product_title, 'Payment'), po.paid_at
        from payment_orders po
        where ${includePayments}
          and po.membership_id = ${membershipId}::uuid
          and po.paid_at is not null
      ) events
      order by occurred_at desc
      limit ${limit}
    `;
  },
};
