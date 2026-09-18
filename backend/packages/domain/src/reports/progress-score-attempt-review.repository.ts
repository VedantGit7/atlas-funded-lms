import type { TenantTx } from "@atlas/db";

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

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readLearnerAnswerText(answerJson: unknown): string | null {
  const record = asRecord(answerJson);
  for (const key of ["text", "response", "value", "answer"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function readSelectedOptionIds(answerJson: unknown): string[] {
  const record = asRecord(answerJson);
  if (typeof record["selectedOptionId"] === "string") {
    return [record["selectedOptionId"]];
  }
  if (Array.isArray(record["selectedOptionIds"])) {
    return record["selectedOptionIds"].filter((v): v is string => typeof v === "string");
  }
  return [];
}

function readFeedback(answerJson: unknown): string | null {
  const record = asRecord(answerJson);
  const feedback = record["instructorFeedback"] ?? record["feedback"];
  return typeof feedback === "string" && feedback.trim() ? feedback.trim() : null;
}

function readDurationSeconds(answerJson: unknown): number | null {
  const record = asRecord(answerJson);
  const ms = record["latencyMs"];
  if (typeof ms === "number" && Number.isFinite(ms) && ms >= 0) {
    return Math.round(ms / 1000);
  }
  const seconds = record["durationSeconds"];
  if (typeof seconds === "number" && Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds);
  }
  return null;
}

const MANUAL_TYPES = new Set(["short_answer", "long_answer", "file_upload", "assignment", "essay"]);

export type AttemptReviewIntegrity = {
  key: string;
  label: string;
  severity: "clear" | "low" | "medium" | "high";
  recordedAt: string | null;
};

export function parseIntegrityFlags(metadata: unknown): AttemptReviewIntegrity[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [
      {
        key: "time_limit",
        label: "No over time limit",
        severity: "clear",
        recordedAt: null,
      },
    ];
  }
  const record = metadata as Record<string, unknown>;
  const flags: AttemptReviewIntegrity[] = [];
  const tabSwitches =
    typeof record["tabSwitchCount"] === "number"
      ? record["tabSwitchCount"]
      : typeof record["tab_switched"] === "number"
        ? record["tab_switched"]
        : 0;
  if (tabSwitches > 0) {
    flags.push({
      key: "tab_switched",
      label: `Tab switched ×${tabSwitches}`,
      severity: tabSwitches >= 3 ? "high" : "medium",
      recordedAt: null,
    });
  }
  if (record["submittedAfterTimeLimit"] === true || record["after_time_limit"] === true) {
    flags.push({
      key: "after_time_limit",
      label: "Submitted after time limit",
      severity: "high",
      recordedAt: null,
    });
  } else {
    flags.push({
      key: "time_limit",
      label: "No over time limit",
      severity: "clear",
      recordedAt: null,
    });
  }
  if (record["ipChanged"] === true || record["ip_changed"] === true) {
    flags.push({
      key: "ip_changed",
      label: "IP changed during session",
      severity: "high",
      recordedAt: null,
    });
  }
  if (record["gradedManually"] === true || record["graded_manually"] === true) {
    flags.push({
      key: "graded_manually",
      label: "Graded manually",
      severity: "low",
      recordedAt: null,
    });
  }
  return flags;
}

export function readLearnerAttemptGrants(configJson: unknown): Record<string, number> {
  const record = asRecord(configJson);
  const grants = record["learnerAttemptGrants"];
  if (!grants || typeof grants !== "object" || Array.isArray(grants)) return {};
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(grants as Record<string, unknown>)) {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
      out[key] = Math.floor(value);
    }
  }
  return out;
}

