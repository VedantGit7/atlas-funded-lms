import type { z } from "zod";
import { PageGate } from "../../../components/patterns/PageGate";
import {
  COURSE_BEING_UPDATED,
  CourseBeingUpdated,
} from "../../../features/courses/course-being-updated";
import { CourseDetail } from "../../../features/courses/course-detail";
import { CourseCouponChecker } from "../../../features/courses/CourseCouponChecker";
import { CourseStorePricing } from "../../../features/courses/CourseStorePricing";
import { ServerApiError, serverApi } from "../../../lib/server-api";
import type {
  courseDetailResponseSchema,
  courseModulesResponseSchema,
} from "@atlas/contracts/courses/schemas";
import type { learnerCourseOutlineResponseSchema } from "@atlas/contracts/courses/course-outline.schemas";
import { courseOutlinePath } from "../../../features/lessons/course-outline-model";

type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;
type CourseModulesResponse = z.infer<typeof courseModulesResponseSchema>;
type LearnerCourseOutlineResponse = z.infer<typeof learnerCourseOutlineResponseSchema>;

type CourseDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tagId?: string }>;
};

export default async function CourseDetailPage({ params, searchParams }: CourseDetailPageProps) {
  const { id } = await params;
  const { tagId } = await searchParams;

  try {
    const [course, modules] = await Promise.all([
      serverApi.get<CourseDetailResponse>(`/api/v1/courses/${id}`),
      serverApi.get<CourseModulesResponse>(`/api/v1/courses/${id}/modules`),
    ]);
    // Every chapter and lesson, with the learner's own progress once enrolled
    // (QA review 1 M38, review 2 H20); the page still shows the chapters if it
    // can't be loaded.
    const outline = await serverApi
      .get<LearnerCourseOutlineResponse>(courseOutlinePath(id))
      .then((response) => response.data)
      .catch(() => null);

    return (
      <PageGate state="ready" title={course.data.title}>
        <CourseDetail
          course={course.data}
          modules={modules.data.items}
          outline={outline}
          {...(tagId ? { tagId } : {})}
        />
        {/* A coupon only matters for a paid course the learner hasn't bought (QA review 2). */}
        {course.data.accessTier === "PAID" && course.data.enrollmentStatus !== "enrolled" ? (
          <CourseCouponChecker courseId={id} />
        ) : null}
        <CourseStorePricing courseId={id} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.code === COURSE_BEING_UPDATED) {
        return <CourseBeingUpdated />;
      }

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
