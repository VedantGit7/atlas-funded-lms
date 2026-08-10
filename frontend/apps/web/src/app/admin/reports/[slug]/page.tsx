import { notFound } from "next/navigation";
import { Suspense } from "react";
import { AdminPageGate } from "../../../../components/patterns/AdminPageGate";
import { AdminActiveDevicesRosterPage } from "../../../../features/admin/reports/AdminActiveDevicesRosterPage";
import { AdminBatchesRosterPage } from "../../../../features/admin/reports/AdminBatchesRosterPage";
import { AdminCustomFieldRosterPage } from "../../../../features/admin/reports/AdminCustomFieldRosterPage";
import { AdminEnrollmentsRosterPage } from "../../../../features/admin/reports/AdminEnrollmentsRosterPage";
import { AdminPaymentsRosterPage } from "../../../../features/admin/reports/AdminPaymentsRosterPage";
import { AdminPollsRosterPage } from "../../../../features/admin/reports/AdminPollsRosterPage";
import { AdminProgressScoreOverviewPage } from "../../../../features/admin/reports/AdminProgressScoreOverviewPage";
import { AdminSalesMarketingRosterPage } from "../../../../features/admin/reports/AdminSalesMarketingRosterPage";
import { AdminZoomInsightsRosterPage } from "../../../../features/admin/reports/AdminZoomInsightsRosterPage";
import { AdminLiveClassAttendanceRosterPage } from "../../../../features/admin/reports/AdminLiveClassAttendanceRosterPage";
import { AdminSuperLiveInsightsRosterPage } from "../../../../features/admin/reports/AdminSuperLiveInsightsRosterPage";
import { AdminResourceUsageRosterPage } from "../../../../features/admin/reports/AdminResourceUsageRosterPage";
import { AdminExportsRosterPage } from "../../../../features/admin/reports/AdminExportsRosterPage";
import { AdminReportSectionPage } from "../../../../features/admin/reports/AdminReportSectionPage";
import { getAdminReportSection } from "../../../../features/admin/reports/admin-reports-catalog";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

type AdminReportPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function AdminReportSlugPage({ params }: AdminReportPageProps) {
  const { slug } = await params;
  const section = getAdminReportSection(slug);
  if (!section) {
    notFound();
  }

  const gate = await runTenantStateGate();
  if (gate.kind !== "ok") {
    return (
      <AdminPageGate
        screenId="T50"
        state="denied"
        title={section.title}
        deniedMessage="This academy is not available."
      />
    );
  }

  let content = <AdminReportSectionPage slug={slug} title={section.title} />;
  if (slug === "enrollments") {
    content = <AdminEnrollmentsRosterPage />;
  } else if (slug === "active-devices") {
    content = <AdminActiveDevicesRosterPage />;
  } else if (slug === "payments") {
    content = (
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminPaymentsRosterPage />
      </Suspense>
    );
  } else if (slug === "progress-score") {
    content = <AdminProgressScoreOverviewPage />;
  } else if (slug === "batches") {
    content = <AdminBatchesRosterPage />;
  } else if (slug === "polls") {
    content = <AdminPollsRosterPage />;
  } else if (slug === "sales-marketing") {
    content = (
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminSalesMarketingRosterPage />
      </Suspense>
    );
  } else if (slug === "custom-field") {
    content = <AdminCustomFieldRosterPage />;
  } else if (slug === "zoom-insights") {
    content = <AdminZoomInsightsRosterPage />;
  } else if (slug === "live-class-attendance") {
    content = <AdminLiveClassAttendanceRosterPage />;
  } else if (slug === "super-live-insights") {
    content = (
      <Suspense
        fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}
      >
        <AdminSuperLiveInsightsRosterPage />
      </Suspense>
    );
  } else if (slug === "resource-usage") {
    content = <AdminResourceUsageRosterPage />;
  } else if (slug === "exports") {
    content = <AdminExportsRosterPage />;
  }

  return (
    <AdminPageGate screenId="T50" state="ready" title={section.title}>
      {content}
    </AdminPageGate>
  );
}
