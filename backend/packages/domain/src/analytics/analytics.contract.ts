export type AnalyticsDashboardResponse = {
  data: {
    dashboardKey: string;
    courseId: string | null;
    from: string;
    to: string;
    metrics: Array<{
      rollupKey: string;
      periodStart: string;
      periodEnd: string;
      count: number;
    }>;
    summary: { totalEvents: number };
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
  };
};

export type AnalyticsFunnelResponse = {
  data: {
    funnelKey: string;
    from: string;
    to: string;
    days: Array<{
      day: string;
      stages: Array<{ stageKey: string; count: number }>;
    }>;
  };
};

export type AnalyticsItemStatisticsResponse = {
  data: {
    assessmentId: string;
    windowKey: string;
    items: Array<{
      itemReference: { itemId: string; label: string };
      attemptsCount: number;
      correctCount: number;
      accuracy: number | null;
      averageLatencyMs: number | null;
      calculatedAt: string;
      windowKey: string;
      difficulty: number | null;
      discrimination: number | null;
      distractorRates: Array<{ optionId: string; rate: number }> | null;
      sampleSizeWarning: boolean;
      qualityFlag: "bad" | "fair" | "good";
    }>;
    pageInfo: { nextCursor: string | null; hasNextPage: boolean };
  };
};

export type AnalyticsDashboardDrillDownResponse = {
  data: {
    rollupKey: string;
    day: string;
    members: Array<{ membershipId: string; displayName: string }>;
    capped: boolean;
  };
};
