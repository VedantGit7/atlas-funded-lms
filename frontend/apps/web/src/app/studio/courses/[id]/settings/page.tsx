import type { z } from "zod";
import { CourseSettingsPage } from "../../../../../features/studio/courses/course-settings-page";
import { serverApi } from "../../../../../lib/server-api";
import type { studioCourseDetailResponseSchema } from "@atlas/contracts/courses/schemas";

type StudioCourseDetailResponse = z.infer<typeof studioCourseDetailResponseSchema>;

type StudioCourseSettingsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function StudioCourseSettingsRoute({ params }: StudioCourseSettingsPageProps) {
  const { id } = await params;
  const course = await serverApi.get<StudioCourseDetailResponse>(
    `/api/v1/courses/${id}?view=studio`,
  );

  return <CourseSettingsPage course={course.data} />;
}
