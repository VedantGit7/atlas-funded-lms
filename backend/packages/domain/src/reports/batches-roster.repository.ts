import { batchesRosterOverviewRepository } from "./batches-roster-overview.repository";
import { batchesRosterLearnersRepository } from "./batches-roster-learners.repository";
import { batchesRosterLiveSessionsRepository } from "./batches-roster-live-sessions.repository";
import { batchesRosterExamsRepository } from "./batches-roster-exams.repository";
import { batchesRosterContentRepository } from "./batches-roster-content.repository";
import { batchesRosterMessagesRepository } from "./batches-roster-messages.repository";

export type BatchListRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  course_id: string | null;
  course_title: string | null;
  status: string;
  starts_at: Date | null;
  ends_at: Date | null;
  member_count: number;
  avg_content_completion_pct: number | null;
  avg_live_attendance_pct: number | null;
  avg_test_score_pct: number | null;
  last_activity_at: Date | null;
  health: "on_track" | "at_risk" | "critical";
  created_at: Date;
};

export type BatchesListSummaryRow = {
  active_batch_count: number;
  total_learners: number;
  avg_content_completion_pct: number | null;
  avg_live_attendance_pct: number | null;
  at_risk_count: number;
  ending_soon_count: number;
};

export type BatchLearnerRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  activity_at: Date | null;
  live_attendance_pct: number | null;
  live_attended_count: number;
  live_session_count: number;
  test_score_pct: number | null;
  test_attempt_count: number;
  content_completion_pct: number;
  completed_lessons: number;
  total_lessons: number;
  joined_at: Date;
  health: "on_track" | "at_risk" | "critical";
};

export type UpcomingSessionRow = {
  live_session_id: string;
  title: string;
  scheduled_at: Date | null;
  status: string;
  duration_minutes: number | null;
};

export type CohortTrendRow = {
  week_start: Date;
  week_label: string;
  content_completion_pct: number | null;
  live_attendance_pct: number | null;
  test_score_pct: number | null;
};

export type LiveSessionCounts = {
  total_count: number;
  held_count: number;
};

export type BatchLiveSessionRow = {
  id: string;
  title: string;
  kind: string | null;
  status: string;
  host_label: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  roster_count: number;
  attended_count: number;
  attendance_rate_pct: number | null;
  avg_watch_minutes: number | null;
  late_count: number;
  recording_url: string | null;
  has_recording: boolean;
};

export type BatchLiveSessionsSummaryRow = {
  avg_attendance_pct: number | null;
  sessions_held_count: number;
  sessions_total_count: number;
  perfect_attendance_count: number;
  missed_three_or_more_count: number;
  avg_watch_minutes: number | null;
  planned_watch_minutes: number | null;
  roster_count: number;
};

export type BatchLiveSessionDetailRow = {
  id: string;
  title: string;
  kind: string | null;
  status: string;
  host_label: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  planned_duration_minutes: number | null;
  actual_duration_minutes: number | null;
  recording_url: string | null;
  timezone_label: string | null;
  batch_id: string | null;
  course_id: string | null;
};

export type BatchLiveSessionAttendeeRow = {
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  raw_status: string | null;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
  rejoins: number | null;
  device_label: string | null;
};

export type BatchLiveSessionIntervalRow = {
  membership_id: string;
  joined_at: Date;
  left_at: Date | null;
  duration_seconds: number | null;
};

export type BatchExamAssessmentRow = {
  assessment_id: string;
  title: string;
  assessment_type: string;
  released_at: Date | null;
  pass_mark_pct: number;
  roster_count: number;
  attempted_count: number;
  attempted_pct: number | null;
  avg_score_pct: number | null;
  pass_rate_pct: number | null;
  high_score_pct: number | null;
  low_score_pct: number | null;
  awaiting_grading_count: number;
  health_rail: "none" | "success" | "warning" | "danger";
  dist_min: number | null;
  dist_q1: number | null;
  dist_median: number | null;
  dist_q3: number | null;
  dist_max: number | null;
};

export type BatchExamsSummaryRow = {
  avg_score_pct: number | null;
  pass_mark_pct: number;
  pass_rate_pct: number | null;
  passed_learner_count: number;
  roster_count: number;
  attempt_count: number;
  attempts_per_learner: number | null;
  awaiting_grading_count: number;
  not_attempted_count: number;
  assessment_count: number;
};

export type BatchLearnersFilter = {
  batchId: string;
  learnerName?: string;
  joinedFrom?: string;
  joinedTo?: string;
  minCompletion?: number;
  maxCompletion?: number;
};

export type LiveAttendanceDetailRow = {
  live_session_id: string;
  title: string;
  scheduled_at: Date | null;
  status: string;
  session_status: string;
  session_kind: string | null;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
  planned_duration_minutes: number | null;
};

export type ExamDetailRow = {
  assessment_id: string;
  assessment_title: string;
  attempt_id: string;
  attempt_status: string;
  score_pct: number | null;
  submitted_at: Date | null;
  started_at: Date;
  duration_seconds: number | null;
};

export type CourseProgressDetailRow = {
  course_id: string;
  course_title: string;
  completed_lessons: number;
  total_lessons: number;
  completion_pct: number;
  last_lesson_title: string | null;
};

export type LessonStripRow = {
  lesson_id: string;
  title: string;
  sort_order: number;
  completed: boolean;
};

export type ActivityDayRow = {
  activity_date: Date;
  event_count: number;
};

/** The batches roster queries, kept in one file per report area. */
export const batchesRosterRepository = {
  ...batchesRosterOverviewRepository,
  ...batchesRosterLearnersRepository,
  ...batchesRosterLiveSessionsRepository,
  ...batchesRosterExamsRepository,
  ...batchesRosterContentRepository,
  ...batchesRosterMessagesRepository,
};
