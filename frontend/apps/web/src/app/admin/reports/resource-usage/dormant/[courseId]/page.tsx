export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminResourceUsageDormantCourseDetailPage } from "../../../../../../features/admin/reports/AdminResourceUsageDormantCourseDetailPage";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

type PageProps = {
  params: Promise<{ courseId: string }>;
};

export default async function AdminResourceUsageDormantCourseRoutePage({ params }: PageProps) {
  const { courseId } = await params;
  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Dormant course detail"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Dormant course detail">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading course...</p>
        }
      >
        <AdminResourceUsageDormantCourseDetailPage courseId={courseId} />
      </Suspense>
    </AdminPageGate>
  );
}
