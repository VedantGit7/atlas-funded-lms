import { z } from "zod";
import { normalizedResultSchema } from "../reports/reports.schemas";

export const insightWidgetSchema = z.object({
  id: z.string(),
  title: z.string(),
  defaultViz: z.enum([
    "kpi",
    "table",
    "pivot",
    "line",
    "area",
    "bar",
    "combo",
    "pie",
    "donut",
    "funnel",
    "progress",
    "scatter",
    "heatmap",
    "sparkline",
  ]),
  span: z.enum(["full", "half", "third"]).default("half"),
  data: normalizedResultSchema,
});

export const insightAlertSchema = z.object({
  id: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
  title: z.string(),
  message: z.string(),
  href: z.string().nullable(),
});

export const insightDashboardResponseSchema = z.object({
  data: z.object({
    slug: z.string(),
    title: z.string(),
    currency: z.string().optional(),
    alerts: z.array(insightAlertSchema).default([]),
    widgets: z.array(insightWidgetSchema),
  }),
});

export type InsightWidget = z.infer<typeof insightWidgetSchema>;
export type InsightAlert = z.infer<typeof insightAlertSchema>;
