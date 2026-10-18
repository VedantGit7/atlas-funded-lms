export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminActiveDevicesSessionDetailPage } from "../../../../../../features/admin/reports/AdminActiveDevicesSessionDetailPage";
import { loadActiveDevicesSessionData } from "../../../../../../lib/server/report-active-devices-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ membershipId: string; deviceId: string }>;
};

export default async function AdminActiveDevicesSessionPage({ params }: PageProps) {
  const { membershipId, deviceId } = await params;
  const [gate, initialDetail] = await Promise.all([
    runTenantStateGate(),
    loadActiveDevicesSessionData(membershipId, deviceId),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Device session"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Device session">
      <AdminActiveDevicesSessionDetailPage
        membershipId={membershipId}
        deviceId={deviceId}
        initialDetail={initialDetail}
      />
    </AdminPageGate>
  );
}
