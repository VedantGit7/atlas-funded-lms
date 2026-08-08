import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { LearnerBillingSettingsShell } from "../../../../../features/admin/learner-billing/LearnerBillingSettingsShell";
import { LocationAddPanel } from "../../../../../features/admin/learner-billing/LocationAddPanel";

export default function AddLocationPageRoute() {
  return (
    <AdminPageGate screenId="T38" state="ready" title="Locations">
      <LearnerBillingSettingsShell>
        <LocationAddPanel />
      </LearnerBillingSettingsShell>
    </AdminPageGate>
  );
}
