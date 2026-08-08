export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldSegmentDetailPage } from "../../../../../../features/admin/reports/AdminCustomFieldSegmentDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldSegmentDetailRoutePage({
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
        title="Segment"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Segment">
      <AdminCustomFieldSegmentDetailPage segmentId={segmentId} />
    </AdminPageGate>
  );
}
