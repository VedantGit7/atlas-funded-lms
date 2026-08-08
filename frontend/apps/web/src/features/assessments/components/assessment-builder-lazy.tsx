"use client";

import dynamic from "next/dynamic";

export const AssessmentBuilderLazy = dynamic(
  () =>
    import("../../assessments/components/assessment-builder").then(
      (module) => module.AssessmentBuilder,
    ),
    { loading: () => (
      <div className="flex min-h-[12rem] items-center justify-center">
        <p className="text-sm text-[var(--admin-on-surface-variant)]">Loading assessment builder…</p>
      </div>
    ) },
);
