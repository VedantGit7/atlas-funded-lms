import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminInsightLibraryPage } from "../../../../../features/admin/insights/AdminInsightLibraryPage";
import { getAdminInsightSection } from "../../../../../features/admin/insights/admin-insights-catalog";
import type { InsightDashboardRange } from "../../../../../features/admin/insights/admin-insights-api";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ range?: string; target?: string }>;
};

function parseRange(value: string | undefined): InsightDashboardRange {
  if (value === "30d" || value === "ytd" || value === "12m") return value;
  return "12m";
}

export default async function AdminInsightLibraryRoutePage({ params, searchParams }: PageProps) {
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
        title={`${section.title} library`}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title={`${section.title} library`}>
      <AdminInsightLibraryPage
        slug={slug}
        sectionTitle={section.title}
        initialRange={parseRange(query.range)}
        initialTarget={query.target}
      />
    </AdminPageGate>
  );
}
