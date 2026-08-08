"use client";

import { useEffect, useState } from "react";
import type { z } from "zod";
import type { learningPathListResponseSchema } from "@atlas/contracts/learning-paths/learning-path.schemas";
import type { studioCourseListResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { clientApi } from "../../../lib/client-api";
import type { assessmentListResponseSchema } from "../../assessments/assessment-response-schemas";
import type { StepResourceOption } from "../learning-path-step-utils";

type CourseListResponse = z.infer<typeof studioCourseListResponseSchema>;
type AssessmentListResponse = z.infer<typeof assessmentListResponseSchema>;
type PathListResponse = z.infer<typeof learningPathListResponseSchema>;

export function useLearningPathStepResources(currentPathId: string) {
  const [courses, setCourses] = useState<StepResourceOption[]>([]);
  const [assessments, setAssessments] = useState<StepResourceOption[]>([]);
  const [paths, setPaths] = useState<StepResourceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadResources() {
      setLoading(true);
      setError(null);

      try {
        const [courseResponse, assessmentResponse, pathResponse] = await Promise.all([
          clientApi.get<CourseListResponse>("/api/v1/courses?view=studio&limit=100"),
          clientApi.get<AssessmentListResponse>("/api/v1/assessments?limit=100"),
          clientApi.get<PathListResponse>("/api/v1/learning-paths?view=studio&limit=100"),
        ]);

        if (cancelled) return;

        setCourses(
          courseResponse.data.items.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
          })),
        );
        setAssessments(
          assessmentResponse.data.map((item) => ({
            id: item.id,
            title: item.title,
            status: item.status,
          })),
        );
        setPaths(
          pathResponse.data.items
            .filter((item) => item.id !== currentPathId)
            .map((item) => ({
              id: item.id,
              title: item.title,
              status: item.status,
            })),
        );
      } catch {
        if (!cancelled) {
          setCourses([]);
          setAssessments([]);
          setPaths([]);
          setError("Could not load courses, assessments, or paths for step linking.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadResources();

    return () => {
      cancelled = true;
    };
  }, [currentPathId]);

  return { courses, assessments, paths, loading, error };
}

export function resourcesForStepType(
  stepType: "course" | "assessment" | "path",
  resources: {
    courses: StepResourceOption[];
    assessments: StepResourceOption[];
    paths: StepResourceOption[];
  },
): StepResourceOption[] {
  if (stepType === "course") return resources.courses;
  if (stepType === "assessment") return resources.assessments;
  return resources.paths;
}
