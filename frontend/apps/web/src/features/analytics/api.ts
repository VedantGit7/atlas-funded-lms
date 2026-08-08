import { clientApi } from "../../lib/client-api";
import type {
  AnalyticsDashboardResponse,
  AnalyticsDashboardDrillDownResponse,
  AnalyticsFunnelResponse,
  AnalyticsItemStatisticsResponse,
} from "@atlas/domain/analytics/analytics.contract";

export async function fetchAnalyticsDashboard(params: {
  dashboardKey?: string | undefined;
  courseId?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}): Promise<AnalyticsDashboardResponse> {
  const searchParams = new URLSearchParams();
  if (params.dashboardKey) searchParams.set("dashboardKey", params.dashboardKey);
  if (params.courseId) searchParams.set("courseId", params.courseId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  const path =
    query.length > 0 ? `/api/v1/analytics/dashboards?${query}` : "/api/v1/analytics/dashboards";

  return clientApi.get<AnalyticsDashboardResponse>(path);
}

export async function fetchAnalyticsFunnel(params: {
  funnelKey?: string | undefined;
  from?: string | undefined;
  to?: string | undefined;
}): Promise<AnalyticsFunnelResponse> {
  const searchParams = new URLSearchParams();
  if (params.funnelKey) searchParams.set("funnelKey", params.funnelKey);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  const query = searchParams.toString();
  const path = query.length > 0 ? `/api/v1/analytics/funnel?${query}` : "/api/v1/analytics/funnel";

  return clientApi.get<AnalyticsFunnelResponse>(path);
}

export async function fetchItemStatistics(params: {
  assessmentId: string;
  windowKey?: string | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}): Promise<AnalyticsItemStatisticsResponse> {
  const searchParams = new URLSearchParams({ assessmentId: params.assessmentId });
  if (params.windowKey) searchParams.set("windowKey", params.windowKey);
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));

  return clientApi.get<AnalyticsItemStatisticsResponse>(
    `/api/v1/analytics/item-statistics?${searchParams.toString()}`,
  );
}

export async function fetchDashboardDrillDown(params: {
  rollupKey: string;
  day: string;
  courseId?: string | undefined;
  limit?: number | undefined;
}): Promise<AnalyticsDashboardDrillDownResponse> {
  const searchParams = new URLSearchParams({
    rollupKey: params.rollupKey,
    day: params.day,
  });
  if (params.courseId) searchParams.set("courseId", params.courseId);
  if (params.limit) searchParams.set("limit", String(params.limit));

  return clientApi.get<AnalyticsDashboardDrillDownResponse>(
    `/api/v1/analytics/dashboards/drill-down?${searchParams.toString()}`,
  );
}

export type AtRiskAlert = {
  id: string;
  ruleId: string;
  ruleKey: string;
  ruleName: string;
  membershipId: string;
  displayName: string;
  status: "open" | "acknowledged";
  context: Record<string, unknown> | null;
  triggeredAt: string;
  acknowledgedAt: string | null;
};

export async function fetchAtRiskAlerts(params?: {
  status?: "open" | "acknowledged" | undefined;
  cursor?: string | undefined;
  limit?: number | undefined;
}): Promise<{
  data: { alerts: AtRiskAlert[]; pageInfo: { nextCursor: string | null; hasNextPage: boolean } };
}> {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.cursor) searchParams.set("cursor", params.cursor);
  if (params?.limit) searchParams.set("limit", String(params.limit));

  const query = searchParams.toString();
  const path =
    query.length > 0
      ? `/api/v1/analytics/at-risk/alerts?${query}`
      : "/api/v1/analytics/at-risk/alerts";
  return clientApi.get(path);
}

export async function acknowledgeAtRiskAlert(alertId: string): Promise<{ data: AtRiskAlert }> {
  return clientApi.post(`/api/v1/analytics/at-risk/alerts/${alertId}/acknowledge`, {});
}

export async function evaluateAtRiskAlerts(): Promise<{
  data: { evaluatedRules: number; alertsCreated: number; alertsUpdated: number };
}> {
  return clientApi.post("/api/v1/analytics/at-risk/evaluate", {});
}
