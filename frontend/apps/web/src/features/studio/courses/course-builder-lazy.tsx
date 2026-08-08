"use client";

import dynamic from "next/dynamic";

export const CourseBuilderLazy = dynamic(
  () => import("./course-builder").then((module) => module.CourseBuilder),
  { loading: () => <p>Loading course builder…</p> },
);
