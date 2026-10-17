import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
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
import {
  loadActiveDevicesLandingData,
  loadBatchesLandingData,
  loadCustomFieldLandingData,
  loadEnrollmentsLandingData,
  loadExportsLandingData,
  loadLiveClassAttendanceLandingData,
  loadPaymentsLandingData,
  loadPollsLandingData,
  loadProgressScoreLandingData,
  loadResourceUsageLandingData,
  loadSalesMarketingLandingData,
  loadSuperLiveInsightsLandingData,
  loadZoomInsightsLandingData,
  type ReportSearchParams,
} from "../../../../lib/server/report-landing-initial-data";
import { runTenantStateGate } from "../../../../lib/server/tenant-state-gate";

type AdminReportPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<ReportSearchParams>;
};

function SuspenseLoading({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<p className="text-sm text-[var(--admin-on-surface-variant)]">Loading…</p>}>
      {children}
    </Suspense>
  );
}

/**
 * The report's landing page, arriving with its first data from the server
 * (see report-landing-initial-data). `search` is the page's address query,
 * which some reports read their opening filters or tab from.
 */
async function renderReport(
  slug: string,
  title: string,
  search: ReportSearchParams,
): Promise<ReactNode> {
  switch (slug) {
    case "enrollments": {
      const { roster, overview } = await loadEnrollmentsLandingData();
      return <AdminEnrollmentsRosterPage initialRoster={roster} initialOverview={overview} />;
    }
    case "active-devices": {
      const { roster, overview } = await loadActiveDevicesLandingData();
      return <AdminActiveDevicesRosterPage initialRoster={roster} initialOverview={overview} />;
    }
    case "payments": {
      const initialOverview = await loadPaymentsLandingData(search);
      return (
        <SuspenseLoading>
          <AdminPaymentsRosterPage initialOverview={initialOverview} />
        </SuspenseLoading>
      );
    }
    case "progress-score":
      return (
        <AdminProgressScoreOverviewPage initialOverview={await loadProgressScoreLandingData()} />
      );
    case "batches":
      return <AdminBatchesRosterPage initialRoster={await loadBatchesLandingData()} />;
    case "polls":
      return <AdminPollsRosterPage initialRoster={await loadPollsLandingData()} />;
    case "sales-marketing": {
      const initialOverview = await loadSalesMarketingLandingData(search);
      return (
        <SuspenseLoading>
          <AdminSalesMarketingRosterPage initialOverview={initialOverview} />
        </SuspenseLoading>
      );
    }
    case "custom-field": {
      const { roster, definitions } = await loadCustomFieldLandingData();
      return <AdminCustomFieldRosterPage initialRoster={roster} initialDefinitions={definitions} />;
    }
    case "zoom-insights":
      return <AdminZoomInsightsRosterPage initialMeetings={await loadZoomInsightsLandingData()} />;
    case "live-class-attendance":
      return (
        <AdminLiveClassAttendanceRosterPage
          initialSessions={await loadLiveClassAttendanceLandingData()}
        />
      );
    case "super-live-insights": {
      const initialSessions = await loadSuperLiveInsightsLandingData(search);
      return (
        <SuspenseLoading>
          <AdminSuperLiveInsightsRosterPage initialSessions={initialSessions} />
        </SuspenseLoading>
      );
    }
    case "resource-usage":
      return (
        <AdminResourceUsageRosterPage initialOverview={await loadResourceUsageLandingData()} />
      );
    case "exports":
      return <AdminExportsRosterPage initialHistory={await loadExportsLandingData()} />;
    default:
      return <AdminReportSectionPage slug={slug} title={title} />;
  }
}

export default async function AdminReportSlugPage({ params, searchParams }: AdminReportPageProps) {
  const [{ slug }, search] = await Promise.all([params, searchParams]);
  const section = getAdminReportSection(slug);
  if (!section) {
    notFound();
  }

  const [gate, content] = await Promise.all([
    runTenantStateGate(),
    renderReport(slug, section.title, search),
  ]);
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

  return (
    <AdminPageGate screenId="T50" state="ready" title={section.title}>
      {content}
    </AdminPageGate>
  );
}
