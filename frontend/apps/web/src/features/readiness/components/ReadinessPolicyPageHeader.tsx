"use client";

import { Clock } from "lucide-react";
import type { ReadinessPolicyDto } from "@atlas/contracts/readiness/readiness.types";
import type { ScoringProfileDto } from "@atlas/contracts/competency/competency-config.types";
import {
  formatRelativeUpdatedAt,
  publishedLiveBadgeClassName,
  statusDraftBadgeClassName,
} from "../readiness-admin-shared";

type ReadinessPolicyPageHeaderProps = {
  policy: ReadinessPolicyDto | null;
  scoringProfile: ScoringProfileDto | null;
};

export function ReadinessPolicyPageHeader({
  policy,
  scoringProfile,
}: ReadinessPolicyPageHeaderProps) {
  const isActive = policy?.status === "ACTIVE";
  const updatedAt = policy?.updatedAt;

  return (
    <header className="flex flex-col gap-3 pb-2 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[24px] font-bold tracking-tight text-[var(--admin-on-surface)]">
          Readiness Policy
        </h1>
        <span className={isActive ? publishedLiveBadgeClassName : statusDraftBadgeClassName}>
          {isActive ? "Status: Active" : (policy?.status ?? "Draft")}
        </span>
      </div>
      <div className="flex flex-col gap-1 text-sm text-[var(--admin-on-surface-variant)] lg:items-end">
        {updatedAt ? (
          <p className="inline-flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            Last edited {formatRelativeUpdatedAt(updatedAt)}
          </p>
        ) : null}
        {scoringProfile ? (
          <p className="text-[13px]">
            Linked profile:{" "}
            <span className="font-medium text-[var(--admin-on-surface)]">
              {scoringProfile.name}
            </span>
          </p>
        ) : null}
      </div>
    </header>
  );
}
