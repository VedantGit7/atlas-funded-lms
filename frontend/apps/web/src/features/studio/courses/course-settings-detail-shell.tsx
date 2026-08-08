"use client";

import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { builderHelperClassName } from "./course-builder-shared";
import { inlineLessonGhostButtonClassName } from "./inline-lesson-editor/inline-lesson-editor-shared";
import type { CourseSettingsCard } from "./course-settings-metadata";

type CourseSettingsDetailShellProps = {
  card: CourseSettingsCard;
  courseId: string;
  children: ReactNode;
  wide?: boolean;
};

export function CourseSettingsDetailShell({
  card,
  courseId,
  children,
  wide = false,
}: CourseSettingsDetailShellProps) {
  const router = useRouter();

  return (
    <div
      className={[
        "w-full min-w-0 px-4 py-8 md:px-8",
        wide ? "mx-auto max-w-6xl" : "mx-auto max-w-3xl",
      ].join(" ")}
    >
      <button
        type="button"
        className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
        onClick={() => {
          router.push(`/studio/courses/${courseId}/settings`);
        }}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Back
      </button>

      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)]">
          {card.title}
        </h1>
        <p className={`${builderHelperClassName} mt-2 max-w-2xl text-sm md:text-base`}>
          {card.description}
        </p>
      </header>

      {children}
    </div>
  );
}
