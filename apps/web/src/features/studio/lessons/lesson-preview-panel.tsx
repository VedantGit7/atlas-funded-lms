"use client";

import type { z } from "zod";
import type { studioLessonDetailSchema } from "../../../server/lessons/lesson-schemas";

type StudioLessonDetail = z.infer<typeof studioLessonDetailSchema>;

type LessonPreviewPanelProps = {
  lesson: StudioLessonDetail;
  content: string;
};

export function LessonPreviewPanel({ lesson, content }: LessonPreviewPanelProps) {
  return (
    <section className="space-y-3 rounded border p-4">
      <h2>Preview</h2>
      <article className="prose max-w-none">
        <h3>{lesson.title}</h3>
        {lesson.description ? <p>{lesson.description}</p> : null}
        {lesson.videoProvider && lesson.videoUrl ? (
          <p className="text-sm opacity-70">
            Video: {lesson.videoProvider} — {lesson.videoUrl}
          </p>
        ) : null}
        <pre className="whitespace-pre-wrap rounded bg-neutral-50 p-3 text-sm">{content}</pre>
      </article>
    </section>
  );
}
