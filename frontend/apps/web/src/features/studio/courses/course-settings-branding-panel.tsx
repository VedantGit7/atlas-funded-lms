"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  buildCourseBrandingUpdatePayload,
  courseBrandingFromDetail,
  courseBrandingProblem,
  COURSE_NAME_MAX_LENGTH,
  COURSE_OUTCOMES_MAX,
  COURSE_SHORT_DESCRIPTION_MAX_LENGTH,
  parseCourseOutcomes,
  type CourseBrandingFormState,
} from "./course-branding-settings";
import { promoVideoEmbedUrl } from "../../courses/course-page-model";
import {
  COURSE_COVER_ACCEPT,
  courseCoverFileProblem,
  uploadCourseCover,
} from "./upload-course-cover";
import { builderFieldLabelClassName, statusBannerClassName } from "./course-builder-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsMediaUpload,
  courseSettingsCounterTone,
  courseSettingsFieldStackClassName,
  courseSettingsRichEditorShellClassName,
  courseSettingsSectionStackClassName,
} from "./course-settings-shared";
import {
  LessonSettingsTextarea,
  LessonSettingsTextInput,
} from "./inline-lesson-editor/inline-lesson-settings-shared";
import { lessonInputClassName } from "../lessons/lesson-editor-shared";
import { MarkdownToolbar } from "./inline-lesson-editor/markdown-toolbar";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsBrandingPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save course branding.";
}

function formsEqual(a: CourseBrandingFormState, b: CourseBrandingFormState): boolean {
  return (
    a.title === b.title &&
    a.shortDescription === b.shortDescription &&
    a.description === b.description &&
    a.coverKey === b.coverKey &&
    a.promoVideoUrl === b.promoVideoUrl &&
    a.outcomesText === b.outcomesText
  );
}

