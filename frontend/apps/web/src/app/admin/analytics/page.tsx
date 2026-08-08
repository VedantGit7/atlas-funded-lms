import type { z } from "zod";
import { AdminPageGate } from "../../../components/patterns/AdminPageGate";
import { AnalyticsDashboard } from "../../../features/analytics/components/analytics-dashboard";
import type { assessmentListResponseSchema } from "../../../features/assessments/assessment-response-schemas";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type AssessmentListResponse = z.infer<typeof assessmentListResponseSchema>;

const EMPTY_ASSESSMENTS: AssessmentListResponse = {
  data: [],
  page: { hasMore: false, nextCursor: null },
};

export default async function AdminAnalyticsPage() {
  try {
    const assessments = await serverApi
      .get<AssessmentListResponse>("/api/v1/assessments?limit=50")
      .catch(() => EMPTY_ASSESSMENTS);

    return (
      <AdminPageGate screenId="T21" state="ready" title="Analytics">
        <main>
          <AnalyticsDashboard
            mode="admin"
            canViewFunnel
            initialAssessments={assessments.data.map((assessment) => ({
              id: assessment.id,
              title: assessment.title,
            }))}
          />
        </main>
      </AdminPageGate>
    );
  } catch (error) {
    if (
      error instanceof ServerApiError &&
      error.status === 403 &&
      error.code === "ENTITLEMENT_REQUIRED"
    ) {
      return (
        <AdminPageGate
          screenId="T21"
          state="denied"
          title="Analytics"
          deniedMessage="Advanced analytics requires the analytics.dashboard.view entitlement."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <AdminPageGate
          screenId="T21"
          state="denied"
          title="Analytics"
          deniedMessage="You do not have permission to view tenant analytics."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <AdminPageGate
          screenId="T21"
          state="error"
          title="Analytics"
          errorMessage={`Failed to load analytics. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
