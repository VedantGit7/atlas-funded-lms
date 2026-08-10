export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassAttendanceSessionDetailPage } from "../../../../../features/admin/reports/AdminLiveClassAttendanceSessionDetailPage";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function AdminLiveClassAttendanceSessionDetailRoutePage({
  params,
}: PageProps) {
  const { sessionId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Live class session"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Live class session">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading session…</p>
        }
      >
        <AdminLiveClassAttendanceSessionDetailPage sessionId={sessionId} />
      </Suspense>
    </AdminPageGate>
  );
}
