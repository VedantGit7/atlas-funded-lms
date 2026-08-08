"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, Rocket } from "lucide-react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  builderDangerOutlineClassName,
  builderHelperClassName,
  builderSectionClassName,
  builderSectionBodyClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "./course-builder-shared";
import { CourseStatusBadge } from "./course-status-badge";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsLifecyclePanelProps = {
  course: CourseDetail;
  panel: "publish" | "archive";
  canPublish: boolean;
  onCourseChange: (course: CourseDetail) => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function CourseSettingsLifecyclePanel({
  course,
  panel,
  canPublish,
  onCourseChange,
}: CourseSettingsLifecyclePanelProps) {
  const router = useRouter();
  const [publishError, setPublishError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const editable = course.status === "DRAFT";

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await clientApi.post<{ data: { status: CourseDetail["status"] } }>(
        `/api/v1/courses/${course.id}/publish`,
        {},
        "course-publish",
      );
      return response.data.status;
    },
    onMutate: () => {
      setPublishError(null);
    },
    onSuccess: (status) => {
      onCourseChange({ ...course, status });
      router.refresh();
    },
    onError: (error) => {
      setPublishError(formatError(error));
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      await clientApi.delete(`/api/v1/courses/${course.id}`, "course-archive");
    },
    onMutate: () => {
      setArchiveError(null);
    },
    onSuccess: () => {
      router.push("/studio/courses");
      router.refresh();
    },
    onError: (error) => {
      setArchiveError(formatError(error));
    },
  });

  if (panel === "publish") {
    const canSubmit = canPublish && course.status === "DRAFT";

    return (
      <div className={`${builderSectionClassName} overflow-hidden`}>
        <div className={builderSectionBodyClassName}>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold text-[var(--admin-on-surface)]">Current status</span>
            <CourseStatusBadge status={course.status} />
          </div>

          <p className={`${builderHelperClassName} mt-4 max-w-xl`}>
            {course.status === "DRAFT"
              ? "Submit this course for review when your curriculum is ready. Published courses lock direct edits."
              : course.status === "REVIEW"
                ? "This course is awaiting reviewer approval."
                : course.status === "PUBLISHED"
                  ? "This course is live for learners. Unpublishing is not available from this screen yet."
                  : "This course has been archived."}
          </p>

          {publishError ? (
            <p
              role="alert"
              className={`${statusBannerClassName} mt-5 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
            >
              {publishError}
            </p>
          ) : null}

          {canSubmit ? (
            <button
              type="button"
              disabled={publishMutation.isPending}
              className={`${primaryButtonClassName} mt-6 gap-2`}
              onClick={() => {
                publishMutation.mutate();
              }}
            >
              <Rocket className="h-4 w-4" aria-hidden="true" />
              {publishMutation.isPending ? "Submitting…" : "Submit for review"}
            </button>
          ) : null}

          {course.status === "PUBLISHED" ? (
            <Link
              href={`/studio/courses/${course.id}/editor`}
              prefetch={false}
              className={`${primaryButtonClassName} mt-6 inline-flex`}
            >
              Open course editor
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`${builderSectionClassName} overflow-hidden`}>
      <div className={builderSectionBodyClassName}>
        <p className={`${builderHelperClassName} max-w-xl`}>
          Archiving moves this course out of your active catalog. Learners will lose access until the
          course is restored.
        </p>

        {archiveError ? (
          <p
            role="alert"
            className={`${statusBannerClassName} mt-5 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
          >
            {archiveError}
          </p>
        ) : null}

        <button
          type="button"
          disabled={!editable || archiveMutation.isPending}
          className={`${builderDangerOutlineClassName} mt-6 gap-2`}
          onClick={() => {
            if (!editable || archiveMutation.isPending) return;
            if (!window.confirm("Archive this course? Learners will lose access.")) return;
            archiveMutation.mutate();
          }}
        >
          <Archive className="h-4 w-4" aria-hidden="true" />
          {archiveMutation.isPending ? "Archiving…" : "Move to trash"}
        </button>

        {!editable ? (
          <p className={`${builderHelperClassName} mt-4`}>
            Only draft courses can be archived from settings. Published courses must be unpublished
            first.
          </p>
        ) : null}
      </div>
    </div>
  );
}
