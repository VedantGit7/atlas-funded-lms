import type { TenantTx } from "@atlas/db";
import type { ProgressProductType } from "./progress-score-roster.dto";

export type LearnerDetailHeaderRow = {
  enrollment_id: string;
  membership_id: string;
  product_id: string;
  product_title: string;
  display_name: string | null;
  email: string | null;
  avatar_key: string | null;
  enrolled_type: string;
  status: string;
  enrolled_at: Date;
  expires_at: Date | null;
  completed_at: Date | null;
};

export type LearnerDetailLessonRow = {
  lesson_id: string;
  module_id: string;
  module_title: string;
  module_position: number;
  lesson_title: string;
  lesson_position: number;
  lesson_type: "video" | "quiz" | "reading" | "interactive" | "other";
  duration_seconds: number | null;
  assessment_id: string | null;
  progress_status: string | null;
  progress_pct: number | null;
  completed_at: Date | null;
  last_seen_at: Date | null;
  quiz_score_pct: number | null;
  quiz_attempt_id: string | null;
};

export type LearnerDetailActivityDayRow = {
  activity_date: Date;
  event_count: number;
};

export type LearnerDetailAssessmentRow = {
  assessment_id: string;
  title: string;
  score_pct: number | null;
  result_status: "pass" | "fail" | "pending" | "in_progress";
  attempt_number: number | null;
  attempt_id: string | null;
  submitted_at: Date | null;
};

export type LearnerDetailCertificateRow = {
  issued: boolean;
  issued_at: Date | null;
  credential_id: string | null;
};

function asDate(value: unknown): Date | null {
  return value instanceof Date ? value : null;
}

function asNumber(value: unknown): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapHeader(row: Record<string, unknown>): LearnerDetailHeaderRow {
  return {
    enrollment_id: String(row["enrollment_id"]),
    membership_id: String(row["membership_id"]),
    product_id: String(row["product_id"]),
    product_title: String(row["product_title"] ?? ""),
    display_name: row["display_name"] == null ? null : String(row["display_name"]),
    email: row["email"] == null ? null : String(row["email"]),
    avatar_key: row["avatar_key"] == null ? null : String(row["avatar_key"]),
    enrolled_type: String(row["enrolled_type"] ?? "free"),
    status: String(row["status"] ?? "active"),
    enrolled_at: row["enrolled_at"] instanceof Date ? row["enrolled_at"] : new Date(),
    expires_at: asDate(row["expires_at"]),
    completed_at: asDate(row["completed_at"]),
  };
}

