import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const DEVICE_ALERT_TYPES = [
  "concurrent_sessions",
  "device_limit_exceeded",
  "shared_fingerprint",
] as const;

export const DEVICE_ALERT_STATUSES = ["open", "resolved", "dismissed"] as const;
export const DEVICE_ALERT_SEVERITIES = ["critical", "warn", "info"] as const;

export const activeDevicesAlertsQuerySchema = rejectClientTenantFields
  .extend({
    status: z.enum(DEVICE_ALERT_STATUSES).default("open"),
    type: z.enum(DEVICE_ALERT_TYPES).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(50),
    page: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .strict();

export type ActiveDevicesAlertsQuery = z.output<typeof activeDevicesAlertsQuerySchema>;

export const activeDevicesAlertSessionSchema = z
  .object({
    id: z.string().uuid(),
    deviceLabel: z.string(),
    shortId: z.string(),
    ipAddress: z.string().nullable(),
    platform: z.string().nullable(),
    lastSeenAt: z.string().datetime(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const activeDevicesAlertNoteSchema = z
  .object({
    id: z.string(),
    body: z.string(),
    createdAt: z.string().datetime(),
    authorMembershipId: z.string().uuid().nullable(),
    authorLabel: z.string().nullable(),
  })
  .strict();

export const activeDevicesAlertListItemSchema = z
  .object({
    id: z.string().uuid(),
    alertKey: z.string(),
    alertType: z.enum(DEVICE_ALERT_TYPES),
    severity: z.enum(DEVICE_ALERT_SEVERITIES),
    status: z.enum(DEVICE_ALERT_STATUSES),
    title: z.string(),
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    detectedAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    evidenceSummary: z.array(z.string()),
    sessionCount: z.number().int().nonnegative(),
  })
  .strict();

export const activeDevicesAlertsSummarySchema = z
  .object({
    openTotal: z.number().int().nonnegative(),
    byType: z.object({
      concurrent_sessions: z.number().int().nonnegative(),
      device_limit_exceeded: z.number().int().nonnegative(),
      shared_fingerprint: z.number().int().nonnegative(),
    }),
    resolvedCount: z.number().int().nonnegative(),
    dismissedCount: z.number().int().nonnegative(),
    unsupportedRules: z.array(
      z.object({
        key: z.string(),
        label: z.string(),
        reason: z.string(),
      }),
    ),
  })
  .strict();

export const activeDevicesAlertsListResponseSchema = z.object({
  data: z.object({
    items: z.array(activeDevicesAlertListItemSchema),
    summary: activeDevicesAlertsSummarySchema,
    pageInfo: z.object({
      page: z.number().int().positive(),
      pageSize: z.number().int().positive(),
      totalCount: z.number().int().nonnegative(),
      totalPages: z.number().int().nonnegative(),
      hasNextPage: z.boolean(),
      hasPreviousPage: z.boolean(),
    }),
  }),
});

export const activeDevicesAlertParamsSchema = z
  .object({
    alertId: z.string().uuid(),
  })
  .strict();

export const activeDevicesAlertDetailResponseSchema = z.object({
  data: z.object({
    id: z.string().uuid(),
    alertKey: z.string(),
    alertType: z.enum(DEVICE_ALERT_TYPES),
    severity: z.enum(DEVICE_ALERT_SEVERITIES),
    status: z.enum(DEVICE_ALERT_STATUSES),
    title: z.string(),
    membershipId: z.string().uuid(),
    learnerName: z.string().nullable(),
    email: z.string().nullable(),
    detectedAt: z.string().datetime(),
    resolvedAt: z.string().datetime().nullable(),
    ruleLabel: z.string(),
    thresholdLabel: z.string(),
    evidence: z.record(z.string(), z.unknown()),
    sessions: z.array(activeDevicesAlertSessionSchema),
    notes: z.array(activeDevicesAlertNoteSchema),
    capabilities: z.object({
      canResolve: z.boolean(),
      canDismiss: z.boolean(),
      canRevokeSessions: z.boolean(),
      geoAvailable: z.literal(false),
    }),
  }),
});

export const activeDevicesAlertActionBodySchema = rejectClientTenantFields
  .extend({
    alertIds: z.array(z.string().uuid()).min(1).max(100),
  })
  .strict();

export const activeDevicesAlertActionResponseSchema = z.object({
  data: z.object({
    updatedCount: z.number().int().nonnegative(),
  }),
});

export const activeDevicesAlertNoteBodySchema = rejectClientTenantFields
  .extend({
    body: z.string().trim().min(1).max(2000),
  })
  .strict();

export const activeDevicesAlertNoteResponseSchema = z.object({
  data: activeDevicesAlertNoteSchema,
});
