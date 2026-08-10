export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminZoomInsightsParticipantDetailPage } from "../../../../../../../features/admin/reports/AdminZoomInsightsParticipantDetailPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ meetingId: string; participantId: string }>;
};

export default async function AdminZoomInsightsParticipantDetailRoutePage({ params }: PageProps) {
  const { meetingId, participantId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Zoom participant"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Zoom participant">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading participant…</p>
        }
      >
        <AdminZoomInsightsParticipantDetailPage
          meetingId={meetingId}
          participantId={participantId}
        />
      </Suspense>
    </AdminPageGate>
  );
}
