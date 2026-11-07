"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { ConfirmDialog } from "../../../components/patterns/ConfirmDialog";
import type {
  courseUnpublishPreviewResponseSchema,
  courseUnpublishResponseSchema,
  studioCourseDetailSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { unpublishWarning } from "./content-visibility";
import { builderHelperClassName, statusBannerClassName } from "./course-builder-shared";
import { CourseSettingsFormFooter } from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type PublishVisibility = "live" | "unpublished";
type UnpublishPreview = z.infer<typeof courseUnpublishPreviewResponseSchema>["data"];
type UnpublishResult = z.infer<typeof courseUnpublishResponseSchema>["data"];

async function fetchUnpublishPreview(courseId: string): Promise<UnpublishPreview> {
  const response = await clientApi.get<{ data: UnpublishPreview }>(
    `/api/v1/courses/${courseId}/unpublish`,
  );
  return response.data;
}

async function unpublishCourse(courseId: string): Promise<UnpublishResult> {
  const response = await clientApi.post<{ data: UnpublishResult }>(
    `/api/v1/courses/${courseId}/unpublish`,
    {},
    "course-unpublish",
    { successMessage: "Course unpublished. It is back in draft." },
  );
  return response.data;
}

type CourseSettingsPublishCoursePanelProps = {
  course: CourseDetail;
  courseId: string;
  canPublish: boolean;
  onCourseChange: (course: CourseDetail) => void;
};

const VISIBILITY_OPTIONS: Array<{
  value: PublishVisibility;
  title: string;
  description: string;
  accent: "success" | "danger";
}> = [
  {
    value: "live",
    title: "Live",
    description: "It will publish course for learners to enroll & access",
    accent: "success",
  },
  {
    value: "unpublished",
    title: "Unpublished",
    description: "Unpublished course will not be visible to learners",
    accent: "danger",
  },
];

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to update course visibility.";
}

/** What publishing or unpublishing does from the course's current status. */
export function publishNote(status: CourseDetail["status"]): string {
  switch (status) {
    case "DRAFT":
      return "Publishing sends the course for review. It goes live for learners once a reviewer approves it.";
    case "REVIEW":
      return "This course is in review. It goes live for learners once a reviewer approves it.";
    case "PUBLISHED":
      return "Unpublishing takes a live course back to draft so you can edit it. Enrolled learners keep their enrollment and progress, but can't open the course until it is approved again.";
    default:
      return "This course is archived, so it can't be published or unpublished.";
  }
}

function visibilityFromStatus(status: CourseDetail["status"]): PublishVisibility {
  return status === "PUBLISHED" ? "live" : "unpublished";
}

function selectedCardClassName(accent: "success" | "danger", selected: boolean): string {
  if (!selected) {
    return "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)]";
  }

  if (accent === "success") {
    return "border-[var(--admin-success)] bg-[color-mix(in_srgb,var(--admin-success)_7%,var(--admin-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--admin-success)_18%,transparent)]";
  }

  return "border-[var(--admin-danger)] bg-[color-mix(in_srgb,var(--admin-danger)_7%,var(--admin-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--admin-danger)_18%,transparent)]";
}

function selectedRadioClassName(accent: "success" | "danger", selected: boolean): string {
  if (accent === "success") {
    return selected ? "border-[var(--admin-success)]" : "border-[var(--admin-success)]/70";
  }

  return selected ? "border-[var(--admin-danger)]" : "border-[var(--admin-outline)]";
}

function selectedDotClassName(accent: "success" | "danger"): string {
  return accent === "success" ? "bg-[var(--admin-success)]" : "bg-[var(--admin-danger)]";
}

function currentStateBadgeClassName(accent: "success" | "danger"): string {
  if (accent === "success") {
    return "bg-[color-mix(in_srgb,var(--admin-success)_12%,var(--admin-surface))] text-[var(--admin-success)]";
  }

  return "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]";
}

