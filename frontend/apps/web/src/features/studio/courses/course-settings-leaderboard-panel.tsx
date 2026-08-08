"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { statusBannerClassName } from "./course-builder-shared";
import {
  courseLeaderboardFromDetail,
  leaderboardSettingsEqual,
  mergeCourseLeaderboardIntoTags,
  type CourseLeaderboardSettings,
} from "./course-leaderboard-settings";
import {
  CourseSettingsCheckboxField,
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsLeaderboardPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const SETTINGS_CARD_CLASSNAME =
  "rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-sm md:px-5 md:py-5";

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save leaderboard settings.";
}

export function CourseSettingsLeaderboardPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsLeaderboardPanelProps) {
  const savedForm = useMemo(() => courseLeaderboardFromDetail(course), [course]);
  const [form, setForm] = useState<CourseLeaderboardSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(courseLeaderboardFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseLeaderboardSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseLeaderboardIntoTags(course.tags, nextForm),
        },
        "course-leaderboard-update",
      );
      return response.data;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (saved) => {
      onSaved(saved);
    },
    onError: (submitError) => {
      setError(formatError(submitError));
    },
  });

  const disabled = !editable || saveMutation.isPending;
  const isDirty = !leaderboardSettingsEqual(form, savedForm);

  function updateForm(patch: Partial<CourseLeaderboardSettings>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function handleCancel() {
    setForm(savedForm);
    setError(null);
  }

  function handleSave() {
    if (disabled || !isDirty) return;
    saveMutation.mutate(form);
  }

  return (
    <div className="min-w-0 w-full">
      {!editable ? (
        <p
          className={`${statusBannerClassName} mb-6 border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}
        >
          This course is locked while in review or published.
        </p>
      ) : null}

      {error ? (
        <p
          role="alert"
          className={`${statusBannerClassName} mb-6 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
        >
          {error}
        </p>
      ) : null}

      <CourseSettingsSectionBlock
        title="Course Analytics Leaderboard"
        description="Allow learners to view the names of leading learners by selecting analytics criteria"
      >
        <div className="space-y-4">
          <div className={SETTINGS_CARD_CLASSNAME}>
            <CourseSettingsCheckboxField
              id="quiz-leaderboard-enabled"
              label="Quiz Leaderboard"
              description="Enabling for quiz will show leaderboard with quiz score"
              checked={form.quizLeaderboard}
              disabled={disabled}
              onChange={(checked) => {
                updateForm({ quizLeaderboard: checked });
              }}
            />
          </div>

          <div className={SETTINGS_CARD_CLASSNAME}>
            <CourseSettingsCheckboxField
              id="assignment-leaderboard-enabled"
              label="Assignment Leaderboard"
              description="Enabling for assignment will show leaderboard with assignment score"
              checked={form.assignmentLeaderboard}
              disabled={disabled}
              onChange={(checked) => {
                updateForm({ assignmentLeaderboard: checked });
              }}
            />
          </div>
        </div>
      </CourseSettingsSectionBlock>

      {editable ? (
        <CourseSettingsFormFooter
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saveMutation.isPending}
          saveDisabled={disabled || !isDirty}
          cancelDisabled={disabled || !isDirty}
        />
      ) : null}
    </div>
  );
}
