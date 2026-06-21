import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { AnalyticsDashboard } from "../../../features/analytics/components/analytics-dashboard";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type AssessmentListResponse = {
  data: {
    items: Array<{ id: string; title: string }>;
  };
};

export default async function AdminAnalyticsPage() {
  try {
    const assessments = await serverApi
      .get<AssessmentListResponse>("/api/v1/assessments?limit=50")
      .catch(() => ({ data: { items: [] as Array<{ id: string; title: string }> } }));

    return (
      <PageGate state="ready" title="Analytics">
        <main className="space-y-6">
          <PageHeader
            title="Analytics"
            description="Tenant-wide learning, funnel, and assessment item performance."
          />
          <AnalyticsDashboard
            mode="admin"
            canViewFunnel
            initialAssessments={assessments.data.items}
          />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (
      error instanceof ServerApiError &&
      error.status === 403 &&
      error.code === "ENTITLEMENT_REQUIRED"
    ) {
      return (
        <PageGate
          state="denied"
          title="Analytics"
          deniedMessage="Advanced analytics requires the analytics.dashboard.view entitlement."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Analytics"
          deniedMessage="You do not have permission to view tenant analytics."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Analytics"
          errorMessage={`Failed to load analytics. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
