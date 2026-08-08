import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminGrowSectionPage } from "../../../../features/admin/grow/AdminGrowSectionPage";
import { getAdminSalesSection } from "../../../../features/admin/grow/admin-sales-catalog";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

type AdminSalesSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminSalesSlugPage({ params }: AdminSalesSlugPageProps) {
  const { slug } = await params;
  const section = getAdminSalesSection(slug);
  if (!section) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T69"
        state="denied"
        title={section.title}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T69" state="ready" title={section.title}>
      <AdminGrowSectionPage kind="sales" slug={section.slug} />
    </AdminPageGate>
  );
}
