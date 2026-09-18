export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPollsExportsPage } from "../../../../../features/admin/reports/AdminPollsExportsPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPollsExportsRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Poll exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Poll exports">
      <Suspense
        fallback={
          <p className="p-8 text-sm text-[var(--admin-on-surface-variant)]">Loading exports…</p>
        }
      >
        <AdminPollsExportsPage />
      </Suspense>
    </AdminPageGate>
  );
}
