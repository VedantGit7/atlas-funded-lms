export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldSegmentBuilderPage } from "../../../../../../../features/admin/reports/AdminCustomFieldSegmentBuilderPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldSegmentEditPage({
  params,
}: {
  params: Promise<{ segmentId: string }>;
}) {
  const { segmentId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Edit segment"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Edit segment">
      <AdminCustomFieldSegmentBuilderPage segmentId={segmentId} />
    </AdminPageGate>
  );
}
