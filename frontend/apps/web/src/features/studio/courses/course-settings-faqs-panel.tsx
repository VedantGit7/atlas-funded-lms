"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import type { z } from "zod";
import type { studioCourseDetailSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseFaqEmptyIllustrationGraphic } from "./course-faq-empty-illustration";
import { courseFaqsFromDetail, type CourseFaqItem } from "./course-faq-settings";
import { formatCourseFaqError, deleteCourseFaq } from "./course-faqs-client";
import { builderHelperClassName } from "./course-builder-shared";
import {
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor/inline-lesson-editor-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type CourseSettingsFaqsPanelProps = {
  course: CourseDetail;
  disabled: boolean;
  refreshToken?: number;
  onAddFaq: () => void;
  onEditFaq: (faqId: string) => void;
  onCourseChange: (course: CourseDetail) => void;
};

export function CourseSettingsFaqsPanel({
  course,
  disabled,
  refreshToken = 0,
  onAddFaq,
  onEditFaq,
  onCourseChange,
}: CourseSettingsFaqsPanelProps) {
  const faqs = useMemo(() => courseFaqsFromDetail(course), [course, refreshToken]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const hasFaqs = faqs.length > 0;

  async function handleRemove(faqId: string) {
    if (disabled || removingId) return;
    setRemovingId(faqId);
    setError(null);
    try {
      const updated = await deleteCourseFaq(course, faqId, faqs);
      onCourseChange(updated);
      if (expandedId === faqId) {
        setExpandedId(null);
      }
    } catch (removeError) {
      setError(formatCourseFaqError(removeError));
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-end gap-4">
        <button
          type="button"
          className={inlineLessonSecondaryButtonClassName}
          disabled={disabled}
          onClick={onAddFaq}
        >
          Add Faqs
        </button>
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))] px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      {!hasFaqs ? (
        <section className="flex min-h-[min(22rem,calc(100vh-20rem))] flex-col items-center justify-center px-6 py-12 text-center">
          <CourseFaqEmptyIllustrationGraphic />
          <h3 className="mt-8 text-lg font-bold text-[var(--admin-on-surface)]">Add FAQ</h3>
          <p className={`${builderHelperClassName} mt-2 max-w-sm`}>
            Add frequently asked questions for your course.
          </p>
          <button
            type="button"
            className={`${inlineLessonPrimaryDarkButtonClassName} mt-8 gap-2`}
            disabled={disabled}
            onClick={onAddFaq}
          >
            <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
            Add faq
          </button>
        </section>
      ) : (
        <>
          <ul className="space-y-3">
            {faqs.map((faq, index) => (
              <CourseFaqListItem
                key={faq.id}
                faq={faq}
                index={index}
                expanded={expandedId === faq.id}
                disabled={disabled}
                removing={removingId === faq.id}
                onToggle={() => {
                  setExpandedId((current) => (current === faq.id ? null : faq.id));
                }}
                onEdit={() => {
                  onEditFaq(faq.id);
                }}
                onRemove={() => {
                  void handleRemove(faq.id);
                }}
              />
            ))}
          </ul>

          <div className="flex justify-center pt-2">
            <button
              type="button"
              className={`${inlineLessonPrimaryDarkButtonClassName} gap-2`}
              disabled={disabled}
              onClick={onAddFaq}
            >
              <Plus className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden="true" />
              Add faq
            </button>
          </div>
        </>
      )}
    </div>
  );
}

type CourseFaqListItemProps = {
  faq: CourseFaqItem;
  index: number;
  expanded: boolean;
  disabled: boolean;
  removing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
};

function CourseFaqListItem({
  faq,
  index,
  expanded,
  disabled,
  removing,
  onToggle,
  onEdit,
  onRemove,
}: CourseFaqListItemProps) {
  return (
    <li className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="flex items-start gap-2 px-4 py-3">
        <button
          type="button"
          className="flex min-w-0 flex-1 items-start gap-3 text-left"
          aria-expanded={expanded}
          onClick={onToggle}
        >
          <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))] text-[11px] font-bold text-[var(--admin-primary-strong)]">
            {index + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--admin-on-surface)]">
              {faq.question}
            </span>
            {!expanded && faq.answer ? (
              <span className={`${builderHelperClassName} mt-1 block line-clamp-2`}>
                {faq.answer}
              </span>
            ) : null}
          </span>
          <ChevronDown
            className={[
              "mt-0.5 h-4 w-4 shrink-0 text-[var(--admin-on-surface-variant)] transition-transform duration-200",
              expanded ? "rotate-180" : "",
            ].join(" ")}
            strokeWidth={2}
            aria-hidden="true"
          />
        </button>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-40"
            disabled={disabled || removing}
            aria-label={`Edit ${faq.question}`}
            onClick={onEdit}
          >
            <Pencil className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] hover:text-[var(--admin-danger)] disabled:opacity-40"
            disabled={disabled || removing}
            aria-label={`Remove ${faq.question}`}
            onClick={onRemove}
          >
            <Trash2 className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>
      </div>

      {expanded && faq.answer ? (
        <div className="border-t border-[var(--admin-border)] px-4 py-3 pl-[3.25rem]">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--admin-on-surface-variant)]">
            {faq.answer}
          </p>
        </div>
      ) : null}
    </li>
  );
}
