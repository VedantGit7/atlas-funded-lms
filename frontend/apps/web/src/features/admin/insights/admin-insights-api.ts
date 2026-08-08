"use client";

import { clientApi } from "../../../lib/client-api";
import type { NormalizedResult, VizType } from "../../analytics/viz";

export type InsightWidget = {
  id: string;
  title: string;
  defaultViz: VizType;
  span: "full" | "half" | "third";
  data: NormalizedResult;
};

export type InsightAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  message: string;
  href: string | null;
};

export type InsightDashboard = {
  slug: string;
  title: string;
  currency?: string;
  alerts: InsightAlert[];
  widgets: InsightWidget[];
};

export async function fetchInsightDashboard(slug: string) {
  return clientApi.get<{ data: InsightDashboard }>(`/api/v1/insights/${encodeURIComponent(slug)}`);
}
