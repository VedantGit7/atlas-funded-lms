"use client";

import type { z } from "zod";
import type { studioLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { LessonVideoEmbed } from "../../lessons/lesson-video-embed";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonPreviewPanelProps = {
  lesson: StudioLessonDetail;
  content: string;
};

export function LessonPreviewPanel({ lesson, content }: LessonPreviewPanelProps) {
  return (
    <article className="mx-auto max-w-2xl space-y-4">
      <header className="space-y-2 border-b border-[var(--admin-border)] pb-4">
        <h3 className="text-xl font-semibold text-[var(--admin-on-surface)]">{lesson.title}</h3>
        {lesson.description ? (
          <p className="text-sm text-[var(--admin-on-surface-variant)]">{lesson.description}</p>
        ) : null}
      </header>
      {lesson.videoProvider && lesson.videoUrl ? (
        <LessonVideoEmbed
          provider={lesson.videoProvider}
          url={lesson.videoUrl}
          title="Lesson preview"
        />
      ) : null}
      <pre className="whitespace-pre-wrap rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-low)] p-4 font-mono text-sm leading-relaxed text-[var(--admin-on-surface)]">
        {content || "No content yet."}
      </pre>
    </article>
  );
}
