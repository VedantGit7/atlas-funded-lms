"use client";

import { Upload } from "lucide-react";
import {
  ghostButtonClassName,
  primaryButtonClassName,
  stickyFooterClassName,
} from "../readiness-admin-shared";

type ReadinessPolicyFooterProps = {
  resolvedCount: number;
  totalCount: number;
  canPublish: boolean;
  isDirty: boolean;
  saving: boolean;
  onDiscard: () => void;
  onPublish: () => void;
};

export function ReadinessPolicyFooter({
  resolvedCount,
  totalCount,
  canPublish,
  isDirty,
  saving,
  onDiscard,
  onPublish,
}: ReadinessPolicyFooterProps) {
  const allResolved = totalCount > 0 && resolvedCount === totalCount;
  const progress = totalCount > 0 ? Math.round((resolvedCount / totalCount) * 100) : 0;
  const publishEnabled = canPublish && allResolved && !saving;

  return (
    <footer className={stickyFooterClassName}>
      <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-1.5">
          <span
            className={`text-sm font-bold ${
              allResolved ? "text-[var(--admin-success)]" : "text-[var(--admin-primary)]"
            }`}
          >
            {totalCount > 0
              ? `${String(resolvedCount)} of ${String(totalCount)} items resolved`
              : "Add checklist items to enable publishing"}
          </span>
          <div
            className="h-2 w-48 max-w-full overflow-hidden rounded-full bg-[var(--admin-surface-high)]"
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Legal review progress"
          >
            <div
              className={`h-full transition-all duration-300 ${
                allResolved ? "bg-[var(--admin-success)]" : "bg-[var(--admin-primary)]"
              }`}
              style={{ width: `${String(progress)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            className={ghostButtonClassName}
            disabled={!isDirty || saving}
            onClick={onDiscard}
          >
            Discard changes
          </button>
          <button
            type="button"
            className={`${primaryButtonClassName} px-6`}
            disabled={!publishEnabled}
            onClick={onPublish}
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            {saving ? "Publishing…" : "Publish policy"}
          </button>
        </div>
      </div>
    </footer>
  );
}
