import { clientApi } from "../../lib/client-api";
import type {
  AnalyticsDashboardResponse,
  AnalyticsFunnelResponse,
  AnalyticsItemStatisticsResponse,
} from "@atlas/domain/analytics/analytics.contract";

export async function fetchAnalyticsDashboard(params: {
  dashboardKey?: string;
  courseId?: string;
  from?: string;
  to?: string;
  cursor?: string;
  limit?: number;
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
  funnelKey?: string;
  from?: string;
  to?: string;
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
  windowKey?: string;
  cursor?: string;
  limit?: number;
}): Promise<AnalyticsItemStatisticsResponse> {
  const searchParams = new URLSearchParams({ assessmentId: params.assessmentId });
  if (params.windowKey) searchParams.set("windowKey", params.windowKey);
  if (params.cursor) searchParams.set("cursor", params.cursor);
  if (params.limit) searchParams.set("limit", String(params.limit));

  return clientApi.get<AnalyticsItemStatisticsResponse>(
    `/api/v1/analytics/item-statistics?${searchParams.toString()}`,
  );
}
