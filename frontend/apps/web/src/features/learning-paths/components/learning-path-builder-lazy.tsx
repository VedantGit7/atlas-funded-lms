"use client";

import dynamic from "next/dynamic";

export const LearningPathBuilderLazy = dynamic(
  () =>
    import("./StudioLearningPathDetailClient").then(
      (module) => module.StudioLearningPathDetailClient,
    ),
  {
    loading: () => (
      <div className="flex h-full min-h-[12rem] items-center justify-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading learning path builder…</p>
      </div>
    ),
  },
);
