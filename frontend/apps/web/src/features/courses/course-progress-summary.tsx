import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import {
  findOutlineLesson,
  outlineLessons,
  outlineProgressLabel,
  type LearnerCourseOutline,
} from "../lessons/course-outline-model";
import { LessonTrack } from "../lessons/lesson-track";

/**
 * An enrolled learner's place in the course (QA review 2 H20, reviewer 6.4
 * "Start/Continue"): the lesson track, how many lessons are done, and one
 * button to pick up where they left off.
 */
export function CourseProgressSummary({
  courseId,
  outline,
}: {
  courseId: string;
  outline: LearnerCourseOutline;
}) {
  if (outline.totalLessons === 0) return null;

  const lessons = outlineLessons(outline);
  const started = lessons.some((lesson) => lesson.status !== "not_started");
  const complete = outline.completedLessons >= outline.totalLessons;
  const resume = findOutlineLesson(outline, outline.resumeLessonId) ?? lessons[0] ?? null;
  const target = complete ? (lessons[0] ?? null) : resume;
  const action = complete ? "Review the course" : started ? "Continue" : "Start the course";

  return (
    <section
      aria-labelledby="course-progress-heading"
      className="space-y-4 rounded-2xl border border-border bg-card p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <h2 id="course-progress-heading" className="text-base font-semibold text-foreground">
            {complete ? "Course complete" : "Your progress"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {outlineProgressLabel(outline)}
            <span aria-hidden="true"> · </span>
            <span className="font-semibold tabular-nums text-foreground">
              {outline.progressPct}%
            </span>
          </p>
        </div>
        {target ? (
          <Link
            href={`/courses/${courseId}/lessons/${target.id}`}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          >
            {complete ? <CircleCheck className="h-4 w-4" aria-hidden="true" /> : null}
            {action}
            {complete ? null : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
          </Link>
        ) : null}
      </div>
      <LessonTrack outline={outline} />
      {target && !complete ? (
        <p className="text-sm text-muted-foreground">
          {started ? "Next up: " : "First lesson: "}
          <span className="font-medium text-foreground">{target.title}</span>
        </p>
      ) : null}
    </section>
  );
}
