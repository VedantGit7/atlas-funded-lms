"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Award, ChevronDown, ChevronRight, FileText, Tag, UserRound } from "lucide-react";
import type { z } from "zod";
import { clientApi } from "../../../lib/client-api";
import type {
  studioCourseDetailSchema,
  studioModuleOutlineItemSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonOutlineItemSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { memberInitials } from "./admin-form-dropdown-shared";
import { loadInstructorMembers, type InstructorMember } from "./create-course-add-member-dialog";
import {
  courseDetailCardClassName,
  courseDetailMutedTextClassName,
  courseDetailSectionTitleClassName,
  formatCourseCategoryLabel,
  formatSectionLessonSummary,
  readCourseCategory,
  readInstructorMembershipIds,
} from "./course-detail-shared";
import { deriveCourseFeatureFlags } from "./course-feature-flags";
import { StudioCoursePrice } from "./StudioCoursePrice";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;
type LessonOutlineItem = z.infer<typeof studioLessonOutlineItemSchema>;

type CourseOverviewProps = {
  course: CourseDetail;
  modules: ModuleItem[];
  courseId: string;
};

function CreatorAvatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "lg"
      ? "h-12 w-12 text-base"
      : size === "sm"
        ? "h-6 w-6 text-[10px]"
        : "h-8 w-8 text-xs";

  if (avatarUrl) {
    return (
      <img src={avatarUrl} alt="" className={`${sizeClass} shrink-0 rounded-full object-cover`} />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-flex shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_18%,var(--admin-surface-high))] font-semibold text-[var(--admin-primary)]`}
    >
      {memberInitials(name, null)}
    </span>
  );
}

function CourseOverviewSidebar({
  course,
  creators,
}: {
  course: CourseDetail;
  creators: InstructorMember[];
}) {
  const features = deriveCourseFeatureFlags(course);
  const certificateEnabled =
    features.find((feature) => feature.id === "certificate")?.enabled ??
    course.accessTier === "PAID";
  const primaryCreator = creators[0];

  return (
    <aside className="space-y-4 lg:sticky lg:top-28">
      <section className={`${courseDetailCardClassName} p-5`}>
        <p className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          <StudioCoursePrice course={course} />
        </p>
        <div className="mt-5 space-y-3">
          <p className="text-sm font-semibold text-[var(--admin-on-surface)]">
            This course includes:
          </p>
          <ul className="space-y-2">
            {certificateEnabled ? (
              <li className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
                <Award
                  className="h-4 w-4 shrink-0 text-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                Certificate of completion
              </li>
            ) : (
              <li className={courseDetailMutedTextClassName}>Self-paced lessons</li>
            )}
          </ul>
        </div>
      </section>

      {primaryCreator ? (
        <section className={`${courseDetailCardClassName} p-5`}>
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
            Course creator
          </p>
          <div className="mt-4 flex items-center gap-3">
            <CreatorAvatar
              name={primaryCreator.displayName}
              avatarUrl={primaryCreator.avatarUrl}
              size="lg"
            />
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-[var(--admin-on-surface)]">
                {primaryCreator.displayName}
              </p>
              {primaryCreator.email ? (
                <p className="truncate text-sm text-[var(--admin-on-surface-variant)]">
                  {primaryCreator.email}
                </p>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}
    </aside>
  );
}

function CourseContentAccordion({
  courseId,
  modules,
}: {
  courseId: string;
  modules: ModuleItem[];
}) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(modules[0]?.id ? [modules[0].id] : []),
  );
  const [lessonsByModule, setLessonsByModule] = useState<Record<string, LessonOutlineItem[]>>({});
  const [loadingModuleId, setLoadingModuleId] = useState<string | null>(null);

  const totalLessons = useMemo(
    () => modules.reduce((sum, module) => sum + module.lessonCount, 0),
    [modules],
  );

  async function ensureLessonsLoaded(moduleId: string) {
    if (lessonsByModule[moduleId] || loadingModuleId === moduleId) return;

    setLoadingModuleId(moduleId);
    try {
      const response = await clientApi.get<{ data: { items: LessonOutlineItem[] } }>(
        `/api/v1/modules/${moduleId}/lessons?view=studio`,
      );
      setLessonsByModule((current) => ({
        ...current,
        [moduleId]: response.data.items,
      }));
    } finally {
      setLoadingModuleId(null);
    }
  }

  function toggleModule(moduleId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(moduleId)) {
        next.delete(moduleId);
      } else {
        next.add(moduleId);
        void ensureLessonsLoaded(moduleId);
      }
      return next;
    });
  }

  useEffect(() => {
    const firstModule = modules[0];
    if (firstModule) {
      void ensureLessonsLoaded(firstModule.id);
    }
  }, [modules]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h2 className={courseDetailSectionTitleClassName}>Course content</h2>
        <p className={courseDetailMutedTextClassName}>
          {formatSectionLessonSummary(modules.length, totalLessons)}
        </p>
      </div>

      <div className={`${courseDetailCardClassName} divide-y divide-[var(--admin-border)]`}>
        {modules.length === 0 ? (
          <p className="px-5 py-8 text-sm text-[var(--admin-on-surface-variant)]">
            No sections yet. Add modules in the course editor.
          </p>
        ) : (
          modules.map((module) => {
            const expanded = expandedIds.has(module.id);
            const lessons = lessonsByModule[module.id];
            const loading = loadingModuleId === module.id && !lessons;

            return (
              <div key={module.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-[var(--admin-surface-high)]"
                  aria-expanded={expanded}
                  onClick={() => {
                    toggleModule(module.id);
                  }}
                >
                  {expanded ? (
                    <ChevronDown
                      className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                  ) : (
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)]"
                      aria-hidden="true"
                    />
                  )}
                  <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--admin-on-surface)]">
                    {module.title}
                  </span>
                  <span className="text-sm text-[var(--admin-on-surface-variant)]">
                    {module.lessonCount}
                  </span>
                </button>

                {expanded ? (
                  <div className="border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                    {loading ? (
                      <p className="px-12 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                        Loading lessons…
                      </p>
                    ) : (lessons?.length ?? 0) === 0 ? (
                      <p className="px-12 py-3 text-sm text-[var(--admin-on-surface-variant)]">
                        No lessons yet
                      </p>
                    ) : (
                      <ul className="py-1">
                        {lessons?.map((lesson) => (
                          <li key={lesson.id}>
                            <Link
                              href={`/studio/courses/${courseId}/lessons/${lesson.id}`}
                              className="flex items-center gap-3 px-12 py-2.5 text-sm text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-primary)]"
                            >
                              <FileText className="h-4 w-4 shrink-0" aria-hidden="true" />
                              <span className="truncate text-[var(--admin-on-surface)]">
                                {lesson.title}
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ) : null}
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

export function CourseOverview({ course, modules, courseId }: CourseOverviewProps) {
  const [creators, setCreators] = useState<InstructorMember[]>([]);
  const categoryLabel = formatCourseCategoryLabel(readCourseCategory(course.tags));
  const instructorIds = readInstructorMembershipIds(course.tags);
  const shortDescription = course.shortDescription?.trim() ?? "";
  const aboutDescription = course.description?.trim() ?? "";

  useEffect(() => {
    let cancelled = false;

    async function loadCreators() {
      const members = await loadInstructorMembers();
      if (cancelled) return;

      const selected =
        instructorIds.length > 0
          ? members.filter((member) => instructorIds.includes(member.membershipId))
          : members.slice(0, 1);

      setCreators(selected);
    }

    void loadCreators();

    return () => {
      cancelled = true;
    };
  }, [instructorIds.join("|")]);

  const primaryCreator = creators[0];

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 md:px-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-8">
        <header className="space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-4xl">
            {course.title}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[var(--admin-on-surface-variant)]">
            {categoryLabel ? (
              <span className="inline-flex items-center gap-1.5">
                <Tag className="h-4 w-4" aria-hidden="true" />
                {categoryLabel}
              </span>
            ) : null}
            {categoryLabel && primaryCreator ? (
              <span aria-hidden="true" className="text-[var(--admin-outline)]">
                ·
              </span>
            ) : null}
            {primaryCreator ? (
              <span className="inline-flex items-center gap-2">
                <CreatorAvatar
                  name={primaryCreator.displayName}
                  avatarUrl={primaryCreator.avatarUrl}
                  size="sm"
                />
                {primaryCreator.displayName}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="h-4 w-4" aria-hidden="true" />
                Course team
              </span>
            )}
          </div>

          {shortDescription ? (
            <p className={`${courseDetailMutedTextClassName} max-w-3xl leading-relaxed`}>
              {shortDescription}
            </p>
          ) : null}
        </header>

        <CourseContentAccordion courseId={courseId} modules={modules} />

        {aboutDescription ? (
          <section className="space-y-3">
            <h2 className={courseDetailSectionTitleClassName}>About this course</h2>
            <p
              className={`${courseDetailMutedTextClassName} max-w-3xl whitespace-pre-wrap leading-relaxed`}
            >
              {aboutDescription}
            </p>
          </section>
        ) : null}
      </div>

      <CourseOverviewSidebar course={course} creators={creators} />
    </div>
  );
}
