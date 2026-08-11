export const SCHOOL_VITALS_POPULATION_KPI_IDS = [
  "learners",
  "active-enrollments",
  "current-mau",
  "active-users-30d",
  "inactive-learners",
  "assessment-pass-rate",
] as const;

export const SCHOOL_VITALS_ACTIVITY_KPI_IDS = [
  "lessons-completed",
  "assessments-submitted",
  "assessments-passed",
  "practice-sessions",
  "certificates-issued",
  "community-posts",
  "path-steps",
  "moderation-opened",
] as const;

export const SCHOOL_VITALS_INVERTED_KPI_IDS = new Set(["inactive-learners", "moderation-opened"]);

export const SCHOOL_VITALS_PERCENT_KPI_IDS = new Set(["assessment-pass-rate"]);

export const SCHOOL_VITALS_CHART_WIDGET_IDS = [
  "learning-activity",
  "lessons-trend",
  "assessments-trend",
  "daily-active-users",
  "engagement-funnel",
  "content-health",
  "top-courses",
] as const;

export function schoolVitalsActivityGroupTitle(range: "12m" | "30d" | "ytd"): string {
  if (range === "30d") return "Learning activity (30 days)";
  if (range === "ytd") return "Learning activity (year to date)";
  return "Learning activity (12 months)";
}
