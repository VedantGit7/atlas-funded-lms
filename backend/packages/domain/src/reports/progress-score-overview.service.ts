import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  progressScoreOverviewQuerySchema,
  progressScoreOverviewResponseSchema,
  type ProgressScoreOverviewQuery,
} from "./progress-score-overview.dto";
import { progressScoreRosterRepository } from "./progress-score-roster.repository";

const BAND_META = [
  { key: "not_started" as const, label: "Not started" },
  { key: "early" as const, label: "Early" },
  { key: "in_progress" as const, label: "In progress" },
  { key: "nearly_done" as const, label: "Nearly done" },
  { key: "complete" as const, label: "Complete" },
];

function resolveWindow(query: ProgressScoreOverviewQuery): {
  windowFrom: Date;
  windowTo: Date;
  previousFrom: Date;
  previousTo: Date;
  windowLabel: string;
} {
  const windowTo = query.to ? new Date(query.to) : new Date();
  let days = 30;
  let windowLabel = "Last 30 days";
  if (query.from && query.to) {
    const from = new Date(query.from);
    const ms = Math.max(0, windowTo.getTime() - from.getTime());
    days = Math.max(1, Math.round(ms / (24 * 60 * 60 * 1000)));
    windowLabel = `${from.toLocaleDateString()} – ${windowTo.toLocaleDateString()}`;
    const windowFrom = from;
    const previousTo = new Date(windowFrom.getTime() - 1);
    const previousFrom = new Date(previousTo.getTime() - days * 24 * 60 * 60 * 1000);
    return { windowFrom, windowTo, previousFrom, previousTo, windowLabel };
  }
  if (query.window === "7d") {
    days = 7;
    windowLabel = "Last 7 days";
  } else if (query.window === "90d") {
    days = 90;
    windowLabel = "Last 90 days";
  }
  const windowFrom = new Date(windowTo.getTime() - days * 24 * 60 * 60 * 1000);
  const previousTo = new Date(windowFrom.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - days * 24 * 60 * 60 * 1000);
  return { windowFrom, windowTo, previousFrom, previousTo, windowLabel };
}

export async function getProgressScoreOverview(tx: TenantTx, _ctx: ServiceCtx, rawQuery: unknown) {
  const query = progressScoreOverviewQuerySchema.parse(rawQuery);
  const { windowFrom, windowTo, previousFrom, previousTo, windowLabel } = resolveWindow(query);

  const signals = await progressScoreRosterRepository.getOverviewSignals(tx, {
    windowFrom,
    windowTo,
    previousFrom,
    previousTo,
  });

  const delta =
    signals.averageCompletionPct != null && signals.previousAverageCompletionPct != null
      ? Math.round((signals.averageCompletionPct - signals.previousAverageCompletionPct) * 10) / 10
      : null;

  const bandTotal =
    signals.completionBands.not_started +
    signals.completionBands.early +
    signals.completionBands.in_progress +
    signals.completionBands.nearly_done +
    signals.completionBands.complete;

  const empty =
    signals.activeEnrolmentCount === 0 &&
    signals.enrolmentActivityCount === 0 &&
    signals.assessmentAttemptCount === 0;

  return progressScoreOverviewResponseSchema.parse({
    data: {
      windowLabel,
      windowFrom: windowFrom.toISOString(),
      windowTo: windowTo.toISOString(),
      previousWindowFrom: previousFrom.toISOString(),
      previousWindowTo: previousTo.toISOString(),
      empty,
      summary: {
        averageCompletionPct: signals.averageCompletionPct,
        averageCompletionDeltaPoints: delta,
        activeEnrolmentCount: signals.activeEnrolmentCount,
        learnersAtRiskCount: signals.learnersAtRiskCount,
        atRiskIdleDays: 14,
        assessmentPassRatePct: signals.assessmentPassRatePct,
        assessmentAttemptCount: signals.assessmentAttemptCount,
        awaitingGradingCount: signals.awaitingGradingCount,
      },
      completionDistribution: BAND_META.map((band) => {
        const count = signals.completionBands[band.key];
        return {
          key: band.key,
          label: band.label,
          count,
          sharePct: bandTotal > 0 ? Math.round((count / bandTotal) * 1000) / 10 : 0,
        };
      }),
    },
  });
}
