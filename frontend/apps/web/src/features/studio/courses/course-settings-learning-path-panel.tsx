"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertTriangle, X } from "lucide-react";
import type { z } from "zod";
import type {
  studioCourseDetailSchema,
  studioCourseListResponseSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { DropdownField, dropdownItemClassName, inlineExpandClassName } from "./admin-form-dropdown-shared";
import type { CourseLearningPathSettings, LearningPathLockingMode } from "./course-access-settings";
import {
  courseLearningPathSettingsEqual,
  mergeCourseLearningPathIntoTags,
  parseCourseLearningPathFromTags,
} from "./course-access-settings";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  fieldClassName,
  statusBannerClassName,
} from "./course-builder-shared";
import {
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  CourseSettingsToggleCard,
  courseSettingsCardClassName,
} from "./course-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type StudioCourseListItem = z.infer<
  typeof studioCourseListResponseSchema
>["data"]["items"][number];

type CourseSettingsLearningPathPanelProps = {
  course: CourseDetail;
  editable: boolean;
  onSaved: (course: CourseDetail) => void;
};

const LOCKING_MODE_OPTIONS: Array<{
  value: LearningPathLockingMode;
  title: string;
  description: string;
}> = [
  {
    value: "lesson_lock",
    title: "Lesson Lock",
    description:
      "Enabling this will unlock each lesson sequentially, requiring learners to complete one lesson before accessing the next.",
  },
  {
    value: "section_lock",
    title: "Section Lock",
    description:
      "Enabling this will unlock the next section only after all lessons in the current section are completed.",
  },
];

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save learning path settings.";
}

function learningPathFromCourse(course: CourseDetail): CourseLearningPathSettings {
  return parseCourseLearningPathFromTags(course.tags);
}

