import type { TenantTx } from "@atlas/db";
import {
  computeDiscriminationStub,
  computeDifficulty,
} from "../analytics/analytics-psychometrics";
import type { ScoreAttemptHistoryQuery } from "./progress-score-roster.dto";

function stemText(stemJson: unknown): string {
  if (!stemJson || typeof stemJson !== "object" || Array.isArray(stemJson)) {
    return "Untitled question";
  }
  const record = stemJson as Record<string, unknown>;
  for (const key of ["text", "stem", "prompt", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Untitled question";
}

function optionLabel(optionJson: unknown): string {
  if (!optionJson || typeof optionJson !== "object" || Array.isArray(optionJson)) {
    return "Option";
  }
  const record = optionJson as Record<string, unknown>;
  for (const key of ["text", "label", "title"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "Option";
}

function formatDuration(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0) return null;
  const total = Math.round(seconds);
  const mins = Math.floor(total / 60);
  const secs = total % 60;
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  }
  return `${mins}m ${String(secs).padStart(2, "0")}s`;
}

function parseFlags(metadata: unknown): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return [];
  const record = metadata as Record<string, unknown>;
  const flags: string[] = [];
  const tabSwitches =
    typeof record["tabSwitchCount"] === "number"
      ? record["tabSwitchCount"]
      : typeof record["tab_switched"] === "number"
        ? record["tab_switched"]
        : 0;
  if (tabSwitches > 0) flags.push(`Tab switched ×${tabSwitches}`);
  if (record["submittedAfterTimeLimit"] === true || record["after_time_limit"] === true) {
    flags.push("Submitted after time limit");
  }
  if (record["gradedManually"] === true || record["graded_manually"] === true) {
    flags.push("Graded manually");
  }
  return flags;
}

function resultStatus(
  attemptStatus: string,
  scorePct: number | null,
  passMark: number | null,
): "pass" | "fail" | "pending" | "in_progress" {
  if (attemptStatus === "STARTED") return "in_progress";
  if (scorePct == null) return "pending";
  if (passMark != null && scorePct >= passMark) return "pass";
  if (passMark != null) return "fail";
  return "pending";
}

export const progressScoreQuizDetailRepository = {
  async listItemAnalysis(tx: TenantTx, assessmentId: string) {
    const items = await tx.$queryRaw<
      Array<{
        assessment_item_id: string;
        item_id: string;
        position: number;
        stem_json: unknown;
        item_type_key: string;
        correct_count: number;
        answer_count: number;
        avg_latency_ms: number | null;
      }>
    >`
      select
        ai.id::text as assessment_item_id,
        ai.item_id::text as item_id,
        ai.position,
        i.stem_json,
        i.item_type_key,
        count(aa.id) filter (where aa.is_correct = true)::int as correct_count,
        count(aa.id)::int as answer_count,
        avg(
          case
            when jsonb_typeof(aa.answer_json -> 'latencyMs') = 'number'
              then (aa.answer_json ->> 'latencyMs')::float
            else null
          end
        )::float as avg_latency_ms
      from assessment_items ai
      join items i on i.id = ai.item_id and i.tenant_id = ai.tenant_id and i.deleted_at is null
      left join attempt_answers aa on aa.assessment_item_id = ai.id and aa.tenant_id = ai.tenant_id
      left join attempts at on at.id = aa.attempt_id and at.tenant_id = aa.tenant_id
        and at.status::text <> 'VOIDED'
      where ai.assessment_id = ${assessmentId}::uuid
        and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      group by ai.id, ai.item_id, ai.position, i.stem_json, i.item_type_key
      order by
        case when count(aa.id) = 0 then 1 else 0 end,
        (count(aa.id) filter (where aa.is_correct = true)::float / nullif(count(aa.id), 0)) asc nulls last,
        ai.position asc
    `;

    const itemIds = items.map((item) => item.item_id);
    const options =
      itemIds.length === 0
        ? []
        : await tx.$queryRaw<
            Array<{
              item_id: string;
              option_id: string;
              option_json: unknown;
              is_correct: boolean | null;
              position: number;
              pick_count: number;
            }>
          >`
            select
              io.item_id::text as item_id,
              io.id::text as option_id,
              io.option_json,
              io.is_correct,
              io.position,
              count(aa.id)::int as pick_count
            from item_options io
            left join assessment_items ai on ai.item_id = io.item_id and ai.tenant_id = io.tenant_id
            left join attempt_answers aa
              on aa.assessment_item_id = ai.id
              and aa.tenant_id = io.tenant_id
              and coalesce(aa.answer_json->>'selectedOptionId', aa.answer_json->>'optionId') = io.id::text
            where io.tenant_id = current_setting('app.tenant_id', true)::uuid
              and io.item_id = any(${itemIds}::uuid[])
              and ai.assessment_id = ${assessmentId}::uuid
            group by io.item_id, io.id, io.option_json, io.is_correct, io.position
            order by io.item_id, io.position
          `;

    const optionsByItem = new Map<string, typeof options>();
    for (const option of options) {
      const list = optionsByItem.get(option.item_id) ?? [];
      list.push(option);
      optionsByItem.set(option.item_id, list);
    }

    return items.map((item) => {
      const answerCount = item.answer_count;
      const correctRate =
        answerCount > 0 ? (item.correct_count / answerCount) * 100 : null;
      const difficulty = computeDifficulty(answerCount, item.correct_count);
      const discrimination = computeDiscriminationStub(answerCount, item.correct_count);
      const itemOptions = optionsByItem.get(item.item_id) ?? [];
      const totalPicks = itemOptions.reduce((sum, o) => sum + o.pick_count, 0);
      const mappedOptions = itemOptions.map((option) => ({
        optionId: option.option_id,
        label: optionLabel(option.option_json),
        sharePct: totalPicks > 0 ? Math.round((option.pick_count / totalPicks) * 1000) / 10 : 0,
        isCorrect: option.is_correct === true,
      }));
      const wrong = mappedOptions
        .filter((option) => !option.isCorrect)
        .sort((a, b) => b.sharePct - a.sharePct)[0];

      return {
        assessmentItemId: item.assessment_item_id,
        itemId: item.item_id,
        position: item.position,
        stem: stemText(item.stem_json),
        itemTypeKey: item.item_type_key,
        correctRatePct: correctRate == null ? null : Math.round(correctRate * 10) / 10,
        avgTimeLabel:
          item.avg_latency_ms == null
            ? null
            : formatDuration(item.avg_latency_ms / 1000),
        discrimination:
          discrimination == null ? null : Math.round(discrimination * 100) / 100,
        mostWrongOption: wrong?.label ?? null,
        mostWrongSharePct: wrong?.sharePct ?? null,
        options: mappedOptions,
        difficulty,
      };
    });
  },

  async countAttemptHistory(
    tx: TenantTx,
    assessmentId: string,
    query: ScoreAttemptHistoryQuery,
  ): Promise<number> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      with numbered as (
        select
          at.id,
          at.membership_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at,
          at.started_at,
          at.metadata_json,
          row_number() over (
            partition by at.membership_id
            order by at.started_at asc
          ) as attempt_number,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name
        from attempts at
        join memberships m on m.id = at.membership_id and m.tenant_id = at.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
          and at.status::text <> 'VOIDED'
      ),
      pass_mark as (
        select nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
        from assessments a
        where a.id = ${assessmentId}::uuid
      ),
      scored as (
        select
          n.*,
          case
            when n.attempt_status = 'STARTED' then 'in_progress'
            when n.score_pct is null then 'pending'
            when pm.pass_mark is not null and n.score_pct >= pm.pass_mark then 'pass'
            when pm.pass_mark is not null then 'fail'
            else 'pending'
          end as result_status
        from numbered n
        cross join pass_mark pm
      )
      select count(*)::bigint as count
      from scored
      where (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (${query.resultStatus ?? null}::text is null or result_status = ${query.resultStatus ?? null})
        and (
          ${query.submittedFrom ?? null}::timestamptz is null
          or submitted_at >= ${query.submittedFrom ?? null}::timestamptz
        )
        and (
          ${query.submittedTo ?? null}::timestamptz is null
          or submitted_at <= ${query.submittedTo ?? null}::timestamptz
        )
        and (
          ${query.flag ?? null}::text is null
          or (
            ${query.flag}::text = 'tab_switched'
            and coalesce((metadata_json->>'tabSwitchCount')::int, 0) > 0
          )
          or (
            ${query.flag}::text = 'after_time_limit'
            and coalesce((metadata_json->>'submittedAfterTimeLimit')::boolean, false)
          )
          or (
            ${query.flag}::text = 'graded_manually'
            and coalesce((metadata_json->>'gradedManually')::boolean, false)
          )
        )
    `;
    return Number(rows[0]?.count ?? 0);
  },

  async listAttemptHistory(
    tx: TenantTx,
    assessmentId: string,
    query: ScoreAttemptHistoryQuery,
  ) {
    const skip = (query.page - 1) * query.limit;
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      with question_count as (
        select count(*)::int as n
        from assessment_items ai
        where ai.assessment_id = ${assessmentId}::uuid
          and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      ),
      numbered as (
        select
          at.id,
          at.membership_id,
          at.status::text as attempt_status,
          at.score_pct,
          at.submitted_at,
          at.started_at,
          at.metadata_json,
          row_number() over (
            partition by at.membership_id
            order by at.started_at asc
          ) as attempt_number,
          (
            select count(*)::int
            from attempt_answers aa
            where aa.attempt_id = at.id and aa.tenant_id = at.tenant_id
          ) as answered_count,
          coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
          coalesce(ap.email, m.invited_email_normalized) as email
        from attempts at
        join memberships m on m.id = at.membership_id and m.tenant_id = at.tenant_id
        left join member_profiles mp
          on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
        left join auth_principals ap on ap.id = m.auth_principal_id
        where at.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
          and at.status::text <> 'VOIDED'
      ),
      pass_mark as (
        select nullif(a.config_json->>'passMarkPercent', '')::float as pass_mark
        from assessments a
        where a.id = ${assessmentId}::uuid
      ),
      scored as (
        select
          n.*,
          (select n from question_count) as question_count,
          case
            when n.attempt_status = 'STARTED' then 'in_progress'
            when n.score_pct is null then 'pending'
            when pm.pass_mark is not null and n.score_pct >= pm.pass_mark then 'pass'
            when pm.pass_mark is not null then 'fail'
            else 'pending'
          end as result_status,
          case
            when n.submitted_at is not null
              then extract(epoch from (n.submitted_at - n.started_at))
            else null
          end as duration_seconds
        from numbered n
        cross join pass_mark pm
      )
      select *
      from scored
      where (
          ${query.learnerName ?? null}::text is null
          or lower(coalesce(learner_name, '')) like '%' || lower(${query.learnerName ?? null}) || '%'
        )
        and (${query.resultStatus ?? null}::text is null or result_status = ${query.resultStatus ?? null})
        and (
          ${query.submittedFrom ?? null}::timestamptz is null
          or submitted_at >= ${query.submittedFrom ?? null}::timestamptz
        )
        and (
          ${query.submittedTo ?? null}::timestamptz is null
          or submitted_at <= ${query.submittedTo ?? null}::timestamptz
        )
        and (
          ${query.flag ?? null}::text is null
          or (
            ${query.flag}::text = 'tab_switched'
            and coalesce((metadata_json->>'tabSwitchCount')::int, 0) > 0
          )
          or (
            ${query.flag}::text = 'after_time_limit'
            and coalesce((metadata_json->>'submittedAfterTimeLimit')::boolean, false)
          )
          or (
            ${query.flag}::text = 'graded_manually'
            and coalesce((metadata_json->>'gradedManually')::boolean, false)
          )
        )
      order by
        case when ${query.sortBy} = 'score_pct' and ${query.sortDir} = 'asc' then score_pct end asc nulls last,
        case when ${query.sortBy} = 'score_pct' and ${query.sortDir} = 'desc' then score_pct end desc nulls last,
        case when ${query.sortBy} = 'attempt_number' and ${query.sortDir} = 'asc' then attempt_number end asc,
        case when ${query.sortBy} = 'attempt_number' and ${query.sortDir} = 'desc' then attempt_number end desc,
        case when ${query.sortBy} = 'started_at' and ${query.sortDir} = 'asc' then started_at end asc nulls last,
        case when ${query.sortBy} = 'started_at' and ${query.sortDir} = 'desc' then started_at end desc nulls last,
        case when ${query.sortBy} = 'submitted_at' and ${query.sortDir} = 'asc' then submitted_at end asc nulls last,
        case when ${query.sortBy} = 'submitted_at' and ${query.sortDir} = 'desc' then submitted_at end desc nulls last,
        started_at desc
      limit ${query.limit}
      offset ${skip}
    `;

    return rows.map((row) => ({
      attemptId: String(row["id"]),
      membershipId: String(row["membership_id"]),
      learnerName: typeof row["learner_name"] === "string" ? row["learner_name"] : null,
      email: typeof row["email"] === "string" ? row["email"] : null,
      attemptNumber: Number(row["attempt_number"] ?? 1),
      scorePct: row["score_pct"] == null ? null : Number(row["score_pct"]),
      resultStatus: String(row["result_status"]) as
        | "pass"
        | "fail"
        | "pending"
        | "in_progress",
      answeredCount: Number(row["answered_count"] ?? 0),
      questionCount: row["question_count"] == null ? null : Number(row["question_count"]),
      startedAt: row["started_at"] instanceof Date ? row["started_at"].toISOString() : null,
      submittedAt:
        row["submitted_at"] instanceof Date ? row["submitted_at"].toISOString() : null,
      durationSeconds:
        row["duration_seconds"] == null ? null : Math.max(0, Math.round(Number(row["duration_seconds"]))),
      flags: parseFlags(row["metadata_json"]),
    }));
  },
};

export { formatDuration as formatQuizDuration, resultStatus as quizResultStatus };
