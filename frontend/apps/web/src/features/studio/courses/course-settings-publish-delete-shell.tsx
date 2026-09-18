"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  fieldClassName,
} from "./course-builder-shared";
import type { CourseSettingsCard } from "./course-settings-metadata";
import { COURSE_PUBLISH_DELETE_SETTINGS_SECTIONS } from "./course-settings-metadata";
import { courseSettingsNavItemClassName } from "./course-settings-shared";
import { inlineLessonGhostButtonClassName } from "./inline-lesson-editor/inline-lesson-settings-shared";

type CourseSettingsPublishDeleteShellProps = {
  courseId: string;
  section: CourseSettingsCard;
  children: ReactNode;
};

export function CourseSettingsPublishDeleteShell({
  courseId,
  section,
  children,
}: CourseSettingsPublishDeleteShellProps) {
  const router = useRouter();

  return (
    <div className="flex min-h-[calc(100vh-11rem)] flex-col px-4 py-6 md:px-8 md:py-8">
      <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm">
        <aside className="hidden w-[15.5rem] shrink-0 flex-col border-r border-[var(--admin-border)] bg-[var(--admin-surface)] lg:flex">
          <div className="border-b border-[var(--admin-border)] px-5 py-4">
            <p className="text-sm font-bold text-[var(--admin-on-surface)]">
              Publish/Delete Course
            </p>
            <p className={`${builderHelperClassName} mt-1`}>
              Delete or disable course and learners
            </p>
          </div>
          <nav
            className="flex flex-col gap-0.5 p-3"
            aria-label="Publish and delete course settings"
          >
            {COURSE_PUBLISH_DELETE_SETTINGS_SECTIONS.map((item) => {
              const active = section.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={courseSettingsNavItemClassName(active, !item.available)}
                  aria-current={active ? "page" : undefined}
                  onClick={() => {
                    if (item.externalHref) {
                      router.push(item.externalHref(courseId));
                      return;
                    }
                    router.push(`/studio/courses/${courseId}/settings?section=${item.id}`);
                  }}
                >
                  {active ? (
                    <span
                      className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-[var(--admin-primary)]"
                      aria-hidden="true"
                    />
                  ) : null}
                  <span className="pl-1">{item.title}</span>
                  {!item.available ? (
                    <span className="ml-auto rounded-md bg-[var(--admin-surface-high)] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      Soon
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--admin-surface-low)]">
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col px-4 py-6 md:px-8 md:py-8">
            <button
              type="button"
              className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 self-start px-2`}
              onClick={() => {
                router.push(`/studio/courses/${courseId}/settings`);
              }}
            >
              <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Back
            </button>

            <header className="mb-8 border-b border-[var(--admin-border)] pb-6">
              <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-[1.75rem]">
                {section.title}
              </h1>
              <p
                className={`${builderHelperClassName} mt-2 max-w-2xl text-sm leading-relaxed md:text-[0.9375rem]`}
              >
                {section.description}
              </p>
            </header>

            <div className="mb-6 lg:hidden">
              <label
                htmlFor="course-publish-delete-settings-section"
                className={builderFieldLabelClassName}
              >
                Section
              </label>
              <select
                id="course-publish-delete-settings-section"
                className={`${fieldClassName} mt-2`}
                value={section.id}
                onChange={(event) => {
                  const next = COURSE_PUBLISH_DELETE_SETTINGS_SECTIONS.find(
                    (item) => item.id === event.target.value,
                  );
                  if (next?.externalHref) {
                    router.push(next.externalHref(courseId));
                    return;
                  }
                  router.push(`/studio/courses/${courseId}/settings?section=${event.target.value}`);
                }}
              >
                {COURSE_PUBLISH_DELETE_SETTINGS_SECTIONS.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.title}
                    {!item.available ? " (Coming soon)" : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="min-h-0 flex-1">{children}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
