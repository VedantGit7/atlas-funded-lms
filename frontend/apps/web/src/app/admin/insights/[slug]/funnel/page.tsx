import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminInsightFunnelPage } from "../../../../../features/admin/insights/AdminInsightFunnelPage";
import { getAdminInsightSection } from "../../../../../features/admin/insights/admin-insights-catalog";
import type { InsightDashboardRange } from "../../../../../features/admin/insights/admin-insights-api";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string }>;
};

function parseRange(value: string | undefined): InsightDashboardRange {
  if (value === "30d" || value === "ytd" || value === "12m") return value;
  return "30d";
}

export default async function AdminInsightFunnelRoutePage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const query = await searchParams;
  const section = getAdminInsightSection(slug);
  if (!section || slug !== "school-vitals") {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title={`${section.title} funnel`}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="Learning engagement funnel">
      <AdminInsightFunnelPage
        slug={slug}
        sectionTitle={section.title}
        initialRange={parseRange(query.range)}
      />
    </AdminPageGate>
  );
}
