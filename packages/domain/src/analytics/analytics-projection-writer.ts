import type { TenantTx } from "@atlas/db";
import type { AnalyticsProjectionMutation } from "./analytics.types";
import { analyticsRepository } from "./analytics.repository";
import { ITEM_STATISTICS_WINDOW_KEYS } from "./analytics-definition-registry";

export async function applyAnalyticsProjectionMutations(
  tx: TenantTx,
  mutations: AnalyticsProjectionMutation[],
): Promise<void> {
  for (const mutation of mutations) {
    if (mutation.kind === "rollup") {
      await analyticsRepository.incrementRollupCount(tx, {
        rollupKey: mutation.rollupKey,
        subject: mutation.subject,
        periodStart: mutation.periodStart,
        periodEnd: mutation.periodEnd,
        countDelta: mutation.metricDelta.count,
      });
      continue;
    }

    if (mutation.kind === "funnel") {
      await analyticsRepository.incrementFunnelStageCount(tx, {
        funnelKey: mutation.funnelKey,
        stageKey: mutation.stageKey,
        day: mutation.day,
        countDelta: mutation.countDelta,
      });
      continue;
    }

    for (const windowKey of ITEM_STATISTICS_WINDOW_KEYS) {
      await analyticsRepository.incrementItemStatistic(tx, {
        itemId: mutation.itemId,
        windowKey,
        attemptsDelta: mutation.attemptsDelta,
        correctDelta: mutation.correctDelta,
        latencyMs: mutation.latencyMs,
      });
    }
  }
}
