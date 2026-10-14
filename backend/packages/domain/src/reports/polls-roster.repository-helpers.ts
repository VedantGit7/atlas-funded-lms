// Shared by the polls roster repository files.

import { textColumn } from "./raw-column";
import type { PollListRow } from "./polls-roster.repository";

export function mapPollListRow(row: Record<string, unknown>): PollListRow {
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
    live_session_title:
      typeof row["live_session_title"] === "string" ? row["live_session_title"] : null,
    closes_at: row["closes_at"] instanceof Date ? row["closes_at"] : null,
    is_open: Boolean(row["is_open"]),
    response_count: Number(row["response_count"] ?? 0),
    option_count: Number(row["option_count"] ?? 0),
    participation_pct: row["participation_pct"] == null ? null : Number(row["participation_pct"]),
    created_at: row["created_at"] as Date,
  };
}