export const progressScoreAttemptReviewRepository = {
  async findAttemptCore(tx: TenantTx, assessmentId: string, attemptId: string) {
    const rows = await tx.$queryRaw<
      Array<{
        attempt_id: string;
        assessment_id: string;
        membership_id: string;
        status: string;
        score_pct: number | null;
        started_at: Date | null;
        submitted_at: Date | null;
        graded_at: Date | null;
        metadata_json: unknown;
        assessment_title: string;
        assessment_type: string;
        config_json: unknown;
        learner_name: string | null;
        email: string | null;
      }>
    >`
      select
        at.id::text as attempt_id,
        at.assessment_id::text as assessment_id,
        at.membership_id::text as membership_id,
        at.status::text as status,
        at.score_pct::float as score_pct,
        at.started_at,
        at.submitted_at,
        at.graded_at,
        at.metadata_json,
        a.title as assessment_title,
        a.assessment_type,
        a.config_json,
        coalesce(mp.display_name, ap.email, m.invited_email_normalized) as learner_name,
        coalesce(ap.email, m.invited_email_normalized) as email
      from attempts at
      join assessments a on a.id = at.assessment_id and a.tenant_id = at.tenant_id
      join memberships m on m.id = at.membership_id and m.tenant_id = at.tenant_id
      left join member_profiles mp
        on mp.membership_id = m.id and mp.tenant_id = m.tenant_id and mp.deleted_at is null
      left join auth_principals ap on ap.id = m.auth_principal_id
      where at.id = ${attemptId}::uuid
        and at.assessment_id = ${assessmentId}::uuid
        and at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and a.deleted_at is null
      limit 1
    `;
    return rows[0] ?? null;
  },

  async listSiblingAttempts(tx: TenantTx, assessmentId: string, membershipId: string) {
    return tx.$queryRaw<
      Array<{
        attempt_id: string;
        status: string;
        score_pct: number | null;
        started_at: Date | null;
        submitted_at: Date | null;
        attempt_number: number;
      }>
    >`
      select
        at.id::text as attempt_id,
        at.status::text as status,
        at.score_pct::float as score_pct,
        at.started_at,
        at.submitted_at,
        row_number() over (
          order by coalesce(at.submitted_at, at.graded_at, at.started_at) asc
        )::int as attempt_number
      from attempts at
      where at.tenant_id = current_setting('app.tenant_id', true)::uuid
        and at.assessment_id = ${assessmentId}::uuid
        and at.membership_id = ${membershipId}::uuid
        and at.status::text <> 'VOIDED'
      order by coalesce(at.submitted_at, at.graded_at, at.started_at) asc
    `;
  },

  async listQuestionsWithAnswers(tx: TenantTx, assessmentId: string, attemptId: string) {
    const items = await tx.$queryRaw<
      Array<{
        assessment_item_id: string;
        item_id: string;
        position: number;
        points: number;
        stem_json: unknown;
        item_type_key: string;
        answer_json: unknown;
        is_correct: boolean | null;
        points_awarded: number | null;
        has_answer: boolean;
        cohort_correct_rate: number | null;
      }>
    >`
      with cohort as (
        select
          aa.assessment_item_id,
          (
            count(*) filter (where aa.is_correct = true)::float
            / nullif(count(*), 0)::float
          ) * 100 as correct_rate
        from attempt_answers aa
        join attempts at on at.id = aa.attempt_id and at.tenant_id = aa.tenant_id
        where aa.tenant_id = current_setting('app.tenant_id', true)::uuid
          and at.assessment_id = ${assessmentId}::uuid
          and at.status::text <> 'VOIDED'
        group by aa.assessment_item_id
      )
      select
        ai.id::text as assessment_item_id,
        ai.item_id::text as item_id,
        ai.position,
        ai.points::float as points,
        i.stem_json,
        i.item_type_key,
        aa.answer_json,
        aa.is_correct,
        aa.points_awarded::float as points_awarded,
        (aa.id is not null) as has_answer,
        c.correct_rate::float as cohort_correct_rate
      from assessment_items ai
      join items i on i.id = ai.item_id and i.tenant_id = ai.tenant_id and i.deleted_at is null
      left join attempt_answers aa
        on aa.assessment_item_id = ai.id
        and aa.attempt_id = ${attemptId}::uuid
        and aa.tenant_id = ai.tenant_id
      left join cohort c on c.assessment_item_id = ai.id
      where ai.assessment_id = ${assessmentId}::uuid
        and ai.tenant_id = current_setting('app.tenant_id', true)::uuid
      order by ai.position asc
    `;

    const itemIds = items.map((i) => i.item_id);
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
            }>
          >`
            select
              item_id::text as item_id,
              id::text as option_id,
              option_json,
              is_correct,
              position
            from item_options
            where tenant_id = current_setting('app.tenant_id', true)::uuid
              and item_id = any(${itemIds}::uuid[])
            order by item_id, position
          `;

    const optionsByItem = new Map<string, typeof options>();
    for (const option of options) {
      const list = optionsByItem.get(option.item_id) ?? [];
      list.push(option);
      optionsByItem.set(option.item_id, list);
    }

    return items.map((item) => {
      const itemOptions = optionsByItem.get(item.item_id) ?? [];
      const selectedIds = item.has_answer ? readSelectedOptionIds(item.answer_json) : [];
      const correctIds = itemOptions.filter((o) => o.is_correct === true).map((o) => o.option_id);
      const isManual = MANUAL_TYPES.has(item.item_type_key);
      let outcome: "correct" | "incorrect" | "unanswered" | "needs_grading";
      if (!item.has_answer) {
        outcome = "unanswered";
      } else if (isManual && item.points_awarded == null) {
        outcome = "needs_grading";
      } else if (item.is_correct === true) {
        outcome = "correct";
      } else if (item.is_correct === false) {
        outcome = "incorrect";
      } else if (isManual) {
        outcome = "needs_grading";
      } else {
        outcome = "incorrect";
      }

      return {
        assessmentItemId: item.assessment_item_id,
        itemId: item.item_id,
        position: item.position,
        stem: stemText(item.stem_json),
        itemTypeKey: item.item_type_key,
        pointsMax: item.points,
        pointsAwarded: item.points_awarded == null ? null : item.points_awarded,
        outcome,
        durationSeconds: item.has_answer ? readDurationSeconds(item.answer_json) : null,
        cohortCorrectRatePct:
          item.cohort_correct_rate == null ? null : Math.round(item.cohort_correct_rate * 10) / 10,
        options: itemOptions.map((o) => ({
          optionId: o.option_id,
          label: optionLabel(o.option_json),
          isCorrect: o.is_correct === true,
          selectedByLearner: selectedIds.includes(o.option_id),
        })),
        learnerAnswerText: item.has_answer ? readLearnerAnswerText(item.answer_json) : null,
        selectedOptionIds: selectedIds,
        correctOptionIds: correctIds,
        feedback: item.has_answer ? readFeedback(item.answer_json) : null,
        isManual,
        hasAnswer: item.has_answer,
        answerJson: item.answer_json,
      };
    });
  },
};

export { stemText, optionLabel, asRecord, MANUAL_TYPES };
