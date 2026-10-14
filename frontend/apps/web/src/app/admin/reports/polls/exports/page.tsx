export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPollsExportsPage } from "../../../../../features/admin/reports/AdminPollsExportsPage";
import type { PollsExportsPayload } from "../../../../../features/admin/reports/admin-polls-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPollsExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<PollsExportsPayload>("/api/v1/reports/polls/exports"),
  ]);
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
        <AdminPollsExportsPage initialExports={initialExports} />
      </Suspense>
    </AdminPageGate>
  );
}
