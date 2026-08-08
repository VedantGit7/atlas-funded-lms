import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { CtaBuilderPanel } from "../../../../../features/admin/grow/CtaBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminCtaBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T92"
        state="denied"
        title="CTA"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T92" state="ready" title="CTA">
      <CtaBuilderPanel ctaId={id} />
    </AdminPageGate>
  );
}
