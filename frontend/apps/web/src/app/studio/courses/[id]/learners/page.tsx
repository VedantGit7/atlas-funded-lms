import type { z } from "zod";
import Link from "next/link";
import { PageGate, PageHeader } from "../../../../../components/patterns/PageGate";
import { CourseLearnerRoster } from "../../../../../features/studio/learners/course-learner-roster";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import type { studioCourseDetailResponseSchema } from "@atlas/contracts/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;

type StudioCourseLearnersPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioCourseLearnersPage({ params }: StudioCourseLearnersPageProps) {
  const { id } = await params;

  try {
    const course = await serverApi.get<StudioCourseDetailResponse>(`/api/v1/courses/${id}?view=studio`);

    return (
      <PageGate state="ready" title="Learner roster">
        <main className="space-y-6">
          <PageHeader
            title="Learner roster & progress"
            description="Relationship-scoped roster for learners enrolled in this course."
          />
          <p className="text-sm">
            <Link href={`/studio/courses/${id}`}>Back to course</Link>
          </p>
          <CourseLearnerRoster courseId={id} courseTitle={course.data.title} />
        </main>
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError && (error.status === 403 || error.status === 404)) {
      return (
        <PageGate
          state="not_found"
          title="Learner roster"
          notFoundMessage="Course not found or you are not authorized to view its learners."
        />
      );
    }

    if (error instanceof ServerApiError && error.status === 401) {
      return (
        <PageGate
          state="denied"
          title="Learner roster"
          deniedMessage="You do not have permission to view this learner roster."
        />
      );
    }

    if (error instanceof ServerApiError) {
      return (
        <PageGate
          state="error"
          title="Learner roster"
          errorMessage={`Failed to load learner roster. Request ID: ${error.requestId}`}
        />
      );
    }

    throw error;
  }
}
