"use client";

import type { z } from "zod";
import type { learnerLessonDetailSchema } from "@atlas/contracts/lessons/lesson-schemas";
import { LessonBody } from "./lesson-body";

type LearnerLessonDetail = z.infer<typeof learnerLessonDetailSchema>;

type LessonContentViewerProps = {
  lesson: LearnerLessonDetail;
};

/** The learner's view of a lesson's content (see LessonBody). */
export function LessonContentViewer({ lesson }: LessonContentViewerProps) {
  return (
    <LessonBody
      title={lesson.title}
      content={lesson.content}
      videoProvider={lesson.videoProvider}
      videoUrl={lesson.videoUrl}
    />
  );
}
