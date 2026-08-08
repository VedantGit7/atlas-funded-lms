import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { WorkflowsBuilderPanel } from "../../../../../features/admin/grow/WorkflowsBuilderPanel";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminWorkflowBuilderPage({ params }: PageProps) {
  const { id } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T86"
        state="denied"
        title="Workflow"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T86" state="ready" title="Workflow">
      <Suspense fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}>
        <WorkflowsBuilderPanel workflowId={id} />
      </Suspense>
    </AdminPageGate>
  );
}
