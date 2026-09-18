import { useEffect, useId, useRef, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { LESSON_TITLE_MAX_LENGTH } from "../lesson-type-options";
import {
  LESSON_SHORT_DESCRIPTION_MAX_LENGTH,
  type LessonSettingsFormState,
} from "./lesson-settings-metadata";
import {
  LessonSettingsFieldLabel,
  LessonSettingsInfoHint,
  LessonSettingsRadioGroup,
  LessonSettingsTextInput,
  LessonSettingsTextarea,
} from "./inline-lesson-settings-shared";
import {
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";
import { uploadLessonAssetFile } from "../upload-lesson-asset";
import { ClientApiError } from "../../../../lib/client-api";
import { MarkdownToolbar } from "./markdown-toolbar";

type LessonSettingsBrandingSectionProps = {
  lessonId: string;
  form: LessonSettingsFormState;
  disabled: boolean;
  onChange: (patch: Partial<LessonSettingsFormState>) => void;
};

export function LessonSettingsBrandingSection({
  lessonId,
  form,
  disabled,
  onChange,
}: LessonSettingsBrandingSectionProps) {
  const titleId = useId();
  const shortDescriptionId = useId();
  const richDescriptionId = useId();
  const thumbnailInputRef = useRef<HTMLInputElement>(null);
  const richDescriptionRef = useRef<HTMLTextAreaElement>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    form.thumbnailUrl.trim() || null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    setThumbnailPreview(form.thumbnailUrl.trim() || null);
  }, [form.thumbnailUrl]);

  function handleThumbnailChange(file: File | null) {
    if (!file) return;

    // Create preview
    const objectUrl = URL.createObjectURL(file);
    setThumbnailPreview(objectUrl);

    // Upload file
    setUploading(true);
    setUploadError(null);

    uploadLessonAssetFile(lessonId, file, "lesson.thumbnail")
      .then((assetReferenceId) => {
        onChange({
          thumbnailUrl: objectUrl,
          thumbnailAssetReferenceId: assetReferenceId,
        });
      })
      .catch((error: unknown) => {
        if (error instanceof ClientApiError) {
          setUploadError(error.message);
        } else {
          setUploadError("Thumbnail upload failed");
        }
        setThumbnailPreview(null);
      })
      .finally(() => {
        setUploading(false);
      });
  }

  return (
    <div className="space-y-8">
      <div>
        <LessonSettingsFieldLabel
          htmlFor={titleId}
          label="Title"
          required
          counter={`${form.title.length}/${LESSON_TITLE_MAX_LENGTH}`}
        />
        <LessonSettingsTextInput
          id={titleId}
          value={form.title}
          maxLength={LESSON_TITLE_MAX_LENGTH}
          disabled={disabled}
          onChange={(value) => {
            onChange({ title: value });
          }}
        />
      </div>

      <div>
        <LessonSettingsFieldLabel
          label="Lesson Type"
          helper="Select paid or trial lesson type. Trial lessons are free to enrol."
        />
        <LessonSettingsRadioGroup
          name="lesson-access-type"
          value={form.accessType}
          disabled={disabled}
          options={[
            { value: "paid", label: "Paid Lesson" },
            { value: "trial", label: "Trial Lesson" },
          ]}
          onChange={(value) => {
            onChange({ accessType: value });
          }}
        />
      </div>

      <div>
        <LessonSettingsFieldLabel
          htmlFor={shortDescriptionId}
          label="Short Description"
          counter={`${form.shortDescription.length}/${LESSON_SHORT_DESCRIPTION_MAX_LENGTH}`}
        />
        <LessonSettingsTextarea
          id={shortDescriptionId}
          value={form.shortDescription}
          maxLength={LESSON_SHORT_DESCRIPTION_MAX_LENGTH}
          placeholder="Write short description"
          disabled={disabled}
          rows={3}
          onChange={(value) => {
            onChange({ shortDescription: value });
          }}
        />
      </div>

      <div>
        <LessonSettingsFieldLabel htmlFor={richDescriptionId} label="Description" />
        <div
          className={[
            "overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]",
            disabled ? "opacity-60" : "",
          ].join(" ")}
        >
          <MarkdownToolbar textareaRef={richDescriptionRef} disabled={disabled} />
          <textarea
            ref={richDescriptionRef}
            id={richDescriptionId}
            className="min-h-[10rem] w-full resize-y border-0 bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
            placeholder="Add description. To add chapters to video lessons, kindly read the help text."
            value={form.richDescription}
            disabled={disabled}
            onChange={(event) => {
              onChange({ richDescription: event.target.value });
            }}
          />
        </div>
      </div>

      <div>
        <LessonSettingsFieldLabel
          label="Lesson Thumbnail"
          helper="Upload a relatable lesson image for visual presentation."
        />
        {uploadError ? (
          <p className="mb-2 text-sm text-[var(--admin-danger)]">{uploadError}</p>
        ) : null}
        <div className="overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
          <div className="flex min-h-[12rem] items-center justify-center bg-[var(--admin-surface-low)] p-6">
            {thumbnailPreview ? (
              <img
                src={thumbnailPreview}
                alt=""
                className="max-h-48 w-full rounded-lg object-contain"
              />
            ) : (
              <ImageIcon
                className="h-12 w-12 text-[var(--admin-on-surface-variant)]/50"
                strokeWidth={1.25}
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-[var(--admin-border)] px-4 py-3">
            <button
              type="button"
              className={inlineLessonSecondaryButtonClassName}
              disabled={disabled || uploading || !thumbnailPreview}
              onClick={() => {
                setThumbnailPreview(null);
                onChange({ thumbnailUrl: "", thumbnailAssetReferenceId: null });
              }}
            >
              Remove
            </button>
            <input
              ref={thumbnailInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                handleThumbnailChange(file);
              }}
            />
            <button
              type="button"
              className={inlineLessonPrimaryDarkButtonClassName}
              disabled={disabled || uploading}
              onClick={() => {
                thumbnailInputRef.current?.click();
              }}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
        <LessonSettingsInfoHint>
          Upload image with resolution of 1024 × 576 pixels.
        </LessonSettingsInfoHint>
      </div>

      <div>
        <LessonSettingsFieldLabel label="Display in syllabus" />
        <LessonSettingsRadioGroup
          name="display-in-syllabus"
          value={form.displayInSyllabus ? "show" : "hide"}
          disabled={disabled}
          options={[
            { value: "hide", label: "Hide" },
            { value: "show", label: "Show" },
          ]}
          onChange={(value) => {
            onChange({ displayInSyllabus: value === "show" });
          }}
        />
      </div>
    </div>
  );
}
