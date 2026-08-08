export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldDetailPage } from "../../../../../../features/admin/reports/AdminCustomFieldDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type Props = {
  params: Promise<{ fieldKey: string }>;
};

export default async function AdminCustomFieldDetailRoutePage({ params }: Props) {
  const { fieldKey } = await params;
  const decoded = decodeURIComponent(fieldKey);
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Field detail"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Field detail">
      <AdminCustomFieldDetailPage fieldKey={decoded} />
    </AdminPageGate>
  );
}