function LearningPathLockingRadioGroup({
  value,
  disabled,
  onChange,
}: {
  value: LearningPathLockingMode;
  disabled?: boolean;
  onChange: (value: LearningPathLockingMode) => void;
}) {
  return (
    <div className={`space-y-3 ${inlineExpandClassName}`} role="radiogroup" aria-label="Locking mechanism">
      {LOCKING_MODE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={[
              "flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-4 transition-[border-color,background-color,box-shadow] duration-200",
              selected
                ? "border-[var(--admin-primary)] bg-[color-mix(in_srgb,var(--admin-primary)_7%,var(--admin-surface))] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--admin-primary)_18%,transparent)]"
                : "border-[var(--admin-border)] bg-[var(--admin-surface)] hover:border-[var(--admin-outline)] hover:bg-[var(--admin-surface-low)]",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <span
              className={[
                "relative mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                selected ? "border-[var(--admin-primary)]" : "border-[var(--admin-outline)]",
              ].join(" ")}
              aria-hidden="true"
            >
              {selected ? (
                <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
              ) : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
                  {option.title}
                </span>
                {selected ? (
                  <span className="inline-flex items-center rounded-full bg-[color-mix(in_srgb,var(--admin-primary)_12%,var(--admin-surface))] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--admin-primary-strong)]">
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
              name="learning-path-locking-mode"
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

export function CourseSettingsLearningPathPanel({
  course,
  editable,
  onSaved,
}: CourseSettingsLearningPathPanelProps) {
  const savedForm = useMemo(() => learningPathFromCourse(course), [course]);
  const [form, setForm] = useState<CourseLearningPathSettings>(savedForm);
  const [error, setError] = useState<string | null>(null);
  const [courses, setCourses] = useState<StudioCourseListItem[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [prerequisiteDropdownOpen, setPrerequisiteDropdownOpen] = useState(false);

  useEffect(() => {
    setForm(learningPathFromCourse(course));
  }, [course]);

  useEffect(() => {
    let cancelled = false;

    async function loadCourses() {
      setCoursesLoading(true);
      try {
        const response = await clientApi.get<z.infer<typeof studioCourseListResponseSchema>>(
          "/api/v1/courses?view=studio&limit=100",
        );
        if (!cancelled) {
          setCourses(response.data.items.filter((item) => item.id !== course.id));
        }
      } catch {
        if (!cancelled) {
          setCourses([]);
        }
      } finally {
        if (!cancelled) {
          setCoursesLoading(false);
        }
      }
    }

    void loadCourses();

    return () => {
      cancelled = true;
    };
  }, [course.id]);

  const saveMutation = useMutation({
    mutationFn: async (nextForm: CourseLearningPathSettings) => {
      const response = await clientApi.put<{ data: CourseDetail }>(
        `/api/v1/courses/${course.id}`,
        {
          tags: mergeCourseLearningPathIntoTags(course.tags, nextForm),
        },
        "course-learning-path-update",
      );
      return response.data;
    },
    onMutate: () => {
      setError(null);
    },
    onSuccess: (saved) => {
      onSaved(saved);
    },
    onError: (submitError) => {
      setError(formatError(submitError));
    },
  });

  const disabled = !editable || saveMutation.isPending;
  const isDirty = !courseLearningPathSettingsEqual(form, savedForm);
  const selectedCourses = form.prerequisiteCourseIds
    .map((id) => courses.find((item) => item.id === id))
    .filter((item): item is StudioCourseListItem => item != null);
  const availableCourses = courses.filter((item) => !form.prerequisiteCourseIds.includes(item.id));
  const scoreValue = form.unlockScorePercent != null ? String(form.unlockScorePercent) : "";

  function updateForm(patch: Partial<CourseLearningPathSettings>) {
    setForm((current) => ({ ...current, ...patch }));
  }

  function togglePrerequisite(courseId: string) {
    setForm((current) => ({
      ...current,
      prerequisiteCourseIds: current.prerequisiteCourseIds.includes(courseId)
        ? current.prerequisiteCourseIds.filter((id) => id !== courseId)
        : [...current.prerequisiteCourseIds, courseId],
    }));
  }

  function removePrerequisite(courseId: string) {
    setForm((current) => ({
      ...current,
      prerequisiteCourseIds: current.prerequisiteCourseIds.filter((id) => id !== courseId),
    }));
  }

  function handleCancel() {
    setForm(savedForm);
    setError(null);
  }

  function handleSave() {
    if (disabled || !isDirty) return;
    saveMutation.mutate(form);
  }

  return (
    <div className="min-w-0 w-full">
      {!editable ? (
        <p
          className={`${statusBannerClassName} mb-6 border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}
        >
          This course is locked while in review or published.
        </p>
      ) : null}

      <p
        className={`${statusBannerClassName} mb-6 inline-flex items-start gap-2 border-[var(--admin-warning)]/30 bg-[var(--admin-warning)]/10 text-[var(--admin-warning)]`}
      >
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>
          Learning path feature is in beta version and it will be available only in website.
        </span>
      </p>

      {error ? (
        <p
          role="alert"
          className={`${statusBannerClassName} mb-6 border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
        >
          {error}
        </p>
      ) : null}

      <div className="space-y-8">
        <CourseSettingsToggleCard
          id="sequential-learning-path-enabled"
          title="Enable sequential learning path for this course"
          description="Enable for creating a structured learning experience"
          checked={form.sequentialLearning}
          disabled={disabled}
          onChange={(checked) => {
            updateForm({ sequentialLearning: checked });
          }}
        />

        <CourseSettingsSectionBlock
          title="Locking mechanism"
          description="Choose how lessons and sections unlock for learners"
        >
          <LearningPathLockingRadioGroup
            value={form.lockingMode}
            disabled={disabled}
            onChange={(value) => {
              updateForm({ lockingMode: value });
            }}
          />
        </CourseSettingsSectionBlock>

        <CourseSettingsToggleCard
          id="learning-path-unlock-score-enabled"
          title="Unlock lesson or section based on percentage score"
          description="Enabling this will unlock the next lesson or section based on the percentage score of the section quiz and assignment."
          checked={form.unlockBasedOnScore}
          disabled={disabled}
          onChange={(checked) => {
            updateForm({ unlockBasedOnScore: checked });
          }}
        />

        <div className={`space-y-2 ${inlineExpandClassName}`}>
          <label htmlFor="learning-path-score-percent" className={builderFieldLabelClassName}>
            Set Score Percentage
          </label>
          <div className="flex overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/25">
            <input
              id="learning-path-score-percent"
              type="number"
              min={0}
              max={100}
              inputMode="numeric"
              placeholder="Set Completion Percentage"
              className={`${fieldClassName} min-w-0 flex-1 rounded-none border-0 bg-[var(--admin-surface-low)] shadow-none focus:ring-0`}
              value={scoreValue}
              disabled={disabled || !form.unlockBasedOnScore}
              onChange={(event) => {
                const parsed = Number(event.target.value);
                updateForm({
                  unlockScorePercent:
                    event.target.value.trim().length === 0
                      ? null
                      : Number.isFinite(parsed)
                        ? Math.min(100, Math.max(0, Math.floor(parsed)))
                        : null,
                });
              }}
            />
            <span className="inline-flex shrink-0 items-center border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-sm font-medium text-[var(--admin-on-surface-variant)]">
              (%)
            </span>
          </div>
        </div>

        <CourseSettingsSectionBlock
          title="Prerequisite courses"
          description="Learners must complete these courses before enrolling in this course"
        >
          <div className={`${courseSettingsCardClassName} space-y-4`}>
            {selectedCourses.length > 0 ? (
              <ul className="flex flex-wrap gap-2">
                {selectedCourses.map((item) => (
                  <li
                    key={item.id}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-2.5 py-1.5 text-sm text-[var(--admin-on-surface)]"
                  >
                    <span className="max-w-[14rem] truncate">{item.title}</span>
                    <button
                      type="button"
                      className="rounded-md p-0.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
                      disabled={disabled}
                      aria-label={`Remove ${item.title}`}
                      onClick={() => {
                        removePrerequisite(item.id);
                      }}
                    >
                      <X className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={`${builderHelperClassName} rounded-lg border border-dashed border-[var(--admin-border)] px-4 py-3`}>
                No prerequisite courses selected.
              </p>
            )}

            <DropdownField
              label={
                <span className={builderFieldLabelClassName}>Add prerequisite course</span>
              }
              labelId="prerequisite-course-picker"
              open={prerequisiteDropdownOpen}
              disabled={disabled || coursesLoading || availableCourses.length === 0}
              onToggle={() => {
                if (disabled || coursesLoading || availableCourses.length === 0) return;
                setPrerequisiteDropdownOpen((current) => !current);
              }}
              triggerContent={
                <span
                  className={
                    coursesLoading || availableCourses.length === 0
                      ? "text-[var(--admin-on-surface-variant)]"
                      : "text-[var(--admin-on-surface)]"
                  }
                >
                  {coursesLoading
                    ? "Loading courses…"
                    : availableCourses.length === 0
                      ? "No more courses available"
                      : "Select a course"}
                </span>
              }
              panelAriaLabel="Prerequisite courses"
              portalZIndex={100}
            >
              <div className="max-h-60 overflow-y-auto p-1.5">
                {availableCourses.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={dropdownItemClassName}
                    onClick={() => {
                      togglePrerequisite(item.id);
                      setPrerequisiteDropdownOpen(false);
                    }}
                  >
                    <span className="min-w-0 flex-1 truncate">{item.title}</span>
                  </button>
                ))}
              </div>
            </DropdownField>
          </div>
        </CourseSettingsSectionBlock>
      </div>

      {editable ? (
        <CourseSettingsFormFooter
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saveMutation.isPending}
          saveDisabled={disabled || !isDirty}
          cancelDisabled={disabled || !isDirty}
        />
      ) : null}
    </div>
  );
}
