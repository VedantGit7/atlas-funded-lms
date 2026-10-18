export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../components/patterns/AdminPageGate";
import { AdminZoomInsightsMeetingDetailPage } from "../../../../../features/admin/reports/AdminZoomInsightsMeetingDetailPage";
import { loadZoomMeetingDetailData } from "../../../../../lib/server/report-zoom-insights-initial-data";
import { runTenantStateGate } from "../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ meetingId: string }>;
};

export default async function AdminZoomInsightsMeetingDetailRoutePage({ params }: PageProps) {
  const { meetingId } = await params;
  const [gate, initial] = await Promise.all([
    runTenantStateGate(),
    loadZoomMeetingDetailData(meetingId),
  ]);
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Zoom meeting"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Zoom meeting">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading meeting…</p>
        }
      >
        <AdminZoomInsightsMeetingDetailPage
          meetingId={meetingId}
          initialDetail={initial.detail}
          initialParticipants={initial.participants}
        />
      </Suspense>
    </AdminPageGate>
  );
}
