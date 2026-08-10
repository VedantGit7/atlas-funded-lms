export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassLearnerAttendanceDetailPage } from "../../../../../../features/admin/reports/AdminLiveClassLearnerAttendanceDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ membershipId: string }>;
};

export default async function AdminLiveClassLearnerAttendanceDetailRoutePage({
  params,
}: PageProps) {
  const { membershipId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Learner attendance"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Learner attendance">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading learner…</p>
        }
      >
        <AdminLiveClassLearnerAttendanceDetailPage membershipId={membershipId} />
      </Suspense>
    </AdminPageGate>
  );
}
