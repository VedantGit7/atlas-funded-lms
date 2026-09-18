"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {} from "lucide-react";
import { ClientApiError, clientApi } from "../../../../lib/client-api";
import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import {
  inlineLessonPrimaryDarkButtonClassName,
  inlineLessonSecondaryButtonClassName,
} from "./inline-lesson-editor-shared";
import { MarkdownToolbar } from "./markdown-toolbar";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonArticleWorkspaceProps = {
  lesson: StudioLessonDetail;
  editable: boolean;
};

function formatError(error: unknown): string {
  if (error instanceof ClientApiError) return error.message;
  return "Failed to save article.";
}

export function LessonArticleWorkspace({ lesson, editable }: LessonArticleWorkspaceProps) {
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [content, setContent] = useState(
    typeof lesson.content === "string"
      ? lesson.content
      : lesson.content != null
        ? JSON.stringify(lesson.content, null, 2)
        : "",
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    if (!editable || saving) return;
    setSaving(true);
    setError(null);
    try {
      await clientApi.put(
        `/api/v1/lessons/${lesson.id}`,
        { content: content.trim() ? content : undefined },
        "lesson-article-save",
      );
      setSaved(true);
    } catch (saveError) {
      setError(formatError(saveError));
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    if (!editable || saving) return;

    // Save first
    await handleSave();

    // Navigate to full lesson editor
    router.push(`/studio/courses/${lesson.courseId}/lessons/${lesson.id}`);
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
          placeholder="Article Title (Start writing your article content here)"
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
          className={`${inlineLessonSecondaryButtonClassName} border-[var(--admin-primary)] text-[var(--admin-primary)] hover:bg-[color-mix(in_srgb,var(--admin-primary)_10%,var(--admin-surface))]`}
          disabled={!editable || saving}
          onClick={() => {
            void handlePublish();
          }}
        >
          Publish
        </button>
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
