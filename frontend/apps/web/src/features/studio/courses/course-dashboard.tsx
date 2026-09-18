"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Star, UserRoundPlus } from "lucide-react";
import type { z } from "zod";
import type {
  studioCourseDetailSchema,
  studioModuleOutlineItemSchema,
} from "@atlas/contracts/courses/course-authoring-schemas";
import {
  fetchCourseLearnerRoster,
  formatStudioLearnerApiError,
  type CourseLearnerRow,
} from "../learners/api";
import { useCourseDetailActions } from "./course-detail-context";
import { courseDetailCardClassName, courseDetailMutedTextClassName } from "./course-detail-shared";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;
type ModuleItem = z.infer<typeof studioModuleOutlineItemSchema>;

type CourseDashboardProps = {
  course: CourseDetail;
  modules: ModuleItem[];
};

type DashboardMetrics = {
  enrolledCount: number;
  averageCompletionRate: number;
  averageRating: number;
  lessonCount: number;
  learners: CourseLearnerRow[];
};

function DashboardMetricCard({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className={`${courseDetailCardClassName} flex min-h-[7.5rem] flex-col justify-between p-5 shadow-sm`}
    >
      <p className="text-sm font-medium text-[var(--admin-on-surface-variant)]">{label}</p>
      <div className="text-3xl font-bold tracking-tight text-[var(--admin-on-surface)]">
        {value}
      </div>
    </div>
  );
}

function computeMetrics(learners: CourseLearnerRow[], lessonCount: number): DashboardMetrics {
  const enrolledCount = learners.length;
  const averageCompletionRate =
    enrolledCount === 0
      ? 0
      : Math.round(learners.reduce((sum, row) => sum + row.progressPct, 0) / enrolledCount);

  return {
    enrolledCount,
    averageCompletionRate,
    averageRating: 0,
    lessonCount,
    learners,
  };
}

function DashboardLearnerTable({ learners }: { learners: CourseLearnerRow[] }) {
  return (
    <div className={`${courseDetailCardClassName} overflow-hidden`}>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Enrolled learners</caption>
          <thead className="border-b border-[var(--admin-border)] bg-[var(--admin-surface-low)]">
            <tr>
              <th className="px-5 py-3 text-left font-semibold text-[var(--admin-on-surface-variant)]">
                Learner
              </th>
              <th className="px-5 py-3 text-left font-semibold text-[var(--admin-on-surface-variant)]">
                Enrolled
              </th>
              <th className="px-5 py-3 text-left font-semibold text-[var(--admin-on-surface-variant)]">
                Progress
              </th>
              <th className="px-5 py-3 text-left font-semibold text-[var(--admin-on-surface-variant)]">
                Lessons
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--admin-border)]">
            {learners.map((row) => (
              <tr
                key={row.enrollmentId}
                className="transition-colors hover:bg-[var(--admin-surface-high)]"
              >
                <td className="px-5 py-3 font-medium text-[var(--admin-on-surface)]">
                  {row.displayName}
                </td>
                <td className="px-5 py-3 text-[var(--admin-on-surface-variant)]">
                  {new Date(row.enrolledAt).toLocaleDateString()}
                </td>
                <td className="px-5 py-3 text-[var(--admin-on-surface)]">{row.progressPct}%</td>
                <td className="px-5 py-3 text-[var(--admin-on-surface-variant)]">
                  {row.completedLessons}/{row.totalLessons}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DashboardEmptyState({ courseId }: { courseId: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--admin-surface-high)] text-[var(--admin-outline)]">
        <UserRoundPlus className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h2 className="text-base font-semibold text-[var(--admin-on-surface)]">
        No students enrolled yet
      </h2>
      <p className={`${courseDetailMutedTextClassName} mt-1 max-w-sm`}>
        Enroll students to track their progress here.
      </p>
      <Link
        href={`/studio/courses/${courseId}/learners`}
        className="mt-5 text-sm font-semibold text-[var(--admin-primary)] transition-colors hover:text-[var(--admin-primary-strong)]"
      >
        View learner roster
      </Link>
    </div>
  );
}

export function CourseDashboard({ course, modules }: CourseDashboardProps) {
  const lessonCount = modules.reduce((sum, module) => sum + module.lessonCount, 0);
  const { dashboardRefreshToken } = useCourseDetailActions();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<DashboardMetrics>(() => computeMetrics([], lessonCount));

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const learners = await fetchCourseLearnerRoster(course.id);
        if (!cancelled) {
          setMetrics(computeMetrics(learners, lessonCount));
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(formatStudioLearnerApiError(loadError));
          setMetrics(computeMetrics([], lessonCount));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [course.id, lessonCount, dashboardRefreshToken]);

  return (
    <div className="mx-auto w-full max-w-6xl space-y-8 px-4 py-8 md:px-8">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <DashboardMetricCard label="Enrolled" value={loading ? "—" : metrics.enrolledCount} />
        <DashboardMetricCard
          label="Average Completion Rate"
          value={loading ? "—" : `${metrics.averageCompletionRate}%`}
        />
        <DashboardMetricCard
          label="Average Rating"
          value={
            loading ? (
              "—"
            ) : (
              <span className="inline-flex items-center gap-2">
                <Star
                  className="h-6 w-6 fill-[var(--admin-warning)] text-[var(--admin-warning)]"
                  aria-hidden="true"
                />
                {metrics.averageRating.toFixed(1)}
              </span>
            )
          }
        />
        <DashboardMetricCard label="Lessons" value={lessonCount} />
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-[var(--admin-danger)]/30 bg-[var(--admin-danger)]/10 px-4 py-3 text-sm text-[var(--admin-danger)]"
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className={`${courseDetailMutedTextClassName} text-center`}>Loading enrollment data…</p>
      ) : metrics.enrolledCount === 0 ? (
        <DashboardEmptyState courseId={course.id} />
      ) : (
        <DashboardLearnerTable learners={metrics.learners} />
      )}
    </div>
  );
}
