"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { statusBannerClassName } from "./course-builder-shared";
import {
  courseRatingsReviewsFromDetail,
  mergeCourseRatingsReviewsIntoTags,
  ratingsReviewsSettingsEqual,
  type CourseRatingsReviewsSettings,
} from "./course-ratings-reviews-settings";
import { CourseSettingsCheckboxField, CourseSettingsFormFooter } from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsRatingsReviewsPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save ratings and reviews settings.";
}

export function CourseSettingsRatingsReviewsPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsRatingsReviewsPanelProps) {
  const savedForm = useMemo(() => courseRatingsReviewsFromDetail(course), [course]);
  const [form, setForm] = useState<CourseRatingsReviewsSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(courseRatingsReviewsFromDetail(course));
  }, [course]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseRatingsReviewsSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseRatingsReviewsIntoTags(course.tags, nextForm),
        },
        "course-ratings-reviews-update",
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
  const isDirty = !ratingsReviewsSettingsEqual(form, savedForm);

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

      <div className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-4 shadow-sm md:px-5 md:py-5">
        <CourseSettingsCheckboxField
          id="ratings-reviews-enabled"
          label="Ratings & Reviews"
          description="Enable course reviews to allow learners to provide feedback about your course."
          checked={form.enabled}
          disabled={disabled}
          onChange={(checked) => {
            setForm({ enabled: checked });
          }}
        />
      </div>

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
