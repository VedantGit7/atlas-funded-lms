import Link from "next/link";
import { BookOpen } from "lucide-react";
import type { MyCoursesResponse } from "@atlas/contracts/enrollments/my-courses.schemas";
import { MyCourseRow } from "../../learner/components/dashboard/my-course-row";

type CourseProgressSectionProps = {
  /** Null when the course list couldn't be read. */
  courses: MyCoursesResponse["data"] | null;
};

function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

/**
 * The learner's progress in each course they're enrolled in, from their saved
 * lesson progress (QA review 1 M31: the page showed only XP and streaks, so a
 * learner who had finished lessons saw "0").
 */
export function CourseProgressSection({ courses }: CourseProgressSectionProps) {
  return (
    <section aria-labelledby="course-progress-heading" className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="course-progress-heading"
          className="text-lg font-bold tracking-tight text-foreground"
        >
          Your courses
        </h2>
        <Link
          href="/courses"
          className="rounded text-sm font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Browse courses
        </Link>
      </div>

      {courses === null ? (
        <p
          role="status"
          className="rounded-2xl border border-border bg-card p-6 text-sm text-muted-foreground"
        >
          Your courses couldn&apos;t be loaded. Reload the page to try again.
        </p>
      ) : courses.items.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-border bg-card p-6 sm:flex-row sm:items-center">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
            <BookOpen className="h-5 w-5" aria-hidden="true" />
          </span>
          <p className="flex-1 text-sm text-muted-foreground">
            Enroll in a course and your progress in it will show here.
          </p>
          <Link
            href="/courses"
            className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Browse courses
          </Link>
        </div>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-3">
            <Total label="In progress" value={courses.totals.inProgress} />
            <Total label="Finished" value={courses.totals.completed} />
            <Total label="Lessons done" value={courses.totals.lessonsCompleted} />
          </dl>
          <p className="sr-only">
            {plural(courses.totals.enrolled, "course", "courses")} enrolled.
          </p>
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card shadow-sm">
            {courses.items.map((course) => (
              <MyCourseRow key={course.courseId} course={course} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 text-2xl font-bold tabular-nums text-foreground">{value}</dd>
    </div>
  );
}
