"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Image as ImageIcon, Video } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  buildCourseBrandingUpdatePayload,
  courseBrandingFromDetail,
  COURSE_NAME_MAX_LENGTH,
  COURSE_SHORT_DESCRIPTION_MAX_LENGTH,
  type CourseBrandingFormState,
} from "./course-branding-settings";
import { builderFieldLabelClassName, statusBannerClassName } from "./course-builder-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsInfoBanner,
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
    a.promoVideoUrl === b.promoVideoUrl
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
  const descriptionRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const savedForm = useMemo(() => courseBrandingFromDetail(course), [course]);
  const [form, setForm] = useState<CourseBrandingFormState>(savedForm);
  const [coverPreview, setCoverPreview] = useState<string | null>(course.coverKey?.trim() || null);
  const [videoPreview, setVideoPreview] = useState<string | null>(
    savedForm.promoVideoUrl.trim() || null,
  );
  const [coverPendingFile, setCoverPendingFile] = useState<File | null>(null);
  const [videoPendingFile, setVideoPendingFile] = useState<File | null>(null);
  const [uploadNotice, setUploadNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm(savedForm);
    setCoverPreview(course.coverKey?.trim() || null);
    setVideoPreview(savedForm.promoVideoUrl.trim() || null);
    setCoverPendingFile(null);
    setVideoPendingFile(null);
    setUploadNotice(null);
    setError(null);
  }, [course, savedForm]);

  const isDirty =
    !formsEqual(form, savedForm) || coverPendingFile !== null || videoPendingFile !== null;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (coverPendingFile || videoPendingFile) {
        throw new ClientApiError(
          "UPLOAD_NOT_SUPPORTED",
          400,
          "client",
          "File uploads for course media are not available yet. Remove the pending file to save text fields.",
        );
      }

      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        buildCourseBrandingUpdatePayload(course, form, form.coverKey || undefined),
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
    setVideoPreview(savedForm.promoVideoUrl.trim() || null);
    setCoverPendingFile(null);
    setVideoPendingFile(null);
    setUploadNotice(null);
    setError(null);
  }

  function handleSave() {
    if (!editable || saveMutation.isPending) return;
    if (!form.title.trim()) {
      setError("Course name is required.");
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

      {uploadNotice ? (
        <div className="mb-6">
          <CourseSettingsInfoBanner>{uploadNotice}</CourseSettingsInfoBanner>
        </div>
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
            <MarkdownToolbar textareaRef={descriptionRef} disabled={disabled} />
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

        <CourseSettingsMediaUpload
          label="Course Image"
          helper="Upload a relatable course image for visual presentation."
          hint="Upload image with resolution of 1024 × 576 pixels."
          emptyIcon={ImageIcon}
          previewUrl={coverPreview}
          previewKind="image"
          disabled={disabled}
          inputRef={coverInputRef}
          accept="image/*"
          onPickFile={() => {
            coverInputRef.current?.click();
          }}
          onRemove={() => {
            setCoverPreview(null);
            setCoverPendingFile(null);
            patchForm({ coverKey: "" });
            setUploadNotice(null);
          }}
          onFileChange={(file) => {
            if (!file) return;
            setCoverPendingFile(file);
            setCoverPreview(URL.createObjectURL(file));
            setUploadNotice(
              "Cover preview is local only. Course media upload will be enabled in a future release.",
            );
          }}
        />

        <CourseSettingsMediaUpload
          label="Course Video Embed"
          helper="Upload a short promotional video for your course."
          emptyIcon={Video}
          previewUrl={videoPreview}
          previewKind="video"
          disabled={disabled}
          inputRef={videoInputRef}
          accept="video/*"
          onPickFile={() => {
            videoInputRef.current?.click();
          }}
          onRemove={() => {
            setVideoPreview(null);
            setVideoPendingFile(null);
            patchForm({ promoVideoUrl: "" });
            setUploadNotice(null);
          }}
          onFileChange={(file) => {
            if (!file) return;
            setVideoPendingFile(file);
            setVideoPreview(URL.createObjectURL(file));
            setUploadNotice(
              "Video preview is local only. Course media upload will be enabled in a future release.",
            );
          }}
        />
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
