"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  fieldClassName,
  statusBannerClassName,
} from "./course-builder-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  courseSettingsCardClassName,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsMoveToTrashPanelProps = {
  course: CourseDetail;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to move course to trash.";
}

function namesMatch(input: string, courseTitle: string): boolean {
  return input.trim() === courseTitle.trim();
}

export function CourseSettingsMoveToTrashPanel({ course }: CourseSettingsMoveToTrashPanelProps) {
  const router = useRouter();
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const editable = course.status === "DRAFT";
  const confirmed = namesMatch(confirmationName, course.title);

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await clientApi.delete(`/api/v1/courses/${course.id}`, "course-archive");
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: () => {
      router.push("/studio/courses");
      router.refresh();
    },
    onError: (submitError) => {
      setError(formatError(submitError));
    },
  });

  const disabled = !editable || archiveMutation.isPending;
  const canSubmit = editable && confirmed && !archiveMutation.isPending;

  function handleCancel() {
    setConfirmationName("");
    setError(null);
  }

  function handleMoveToTrash() {
    if (!canSubmit) return;
    archiveMutation.mutate();
  }

  return (
    <div className="min-w-0 w-full">
      {!editable ? (
        <p
          className={`${statusBannerClassName} mb-6 border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}
        >
          Only draft courses can be moved to trash from settings. Published courses must be
          unpublished first.
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

      <div className={`space-y-8 ${inlineExpandClassName}`}>
        <div className="space-y-2">
          <label htmlFor="move-to-trash-course-name" className={builderFieldLabelClassName}>
            Course Name
          </label>
          <input
            id="move-to-trash-course-name"
            type="text"
            autoComplete="off"
            placeholder="Type the course name to confirm"
            className={fieldClassName}
            value={confirmationName}
            disabled={disabled}
            onChange={(event) => {
              setConfirmationName(event.target.value);
              setError(null);
            }}
          />
        </div>

        <CourseSettingsSectionBlock
          title="Important Information"
          description="Move this course to Trash. You can restore it within 7 days before it's permanently deleted."
        >
          <div className={`${courseSettingsCardClassName} space-y-4`}>
            <p className={`${builderHelperClassName} leading-relaxed`}>
              Move this course to Trash. You can restore it within 7 days before it&apos;s
              permanently deleted.
            </p>
            <ul className={`${builderHelperClassName} list-disc space-y-2 pl-5 leading-relaxed`}>
              <li>
                Type your course name{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">
                  &quot;{course.title}&quot;
                </span>{" "}
                above to confirm.
              </li>
              <li>The course cannot be part of a bundle.</li>
              <li>It will be moved to Trash and hidden from learners.</li>
              <li>You can restore it within 7 days.</li>
              <li>After 7 days, it will be permanently deleted along with its data.</li>
            </ul>
          </div>
        </CourseSettingsSectionBlock>
      </div>

      <CourseSettingsFormFooter
        onSave={handleMoveToTrash}
        onCancel={handleCancel}
        saving={archiveMutation.isPending}
        saveDisabled={!canSubmit}
        cancelDisabled={archiveMutation.isPending || confirmationName.trim().length === 0}
        saveLabel={archiveMutation.isPending ? "Moving to trash…" : "Move to trash"}
      />
    </div>
  );
}
