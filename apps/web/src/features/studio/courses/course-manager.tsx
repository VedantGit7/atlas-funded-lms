"use client";

import { useState } from "react";
import { CourseTable } from "./course-table";
import { CreateCourseDialog } from "./create-course-dialog";
import type { z } from "zod";
import type { studioCourseListItemSchema } from "../../../server/courses/course-authoring-schemas";

type CourseRow = z.infer<typeof studioCourseListItemSchema>;

type CourseManagerProps = {
  courses: CourseRow[];
  canCreate: boolean;
};

export function CourseManager({ courses, canCreate }: CourseManagerProps) {
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm opacity-80">Manage draft, review, and published courses you own.</p>
        {canCreate ? (
          <button
            type="button"
            onClick={() => {
              setShowCreate(true);
            }}
          >
            Create course
          </button>
        ) : null}
      </div>

      {courses.length === 0 ? (
        <div className="rounded border p-6">
          <h2>No courses yet</h2>
          <p>Create your first draft course to start building modules and settings.</p>
          {canCreate ? (
            <button
              type="button"
              className="mt-4"
              onClick={() => {
                setShowCreate(true);
              }}
            >
              Create course
            </button>
          ) : null}
        </div>
      ) : (
        <CourseTable courses={courses} />
      )}

      {showCreate ? (
        <CreateCourseDialog
          onClose={() => {
            setShowCreate(false);
          }}
        />
      ) : null}
    </div>
  );
}
