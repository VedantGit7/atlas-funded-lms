export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminBatchLiveSessionsPage } from "../../../../../../features/admin/reports/AdminBatchLiveSessionsPage";
import type { ReportSearchParams } from "../../../../../../lib/server/report-landing-initial-data";
import { loadBatchLiveSessionsData } from "../../../../../../lib/server/report-batches-initial-data";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
  searchParams: Promise<ReportSearchParams>;
};

export default async function AdminBatchLiveSessionsRoutePage({ params, searchParams }: PageProps) {
  const { batchId } = await params;
  const [gate, initialSessions] = await Promise.all([
    runTenantStateGate(),
    searchParams.then((search) => loadBatchLiveSessionsData(batchId, search)),
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
        <AdminBatchLiveSessionsPage batchId={batchId} initialSessions={initialSessions} />
      </Suspense>
    </AdminPageGate>
  );
}
