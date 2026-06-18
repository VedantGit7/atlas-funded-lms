type CourseStatus = "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";

export function CourseStatusBadge({ status }: { status: CourseStatus }) {
  return <span className="rounded border px-2 py-0.5 text-xs uppercase">{status}</span>;
}
