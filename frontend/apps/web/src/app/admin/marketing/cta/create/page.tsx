import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { CtaCreatePanel } from "../../../../../features/admin/grow/CtaCreatePanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCtaCreatePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T91"
        state="denied"
        title="Create CTA"
        deniedMessage="This academy is not available."
      />
    );
  }
  return (
    <AdminPageGate screenId="T91" state="ready" title="Create CTA">
      <CtaCreatePanel />
    </AdminPageGate>
  );
}