export function CourseSettingsBrandingPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsBrandingPanelProps) {
  const titleId = useId();
  const shortDescriptionId = useId();
  const descriptionId = useId();
  const outcomesId = useId();
  const outcomesHintId = useId();
  const promoVideoId = useId();
  const promoVideoHintId = useId();
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const savedForm = useMemo(() => courseBrandingFromDetail(course), [course]);
  const [form, setForm] = useState<CourseBrandingFormState>(savedForm);
  const [coverPreview, setCoverPreview] = useState<string | null>(course.coverKey?.trim() || null);
  const [coverPendingFile, setCoverPendingFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(savedForm);
    setCoverPreview(course.coverKey?.trim() || null);
    setCoverPendingFile(null);
    setError(null);
  }, [course, savedForm]);

  // A picked image's preview is a local copy; let it go when it's replaced.
  useEffect(() => {
    if (!coverPreview?.startsWith("blob:")) return;
    return () => {
      URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);

  const isDirty = !formsEqual(form, savedForm) || coverPendingFile !== null;
  const outcomeCount = parseCourseOutcomes(form.outcomesText).length;
  const promoEmbed = promoVideoEmbedUrl(form.promoVideoUrl.trim() || null);

  const saveMutation = useMutation({
    mutationFn: async () => {
      // The image is uploaded first and set on the course by the API, so the
      // save below reads it back with the rest (QA review 1 M49).
      if (coverPendingFile) {
        await uploadCourseCover(course.id, coverPendingFile);
      }

      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        buildCourseBrandingUpdatePayload(course, form),
        "course-branding-save",
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

  function patchForm(patch: Partial<CourseBrandingFormState>) {
    setForm((current) => ({ ...current, ...patch }));
    setError(null);
  }

  function handleCancel() {
    setForm(savedForm);
    setCoverPreview(course.coverKey?.trim() || null);
    setCoverPendingFile(null);
    setError(null);
  }

  function handleSave() {
    if (!editable || saveMutation.isPending) return;
    const problem = courseBrandingProblem(form);
    if (problem) {
      setError(problem);
      return;
    }
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
        <div className={courseSettingsFieldStackClassName}>
          <div className="flex items-start justify-between gap-3">
            <label htmlFor={titleId} className={builderFieldLabelClassName}>
              Course Name<span className="text-[var(--admin-danger)]">*</span>
            </label>
            <span
              className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(form.title.length, COURSE_NAME_MAX_LENGTH)}`}
            >
              {form.title.length}/{COURSE_NAME_MAX_LENGTH}
            </span>
          </div>
          <LessonSettingsTextInput
            id={titleId}
            value={form.title}
            maxLength={COURSE_NAME_MAX_LENGTH}
            disabled={disabled}
            onChange={(value) => {
              patchForm({ title: value });
            }}
          />
        </div>

        <div className={courseSettingsFieldStackClassName}>
          <div className="flex items-start justify-between gap-3">
            <label htmlFor={shortDescriptionId} className={builderFieldLabelClassName}>
              Short Description
            </label>
            <span
              className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(form.shortDescription.length, COURSE_SHORT_DESCRIPTION_MAX_LENGTH)}`}
            >
              {form.shortDescription.length}/{COURSE_SHORT_DESCRIPTION_MAX_LENGTH}
            </span>
          </div>
          <LessonSettingsTextarea
            id={shortDescriptionId}
            value={form.shortDescription}
            maxLength={COURSE_SHORT_DESCRIPTION_MAX_LENGTH}
            placeholder="Write short description"
            disabled={disabled}
            rows={3}
            onChange={(value) => {
              patchForm({ shortDescription: value });
            }}
          />
        </div>

        <div className={courseSettingsFieldStackClassName}>
          <label htmlFor={descriptionId} className={builderFieldLabelClassName}>
            Description
          </label>
          <div className={courseSettingsRichEditorShellClassName(disabled)}>
            <MarkdownToolbar
              textareaRef={descriptionRef}
              value={form.description}
              onChange={(description) => {
                patchForm({ description });
              }}
              disabled={disabled}
            />
            <textarea
              ref={descriptionRef}
              id={descriptionId}
              className={`${lessonInputClassName} min-h-[12rem] resize-y rounded-none border-0 bg-[var(--admin-surface-low)] px-4 py-3 shadow-none focus:ring-0`}
              placeholder="Add a detailed description for your course."
              value={form.description}
              disabled={disabled}
              onChange={(event) => {
                patchForm({ description: event.target.value });
              }}
            />
          </div>
        </div>

        <div className={courseSettingsFieldStackClassName}>
          <div className="flex items-start justify-between gap-3">
            <label htmlFor={outcomesId} className={builderFieldLabelClassName}>
              What you&apos;ll learn
            </label>
            <span
              className={`shrink-0 text-xs font-medium tabular-nums ${courseSettingsCounterTone(outcomeCount, COURSE_OUTCOMES_MAX)}`}
            >
              {outcomeCount}/{COURSE_OUTCOMES_MAX}
            </span>
          </div>
          <p id={outcomesHintId} className="text-sm text-[var(--admin-on-surface-variant)]">
            One point per line. Learners see these as a checklist on the course page.
          </p>
          <LessonSettingsTextarea
            id={outcomesId}
            value={form.outcomesText}
            placeholder={"Read a candlestick chart\nPlace a stop loss before entering a trade"}
            disabled={disabled}
            rows={5}
            aria-describedby={outcomesHintId}
            onChange={(value) => {
              patchForm({ outcomesText: value });
            }}
          />
        </div>

        <CourseSettingsMediaUpload
          label="Course image"
          helper="Shown on the course card in the catalogue and at the top of the course page."
          hint="PNG, JPEG or WebP, at least 1024 × 576 pixels."
          emptyIcon={ImageIcon}
          previewUrl={coverPreview}
          previewKind="image"
          disabled={disabled}
          uploading={saveMutation.isPending && coverPendingFile !== null}
          inputRef={coverInputRef}
          accept={COURSE_COVER_ACCEPT}
          onPickFile={() => {
            coverInputRef.current?.click();
          }}
          onRemove={() => {
            setCoverPreview(null);
            setCoverPendingFile(null);
            patchForm({ coverKey: "" });
          }}
          onFileChange={(file) => {
            if (coverInputRef.current) coverInputRef.current.value = "";
            if (!file) return;
            const problem = courseCoverFileProblem(file);
            if (problem) {
              setError(problem);
              return;
            }
            setError(null);
            setCoverPendingFile(file);
            setCoverPreview(URL.createObjectURL(file));
          }}
        />

        <div className={courseSettingsFieldStackClassName}>
          <label htmlFor={promoVideoId} className={builderFieldLabelClassName}>
            Course video
          </label>
          <p id={promoVideoHintId} className="text-sm text-[var(--admin-on-surface-variant)]">
            A YouTube or Vimeo link to a short introduction. It plays in place of the image on the
            course page.
          </p>
          <LessonSettingsTextInput
            id={promoVideoId}
            value={form.promoVideoUrl}
            placeholder="https://www.youtube.com/watch?v=..."
            disabled={disabled}
            aria-describedby={promoVideoHintId}
            onChange={(value) => {
              patchForm({ promoVideoUrl: value });
            }}
          />
          {promoEmbed ? (
            <iframe
              title="Course video preview"
              src={promoEmbed}
              className="aspect-video w-full max-w-xl rounded-xl border border-[var(--admin-border)]"
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          ) : null}
        </div>
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
