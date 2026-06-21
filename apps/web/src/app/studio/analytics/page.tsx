import type { EntitlementView } from "@atlas/domain-config/schemas/entitlements";
import { PageGate, PageHeader } from "../../../components/patterns/PageGate";
import { AnalyticsDashboard } from "../../../features/analytics/components/analytics-dashboard";
import { ServerApiError, serverApi } from "../../../lib/server-api";

type CourseOption = { id: string; title: string };
type AssessmentOption = { id: string; title: string };

type StudioCoursesResponse = {
  data: {
    items: Array<{ id: string; title: string }>;
  };
};

type StudioAssessmentsResponse = {
  data: {
    items: Array<{ id: string; title: string }>;
  };
};

function hasAnalyticsEntitlement(entitlements: EntitlementView[]): boolean {
  return entitlements.some((entry) => entry.key === "analytics.dashboard.view" && entry.enabled);
}

export default async function StudioAnalyticsPage() {
  try {
    const entitlements = await serverApi.get<{ data: EntitlementView[] }>("/api/v1/entitlements");

    if (!hasAnalyticsEntitlement(entitlements.data)) {
      return (
        <PageGate
          state="denied"
          title="Studio Analytics"
          deniedMessage="Advanced analytics requires the analytics.dashboard.view entitlement."
        />
      );
    }

    const [courses, assessments] = await Promise.all([
      serverApi.get<StudioCoursesResponse>("/api/v1/courses?view=studio&limit=50").catch(() => ({
        data: { items: [] as CourseOption[] },
      })),
      serverApi.get<StudioAssessmentsResponse>("/api/v1/assessments?limit=50").catch(() => ({
        data: { items: [] as AssessmentOption[] },
      })),
    ]);

    return (
      <PageGate state="ready" title="Studio Analytics">
        <main className="space-y-6">
          <PageHeader
            title="Studio Analytics"
            description="Review completion and item performance for courses and assessments you author."
          />
          <AnalyticsDashboard
            mode="studio"
            canViewFunnel={false}
            initialCourses={courses.data.items}
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
          title="Studio Analytics"
          deniedMessage="Advanced analytics requires the analytics.dashboard.view entitlement."
        />
      );
    }

    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Studio Analytics"
          deniedMessage="You do not have permission to view studio analytics."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Studio Analytics"
          errorMessage={`Failed to load studio analytics. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
