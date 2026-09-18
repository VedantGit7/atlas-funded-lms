"use client";

import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import { publishedLiveBadgeClassName } from "../competency-admin-shared";

type CompetencyPageHeaderProps = {
  selectedProfile: ScoringProfileDto | null;
  dimensionCount: number;
};

export function CompetencyPageHeader({
  selectedProfile,
  dimensionCount,
}: CompetencyPageHeaderProps) {
  const isPublished = selectedProfile?.activeVersion != null;

  return (
    <header className="flex flex-col gap-3 pb-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-bold tracking-tight text-[var(--admin-on-surface)]">
          Competency &amp; Scoring
        </h1>
        {isPublished ? (
          <span className={publishedLiveBadgeClassName}>
            <span
              className="h-1.5 w-1.5 rounded-full bg-[var(--admin-success)] motion-safe:animate-pulse"
              aria-hidden="true"
            />
            Published v{String(selectedProfile.activeVersion)}
          </span>
        ) : null}
      </div>
      <p className="max-w-xl text-sm leading-relaxed text-[var(--admin-on-surface-variant)] sm:text-right">
        {dimensionCount > 0
          ? `${dimensionCount} dimension${dimensionCount === 1 ? "" : "s"} configured`
          : "Add dimensions and scoring profiles to begin"}
        {selectedProfile ? ` · Editing ${selectedProfile.name}` : ""}
      </p>
    </header>
  );
}
