export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldLearnerPage } from "../../../../../../features/admin/reports/AdminCustomFieldLearnerPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type Props = {
  params: Promise<{ membershipId: string }>;
};

export default async function AdminCustomFieldLearnerRoutePage({ params }: Props) {
  const { membershipId } = await params;
  const decoded = decodeURIComponent(membershipId);
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Learner field values"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Learner field values">
      <AdminCustomFieldLearnerPage membershipId={decoded} />
    </AdminPageGate>
  );
}
