import {
  outlineLessons,
  outlineProgressLabel,
  type LearnerCourseOutline,
} from "./course-outline-model";

/** Above this many lessons a segment would be a sliver, so one bar is drawn instead. */
const MAX_SEGMENTS = 48;

type LessonTrackProps = {
  outline: LearnerCourseOutline;
  /** The lesson open in the player, marked on the track. */
  currentLessonId?: string | null;
  className?: string;
};

/**
 * The course as a row of lessons: one segment per lesson, filled once it's
 * done, so a learner sees both how far they are and where the gaps are.
 */
export function LessonTrack({ outline, currentLessonId = null, className }: LessonTrackProps) {
  const lessons = outlineLessons(outline);
  const label = outlineProgressLabel(outline);
  const segmented = lessons.length > 0 && lessons.length <= MAX_SEGMENTS;

  return (
    <div
      role="progressbar"
      aria-label="Course progress"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={outline.progressPct}
      aria-valuetext={`${label}, ${String(outline.progressPct)}%`}
      className={["flex h-2 w-full gap-[3px]", className ?? ""].join(" ")}
    >
      {segmented ? (
        lessons.map((lesson) => (
          <span
            key={lesson.id}
            className={[
              "h-full min-w-0 flex-1 rounded-full transition-colors duration-300 motion-reduce:transition-none",
              lesson.status === "completed"
                ? "bg-success"
                : lesson.status === "in_progress"
                  ? "bg-warning/60"
                  : "bg-muted-foreground/20",
              lesson.id === currentLessonId
                ? "outline outline-2 outline-offset-1 outline-primary"
                : "",
            ].join(" ")}
          />
        ))
      ) : (
        <span className="relative h-full flex-1 overflow-hidden rounded-full bg-muted-foreground/20">
          <span
            className="absolute inset-y-0 left-0 rounded-full bg-success transition-[width] duration-300 motion-reduce:transition-none"
            style={{ width: `${String(outline.progressPct)}%` }}
          />
        </span>
      )}
    </div>
  );
}
