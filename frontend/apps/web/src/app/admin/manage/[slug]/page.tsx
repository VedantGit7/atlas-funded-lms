import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminManageSectionPage } from "../../../../features/admin/manage/AdminManageSectionPage";
import { getAdminManageSection } from "../../../../features/admin/manage/admin-manage-catalog";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

type AdminManagePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminManageSlugPage({ params }: AdminManagePageProps) {
  const { slug } = await params;
  const section = getAdminManageSection(slug);
  if (!section) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T60"
        state="denied"
        title={section.title}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T60" state="ready" title={section.title}>
      <AdminManageSectionPage slug={section.slug} />
    </AdminPageGate>
  );
}
