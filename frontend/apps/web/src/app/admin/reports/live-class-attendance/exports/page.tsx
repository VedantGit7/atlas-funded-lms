export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassAttendanceExportsPage } from "../../../../../features/admin/reports/AdminLiveClassAttendanceExportsPage";
import type { LiveClassAttendanceExportsPayload } from "../../../../../features/admin/reports/admin-live-class-attendance-exports-api";
import { loadReportInitialData } from "../../../../../lib/server/report-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

export default async function AdminLiveClassAttendanceExportsRoutePage() {
  const [gate, initialExports] = await Promise.all([
    runTenantStateGate(),
    loadReportInitialData<LiveClassAttendanceExportsPayload>(
      "/api/v1/reports/live-class-attendance/exports",
    ),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T51"
        state="denied"
        title="Attendance exports"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T51" state="ready" title="Attendance exports">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading exports…</p>
        }
      >
        <AdminLiveClassAttendanceExportsPage initialExports={initialExports} />
      </Suspense>
    </AdminPageGate>
  );
}
