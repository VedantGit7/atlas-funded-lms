export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminActiveDevicesLearnerDetailPage } from "../../../../../features/admin/reports/AdminActiveDevicesLearnerDetailPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ membershipId: string }>;
};

export default async function AdminActiveDevicesLearnerPage({ params }: PageProps) {
  const { membershipId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Learner devices"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Learner devices">
      <AdminActiveDevicesLearnerDetailPage membershipId={membershipId} />
    </AdminPageGate>
  );
}
