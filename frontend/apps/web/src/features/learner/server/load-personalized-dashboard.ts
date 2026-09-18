import type { z } from "zod";
import type {
  learningPathListResponseSchema,
  pathProgressResponseSchema,
} from "@atlas/contracts/learning-paths/learning-path.schemas";
import type { enrollmentListResponseSchema } from "@atlas/contracts/enrollments/schemas";
import type { courseDetailResponseSchema } from "@atlas/contracts/courses/schemas";
import { serverApi } from "../../../lib/server-api";

type LearningPathListResponse = z.infer<typeof learningPathListResponseSchema>;
type PathProgressResponse = z.infer<typeof pathProgressResponseSchema>;
type EnrollmentListResponse = z.infer<typeof enrollmentListResponseSchema>;
type CourseDetailResponse = z.infer<typeof courseDetailResponseSchema>;

export type PersonalizedDashboardActions = {
  nextAction: { label: string; href: string };
  continueLearning: {
    title: string;
    href: string;
    subtitle?: string | null;
    progressPct?: number | null;
    kind?: "path" | "course";
  } | null;
};

export async function loadPersonalizedDashboardActions(
  paths: LearningPathListResponse | null,
): Promise<PersonalizedDashboardActions> {
  let nextAction = { label: "Browse the course catalog", href: "/courses" };
  let continueLearning: PersonalizedDashboardActions["continueLearning"] = null;

  const roadmap = paths?.data.items[0] ?? null;

  if (roadmap) {
    try {
      const progress = await serverApi.get<PathProgressResponse>(
        `/api/v1/learning-paths/${roadmap.id}/progress`,
      );
      const currentStep = progress.data.steps.find(
        (step) => step.stepId === progress.data.currentStepId,
      );
      const progressPct =
        progress.data.totalStepCount > 0
          ? Math.round((progress.data.completedStepCount / progress.data.totalStepCount) * 100)
          : null;
      nextAction = {
        label: progress.data.nextAction.label,
        href: currentStep?.href ?? `/paths/${roadmap.id}`,
      };
      continueLearning = {
        title: roadmap.title,
        href: currentStep?.href ?? `/paths/${roadmap.id}`,
        subtitle: progress.data.nextAction.label,
        progressPct,
        kind: "path",
      };
    } catch {
      continueLearning = {
        title: roadmap.title,
        href: `/paths/${roadmap.id}`,
        kind: "path",
      };
    }
  } else {
    try {
      const enrollments = await serverApi.get<EnrollmentListResponse>(
        "/api/v1/enrollments?limit=1",
      );
      const enrollment = enrollments.data.items[0];
      if (enrollment) {
        const course = await serverApi.get<CourseDetailResponse>(
          `/api/v1/courses/${enrollment.courseId}`,
        );
        continueLearning = {
          title: course.data.title,
          href: course.data.resumeLessonId
            ? `/courses/${enrollment.courseId}/lessons/${course.data.resumeLessonId}`
            : `/courses/${enrollment.courseId}`,
          subtitle: course.data.resumeLessonId
            ? "Resume your last lesson"
            : "Continue your enrolled course",
          kind: "course",
        };
        nextAction = {
          label: `Continue ${course.data.title}`,
          href: course.data.resumeLessonId
            ? `/courses/${enrollment.courseId}/lessons/${course.data.resumeLessonId}`
            : `/courses/${enrollment.courseId}`,
        };
      }
    } catch {
      /* no enrolled courses */
    }
  }

  return { nextAction, continueLearning };
}
