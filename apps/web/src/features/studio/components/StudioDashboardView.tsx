import Link from "next/link";
import { CourseStatusBadge } from "../courses/course-status-badge";

export type StudioDashboardViewProps = {
  courseCount: number;
  draftCount: number;
  reviewCount: number;
  gradingCount: number;
  pendingWorkflowCount: number;
  recentCourses: Array<{
    id: string;
    title: string;
    status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
    href: string;
  }>;
  gradingHref: string;
  coursesHref: string;
  reviewHref: string;
};

export function StudioDashboardView({
  courseCount,
  draftCount,
  reviewCount,
  gradingCount,
  pendingWorkflowCount,
  recentCourses,
  gradingHref,
  coursesHref,
  reviewHref,
}: StudioDashboardViewProps) {
  return (
    <main className="space-y-6">
      <PageHeaderBlock
        title="Studio dashboard"
        description="Overview of your courses, grading queue, and review status."
      />

      <section aria-label="Studio summary" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard label="My courses" value={courseCount} href={coursesHref} />
        <SummaryCard label="Drafts" value={draftCount} href={coursesHref} />
        <SummaryCard label="Pending grading" value={gradingCount} href={gradingHref} />
        <SummaryCard
          label="In review"
          value={reviewCount + pendingWorkflowCount}
          href={reviewHref}
        />
      </section>

      <section aria-labelledby="recent-courses-heading" className="space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 id="recent-courses-heading" className="text-lg font-semibold">
            Recent courses
          </h2>
          <Link href={coursesHref} className="text-sm underline">
            View all
          </Link>
        </div>
        {recentCourses.length === 0 ? (
          <p className="text-sm opacity-80">
            No courses yet. Create your first course to get started.
          </p>
        ) : (
          <ul className="divide-y rounded-lg border bg-white">
            {recentCourses.map((course) => (
              <li key={course.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div>
                  <Link
                    href={course.href}
                    className="font-medium underline-offset-2 hover:underline"
                  >
                    {course.title}
                  </Link>
                </div>
                <CourseStatusBadge status={course.status} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <nav aria-label="Studio quick actions" className="flex flex-wrap gap-3 text-sm">
        <Link href={coursesHref} className="rounded border px-3 py-2">
          Manage courses
        </Link>
        <Link href="/studio/items" className="rounded border px-3 py-2">
          Item bank
        </Link>
        <Link href={gradingHref} className="rounded border px-3 py-2">
          Grading queue
        </Link>
      </nav>
    </main>
  );
}

function PageHeaderBlock({ title, description }: { title: string; description: string }) {
  return (
    <header className="space-y-2">
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="text-sm opacity-80">{description}</p>
    </header>
  );
}

function SummaryCard({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-lg border bg-white p-4 transition hover:border-neutral-400"
    >
      <p className="text-sm opacity-70">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </Link>
  );
}
