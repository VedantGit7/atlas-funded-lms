export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminPollsLiveSessionsPage } from "../../../../../features/admin/reports/AdminPollsLiveSessionsPage";
import { loadPollsLiveSessionsData } from "../../../../../lib/server/report-polls-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminPollsLiveSessionsRoutePage() {
  const [gate, initialSessions] = await Promise.all([
    runTenantStateGate(),
    loadPollsLiveSessionsData(),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Live sessions"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Live sessions">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading live sessions…</p>
        }
      >
        <AdminPollsLiveSessionsPage initialSessions={initialSessions} />
      </Suspense>
    </AdminPageGate>
  );
}
