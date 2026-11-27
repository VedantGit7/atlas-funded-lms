"use client";

import {
  Bold,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Minus,
  Quote,
  Table,
  type LucideIcon,
} from "lucide-react";
import { useId, useState, type RefObject } from "react";
import { lessonToolbarButtonClassName } from "../../lessons/lesson-editor-shared";
import { ClientApiError } from "../../../../lib/client-api";
import { uploadLessonAssetFile } from "../upload-lesson-asset";
import {
  TABLE_TEMPLATE,
  imageMarkdown,
  insertBlock,
  insertLink,
  prefixLines,
  wrapSelection,
  type MarkdownEdit,
} from "./markdown-edit";

type MarkdownToolbarProps = {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (value: string) => void;
  /** The lesson images are uploaded to; without it there is no Image button. */
  lessonId?: string;
  /**
   * `article`: everything a lesson article can show. `basic` (descriptions):
   * bold, italic, links and lists only, since those fields show nothing more.
   */
  variant?: "article" | "basic";
  disabled?: boolean;
};

const IMAGE_TYPES = "image/png,image/jpeg,image/webp";

function uploadError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "The image couldn't be uploaded. Try again.";
}

/**
 * The article editor's toolbar (QA review 1 m19: it had only bold, italic,
 * link and list). Every button edits the Markdown the learner's lesson shows.
 */
