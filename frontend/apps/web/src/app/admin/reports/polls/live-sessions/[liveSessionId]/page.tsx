export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminLiveSessionPollReportPage } from "../../../../../../features/admin/reports/AdminLiveSessionPollReportPage";
import { loadLiveSessionPollReportData } from "../../../../../../lib/server/report-polls-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ liveSessionId: string }>;
};

export default async function AdminLiveSessionPollReportRoutePage({ params }: PageProps) {
  const { liveSessionId } = await params;
  const [gate, initialReport] = await Promise.all([
    runTenantStateGate(),
    loadLiveSessionPollReportData(liveSessionId),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Live session polls"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Live session polls">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading session poll report…
          </p>
        }
      >
        <AdminLiveSessionPollReportPage
          liveSessionId={liveSessionId}
          initialReport={initialReport}
        />
      </Suspense>
    </AdminPageGate>
  );
}
