import { zoomInsightsRosterMeetingsRepository } from "./zoom-insights-roster-meetings.repository";
import { zoomInsightsRosterParticipantsRepository } from "./zoom-insights-roster-participants.repository";
import { zoomInsightsRosterPeopleRepository } from "./zoom-insights-roster-people.repository";

export type ZoomMeetingListRow = {
  id: string;
  external_meeting_id: string;
  topic: string | null;
  started_at: Date | null;
  ended_at: Date | null;
  duration_seconds: number | null;
  attendance_count: number;
  matched_count: number;
  unmatched_count: number;
  total_attendance_seconds: number;
};

export type ZoomParticipantRow = {
  id: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  zoom_display_name: string | null;
  email: string | null;
  join_time: Date | null;
  leave_time: Date | null;
  duration_seconds: number | null;
  session_count: number;
  rejoin_count: number;
  match_state: "matched" | "unmatched" | "guest";
};

export type ZoomParticipantIntervalRow = {
  join_time: Date | null;
  leave_time: Date | null;
};

export type ZoomConnectionMetaRow = {
  status: "connected" | "disconnected" | "unknown";
  connected_at: Date | null;
  last_synced_at: Date | null;
  meetings_imported_today: number;
  has_connection_record: boolean;
};

export type ZoomMeetingsSummaryRow = {
  meeting_count: number;
  participant_count: number;
  matched_count: number;
  unmatched_count: number;
  total_attendance_seconds: number;
  avg_attendance_per_meeting: number | null;
  avg_duration_seconds: number | null;
};

export type ZoomParticipantsFilter = {
  meetingId: string;
  displayName?: string;
  email?: string;
  joinedFrom?: string;
  joinedTo?: string;
  matchState?: "all" | "matched" | "unmatched" | "guest";
  durationBucket?: "any" | "under_10" | "10_to_30" | "over_30";
  rejoinedOnly?: boolean;
};

export type ZoomParticipantSessionRow = {
  id: string;
  join_time: Date | null;
  leave_time: Date | null;
  duration_seconds: number | null;
  display_name: string | null;
};

export type ZoomParticipantIdentityDetail = {
  identity_key: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  zoom_display_name: string | null;
  email: string | null;
  membership_status: string | null;
  match_state: "matched" | "unmatched" | "guest";
  total_duration_seconds: number;
  session_count: number;
  rejoin_count: number;
  first_joined_at: Date | null;
  last_left_at: Date | null;
  sessions: ZoomParticipantSessionRow[];
};

export type ZoomPersonListRow = {
  identity_key: string;
  membership_id: string | null;
  external_user_id: string | null;
  display_name: string | null;
  zoom_display_name: string | null;
  email: string | null;
  match_state: "matched" | "unmatched" | "guest";
  meetings_attended: number;
  total_duration_seconds: number;
  avg_duration_seconds: number | null;
  avg_coverage_percent: number | null;
  first_seen_at: Date | null;
  last_seen_at: Date | null;
  representative_meeting_id: string;
  representative_participant_id: string;
};

export type ZoomPeopleSummaryRow = {
  people_count: number;
  matched_count: number;
  unmatched_count: number;
  guest_count: number;
  avg_meetings_attended: number | null;
  total_duration_seconds: number;
  avg_coverage_percent: number | null;
  attended_once_only_count: number;
};

export type ZoomPersonMeetingRow = {
  meeting_id: string;
  participant_id: string;
  topic: string | null;
  external_meeting_id: string;
  started_at: Date | null;
  duration_seconds: number | null;
  coverage_percent: number | null;
  rejoin_count: number;
};

export type ZoomParticipantHistoryRow = {
  meeting_id: string;
  topic: string | null;
  started_at: Date | null;
  duration_seconds: number | null;
  meeting_duration_seconds: number | null;
  is_current: boolean;
};

/** The Zoom insights roster queries, kept in one file per report area. */
export const zoomInsightsRosterRepository = {
  ...zoomInsightsRosterMeetingsRepository,
  ...zoomInsightsRosterParticipantsRepository,
  ...zoomInsightsRosterPeopleRepository,
};
