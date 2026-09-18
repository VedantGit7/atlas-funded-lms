"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ClipboardList } from "lucide-react";
import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import { builderHelperClassName } from "../course-builder-shared";
import { inlineLessonPrimaryDarkButtonClassName } from "./inline-lesson-editor-shared";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonSectionQuizWorkspaceProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
};

const QUIZ_STATS = [
  { label: "Number Of Questions", value: "0" },
  { label: "Duration", value: "-" },
  { label: "Total Marks", value: "0" },
  { label: "Maximum Attempts", value: "-" },
  { label: "Expiry Date", value: "-" },
] as const;

function getAssessmentId(content: unknown): string | null {
  if (!content || typeof content !== "object" || Array.isArray(content)) {
    return null;
  }
  const contentObj = content as Record<string, unknown>;
  return typeof contentObj["assessmentId"] === "string" ? contentObj["assessmentId"] : null;
}

export function LessonSectionQuizWorkspace({ lesson, editable }: LessonSectionQuizWorkspaceProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (!editable || busy) return;

    const existingAssessmentId = getAssessmentId(lesson.content);

    if (existingAssessmentId) {
      router.push(`/studio/assessments/${existingAssessmentId}`);
      return;
    }

    // Create new assessment
    setBusy(true);
    setError(null);

    try {
      const response = await clientApi.post<{ data: { id: string } }>(
        "/api/v1/assessments",
        {
          title: `${lesson.title} - Quiz`,
          assessmentType: "section_quiz",
          config: {},
        },
        "assessment-create",
      );

      const assessmentId = response.data.id;

      // Save assessmentId to lesson content
      await clientApi.put(
        `/api/v1/lessons/${lesson.id}`,
        {
          content: {
            assessmentId,
          },
        },
        "lesson-assessment-link",
      );

      router.push(`/studio/assessments/${assessmentId}`);
    } catch (createError) {
      if (createError instanceof ClientApiError) {
        setError(createError.message);
      } else {
        setError("Failed to create assessment");
      }
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-[var(--admin-danger)]/25 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-border)] md:grid-cols-5">
        {QUIZ_STATS.map((stat) => (
          <div key={stat.label} className="bg-[var(--admin-surface)] px-4 py-3 text-center md:py-4">
            <p className="text-lg font-semibold tabular-nums text-[var(--admin-on-surface)]">
              {stat.value}
            </p>
            <p className={`${builderHelperClassName} mt-1`}>{stat.label}</p>
          </div>
        ))}
      </section>

      <section className="flex min-h-[min(24rem,calc(100vh-18rem))] flex-col items-center justify-center rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-6 py-12 text-center">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--admin-lesson-quiz)_12%,var(--admin-surface))] text-[var(--admin-lesson-quiz)]">
          <ClipboardList className="h-12 w-12" strokeWidth={1.5} aria-hidden="true" />
        </div>
        <h2 className="text-xl font-bold text-[var(--admin-on-surface)]">Build Section Quiz</h2>
        <p className={`${builderHelperClassName} mt-2 max-w-sm`}>
          Add questions, edit, and manage your section quiz.
        </p>
        <button
          type="button"
          className={`${inlineLessonPrimaryDarkButtonClassName} mt-8`}
          disabled={!editable || busy}
          onClick={() => {
            void handleContinue();
          }}
        >
          {busy ? "Loading..." : "Continue"}
        </button>
      </section>
    </div>
  );
}
