export const dynamic = "force-dynamic";

import { Suspense } from "react";
import { notFound } from "next/navigation";
import { AdminPageGate } from "../../../../../../components/patterns/AdminPageGate";
import { AdminCouponRedemptionsPanel } from "../../../../../../features/admin/reports/AdminCouponRedemptionsPanel";
import { runTenantStateGate } from "../../../../../../lib/server/tenant-state-gate";

export default async function AdminCouponRedemptionsRoutePage({
  params,
}: {
  params: Promise<{ couponId: string }>;
}) {
  const { couponId } = await params;
  if (!/^[0-9a-fA-F-]{36}$/.test(couponId)) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title="Coupon redemptions"
        deniedMessage="This academy is not available."
      />
    );
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title="Coupon redemptions">
      <Suspense
        fallback={
          <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>
        }
      >
        <AdminCouponRedemptionsPanel couponId={couponId} />
      </Suspense>
    </AdminPageGate>
  );
}
