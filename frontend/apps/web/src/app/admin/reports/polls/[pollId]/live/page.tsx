export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminPollLiveMonitorPage } from "../../../../../../features/admin/reports/AdminPollLiveMonitorPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ pollId: string }>;
};

export default async function AdminPollLiveMonitorRoutePage({ params }: PageProps) {
  const { pollId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Live poll monitor"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Live poll monitor">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            Loading live poll monitor…
          </p>
        }
      >
        <AdminPollLiveMonitorPage pollId={pollId} />
      </Suspense>
    </AdminPageGate>
  );
}
