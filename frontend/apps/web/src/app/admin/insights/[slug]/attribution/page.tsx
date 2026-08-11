import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminInsightAttributionPage } from "../../../../../features/admin/insights/AdminInsightAttributionPage";
import { getAdminInsightSection } from "../../../../../features/admin/insights/admin-insights-catalog";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminInsightAttributionRoutePage({ params }: PageProps) {
  const { slug } = await params;
  const section = getAdminInsightSection(slug);
  if (!section || slug !== "sales-insight") {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title={`${section.title} attribution`}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="Attribution">
      <AdminInsightAttributionPage slug={slug} sectionTitle={section.title} />
    </AdminPageGate>
  );
}
