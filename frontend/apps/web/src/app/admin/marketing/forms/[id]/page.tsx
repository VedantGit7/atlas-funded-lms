import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { FormsBuilderPanel } from "../../../../../features/admin/grow/FormsBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminFormBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T88"
        state="denied"
        title="Form"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T88" state="ready" title="Form">
      <FormsBuilderPanel formId={id} />
    </AdminPageGate>
  );
}
