"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  buildCourseSeoUpdatePayload,
  courseSeoFromDetail,
  COURSE_FRIENDLY_URL_MAX_LENGTH,
  COURSE_PAGE_TITLE_MAX_LENGTH,
  COURSE_SEO_DESCRIPTION_MAX_LENGTH,
  normalizeCourseSlug,
  resolveCourseLearnerUrlBase,
  type CourseSeoFormState,
} from "./course-seo-settings";
import { builderFieldLabelClassName, statusBannerClassName } from "./course-builder-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  CourseSettingsSlugUrlField,
  courseSettingsCounterTone,
  courseSettingsFieldStackClassName,
  courseSettingsSectionStackClassName,
} from "./course-settings-shared";
import {
  LessonSettingsTextarea,
  LessonSettingsTextInput,
} from "./inline-lesson-editor/inline-lesson-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsSeoPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save SEO settings.";
}

function formsEqual(a: CourseSeoFormState, b: CourseSeoFormState): boolean {
  return (
    a.slug === b.slug && a.pageTitle === b.pageTitle && a.seoDescription === b.seoDescription
  );
}

export function CourseSettingsSeoPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsSeoPanelProps) {
  const slugId = useId();
  const pageTitleId = useId();
  const seoDescriptionId = useId();
  const urlBase = resolveCourseLearnerUrlBase();

  const savedForm = useMemo(() => courseSeoFromDetail(course), [course]);
  const [form, setForm] = useState<CourseSeoFormState>(savedForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(savedForm);
    setError(null);
  }, [savedForm]);

  const isDirty = !formsEqual(form, savedForm);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const slug = normalizeCourseSlug(form.slug);
      if (!slug) {
        throw new ClientApiError(
          "VALIDATION_ERROR",
          400,
          "client",
          "Friendly URL is required. Use lowercase letters, numbers, and hyphens.",
        );
      }

      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        buildCourseSeoUpdatePayload(course, { ...form, slug }),
        "course-seo-save",
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

  function patchForm(patch: Partial<CourseSeoFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function handleCancel() {
    setForm(savedForm);
    setError(null);
  }

  function handleSave() {
    if (!editable || saveMutation.isPending) return;
    saveMutation.mutate();
  }

  const disabled = !editable || saveMutation.isPending;

  return (
    <>
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

      <div className={courseSettingsSectionStackClassName}>
        <CourseSettingsSectionBlock
          title="Friendly URL"
          description="Set up a friendly URL for your course so learners can find it more easily."
        >
          <CourseSettingsSlugUrlField
            id={slugId}
            label="URL"
            required
            baseUrl={urlBase}
            value={form.slug}
            maxLength={COURSE_FRIENDLY_URL_MAX_LENGTH}
            disabled={disabled}
            onChange={(value) => {
              patchForm({ slug: value });
            }}
          />
          <p className="text-xs text-[var(--admin-on-surface-variant)]">
            Use lowercase letters, numbers, and hyphens. Saved as{" "}
            <span className="font-mono">{normalizeCourseSlug(form.slug) || "…"}</span>.
          </p>
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="Course Page Title"
          description="Independent page title for the course. A dedicated title can improve search visibility."
        >
          <div className={courseSettingsFieldStackClassName}>
            <div className="flex items-start justify-between gap-3">
              <label htmlFor={pageTitleId} className={builderFieldLabelClassName}>
                Page Title
              </label>
              <span
                className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(form.pageTitle.length, COURSE_PAGE_TITLE_MAX_LENGTH)}`}
              >
                {form.pageTitle.length}/{COURSE_PAGE_TITLE_MAX_LENGTH}
              </span>
            </div>
            <LessonSettingsTextInput
              id={pageTitleId}
              value={form.pageTitle}
              maxLength={COURSE_PAGE_TITLE_MAX_LENGTH}
              placeholder="Enter a page title"
              disabled={disabled}
              onChange={(value) => {
                patchForm({ pageTitle: value });
              }}
            />
          </div>
        </CourseSettingsSectionBlock>

        <CourseSettingsSectionBlock
          title="SEO Description"
          description="Provide keywords and a summary that help search engines understand your course."
        >
          <div className={courseSettingsFieldStackClassName}>
            <div className="flex items-start justify-between gap-3">
              <label htmlFor={seoDescriptionId} className={builderFieldLabelClassName}>
                SEO Description
              </label>
              <span
                className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(form.seoDescription.length, COURSE_SEO_DESCRIPTION_MAX_LENGTH)}`}
              >
                {form.seoDescription.length}/{COURSE_SEO_DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
            <LessonSettingsTextarea
              id={seoDescriptionId}
              value={form.seoDescription}
              maxLength={COURSE_SEO_DESCRIPTION_MAX_LENGTH}
              placeholder="Enter SEO description"
              disabled={disabled}
              rows={6}
              onChange={(value) => {
                patchForm({ seoDescription: value });
              }}
            />
          </div>
        </CourseSettingsSectionBlock>
      </div>

      <CourseSettingsFormFooter
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saveMutation.isPending}
        saveDisabled={disabled || !isDirty}
        cancelDisabled={!isDirty}
      />
    </>
  );
}
