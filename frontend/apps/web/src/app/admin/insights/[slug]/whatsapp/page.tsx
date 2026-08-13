import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminInsightWhatsappPage } from "../../../../../features/admin/insights/AdminInsightWhatsappPage";
import { getAdminInsightSection } from "../../../../../features/admin/insights/admin-insights-catalog";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminInsightWhatsappRoutePage({ params }: PageProps) {
  const { slug } = await params;
  const section = getAdminInsightSection(slug);
  if (!section || slug !== "messenger-insight") {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title={`${section.title} WhatsApp`}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="WhatsApp">
      <AdminInsightWhatsappPage slug={slug} sectionTitle={section.title} />
    </AdminPageGate>
  );
}
