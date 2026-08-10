import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

const uuidList = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => {
    const parts = Array.isArray(value)
      ? value
      : value
          .split(",")
          .map((part) => part.trim())
          .filter(Boolean);
    return [...new Set(parts)];
  })
  .pipe(z.array(z.string().uuid()).min(1).max(4));

export const superLiveInsightsCompareQuerySchema = rejectClientTenantFields
  .extend({
    mode: z.enum(["sessions", "series"]).default("sessions"),
    seriesKind: z.enum(["course", "batch"]).optional(),
    ids: uuidList,
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.mode === "series" && !value.seriesKind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "seriesKind is required when mode is series",
        path: ["seriesKind"],
      });
    }
  });

export type SuperLiveInsightsCompareQuery = z.output<typeof superLiveInsightsCompareQuerySchema>;

const metricsSchema = z.object({
  totalRecords: z.number().int().nonnegative(),
  attendedCount: z.number().int().nonnegative(),
  registeredCount: z.number().int().nonnegative(),
  absentCount: z.number().int().nonnegative(),
  attendanceRate: z.number().nullable(),
  avgDurationSeconds: z.number().int().nullable(),
  sessionDurationSeconds: z.number().int().nullable(),
  coveragePct: z.number().nullable(),
  startDelaySeconds: z.number().int().nullable(),
  scheduledSlot: z.string().nullable(),
  sessionsHeld: z.number().int().nonnegative().nullable(),
});

const itemSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  scheduledAt: z.string().datetime().nullable(),
  courseTitle: z.string().nullable(),
  batchName: z.string().nullable(),
  colorIndex: z.number().int().min(0).max(3),
  metrics: metricsSchema,
  composition: z.object({
    attendedCount: z.number().int().nonnegative(),
    registeredCount: z.number().int().nonnegative(),
    absentCount: z.number().int().nonnegative(),
    totalCount: z.number().int().nonnegative(),
  }),
  trend: z
    .array(
      z.object({
        index: z.number().int().nonnegative(),
        label: z.string(),
        attendanceRate: z.number().nullable(),
      }),
    )
    .optional(),
});

export const superLiveInsightsCompareResponseSchema = z
  .object({
    data: z.object({
      mode: z.enum(["sessions", "series"]),
      seriesKind: z.enum(["course", "batch"]).nullable(),
      items: z.array(itemSchema).min(1).max(4),
      tenantAverages: z.object({
        attendanceRate: z.number().nullable(),
        coveragePct: z.number().nullable(),
        avgDurationSeconds: z.number().int().nullable(),
      }),
      compositionCaption: z.string().nullable(),
    }),
  })
  .strict();

export type SuperLiveInsightsCompareResponse = z.output<
  typeof superLiveInsightsCompareResponseSchema
>;

export const superLiveInsightsCompareCandidatesQuerySchema = rejectClientTenantFields
  .extend({
    mode: z.enum(["sessions", "series"]).default("sessions"),
    seriesKind: z.enum(["course", "batch"]).optional(),
    q: z.string().trim().min(1).max(200).optional(),
    excludeIds: z
      .union([z.string(), z.array(z.string())])
      .optional()
      .transform((value) => {
        if (value == null) return [] as string[];
        const parts = Array.isArray(value)
          ? value
          : value
              .split(",")
              .map((part) => part.trim())
              .filter(Boolean);
        return [...new Set(parts)].filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id),
        );
      }),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type SuperLiveInsightsCompareCandidatesQuery = z.output<
  typeof superLiveInsightsCompareCandidatesQuerySchema
>;

export const superLiveInsightsCompareCandidatesResponseSchema = z
  .object({
    data: z.object({
      items: z.array(
        z.object({
          id: z.string(),
          title: z.string(),
          subtitle: z.string().nullable(),
          groupLabel: z.string().nullable(),
          scheduledAt: z.string().datetime().nullable(),
          attendanceRate: z.number().nullable(),
          sessionCount: z.number().int().nonnegative().nullable(),
        }),
      ),
    }),
  })
  .strict();
