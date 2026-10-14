import type { TenantTx } from "@atlas/db";
import type { BatchExamAssessmentRow, BatchExamsSummaryRow } from "./batches-roster.repository";
import { asUnknownString } from "./batches-roster.repository-helpers";

/**
 * A batch's exams: assessments, summary, matrix and learners below the pass mark.
 * Part of batchesRosterRepository.
 */
export const batchesRosterExamsRepository = {
  async listBatchExamAssessments(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
    query: {
      q?: string;
      sortBy: "released_at" | "title" | "attempted_pct" | "avg_score" | "pass_rate";
      sortDir: "asc" | "desc";
    },
  ): Promise<BatchExamAssessmentRow[]> {
    if (!courseId) return [];

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      base as (
        select
          a.id as assessment_id,
          a.title,
          a.assessment_type,
          a.created_at as released_at,
          coalesce(nullif(a.config_json->>'passMarkPercent', '')::float, 70)::float as pass_mark
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        group by a.id, a.title, a.assessment_type, a.created_at, a.config_json
      ),
      latest as (
        select distinct on (b.assessment_id, at.membership_id)
          b.assessment_id,
          at.membership_id,
          at.score_pct,
          at.status::text as attempt_status,
          b.pass_mark
        from base b
        join attempts at
          on at.assessment_id = b.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by b.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      scored as (
        select
          assessment_id,
          score_pct
        from latest
        where score_pct is not null
      ),
      metrics as (
        select
          b.assessment_id::text as assessment_id,
          b.title,
          b.assessment_type,
          b.released_at,
          b.pass_mark as pass_mark_pct,
          ${rosterCount}::int as roster_count,
          (
            select count(distinct l.membership_id)::int
            from latest l
            where l.assessment_id = b.assessment_id
          ) as attempted_count,
          (
            select round(avg(s.score_pct)::numeric, 1)::float
            from scored s
            where s.assessment_id = b.assessment_id
          ) as avg_score_pct,
          (
            select
              case
                when count(*) = 0 then null
                else round(
                  (
                    count(*) filter (where s.score_pct >= b.pass_mark)::numeric
                    / count(*)::numeric
                  ) * 100,
                  1
                )::float
              end
            from scored s
            where s.assessment_id = b.assessment_id
          ) as pass_rate_pct,
          (
            select max(s.score_pct)::float
            from scored s
            where s.assessment_id = b.assessment_id
          ) as high_score_pct,
          (
            select min(s.score_pct)::float
            from scored s
            where s.assessment_id = b.assessment_id
          ) as low_score_pct,
          (
            select count(*)::int
            from latest l
            where l.assessment_id = b.assessment_id
              and l.attempt_status = 'SUBMITTED'
              and l.score_pct is null
          ) as awaiting_grading_count,
          (
            select percentile_cont(0.25) within group (order by s.score_pct)
            from scored s
            where s.assessment_id = b.assessment_id
          )::float as q1,
          (
            select percentile_cont(0.5) within group (order by s.score_pct)
            from scored s
            where s.assessment_id = b.assessment_id
          )::float as median,
          (
            select percentile_cont(0.75) within group (order by s.score_pct)
            from scored s
            where s.assessment_id = b.assessment_id
          )::float as q3
        from base b
      )
      select *
      from metrics
      order by
        case when ${query.sortBy} = 'title' and ${query.sortDir} = 'asc' then title end asc nulls last,
        case when ${query.sortBy} = 'title' and ${query.sortDir} = 'desc' then title end desc nulls last,
        case
          when ${query.sortBy} = 'attempted_pct' and ${query.sortDir} = 'asc'
          then case when ${rosterCount}::int > 0 then attempted_count::numeric / ${rosterCount}::numeric else null end
        end asc nulls last,
        case
          when ${query.sortBy} = 'attempted_pct' and ${query.sortDir} = 'desc'
          then case when ${rosterCount}::int > 0 then attempted_count::numeric / ${rosterCount}::numeric else null end
        end desc nulls last,
        case when ${query.sortBy} = 'avg_score' and ${query.sortDir} = 'asc' then avg_score_pct end asc nulls last,
        case when ${query.sortBy} = 'avg_score' and ${query.sortDir} = 'desc' then avg_score_pct end desc nulls last,
        case when ${query.sortBy} = 'pass_rate' and ${query.sortDir} = 'asc' then pass_rate_pct end asc nulls last,
        case when ${query.sortBy} = 'pass_rate' and ${query.sortDir} = 'desc' then pass_rate_pct end desc nulls last,
        case when ${query.sortBy} = 'released_at' and ${query.sortDir} = 'asc' then released_at end asc nulls last,
        case when ${query.sortBy} = 'released_at' and ${query.sortDir} = 'desc' then released_at end desc nulls last,
        released_at asc nulls last
    `;

    return rows.map((row) => {
      const passRate = row["pass_rate_pct"] == null ? null : Number(row["pass_rate_pct"]);
      const passMark = row["pass_mark_pct"] == null ? 70 : Number(row["pass_mark_pct"]);
      let health_rail: "none" | "success" | "warning" | "danger" = "none";
      if (passRate != null) {
        if (passRate >= 70) health_rail = "success";
        else if (passRate >= 50) health_rail = "warning";
        else health_rail = "danger";
      } else if (Number(row["awaiting_grading_count"] ?? 0) > 0) {
        health_rail = "warning";
      }

      const attempted = Number(row["attempted_count"] ?? 0);
      return {
        assessment_id: asUnknownString(row["assessment_id"]),
        title: asUnknownString(row["title"], "Assessment"),
        assessment_type: asUnknownString(row["assessment_type"], "QUIZ"),
        released_at: row["released_at"] instanceof Date ? row["released_at"] : null,
        pass_mark_pct: passMark,
        roster_count: rosterCount,
        attempted_count: attempted,
        attempted_pct: rosterCount > 0 ? Math.round((attempted / rosterCount) * 1000) / 10 : null,
        avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
        pass_rate_pct: passRate,
        high_score_pct: row["high_score_pct"] == null ? null : Number(row["high_score_pct"]),
        low_score_pct: row["low_score_pct"] == null ? null : Number(row["low_score_pct"]),
        awaiting_grading_count: Number(row["awaiting_grading_count"] ?? 0),
        health_rail,
        dist_min: row["low_score_pct"] == null ? null : Number(row["low_score_pct"]),
        dist_q1: row["q1"] == null ? null : Number(row["q1"]),
        dist_median: row["median"] == null ? null : Number(row["median"]),
        dist_q3: row["q3"] == null ? null : Number(row["q3"]),
        dist_max: row["high_score_pct"] == null ? null : Number(row["high_score_pct"]),
      };
    });
  },

  async summarizeBatchExams(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    rosterCount: number,
  ): Promise<BatchExamsSummaryRow> {
    if (!courseId) {
      return {
        avg_score_pct: null,
        pass_mark_pct: 70,
        pass_rate_pct: null,
        passed_learner_count: 0,
        roster_count: rosterCount,
        attempt_count: 0,
        attempts_per_learner: null,
        awaiting_grading_count: 0,
        not_attempted_count: rosterCount,
        assessment_count: 0,
      };
    }

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      assessments as (
        select distinct a.id as assessment_id,
          coalesce(nullif(a.config_json->>'passMarkPercent', '')::float, 70)::float as pass_mark
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
      ),
      latest as (
        select distinct on (a.assessment_id, at.membership_id)
          a.assessment_id,
          at.membership_id,
          at.score_pct,
          at.status::text as attempt_status,
          a.pass_mark
        from assessments a
        join attempts at
          on at.assessment_id = a.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by a.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      learner_avg as (
        select
          membership_id,
          avg(score_pct) filter (where score_pct is not null) as avg_score
        from latest
        group by membership_id
      ),
      all_attempts as (
        select count(*)::int as attempt_count
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
          and exists (select 1 from assessments a where a.assessment_id = at.assessment_id)
      )
      select
        (select count(*)::int from assessments) as assessment_count,
        (select attempt_count from all_attempts) as attempt_count,
        (
          select coalesce(round(avg(a.pass_mark)::numeric, 0)::float, 70)
          from assessments a
        ) as pass_mark_pct,
        (
          select round(avg(la.avg_score)::numeric, 1)::float
          from learner_avg la
          where la.avg_score is not null
        ) as avg_score_pct,
        (
          select count(*)::int
          from learner_avg la
          where la.avg_score is not null
            and la.avg_score >= (
              select coalesce(avg(a.pass_mark), 70) from assessments a
            )
        ) as passed_learner_count,
        (
          select count(*)::int
          from latest l
          where l.attempt_status = 'SUBMITTED' and l.score_pct is null
        ) as awaiting_grading_count,
        (
          select count(*)::int
          from roster r
          where not exists (
            select 1 from latest l where l.membership_id = r.membership_id
          )
        ) as not_attempted_count
    `;

    const row = rows[0] ?? {};
    const attemptCount = Number(row["attempt_count"] ?? 0);
    const passed = Number(row["passed_learner_count"] ?? 0);
    const passMarkPct = Number(row["pass_mark_pct"] ?? 70);
    const learnersWithScores = await tx.$queryRaw<Array<{ count: number }>>`
      with roster as (
        select bm.membership_id from batch_memberships bm where bm.batch_id = ${batchId}::uuid
      ),
      assessments as (
        select distinct a.id as assessment_id
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
      ),
      latest as (
        select distinct on (a.assessment_id, at.membership_id)
          at.membership_id,
          at.score_pct
        from assessments a
        join attempts at on at.assessment_id = a.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by a.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      learner_avg as (
        select membership_id, avg(score_pct) filter (where score_pct is not null) as avg_score
        from latest
        group by membership_id
        having avg(score_pct) filter (where score_pct is not null) is not null
      )
      select count(*)::int as count from learner_avg
    `;
    const withScores = learnersWithScores[0]?.count ?? 0;

    return {
      avg_score_pct: row["avg_score_pct"] == null ? null : Number(row["avg_score_pct"]),
      pass_mark_pct: passMarkPct,
      pass_rate_pct: withScores > 0 ? Math.round((passed / withScores) * 1000) / 10 : null,
      passed_learner_count: passed,
      roster_count: rosterCount,
      attempt_count: attemptCount,
      attempts_per_learner:
        rosterCount > 0 ? Math.round((attemptCount / rosterCount) * 10) / 10 : null,
      awaiting_grading_count: Number(row["awaiting_grading_count"] ?? 0),
      not_attempted_count: Number(row["not_attempted_count"] ?? 0),
      assessment_count: Number(row["assessment_count"] ?? 0),
    };
  },

  async listBatchExamsMatrix(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    query: { q?: string; limitLearners: number },
  ): Promise<{
    assessments: Array<{
      assessment_id: string;
      title: string;
      avg_score_pct: number | null;
    }>;
    learners: Array<{
      membership_id: string;
      learner_name: string | null;
      email: string | null;
      cells: Array<{
        assessment_id: string;
        kind: "passed" | "failed" | "awaiting" | "not_attempted";
        score_pct: number | null;
        attempt_count: number;
      }>;
      avg_score_pct: number | null;
      health_rail: "none" | "success" | "warning" | "danger";
    }>;
    pass_mark_pct: number;
  }> {
    if (!courseId) {
      return { assessments: [], learners: [], pass_mark_pct: 70 };
    }

    const assessmentRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        a.id::text as assessment_id,
        a.title,
        coalesce(nullif(a.config_json->>'passMarkPercent', '')::float, 70)::float as pass_mark
      from assessments a
      join lessons l on l.tenant_id = a.tenant_id
        and l.deleted_at is null
        and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
      join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
      where a.tenant_id = current_setting('app.tenant_id', true)::uuid
        and a.deleted_at is null
        and cm.course_id = ${courseId}::uuid
      group by a.id, a.title, a.config_json, a.created_at
      order by a.created_at asc
      limit 40
    `;

    const assessmentsMeta = assessmentRows.map((row) => ({
      assessment_id: asUnknownString(row["assessment_id"]),
      title: asUnknownString(row["title"], "Assessment"),
      pass_mark: Number(row["pass_mark"] ?? 70),
    }));

    if (assessmentsMeta.length === 0) {
      return { assessments: [], learners: [], pass_mark_pct: 70 };
    }

    const assessmentIds = assessmentsMeta.map((a) => a.assessment_id);

    const learnerRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        bm.membership_id::text as membership_id,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from batch_memberships bm
      join memberships m on m.id = bm.membership_id and m.tenant_id = bm.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where bm.batch_id = ${batchId}::uuid
        and (
          ${query.q ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${query.q ?? null}) || '%'
        )
      order by lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, bm.membership_id::text))
      limit ${query.limitLearners}
    `;

    const attemptRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select
        at.membership_id::text as membership_id,
        at.assessment_id::text as assessment_id,
        at.score_pct,
        at.status::text as attempt_status,
        count(*) over (partition by at.membership_id, at.assessment_id) as attempt_count,
        row_number() over (
          partition by at.membership_id, at.assessment_id
          order by coalesce(at.submitted_at, at.graded_at, at.started_at) desc
        ) as rn
      from attempts at
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and at.status::text <> 'VOIDED'
        and at.assessment_id = any(${assessmentIds}::uuid[])
        and exists (
          select 1 from batch_memberships bm
          where bm.batch_id = ${batchId}::uuid and bm.membership_id = at.membership_id
        )
    `;

    const latestByMember = new Map<
      string,
      Map<string, { score: number | null; status: string; attempts: number }>
    >();
    for (const row of attemptRows) {
      if (Number(row["rn"]) !== 1) continue;
      const membershipId = asUnknownString(row["membership_id"]);
      const assessmentId = asUnknownString(row["assessment_id"]);
      const bucket =
        latestByMember.get(membershipId) ??
        new Map<string, { score: number | null; status: string; attempts: number }>();
      bucket.set(assessmentId, {
        score: row["score_pct"] == null ? null : Number(row["score_pct"]),
        status: asUnknownString(row["attempt_status"], ""),
        attempts: Number(row["attempt_count"] ?? 1),
      });
      latestByMember.set(membershipId, bucket);
    }

    const assessmentAvgs = new Map<string, number | null>();
    for (const assessment of assessmentsMeta) {
      const scores: number[] = [];
      for (const [, cells] of latestByMember) {
        const cell = cells.get(assessment.assessment_id);
        if (cell?.score != null) scores.push(cell.score);
      }
      assessmentAvgs.set(
        assessment.assessment_id,
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null,
      );
    }

    const passMark = 70;
    const learners = learnerRows.map((row) => {
      const membershipId = asUnknownString(row["membership_id"]);
      const memberAttempts =
        latestByMember.get(membershipId) ??
        new Map<string, { score: number | null; status: string; attempts: number }>();
      const scores: number[] = [];
      const cells = assessmentsMeta.map((assessment) => {
        const attempt = memberAttempts.get(assessment.assessment_id);
        if (!attempt) {
          return {
            assessment_id: assessment.assessment_id,
            kind: "not_attempted" as const,
            score_pct: null,
            attempt_count: 0,
          };
        }
        if (attempt.score == null) {
          return {
            assessment_id: assessment.assessment_id,
            kind: "awaiting" as const,
            score_pct: null,
            attempt_count: attempt.attempts,
          };
        }
        scores.push(attempt.score);
        return {
          assessment_id: assessment.assessment_id,
          kind: attempt.score >= assessment.pass_mark ? ("passed" as const) : ("failed" as const),
          score_pct: attempt.score,
          attempt_count: attempt.attempts,
        };
      });
      const avg =
        scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : null;
      let health_rail: "none" | "success" | "warning" | "danger" = "none";
      if (avg != null) {
        if (avg >= passMark) health_rail = "success";
        else if (avg >= passMark - 15) health_rail = "warning";
        else health_rail = "danger";
      }

      return {
        membership_id: membershipId,
        learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
        email: typeof row["email"] === "string" ? row["email"] : null,
        cells,
        avg_score_pct: avg,
        health_rail,
      };
    });

    return {
      assessments: assessmentsMeta.map((a) => ({
        assessment_id: a.assessment_id,
        title: a.title,
        avg_score_pct: assessmentAvgs.get(a.assessment_id) ?? null,
      })),
      learners,
      pass_mark_pct: passMark,
    };
  },

  async listBatchExamsBelowPassMembershipIds(
    tx: TenantTx,
    batchId: string,
    courseId: string | null,
    passMarkPct = 70,
  ): Promise<string[]> {
    if (!courseId) return [];

    const rows = await tx.$queryRaw<Array<{ membership_id: string }>>`
      with roster as (
        select bm.membership_id
        from batch_memberships bm
        where bm.batch_id = ${batchId}::uuid
      ),
      assessments as (
        select distinct a.id as assessment_id
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${courseId}::uuid
      ),
      latest as (
        select distinct on (a.assessment_id, at.membership_id)
          at.membership_id,
          at.score_pct
        from assessments a
        join attempts at on at.assessment_id = a.assessment_id
          and at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.status::text <> 'VOIDED'
          and exists (select 1 from roster r where r.membership_id = at.membership_id)
        order by a.assessment_id, at.membership_id,
          coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      learner_avg as (
        select
          membership_id,
          avg(score_pct) filter (where score_pct is not null) as avg_score
        from latest
        group by membership_id
      )
      select membership_id::text as membership_id
      from learner_avg
      where avg_score is not null and avg_score < ${passMarkPct}
      order by avg_score asc
    `;
    return rows.map((row) => row.membership_id);
  },
};
