export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../../components/patterns/AdminPageGate";
import { AdminLiveClassAttendeeDetailPage } from "../../../../../../../features/admin/reports/AdminLiveClassAttendeeDetailPage";
import { runTenantStateGate } from "../../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ sessionId: string; attendeeId: string }>;
};

export default async function AdminLiveClassAttendeeDetailRoutePage({ params }: PageProps) {
  const { sessionId, attendeeId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Live class attendee"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Live class attendee">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading attendee…</p>
        }
      >
        <AdminLiveClassAttendeeDetailPage sessionId={sessionId} attendeeId={attendeeId} />
      </Suspense>
    </AdminPageGate>
  );
}
