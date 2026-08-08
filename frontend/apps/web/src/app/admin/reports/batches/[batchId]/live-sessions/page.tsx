export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminBatchLiveSessionsPage } from "../../../../../../features/admin/reports/AdminBatchLiveSessionsPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function AdminBatchLiveSessionsRoutePage({ params }: PageProps) {
  const { batchId } = await params;
  const gate = await runTenantStateGate();
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
        <AdminBatchLiveSessionsPage batchId={batchId} />
      </Suspense>
    </AdminPageGate>
  );
}
