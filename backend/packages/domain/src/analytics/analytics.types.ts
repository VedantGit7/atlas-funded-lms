export type AnalyticsServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export type AnalyticsSubjectScope = {
  subjectType: "tenant" | "course";
  subjectId: string;
};

export type AnalyticsRollupRow = {
  id: string;
  rollup_key: string;
  subject_type: string;
  subject_id: string | null;
  period_start: Date;
  period_end: Date;
  metrics_json: Record<string, unknown>;
  calculated_at: Date;
};

export type FunnelDailyRollupRow = {
  id: string;
  funnel_key: string;
  stage_key: string;
  day: Date;
  count: number;
  calculated_at: Date;
};

export type ItemStatisticRow = {
  id: string;
  item_id: string;
  window_key: string;
  attempts_count: number;
  correct_count: number;
  avg_latency_ms: number | null;
  metrics_json: Record<string, unknown> | null;
  calculated_at: Date;
};

export type AnalyticsProjectionMutation =
  | {
      kind: "rollup";
      rollupKey: string;
      subject: AnalyticsSubjectScope;
      periodStart: Date;
      periodEnd: Date;
      metricDelta: { count: number };
    }
  | {
      kind: "funnel";
      funnelKey: string;
      stageKey: string;
      day: Date;
      countDelta: number;
    }
  | {
      kind: "item_statistic";
      itemId: string;
      windowKey: string;
      attemptsDelta: number;
      correctDelta: number;
      latencyMs: number | null;
      selectedOptionId?: string | null;
    };

export type AnalyticsSourceContext =
  | "learning"
  | "assessment"
  | "competency"
  | "gamification"
  | "credentialing"
  | "community"
  | "moderation";
