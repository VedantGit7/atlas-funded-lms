import { randomUUID } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { textColumn } from "../reports/raw-column";

export type PollRow = {
  id: string;
  title: string;
  description: string | null;
  poll_type: string;
  status: string;
  quiz_mode: boolean;
  allow_multiple_answers: boolean;
  anonymous_vote: boolean;
  result_visibility: string;
  layout: string;
  duration_seconds: number | null;
  live_session_id: string | null;
  closes_at: Date | null;
  created_at: Date;
};

export type PollOptionRow = {
  id: string;
  poll_id: string;
  label: string;
  sort_order: number;
  is_correct: boolean;
};

function mapPollRow(row: Record<string, unknown>): PollRow {
  return {
    id: textColumn(row["id"]),
    title: textColumn(row["title"]),
    description: typeof row["description"] === "string" ? row["description"] : null,
    poll_type: textColumn(row["poll_type"], "multiple_choice"),
    status: textColumn(row["status"]),
    quiz_mode: Boolean(row["quiz_mode"]),
    allow_multiple_answers: Boolean(row["allow_multiple_answers"]),
    anonymous_vote: Boolean(row["anonymous_vote"]),
    result_visibility: textColumn(row["result_visibility"], "after_vote"),
    layout: textColumn(row["layout"], "list"),
    duration_seconds: row["duration_seconds"] == null ? null : Number(row["duration_seconds"]),
    live_session_id: typeof row["live_session_id"] === "string" ? row["live_session_id"] : null,
    closes_at: row["closes_at"] instanceof Date ? row["closes_at"] : null,
    created_at: row["created_at"] as Date,
  };
}

