"use client";

import dynamic from "next/dynamic";

export const CourseEditorLazy = dynamic(
  () => import("./course-editor").then((module) => module.CourseEditor),
  { loading: () => <p className="p-8 text-sm text-[var(--admin-on-surface-variant)]">Loading course editor…</p> },
);