function CoursePublishVisibilityRadioGroup({
  value,
  savedValue,
  disabled,
  onChange,
}: {
  value: PublishVisibility;
  savedValue: PublishVisibility;
  disabled?: boolean;
  onChange: (value: PublishVisibility) => void;
}) {
  return (
    <div
      className={`space-y-3 ${inlineExpandClassName}`}
      role="radiogroup"
      aria-label="Course visibility"
    >
      {VISIBILITY_OPTIONS.map((option) => {
        const selected = value === option.value;
        const isCurrentState = savedValue === option.value;

        return (
          <label
            key={option.value}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition-[border-color,background-color,box-shadow] duration-200",
              selectedCardClassName(option.accent, selected),
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <span
              className={[
                "relative mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-200",
                selectedRadioClassName(option.accent, selected),
              ].join(" ")}
              aria-hidden="true"
            >
              {selected ? (
                <span className={`h-2 w-2 rounded-full ${selectedDotClassName(option.accent)}`} />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                  {option.title}
                </span>
                {isCurrentState ? (
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${currentStateBadgeClassName(option.accent)}`}
                  >
                    Current State
                  </span>
                ) : null}
              </span>
              <span className={`${builderHelperClassName} mt-1 block leading-relaxed`}>
                {option.description}
              </span>
            </span>
            <input
              type="radio"
              name="course-publish-visibility"
              value={option.value}
              checked={selected}
              disabled={disabled}
              className="sr-only"
              onChange={() => {
                onChange(option.value);
              }}
            />
          </label>
        );
      })}
    </div>
  );
}

export function CourseSettingsPublishCoursePanel({
  course,
  courseId,
  canPublish,
  onCourseChange,
}: CourseSettingsPublishCoursePanelProps) {
  const router = useRouter();
  const savedVisibility = useMemo(() => visibilityFromStatus(course.status), [course.status]);
  const [visibility, setVisibility] = useState<PublishVisibility>(savedVisibility);
  const [error, setError] = useState<string | null>(null);
  const [confirmUnpublish, setConfirmUnpublish] = useState<{ activeEnrollments: number } | null>(
    null,
  );

  useEffect(() => {
    setVisibility(visibilityFromStatus(course.status));
  }, [course.status]);

  const saveMutation = useMutation({
    mutationFn: async (target: PublishVisibility) => {
      if (target === "live") {
        if (course.status === "PUBLISHED") {
          return course.status;
        }

        if (course.status !== "DRAFT") {
          throw new ClientApiError(
            "INVALID_STATE",
            400,
            "",
            course.status === "REVIEW"
              ? "This course is already submitted for review."
              : "This course cannot be published from its current state.",
          );
        }

        if (!canPublish) {
          throw new ClientApiError(
            "FORBIDDEN",
            403,
            "",
            "You do not have permission to publish this course.",
          );
        }

        const response = await clientApi.post<{ data: { status: CourseDetail["status"] } }>(
          `/api/v1/courses/${course.id}/publish`,
          {},
          "course-publish",
          { successMessage: "Course submitted for review" },
        );
        return response.data.status;
      }

      if (course.status !== "PUBLISHED") {
        return course.status;
      }

      const response = await unpublishCourse(course.id);
      return response.status;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (status) => {
      setConfirmUnpublish(null);
      if (status !== course.status) {
        onCourseChange({ ...course, status });
      }
      setVisibility(visibilityFromStatus(status));
      router.refresh();
    },
    onError: (submitError) => {
      setConfirmUnpublish(null);
      setError(formatError(submitError));
    },
  });

  const previewMutation = useMutation({
    mutationFn: () => fetchUnpublishPreview(course.id),
    onMutate: () => {
      setError(null);
    },
    onSuccess: (preview) => {
      if (!preview.canUnpublish) {
        setError("Only a live course can be unpublished. Refresh to see its current status.");
        return;
      }
      setConfirmUnpublish({ activeEnrollments: preview.activeEnrollments });
    },
    onError: (previewError) => {
      setError(formatError(previewError));
    },
  });

  const busy = saveMutation.isPending || previewMutation.isPending;
  const isDirty = visibility !== savedVisibility;
  const saveDisabled = !isDirty || busy;
  const saveLabel =
    visibility === "live"
      ? saveMutation.isPending
        ? "Publishing…"
        : "Publish"
      : previewMutation.isPending
        ? "Checking…"
        : saveMutation.isPending
          ? "Unpublishing…"
          : "Unpublish";

  function handleCancel() {
    setVisibility(savedVisibility);
    setError(null);
  }

  function handleSave() {
    if (saveDisabled) return;
    if (visibility === "unpublished" && course.status === "PUBLISHED") {
      previewMutation.mutate();
      return;
    }
    saveMutation.mutate(visibility);
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

      <CoursePublishVisibilityRadioGroup
        value={visibility}
        savedValue={savedVisibility}
        disabled={busy}
        onChange={setVisibility}
      />

      <p className={`${builderHelperClassName} mt-6 leading-relaxed`}>
        {publishNote(course.status)} To hide one section or lesson instead, use its menu in the{" "}
        <Link
          href={`/studio/courses/${courseId}/editor`}
          prefetch={false}
          className="font-semibold text-[var(--admin-primary)] underline-offset-2 transition-colors hover:text-[var(--admin-primary-strong)] hover:underline"
        >
          course editor
        </Link>
        .
      </p>

      <CourseSettingsFormFooter
        onSave={handleSave}
        onCancel={handleCancel}
        saving={saveMutation.isPending}
        saveDisabled={saveDisabled}
        cancelDisabled={busy || !isDirty}
        saveLabel={saveLabel}
      />

      <ConfirmDialog
        open={confirmUnpublish !== null}
        title="Unpublish this course?"
        description={unpublishWarning(confirmUnpublish?.activeEnrollments ?? 0)}
        confirmLabel="Unpublish"
        destructive
        busy={saveMutation.isPending}
        onConfirm={() => {
          saveMutation.mutate("unpublished");
        }}
        onCancel={() => {
          setConfirmUnpublish(null);
        }}
      />
    </div>
  );
}
