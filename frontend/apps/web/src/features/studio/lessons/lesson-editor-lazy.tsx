"use client";

import dynamic from "next/dynamic";

export const LessonEditorLazy = dynamic(
  () => import("./lesson-editor").then((module) => module.LessonEditor),
  { loading: () => <p>Loading lesson editor…</p> },
);
