"use client";

import { useId, useMemo, useState } from "react";
import { ChevronLeft } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { inlineExpandClassName } from "./admin-form-dropdown-shared";
import { builderHelperClassName, builderTextareaClassName } from "./course-builder-shared";
import { lessonInputClassName } from "../lessons/lesson-editor-shared";
import {
  COURSE_FAQ_ANSWER_MAX_LENGTH,
  COURSE_FAQ_QUESTION_MAX_LENGTH,
  courseFaqsFromDetail,
  createEmptyCourseFaqDraft,
  type CourseFaqItem,
} from "./course-faq-settings";
import { formatCourseFaqError, saveCourseFaqs } from "./course-faqs-client";
import { createClientUuid } from "../../../lib/client-api";
import {
  inlineLessonGhostButtonClassName,
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";
import { LessonSettingsFieldLabel } from "./inline-lesson-editor/inline-lesson-settings-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseEditFaqScreenProps = {
  course: CourseDetail;
  faqId: string | null;
  disabled: boolean;
  onBack: () => void;
  onSaved: (course: CourseDetail) => void;
};

export function CourseEditFaqScreen({
  course,
  faqId,
  disabled,
  onBack,
  onSaved,
}: CourseEditFaqScreenProps) {
  const questionId = useId();
  const answerId = useId();
  const existingFaqs = useMemo(() => courseFaqsFromDetail(course), [course]);
  const editingFaq = faqId ? existingFaqs.find((item) => item.id === faqId) : null;
  const isEditing = Boolean(editingFaq);

  const [draft, setDraft] = useState(() =>
    editingFaq
      ? { question: editingFaq.question, answer: editingFaq.answer }
      : createEmptyCourseFaqDraft(),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    const question = draft.question.trim();
    const answer = draft.answer.trim();
    if (!question || disabled || saving) return;

    setSaving(true);
    setError(null);
    try {
      let nextItems: CourseFaqItem[];

      if (isEditing && editingFaq) {
        nextItems = existingFaqs.map((item) =>
          item.id === editingFaq.id ? { ...item, question, answer } : item,
        );
      } else {
        nextItems = [
          ...existingFaqs,
          {
            id: createClientUuid(),
            question,
            answer,
            position: existingFaqs.length,
          },
        ];
      }

      const updated = await saveCourseFaqs(course, nextItems, {
        successMessage: isEditing ? "FAQ updated successfully" : "FAQ added successfully",
      });
      onSaved(updated);
    } catch (saveError) {
      setError(formatCourseFaqError(saveError));
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    if (saving) return;
    setError(null);
    onBack();
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${inlineExpandClassName}`}>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[var(--admin-surface-low)]">
        <div className="mx-auto w-full max-w-2xl px-4 py-6 md:px-8 md:py-8">
          <button
            type="button"
            className={`${inlineLessonGhostButtonClassName} mb-6 gap-1.5 px-2`}
            disabled={saving}
            onClick={onBack}
          >
            <ChevronLeft className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Back
          </button>

          <p className="text-sm font-semibold text-[var(--admin-primary-strong)]">
            {isEditing ? "Edit FAQ" : "Add FAQ"}
          </p>
          <header className="mb-8 mt-1">
            <h1 className="text-2xl font-bold text-[var(--admin-on-surface)] md:text-3xl">
              {isEditing ? "Edit FAQ" : "Add FAQ"}
            </h1>
            <p className={`${builderHelperClassName} mt-2`}>
              {isEditing
                ? "Update the question and answer learners will see on your course page."
                : "Add a question and answer to help learners before they enroll."}
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

          <section className="rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-5 md:p-6">
            <div className="space-y-6">
              <div>
                <LessonSettingsFieldLabel
                  htmlFor={questionId}
                  label="Question"
                  required
                  counter={`${draft.question.length}/${COURSE_FAQ_QUESTION_MAX_LENGTH}`}
                />
                <input
                  id={questionId}
                  className={lessonInputClassName}
                  value={draft.question}
                  maxLength={COURSE_FAQ_QUESTION_MAX_LENGTH}
                  placeholder="Enter the frequently asked question"
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, question: event.target.value }));
                    setError(null);
                  }}
                />
              </div>

              <div>
                <LessonSettingsFieldLabel
                  htmlFor={answerId}
                  label="Answer"
                  required
                  counter={`${draft.answer.length}/${COURSE_FAQ_ANSWER_MAX_LENGTH}`}
                />
                <textarea
                  id={answerId}
                  className={builderTextareaClassName}
                  rows={6}
                  value={draft.answer}
                  maxLength={COURSE_FAQ_ANSWER_MAX_LENGTH}
                  placeholder="Write a clear answer for learners"
                  disabled={disabled || saving}
                  onChange={(event) => {
                    setDraft((current) => ({ ...current, answer: event.target.value }));
                    setError(null);
                  }}
                />
              </div>
            </div>
          </section>

          <div className="mt-10 flex flex-wrap items-center justify-center gap-3 border-t border-[var(--admin-border)] pt-8">
            <button
              type="button"
              className={inlineLessonPrimaryDarkButtonClassName}
              disabled={disabled || saving || !draft.question.trim()}
              onClick={() => {
                void handleSave();
              }}
            >
              {saving ? "Saving…" : isEditing ? "Save" : "Add FAQ"}
            </button>
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              disabled={saving}
              onClick={handleCancel}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
