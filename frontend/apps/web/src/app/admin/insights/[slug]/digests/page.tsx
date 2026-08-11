import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminInsightDigestsPage } from "../../../../../features/admin/insights/AdminInsightDigestsPage";
import { getAdminInsightSection } from "../../../../../features/admin/insights/admin-insights-catalog";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminInsightDigestsRoutePage({ params }: PageProps) {
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
        title={`${section.title} digests`}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title={`${section.title} digests`}>
      <AdminInsightDigestsPage slug={slug} sectionTitle={section.title} />
    </AdminPageGate>
  );
}
