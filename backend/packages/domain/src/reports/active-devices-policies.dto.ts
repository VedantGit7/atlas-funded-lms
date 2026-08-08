import { z } from "zod";
import { rejectClientTenantFields } from "../shared/domain.dto";

export const DEVICE_POLICY_ON_LIMIT = [
  "block",
  "sign_out_oldest",
  "allow_and_alert",
] as const;

export const DEVICE_POLICY_OVERRIDE_ON_LIMIT = [
  "inherit",
  ...DEVICE_POLICY_ON_LIMIT,
] as const;

export const DEVICE_POLICY_SCOPE_TYPES = ["role", "batch", "learner"] as const;

export const DEVICE_POLICY_IDLE_EXPIRY_DAYS = [7, 14, 30, 90] as const;

export const devicePolicyTenantDefaultsSchema = z
  .object({
    restrictionsEnabled: z.boolean(),
    devicesAllowed: z.number().int().min(1).max(10),
    restrictParallelLogins: z.boolean(),
    idleSessionExpiryDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90), z.null()]),
    onLimitReached: z.enum(DEVICE_POLICY_ON_LIMIT),
    requireReverificationOnNewDevice: z.boolean(),
    notifyLearnerOnNewDevice: z.boolean(),
    sharedFingerprintAlertEnabled: z.boolean(),
    sharedFingerprintThreshold: z.number().int().min(2).max(50),
  })
  .strict();

export type DevicePolicyTenantDefaults = z.output<typeof devicePolicyTenantDefaultsSchema>;

export const devicePolicyOverrideSchema = z
  .object({
    id: z.string().uuid(),
    scopeType: z.enum(DEVICE_POLICY_SCOPE_TYPES),
    scopeId: z.string().uuid(),
    scopeLabel: z.string(),
    devicesAllowed: z.number().int().min(1).max(99),
    onLimitReached: z.enum(DEVICE_POLICY_OVERRIDE_ON_LIMIT),
    appliesToCount: z.number().int().nonnegative(),
    updatedByLabel: z.string().nullable(),
    updatedAt: z.string().datetime(),
    expiresAt: z.string().datetime().nullable(),
  })
  .strict();

export type DevicePolicyOverrideItem = z.output<typeof devicePolicyOverrideSchema>;

export const deviceBlockedFingerprintSchema = z
  .object({
    id: z.string().uuid(),
    fingerprint: z.string(),
    fingerprintShort: z.string(),
    reason: z.string(),
    blockedAt: z.string().datetime(),
    blockedByLabel: z.string().nullable(),
  })
  .strict();

export type DeviceBlockedFingerprintItem = z.output<typeof deviceBlockedFingerprintSchema>;

export const activeDevicesPoliciesResponseSchema = z.object({
  data: z.object({
    tenantDefaults: devicePolicyTenantDefaultsSchema,
    overrides: z.array(devicePolicyOverrideSchema),
    blockedFingerprints: z.array(deviceBlockedFingerprintSchema),
    capabilities: z.object({
      canEditDefaults: z.boolean(),
      canManageOverrides: z.boolean(),
      canManageBlocks: z.boolean(),
      enforcementNote: z.string(),
    }),
  }),
});

export type ActiveDevicesPoliciesResponse = z.output<typeof activeDevicesPoliciesResponseSchema>;

export const updateActiveDevicesPoliciesBodySchema = rejectClientTenantFields
  .extend({
    restrictionsEnabled: z.boolean(),
    devicesAllowed: z.number().int().min(1).max(10),
    restrictParallelLogins: z.boolean(),
    idleSessionExpiryDays: z.union([z.literal(7), z.literal(14), z.literal(30), z.literal(90), z.null()]),
    onLimitReached: z.enum(DEVICE_POLICY_ON_LIMIT),
    requireReverificationOnNewDevice: z.boolean(),
    notifyLearnerOnNewDevice: z.boolean(),
    sharedFingerprintAlertEnabled: z.boolean(),
    sharedFingerprintThreshold: z.number().int().min(2).max(50),
  })
  .strict();

export type UpdateActiveDevicesPoliciesBody = z.output<typeof updateActiveDevicesPoliciesBodySchema>;

export const createDevicePolicyOverrideBodySchema = rejectClientTenantFields
  .extend({
    scopeType: z.enum(DEVICE_POLICY_SCOPE_TYPES),
    scopeId: z.string().uuid(),
    devicesAllowed: z.number().int().min(1).max(99),
    onLimitReached: z.enum(DEVICE_POLICY_OVERRIDE_ON_LIMIT).default("inherit"),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export type CreateDevicePolicyOverrideBody = z.output<typeof createDevicePolicyOverrideBodySchema>;

export const updateDevicePolicyOverrideBodySchema = rejectClientTenantFields
  .extend({
    devicesAllowed: z.number().int().min(1).max(99),
    onLimitReached: z.enum(DEVICE_POLICY_OVERRIDE_ON_LIMIT),
    expiresAt: z.string().datetime().nullable().optional(),
  })
  .strict();

export type UpdateDevicePolicyOverrideBody = z.output<typeof updateDevicePolicyOverrideBodySchema>;

export const devicePolicyOverrideParamsSchema = z
  .object({
    overrideId: z.string().uuid(),
  })
  .strict();

export const createBlockedFingerprintBodySchema = rejectClientTenantFields
  .extend({
    fingerprint: z.string().trim().min(4).max(256),
    reason: z.string().trim().min(1).max(200),
  })
  .strict();

export type CreateBlockedFingerprintBody = z.output<typeof createBlockedFingerprintBodySchema>;

export const blockedFingerprintParamsSchema = z
  .object({
    blockId: z.string().uuid(),
  })
  .strict();

export const devicePolicyTargetsQuerySchema = rejectClientTenantFields
  .extend({
    scopeType: z.enum(DEVICE_POLICY_SCOPE_TYPES),
    q: z.string().trim().max(120).optional().default(""),
    limit: z.coerce.number().int().min(1).max(50).default(20),
  })
  .strict();

export type DevicePolicyTargetsQuery = z.output<typeof devicePolicyTargetsQuerySchema>;

export const devicePolicyTargetsResponseSchema = z.object({
  data: z.object({
    items: z.array(
      z
        .object({
          id: z.string().uuid(),
          label: z.string(),
          secondary: z.string().nullable(),
        })
        .strict(),
    ),
  }),
});

export const devicePolicyMutationResponseSchema = z.object({
  data: z.object({
    ok: z.literal(true),
  }),
});

export const devicePolicyOverrideMutationResponseSchema = z.object({
  data: devicePolicyOverrideSchema,
});

export const deviceBlockedFingerprintMutationResponseSchema = z.object({
  data: deviceBlockedFingerprintSchema,
});
