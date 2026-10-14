import { liveClassAttendanceRosterSessionsRepository } from "./live-class-attendance-roster-sessions.repository";
import { liveClassAttendanceRosterAttendeesRepository } from "./live-class-attendance-roster-attendees.repository";
import { liveClassAttendanceRosterLearnersRepository } from "./live-class-attendance-roster-learners.repository";
import { liveClassAttendanceRosterSeriesRepository } from "./live-class-attendance-roster-series.repository";

export type LiveSessionListRow = {
  id: string;
  title: string;
  status: string;
  course_id: string | null;
  course_title: string | null;
  batch_id: string | null;
  batch_name: string | null;
  scheduled_at: Date | null;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  attendance_count: number;
  registered_count: number;
  avg_coverage_seconds: number | null;
};

export type LiveSessionsSummaryRow = {
  sessions_held: number;
  cancelled_count: number;
  scheduled_ahead_count: number;
  avg_attendance_pct: number | null;
  total_attended_count: number;
  total_registered_count: number;
  total_time_seconds: number;
  avg_coverage_pct: number | null;
  low_turnout_count: number;
};

export type LiveAttendeeRow = {
  id: string;
  membership_id: string;
  learner_name: string | null;
  email: string | null;
  status: string;
  joined_at: Date | null;
  left_at: Date | null;
  duration_seconds: number | null;
};

export type LiveAttendeesFilter = {
  sessionId: string;
  learnerName?: string;
  email?: string;
  status?: string;
  joinedFrom?: string;
  joinedTo?: string;
};

/** The live class attendance roster queries, kept in one file per report area. */
export const liveClassAttendanceRosterRepository = {
  ...liveClassAttendanceRosterSessionsRepository,
  ...liveClassAttendanceRosterAttendeesRepository,
  ...liveClassAttendanceRosterLearnersRepository,
  ...liveClassAttendanceRosterSeriesRepository,
};
