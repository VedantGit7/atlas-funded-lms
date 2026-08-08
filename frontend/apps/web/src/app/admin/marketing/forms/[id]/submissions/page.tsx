import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { FormsSubmissionsPanel } from "../../../../../../features/admin/grow/FormsSubmissionsPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminFormSubmissionsPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T89"
        state="denied"
        title="Form Submissions"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T89" state="ready" title="Form Submissions">
      <FormsSubmissionsPanel formId={id} />
    </AdminPageGate>
  );
}
