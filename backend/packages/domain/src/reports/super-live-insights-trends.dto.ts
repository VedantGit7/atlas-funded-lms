import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const superLiveInsightsTrendsQuerySchema = rejectClientTenantFields
  .extend({
    startedFrom: z.iso.datetime(),
    startedTo: z.iso.datetime(),
    granularity: z.enum(["day", "week", "month"]).default("week"),
    breakDownBy: z.enum(["none", "course", "batch", "status"]).default("none"),
    courseId: z.uuid().optional(),
    batchId: z.uuid().optional(),
  })
  .strict();

export type SuperLiveInsightsTrendsQuery = z.output<typeof superLiveInsightsTrendsQuerySchema>;

const periodSegmentSchema = z.object({
  key: z.string(),
  label: z.string(),
  sessionCount: z.number().int().nonnegative(),
  attendedCount: z.number().int().nonnegative(),
  registeredCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  attendanceRate: z.number().nullable(),
});

const periodSchema = z.object({
  key: z.string(),
  label: z.string(),
  from: z.iso.datetime(),
  to: z.iso.datetime(),
  sessionCount: z.number().int().nonnegative(),
  attendedCount: z.number().int().nonnegative(),
  registeredCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  totalCount: z.number().int().nonnegative(),
  attendanceRate: z.number().nullable(),
  avgDurationSeconds: z.number().int().nullable(),
  hasSessions: z.boolean(),
  segments: z.array(periodSegmentSchema),
});

const rankedBreakdownSchema = z.object({
  id: z.string(),
  title: z.string(),
  sessionCount: z.number().int().nonnegative(),
  attendanceRate: z.number().nullable(),
  deltaVsTenantPts: z.number().nullable(),
  sparkline: z.array(z.number().nullable()),
});

const dayTimeCellSchema = z.object({
  dayIndex: z.number().int().min(0).max(6),
  bandIndex: z.number().int().min(0).max(3),
  dayLabel: z.string(),
  bandLabel: z.string(),
  sessionCount: z.number().int().nonnegative(),
  attendanceRate: z.number().nullable(),
});

export const superLiveInsightsTrendsResponseSchema = z
  .object({
    data: z.object({
      granularity: z.enum(["day", "week", "month"]),
      breakDownBy: z.enum(["none", "course", "batch", "status"]),
      range: z.object({
        from: z.iso.datetime(),
        to: z.iso.datetime(),
      }),
      summary: z.object({
        attendanceRate: z.number().nullable(),
        attendanceRateDeltaPts: z.number().nullable(),
        sessionCount: z.number().int().nonnegative(),
        sessionCountDelta: z.number().int().nullable(),
        totalAttended: z.number().int().nonnegative(),
        totalAttendedDelta: z.number().int().nullable(),
        avgDurationSeconds: z.number().int().nullable(),
        avgDurationSecondsDelta: z.number().int().nullable(),
        bestPeriod: z
          .object({
            label: z.string(),
            from: z.iso.datetime(),
            to: z.iso.datetime(),
            attendanceRate: z.number(),
          })
          .nullable(),
      }),
      periods: z.array(periodSchema),
      rangeAverageRate: z.number().nullable(),
      largestMovement: z
        .object({
          fromLabel: z.string(),
          toLabel: z.string(),
          deltaPts: z.number(),
          caption: z.string(),
        })
        .nullable(),
      compositionCaption: z.string().nullable(),
      dayTimeMatrix: z.object({
        days: z.array(z.string()),
        bands: z.array(z.string()),
        cells: z.array(dayTimeCellSchema),
        dayAverages: z.array(z.number().nullable()),
        bandAverages: z.array(z.number().nullable()),
        bestSlotCaption: z.string().nullable(),
        worstSlotCaption: z.string().nullable(),
        slotsRanked: z.array(
          z.object({
            dayLabel: z.string(),
            bandLabel: z.string(),
            sessionCount: z.number().int().nonnegative(),
            attendanceRate: z.number().nullable(),
          }),
        ),
      }),
      byCourse: z.array(rankedBreakdownSchema),
      byBatch: z.array(rankedBreakdownSchema),
    }),
  })
  .strict();

export type SuperLiveInsightsTrendsResponse = z.output<
  typeof superLiveInsightsTrendsResponseSchema
>;
