"use client";

import { useEffect, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { z } from "zod";
import type { studioCourseModulesResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonOutlineItemSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import type { CourseDripSettings, DripLessonSchedule } from "./course-access-settings";
import { courseDripSettingsEqual } from "./course-access-settings";
import {
  builderHelperClassName,
  fieldClassName,
} from "./course-builder-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  courseSettingsCardClassName,
} from "./course-settings-shared";
import { inlineLessonGhostButtonClassName } from "./inline-lesson-editor/inline-lesson-editor-shared";

type StudioCourseModulesResponse = z.infer<typeof studioCourseModulesResponseSchema>;
type StudioLessonOutlineItem = z.infer<typeof studioLessonOutlineItemSchema>;
type StudioModuleLessonsResponse = {
  data: {
    items: StudioLessonOutlineItem[];
  };
};

type LessonDripRow = {
  lessonId: string;
  title: string;
  moduleTitle: string;
  releaseAfterDays: number;
};

type CourseSettingsContentDrippingConfigurePanelProps = {
  courseId: string;
  form: CourseDripSettings;
  savedForm: CourseDripSettings;
  disabled: boolean;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onChange: (patch: Partial<CourseDripSettings>) => void;
  onSave: () => void;
  onCancel: () => void;
};

function readReleaseAfterDays(
  schedules: DripLessonSchedule[],
  lessonId: string,
  fallback: number,
): number {
  const match = schedules.find((schedule) => schedule.lessonId === lessonId);
  return match?.releaseAfterDays ?? fallback;
}

function upsertLessonSchedule(
  schedules: DripLessonSchedule[],
  lessonId: string,
  releaseAfterDays: number,
): DripLessonSchedule[] {
  const next = schedules.filter((schedule) => schedule.lessonId !== lessonId);
  next.push({ lessonId, releaseAfterDays });
  return next.sort((a, b) => a.lessonId.localeCompare(b.lessonId));
}

export function CourseSettingsContentDrippingConfigurePanel({
  courseId,
  form,
  savedForm,
  disabled,
  saving,
  error,
  onBack,
  onChange,
  onSave,
  onCancel,
}: CourseSettingsContentDrippingConfigurePanelProps) {
  const [lessons, setLessons] = useState<LessonDripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const isDirty = !courseDripSettingsEqual(form, savedForm);

  useEffect(() => {
    let cancelled = false;

    async function loadLessons() {
      setLoading(true);
      setLoadError(null);

      try {
        const response = await clientApi.get<StudioCourseModulesResponse>(
          `/api/v1/courses/${courseId}/modules?view=studio`,
        );
        if (cancelled) return;

        const rows: LessonDripRow[] = [];
        let lessonIndex = 0;

        for (const module of response.data.items) {
          const lessonsResponse = await clientApi.get<StudioModuleLessonsResponse>(
            `/api/v1/modules/${module.id}/lessons?view=studio`,
          );

          for (const lesson of lessonsResponse.data.items) {
            const defaultDays = lessonIndex * form.dripIntervalDays;
            rows.push({
              lessonId: lesson.id,
              title: lesson.title,
              moduleTitle: module.title,
              releaseAfterDays: readReleaseAfterDays(
                form.dripLessonSchedules,
                lesson.id,
                defaultDays,
              ),
            });
            lessonIndex += 1;
          }
        }

        if (!cancelled) {
          setLessons(rows);
        }
      } catch (caught) {
        if (!cancelled) {
          setLoadError(
            caught instanceof ClientApiError ? caught.message : "Unable to load course lessons.",
          );
          setLessons([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadLessons();

    return () => {
      cancelled = true;
    };
  }, [courseId, form.dripIntervalDays]);

  useEffect(() => {
    setLessons((current) =>
      current.map((lesson) => ({
        ...lesson,
        releaseAfterDays: readReleaseAfterDays(
          form.dripLessonSchedules,
          lesson.lessonId,
          lesson.releaseAfterDays,
        ),
      })),
    );
  }, [form.dripLessonSchedules]);

  function handleLessonDaysChange(lessonId: string, value: string) {
    const parsed = Number(value);
    const releaseAfterDays = Number.isFinite(parsed) ? Math.max(0, Math.floor(parsed)) : 0;
    setLessons((current) =>
      current.map((lesson) =>
        lesson.lessonId === lessonId ? { ...lesson, releaseAfterDays } : lesson,
      ),
    );
    onChange({
      dripLessonSchedules: upsertLessonSchedule(form.dripLessonSchedules, lessonId, releaseAfterDays),
    });
  }

  return (
    <div className="min-w-0 w-full">
      <button
        type="button"
        className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
        disabled={disabled}
        onClick={onBack}
      >
        <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
        Back
      </button>

      <header className="mb-8 border-b border-[var(--admin-border)] pb-6">
        <h1 className="text-2xl font-bold tracking-tight text-[var(--admin-on-surface)] md:text-[1.75rem]">
          Configure content-dripping
        </h1>
        <p className={`${builderHelperClassName} mt-2 max-w-2xl text-sm leading-relaxed md:text-[0.9375rem]`}>
          Set when each lesson becomes available after the release anchor date
        </p>
      </header>

      {error ? (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      {loadError ? (
        <p
          role="alert"
          className="mb-6 rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {loadError}
        </p>
      ) : null}

      <CourseSettingsSectionBlock
        title="Lesson schedule"
        description="Configure the number of days after the release anchor when each lesson unlocks"
      >
        {loading ? (
          <p className={`${builderHelperClassName} rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-8 text-center`}>
            Loading lessons…
          </p>
        ) : lessons.length === 0 ? (
          <p className={`${builderHelperClassName} rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-8 text-center`}>
            Add lessons to this course to configure content dripping.
          </p>
        ) : (
          <ul className={`space-y-3 ${inlineExpandClassName}`}>
            {lessons.map((lesson) => (
              <li
                key={lesson.lessonId}
                className={`${courseSettingsCardClassName} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--admin-on-surface)]">
                    {lesson.title}
                  </p>
                  <p className={`${builderHelperClassName} mt-0.5 truncate`}>{lesson.moduleTitle}</p>
                </div>
                <div className="w-full sm:w-[11rem]">
                  <label
                    htmlFor={`drip-days-${lesson.lessonId}`}
                    className="sr-only"
                  >
                    Release after days for {lesson.title}
                  </label>
                  <div className="flex overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/25">
                    <input
                      id={`drip-days-${lesson.lessonId}`}
                      type="number"
                      min={0}
                      inputMode="numeric"
                      className={`${fieldClassName} min-w-0 flex-1 rounded-none border-0 bg-[var(--admin-surface-low)] shadow-none focus:ring-0`}
                      value={lesson.releaseAfterDays}
                      disabled={disabled}
                      onChange={(event) => {
                        handleLessonDaysChange(lesson.lessonId, event.target.value);
                      }}
                    />
                    <span className="inline-flex shrink-0 items-center border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-3 text-xs font-medium text-[var(--admin-on-surface-variant)]">
                      Days
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CourseSettingsSectionBlock>

      {!disabled ? (
        <CourseSettingsFormFooter
          onSave={onSave}
          onCancel={onCancel}
          saving={saving}
          saveDisabled={disabled || !isDirty}
          cancelDisabled={disabled || !isDirty}
        />
      ) : null}
    </div>
  );
}
