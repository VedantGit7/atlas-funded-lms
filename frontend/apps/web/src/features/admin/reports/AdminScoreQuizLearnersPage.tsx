"use client";

import Link from "next/link";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { ghostButtonClassName } from "../../analytics/analytics-admin-shared";
import type { ReportInitialData } from "../../../lib/server/report-initial-data";
import {
  type ScoreLearnersPayload,
  dateInputToEndIso,
  dateInputToStartIso,
} from "./admin-progress-score-roster-api";
import { CohortActionsDrawer } from "./CohortActionsDrawer";
import { ProgressScoreReportTabs } from "./ProgressScoreReportTabs";
import { PageSkeleton, RegradeModal } from "./admin-score-quiz-learners-shared";
import {
  ScoreQuizAttemptsTab,
  ScoreQuizHeader,
  ScoreQuizItemsTab,
  ScoreQuizLearnersTab,
  ScoreQuizSummary,
} from "./admin-score-quiz-learners-sections";
import { useScoreQuizLearners } from "./use-score-quiz-learners";

/**
 * Screen 7 — Learner Score Roster / Item Analysis / Attempt History.
 * Reading this as: admin LMS operator console for assessment scoring, industrial green tokens via --admin-*.
 */
export function AdminScoreQuizLearnersPage(props: {
  assessmentId: string;
  /** The first page of learners, loaded by the server; the first browser load is skipped when present. */
  initialLearners?: ReportInitialData<ScoreLearnersPayload> | null;
}) {
  const report = useScoreQuizLearners(props);
  const {
    assessment,
    assessmentId,
    attemptsFilter,
    attemptsTotalCount,
    backHref,
    busy,
    courseTitle,
    debouncedSearch,
    drawerMode,
    drawerOpen,
    error,
    filterChips,
    formatCount,
    handleRegrade,
    loadLearners,
    loading,
    parsedMaxScore,
    parsedMinScore,
    regradeOpen,
    resultStatus,
    selectedAttemptIds,
    selectedMembershipIds,
    setDrawerOpen,
    setRegradeOpen,
    setTab,
    submittedFrom,
    submittedTo,
    summary,
    tab,
    title,
    totalCount,
    view,
  } = report;

  if (loading && !assessment && !error) {
    return (
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-24">
        <ProgressScoreReportTabs active="scores" />
        <PageSkeleton />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8 pb-24">
      <ProgressScoreReportTabs active="scores" />

      <nav
        className="flex items-center gap-2 overflow-x-auto whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-[var(--admin-on-surface-variant)]"
        aria-label="Breadcrumb"
      >
        <Link href="/admin/reports/progress-score" className="hover:text-[var(--admin-primary)]">
          Reports
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <Link
          href="/admin/reports/progress-score/scores"
          className="hover:text-[var(--admin-primary)]"
        >
          Progress & Score
        </Link>
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <Link href={backHref} className="hover:text-[var(--admin-primary)]">
          Scores
        </Link>
        {assessment?.productTitle ? (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <Link
              href={backHref}
              className="max-w-[160px] truncate hover:text-[var(--admin-primary)]"
            >
              {assessment.productTitle}
            </Link>
          </>
        ) : null}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate text-[var(--admin-on-surface)]">{title}</span>
      </nav>

      <ScoreQuizHeader report={report} />

      {error ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[var(--admin-border)] bg-[color-mix(in_srgb,var(--admin-danger)_10%,var(--admin-surface))] px-4 py-3">
          <div className="flex items-center gap-2 text-[var(--admin-danger)]">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            type="button"
            className={ghostButtonClassName}
            onClick={() => void loadLearners()}
          >
            Retry
          </button>
        </div>
      ) : null}

      <ScoreQuizSummary report={report} />

      <div className="flex gap-8 border-b border-[var(--admin-border)]" role="tablist">
        {(
          [
            {
              id: "learners" as const,
              label: `Learners (${formatCount(summary?.learnerCount ?? totalCount)})`,
            },
            { id: "items" as const, label: "Item analysis" },
            {
              id: "attempts" as const,
              label: `Attempts (${formatCount(summary?.attemptCount ?? attemptsTotalCount)})`,
            },
          ] as const
        ).map((entry) => (
          <button
            key={entry.id}
            type="button"
            role="tab"
            aria-selected={tab === entry.id}
            className={[
              "pb-3 font-mono text-[12px] uppercase tracking-[0.1em] transition-colors",
              tab === entry.id
                ? "border-b-2 border-[var(--admin-primary)] text-[var(--admin-primary)]"
                : "text-[var(--admin-on-surface-variant)] hover:text-[var(--admin-on-surface)]",
            ].join(" ")}
            onClick={() => {
              setTab(entry.id);
            }}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <ScoreQuizLearnersTab report={report} />

      <ScoreQuizItemsTab report={report} />

      <ScoreQuizAttemptsTab report={report} />

      <RegradeModal
        open={regradeOpen}
        assessmentTitle={title}
        selectedCount={selectedAttemptIds.length || selectedMembershipIds.length}
        answerKeyVersion="current"
        busy={busy}
        onClose={() => {
          setRegradeOpen(false);
        }}
        onConfirm={(args) => void handleRegrade(args)}
      />

      <CohortActionsDrawer
        open={drawerOpen}
        initialMode={drawerMode}
        audience={{
          sourceKind: "scores",
          assessmentId,
          assessmentTitle: title,
          productTitle: assessment?.productTitle ?? courseTitle,
          matchCount: selectedMembershipIds.length > 0 ? selectedMembershipIds.length : totalCount,
          ...(selectedMembershipIds.length > 0 ? { membershipIds: selectedMembershipIds } : {}),
          filterChips,
          suggestedGroupName: `${view !== "all" ? view.replace(/_/g, " ") : "Cohort"} — ${title}`,
          audienceFilters: {
            ...(debouncedSearch ? { learnerName: debouncedSearch } : {}),
            ...(resultStatus ? { resultStatus } : {}),
            ...(parsedMinScore != null ? { minScore: parsedMinScore } : {}),
            ...(parsedMaxScore != null ? { maxScore: parsedMaxScore } : {}),
            ...(attemptsFilter !== "any" ? { attemptsFilter } : {}),
            ...(view !== "all" ? { view } : {}),
            ...(dateInputToStartIso(submittedFrom)
              ? { submittedFrom: dateInputToStartIso(submittedFrom) }
              : {}),
            ...(dateInputToEndIso(submittedTo)
              ? { submittedTo: dateInputToEndIso(submittedTo) }
              : {}),
          },
        }}
        onClose={() => {
          setDrawerOpen(false);
        }}
        onSuccess={() => void loadLearners()}
      />
    </div>
  );
}
