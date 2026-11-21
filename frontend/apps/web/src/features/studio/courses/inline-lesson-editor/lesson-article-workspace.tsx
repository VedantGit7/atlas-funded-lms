"use client";

import { useRef, useState } from "react";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { inlineLessonPrimaryDarkButtonClassName } from "./inline-lesson-editor-shared";
import { MarkdownToolbar } from "./markdown-toolbar";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonArticleWorkspaceProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
  onSaved?: () => void;
};

/**
 * The article's text as the author wrote it.
 *
 * The API returns an article's content as `{ body }`. This editor used to show
 * that object as JSON and save the JSON back as the text, wrapping it again on
 * every save (QA review 1 C5). It now edits the body itself.
 */
export function articleTextOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (content && typeof content === "object" && !Array.isArray(content)) {
    const body = (content as Record<string, unknown>)["body"];
    if (typeof body === "string") return body;
  }
  return "";
}

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save article.";
}

export function LessonArticleWorkspace({ lesson, editable, onSaved }: LessonArticleWorkspaceProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(() => articleTextOf(lesson.content));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!editable || saving) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.put(`/api/v1/lessons/${lesson.id}`, { content }, "lesson-article-save");
      setSaved(true);
      onSaved?.();
    } catch (saveError) {
      setError(formatError(saveError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="flex min-h-[min(28rem,calc(100vh-14rem))] flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <div className="border-b border-[color-mix(in_srgb,var(--admin-primary)_25%,var(--admin-border))] bg-[color-mix(in_srgb,var(--admin-primary)_8%,var(--admin-surface))] px-5 py-3 text-sm text-[var(--admin-primary-strong)]">
        Note: Article lesson content will not be encrypted.
      </div>

      <MarkdownToolbar textareaRef={textareaRef} disabled={!editable} />

      <div className="flex-1 overflow-y-auto p-5">
        {error ? (
          <p role="alert" className="mb-4 text-sm text-[var(--admin-danger)]">
            {error}
          </p>
        ) : null}
        <textarea
          ref={textareaRef}
          className="min-h-[20rem] w-full resize-y border-none bg-transparent text-sm leading-relaxed text-[var(--admin-on-surface)] outline-none placeholder:text-[var(--admin-on-surface-variant)]"
          placeholder="Write the article here. Use the toolbar for bold, italic, links and lists."
          value={content}
          disabled={!editable}
          onChange={(event) => {
            setContent(event.target.value);
            setSaved(false);
          }}
        />
      </div>

      <footer className="flex items-center justify-end gap-2 border-t border-[var(--admin-border)] px-5 py-3">
        {saved ? (
          <span className="mr-auto text-xs font-medium text-[var(--admin-success)]">Saved</span>
        ) : null}
        <button
          type="button"
          className={inlineLessonPrimaryDarkButtonClassName}
          disabled={!editable || saving}
          onClick={() => {
            void handleSave();
          }}
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </footer>
    </section>
  );
}
