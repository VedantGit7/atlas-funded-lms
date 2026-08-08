import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminGrowSectionPage } from "../../../../features/admin/grow/AdminGrowSectionPage";
import {
  getAdminMarketingSection,
  type AdminMarketingSlug,
} from "../../../../features/admin/grow/admin-marketing-catalog";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

type AdminMarketingSlugPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminMarketingSlugPage({ params }: AdminMarketingSlugPageProps) {
  const { slug } = await params;
  const section = getAdminMarketingSection(slug);
  if (!section || ("href" in section && section.href)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T68"
        state="denied"
        title={section.title}
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T68" state="ready" title={section.title}>
      <AdminGrowSectionPage kind="marketing" slug={section.slug as AdminMarketingSlug} />
    </AdminPageGate>
  );
}
