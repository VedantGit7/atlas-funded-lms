"use client";

import { Sparkles } from "lucide-react";
import {
  builderHelperClassName,
  builderSectionBodyClassName,
  builderSectionClassName,
} from "./course-builder-shared";

export function CourseSettingsComingSoon() {
  return (
    <div className={`${builderSectionClassName} overflow-hidden shadow-sm`}>
      <div
        className={`${builderSectionBodyClassName} flex flex-col items-center py-16 text-center`}
      >
        <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-[var(--admin-border)] bg-[var(--admin-surface-low)] text-[var(--admin-primary)]">
          <Sparkles className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
        </span>
        <p className="text-base font-semibold text-[var(--admin-on-surface)]">Coming soon</p>
        <p className={`${builderHelperClassName} mt-2 max-w-sm`}>
          This setting is not available yet. Check back in a future release.
        </p>
      </div>
    </div>
  );
}
