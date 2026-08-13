import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const connectZoomBodySchema = rejectClientTenantFields
  .extend({
    accountId: z.string().max(128).optional(),
    accountName: z.string().trim().max(200).optional(),
    accountEmail: z.email().max(320).optional(),
    appId: z.string().max(128).optional(),
    accessTokenRef: z.string().max(256).optional(),
    refreshTokenRef: z.string().max(256).optional(),
  })
  .strict();

export const zoomWebhookBodySchema = z
  .object({
    externalMeetingId: z.string().min(1),
    topic: z.string().max(512).optional(),
    startedAt: z.iso.datetime().optional(),
    endedAt: z.iso.datetime().optional(),
    participants: z
      .array(
        z.object({
          externalUserId: z.string().optional(),
          displayName: z.string().optional(),
          email: z.email().max(320).optional(),
          joinTime: z.iso.datetime().optional(),
          leaveTime: z.iso.datetime().optional(),
          durationSeconds: z.number().int().min(0).optional(),
        }),
      )
      .optional(),
  })
  .strict();

export const zoomConnectionDtoSchema = z
  .object({
    id: z.uuid(),
    accountId: z.string().nullable(),
    status: z.string(),
    connectedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const zoomMeetingDtoSchema = z
  .object({
    id: z.uuid(),
    externalMeetingId: z.string(),
    topic: z.string().nullable(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
  })
  .strict();

export const connectZoomResponseSchema = z.object({ data: zoomConnectionDtoSchema });
export const listZoomMeetingsResponseSchema = z.object({
  data: z.object({ items: z.array(zoomMeetingDtoSchema) }),
});
export const zoomWebhookResponseSchema = z.object({
  data: z.object({ meetingId: z.uuid(), participantCount: z.number().int() }),
});
