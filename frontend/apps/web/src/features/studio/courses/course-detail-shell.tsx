"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useState } from "react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import {
  outlineButtonClassName,
  primaryButtonClassName,
  statusBannerClassName,
} from "./course-builder-shared";
import { CourseDetailProvider, useCourseDetailActions } from "./course-detail-context";
import { COURSE_DETAIL_TABS, resolveActiveCourseTab } from "./course-detail-shared";
import { EnrollStudentDialog } from "./enroll-student-dialog";
import { CourseStatusBadge } from "./course-status-badge";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseDetailShellProps = {
  course: CourseDetail;
  canPublish: boolean;
  children: React.ReactNode;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

function CourseDetailShellInner({ course, canPublish, children }: CourseDetailShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { enrollDialogOpen, openEnrollDialog, closeEnrollDialog, bumpDashboardRefresh } =
    useCourseDetailActions();
  const [currentCourse, setCurrentCourse] = useState(course);
  const [publishError, setPublishError] = useState<string | null>(null);
  const activeTab = resolveActiveCourseTab(pathname, currentCourse.id);
  const showPublish = currentCourse.status === "DRAFT" && canPublish;
  const showEnroll = activeTab === "dashboard";

  const publishMutation = useMutation({
    mutationFn: async () => {
      const response = await clientApi.post<{ data: { status: CourseDetail["status"] } }>(
        `/api/v1/courses/${currentCourse.id}/publish`,
        {},
        "course-publish",
      );
      return response.data.status;
    },
    onMutate: () => {
      setPublishError(null);
    },
    onSuccess: (status) => {
      setCurrentCourse((value) => ({ ...value, status }));
      router.refresh();
    },
    onError: (error) => {
      setPublishError(formatError(error));
    },
  });

  return (
    <div className="-mx-4 -my-6 flex min-h-[calc(100vh-4rem)] w-full min-w-0 max-w-full flex-col md:-mx-8 md:-my-8">
      <header className="sticky top-0 z-20 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-8">
          <nav aria-label="Breadcrumb" className="text-sm text-[var(--admin-on-surface-variant)]">
            <Link
              href="/studio/courses"
              className="transition-colors hover:text-[var(--admin-primary)]"
            >
              Courses
            </Link>
            <span aria-hidden="true" className="mx-2 text-[var(--admin-outline)]">
              /
            </span>
            <span className="font-medium text-[var(--admin-on-surface)]">
              {currentCourse.title}
            </span>
          </nav>

          <div className="flex items-center gap-2">
            {showEnroll ? (
              <button
                type="button"
                onClick={openEnrollDialog}
                className={`${outlineButtonClassName} inline-flex items-center gap-2`}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Enroll
              </button>
            ) : null}

            {showPublish ? (
              <button
                type="button"
                disabled={publishMutation.isPending}
                onClick={() => {
                  publishMutation.mutate();
                }}
                className={primaryButtonClassName}
              >
                {publishMutation.isPending ? "Publishing…" : "Publish"}
              </button>
            ) : !showEnroll ? (
              <CourseStatusBadge status={currentCourse.status} />
            ) : null}
          </div>
        </div>

        <nav aria-label="Course sections" className="flex gap-1 overflow-x-auto px-4 md:px-8">
          {COURSE_DETAIL_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <Link
                key={tab.id}
                href={tab.href(currentCourse.id)}
                className={[
                  "inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors",
                  active
                    ? "border-[var(--admin-primary)] text-[var(--admin-primary)]"
                    : "border-transparent text-[var(--admin-on-surface-variant)] hover:border-[var(--admin-border)] hover:text-[var(--admin-on-surface)]",
                ].join(" ")}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>

      {publishError ? (
        <p
          role="alert"
          className={`${statusBannerClassName} mx-4 mt-4 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)] md:mx-8`}
        >
          {publishError}
        </p>
      ) : null}

      <div className="flex-1 min-w-0 bg-[var(--admin-bg)]">{children}</div>

      <EnrollStudentDialog
        open={enrollDialogOpen}
        course={currentCourse}
        onClose={closeEnrollDialog}
        onEnrolled={() => {
          bumpDashboardRefresh();
          router.refresh();
        }}
      />
    </div>
  );
}

export function CourseDetailShell(props: CourseDetailShellProps) {
  return (
    <CourseDetailProvider>
      <CourseDetailShellInner {...props} />
    </CourseDetailProvider>
  );
}
