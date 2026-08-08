import { z } from "zod";
import { pageInfoSchema, rejectClientTenantFields } from "../shared/domain.dto";

export const captureDeviceSessionBodySchema = rejectClientTenantFields
  .extend({
    deviceFingerprint: z.string().max(256).optional(),
    userAgent: z.string().max(512).optional(),
    ipAddress: z.string().max(64).optional(),
    platform: z.string().max(64).optional(),
  })
  .strict();

export const listDeviceSessionsQuerySchema = rejectClientTenantFields
  .extend({
    cursor: z.string().uuid().optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    membershipId: z.string().uuid().optional(),
  })
  .strict();

export const deviceSessionDtoSchema = z
  .object({
    id: z.string().uuid(),
    membershipId: z.string().uuid(),
    deviceFingerprint: z.string().nullable(),
    userAgent: z.string().nullable(),
    ipAddress: z.string().nullable(),
    platform: z.string().nullable(),
    lastSeenAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const captureDeviceSessionResponseSchema = z.object({
  data: deviceSessionDtoSchema,
});

export const listDeviceSessionsResponseSchema = z.object({
  data: z.object({
    items: z.array(deviceSessionDtoSchema),
    pageInfo: pageInfoSchema,
  }),
});

export const deleteDeviceSessionsBodySchema = rejectClientTenantFields
  .extend({
    sessionIds: z.array(z.string().uuid()).min(1).max(200),
  })
  .strict();

export const deleteDeviceSessionsResponseSchema = z.object({
  data: z.object({
    deletedCount: z.number().int().nonnegative(),
  }),
});

export const forceSignOutBodySchema = rejectClientTenantFields
  .extend({
    membershipId: z.string().uuid(),
  })
  .strict();

export const forceSignOutResponseSchema = z.object({
  data: z.object({
    membershipId: z.string().uuid(),
    deletedCount: z.number().int().nonnegative(),
  }),
});
