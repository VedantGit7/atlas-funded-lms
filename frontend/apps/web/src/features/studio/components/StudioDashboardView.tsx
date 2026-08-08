import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  ClipboardList,
  Database,
  FilePen,
  FileSearch,
  GraduationCap,
  Plus,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { CourseStatusBadge } from "../courses/course-status-badge";
import { StudioDashboardCreateCourseButton } from "./StudioDashboardCreateCourseButton";
import {
  formatRelativeUpdatedAt,
  studioGreeting,
  type ContentStatusSummary,
} from "./studio-dashboard-shared";

export type StudioDashboardViewProps = {
  displayName: string | null;
  publishedCount: number;
  draftCount: number;
  reviewCount: number;
  gradingCount: number;
  pendingWorkflowCount: number;
  contentStatus: ContentStatusSummary;
  recentCourses: Array<{
    id: string;
    title: string;
    status: "DRAFT" | "REVIEW" | "PUBLISHED" | "ARCHIVED";
    href: string;
    learnersHref: string;
    updatedAt: string;
  }>;
  gradingHref: string;
  coursesHref: string;
  reviewHref: string;
};

type MetricTone = "primary" | "success" | "warning" | "neutral";

const TONE_ICON_CLASS: Record<MetricTone, string> = {
  primary: "bg-[var(--admin-primary)]/12 text-[var(--admin-primary)]",
  success: "bg-[var(--admin-success)]/15 text-[var(--admin-success)]",
  warning: "bg-[var(--admin-warning)]/15 text-[var(--admin-warning)]",
  neutral: "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)]",
};

const TONE_HOVER_BORDER: Record<MetricTone, string> = {
  primary: "hover:border-[var(--admin-primary)]",
  success: "hover:border-[var(--admin-success)]",
  warning: "hover:border-[var(--admin-warning)]",
  neutral: "hover:border-[var(--admin-on-surface-variant)]",
};

