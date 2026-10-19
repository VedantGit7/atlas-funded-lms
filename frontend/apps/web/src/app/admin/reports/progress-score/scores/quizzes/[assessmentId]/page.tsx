export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { AdminPageGate } from "@/components/patterns/AdminPageGate";
import { AdminScoreQuizLearnersPage } from "@/features/admin/reports/AdminScoreQuizLearnersPage";
import { loadScoreLearnersData } from "@/lib/server/report-progress-score-initial-data";
import { runTenantStateGate } from "@/lib/server/tenant-state-gate";

export default async function AdminScoreQuizLearnersRoutePage({
  params,
}: {
  params: Promise<{ assessmentId: string }>;
}) {
  const { assessmentId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(assessmentId)) {
    notFound();
  }

  const [gate, initialLearners] = await Promise.all([
    runTenantStateGate(),
    loadScoreLearnersData(assessmentId),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Assessment learners"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Assessment learners">
      <AdminScoreQuizLearnersPage assessmentId={assessmentId} initialLearners={initialLearners} />
    </AdminPageGate>
  );
}
