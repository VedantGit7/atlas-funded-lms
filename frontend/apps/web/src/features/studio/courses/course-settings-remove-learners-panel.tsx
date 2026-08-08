"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { toast } from "../../../lib/feedback/toast";
import { fetchCourseLearnerRoster } from "../learners/api";
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

type CourseSettingsRemoveLearnersPanelProps = {
  course: CourseDetail;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to remove learners from this course.";
}

function namesMatch(input: string, courseTitle: string): boolean {
  return input.trim() === courseTitle.trim();
}

export function CourseSettingsRemoveLearnersPanel({
  course,
}: CourseSettingsRemoveLearnersPanelProps) {
  const [confirmationName, setConfirmationName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const confirmed = namesMatch(confirmationName, course.title);

  const removeMutation = useMutation({
    mutationFn: async () => {
      const roster = await fetchCourseLearnerRoster(course.id);
      if (roster.length === 0) {
        return 0;
      }

      await Promise.all(
        roster.map((learner) =>
          clientApi.delete(
            `/api/v1/enrollments/${learner.enrollmentId}`,
            `cancel-enrollment-${learner.enrollmentId}`,
            undefined,
            { silent: true },
          ),
        ),
      );

      return roster.length;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (removedCount) => {
      setConfirmationName("");
      toast.mutationSuccess({
        idempotencyKeyPrefix: "course-remove-learners",
        method: "DELETE",
        ...(removedCount === 0 ? { message: "No learners were enrolled in this course." } : {}),
      });
    },
    onError: (submitError) => {
      setError(formatError(submitError));
    },
  });

  const canSubmit = confirmed && !removeMutation.isPending;

  function handleCancel() {
    setConfirmationName("");
    setError(null);
  }

  function handleRemove() {
    if (!canSubmit) return;
    removeMutation.mutate();
  }

  return (
    <div className="min-w-0 w-full">
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
          <label htmlFor="remove-learners-course-name" className={builderFieldLabelClassName}>
            Course Name
          </label>
          <input
            id="remove-learners-course-name"
            type="text"
            autoComplete="off"
            placeholder="Enter the course name to remove learners"
            className={fieldClassName}
            value={confirmationName}
            disabled={removeMutation.isPending}
            onChange={(event) => {
              setConfirmationName(event.target.value);
              setError(null);
            }}
          />
        </div>

        <CourseSettingsSectionBlock
          title="Important Information"
          description="Please read the below information before taking any further step"
        >
          <div className={`${courseSettingsCardClassName} space-y-4`}>
            <ul className={`${builderHelperClassName} list-disc space-y-2 pl-5 leading-relaxed`}>
              <li>
                Type your course name{" "}
                <span className="font-semibold text-[var(--admin-on-surface)]">
                  &quot;{course.title}&quot;
                </span>{" "}
                above to confirm removing learners.
              </li>
              <li>
                Once you remove the learners, existing learners will no longer have access to their
                data.
              </li>
              <li>Existing learners will have to enroll/buy the course again as new learners.</li>
              <li>The course will be available to new learners.</li>
            </ul>
          </div>
        </CourseSettingsSectionBlock>
      </div>

      <CourseSettingsFormFooter
        onSave={handleRemove}
        onCancel={handleCancel}
        saving={removeMutation.isPending}
        saveDisabled={!canSubmit}
        cancelDisabled={removeMutation.isPending || confirmationName.trim().length === 0}
        saveLabel={removeMutation.isPending ? "Removing…" : "Remove"}
      />
    </div>
  );
}
