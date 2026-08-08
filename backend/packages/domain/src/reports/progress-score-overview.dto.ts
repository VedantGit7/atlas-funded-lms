import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const PROGRESS_SCORE_OVERVIEW_WINDOWS = ["7d", "30d", "90d"] as const;
export type ProgressScoreOverviewWindow = (typeof PROGRESS_SCORE_OVERVIEW_WINDOWS)[number];

export const progressScoreOverviewQuerySchema = rejectClientTenantFields
  .extend({
    window: z.enum(PROGRESS_SCORE_OVERVIEW_WINDOWS).default("30d"),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
  })
  .strict();

export type ProgressScoreOverviewQuery = z.output<typeof progressScoreOverviewQuerySchema>;

export const progressScoreOverviewResponseSchema = z.object({
  data: z
    .object({
      windowLabel: z.string(),
      windowFrom: z.string().datetime(),
      windowTo: z.string().datetime(),
      previousWindowFrom: z.string().datetime(),
      previousWindowTo: z.string().datetime(),
      empty: z.boolean(),
      summary: z
        .object({
          averageCompletionPct: z.number().nullable(),
          averageCompletionDeltaPoints: z.number().nullable(),
          activeEnrolmentCount: z.number().int().nonnegative(),
          learnersAtRiskCount: z.number().int().nonnegative(),
          atRiskIdleDays: z.literal(14),
          assessmentPassRatePct: z.number().nullable(),
          assessmentAttemptCount: z.number().int().nonnegative(),
          awaitingGradingCount: z.number().int().nonnegative(),
        })
        .strict(),
      completionDistribution: z.array(
        z
          .object({
            key: z.enum(["not_started", "early", "in_progress", "nearly_done", "complete"]),
            label: z.string(),
            count: z.number().int().nonnegative(),
            sharePct: z.number().nonnegative(),
          })
          .strict(),
      ),
    })
    .strict(),
});

export type ProgressScoreOverviewResponse = z.output<typeof progressScoreOverviewResponseSchema>;
