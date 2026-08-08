export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminBatchSessionAttendancePage } from "../../../../../../../features/admin/reports/AdminBatchSessionAttendancePage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string; sessionId: string }>;
};

export default async function AdminBatchSessionAttendanceRoutePage({ params }: PageProps) {
  const { batchId, sessionId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Session attendance"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Session attendance">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading session attendance…
          </p>
        }
      >
        <AdminBatchSessionAttendancePage batchId={batchId} sessionId={sessionId} />
      </Suspense>
    </AdminPageGate>
  );
}
