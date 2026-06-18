import Link from "next/link";
import { EnrollmentStatusBadge } from "./enrollment-status-badge";

export type CourseCardData = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  enrollmentStatus: "enrolled" | "not_enrolled" | null;
};

type CourseCardProps = {
  course: CourseCardData;
};

export function CourseCard({ course }: CourseCardProps) {
  return (
    <article className="flex h-full flex-col rounded-lg border p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <h2 className="text-lg font-semibold">
          <Link href={`/courses/${course.id}`} className="hover:underline">
            {course.title}
          </Link>
        </h2>
        {course.enrollmentStatus ? (
          <EnrollmentStatusBadge status={course.enrollmentStatus} />
        ) : null}
      </div>
      {course.description ? (
        <p className="mb-4 line-clamp-3 flex-1 text-sm opacity-80">{course.description}</p>
      ) : (
        <p className="mb-4 flex-1 text-sm italic opacity-60">No description provided.</p>
      )}
      <Link
        href={`/courses/${course.id}`}
        className="inline-flex w-fit rounded-md border px-3 py-2 text-sm font-medium"
      >
        View course
      </Link>
    </article>
  );
}
