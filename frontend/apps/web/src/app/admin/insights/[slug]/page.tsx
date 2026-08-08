import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminInsightDashboardPage } from "../../../../features/admin/insights/AdminInsightDashboardPage";
import { getAdminInsightSection } from "../../../../features/admin/insights/admin-insights-catalog";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

type AdminInsightPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminInsightSectionPage({ params }: AdminInsightPageProps) {
  const { slug } = await params;
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
        title={section.title}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title={section.title}>
      <AdminInsightDashboardPage slug={slug} title={section.title} />
    </AdminPageGate>
  );
}
