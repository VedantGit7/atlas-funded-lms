import { describe, expect, it } from "vitest";
import {
  activeDevicesPoliciesResponseSchema,
  createBlockedFingerprintBodySchema,
  createDevicePolicyOverrideBodySchema,
  devicePolicyTargetsQuerySchema,
  updateActiveDevicesPoliciesBodySchema,
} from "@atlas/domain/reports/active-devices-policies.dto";
import { mapTenantDefaults } from "@atlas/domain/reports/active-devices-policies.repository";

describe("active devices policies dto", () => {
  it("maps tenant defaults with safe fallbacks", () => {
    const defaults = mapTenantDefaults({
      deviceRestrictionsEnabled: true,
      deviceRegistrationLimit: 3,
      restrictParallelLogins: true,
      deviceIdleSessionExpiryDays: 30,
      deviceOnLimitReached: "sign_out_oldest",
      deviceRequireReverificationOnNewDevice: true,
      deviceNotifyLearnerOnNewDevice: false,
      deviceSharedFingerprintAlertEnabled: true,
      deviceSharedFingerprintThreshold: 3,
    });
    expect(defaults.devicesAllowed).toBe(3);
    expect(defaults.onLimitReached).toBe("sign_out_oldest");
    expect(defaults.sharedFingerprintThreshold).toBe(3);
    expect(defaults.notifyLearnerOnNewDevice).toBe(false);
  });

  it("parses policies response shape", () => {
    const response = activeDevicesPoliciesResponseSchema.parse({
      data: {
        tenantDefaults: {
          restrictionsEnabled: true,
          devicesAllowed: 3,
          restrictParallelLogins: false,
          idleSessionExpiryDays: 30,
          onLimitReached: "block",
          requireReverificationOnNewDevice: true,
          notifyLearnerOnNewDevice: true,
          sharedFingerprintAlertEnabled: true,
          sharedFingerprintThreshold: 2,
        },
        overrides: [
          {
            id: "11111111-1111-4111-8111-111111111111",
            scopeType: "role",
            scopeId: "22222222-2222-4222-8222-222222222222",
            scopeLabel: "Instructors",
            devicesAllowed: 8,
            onLimitReached: "inherit",
            appliesToCount: 24,
            updatedByLabel: "System",
            updatedAt: "2026-08-04T12:00:00.000Z",
            expiresAt: null,
          },
        ],
        blockedFingerprints: [],
        capabilities: {
          canEditDefaults: true,
          canManageOverrides: true,
          canManageBlocks: true,
          enforcementNote: "note",
        },
      },
    });
    expect(response.data.overrides).toHaveLength(1);
    expect(response.data.tenantDefaults.idleSessionExpiryDays).toBe(30);
  });

  it("parses update and mutation bodies", () => {
    const update = updateActiveDevicesPoliciesBodySchema.parse({
      restrictionsEnabled: true,
      devicesAllowed: 2,
      restrictParallelLogins: true,
      idleSessionExpiryDays: null,
      onLimitReached: "allow_and_alert",
      requireReverificationOnNewDevice: false,
      notifyLearnerOnNewDevice: true,
      sharedFingerprintAlertEnabled: true,
      sharedFingerprintThreshold: 4,
    });
    expect(update.idleSessionExpiryDays).toBeNull();

    const override = createDevicePolicyOverrideBodySchema.parse({
      scopeType: "batch",
      scopeId: "33333333-3333-4333-8333-333333333333",
      devicesAllowed: 5,
    });
    expect(override.onLimitReached).toBe("inherit");

    const block = createBlockedFingerprintBodySchema.parse({
      fingerprint: "e4d909c290d0fb1ca068ffaddf22cbd0",
      reason: "Manual block",
    });
    expect(block.reason).toBe("Manual block");

    const targets = devicePolicyTargetsQuerySchema.parse({
      scopeType: "learner",
      q: "tom",
    });
    expect(targets.limit).toBe(20);
  });
});
