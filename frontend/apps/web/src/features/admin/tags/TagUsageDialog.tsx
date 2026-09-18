"use client";

import { useEffect, useId } from "react";
import { AlertTriangle, BookOpen, FileText, Loader2, X } from "lucide-react";
import { manageSecondaryButtonClassName } from "../manage/manage-ui-shared";
import type { Tag, TagUsageDetail } from "./tags-api";
import { tagInlineErrorClassName, tagSlugClassName } from "./tags-shared";

type TagUsageDialogProps = {
  open: boolean;
  tag: Tag | null;
  usage: TagUsageDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

/**
 * Where a tag is actually attached.
 *
 * This module used to state that the console could not answer this question,
 * which was true of the API and never of the database. The counts here are
 * exact; the two lists are the first 25 of each, and the dialog says so rather
 * than letting a truncated list read as the whole story.
 */
export function TagUsageDialog({ open, tag, usage, loading, error, onClose }: TagUsageDialogProps) {
  const headingId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [open, onClose]);

  if (!open || !tag) return null;

  const counts = usage?.counts ?? { courses: 0, lessons: 0 };
  const attached = counts.courses + counts.lessons;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
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
        aria-labelledby={headingId}
        className="relative z-10 flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <header className="flex items-start justify-between gap-3 border-b border-[var(--admin-border)] px-6 py-5">
          <div className="min-w-0">
            <h2 id={headingId} className="text-base font-bold text-[var(--admin-on-surface)]">
              Where “{tag.title}” is used
            </h2>
            <p className={`${tagSlugClassName} mt-1`}>{tag.slug}</p>
          </div>
          <button
            type="button"
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-surface-high)]"
            onClick={onClose}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          {error ? (
            <p role="alert" className={tagInlineErrorClassName}>
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-[var(--admin-on-surface-variant)]">
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
              Looking up attachments…
            </p>
          ) : null}

          {!loading && !error && attached === 0 ? (
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              This tag is not attached to any course or lesson. Deleting it changes nothing that
              learners can see.
            </p>
          ) : null}

          {!loading && usage && counts.courses > 0 ? (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
                {String(counts.courses)} {counts.courses === 1 ? "course" : "courses"}
              </h3>
              <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
                {usage.courses.map((course) => (
                  <li
                    key={course.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate text-[var(--admin-on-surface)]">
                      {course.title}
                    </span>
                    <span className="font-data shrink-0 text-[10px] uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                      {course.status.toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!loading && usage && counts.lessons > 0 ? (
            <section>
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--admin-on-surface-variant)]">
                <FileText className="h-3.5 w-3.5" aria-hidden="true" />
                {String(counts.lessons)} {counts.lessons === 1 ? "lesson" : "lessons"}
              </h3>
              <ul className="divide-y divide-[var(--admin-border)] rounded-xl border border-[var(--admin-border)]">
                {usage.lessons.map((lesson) => (
                  <li key={lesson.id} className="px-3 py-2 text-sm">
                    <span className="block truncate text-[var(--admin-on-surface)]">
                      {lesson.title}
                    </span>
                    {/* A lesson title alone does not identify a lesson — most
                        courses have an "Introduction". */}
                    <span className="block truncate text-xs text-[var(--admin-on-surface-variant)]">
                      in {lesson.courseTitle}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {!loading && usage?.truncated ? (
            <p className="text-xs text-[var(--admin-on-surface-variant)]">
              The counts above are exact. The lists show the first 25 of each.
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end border-t border-[var(--admin-border)] px-6 py-4">
          <button type="button" className={manageSecondaryButtonClassName} onClick={onClose}>
            Close
          </button>
        </footer>
      </div>
    </div>
  );
}
