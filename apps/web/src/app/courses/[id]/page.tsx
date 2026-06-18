import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import { CourseDetail } from "../../../features/courses/course-detail";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  courseDetailResponseSchema,
  courseModulesResponseSchema,
} from "../../../server/courses/schemas";

type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;
type CourseModulesResponse = z.infer<typeof courseModulesResponseSchema>;

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function CourseDetailPage({ params }: CourseDetailPageProps) {
  const { id } = await params;

  try {
    const [course, modules] = await Promise.all([
      serverApi.get<CourseDetailResponse>(`/api/v1/courses/${id}`),
      serverApi.get<CourseModulesResponse>(`/api/v1/courses/${id}/modules`),
    ]);

    return (
      <PageGate state="ready" title={course.data.title}>
        <CourseDetail course={course.data} modules={modules.data.items} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 404 || error.status === 403) {
        return (
          <PageGate
            state="not_found"
            title="Course detail"
            notFoundMessage="Course not found or access denied."
          />
        );
      }

      if (error.status === 401) {
        return (
          <PageGate
            state="denied"
            title="Course detail"
            deniedMessage="Sign in with an active membership to view this course."
          />
        );
      }

      if (error.code === "MEMBERSHIP_SUSPENDED") {
        return (
          <PageGate
            state="denied"
            title="Course detail"
            deniedMessage="Your membership is suspended and cannot access courses."
          />
        );
      }
    }

    throw error;
  }
}
