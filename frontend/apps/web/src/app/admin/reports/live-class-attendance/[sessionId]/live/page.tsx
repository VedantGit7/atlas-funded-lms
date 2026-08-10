export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassAttendanceLiveMonitorPage } from "../../../../../../features/admin/reports/AdminLiveClassAttendanceLiveMonitorPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function AdminLiveClassAttendanceLiveMonitorRoutePage({ params }: PageProps) {
  const { sessionId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Live session monitor"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Live session monitor">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading live session monitor…
          </p>
        }
      >
        <AdminLiveClassAttendanceLiveMonitorPage sessionId={sessionId} />
      </Suspense>
    </AdminPageGate>
  );
}
