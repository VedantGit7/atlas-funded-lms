import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminInsightAlertsPage } from "../../../../../features/admin/insights/AdminInsightAlertsPage";
import { getAdminInsightSection } from "../../../../../features/admin/insights/admin-insights-catalog";
import type { InsightDashboardRange } from "../../../../../features/admin/insights/admin-insights-api";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; tab?: string }>;
};

function parseRange(value: string | undefined, slug: string): InsightDashboardRange {
  if (value === "30d" || value === "ytd" || value === "12m") return value;
  return slug === "school-vitals" ? "30d" : "12m";
}

function parseTab(value: string | undefined): "open" | "resolved" | "muted" | "rules" {
  if (value === "resolved" || value === "muted" || value === "rules" || value === "open") {
    return value;
  }
  return "open";
}

export default async function AdminInsightAlertsRoutePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const section = getAdminInsightSection(slug);
  if (!section) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title={`${section.title} alerts`}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title={`${section.title} alerts`}>
      <AdminInsightAlertsPage
        slug={slug}
        sectionTitle={section.title}
        initialRange={parseRange(query.range, slug)}
        initialTab={parseTab(query.tab)}
      />
    </AdminPageGate>
  );
}
