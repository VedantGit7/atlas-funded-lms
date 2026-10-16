import { clientApi } from "../../../lib/client-api";

export type ProgressScoreOverviewWindow = "7d" | "30d" | "90d";

export type ProgressScoreOverviewSummary = {
  averageCompletionPct: number | null;
  averageCompletionDeltaPoints: number | null;
  activeEnrolmentCount: number;
  learnersAtRiskCount: number;
  atRiskIdleDays: 14;
  assessmentPassRatePct: number | null;
  assessmentAttemptCount: number;
  awaitingGradingCount: number;
};

export type ProgressScoreCompletionBand = {
  key: "not_started" | "early" | "in_progress" | "nearly_done" | "complete";
  label: string;
  count: number;
  sharePct: number;
};

export type ProgressScoreOverview = {
  windowLabel: string;
  windowFrom: string;
  windowTo: string;
  previousWindowFrom: string;
  previousWindowTo: string;
  empty: boolean;
  summary: ProgressScoreOverviewSummary;
  completionDistribution: ProgressScoreCompletionBand[];
};

/** The window the overview opens on. */
export const PROGRESS_SCORE_DEFAULT_WINDOW: ProgressScoreOverviewWindow = "30d";

/** The overview's API path; the server loads the first one with it too. */
export function progressScoreOverviewPath(params?: {
  window?: ProgressScoreOverviewWindow | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): string {
  const search = new URLSearchParams();
  if (params?.window) search.set("window", params.window);
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);
  const query = search.toString();
  return `/api/v1/reports/progress-score/overview${query ? `?${query}` : ""}`;
}

export async function fetchProgressScoreOverview(params?: {
  window?: ProgressScoreOverviewWindow | undefined;
  from?: string | undefined;
  to?: string | undefined;
}) {
  return clientApi.get<{ data: ProgressScoreOverview }>(progressScoreOverviewPath(params));
}
