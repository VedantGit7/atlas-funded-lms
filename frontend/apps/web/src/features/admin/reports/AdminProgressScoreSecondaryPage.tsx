"use client";

import Link from "next/link";
import { Download, Users } from "lucide-react";
import { primaryButtonClassName } from "../../analytics/analytics-admin-shared";
import { ProgressScoreReportTabs, type ProgressScoreReportTab } from "./ProgressScoreReportTabs";

export function AdminProgressScoreSecondaryPage({
  tab,
}: {
  tab: Extract<ProgressScoreReportTab, "cohorts" | "exports">;
}) {
  const isCohorts = tab === "cohorts";
  return (
    <div className="mx-auto flex w-full max-w-[1200px] flex-col gap-8">
      <ProgressScoreReportTabs active={tab} />
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-[var(--admin-on-surface)]">
          {isCohorts ? "Cohorts" : "Exports"}
        </h1>
        <p className="mt-1 text-sm text-[var(--admin-on-surface-variant)]">
          {isCohorts
            ? "Create groups and message matched learners from Progress or Scores rosters. A dedicated cohort ledger is not wired yet."
            : "CSV exports run from Progress or Scores after you select a product and filters. A dedicated export history for this module is not wired yet."}
        </p>
      </div>
      <div className="rounded-sm border border-[var(--admin-border)] bg-[var(--admin-surface)] p-8">
        <div className="mb-4 text-[var(--admin-primary)]">
          {isCohorts ? (
            <Users className="h-8 w-8" aria-hidden="true" />
          ) : (
            <Download className="h-8 w-8" aria-hidden="true" />
          )}
        </div>
        <p className="max-w-xl text-sm text-[var(--admin-on-surface-variant)]">
          {isCohorts
            ? "Open a product roster, apply filters, then use Create group / Message on the matched learners."
            : "Open Progress or Scores, choose columns and filters, then use Export CSV."}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/admin/reports/progress-score/progress"
            className={`${primaryButtonClassName} h-10`}
          >
            Open progress
          </Link>
          <Link
            href="/admin/reports/progress-score/scores"
            className={`${primaryButtonClassName} h-10`}
          >
            Open scores
          </Link>
        </div>
      </div>
    </div>
  );
}