export const pollsRepository = {
  async insertPoll(
    tx: TenantTx,
    args: {
      title: string;
      description?: string | null;
      pollType: string;
      status: string;
      quizMode: boolean;
      allowMultipleAnswers: boolean;
      anonymousVote: boolean;
      resultVisibility: string;
      layout: string;
      durationSeconds?: number | null;
      liveSessionId?: string | null;
      closesAt?: Date | null;
      options: Array<{ label: string; sortOrder: number; isCorrect: boolean }>;
    },
  ): Promise<{ poll: PollRow; options: PollOptionRow[] }> {
    const pollId = randomUUID();
    const pollRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      insert into polls (
        id, tenant_id, title, description, poll_type, status,
        quiz_mode, allow_multiple_answers, anonymous_vote, result_visibility,
        layout, duration_seconds, live_session_id, closes_at, created_at, updated_at
      )
      values (
        ${pollId}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.title},
        ${args.description ?? null},
        ${args.pollType},
        ${args.status}::"EntityStatus",
        ${args.quizMode},
        ${args.allowMultipleAnswers},
        ${args.anonymousVote},
        ${args.resultVisibility},
        ${args.layout},
        ${args.durationSeconds ?? null}::int,
        ${args.liveSessionId ?? null}::uuid,
        ${args.closesAt ?? null}::timestamptz,
        now(),
        now()
      )
      returning id, title, description, poll_type, status, quiz_mode, allow_multiple_answers,
        anonymous_vote, result_visibility, layout, duration_seconds, live_session_id,
        closes_at, created_at
    `;
    const pollRow = pollRows[0];
    if (!pollRow) throw new Error("POLL_INSERT_FAILED");

    const options: PollOptionRow[] = [];
    for (const option of args.options) {
      const optionId = randomUUID();
      const optionRows = await tx.$queryRaw<Array<Record<string, unknown>>>`
        insert into poll_options (
          id, tenant_id, poll_id, label, sort_order, is_correct, created_at, updated_at
        )
        values (
          ${optionId}::uuid,
          current_setting('app.tenant_id', true)::uuid,
          ${pollId}::uuid,
          ${option.label},
          ${option.sortOrder},
          ${option.isCorrect},
          now(),
          now()
        )
        returning id, poll_id, label, sort_order, is_correct
      `;
      const row = optionRows[0];
      if (row) {
        options.push({
          id: textColumn(row["id"]),
          poll_id: textColumn(row["poll_id"]),
          label: textColumn(row["label"]),
          sort_order: Number(row["sort_order"]),
          is_correct: Boolean(row["is_correct"]),
        });
      }
    }

    return {
      poll: mapPollRow(pollRow),
      options,
    };
  },

  async listPolls(tx: TenantTx): Promise<PollRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, title, description, poll_type, status, quiz_mode, allow_multiple_answers,
        anonymous_vote, result_visibility, layout, duration_seconds, live_session_id,
        closes_at, created_at
      from polls order by created_at desc limit 100
    `;
    return rows.map(mapPollRow);
  },

  async findPollById(tx: TenantTx, pollId: string): Promise<PollRow | null> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, title, description, poll_type, status, quiz_mode, allow_multiple_answers,
        anonymous_vote, result_visibility, layout, duration_seconds, live_session_id,
        closes_at, created_at
      from polls where id = ${pollId}::uuid limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return mapPollRow(row);
  },

  async listOptionsForPoll(tx: TenantTx, pollId: string): Promise<PollOptionRow[]> {
    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      select id, poll_id, label, sort_order, is_correct from poll_options
      where poll_id = ${pollId}::uuid
      order by sort_order asc
    `;
    return rows.map((row) => ({
      id: textColumn(row["id"]),
      poll_id: textColumn(row["poll_id"]),
      label: textColumn(row["label"]),
      sort_order: Number(row["sort_order"]),
      is_correct: Boolean(row["is_correct"]),
    }));
  },

  async updatePoll(
    tx: TenantTx,
    pollId: string,
    args: {
      title?: string;
      description?: string | null;
      status?: string;
      quizMode?: boolean;
      allowMultipleAnswers?: boolean;
      anonymousVote?: boolean;
      resultVisibility?: string;
      layout?: string;
      durationSeconds?: number | null;
      liveSessionId?: string | null;
      closesAt?: Date | null;
    },
  ): Promise<PollRow | null> {
    const existing = await this.findPollById(tx, pollId);
    if (!existing) return null;

    const rows = await tx.$queryRaw<Array<Record<string, unknown>>>`
      update polls
      set
        title = ${args.title ?? existing.title},
        description = ${args.description !== undefined ? args.description : existing.description},
        status = ${args.status ?? existing.status}::"EntityStatus",
        quiz_mode = ${args.quizMode ?? existing.quiz_mode},
        allow_multiple_answers = ${args.allowMultipleAnswers ?? existing.allow_multiple_answers},
        anonymous_vote = ${args.anonymousVote ?? existing.anonymous_vote},
        result_visibility = ${args.resultVisibility ?? existing.result_visibility},
        layout = ${args.layout ?? existing.layout},
        duration_seconds = ${
          args.durationSeconds !== undefined ? args.durationSeconds : existing.duration_seconds
        }::int,
        live_session_id = ${
          args.liveSessionId !== undefined ? args.liveSessionId : existing.live_session_id
        }::uuid,
        closes_at = ${
          args.closesAt !== undefined ? args.closesAt : existing.closes_at
        }::timestamptz,
        updated_at = now()
      where id = ${pollId}::uuid
      returning id, title, description, poll_type, status, quiz_mode, allow_multiple_answers,
        anonymous_vote, result_visibility, layout, duration_seconds, live_session_id,
        closes_at, created_at
    `;
    const row = rows[0];
    if (!row) return null;
    return mapPollRow(row);
  },

  async deletePoll(tx: TenantTx, pollId: string): Promise<boolean> {
    const count = await tx.$executeRaw`delete from polls where id = ${pollId}::uuid`;
    return count > 0;
  },

  async insertResponse(
    tx: TenantTx,
    args: { pollId: string; pollOptionId: string; membershipId: string },
  ): Promise<void> {
    const id = randomUUID();
    await tx.$executeRaw`
      insert into poll_responses (id, tenant_id, poll_id, poll_option_id, membership_id, created_at, updated_at)
      values (
        ${id}::uuid,
        current_setting('app.tenant_id', true)::uuid,
        ${args.pollId}::uuid,
        ${args.pollOptionId}::uuid,
        ${args.membershipId}::uuid,
        now(),
        now()
      )
      on conflict (tenant_id, poll_id, membership_id) do update
      set poll_option_id = excluded.poll_option_id, updated_at = now()
    `;
  },

  async getResults(tx: TenantTx, pollId: string) {
    const rows = await tx.$queryRaw<
      Array<{ option_id: string; label: string; count: bigint; is_correct: boolean }>
    >`
      select po.id::text as option_id, po.label, po.is_correct, count(pr.id) as count
      from poll_options po
      left join poll_responses pr on pr.poll_option_id = po.id and pr.tenant_id = po.tenant_id
      where po.poll_id = ${pollId}::uuid
      group by po.id, po.label, po.sort_order, po.is_correct
      order by po.sort_order asc
    `;
    return rows.map((row) => ({
      optionId: row.option_id,
      label: row.label,
      count: Number(row.count),
      isCorrect: row.is_correct,
    }));
  },

  async hasActiveEnrollment(tx: TenantTx, membershipId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*) as count
      from enrollments
      where membership_id = ${membershipId}::uuid
        and status = 'active'
      limit 1
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  },

  async optionBelongsToPoll(tx: TenantTx, pollId: string, optionId: string): Promise<boolean> {
    const rows = await tx.$queryRaw<Array<{ count: bigint }>>`
      select count(*) as count from poll_options
      where id = ${optionId}::uuid and poll_id = ${pollId}::uuid
    `;
    return Number(rows[0]?.count ?? 0) > 0;
  },
};
