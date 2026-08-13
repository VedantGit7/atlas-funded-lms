import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const createLiveSessionBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(512),
    courseId: z.uuid().optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).default("scheduled"),
    scheduledAt: z.iso.datetime().optional(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const updateLiveSessionBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(512).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    scheduledAt: z.iso.datetime().nullable().optional(),
    startedAt: z.iso.datetime().nullable().optional(),
    endedAt: z.iso.datetime().nullable().optional(),
    metadataJson: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

export const checkInAttendanceBodySchema = rejectClientTenantFields
  .extend({
    status: z.enum(["registered", "attended", "absent"]).default("attended"),
  })
  .strict();

export const liveSessionDtoSchema = z
  .object({
    id: z.uuid(),
    title: z.string(),
    courseId: z.uuid().nullable(),
    status: z.string(),
    scheduledAt: z.iso.datetime().nullable(),
    startedAt: z.iso.datetime().nullable(),
    endedAt: z.iso.datetime().nullable(),
    metadataJson: z.unknown().nullable(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export const liveAttendanceDtoSchema = z
  .object({
    id: z.uuid(),
    liveSessionId: z.uuid(),
    membershipId: z.uuid(),
    status: z.string(),
    joinedAt: z.iso.datetime().nullable(),
    leftAt: z.iso.datetime().nullable(),
    durationSeconds: z.number().int().nullable(),
  })
  .strict();

export const liveSessionResponseSchema = z.object({ data: liveSessionDtoSchema });
export const liveSessionListResponseSchema = z.object({
  data: z.object({ items: z.array(liveSessionDtoSchema) }),
});
export const liveAttendanceListResponseSchema = z.object({
  data: z.object({ items: z.array(liveAttendanceDtoSchema) }),
});
export const checkInAttendanceResponseSchema = z.object({ data: liveAttendanceDtoSchema });
