"use client";

import { useMemo, useState } from "react";
import {
  Bold,
  Code,
  Heading1,
  Heading2,
  Heading3,
  Image,
  Italic,
  Link,
  List,
  ListOrdered,
  Maximize2,
  Underline,
} from "lucide-react";
import { LessonPreviewPanel } from "./lesson-preview-panel";
import {
  countLines,
  countWords,
  lessonSegmentActiveClassName,
  lessonSegmentInactiveClassName,
  lessonSegmentedControlClassName,
  lessonToolbarButtonClassName,
} from "./lesson-editor-shared";
import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonContentEditorProps = {
  lesson: StudioLessonDetail;
  value: string;
  editable: boolean;
  saving: boolean;
  onChange: (value: string) => void;
};

type EditorTab = "editor" | "preview";

function LineNumbers({ lineCount }: { lineCount: number }) {
  const lines = useMemo(
    () => Array.from({ length: Math.max(lineCount, 20) }, (_, index) => index + 1),
    [lineCount],
  );

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-0 top-0 flex h-full w-12 select-none flex-col items-center border-r border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-high)_35%,transparent)] pt-8 font-mono text-[11px] leading-[1.35rem] text-[var(--admin-outline)]"
    >
      {lines.map((line) => (
        <span key={line}>{line}</span>
      ))}
    </div>
  );
}

export function LessonContentEditor({
  lesson,
  value,
  editable,
  saving,
  onChange,
}: LessonContentEditorProps) {
  const [tab, setTab] = useState<EditorTab>("editor");
  const lineCount = countLines(value);
  const wordCount = countWords(value);

  return (
    <section className="flex min-h-[32rem] flex-1 flex-col overflow-hidden rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)]">
      <header className="flex h-14 items-center justify-between border-b border-[var(--admin-border)] bg-[var(--admin-surface)] px-4">
        <div className={lessonSegmentedControlClassName} role="tablist" aria-label="Lesson content mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "editor"}
            className={tab === "editor" ? lessonSegmentActiveClassName : lessonSegmentInactiveClassName}
            onClick={() => {
              setTab("editor");
            }}
          >
            Editor
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={tab === "preview" ? lessonSegmentActiveClassName : lessonSegmentInactiveClassName}
            onClick={() => {
              setTab("preview");
            }}
          >
            Preview
          </button>
        </div>

        {editable ? (
          <div className="flex items-center gap-2 text-xs font-medium text-[var(--admin-on-surface-variant)]">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--admin-success)]" />
            {saving ? "Saving…" : "Auto-saving on save"}
          </div>
        ) : (
          <span className="text-xs font-medium text-[var(--admin-on-surface-variant)]">
            Rich text disabled
          </span>
        )}
      </header>

      {tab === "editor" ? (
        <>
          <div
            className={[
              "flex h-12 items-center gap-1 overflow-x-auto border-b border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-surface-low)_50%,var(--admin-surface))] px-4",
              editable ? "" : "cursor-not-allowed opacity-40",
            ].join(" ")}
          >
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Bold">
              <Bold className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Italic">
              <Italic className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Underline">
              <Underline className="h-4 w-4" />
            </button>
            <span className="mx-1 h-6 w-px bg-[var(--admin-border)]" aria-hidden="true" />
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Heading 1">
              <Heading1 className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Heading 2">
              <Heading2 className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Heading 3">
              <Heading3 className="h-4 w-4" />
            </button>
            <span className="mx-1 h-6 w-px bg-[var(--admin-border)]" aria-hidden="true" />
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Bulleted list">
              <List className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Numbered list">
              <ListOrdered className="h-4 w-4" />
            </button>
            <span className="mx-1 h-6 w-px bg-[var(--admin-border)]" aria-hidden="true" />
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Insert link">
              <Link className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Insert image">
              <Image className="h-4 w-4" />
            </button>
            <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Insert code">
              <Code className="h-4 w-4" />
            </button>
            <div className="ml-auto">
              <button type="button" disabled={!editable} className={lessonToolbarButtonClassName} aria-label="Fullscreen">
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div
            className={[
              "relative min-h-[24rem] flex-1",
              editable ? "bg-[var(--admin-surface-low)]" : "lesson-editor-locked-pattern",
            ].join(" ")}
          >
            {!editable ? (
              <div className="absolute inset-0 z-10 bg-[color-mix(in_srgb,var(--admin-surface)_55%,transparent)] backdrop-blur-[1px]" />
            ) : null}
            <LineNumbers lineCount={lineCount} />
            <textarea
              className={[
                "absolute inset-0 h-full w-full resize-none border-none bg-transparent py-8 pl-14 pr-8 font-mono text-sm leading-[1.35rem] text-[var(--admin-on-surface)] outline-none focus:ring-0",
                editable ? "" : "cursor-not-allowed opacity-70",
              ].join(" ")}
              value={value}
              onChange={(event) => {
                onChange(event.target.value);
              }}
              disabled={!editable}
              readOnly={!editable}
              spellCheck={false}
              aria-label="Lesson content"
            />
          </div>
        </>
      ) : (
        <div className="min-h-[24rem] flex-1 overflow-y-auto p-6">
          <LessonPreviewPanel lesson={lesson} content={value} />
        </div>
      )}

      <footer className="flex h-8 items-center justify-between border-t border-[var(--admin-border)] bg-[var(--admin-surface-low)] px-4 text-[11px] text-[var(--admin-on-surface-variant)]">
        <div className="flex items-center gap-4">
          <span>Markdown mode</span>
          <span>UTF-8</span>
          {!editable ? (
            <span className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--admin-warning)]" />
              Locked state
            </span>
          ) : null}
        </div>
        <div className="flex items-center gap-4">
          <span>Lines: {lineCount}</span>
          <span>Words: {wordCount}</span>
        </div>
      </footer>
    </section>
  );
}
