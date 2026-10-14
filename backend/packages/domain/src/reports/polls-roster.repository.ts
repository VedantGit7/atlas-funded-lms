import { pollsRosterPollsRepository } from "./polls-roster-polls.repository";
import { pollsRosterNonRespondentsRepository } from "./polls-roster-non-respondents.repository";
import { pollsRosterLiveSessionsRepository } from "./polls-roster-live-sessions.repository";

export type PollListRow = {
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
  live_session_title: string | null;
  closes_at: Date | null;
  is_open: boolean;
  response_count: number;
  option_count: number;
  participation_pct: number | null;
  created_at: Date;
};

export type PollsListSummaryRow = {
  total_responses: number;
  poll_count: number;
  avg_participation_pct: number | null;
  quiz_poll_count: number;
  avg_quiz_correct_pct: number | null;
  open_now_count: number;
  anonymous_count: number;
};

export type PollOptionBreakdownRow = {
  option_id: string;
  label: string;
  sort_order: number;
  is_correct: boolean;
  count: number;
};

export type PollRespondentRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  option_id: string;
  option_label: string;
  is_correct: boolean;
  response_seconds: number | null;
  responded_at: Date;
};

export type PollRespondentsFilter = {
  pollId: string;
  learnerName?: string;
  optionId?: string;
  isCorrect?: "any" | "correct" | "incorrect";
  respondedFrom?: string;
  respondedTo?: string;
};

export type PollDetailExtrasRow = {
  unique_learner_count: number;
  eligible_count: number | null;
  correct_count: number;
  median_response_seconds: number | null;
  first_response_at: Date | null;
  last_response_at: Date | null;
  response_offsets: number[];
};

export type PollOptionExtrasRow = {
  option_median_response_seconds: number | null;
  option_offsets: number[];
  overall_median_response_seconds: number | null;
  overall_offsets: number[];
};

export type PollOptionSegmentRow = {
  key: string;
  label: string;
  count: number;
};

/** The polls roster queries, kept in one file per report area. */
export const pollsRosterRepository = {
  ...pollsRosterPollsRepository,
  ...pollsRosterNonRespondentsRepository,
  ...pollsRosterLiveSessionsRepository,
};
