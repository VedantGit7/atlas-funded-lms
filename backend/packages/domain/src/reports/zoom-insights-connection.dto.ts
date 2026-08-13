import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import { zoomConnectionMetaSchema } from "./zoom-insights-roster.dto";

export const ZOOM_DEFAULT_SCOPES = ["meeting:read", "user:read", "report:read"] as const;

export const zoomSyncRunStatusSchema = z.enum(["completed", "partial", "failed", "running"]);

export const zoomSyncTriggerSchema = z.enum(["manual", "scheduled", "webhook", "backfill"]);

export const zoomSyncRunSchema = z
  .object({
    id: z.uuid(),
    trigger: zoomSyncTriggerSchema,
    status: zoomSyncRunStatusSchema,
    startedAt: z.iso.datetime(),
    finishedAt: z.iso.datetime().nullable(),
    meetingsCount: z.number().int().nonnegative(),
    participantsCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    errorMessage: z.string().nullable(),
    logLines: z.array(z.string()),
  })
  .strict();

export const zoomSyncPulseCellSchema = z
  .object({
    index: z.number().int().nonnegative(),
    status: z.enum(["success", "partial", "failed", "none"]),
    runId: z.uuid().nullable(),
  })
  .strict();

export const zoomWebhookEventSchema = z
  .object({
    id: z.uuid(),
    eventType: z.string(),
    topic: z.string().nullable(),
    statusCode: z.number().int(),
    receivedAt: z.iso.datetime(),
  })
  .strict();

export const zoomConnectionDetailSchema = z
  .object({
    connection: zoomConnectionMetaSchema.extend({
      id: z.uuid().nullable(),
      accountId: z.string().nullable(),
      accountName: z.string().nullable(),
      accountEmail: z.string().nullable(),
      appId: z.string().nullable(),
      scopes: z.array(z.string()),
      tokenExpiresAt: z.iso.datetime().nullable(),
      disconnectedAt: z.iso.datetime().nullable(),
      scheduleEnabled: z.boolean(),
      scheduleIntervalMinutes: z.number().int().positive(),
      nextRunAt: z.iso.datetime().nullable(),
      nextRunInSeconds: z.number().int().nonnegative().nullable(),
      coverageGapCount: z.number().int().nonnegative(),
      meetingsImported: z.number().int().nonnegative(),
      webhookEndpoint: z.string(),
      webhookSecretMasked: z.string().nullable(),
      hasWebhookSecret: z.boolean(),
    }),
    syncPulse: z.array(zoomSyncPulseCellSchema),
    syncRuns: z.array(zoomSyncRunSchema),
    webhookEvents: z.array(zoomWebhookEventSchema),
    lastWebhookAt: z.iso.datetime().nullable(),
  })
  .strict();

export const zoomConnectionDetailResponseSchema = z.object({
  data: zoomConnectionDetailSchema,
});

export const zoomConnectionSyncBodySchema = rejectClientTenantFields.extend({}).strict();

export const zoomConnectionSyncResponseSchema = z.object({
  data: z.object({
    run: zoomSyncRunSchema,
    connection: zoomConnectionMetaSchema,
  }),
});

export const zoomConnectionBackfillBodySchema = rejectClientTenantFields
  .extend({
    rangeFrom: z.iso.datetime(),
    rangeTo: z.iso.datetime(),
    skipAlreadyImported: z.boolean().default(true),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (new Date(value.rangeFrom).getTime() > new Date(value.rangeTo).getTime()) {
      ctx.addIssue({
        code: "custom",
        message: "rangeFrom must be on or before rangeTo.",
        path: ["rangeFrom"],
      });
    }
  });

export type ZoomConnectionBackfillBody = z.output<typeof zoomConnectionBackfillBodySchema>;

export const zoomConnectionBackfillEstimateQuerySchema = rejectClientTenantFields
  .extend({
    rangeFrom: z.iso.datetime(),
    rangeTo: z.iso.datetime(),
  })
  .strict();

export const zoomConnectionBackfillEstimateResponseSchema = z.object({
  data: z.object({
    estimatedMeetings: z.number().int().nonnegative(),
    estimatedParticipants: z.number().int().nonnegative(),
  }),
});

export const zoomConnectionBackfillResponseSchema = z.object({
  data: z.object({
    run: zoomSyncRunSchema,
    estimatedMeetings: z.number().int().nonnegative(),
    estimatedParticipants: z.number().int().nonnegative(),
  }),
});

export const zoomConnectionDisconnectBodySchema = rejectClientTenantFields
  .extend({
    confirmation: z.string().trim().min(1).max(320),
  })
  .strict();

export type ZoomConnectionDisconnectBody = z.output<typeof zoomConnectionDisconnectBodySchema>;

export const zoomConnectionDisconnectResponseSchema = z.object({
  data: z.object({
    status: z.literal("disconnected"),
    disconnectedAt: z.iso.datetime(),
  }),
});

export const zoomConnectionScheduleBodySchema = rejectClientTenantFields
  .extend({
    scheduleEnabled: z.boolean(),
    scheduleIntervalMinutes: z.number().int().min(5).max(1440).optional(),
  })
  .strict();

export type ZoomConnectionScheduleBody = z.output<typeof zoomConnectionScheduleBodySchema>;

export const zoomConnectionScheduleResponseSchema = z.object({
  data: z.object({
    scheduleEnabled: z.boolean(),
    scheduleIntervalMinutes: z.number().int().positive(),
    nextRunAt: z.iso.datetime().nullable(),
    nextRunInSeconds: z.number().int().nonnegative().nullable(),
  }),
});

export const zoomConnectionWebhookTestResponseSchema = z.object({
  data: z.object({
    event: zoomWebhookEventSchema,
  }),
});
