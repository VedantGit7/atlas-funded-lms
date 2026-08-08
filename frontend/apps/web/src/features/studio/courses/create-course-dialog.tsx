"use client";

import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import { ImageIcon, X } from "lucide-react";
import { ClientApiError, clientApi } from "../../../lib/client-api";
import { CourseDescriptionField } from "./course-description-field";
import { CreateCourseCategoryPicker } from "./create-course-category-picker";
import { CreateCourseInstructorsPicker } from "./create-course-instructors-picker";
import {
  RequiredMark,
  dialogLabelClassName,
  fieldClassName,
  primaryButtonClassName,
  statusBannerClassName,
  textareaClassName,
} from "./create-course-dialog-shared";

type CreateCourseDialogProps = {
  onClose: () => void;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to create course.";
}

export function CreateCourseDialog({ onClose }: CreateCourseDialogProps) {
  const router = useRouter();
  const titleId = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [instructorIds, setInstructorIds] = useState<string[]>([]);
  const [shortIntroduction, setShortIntroduction] = useState("");
  const [description, setDescription] = useState("");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailName, setThumbnailName] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => {
      titleRef.current?.focus();
    }, 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        closeDialog();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
      previouslyFocused.current?.focus();
      if (thumbnailPreview) {
        URL.revokeObjectURL(thumbnailPreview);
      }
    };
  }, [busy, thumbnailPreview]);

  function closeDialog() {
    if (busy) return;
    onClose();
  }

  function handleThumbnailChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (thumbnailPreview) {
      URL.revokeObjectURL(thumbnailPreview);
    }

    setThumbnailPreview(URL.createObjectURL(file));
    setThumbnailName(file.name);
  }

  const canSubmit =
    title.trim().length > 0 &&
    shortIntroduction.trim().length > 0 &&
    description.trim().length > 0 &&
    instructorIds.length > 0 &&
    !busy;

  async function handleSubmit() {
    if (!canSubmit) return;

    setBusy(true);
    setError(null);

    try {
      const response = await clientApi.post<{ data: { id: string } }>(
        "/api/v1/courses",
        {
          title: title.trim(),
          description: description.trim(),
          shortDescription: shortIntroduction.trim(),
          ...(category || instructorIds.length > 0
            ? {
                tags: {
                  ...(category ? { category } : {}),
                  ...(instructorIds.length > 0 ? { instructorMembershipIds: instructorIds } : {}),
                },
              }
            : {}),
        },
        "course-create",
      );
      router.push(`/studio/courses/${response.data.id}`);
      router.refresh();
    } catch (submitError) {
      setError(formatError(submitError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="admin-theme fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="absolute inset-0 bg-[var(--admin-scrim)] backdrop-blur-sm motion-safe:animate-[admin-fade-in_0.15s_ease-out]"
        onClick={closeDialog}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative flex max-h-[min(92vh,900px)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-2xl motion-safe:animate-[admin-dialog-in_0.2s_cubic-bezier(0.16,1,0.3,1)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--admin-border)] px-6 py-5">
          <h2 id={titleId} className="text-xl font-bold text-[var(--admin-on-surface)]">
            New Course
          </h2>
          <button
            type="button"
            aria-label="Close"
            disabled={busy}
            onClick={closeDialog}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[var(--admin-on-surface-variant)] transition-colors hover:bg-[var(--admin-on-surface-high)] hover:text-[var(--admin-on-surface)] disabled:opacity-50"
          >
            <X className="h-[18px] w-[18px]" aria-hidden="true" />
          </button>
        </div>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-6">
            <div className="grid gap-5 md:grid-cols-2">
              <div>
                <label htmlFor="new-course-title" className={dialogLabelClassName}>
                  Title
                  <RequiredMark />
                </label>
                <input
                  id="new-course-title"
                  ref={titleRef}
                  type="text"
                  value={title}
                  onChange={(event) => {
                    setTitle(event.target.value);
                  }}
                  required
                  maxLength={200}
                  disabled={busy}
                  placeholder="Introduction to price action"
                  className={fieldClassName}
                />
              </div>

              <CreateCourseCategoryPicker value={category} onChange={setCategory} disabled={busy} />

              <CreateCourseInstructorsPicker
                value={instructorIds}
                onChange={setInstructorIds}
                disabled={busy}
              />

              <div>
                <span className={dialogLabelClassName}>Course thumbnail</span>
                <div className="flex items-start gap-3">
                  <div className="flex h-24 min-w-0 flex-1 items-center justify-center overflow-hidden rounded-lg border border-dashed border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
                    {thumbnailPreview ? (
                      <img
                        src={thumbnailPreview}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <ImageIcon
                        className="h-8 w-8 text-[var(--admin-on-surface-variant)]/60"
                        strokeWidth={1.5}
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col gap-2">
                    <input
                      ref={thumbnailInputRef}
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={handleThumbnailChange}
                      disabled={busy}
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        thumbnailInputRef.current?.click();
                      }}
                      className="rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:bg-[var(--admin-surface-high)] disabled:opacity-50"
                    >
                      Upload
                    </button>
                    {thumbnailName ? (
                      <p className="max-w-[8rem] truncate text-[11px] text-[var(--admin-on-surface-variant)]">
                        {thumbnailName}
                      </p>
                    ) : (
                      <p className="max-w-[8rem] text-[11px] leading-snug text-[var(--admin-on-surface-variant)]">
                        Add after save in course settings
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[var(--admin-border)]" />

            <div>
              <label htmlFor="new-course-short-intro" className={dialogLabelClassName}>
                Short introduction
                <RequiredMark />
              </label>
              <textarea
                id="new-course-short-intro"
                value={shortIntroduction}
                onChange={(event) => {
                  setShortIntroduction(event.target.value);
                }}
                required
                maxLength={500}
                disabled={busy}
                rows={4}
                placeholder="A concise summary shown on course cards and catalog listings."
                className={textareaClassName}
              />
            </div>

            <div>
              <label htmlFor="new-course-description" className={dialogLabelClassName}>
                Course description
                <RequiredMark />
              </label>
              <CourseDescriptionField
                id="new-course-description"
                value={description}
                onChange={setDescription}
                disabled={busy}
                required
              />
            </div>

            {error ? (
              <p
                role="alert"
                className={`${statusBannerClassName} border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 text-[var(--admin-danger)]`}
              >
                {error}
              </p>
            ) : null}
          </div>

          <div className="flex shrink-0 justify-end border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)]/50 px-6 py-4">
            <button type="submit" disabled={!canSubmit} className={primaryButtonClassName}>
              {busy ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
