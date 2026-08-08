export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPollsComparePage } from "../../../../../features/admin/reports/AdminPollsComparePage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPollsCompareRoutePage() {
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Compare polls"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Compare polls">
      <Suspense
        fallback={
          <p className="p-8 text-sm text-[var(--admin-on-surface-variant)]">
            Loading comparison…
          </p>
        }
      >
        <AdminPollsComparePage />
      </Suspense>
    </AdminPageGate>
  );
}
