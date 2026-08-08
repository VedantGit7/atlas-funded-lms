"use client";

import type { z } from "zod";
import type { learnerLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { LessonVideoEmbed } from "./lesson-video-embed";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;

type LessonContentViewerProps = {
  lesson: LearnerLessonDetail;
};

export function LessonContentViewer({ lesson }: LessonContentViewerProps) {
  const body =
    typeof lesson.content === "string"
      ? lesson.content
      : lesson.content != null
        ? JSON.stringify(lesson.content, null, 2)
        : "";

  return (
    <section className="space-y-4">
      {lesson.videoProvider && lesson.videoUrl ? (
        <LessonVideoEmbed
          provider={lesson.videoProvider}
          url={lesson.videoUrl}
          className="aspect-video w-full rounded border"
        />
      ) : null}
      {body ? (
        <article className="prose max-w-none whitespace-pre-wrap rounded border p-4">
          {body}
        </article>
      ) : (
        <p role="status">This lesson has no content yet.</p>
      )}
    </section>
  );
}