export const progressScoreLearnerDetailRepository = {
  async getEnrollmentHeader(
    tx: TenantTx,
    productType: ProgressProductType,
    productId: string,
    enrollmentId: string,
  ): Promise<LearnerDetailHeaderRow | null> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          e.id::text as enrollment_id,
          e.membership_id::text as membership_id,
          c.id::text as product_id,
          c.title as product_title,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          mp.avatar_key,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          e.completed_at
        from enrollments e
        join courses c on c.id = e.course_id and c.tenant_id = e.tenant_id and c.deleted_at is null
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.id = ${enrollmentId}::uuid
          and e.course_id = ${productId}::uuid
        limit 1
      `;
      return rows[0] ? mapHeader(rows[0]) : null;
    }

    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          e.id::text as enrollment_id,
          e.membership_id::text as membership_id,
          ts.id::text as product_id,
          ts.title as product_title,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          mp.avatar_key,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          null::timestamptz as completed_at
        from test_series_enrollments e
        join test_series ts on ts.id = e.test_series_id and ts.tenant_id = e.tenant_id and ts.deleted_at is null
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.id = ${enrollmentId}::uuid
          and e.test_series_id = ${productId}::uuid
        limit 1
      `;
      return rows[0] ? mapHeader(rows[0]) : null;
    }

    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          e.id::text as enrollment_id,
          e.membership_id::text as membership_id,
          b.id::text as product_id,
          b.title as product_title,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          mp.avatar_key,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          null::timestamptz as completed_at
        from bundle_enrollments e
        join bundles b on b.id = e.bundle_id and b.tenant_id = e.tenant_id and b.deleted_at is null
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.id = ${enrollmentId}::uuid
          and e.bundle_id = ${productId}::uuid
        limit 1
      `;
      return rows[0] ? mapHeader(rows[0]) : null;
    }

    if (productType === "subscription") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          e.id::text as enrollment_id,
          e.membership_id::text as membership_id,
          p.id::text as product_id,
          p.title as product_title,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          mp.avatar_key,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          null::timestamptz as completed_at
        from learner_subscription_enrollments e
        join learner_subscription_plans p
          on p.id = e.plan_id and p.tenant_id = e.tenant_id and p.deleted_at is null
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.id = ${enrollmentId}::uuid
          and e.plan_id = ${productId}::uuid
        limit 1
      `;
      return rows[0] ? mapHeader(rows[0]) : null;
    }

    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        select
          e.id::text as enrollment_id,
          e.membership_id::text as membership_id,
          mt.id::text as product_id,
          mt.title as product_title,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as display_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          mp.avatar_key,
          e.enrolled_type,
          e.status,
          e.enrolled_at,
          e.expires_at,
          null::timestamptz as completed_at
        from mock_test_enrollments e
        join mock_tests mt on mt.id = e.mock_test_id and mt.tenant_id = e.tenant_id and mt.deleted_at is null
        join memberships m on m.id = e.membership_id and m.tenant_id = e.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where e.tenant_id = current_setting('app.tenant_id', true)::uuid
          and e.id = ${enrollmentId}::uuid
          and e.mock_test_id = ${productId}::uuid
        limit 1
      `;
      return rows[0] ? mapHeader(rows[0]) : null;
    }

    return null;
  },

  async listCourseCurriculumProgress(
    tx: TenantTx,
    courseId: string,
    membershipId: string,
  ): Promise<LearnerDetailLessonRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_lessons as (
        select
          l.id as lesson_id,
          m.id as module_id,
          m.title as module_title,
          m.position as module_position,
          l.title as lesson_title,
          l.position as lesson_position,
          l.duration_seconds,
          l.video_provider,
          l.video_url,
          l.content_json,
          coalesce(
            nullif(l.content_json->'content'->>'assessmentId', ''),
            nullif(l.content_json->>'assessmentId', '')
          ) as assessment_id_text
        from lessons l
        join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${courseId}::uuid
          and l.tenant_id = current_setting('app.tenant_id', true)::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      typed as (
        select
          cl.*,
          case
            when coalesce(cl.content_json->>'type', cl.content_json->>'lessonType', '') = 'section_quiz'
              or (cl.assessment_id_text ~ '^[0-9a-fA-F-]{36}$')
              then 'quiz'
            when coalesce(cl.content_json->>'type', cl.content_json->>'lessonType', '') in ('video', 'audio')
              or nullif(trim(coalesce(cl.video_url, '')), '') is not null
              or nullif(trim(coalesce(cl.video_provider, '')), '') is not null
              then 'video'
            when coalesce(cl.content_json->>'type', cl.content_json->>'lessonType', '')
              in ('article', 'text', 'pdf', 'slides')
              or nullif(trim(coalesce(cl.content_json->>'body', '')), '') is not null
              then 'reading'
            when coalesce(cl.content_json->>'type', cl.content_json->>'lessonType', '')
              in ('live', 'scorm', 'assignment', 'interactive')
              then 'interactive'
            else 'other'
          end as lesson_type,
          case
            when cl.assessment_id_text ~ '^[0-9a-fA-F-]{36}$'
              then cl.assessment_id_text::uuid
            else null
          end as assessment_id
        from course_lessons cl
      ),
      latest_quiz as (
        select distinct on (at.assessment_id)
          at.assessment_id,
          at.id as attempt_id,
          at.score_pct
        from attempts at
        join typed t on t.assessment_id = at.assessment_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.membership_id = ${membershipId}::uuid
          and at.status::text in ('SUBMITTED', 'GRADED')
        order by at.assessment_id, at.started_at desc
      )
      select
        t.lesson_id::text,
        t.module_id::text,
        t.module_title,
        t.module_position,
        t.lesson_title,
        t.lesson_position,
        t.lesson_type,
        t.duration_seconds,
        t.assessment_id::text as assessment_id,
        lp.status as progress_status,
        lp.progress_pct,
        lp.completed_at,
        lp.last_seen_at,
        lq.score_pct as quiz_score_pct,
        lq.attempt_id::text as quiz_attempt_id
      from typed t
      left join lesson_progress lp
        on lp.lesson_id = t.lesson_id
        and lp.membership_id = ${membershipId}::uuid
        and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
      left join latest_quiz lq on lq.assessment_id = t.assessment_id
      order by t.module_position asc, t.lesson_position asc, t.lesson_id asc
    `;

    return rows.map((row) => ({
      lesson_id: String(row["lesson_id"]),
      module_id: String(row["module_id"]),
      module_title: String(row["module_title"] ?? ""),
      module_position: Number(row["module_position"] ?? 0),
      lesson_title: String(row["lesson_title"] ?? ""),
      lesson_position: Number(row["lesson_position"] ?? 0),
      lesson_type: (row["lesson_type"] as LearnerDetailLessonRow["lesson_type"]) ?? "other",
      duration_seconds: asNumber(row["duration_seconds"]),
      assessment_id: row["assessment_id"] == null ? null : String(row["assessment_id"]),
      progress_status: row["progress_status"] == null ? null : String(row["progress_status"]),
      progress_pct: asNumber(row["progress_pct"]),
      completed_at: asDate(row["completed_at"]),
      last_seen_at: asDate(row["last_seen_at"]),
      quiz_score_pct: asNumber(row["quiz_score_pct"]),
      quiz_attempt_id: row["quiz_attempt_id"] == null ? null : String(row["quiz_attempt_id"]),
    }));
  },

  async listActivityDays(
    tx: TenantTx,
    courseId: string,
    membershipId: string,
    days = 84,
  ): Promise<LearnerDetailActivityDayRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_lessons as (
        select l.id
        from lessons l
        join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${courseId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      day_series as (
        select generate_series(
          (current_date - (${days}::int - 1)),
          current_date,
          interval '1 day'
        )::date as activity_date
      ),
      events as (
        select date_trunc('day', coalesce(lp.last_seen_at, lp.updated_at))::date as activity_date,
          count(*)::int as event_count
        from lesson_progress lp
        join course_lessons cl on cl.id = lp.lesson_id
        where lp.membership_id = ${membershipId}::uuid
          and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
          and coalesce(lp.last_seen_at, lp.updated_at) >= (current_date - (${days}::int - 1))
        group by 1
      )
      select
        ds.activity_date,
        coalesce(e.event_count, 0)::int as event_count
      from day_series ds
      left join events e on e.activity_date = ds.activity_date
      order by ds.activity_date asc
    `;

    return rows.map((row) => ({
      activity_date: row["activity_date"] instanceof Date ? row["activity_date"] : new Date(),
      event_count: Number(row["event_count"] ?? 0),
    }));
  },

  async listCourseAssessmentsForLearner(
    tx: TenantTx,
    courseId: string,
    membershipId: string,
  ): Promise<LearnerDetailAssessmentRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with course_assessments as (
        select distinct
          coalesce(
            l.content_json->'content'->>'assessmentId',
            l.content_json->>'assessmentId'
          )::uuid as assessment_id
        from lessons l
        join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${courseId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
          and coalesce(
            l.content_json->'content'->>'assessmentId',
            l.content_json->>'assessmentId'
          ) ~ '^[0-9a-fA-F-]{36}$'
      ),
      attempt_counts as (
        select at.assessment_id, count(*)::int as attempt_count
        from attempts at
        join course_assessments ca on ca.assessment_id = at.assessment_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.membership_id = ${membershipId}::uuid
          and at.status::text <> 'VOIDED'
        group by at.assessment_id
      ),
      latest as (
        select distinct on (at.assessment_id)
          at.assessment_id,
          at.id as attempt_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at
        from attempts at
        join course_assessments ca on ca.assessment_id = at.assessment_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.membership_id = ${membershipId}::uuid
          and at.status::text <> 'VOIDED'
        order by at.assessment_id, at.started_at desc
      )
      select
        a.id::text as assessment_id,
        a.title,
        lt.score_pct,
        case
          when lt.attempt_id is null then 'pending'
          when lt.attempt_status = 'STARTED' then 'in_progress'
          when lt.score_pct is null then 'pending'
          when nullif(a.config_json->>'passMarkPercent', '')::float is not null
            and lt.score_pct >= nullif(a.config_json->>'passMarkPercent', '')::float then 'pass'
          when nullif(a.config_json->>'passMarkPercent', '')::float is not null then 'fail'
          else 'pending'
        end as result_status,
        ac.attempt_count as attempt_number,
        lt.attempt_id::text as attempt_id,
        lt.submitted_at
      from course_assessments ca
      join assessments a on a.id = ca.assessment_id and a.tenant_id = current_setting('app.tenant_id', true)::uuid
      left join latest lt on lt.assessment_id = ca.assessment_id
      left join attempt_counts ac on ac.assessment_id = ca.assessment_id
      where a.deleted_at is null
      order by a.title asc
    `;

    return rows.map((row) => ({
      assessment_id: String(row["assessment_id"]),
      title: String(row["title"] ?? ""),
      score_pct: asNumber(row["score_pct"]),
      result_status: (row["result_status"] as LearnerDetailAssessmentRow["result_status"]) ?? "pending",
      attempt_number: asNumber(row["attempt_number"]),
      attempt_id: row["attempt_id"] == null ? null : String(row["attempt_id"]),
      submitted_at: asDate(row["submitted_at"]),
    }));
  },

  async getCourseCertificate(
    tx: TenantTx,
    courseId: string,
    membershipId: string,
  ): Promise<LearnerDetailCertificateRow> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        c.issued_at,
        c.credential_id
      from certificates c
      where c.tenant_id = current_setting('app.tenant_id', true)::uuid
        and c.membership_id = ${membershipId}::uuid
        and c.status = 'issued'
        and c.revoked_at is null
        and c.metadata_json->'source'->>'type' = 'course'
        and c.metadata_json->'source'->>'id' = ${courseId}
      order by c.issued_at desc nulls last
      limit 1
    `;
    const row = rows[0];
    if (!row) {
      return { issued: false, issued_at: null, credential_id: null };
    }
    return {
      issued: true,
      issued_at: asDate(row["issued_at"]),
      credential_id: row["credential_id"] == null ? null : String(row["credential_id"]),
    };
  },

  async resetCourseProgress(
    tx: TenantTx,
    courseId: string,
    membershipId: string,
    enrollmentId: string,
    clearAssessmentAttempts: boolean,
  ): Promise<{ lessonsCleared: number; attemptsCleared: number }> {
    const deleted = await tx.$queryRaw<Array<{ count: bigint }>>`
      with course_lessons as (
        select l.id
        from lessons l
        join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
        where m.course_id = ${courseId}::uuid
          and l.deleted_at is null
          and m.deleted_at is null
      ),
      deleted as (
        delete from lesson_progress lp
        using course_lessons cl
        where lp.lesson_id = cl.id
          and lp.membership_id = ${membershipId}::uuid
          and lp.tenant_id = current_setting('app.tenant_id', true)::uuid
        returning lp.id
      )
      select count(*)::bigint as count from deleted
    `;

    await tx.$executeRaw`
      update enrollments
      set completed_at = null
      where id = ${enrollmentId}::uuid
        and tenant_id = current_setting('app.tenant_id', true)::uuid
        and course_id = ${courseId}::uuid
    `;

    let attemptsCleared = 0;
    if (clearAssessmentAttempts) {
      const voided = await tx.$queryRaw<Array<{ count: bigint }>>`
        with course_assessments as (
          select distinct
            coalesce(
              l.content_json->'content'->>'assessmentId',
              l.content_json->>'assessmentId'
            )::uuid as assessment_id
          from lessons l
          join course_modules m on m.id = l.module_id and m.tenant_id = l.tenant_id
          where m.course_id = ${courseId}::uuid
            and l.deleted_at is null
            and m.deleted_at is null
            and coalesce(
              l.content_json->'content'->>'assessmentId',
              l.content_json->>'assessmentId'
            ) ~ '^[0-9a-fA-F-]{36}$'
        ),
        voided as (
          update attempts at
          set status = 'VOIDED'::"AttemptStatus"
          from course_assessments ca
          where at.assessment_id = ca.assessment_id
            and at.membership_id = ${membershipId}::uuid
            and at.tenant_id = current_setting('app.tenant_id', true)::uuid
            and at.status::text <> 'VOIDED'
          returning at.id
        )
        select count(*)::bigint as count from voided
      `;
      attemptsCleared = Number(voided[0]?.count ?? 0);
    }

    return {
      lessonsCleared: Number(deleted[0]?.count ?? 0),
      attemptsCleared,
    };
  },

  async extendEnrollmentAccess(
    tx: TenantTx,
    productType: ProgressProductType,
    productId: string,
    enrollmentId: string,
    expiresAt: Date,
  ): Promise<Date | null> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ expires_at: Date | null }>>`
        update enrollments
        set expires_at = ${expiresAt}
        where id = ${enrollmentId}::uuid
          and course_id = ${productId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        returning expires_at
      `;
      return rows[0]?.expires_at ?? null;
    }

    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ expires_at: Date | null }>>`
        update test_series_enrollments
        set expires_at = ${expiresAt}
        where id = ${enrollmentId}::uuid
          and test_series_id = ${productId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        returning expires_at
      `;
      return rows[0]?.expires_at ?? null;
    }

    if (productType === "bundle") {
      const rows = await tx.$queryRaw<Array<{ expires_at: Date | null }>>`
        update bundle_enrollments
        set expires_at = ${expiresAt}
        where id = ${enrollmentId}::uuid
          and bundle_id = ${productId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        returning expires_at
      `;
      return rows[0]?.expires_at ?? null;
    }

    if (productType === "subscription") {
      const rows = await tx.$queryRaw<Array<{ expires_at: Date | null }>>`
        update learner_subscription_enrollments
        set expires_at = ${expiresAt}
        where id = ${enrollmentId}::uuid
          and plan_id = ${productId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        returning expires_at
      `;
      return rows[0]?.expires_at ?? null;
    }

    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ expires_at: Date | null }>>`
        update mock_test_enrollments
        set expires_at = ${expiresAt}
        where id = ${enrollmentId}::uuid
          and mock_test_id = ${productId}::uuid
          and tenant_id = current_setting('app.tenant_id', true)::uuid
        returning expires_at
      `;
      return rows[0]?.expires_at ?? null;
    }

    return null;
  },
};
