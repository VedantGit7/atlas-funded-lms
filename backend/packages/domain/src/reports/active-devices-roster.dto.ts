import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";
import {
  deleteDeviceSessionsBodySchema,
  deleteDeviceSessionsResponseSchema,
  deviceSessionDtoSchema,
  forceSignOutBodySchema,
  forceSignOutResponseSchema,
} from "../devices/devices.dto";

export const activeDevicesRosterQuerySchema = rejectClientTenantFields
  .extend({
    email: z.string().trim().min(1).max(320).optional(),
    platform: z.string().trim().min(1).max(64).optional(),
    window: z.enum(["24h", "7d", "30d", "all"]).default("7d"),
    view: z.enum(["all", "attention", "suspicious"]).default("all"),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ActiveDevicesRosterQuery = z.output<typeof activeDevicesRosterQuerySchema>;

export const ACTIVE_DEVICES_WINDOWS = ["24h", "7d", "30d", "all"] as const;
export const ACTIVE_DEVICES_VIEWS = ["all", "attention", "suspicious"] as const;

export const activeDevicesOverviewQuerySchema = rejectClientTenantFields
  .extend({
    window: z.enum(ACTIVE_DEVICES_WINDOWS).default("7d"),
    email: z.string().trim().min(1).max(320).optional(),
    platform: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export type ActiveDevicesOverviewQuery = z.output<typeof activeDevicesOverviewQuerySchema>;

export const activeDevicesOverviewResponseSchema = z.object({
  data: z.object({
    summary: z.object({
      activeDevicesCount: z.number().int().nonnegative(),
      previousPeriodCount: z.number().int().nonnegative(),
      changeCount: z.number().int(),
      learnersSignedIn: z.number().int().nonnegative(),
      overDeviceLimit: z.number().int().nonnegative(),
      flaggedSessions: z.number().int().nonnegative(),
      deviceLimitPolicy: z.number().int().positive(),
      restrictionsEnabled: z.boolean(),
      windowLabel: z.string(),
      windowFrom: z.iso.datetime().nullable(),
      windowTo: z.iso.datetime(),
    }),
    trend: z.array(
      z.object({
        date: z.string(),
        activeDevices: z.number().int().nonnegative(),
        learnersSignedIn: z.number().int().nonnegative(),
      }),
    ),
  }),
});

export const activeDevicesLearnerSchema = z
  .object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    deviceCount: z.number().int().nonnegative(),
    lastSeenAt: z.iso.datetime().nullable(),
    platforms: z.array(z.string()),
    ipAddresses: z.array(z.string()),
    status: z.enum(["active", "over_limit"]),
  })
  .strict();

export const activeDevicesRosterPageInfoSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
  totalCount: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
  hasNextPage: z.boolean(),
  hasPreviousPage: z.boolean(),
});

export const activeDevicesRosterListResponseSchema = z.object({
  data: z.object({
    items: z.array(activeDevicesLearnerSchema),
    pageInfo: activeDevicesRosterPageInfoSchema,
  }),
});

export const activeDevicesLearnerParamsSchema = z
  .object({
    membershipId: z.uuid(),
  })
  .strict();

export const activeDevicesDetailDeviceStatusSchema = z.enum([
  "current",
  "active",
  "idle",
  "flagged",
]);

export const activeDevicesDetailDeviceSchema = deviceSessionDtoSchema.extend({
  shortId: z.string(),
  deviceLabel: z.string(),
  browserLabel: z.string().nullable(),
  osLabel: z.string().nullable(),
  status: activeDevicesDetailDeviceStatusSchema,
  isCurrent: z.boolean(),
});

export const activeDevicesRiskSignalStatusSchema = z.enum(["pass", "warn", "fail"]);

export const activeDevicesRiskSignalSchema = z
  .object({
    key: z.enum(["concurrent_locations", "device_count", "recognised_devices", "no_shared_ip"]),
    label: z.string(),
    status: activeDevicesRiskSignalStatusSchema,
    detail: z.string().nullable(),
  })
  .strict();

export const activeDevicesActivityEventSchema = z
  .object({
    id: z.string(),
    at: z.iso.datetime(),
    kind: z.enum(["signed_in", "last_seen", "over_limit"]),
    label: z.string(),
    detail: z.string().nullable(),
    severity: z.enum(["neutral", "warning", "danger"]),
  })
  .strict();

export const activeDevicesLearnerDetailResponseSchema = z.object({
  data: z.object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    roleLabel: z.string(),
    summary: z.object({
      activeDevices: z.number().int().nonnegative(),
      deviceLimit: z.number().int().positive(),
      overLimit: z.boolean(),
      firstSeenAt: z.iso.datetime().nullable(),
      lastActivityAt: z.iso.datetime().nullable(),
      distinctIpCount: z.number().int().nonnegative(),
      flagSummary: z.string().nullable(),
    }),
    policy: z.object({
      deviceLimit: z.number().int().positive(),
      restrictionsEnabled: z.boolean(),
      source: z.literal("tenant_default"),
      enforcementNote: z.string(),
    }),
    riskSignals: z.array(activeDevicesRiskSignalSchema),
    recentActivity: z.array(activeDevicesActivityEventSchema),
    devices: z.array(activeDevicesDetailDeviceSchema),
  }),
});

export const activeDevicesSessionParamsSchema = z
  .object({
    membershipId: z.uuid(),
    deviceId: z.uuid(),
  })
  .strict();

export const activeDevicesSessionHeatHourSchema = z
  .object({
    hour: z.number().int().min(0).max(23),
    label: z.string(),
    level: z.enum(["none", "low", "mid", "high", "current"]),
    detail: z.string(),
  })
  .strict();

export const activeDevicesSessionActivitySchema = z
  .object({
    id: z.string(),
    at: z.iso.datetime(),
    label: z.string(),
    detail: z.string().nullable(),
    result: z.enum(["ok", "flagged", "info"]),
    ipAddress: z.string().nullable(),
  })
  .strict();

export const activeDevicesSessionDetailResponseSchema = z.object({
  data: z.object({
    membershipId: z.uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    roleLabel: z.string(),
    device: activeDevicesDetailDeviceSchema.extend({
      sessionAgeLabel: z.string(),
      heartbeatStatus: z.enum(["polling", "idle", "stale"]),
      fingerprintShareCount: z.number().int().nonnegative(),
    }),
    network: z.object({
      ipAddress: z.string().nullable(),
      geoAvailable: z.literal(false),
      note: z.string(),
    }),
    client: z.object({
      platform: z.string().nullable(),
      osLabel: z.string().nullable(),
      browserLabel: z.string().nullable(),
      userAgent: z.string().nullable(),
    }),
    fingerprintPayload: z.record(z.string(), z.unknown()),
    heatstrip: z.array(activeDevicesSessionHeatHourSchema).length(24),
    recentActivity: z.array(activeDevicesSessionActivitySchema),
    capabilities: z.object({
      canRevoke: z.boolean(),
      trustedDevicesSupported: z.literal(false),
      requestTelemetrySupported: z.literal(false),
    }),
  }),
});

export {
  deleteDeviceSessionsBodySchema,
  deleteDeviceSessionsResponseSchema,
  forceSignOutBodySchema,
  forceSignOutResponseSchema,
};
