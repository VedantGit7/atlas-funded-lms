"use client";

import Link from "next/link";
import type { z } from "zod";
import { CourseStatusBadge } from "./course-status-badge";
import type { studioCourseListItemSchema } from "@atlas/contracts/courses/course-authoring-schemas";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

type CourseTableProps = {
  courses: CourseRow[];
};

export function CourseTable({ courses }: CourseTableProps) {
  if (courses.length === 0) {
    return <p>No courses yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left">Title</th>
            <th className="text-left">Status</th>
            <th className="text-left">Updated</th>
            <th className="text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {courses.map((course) => (
            <tr key={course.id} className="border-t">
              <td>
                <div className="font-medium">{course.title}</div>
                <div className="text-sm opacity-70">{course.slug}</div>
              </td>
              <td>
                <CourseStatusBadge status={course.status} />
              </td>
              <td>{new Date(course.updatedAt).toLocaleString()}</td>
              <td>
                <Link href={`/studio/courses/${course.id}`}>Open builder</Link>
                {course.status === "PUBLISHED" ? (
                  <>
                    {" · "}
                    <Link href={`/studio/courses/${course.id}/learners`}>Learners</Link>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
