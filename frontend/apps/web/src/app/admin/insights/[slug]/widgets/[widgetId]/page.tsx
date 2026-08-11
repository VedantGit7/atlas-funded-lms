import { notFound, redirect } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminInsightWidgetDetailPage } from "../../../../../../features/admin/insights/AdminInsightWidgetDetailPage";
import {
  adminInsightContentHealthHref,
  getAdminInsightSection,
} from "../../../../../../features/admin/insights/admin-insights-catalog";
import type { InsightDashboardRange } from "../../../../../../features/admin/insights/admin-insights-api";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string; widgetId: string }>;
  searchParams: Promise<{ range?: string; overlay?: string }>;
};

function parseRange(value: string | undefined, slug: string): InsightDashboardRange {
  if (value === "30d" || value === "ytd" || value === "12m") return value;
  return slug === "school-vitals" ? "30d" : "12m";
}

export default async function AdminInsightWidgetDetailRoutePage({
  params,
  searchParams,
}: PageProps) {
  const { slug, widgetId } = await params;
  const query = await searchParams;
  const section = getAdminInsightSection(slug);
  if (!section) {
    notFound();
  }

  const decodedWidgetId = decodeURIComponent(widgetId);
  if (slug === "school-vitals" && decodedWidgetId === "content-health") {
    redirect(`${adminInsightContentHealthHref(slug)}?range=${parseRange(query.range, slug)}`);
  }
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title={section.title}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title={decodedWidgetId}>
      <AdminInsightWidgetDetailPage
        slug={slug}
        widgetId={decodedWidgetId}
        sectionTitle={section.title}
        initialRange={parseRange(query.range, slug)}
        overlay={query.overlay === "1"}
      />
    </AdminPageGate>
  );
}
