"use client";

import type { z } from "zod";
import type { studioCourseDetailSchema } from "../../../server/courses/course-authoring-schemas";

type CourseDetail = z.infer<typeof studioCourseDetailSchema>;

type BuilderValidationPanelProps = {
  course: CourseDetail;
  moduleCount: number;
  canPublish: boolean;
  onPublish: () => void;
  publishing: boolean;
  publishError: string | null;
};

export function BuilderValidationPanel({
  course,
  moduleCount,
  canPublish,
  onPublish,
  publishing,
  publishError,
}: BuilderValidationPanelProps) {
  const issues: string[] = [];

  if (!course.title.trim()) issues.push("Title is required.");
  if (moduleCount === 0) issues.push("Consider adding at least one module before submit.");

  const ready = issues.length === 0 && course.status === "DRAFT";

  return (
    <aside className="space-y-4 rounded border p-4">
      <header>
        <h2>Review checklist</h2>
        <p className="text-sm opacity-80">Submit for review when the draft is ready.</p>
      </header>

      <ul className="space-y-2 text-sm">
        <li>{course.title.trim() ? "Title present" : "Missing title"}</li>
        <li>{moduleCount > 0 ? `${String(moduleCount)} module(s)` : "No modules yet"}</li>
        <li>Status: {course.status}</li>
      </ul>

      {issues.length > 0 ? (
        <div>
          <h3 className="text-sm font-medium">Suggestions</h3>
          <ul className="list-disc pl-5 text-sm">
            {issues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-sm">Basic publish checks passed.</p>
      )}

      {publishError ? <p role="alert">{publishError}</p> : null}

      {canPublish && course.status === "DRAFT" ? (
        <button type="button" onClick={onPublish} disabled={!ready || publishing}>
          {publishing ? "Submitting..." : "Submit for review"}
        </button>
      ) : null}

      {course.status === "REVIEW" ? (
        <p className="text-sm">This course is awaiting review and cannot be edited.</p>
      ) : null}

      {course.status === "PUBLISHED" ? (
        <p className="text-sm">This course is published. Direct edits are locked.</p>
      ) : null}
    </aside>
  );
}
