"use client";

import type { z } from "zod";
import type { learnerLessonDetailSchema } from "../../server/lessons/lesson-schemas";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;

type LessonContentViewerProps = {
  lesson: LearnerLessonDetail;
};

function renderVideoEmbed(provider: string, url: string) {
  if (provider === "youtube") {
    const match = url.match(/(?:v=|youtu\.be\/)([\w-]+)/);
    const videoId = match?.[1];
    if (!videoId) return null;
    return (
      <iframe
        title="Lesson video"
        className="aspect-video w-full rounded border"
        src={`https://www.youtube.com/embed/${videoId}`}
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }

  return (
    <p className="rounded border p-4 text-sm">
      External video ({provider}):{" "}
      <a href={url} target="_blank" rel="noreferrer">
        Open video
      </a>
    </p>
  );
}

export function LessonContentViewer({ lesson }: LessonContentViewerProps) {
  const body =
    typeof lesson.content === "string"
      ? lesson.content
      : lesson.content != null
        ? JSON.stringify(lesson.content, null, 2)
        : "";

  return (
    <section className="space-y-4">
      {lesson.videoProvider && lesson.videoUrl
        ? renderVideoEmbed(lesson.videoProvider, lesson.videoUrl)
        : null}
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
