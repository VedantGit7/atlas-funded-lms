"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronLeft, Plus, X } from "lucide-react";
import type { z } from "zod";
import type { studioCourseModulesResponseSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import type { studioLessonOutlineItemSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import {
  DropdownField,
  dropdownItemClassName,
  inlineExpandClassName,
} from "./admin-form-dropdown-shared";
import {
  builderFieldLabelClassName,
  builderHelperClassName,
  fieldClassName,
  primaryButtonClassName,
} from "./course-builder-shared";
import {
  certificatesSettingsEqual,
  type CertificateAttemptMode,
  type CertificateTestRef,
  type CourseCertificatesSettings,
} from "./course-certificates-settings";
import {
  CourseSettingsFormFooter,
  CourseSettingsSectionBlock,
  courseSettingsCardClassName,
} from "./course-settings-shared";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";

type StudioCourseModulesResponse = z.infer<typeof studioCourseModulesResponseSchema>;
type StudioLessonOutlineItem = z.infer<typeof studioLessonOutlineItemSchema>;
type StudioModuleLessonsResponse = {
  data: {
    items: StudioLessonOutlineItem[];
  };
};

type QuizLessonOption = {
  lessonId: string;
  title: string;
  moduleTitle: string;
};

type CourseCertificateAddTestDialogProps = {
  courseId: string;
  open: boolean;
  excludedLessonIds: string[];
  onClose: () => void;
  onAdd: (test: CertificateTestRef) => void;
};

function CourseCertificateAddTestDialog({
  courseId,
  open,
  excludedLessonIds,
  onClose,
  onAdd,
}: CourseCertificateAddTestDialogProps) {
  const titleId = useId();
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const [options, setOptions] = useState<QuizLessonOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [passingMarks, setPassingMarks] = useState("");

  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown, true);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
    };
  }, [onClose, open]);

  useEffect(() => {
    if (!open) {
      setSelectedLessonId(null);
      setDropdownOpen(false);
      setPassingMarks("");
      setError(null);
      return;
    }

    let cancelled = false;

    async function loadQuizzes() {
      setLoading(true);
      setError(null);
      try {
        const response = await clientApi.get<StudioCourseModulesResponse>(
          `/api/v1/courses/${courseId}/modules?view=studio`,
        );
        if (cancelled) return;

        const quizzes: QuizLessonOption[] = [];

        await Promise.all(
          response.data.items.map(async (module) => {
            const lessonsResponse = await clientApi.get<StudioModuleLessonsResponse>(
              `/api/v1/modules/${module.id}/lessons?view=studio`,
            );

            for (const lesson of lessonsResponse.data.items) {
              if (lesson.lessonType !== "section_quiz") continue;
              if (excludedLessonIds.includes(lesson.id)) continue;
              quizzes.push({
                lessonId: lesson.id,
                title: lesson.title,
                moduleTitle: module.title,
              });
            }
          }),
        );

        quizzes.sort((a, b) => a.title.localeCompare(b.title));
        setOptions(quizzes);
      } catch (caught) {
        if (!cancelled) {
          setError(
            caught instanceof ClientApiError ? caught.message : "Unable to load course tests.",
          );
          setOptions([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadQuizzes();

    return () => {
      cancelled = true;
    };
  }, [courseId, excludedLessonIds, open]);

  const selectedOption = options.find((option) => option.lessonId === selectedLessonId) ?? null;
  const parsedPassingMarks = Number(passingMarks);
  const canSave =
    selectedOption != null &&
    passingMarks.trim().length > 0 &&
    Number.isFinite(parsedPassingMarks) &&
    parsedPassingMarks >= 0 &&
    parsedPassingMarks <= 100;

  function handleSave() {
    if (!canSave) return;
    onAdd({
      lessonId: selectedOption.lessonId,
      title: selectedOption.title,
      passingMarks: Math.max(0, Math.min(100, Math.floor(parsedPassingMarks))),
    });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="admin-theme fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
        onClick={(event) => {
          event.stopPropagation();
        }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
              Add Test Criteria
            </h2>
            <p className={`${builderHelperClassName} mt-1.5 leading-relaxed`}>
              Add test and assign passing marks required for the test to issue certificates to
              learners
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)]"
            onClick={onClose}
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
            >
              {error}
            </p>
          ) : null}

          <DropdownField
            label={
              <label htmlFor="certificate-test-lesson" className={builderFieldLabelClassName}>
                Certificate Tests
              </label>
            }
            labelId="certificate-test-lesson"
            open={dropdownOpen}
            disabled={loading || options.length === 0}
            onToggle={() => {
              if (loading || options.length === 0) return;
              setDropdownOpen((current) => !current);
            }}
            triggerContent={
              <span
                className={
                  selectedOption
                    ? "text-[var(--admin-on-surface)]"
                    : "text-[var(--admin-on-surface-variant)]"
                }
              >
                {loading
                  ? "Loading tests…"
                  : options.length === 0
                    ? "No section quizzes available"
                    : (selectedOption?.title ?? "Select Tests")}
              </span>
            }
            panelAriaLabel="Certificate tests"
            portalZIndex={130}
          >
            <div className="max-h-60 overflow-y-auto p-1.5">
              {options.map((option) => (
                <button
                  key={option.lessonId}
                  type="button"
                  className={dropdownItemClassName}
                  onClick={() => {
                    setSelectedLessonId(option.lessonId);
                    setDropdownOpen(false);
                  }}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-[var(--admin-on-surface)]">
                      {option.title}
                    </span>
                    <span className={`${builderHelperClassName} block truncate`}>
                      {option.moduleTitle}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </DropdownField>

          <div className="space-y-2">
            <label htmlFor="certificate-passing-marks" className={builderFieldLabelClassName}>
              Passing marks
            </label>
            <div className="flex overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/25">
              <input
                id="certificate-passing-marks"
                type="number"
                min={0}
                max={100}
                inputMode="numeric"
                placeholder="Enter the Passing Marks"
                className={`${fieldClassName} min-w-0 flex-1 rounded-none border-0 bg-[var(--admin-surface-low)] shadow-none focus:ring-0`}
                value={passingMarks}
                onChange={(event) => {
                  setPassingMarks(event.target.value);
                }}
              />
              <span className="inline-flex shrink-0 items-center border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                %
              </span>
            </div>
            <p className={`${builderHelperClassName} mt-1`}>
              Minimum score percent required on this test for certificate eligibility.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--admin-border)] px-6 py-4">
          <button
            type="button"
            className={`${primaryButtonClassName} min-w-[7.5rem]`}
            disabled={!canSave}
            onClick={handleSave}
          >
            Save
          </button>
          <button type="button" className={inlineLessonSecondaryButtonClassName} onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const ATTEMPT_OPTIONS: Array<{ value: CertificateAttemptMode; label: string }> = [
  { value: "first_attempt", label: "First Attempt" },
  { value: "latest_attempt", label: "Latest Attempt" },
];

type CourseSettingsCertificatesConfigurePanelProps = {
  courseId: string;
  form: CourseCertificatesSettings;
  savedForm: CourseCertificatesSettings;
  disabled: boolean;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onChange: (patch: Partial<CourseCertificatesSettings>) => void;
  onSave: () => void;
  onCancel: () => void;
};

function CertificateAttemptRadioGroup({
  value,
  disabled,
  onChange,
}: {
  value: CertificateAttemptMode | null;
  disabled?: boolean;
  onChange: (value: CertificateAttemptMode) => void;
}) {
  return (
    <div className="space-y-4" role="radiogroup" aria-label="Certificate attempt mode">
      {ATTEMPT_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={[
              "flex cursor-pointer items-center gap-3 rounded-lg transition-opacity",
              disabled ? "cursor-not-allowed opacity-60" : "",
            ].join(" ")}
          >
            <span
              className={[
                "inline-flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-[border-color,background-color] duration-200",
                selected
                  ? "border-[var(--admin-primary)]"
                  : "border-[var(--admin-outline)] bg-[var(--admin-surface)]",
              ].join(" ")}
              aria-hidden="true"
            >
              {selected ? (
                <span className="h-2 w-2 rounded-full bg-[var(--admin-primary)]" />
              ) : null}
            </span>
            <span className="text-sm font-semibold text-[var(--admin-on-surface)]">
              {option.label}
            </span>
            <input
              type="radio"
              name="certificate-attempt-mode"
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

export function CourseSettingsCertificatesConfigurePanel({
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
}: CourseSettingsCertificatesConfigurePanelProps) {
  const [addTestOpen, setAddTestOpen] = useState(false);
  const isDirty = !certificatesSettingsEqual(form, savedForm);

  const completionValue =
    form.completionCriteriaPercent != null ? String(form.completionCriteriaPercent) : "";

  return (
    <>
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
            Configure Certificates
          </h1>
          <p
            className={`${builderHelperClassName} mt-2 max-w-2xl text-sm leading-relaxed md:text-[0.9375rem]`}
          >
            Configure certificate settings and add tests to issue certificates
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

        <div className="space-y-10">
          <CourseSettingsSectionBlock
            title="Certificate Tests"
            description="Add certificate tests to issue certificates based on test results"
          >
            <div className="space-y-4">
              {form.certificateTests.length > 0 ? (
                <ul className={`space-y-2 ${inlineExpandClassName}`}>
                  {form.certificateTests.map((test) => (
                    <li
                      key={test.lessonId}
                      className="flex items-center justify-between gap-3 rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-3 shadow-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-[var(--admin-on-surface)]">
                          {test.title}
                        </p>
                        <p className={`${builderHelperClassName} mt-0.5`}>
                          Passing marks: {test.passingMarks}
                        </p>
                      </div>
                      <button
                        type="button"
                        className="rounded-md p-1 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
                        disabled={disabled}
                        aria-label={`Remove ${test.title}`}
                        onClick={() => {
                          onChange({
                            certificateTests: form.certificateTests.filter(
                              (item) => item.lessonId !== test.lessonId,
                            ),
                          });
                        }}
                      >
                        <X className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}

              <button
                type="button"
                className={`${inlineLessonSecondaryButtonClassName} gap-1.5`}
                disabled={disabled}
                onClick={() => {
                  setAddTestOpen(true);
                }}
              >
                <Plus className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
                Add test
              </button>
            </div>
          </CourseSettingsSectionBlock>

          <section className="space-y-4">
            <h2 className="text-base font-bold text-[var(--admin-on-surface)]">
              Course Completion Criteria
            </h2>
            <div className="space-y-2">
              <label htmlFor="certificate-completion-criteria" className="sr-only">
                Course completion criteria percentage
              </label>
              <div className="flex overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm focus-within:border-[var(--admin-primary)] focus-within:ring-2 focus-within:ring-[var(--admin-primary)]/25">
                <input
                  id="certificate-completion-criteria"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  placeholder="Enter completion criteria % to issue certificates"
                  className={`${fieldClassName} min-w-0 flex-1 rounded-none border-0 bg-[var(--admin-surface-low)] shadow-none focus:ring-0`}
                  value={completionValue}
                  disabled={disabled}
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    if (raw.length === 0) {
                      onChange({ completionCriteriaPercent: null });
                      return;
                    }
                    const parsed = Number(raw);
                    if (!Number.isFinite(parsed)) return;
                    onChange({
                      completionCriteriaPercent: Math.max(0, Math.min(100, Math.floor(parsed))),
                    });
                  }}
                />
                <span className="inline-flex shrink-0 items-center border-l border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-sm font-medium text-[var(--admin-on-surface-variant)]">
                  %
                </span>
              </div>
              <p className="inline-flex items-start gap-1.5 text-xs text-[var(--admin-on-surface-variant)]">
                <span
                  className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--admin-primary)]"
                  aria-hidden="true"
                />
                <span>Certificates will be issued on % of course completion</span>
              </p>
            </div>
          </section>

          <CourseSettingsSectionBlock
            title="Certificates"
            description="Enable course certification for your learners to issue certificates based on determined criteria"
          >
            <div className={courseSettingsCardClassName}>
              <CertificateAttemptRadioGroup
                value={form.attemptMode}
                disabled={disabled}
                onChange={(attemptMode) => {
                  onChange({ attemptMode });
                }}
              />
            </div>
          </CourseSettingsSectionBlock>
        </div>

        {!disabled ? (
          <CourseSettingsFormFooter
            onSave={onSave}
            onCancel={onCancel}
            saving={saving}
            saveDisabled={!isDirty}
            cancelDisabled={!isDirty}
          />
        ) : null}
      </div>

      <CourseCertificateAddTestDialog
        courseId={courseId}
        open={addTestOpen}
        excludedLessonIds={form.certificateTests.map((test) => test.lessonId)}
        onClose={() => {
          setAddTestOpen(false);
        }}
        onAdd={(test) => {
          onChange({
            certificateTests: [...form.certificateTests, test],
          });
        }}
      />
    </>
  );
}
