import type { z } from "zod";
import { PageGate } from "../../../../../components/patterns/PageGate";
import { ScormModulePlayerShell } from "../../../../../features/courses/scorm-module-player-shell";
import { ServerApiError, serverApi } from "../../../../../lib/server-api";
import type { courseDetailResponseSchema } from "@atlas/contracts/courses/schemas";
import type { moduleScormLaunchResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;
type ModuleScormLaunchResponse = z.infer<typeof moduleScormLaunchResponseSchema>;

type ScormModulePlayerPageProps = {
  params: Promise<{ id: string; moduleId: string }>;
};

export default async function ScormModulePlayerPage({ params }: ScormModulePlayerPageProps) {
  const { id: courseId, moduleId } = await params;

  try {
    const [course, launch] = await Promise.all([
      serverApi.get<CourseDetailResponse>(`/api/v1/courses/${courseId}`),
      serverApi.get<ModuleScormLaunchResponse>(`/api/v1/modules/${moduleId}/scorm-launch`),
    ]);

    if (course.data.enrollmentStatus !== "enrolled") {
      return (
        <PageGate
          state="denied"
          title="SCORM chapter"
          deniedMessage="Enroll in this course to access SCORM chapters."
        />
      );
    }

    if (launch.data.courseId !== courseId) {
      return (
        <PageGate
          state="not_found"
          title="SCORM chapter"
          notFoundMessage="SCORM chapter not found in this course."
        />
      );
    }

    return (
      <PageGate state="ready" title={launch.data.title}>
        <ScormModulePlayerShell courseTitle={course.data.title} launch={launch.data} />
      </PageGate>
    );
  } catch (error) {
    if (error instanceof ServerApiError) {
      if (error.status === 404 || error.status === 403) {
        return (
          <PageGate
            state="not_found"
            title="SCORM chapter"
            notFoundMessage="SCORM chapter not found or access denied."
          />
        );
      }

      if (error.status === 401) {
        return (
          <PageGate
            state="denied"
            title="SCORM chapter"
            deniedMessage="Sign in with an active membership to view this chapter."
          />
        );
      }
    }

    throw error;
  }
}
