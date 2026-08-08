export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../../../../components/patterns/AdminPageGate";
import { AdminScoreAttemptReviewPage } from "../../../../../../../../../features/admin/reports/AdminScoreAttemptReviewPage";
import { runTenantStateGate } from "../../../../../../../../../lib/server/tenant-state-gate";

export default async function AdminScoreAttemptReviewRoutePage({
  params,
}: {
  params: Promise<{ assessmentId: string; attemptId: string }>;
}) {
  const { assessmentId, attemptId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(assessmentId) || !/^[0-9a-fA-F-]{36}$/.test(attemptId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Attempt review"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Attempt review">
      <AdminScoreAttemptReviewPage assessmentId={assessmentId} attemptId={attemptId} />
    </AdminPageGate>
  );
}
