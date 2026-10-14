import type { TenantTx } from "@atlas/db";
import type {
  ScoreLearnersQuery,
  ScoreProductType,
  ScoreQuizzesQuery,
} from "./progress-score-roster.dto";
import type {
  ScoreLearnerRow,
  ScoreLearnersFilter,
  ScoreQuizRow,
} from "./progress-score-roster.repository";
import { asUnknownString } from "./progress-score-roster.repository-helpers";

/**
 * Quizzes and learner scores.
 * Part of progressScoreRosterRepository.
 */
export const progressScoreRosterScoresRepository = {
  async countQuizzes(tx: TenantTx, courseId: string, q?: string): Promise<number> {
    return this.countProductQuizzes(tx, "course", courseId, q);
  },

  async countProductQuizzes(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    q?: string,
  ): Promise<number> {
    if (productType === "course") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(distinct a.id)::bigint as count
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${productId}::uuid
          and (
            ${q ?? null}::text is null
            or lower(a.title) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "mock_test") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(*)::bigint as count
        from mock_tests mt
        join assessments a on a.id = mt.assessment_id and a.tenant_id = mt.tenant_id
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.id = ${productId}::uuid
          and mt.deleted_at is null
          and a.deleted_at is null
          and (
            ${q ?? null}::text is null
            or lower(a.title) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    if (productType === "test_series") {
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
        select count(distinct a.id)::bigint as count
        from test_series_items tsi
        join assessments a on a.id = coalesce(
          tsi.assessment_id,
          (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
        ) and a.tenant_id = tsi.tenant_id
        where tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and tsi.test_series_id = ${productId}::uuid
          and a.deleted_at is null
          and (
            ${q ?? null}::text is null
            or lower(a.title) like '%' || lower(${q ?? null}) || '%'
          )
      `;
      return Number(rows[0]?.count ?? 0);
    }
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with bundle_assessments as (
        select distinct a.id
        from bundle_items bi
        join assessments a on a.tenant_id = bi.tenant_id and a.deleted_at is null
        left join lessons l on bi.item_kind = 'course'
          and l.deleted_at is null
          and l.tenant_id = bi.tenant_id
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        left join course_modules cm on bi.item_kind = 'course'
          and cm.id = l.module_id
          and cm.tenant_id = l.tenant_id
          and cm.deleted_at is null
          and cm.course_id = bi.ref_id
        left join mock_tests mt on bi.item_kind = 'mock_test'
          and mt.id = bi.ref_id
          and mt.deleted_at is null
          and mt.assessment_id = a.id
        left join test_series_items tsi on bi.item_kind = 'test_series'
          and tsi.test_series_id = bi.ref_id
          and tsi.tenant_id = bi.tenant_id
          and a.id = coalesce(
            tsi.assessment_id,
            (select mt2.assessment_id from mock_tests mt2 where mt2.id = tsi.mock_test_id and mt2.deleted_at is null)
          )
        where bi.bundle_id = ${productId}::uuid
          and bi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (bi.item_kind = 'course' and cm.id is not null)
            or (bi.item_kind = 'mock_test' and mt.id is not null)
            or (bi.item_kind = 'test_series' and tsi.id is not null)
          )
      )
      select count(*)::bigint as count
      from bundle_assessments ba
      join assessments a on a.id = ba.id
      where (
        ${q ?? null}::text is null
        or lower(a.title) like '%' || lower(${q ?? null}) || '%'
      )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listQuizzes(
    tx: TenantTx,
    courseId: string,
    query: ScoreQuizzesQuery,
  ): Promise<ScoreQuizRow[]> {
    return this.listProductQuizzes(tx, "course", courseId, query);
  },

  async listProductQuizzes(
    tx: TenantTx,
    productType: ScoreProductType,
    productId: string,
    query: ScoreQuizzesQuery,
  ): Promise<ScoreQuizRow[]> {
    const skip = (query.page - 1) * query.limit;
    if (productType === "course") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        select
          a.id::text as assessment_id,
          a.title,
          a.assessment_type,
          min(l.id::text) as lesson_id,
          min(l.title) as lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from assessments a
        join lessons l on l.tenant_id = a.tenant_id
          and l.deleted_at is null
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        join course_modules cm on cm.id = l.module_id and cm.tenant_id = l.tenant_id and cm.deleted_at is null
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = a.id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where a.tenant_id = current_setting('app.tenant_id', true)::uuid
          and a.deleted_at is null
          and cm.course_id = ${productId}::uuid
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        group by a.id, a.title, a.assessment_type, stats.attempt_count, stats.learner_count
        order by a.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    if (productType === "mock_test") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        select
          a.id::text as assessment_id,
          a.title,
          a.assessment_type,
          null::text as lesson_id,
          mt.title as lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from mock_tests mt
        join assessments a on a.id = mt.assessment_id and a.tenant_id = mt.tenant_id
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = a.id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where mt.tenant_id = current_setting('app.tenant_id', true)::uuid
          and mt.id = ${productId}::uuid
          and mt.deleted_at is null
          and a.deleted_at is null
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        order by a.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    if (productType === "test_series") {
      return tx.$queryRaw<ScoreQuizRow[]>`
        select
          a.id::text as assessment_id,
          a.title,
          a.assessment_type,
          null::text as lesson_id,
          coalesce(tsi.title, a.title) as lesson_title,
          coalesce(stats.attempt_count, 0)::int as attempt_count,
          coalesce(stats.learner_count, 0)::int as learner_count
        from test_series_items tsi
        join assessments a on a.id = coalesce(
          tsi.assessment_id,
          (select mt.assessment_id from mock_tests mt where mt.id = tsi.mock_test_id and mt.deleted_at is null)
        ) and a.tenant_id = tsi.tenant_id
        left join lateral (
          select
            count(*)::int as attempt_count,
            count(distinct membership_id)::int as learner_count
          from attempts at
          where at.assessment_id = a.id
            and at.tenant_id = a.tenant_id
        ) stats on true
        where tsi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and tsi.test_series_id = ${productId}::uuid
          and a.deleted_at is null
          and (
            ${query.q ?? null}::text is null
            or lower(a.title) like '%' || lower(${query.q ?? null}) || '%'
          )
        group by a.id, a.title, a.assessment_type, tsi.title, stats.attempt_count, stats.learner_count
        order by a.title asc
        limit ${query.limit}
        offset ${skip}
      `;
    }
    return tx.$queryRaw<ScoreQuizRow[]>`
      with bundle_assessments as (
        select distinct on (a.id)
          a.id as assessment_id,
          a.title,
          a.assessment_type,
          case when bi.item_kind = 'course' then l.id::text else null end as lesson_id,
          coalesce(l.title, mt.title, tsi.title, a.title) as lesson_title
        from bundle_items bi
        join assessments a on a.tenant_id = bi.tenant_id and a.deleted_at is null
        left join lessons l on bi.item_kind = 'course'
          and l.deleted_at is null
          and l.tenant_id = bi.tenant_id
          and coalesce(l.content_json->'content'->>'assessmentId', l.content_json->>'assessmentId') = a.id::text
        left join course_modules cm on bi.item_kind = 'course'
          and cm.id = l.module_id
          and cm.tenant_id = l.tenant_id
          and cm.deleted_at is null
          and cm.course_id = bi.ref_id
        left join mock_tests mt on bi.item_kind = 'mock_test'
          and mt.id = bi.ref_id
          and mt.deleted_at is null
          and mt.assessment_id = a.id
        left join test_series_items tsi on bi.item_kind = 'test_series'
          and tsi.test_series_id = bi.ref_id
          and tsi.tenant_id = bi.tenant_id
          and a.id = coalesce(
            tsi.assessment_id,
            (select mt2.assessment_id from mock_tests mt2 where mt2.id = tsi.mock_test_id and mt2.deleted_at is null)
          )
        where bi.bundle_id = ${productId}::uuid
          and bi.tenant_id = current_setting('app.tenant_id', true)::uuid
          and (
            (bi.item_kind = 'course' and cm.id is not null)
            or (bi.item_kind = 'mock_test' and mt.id is not null)
            or (bi.item_kind = 'test_series' and tsi.id is not null)
          )
        order by a.id, bi.position asc
      )
      select
        ba.assessment_id::text as assessment_id,
        ba.title,
        ba.assessment_type,
        ba.lesson_id,
        ba.lesson_title,
        coalesce(stats.attempt_count, 0)::int as attempt_count,
        coalesce(stats.learner_count, 0)::int as learner_count
      from bundle_assessments ba
      join assessments a on a.id = ba.assessment_id
      left join lateral (
        select
          count(*)::int as attempt_count,
          count(distinct membership_id)::int as learner_count
        from attempts at
        where at.assessment_id = ba.assessment_id
          and at.tenant_id = a.tenant_id
      ) stats on true
      where (
        ${query.q ?? null}::text is null
        or lower(ba.title) like '%' || lower(${query.q ?? null}) || '%'
      )
      order by ba.title asc
      limit ${query.limit}
      offset ${skip}
    `;
  },

  async countScoreLearners(tx: TenantTx, filter: ScoreLearnersFilter): Promise<number> {
    const view = filter.view ?? "all";
    const attemptsFilter = filter.attemptsFilter ?? null;
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with question_count as (
        select count(*)::int as n
        from assessment_items ai
        where ai.assessment_id = ${filter.assessmentId}::uuid
          and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      learner_attempts as (
        select
          at.membership_id,
          count(*) filter (where at.status::text <> 'VOIDED')::int as attempt_count,
          max(at.score_pct) filter (where at.score_pct is not null) as best_score_pct,
          (
            select at_first.score_pct
            from attempts at_first
            where at_first.membership_id = at.membership_id
              and at_first.assessment_id = at.assessment_id
              and at_first.tenant_id = at.tenant_id
              and at_first.status::text <> 'VOIDED'
              and at_first.score_pct is not null
            order by at_first.started_at asc
            limit 1
          ) as first_score_pct
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${filter.assessmentId}::uuid
        group by at.membership_id, at.assessment_id, at.tenant_id
      ),
      latest as (
        select distinct on (at.membership_id)
          at.membership_id,
          at.id as latest_attempt_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at,
          at.started_at,
          la.attempt_count,
          la.best_score_pct,
          la.first_score_pct
        from attempts at
        join learner_attempts la on la.membership_id = at.membership_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${filter.assessmentId}::uuid
          and at.status::text <> 'VOIDED'
        order by at.membership_id, coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      scored as (
        select
          lt.*,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          case
            when lt.attempt_status in ('STARTED') then 'in_progress'
            when lt.score_pct is null then 'pending'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null
              and lt.score_pct >= nullif(a.config_json->>'passMarkPercent', '')::float then 'pass'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null then 'fail'
            else 'pending'
          end as result_status,
          (
            lt.attempt_count > 1
            and lt.best_score_pct is not null
            and lt.first_score_pct is not null
            and lt.best_score_pct > lt.first_score_pct
          ) as improved_on_retry
        from latest lt
        join assessments a on a.id = ${filter.assessmentId}::uuid
        join memberships m on m.id = lt.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
      )
      select count(*)::bigint as count
      from scored
      where (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (${filter.resultStatus ?? null}::text is null or result_status = ${filter.resultStatus ?? null})
        and (${filter.minScore ?? null}::float is null or score_pct >= ${filter.minScore ?? null}::float)
        and (${filter.maxScore ?? null}::float is null or score_pct <= ${filter.maxScore ?? null}::float)
        and (${filter.minAttempts ?? null}::int is null or attempt_count >= ${filter.minAttempts ?? null}::int)
        and (
          ${attemptsFilter}::text is null
          or (${attemptsFilter}::text = 'first_only' and attempt_count = 1)
          or (${attemptsFilter}::text = 'more_than_one' and attempt_count > 1)
          or ${attemptsFilter}::text = 'any'
        )
        and (
          ${view}::text = 'all'
          or (${view}::text = 'failed' and result_status = 'fail')
          or (${view}::text = 'ungraded' and result_status = 'pending')
          or (${view}::text = 'improved_on_retry' and improved_on_retry)
        )
        and (
          ${filter.submittedFrom ?? null}::timestamptz is null
          or submitted_at >= ${filter.submittedFrom ?? null}::timestamptz
        )
        and (
          ${filter.submittedTo ?? null}::timestamptz is null
          or submitted_at <= ${filter.submittedTo ?? null}::timestamptz
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listScoreLearners(
    tx: TenantTx,
    assessmentId: string,
    query: ScoreLearnersQuery,
  ): Promise<ScoreLearnerRow[]> {
    const skip = (query.page - 1) * query.limit;
    const view = query.view;
    const attemptsFilter = query.attemptsFilter ?? null;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with question_count as (
        select count(*)::int as n
        from assessment_items ai
        where ai.assessment_id = ${assessmentId}::uuid
          and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      learner_attempts as (
        select
          at.membership_id,
          count(*) filter (where at.status::text <> 'VOIDED')::int as attempt_count,
          max(at.score_pct) filter (where at.score_pct is not null) as best_score_pct,
          (
            select at_first.score_pct
            from attempts at_first
            where at_first.membership_id = at.membership_id
              and at_first.assessment_id = at.assessment_id
              and at_first.tenant_id = at.tenant_id
              and at_first.status::text <> 'VOIDED'
              and at_first.score_pct is not null
            order by at_first.started_at asc
            limit 1
          ) as first_score_pct
        from attempts at
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
        group by at.membership_id, at.assessment_id, at.tenant_id
      ),
      latest as (
        select distinct on (at.membership_id)
          at.membership_id,
          at.id as latest_attempt_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at,
          at.started_at,
          la.attempt_count,
          la.best_score_pct,
          la.first_score_pct,
          (
            select count(*)::int
            from attempt_answers aa
            where aa.attempt_id = at.id
              and aa.tenant_id = at.tenant_id
          ) as answered_count,
          case
            when at.submitted_at is not null
              then extract(epoch from (at.submitted_at - at.started_at))
            else null
          end as duration_seconds
        from attempts at
        join learner_attempts la on la.membership_id = at.membership_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
          and at.status::text <> 'VOIDED'
        order by at.membership_id, coalesce(at.submitted_at, at.graded_at, at.started_at) desc
      ),
      scored as (
        select
          lt.membership_id,
          ${assessmentId}::uuid as assessment_id,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email,
          case
            when lt.attempt_status in ('STARTED') then 'in_progress'
            when lt.score_pct is null then 'pending'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null
              and lt.score_pct >= nullif(a.config_json->>'passMarkPercent', '')::float then 'pass'
            when nullif(a.config_json->>'passMarkPercent', '')::float is not null then 'fail'
            else 'pending'
          end as result_status,
          lt.attempt_count,
          lt.score_pct,
          lt.best_score_pct,
          lt.answered_count,
          (select n from question_count) as question_count,
          lt.duration_seconds,
          lt.submitted_at,
          lt.started_at,
          lt.latest_attempt_id,
          (
            lt.attempt_count > 1
            and lt.best_score_pct is not null
            and lt.first_score_pct is not null
            and lt.best_score_pct > lt.first_score_pct
          ) as improved_on_retry
        from latest lt
        join assessments a on a.id = ${assessmentId}::uuid
        join memberships m on m.id = lt.membership_id and m.tenant_id = current_setting('app.tenant_id', true)::uuid
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
      )
      select
        membership_id::text,
        assessment_id::text,
        learner_name,
        email,
        result_status,
        attempt_count,
        score_pct,
        best_score_pct,
        answered_count,
        question_count,
        duration_seconds,
        submitted_at,
        started_at,
        latest_attempt_id::text,
        improved_on_retry
      from scored
      where (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (${query.resultStatus ?? null}::text is null or result_status = ${query.resultStatus ?? null})
        and (${query.minScore ?? null}::float is null or score_pct >= ${query.minScore ?? null}::float)
        and (${query.maxScore ?? null}::float is null or score_pct <= ${query.maxScore ?? null}::float)
        and (${query.minAttempts ?? null}::int is null or attempt_count >= ${query.minAttempts ?? null}::int)
        and (
          ${attemptsFilter}::text is null
          or (${attemptsFilter}::text = 'first_only' and attempt_count = 1)
          or (${attemptsFilter}::text = 'more_than_one' and attempt_count > 1)
          or ${attemptsFilter}::text = 'any'
        )
        and (
          ${view}::text = 'all'
          or (${view}::text = 'failed' and result_status = 'fail')
          or (${view}::text = 'ungraded' and result_status = 'pending')
          or (${view}::text = 'improved_on_retry' and improved_on_retry)
        )
        and (
          ${query.submittedFrom ?? null}::timestamptz is null
          or submitted_at >= ${query.submittedFrom ?? null}::timestamptz
        )
        and (
          ${query.submittedTo ?? null}::timestamptz is null
          or submitted_at <= ${query.submittedTo ?? null}::timestamptz
        )
      order by
        case when ${query.sortBy} = 'score_pct' and ${query.sortDir} = 'asc' then score_pct end asc nulls last,
        case when ${query.sortBy} = 'score_pct' and ${query.sortDir} = 'desc' then score_pct end desc nulls last,
        case when ${query.sortBy} = 'attempt_count' and ${query.sortDir} = 'asc' then attempt_count end asc,
        case when ${query.sortBy} = 'attempt_count' and ${query.sortDir} = 'desc' then attempt_count end desc,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'asc' then learner_name end asc nulls last,
        case when ${query.sortBy} = 'learner_name' and ${query.sortDir} = 'desc' then learner_name end desc nulls last,
        case when ${query.sortBy} = 'submitted_at' and ${query.sortDir} = 'asc' then submitted_at end asc nulls last,
        case when ${query.sortBy} = 'submitted_at' and ${query.sortDir} = 'desc' then submitted_at end desc nulls last,
        membership_id desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      membership_id: asUnknownString(row["membership_id"]),
      assessment_id: asUnknownString(row["assessment_id"]),
      learner_name: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      result_status: asUnknownString(row["result_status"]) as ScoreLearnerRow["result_status"],
      attempt_count: Number(row["attempt_count"] ?? 0),
      score_pct: row["score_pct"] == null ? null : Number(row["score_pct"]),
      best_score_pct: row["best_score_pct"] == null ? null : Number(row["best_score_pct"]),
      answered_count: Number(row["answered_count"] ?? 0),
      question_count: row["question_count"] == null ? null : Number(row["question_count"]),
      duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
      submitted_at: row["submitted_at"] instanceof Date ? row["submitted_at"] : null,
      started_at: row["started_at"] instanceof Date ? row["started_at"] : null,
      latest_attempt_id:
        typeof row["latest_attempt_id"] === "string" ? row["latest_attempt_id"] : null,
      improved_on_retry: Boolean(row["improved_on_retry"]),
    }));
  },

  async listScoreMembershipIds(tx: TenantTx, filter: ScoreLearnersFilter): Promise<string[]> {
    const all = await tx.$queryRaw<Array<{ membership_id: string }>>`
      select distinct at.membership_id::text as membership_id
      from attempts at
      join memberships m on m.id = at.membership_id and m.tenant_id = at.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and at.assessment_id = ${filter.assessmentId}::uuid
        and (
          ${filter.learnerName ?? null}::text is null
          or lower(coalesce(mp.display_name, ap.email, m.invited_email_normalized, ''))
            like '%' || lower(${filter.learnerName ?? null}) || '%'
        )
        and (
          ${filter.submittedFrom ?? null}::timestamptz is null
          or at.submitted_at >= ${filter.submittedFrom ?? null}::timestamptz
        )
        and (
          ${filter.submittedTo ?? null}::timestamptz is null
          or at.submitted_at <= ${filter.submittedTo ?? null}::timestamptz
        )
      order by membership_id
      limit 2000
    `;
    return all.map((row) => row.membership_id);
  },
};
