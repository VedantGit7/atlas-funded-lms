import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const connectZoomBodySchema = rejectClientTenantFields
  .extend({
    accountId: z.string().max(128).optional(),
    accessTokenRef: z.string().max(256).optional(),
    refreshTokenRef: z.string().max(256).optional(),
  })
  .strict();

export const zoomWebhookBodySchema = z
  .object({
    externalMeetingId: z.string().min(1),
    topic: z.string().max(512).optional(),
    startedAt: z.string().datetime().optional(),
    endedAt: z.string().datetime().optional(),
    participants: z
      .array(
        z.object({
          externalUserId: z.string().optional(),
          displayName: z.string().optional(),
          joinTime: z.string().datetime().optional(),
          leaveTime: z.string().datetime().optional(),
          durationSeconds: z.number().int().min(0).optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const zoomConnectionDtoSchema = z
  .object({
    id: z.string().uuid(),
    accountId: z.string().nullable(),
    status: z.string(),
    connectedAt: z.string().datetime().nullable(),
  })
  .strict();

export const zoomMeetingDtoSchema = z
  .object({
    id: z.string().uuid(),
    externalMeetingId: z.string(),
    topic: z.string().nullable(),
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
  })
  .strict();

export const connectZoomResponseSchema = z.object({ data: zoomConnectionDtoSchema });
export const listZoomMeetingsResponseSchema = z.object({
  data: z.object({ items: z.array(zoomMeetingDtoSchema) }),
});
export const zoomWebhookResponseSchema = z.object({
  data: z.object({ meetingId: z.string().uuid(), participantCount: z.number().int() }),
});
