export const ADMIN_INSIGHT_SECTIONS = [
  { slug: "dashboard", label: "Dashboard", title: "Dashboard" },
  { slug: "school-vitals", label: "School Vitals", title: "School Vitals" },
  { slug: "sales-insight", label: "Sales Insight", title: "Sales Insight" },
  { slug: "live-dashboard", label: "Live Dashboard", title: "Live Dashboard" },
  { slug: "marketing-insight", label: "Marketing Insight", title: "Marketing Insight" },
  { slug: "messenger-insight", label: "Messenger Insight", title: "Messenger Insight" },
] as const;

export type AdminInsightSlug = (typeof ADMIN_INSIGHT_SECTIONS)[number]["slug"];

export function getAdminInsightSection(slug: string) {
  return ADMIN_INSIGHT_SECTIONS.find((section) => section.slug === slug) ?? null;
}

export const ADMIN_INSIGHTS_HREF = "/admin/insights";
export const ADMIN_INSIGHTS_DEFAULT_HREF = `${ADMIN_INSIGHTS_HREF}/dashboard`;

export function adminInsightHref(slug: string): string {
  return `${ADMIN_INSIGHTS_HREF}/${slug}`;
}

export function adminInsightWidgetHref(slug: string, widgetId: string): string {
  return `${adminInsightHref(slug)}/widgets/${encodeURIComponent(widgetId)}`;
}

export function adminInsightFunnelHref(slug: string): string {
  return `${adminInsightHref(slug)}/funnel`;
}

export function adminInsightPipelineHref(slug: string): string {
  return `${adminInsightHref(slug)}/pipeline`;
}

export function adminInsightAttributionHref(slug: string): string {
  return `${adminInsightHref(slug)}/attribution`;
}

export function adminInsightOpportunityHref(slug: string): string {
  return `${adminInsightHref(slug)}/opportunity`;
}

export function adminInsightContentHealthHref(slug: string): string {
  return `${adminInsightHref(slug)}/content-health`;
}

export function adminInsightAlertsHref(slug: string): string {
  return `${adminInsightHref(slug)}/alerts`;
}

export function adminInsightCustomizeHref(slug: string): string {
  return `${adminInsightHref(slug)}/customize`;
}

export function adminInsightLibraryHref(slug: string): string {
  return `${adminInsightHref(slug)}/library`;
}

export function adminInsightDigestsHref(slug: string): string {
  return `${adminInsightHref(slug)}/digests`;
}

export function adminInsightSettingsHref(slug: string): string {
  return `${adminInsightHref(slug)}/settings`;
}
