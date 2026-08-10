export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageRosterPage } from "../../../../../features/admin/reports/AdminResourceUsageRosterPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminResourceUsageInactiveRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Resource Usage Inactive Learners"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Resource Usage Inactive Learners">
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading...</p>}
      >
        <AdminResourceUsageRosterPage />
      </Suspense>
    </AdminPageGate>
  );
}
