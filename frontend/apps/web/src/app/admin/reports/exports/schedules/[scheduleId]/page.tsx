export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminExportScheduleDetailPage } from "../../../../../../features/admin/reports/AdminExportScheduleDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ scheduleId: string }>;
};

export default async function AdminExportScheduleDetailRoutePage({ params }: PageProps) {
  const { scheduleId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Schedule"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title={`Schedule ${scheduleId}`}>
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading schedule…</p>
        }
      >
        <AdminExportScheduleDetailPage />
      </Suspense>
    </AdminPageGate>
  );
}
