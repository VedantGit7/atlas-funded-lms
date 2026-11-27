import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import type { MyCourse } from "@atlas/contracts/enrollments/my-courses.schemas";
import { LessonStatusTrack, lessonsDoneLabel } from "../../../lessons/lesson-track";
import { courseActionHref, courseActionLabel, courseStatusLabel } from "./dashboard-model";

const quietLinkClass =
  "inline-flex items-center gap-1.5 rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Course images are stored as an address; only render ones that look like one. */
function isImageUrl(value: string | null): value is string {
  return typeof value === "string" && /^(https?:\/\/|\/)\S/i.test(value.trim());
}

/**
 * The course image, rendered on the server: the catalogue's client-side card
 * art would add its code to every page that lists courses (the Progress page's
 * first-load budget, QA remediation S3.3).
 */
function CourseThumb({ coverKey }: { coverKey: string | null }) {
  return (
    <div className="relative hidden aspect-[16/9] w-28 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-primary/15 to-primary/5 sm:block">
      <GraduationCap
        className="absolute left-1/2 top-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-primary/70"
        aria-hidden="true"
      />
      {isImageUrl(coverKey) ? (
        <img
          src={coverKey}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
        />
      ) : null}
    </div>
  );
}

/**
 * One enrolled course with its lesson track and next step: the home page's
 * "Your courses" and the Progress page's course list (QA remediation S3.3).
 */
export function MyCourseRow({ course }: { course: MyCourse }) {
  return (
    <li className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4">
      <CourseThumb coverKey={course.coverKey} />
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Link
            href={`/courses/${course.courseId}`}
            className="min-w-0 rounded text-sm font-bold text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {course.title}
          </Link>
          <StatusChip status={course.status} />
        </div>
        <LessonStatusTrack
          lessons={course.lessons}
          completedLessons={course.completedLessons}
          totalLessons={course.totalLessons}
          progressPct={course.progressPct}
          label={`${course.title} progress`}
          className="h-1.5 max-w-md"
        />
        <p className="text-xs text-muted-foreground">
          {lessonsDoneLabel(course.completedLessons, course.totalLessons)} · {course.progressPct}%
        </p>
      </div>
      <Link href={courseActionHref(course)} className={`${quietLinkClass} shrink-0`}>
        {courseActionLabel(course)}
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </li>
  );
}

export function StatusChip({ status }: { status: MyCourse["status"] }) {
  const tone =
    status === "completed"
      ? "bg-success/15 text-[color-mix(in_srgb,var(--success)_74%,var(--foreground))]"
      : status === "in_progress"
        ? "bg-warning/15 text-[color-mix(in_srgb,var(--warning)_70%,var(--foreground))]"
        : "bg-muted text-muted-foreground";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>
      {courseStatusLabel(status)}
    </span>
  );
}