export function StudioDashboardView({
  displayName,
  publishedCount,
  draftCount,
  reviewCount,
  gradingCount,
  pendingWorkflowCount,
  contentStatus,
  recentCourses,
  gradingHref,
  coursesHref,
  reviewHref,
}: StudioDashboardViewProps) {
  const inReviewTotal = reviewCount + pendingWorkflowCount;
  const totalCourses =
    contentStatus.published +
    contentStatus.draft +
    contentStatus.review +
    contentStatus.archived;
  const publishRate =
    totalCourses > 0 ? Math.min(100, Math.round((publishedCount / totalCourses) * 100)) : 0;

  return (
    <div className="space-y-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[var(--admin-on-surface)]">
          {studioGreeting(displayName)}
        </h1>
        <p className="text-sm text-[var(--admin-on-surface-variant)]">
          Overview of your courses, grading queue, and pending approvals.
        </p>
      </div>

      {gradingCount > 0 ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-lg border border-[var(--admin-danger)]/40 bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3 sm:flex-row sm:items-center sm:justify-between motion-safe:animate-[admin-banner-in_0.25s_ease-out]"
        >
          <p className="text-sm font-semibold text-[var(--admin-danger)]">
            You have {gradingCount} submission{gradingCount === 1 ? "" : "s"} awaiting grading.
          </p>
          <Link
            href={gradingHref}
            className="inline-flex items-center gap-1 text-sm font-bold text-[var(--admin-danger)] transition-opacity hover:opacity-80"
          >
            Go to grading queue
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      <section className="admin-glass rounded-2xl p-6 shadow-xl md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
              Course catalogue
            </p>
            <div className="mt-2 flex flex-wrap items-baseline gap-4">
              <span className="text-5xl font-extrabold leading-none tracking-tight text-[var(--admin-primary)] md:text-6xl">
                {publishRate}%
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--admin-success)]/15 px-3 py-1 text-sm font-semibold text-[var(--admin-success)]">
                <span className="h-2 w-2 rounded-full bg-[var(--admin-success)]" />
                {publishedCount} of {totalCourses} courses published
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm text-[var(--admin-on-surface-variant)]">
              Share of your catalogue currently live for learners.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-start gap-3 sm:justify-end">
            <StudioDashboardCreateCourseButton />
            <Link
              href={coursesHref}
              prefetch={false}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--admin-border)] bg-[var(--admin-surface-high)] px-4 py-2.5 text-sm font-semibold text-[var(--admin-on-surface)] transition-colors hover:border-[var(--admin-primary)]"
            >
              <GraduationCap className="h-4 w-4" strokeWidth={2} aria-hidden="true" />
              View all courses
            </Link>
          </div>
        </div>

        <div className="mt-6">
          <div
            className="h-3 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
            role="progressbar"
            aria-valuenow={publishRate}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Published course rate"
          >
            <div
              className="h-full rounded-full bg-[var(--admin-primary)] transition-[width]"
              style={{ width: `${publishRate.toString()}%` }}
            />
          </div>
        </div>

        <div className="mt-6 border-t border-[var(--admin-outline)]/40 pt-6">
          <ContentPipeline summary={contentStatus} />
        </div>
      </section>

      <section
        aria-label="Key metrics"
        className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <MetricCard
          icon={BookOpen}
          label="My courses"
          value={String(publishedCount)}
          caption="Active curriculum"
          href={coursesHref}
          tone="primary"
        />
        <MetricCard
          icon={FilePen}
          label="Drafts"
          value={String(draftCount)}
          caption="Work in progress"
          href={coursesHref}
          tone="neutral"
        />
        <MetricCard
          icon={ClipboardList}
          label="Pending grading"
          value={String(gradingCount)}
          caption={gradingCount > 0 ? "Requires attention" : "Queue clear"}
          href={gradingHref}
          tone={gradingCount > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          icon={FileSearch}
          label="In review"
          value={String(inReviewTotal)}
          caption="Awaiting approval"
          href={reviewHref}
          tone={inReviewTotal > 0 ? "warning" : "neutral"}
        />
      </section>

      <section
        aria-label="Recent courses"
        className="overflow-hidden rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-lg"
      >
        <div className="flex items-center justify-between gap-4 border-b border-[var(--admin-border)] bg-[var(--admin-surface-high)]/40 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Recent courses</h2>
            <p className="text-sm text-[var(--admin-on-surface-variant)]">
              Latest updates across your catalogue
            </p>
          </div>
          <Link
            href={coursesHref}
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--admin-primary)] px-4 py-2 text-sm font-semibold text-[var(--admin-on-primary)] transition-opacity hover:opacity-90"
          >
            View all courses
          </Link>
        </div>

        {recentCourses.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <caption className="sr-only">Recent studio courses</caption>
              <thead>
                <tr className="bg-[var(--admin-surface-low)] text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--admin-on-surface-variant)]">
                  <th scope="col" className="px-6 py-3">
                    Course
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3">
                    Updated
                  </th>
                  <th scope="col" className="px-6 py-3 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--admin-border)]">
                {recentCourses.map((course) => (
                  <tr
                    key={course.id}
                    className="transition-colors hover:bg-[var(--admin-surface-high)]/40"
                  >
                    <td className="px-6 py-4">
                      <Link
                        href={course.href}
                        className={`font-semibold text-[var(--admin-on-surface)] transition-colors hover:text-[var(--admin-primary)] ${
                          course.status === "ARCHIVED" ? "opacity-60" : ""
                        }`}
                      >
                        {course.title}
                      </Link>
                    </td>
                    <td className="px-6 py-4">
                      <CourseStatusBadge status={course.status} />
                    </td>
                    <td className="px-6 py-4 text-sm text-[var(--admin-on-surface-variant)]">
                      {formatRelativeUpdatedAt(course.updatedAt)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-3">
                        {course.status === "PUBLISHED" ? (
                          <Link
                            href={course.learnersHref}
                            prefetch={false}
                            className="text-xs font-bold text-[var(--admin-primary)] transition-opacity hover:opacity-80"
                          >
                            Learners
                          </Link>
                        ) : null}
                        <Link
                          href={course.href}
                          prefetch={false}
                          aria-label={`Open builder for ${course.title}`}
                          className="inline-flex text-[var(--admin-on-surface-variant)] transition-colors hover:text-[var(--admin-primary)]"
                        >
                          <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-semibold text-[var(--admin-on-surface)]">No courses yet</p>
            <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
              Create your first course to start building your catalogue.
            </p>
          </div>
        )}
      </section>

      <section aria-label="Quick actions" className="space-y-4">
        <h2 className="text-lg font-bold text-[var(--admin-on-surface)]">Quick actions</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <QuickLink
            icon={Settings}
            label="Manage courses"
            caption="Permissions and accessibility"
            href={coursesHref}
          />
          <QuickLink
            icon={Database}
            label="Item bank"
            caption="Question repository"
            href="/studio/items"
          />
          <QuickLink
            icon={ClipboardList}
            label="Grading queue"
            caption={
              gradingCount > 0
                ? `${gradingCount} item${gradingCount === 1 ? "" : "s"} pending`
                : "No pending items"
            }
            href={gradingHref}
            urgent={gradingCount > 0}
          />
        </div>
      </section>
    </div>
  );
}

function ContentPipeline({ summary }: { summary: ContentStatusSummary }) {
  const segments = [
    { key: "published", label: "Published", value: summary.published, color: "var(--admin-success)" },
    { key: "review", label: "In review", value: summary.review, color: "var(--admin-warning)" },
    { key: "draft", label: "Draft", value: summary.draft, color: "var(--admin-primary)" },
    { key: "archived", label: "Archived", value: summary.archived, color: "var(--admin-outline)" },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--admin-on-surface-variant)]">
          Content pipeline
        </p>
        <p className="text-xs text-[var(--admin-on-surface-variant)]">{total} course(s)</p>
      </div>
      {total > 0 ? (
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]">
          {segments.map((segment) =>
            segment.value > 0 ? (
              <div
                key={segment.key}
                style={{
                  width: `${((segment.value / total) * 100).toFixed(3)}%`,
                  backgroundColor: segment.color,
                }}
                title={`${segment.label}: ${segment.value.toLocaleString()}`}
              />
            ) : null,
          )}
        </div>
      ) : (
        <div className="h-2.5 w-full rounded-full bg-[var(--admin-surface-high)]" />
      )}
      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((segment) => (
          <span
            key={segment.key}
            className="flex items-center gap-2 text-xs text-[var(--admin-on-surface-variant)]"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: segment.color }} />
            {segment.label}
            <span className="font-semibold text-[var(--admin-on-surface)]">{segment.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  href,
  tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  href: string;
  tone: MetricTone;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] p-6 transition-all hover:-translate-y-0.5 ${TONE_HOVER_BORDER[tone]}`}
    >
      <div className="mb-4 flex items-center justify-between">
        <span className={`rounded-lg p-2 ${TONE_ICON_CLASS[tone]}`}>
          <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
        </span>
        <ArrowUpRight
          className="h-4 w-4 text-[var(--admin-on-surface-variant)] opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />
      </div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold text-[var(--admin-on-surface)]">{value}</p>
      <p className="mt-3 text-xs text-[var(--admin-on-surface-variant)]">{caption}</p>
    </Link>
  );
}

function QuickLink({
  icon: Icon,
  label,
  caption,
  href,
  urgent = false,
}: {
  icon: LucideIcon;
  label: string;
  caption: string;
  href: string;
  urgent?: boolean;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={`group flex items-center gap-3 rounded-xl border bg-[var(--admin-surface)] p-4 transition-colors ${
        urgent
          ? "border-[color-mix(in_srgb,var(--admin-danger)_25%,var(--admin-border))] hover:border-[var(--admin-danger)] hover:bg-[color-mix(in_srgb,var(--admin-danger)_8%,var(--admin-surface))]"
          : "border-[var(--admin-border)] hover:border-[var(--admin-primary)] hover:bg-[var(--admin-surface-high)]"
      }`}
    >
      <span
        className={`rounded-lg p-2 transition-colors ${
          urgent
            ? "bg-[color-mix(in_srgb,var(--admin-danger)_12%,var(--admin-surface))] text-[var(--admin-danger)]"
            : "bg-[var(--admin-surface-high)] text-[var(--admin-on-surface-variant)] group-hover:bg-[var(--admin-primary)]/15 group-hover:text-[var(--admin-primary)]"
        }`}
      >
        <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold text-[var(--admin-on-surface)]">
          {label}
        </span>
        <span
          className={`block truncate text-xs ${
            urgent ? "font-semibold text-[var(--admin-danger)]" : "text-[var(--admin-on-surface-variant)]"
          }`}
        >
          {caption}
        </span>
      </span>
    </Link>
  );
}