export function MarkdownToolbar({
  textareaRef,
  value,
  onChange,
  lessonId,
  variant = "basic",
  disabled,
}: MarkdownToolbarProps) {
  const [imageOpen, setImageOpen] = useState(false);

  function apply(edit: (value: string, start: number, end: number) => MarkdownEdit) {
    const textarea = textareaRef.current;
    if (!textarea || disabled) return;
    const result = edit(value, textarea.selectionStart, textarea.selectionEnd);
    onChange(result.value);
    // The new text renders first; then the cursor goes back where the edit put it.
    requestAnimationFrame(() => {
      const current = textareaRef.current;
      if (!current) return;
      current.focus();
      current.setSelectionRange(result.start, result.end);
    });
  }

  type ToolbarButton = {
    label: string;
    icon: LucideIcon;
    /** Buttons are grouped; a thin divider separates the groups. */
    group: number;
    articleOnly?: boolean;
    run: () => void;
    pressed?: boolean;
  };
  const allButtons: ToolbarButton[] = [
    {
      label: "Heading",
      icon: Heading2,
      group: 0,
      articleOnly: true,
      run: () => {
        apply((v, s, e) => prefixLines(v, s, e, "h2"));
      },
    },
    {
      label: "Subheading",
      icon: Heading3,
      group: 0,
      articleOnly: true,
      run: () => {
        apply((v, s, e) => prefixLines(v, s, e, "h3"));
      },
    },
    {
      label: "Bold",
      icon: Bold,
      group: 1,
      run: () => {
        apply((v, s, e) => wrapSelection(v, s, e, "**", "bold text"));
      },
    },
    {
      label: "Italic",
      icon: Italic,
      group: 1,
      run: () => {
        apply((v, s, e) => wrapSelection(v, s, e, "*", "italic text"));
      },
    },
    {
      label: "Link",
      icon: LinkIcon,
      group: 1,
      run: () => {
        apply(insertLink);
      },
    },
    {
      label: "Bulleted list",
      icon: List,
      group: 2,
      run: () => {
        apply((v, s, e) => prefixLines(v, s, e, "bullet"));
      },
    },
    {
      label: "Numbered list",
      icon: ListOrdered,
      group: 2,
      run: () => {
        apply((v, s, e) => prefixLines(v, s, e, "numbered"));
      },
    },
    {
      label: "Quote",
      icon: Quote,
      group: 2,
      articleOnly: true,
      run: () => {
        apply((v, s, e) => prefixLines(v, s, e, "quote"));
      },
    },
    {
      label: "Image",
      icon: ImageIcon,
      group: 3,
      articleOnly: true,
      run: () => {
        setImageOpen((open) => !open);
      },
      pressed: imageOpen,
    },
    {
      label: "Table",
      icon: Table,
      group: 3,
      articleOnly: true,
      run: () => {
        apply((v, s, e) => insertBlock(v, s, e, TABLE_TEMPLATE, "Column 1"));
      },
    },
    {
      label: "Divider",
      icon: Minus,
      group: 3,
      articleOnly: true,
      run: () => {
        apply((v, s, e) => insertBlock(v, s, e, "---"));
      },
    },
  ];
  const buttons = allButtons.filter(
    (button) =>
      (variant === "article" || !button.articleOnly) && (button.label !== "Image" || lessonId),
  );

  return (
    <div className="border-b border-[var(--admin-border)]">
      <div
        role="toolbar"
        aria-label="Formatting"
        className={[
          "flex h-11 items-center gap-1 overflow-x-auto px-2",
          disabled ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        {buttons.map(({ label, icon: Icon, run, pressed, group }, index) => (
          <span key={label} className="flex items-center">
            {index > 0 && buttons[index - 1]?.group !== group ? (
              <span aria-hidden="true" className="mx-1 h-5 w-px bg-[var(--admin-border)]" />
            ) : null}
            <button
              type="button"
              className={lessonToolbarButtonClassName}
              aria-label={label}
              title={label}
              aria-pressed={pressed}
              disabled={disabled}
              onClick={run}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden="true" />
            </button>
          </span>
        ))}
      </div>
      {imageOpen && !disabled && lessonId ? (
        <ImagePanel
          lessonId={lessonId}
          onCancel={() => {
            setImageOpen(false);
          }}
          onInsert={(markdown) => {
            apply((v, s, e) => insertBlock(v, s, e, markdown));
            setImageOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

/**
 * Adds an image by uploading it to the lesson. There is no "image from a web
 * address": the site's security policy loads images only from the academy and
 * its own storage, so an outside image would show as broken for learners.
 */
function ImagePanel({
  lessonId,
  onInsert,
  onCancel,
}: {
  lessonId: string;
  onInsert: (markdown: string) => void;
  onCancel: () => void;
}) {
  const altId = useId();
  const fileId = useId();
  const [alt, setAlt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    try {
      const assetId = await uploadLessonAssetFile(lessonId, file, "lesson.asset");
      onInsert(imageMarkdown(alt || file.name.replace(/\.[^.]+$/, ""), `asset:${assetId}`));
    } catch (uploadFailure) {
      setError(uploadError(uploadFailure));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 py-3 text-sm text-[var(--admin-on-surface)]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[14rem] flex-1 space-y-1">
          <label htmlFor={altId} className="block text-xs font-semibold">
            Description
          </label>
          <input
            id={altId}
            value={alt}
            onChange={(event) => {
              setAlt(event.target.value);
            }}
            placeholder="What the image shows, for learners who can't see it"
            className="w-full rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface)] px-3 py-1.5"
          />
        </div>
        <div>
          <label
            htmlFor={fileId}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-3 py-1.5 font-semibold text-[var(--admin-on-primary)] hover:opacity-90 ${busy ? "pointer-events-none opacity-60" : ""}`}
          >
            <ImageIcon className="h-4 w-4" aria-hidden="true" />
            {busy ? "Uploading…" : "Choose an image"}
          </label>
          <input
            id={fileId}
            type="file"
            accept={IMAGE_TYPES}
            className="sr-only"
            disabled={busy}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void upload(file);
            }}
          />
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3 py-1.5 font-medium text-[var(--admin-on-surface-variant)] hover:bg-[var(--admin-surface)]"
        >
          Cancel
        </button>
      </div>
      <p className="text-xs text-[var(--admin-on-surface-variant)]">
        PNG, JPEG or WebP. The image is added where the cursor is and shows in the lesson once you
        save the article.
      </p>
      {error ? (
        <p role="alert" className="text-xs text-[var(--admin-danger)]">
          {error}
        </p>
      ) : null}
    </div>
  );
}
