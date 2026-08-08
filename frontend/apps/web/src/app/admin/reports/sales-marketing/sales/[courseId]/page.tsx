export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminProductPurchasersPanel } from "../../../../../../features/admin/reports/AdminProductPurchasersPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminProductPurchasersRoutePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(courseId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Purchasers"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Purchasers">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        }
      >
        <AdminProductPurchasersPanel courseId={courseId} />
      </Suspense>
    </AdminPageGate>
  );
}
