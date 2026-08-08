import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const createLiveSessionBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(512),
    courseId: z.string().uuid().optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).default("scheduled"),
    scheduledAt: z.string().datetime().optional(),
    metadataJson: z.record(z.unknown()).optional(),
  })
  .strict();

export const updateLiveSessionBodySchema = rejectClientTenantFields
  .extend({
    title: z.string().min(1).max(512).optional(),
    status: z.enum(["scheduled", "live", "ended", "cancelled"]).optional(),
    scheduledAt: z.string().datetime().nullable().optional(),
    startedAt: z.string().datetime().nullable().optional(),
    endedAt: z.string().datetime().nullable().optional(),
    metadataJson: z.record(z.unknown()).optional(),
  })
  .strict();

export const checkInAttendanceBodySchema = rejectClientTenantFields
  .extend({
    status: z.enum(["registered", "attended", "absent"]).default("attended"),
  })
  .strict();

export const liveSessionDtoSchema = z
  .object({
    id: z.string().uuid(),
    title: z.string(),
    courseId: z.string().uuid().nullable(),
    status: z.string(),
    scheduledAt: z.string().datetime().nullable(),
    startedAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    metadataJson: z.unknown().nullable(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const liveAttendanceDtoSchema = z
  .object({
    id: z.string().uuid(),
    liveSessionId: z.string().uuid(),
    membershipId: z.string().uuid(),
    status: z.string(),
    joinedAt: z.string().datetime().nullable(),
    leftAt: z.string().datetime().nullable(),
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
