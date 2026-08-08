import type { z } from "zod";
import { PageGate } from "../../components/patterns/PageGate";
import { StudioDashboardView } from "../../features/studio/components/StudioDashboardView";
import { summarizeContentStatus } from "../../features/studio/components/studio-dashboard-shared";
import { ServerApiError, serverApi } from "../../lib/server-api";
import type { studioCourseListResponseSchema } from "@atlas/contracts/courses/schemas";
import type { gradingListResponseSchema } from "@atlas/contracts/grading/grading-schemas";
import type { workflowListResponseSchema } from "@atlas/contracts/workflows/workflow-schemas";

type StudioCourseListResponse = z.infer<typeof studioCourseListResponseSchema>;
type GradingListResponse = z.infer<typeof gradingListResponseSchema>;
type WorkflowListResponse = z.infer<typeof workflowListResponseSchema>;

export default async function StudioDashboardPage() {
  try {
    const [courses, grading, workflows, me] = await Promise.all([
      serverApi.get<StudioCourseListResponse>("/api/v1/courses?view=studio&limit=50"),
      serverApi
        .get<GradingListResponse>("/api/v1/grading-tasks?assignedTo=me&status=PENDING&limit=25")
        .catch(() => ({ data: [] as GradingListResponse["data"] })),
      serverApi
        .get<WorkflowListResponse>("/api/v1/workflows?status=pending&limit=25")
        .catch(() => ({
          data: [] as WorkflowListResponse["data"],
          page: { nextCursor: null, hasMore: false },
        })),
      serverApi
        .get<{
          data: { profile: { displayName: string | null } | null };
        }>("/api/v1/me")
        .catch(() => ({ data: { profile: null } })),
    ]);

    const publishedCourses = courses.data.items.filter((course) => course.status === "PUBLISHED");
    const draftCourses = courses.data.items.filter((course) => course.status === "DRAFT");
    const reviewCourses = courses.data.items.filter((course) => course.status === "REVIEW");
    const contentStatus = summarizeContentStatus(courses.data.items);

    return (
      <PageGate state="ready" title="Studio dashboard">
        <StudioDashboardView
          displayName={me.data.profile?.displayName ?? null}
          publishedCount={publishedCourses.length}
          draftCount={draftCourses.length}
          reviewCount={reviewCourses.length}
          gradingCount={grading.data.length}
          pendingWorkflowCount={workflows.data.length}
          contentStatus={contentStatus}
          recentCourses={courses.data.items.slice(0, 5).map((course) => ({
            id: course.id,
            title: course.title,
            status: course.status,
            href: `/studio/courses/${course.id}`,
            learnersHref: `/studio/courses/${course.id}/learners`,
            updatedAt: course.updatedAt,
          }))}
          gradingHref="/studio/grading"
          coursesHref="/studio/courses"
          reviewHref="/studio/review"
        />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 401 || error.status === 403)) {
      return (
        <PageGate
          state="denied"
          title="Studio dashboard"
          deniedMessage="You do not have permission to access instructor studio."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Studio dashboard"
          errorMessage={`Failed to load studio dashboard. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
