"use client";

import Link from "next/link";
import { Clock } from "lucide-react";
import type { z } from "zod";
import type { studioCourseListItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";
import { CourseFeaturesPopover } from "./course-features-popover";
import {
  courseAgeDays,
  courseCardStatusLabel,
} from "./courses-catalog-shared";
import { StudioCoursePrice } from "./StudioCoursePrice";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

type CourseCatalogCardProps = {
  course: CourseRow;
};

export function CourseCatalogCard({ course }: CourseCatalogCardProps) {
  const href = `/studio/courses/${course.id}`;
  const ageDays = courseAgeDays(course.createdAt);
  const statusLabel = courseCardStatusLabel(course.status);
  const category =
    typeof course.tags?.["category"] === "string"
      ? course.tags["category"].replace(/-/g, " ")
      : null;

  return (
    <article className="group overflow-visible rounded-xl border border-[var(--admin-border)] bg-[var(--admin-surface)] shadow-sm transition-[box-shadow,transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-[var(--admin-primary)]/30 hover:shadow-md">
      <Link href={href} className="block overflow-hidden rounded-t-xl">
        <div className="relative aspect-[16/10] overflow-hidden bg-[linear-gradient(135deg,var(--admin-primary-strong),var(--admin-primary-container))]">
          {course.coverKey ? (
            <div
              className="absolute inset-0 bg-cover bg-center opacity-90"
              style={{ backgroundImage: `url(${course.coverKey})` }}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
              <p className="text-lg font-bold text-white/90">{course.title}</p>
            </div>
          )}
          <div className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-black/35 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <Clock className="h-3.5 w-3.5" aria-hidden="true" />
            {ageDays} {ageDays === 1 ? "Day" : "Days"}
          </div>
        </div>

        <div className="space-y-2 px-4 py-4">
          <h3 className="line-clamp-2 text-base font-bold text-[var(--admin-on-surface)]">
            {course.title}
          </h3>
          <p className="text-sm text-[var(--admin-on-surface-variant)]">
            {category ? category : "Course"}
          </p>
          <p className="text-sm font-bold text-[var(--admin-on-surface)]">
            <StudioCoursePrice course={course} />
          </p>
        </div>
      </Link>

      <div className="flex items-center justify-between border-t border-[var(--admin-border)] px-4 py-3">
        <span className="inline-flex rounded-full bg-[var(--admin-surface-high)] px-3 py-1 text-xs font-semibold text-[var(--admin-on-surface-variant)]">
          {statusLabel}
        </span>
        <CourseFeaturesPopover course={course} />
      </div>
    </article>
  );
}
