import Link from "next/link";
import { ArrowRight, CircleCheck } from "lucide-react";
import { formatDate } from "../../lib/format/academy-format";
import { outlineProgressLabel, type LearnerCourseOutline } from "../lessons/course-outline-model";
import { LessonTrack } from "../lessons/lesson-track";
import { CoverArt } from "./course-card";
import { CoursePrice } from "./CoursePrice";
import { courseNextStep, courseSizeLabel, promoVideoEmbedUrl } from "./course-page-model";
import { EnrollCourseDialog } from "./enroll-course-dialog";
import type { CourseAccessTier } from "./course-pricing";

type CourseActionCardProps = {
  course: {
    id: string;
    title: string;
    coverKey?: string | null | undefined;
    category: string | null;
    promoVideoUrl: string | null;
    accessTier: CourseAccessTier;
    priceCents: number | null;
    currency: string | null;
    locked: boolean;
    enrollmentStatus: "enrolled" | "not_enrolled";
    enrolledAt: string | null;
  };
  outline: LearnerCourseOutline | null;
};

const primaryAction =
  "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * The course's one call to action, beside the page on wide screens and under
 * the title on phones: enrol, or start, continue or review (QA review 1 m40).
 * The lesson track shows the course's shape before enrolling and the
 * learner's place in it after.
 */
export function CourseActionCard({ course, outline }: CourseActionCardProps) {
  const enrolled = course.enrollmentStatus === "enrolled";
  const embedUrl = promoVideoEmbedUrl(course.promoVideoUrl);
  const next = enrolled ? courseNextStep(outline) : null;
  const size = courseSizeLabel(outline);
  const hasTrack = outline != null && outline.totalLessons > 0;

  return (
    <aside
      aria-label={enrolled ? "Your progress" : "Enroll in this course"}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      {embedUrl ? (
        <iframe
          title={`${course.title}: course preview`}
          src={embedUrl}
          className="aspect-video w-full border-0 bg-muted"
          loading="lazy"
          allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <CoverArt
          coverKey={course.coverKey}
          category={course.category}
          title={course.title}
          className="aspect-video w-full"
          iconClassName="h-14 w-14"
        />
      )}

      <div className="space-y-5 p-5">
        {enrolled ? (
          <EnrolledProgress
            courseId={course.id}
            outline={outline}
            next={next}
            enrolledAt={course.enrolledAt}
          />
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight text-foreground">
              <CoursePrice course={course} />
            </p>
            <EnrollCourseDialog
              courseId={course.id}
              courseTitle={course.title}
              isPaid={course.accessTier === "PAID"}
              priceCents={course.priceCents}
              currency={course.currency}
              triggerClassName={primaryAction}
            />
            {hasTrack ? (
              <div className="space-y-2">
                <LessonTrack outline={outline} />
                {size ? <p className="text-sm text-muted-foreground">{size}</p> : null}
              </div>
            ) : null}
          </>
        )}
      </div>
    </aside>
  );
}

function EnrolledProgress({
  courseId,
  outline,
  next,
  enrolledAt,
}: {
  courseId: string;
  outline: LearnerCourseOutline | null;
  next: ReturnType<typeof courseNextStep>;
  enrolledAt: string | null;
}) {
  const enrolledNote = enrolledAt
    ? `Enrolled on ${formatDate(new Date(enrolledAt))}.`
    : "You're enrolled.";

  if (!outline || !next) {
    return (
      <div className="space-y-1">
        <p className="font-semibold text-foreground">You&apos;re enrolled</p>
        <p className="text-sm text-muted-foreground">
          {outline ? "The first lesson will appear here once it's published." : enrolledNote}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 font-semibold text-foreground">
          {next.complete ? (
            <CircleCheck className="h-4 w-4 text-success" aria-hidden="true" />
          ) : null}
          {next.complete ? "Course complete" : "Your progress"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {outlineProgressLabel(outline)}
          <span aria-hidden="true"> · </span>
          <span className="font-semibold tabular-nums text-foreground">{outline.progressPct}%</span>
        </p>
      </div>
      <LessonTrack outline={outline} />
      <div className="space-y-2">
        <Link href={`/courses/${courseId}/lessons/${next.lessonId}`} className={primaryAction}>
          {next.label}
          {next.complete ? null : <ArrowRight className="h-4 w-4" aria-hidden="true" />}
        </Link>
        {next.complete ? null : (
          <p className="text-sm text-muted-foreground">
            {next.started ? "Next up: " : "First lesson: "}
            <span className="font-medium text-foreground">{next.lessonTitle}</span>
          </p>
        )}
      </div>
      <p className="border-t border-border pt-4 text-xs text-muted-foreground">{enrolledNote}</p>
    </>
  );
}
