export type MetricGlossaryEntry = {
  label: string;
  description: string;
};

export const METRIC_GLOSSARY: Record<string, MetricGlossaryEntry> = {
  lessons_completed: {
    label: "Lessons completed",
    description: "Count of lessons marked complete by learners in the selected period.",
  },
  assessments_submitted: {
    label: "Assessment submissions",
    description: "Number of assessment attempts submitted, including reattempts.",
  },
  assessments_passed: {
    label: "Assessments passed",
    description: "Submissions that met the passing score threshold for their assessment.",
  },
  practice_sessions_completed: {
    label: "Practice sessions",
    description: "Completed practice or drill sessions outside formal assessments.",
  },
  certificates_issued: {
    label: "Certificates issued",
    description: "Credentials issued to learners after meeting completion requirements.",
  },
  community_posts_created: {
    label: "Community posts",
    description: "New discussion posts created in community spaces.",
  },
  moderation_cases_opened: {
    label: "Moderation cases",
    description: "Reports or cases opened for community moderation review.",
  },
  path_steps_completed: {
    label: "Path steps completed",
    description: "Learning path milestones completed across assigned journeys.",
  },
  completion_rate: {
    label: "Completion rate",
    description: "Share of submitted assessments that reached a passing score.",
  },
  pass_rate: {
    label: "Pass rate",
    description: "Percentage of assessment submissions that passed in the selected window.",
  },
  difficulty: {
    label: "Difficulty (p-value)",
    description: "Proportion of attempts answered correctly. Ideal range is roughly 0.3–0.7.",
  },
  discrimination: {
    label: "Discrimination",
    description:
      "How well the item separates stronger from weaker performers (−1 to 1). Values above 0.2 are generally acceptable.",
  },
  quality_flag: {
    label: "Quality flag",
    description:
      "Heuristic item quality rating based on sample size, difficulty, and discrimination.",
  },
};

export function getMetricGlossary(key: string): MetricGlossaryEntry | undefined {
  return METRIC_GLOSSARY[key];
}

export function getMetricDescription(key: string, fallbackLabel?: string): string {
  const entry = getMetricGlossary(key);
  if (entry) return entry.description;
  return fallbackLabel
    ? `${fallbackLabel} for the selected analytics period.`
    : "Metric value for the selected analytics period.";
}
