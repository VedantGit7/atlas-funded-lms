export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldSegmentBuilderPage } from "../../../../../../features/admin/reports/AdminCustomFieldSegmentBuilderPage";
import { loadSegmentBuilderData } from "../../../../../../lib/server/report-custom-field-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldSegmentNewPage() {
  const [gate, initialBuilder] = await Promise.all([
    runTenantStateGate(),
    loadSegmentBuilderData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="New segment"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="New segment">
      <AdminCustomFieldSegmentBuilderPage initialBuilder={initialBuilder} />
    </AdminPageGate>
  );
}
