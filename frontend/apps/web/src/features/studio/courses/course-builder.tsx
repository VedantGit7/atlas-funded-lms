"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Archive,
  ChevronRight,
  MoreVertical,
  Users,
} from "lucide-react";
import type { z } from "zod";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import type {
  studioCourseDetailSchema,
  studioModuleOutlineItemSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { BuilderValidationPanel } from "./builder-validation-panel";
import {
  builderDangerOutlineClassName,
  builderGhostIconClassName,
  builderPanelClassName,
} from "./course-builder-shared";
import { CourseModuleTree } from "./course-module-tree";
import { CourseSettingsForm } from "./course-settings-form";
import { CourseStatusBadge } from "./course-status-badge";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;

type CourseBuilderProps = {
  initialCourse: CourseDetail;
  initialModules: ModuleItem[];
  canPublish: boolean;
  embedded?: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Request failed.";
}

export function CourseBuilder({
  initialCourse,
  initialModules,
  canPublish,
  embedded = false,
}: CourseBuilderProps) {
  const router = useRouter();
  const [course, setCourse] = useState(initialCourse);
  const [modules, setModules] = useState(initialModules);
  const [selectedModuleId, setSelectedModuleId] = useState<string | null>(
    initialModules[0]?.id ?? null,
  );
  const [publishError, setPublishError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const editable = course.status === "DRAFT";

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [menuOpen]);

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
      setCourse((current) => ({ ...current, status }));
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

  function handlePublish() {
    if (!canPublish || course.status !== "DRAFT" || publishMutation.isPending) return;
    publishMutation.mutate();
  }

  function handleArchive() {
    if (!editable || archiveMutation.isPending || !window.confirm("Archive this course?")) return;
    archiveMutation.mutate();
  }

  return (
    <div
      className={
        embedded
          ? "flex min-h-0 flex-1 flex-col overflow-hidden"
          : "-mx-4 -my-6 flex min-h-[calc(100vh-4rem)] flex-col md:-mx-8 md:-my-8"
      }
    >
      {embedded ? null : (
        <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface)]/95 px-4 py-4 backdrop-blur md:px-8">
          <div className="min-w-0 space-y-1">
            <nav
              aria-label="Breadcrumb"
              className="flex flex-wrap items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-[var(--admin-on-surface-variant)]"
            >
              <Link href="/studio" className="transition-colors hover:text-[var(--admin-primary)]">
                Studio
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <Link
                href="/studio/courses"
                className="transition-colors hover:text-[var(--admin-primary)]"
              >
                Courses
              </Link>
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="truncate text-[var(--admin-on-surface)]">{course.title}</span>
            </nav>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-xl font-semibold text-[var(--admin-on-surface)] md:text-2xl">
                {course.title}
              </h1>
              <CourseStatusBadge status={course.status} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editable ? (
              <button
                type="button"
                onClick={() => {
                  void handleArchive();
                }}
                disabled={archiveMutation.isPending}
                className={builderDangerOutlineClassName}
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                {archiveMutation.isPending ? "Archiving…" : "Archive course"}
              </button>
            ) : null}

            <div className="relative" ref={menuRef}>
              <button
                type="button"
                aria-label="More actions"
                aria-expanded={menuOpen}
                onClick={() => {
                  setMenuOpen((open) => !open);
                }}
                className={builderGhostIconClassName}
              >
                <MoreVertical className="h-5 w-5" aria-hidden="true" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 min-w-[12rem] overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] py-1 shadow-lg motion-safe:animate-[admin-dropdown-in_0.18s_cubic-bezier(0.16,1,0.3,1)]">
                  {course.status === "PUBLISHED" ? (
                    <Link
                      href={`/studio/courses/${course.id}/learners`}
                      className="flex items-center gap-2 px-4 py-2.5 text-sm text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)]"
                      onClick={() => {
                        setMenuOpen(false);
                      }}
                    >
                      <Users className="h-4 w-4" aria-hidden="true" />
                      View learner roster
                    </Link>
                  ) : (
                    <span className="block px-4 py-2.5 text-sm text-[var(--admin-on-surface-variant)]">
                      No additional actions
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          </div>
        </header>
      )}

      {embedded ? null : archiveError ? (
        <p role="alert" className="mx-4 mt-3 text-sm text-[var(--admin-danger)] md:mx-8">
          {archiveError}
        </p>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <section
          className={`${builderPanelClassName} w-full shrink-0 border-b lg:w-[260px] lg:border-b-0 lg:border-r`}
        >
          <CourseModuleTree
            courseId={course.id}
            modules={modules}
            editable={editable}
            selectedModuleId={selectedModuleId}
            onSelectModule={setSelectedModuleId}
            onChanged={setModules}
          />
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto bg-[var(--admin-bg)] px-4 py-6 md:px-8 md:py-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-6 pb-8">
            <CourseSettingsForm course={course} editable={editable} onSaved={setCourse} />
          </div>
        </section>

        <section
          className={`${builderPanelClassName} w-full shrink-0 border-t lg:w-[280px] lg:border-l lg:border-t-0`}
        >
          <BuilderValidationPanel
            course={course}
            moduleCount={modules.length}
            canPublish={canPublish}
            onPublish={() => {
              void handlePublish();
            }}
            publishing={publishMutation.isPending}
            publishError={publishError}
          />
        </section>
      </div>
    </div>
  );
}
