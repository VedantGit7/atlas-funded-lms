export const dynamic = "force-dynamic";

import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminCustomFieldCataloguePage } from "../../../../../features/admin/reports/AdminCustomFieldCataloguePage";
import { loadCustomFieldCatalogueData } from "../../../../../lib/server/report-custom-field-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminCustomFieldFieldsRoutePage() {
  const [gate, initialCatalogue] = await Promise.all([
    runTenantStateGate(),
    loadCustomFieldCatalogueData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Fields"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Fields">
      <AdminCustomFieldCataloguePage initialCatalogue={initialCatalogue} />
    </AdminPageGate>
  );
}
