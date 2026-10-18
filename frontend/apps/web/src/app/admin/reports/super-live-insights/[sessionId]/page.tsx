export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminSuperLiveInsightDetailPage } from "../../../../../features/admin/reports/AdminSuperLiveInsightDetailPage";
import { loadSuperLiveInsightDetailData } from "../../../../../lib/server/report-super-live-insights-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ sessionId: string }>;
};

export default async function AdminSuperLiveInsightDetailRoutePage({ params }: PageProps) {
  const { sessionId } = await params;
  const [gate, initialDetail] = await Promise.all([
    runTenantStateGate(),
    loadSuperLiveInsightDetailData(sessionId),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Session insight"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Session insight">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading session…</p>
        }
      >
        <AdminSuperLiveInsightDetailPage sessionId={sessionId} initialDetail={initialDetail} />
      </Suspense>
    </AdminPageGate>
  );
}
