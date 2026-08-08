export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminBatchMessagesPage } from "../../../../../../features/admin/reports/AdminBatchMessagesPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ batchId: string }>;
};

export default async function AdminBatchMessagesRoutePage({ params }: PageProps) {
  const { batchId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Messages"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Messages">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading messages…</p>
        }
      >
        <AdminBatchMessagesPage batchId={batchId} />
      </Suspense>
    </AdminPageGate>
  );
}
