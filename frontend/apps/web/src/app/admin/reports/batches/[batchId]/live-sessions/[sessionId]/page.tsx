export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminBatchSessionAttendancePage } from "../../../../../../../features/admin/reports/AdminBatchSessionAttendancePage";
import type { ReportSearchParams } from "../../../../../../../lib/server/report-landing-initial-data";
import { loadBatchSessionAttendanceData } from "../../../../../../../lib/server/report-batches-initial-data";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string; sessionId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminBatchSessionAttendanceRoutePage({
  params,
  searchParams,
}: PageProps) {
  const { batchId, sessionId } = await params;
  const [gate, initialAttendance] = await Promise.all([
    runTenantStateGate(),
    searchParams.then((search) => loadBatchSessionAttendanceData(batchId, sessionId, search)),
  ]);
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
        <AdminBatchSessionAttendancePage
          batchId={batchId}
          sessionId={sessionId}
          initialAttendance={initialAttendance}
        />
      </Suspense>
    </AdminPageGate>
  );
}
