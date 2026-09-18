import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import type { ServiceCtx } from "../shared/domain.types";
import {
  activeDevicesPoliciesResponseSchema,
  createBlockedFingerprintBodySchema,
  createDevicePolicyOverrideBodySchema,
  deviceBlockedFingerprintMutationResponseSchema,
  devicePolicyMutationResponseSchema,
  devicePolicyOverrideMutationResponseSchema,
  devicePolicyTargetsQuerySchema,
  devicePolicyTargetsResponseSchema,
  updateActiveDevicesPoliciesBodySchema,
  updateDevicePolicyOverrideBodySchema,
  type CreateBlockedFingerprintBody,
  type CreateDevicePolicyOverrideBody,
  type DevicePolicyTargetsQuery,
  type UpdateActiveDevicesPoliciesBody,
  type UpdateDevicePolicyOverrideBody,
} from "./active-devices-policies.dto";
import {
  activeDevicesPoliciesRepository,
  mapBlockedRow,
  mapOverrideRow,
  mapTenantDefaults,
} from "./active-devices-policies.repository";

const ENFORCEMENT_NOTE =
  "Device limit and parallel-login settings apply to registered mobile sessions today. Idle expiry, re-verification, learner notify, and on-limit actions are stored for policy and forthcoming enforcement.";

function parseExpiresAt(value: string | null | undefined): Date | null {
  if (value == null) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AtlasHttpError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "Override expiry must be a valid date.",
    });
  }
  return date;
}

export async function getActiveDevicesPolicies(tx: TenantTx, _ctx: ServiceCtx) {
  const [security, overrideRows, blockedRows] = await Promise.all([
    activeDevicesPoliciesRepository.readSecuritySection(tx),
    activeDevicesPoliciesRepository.listOverrides(tx),
    activeDevicesPoliciesRepository.listBlockedFingerprints(tx),
  ]);

  return activeDevicesPoliciesResponseSchema.parse({
    data: {
      tenantDefaults: mapTenantDefaults(security),
      overrides: overrideRows.map(mapOverrideRow),
      blockedFingerprints: blockedRows.map(mapBlockedRow),
      capabilities: {
        canEditDefaults: true,
        canManageOverrides: true,
        canManageBlocks: true,
        enforcementNote: ENFORCEMENT_NOTE,
      },
    },
  });
}

export async function updateActiveDevicesPolicies(
  tx: TenantTx,
  _ctx: ServiceCtx,
  input: UpdateActiveDevicesPoliciesBody,
) {
  const body = updateActiveDevicesPoliciesBodySchema.parse(input);
  await activeDevicesPoliciesRepository.mergeSecuritySection(tx, {
    deviceRestrictionsEnabled: body.restrictionsEnabled,
    deviceRegistrationLimit: body.devicesAllowed,
    restrictParallelLogins: body.restrictParallelLogins,
    deviceIdleSessionExpiryDays: body.idleSessionExpiryDays,
    deviceOnLimitReached: body.onLimitReached,
    deviceRequireReverificationOnNewDevice: body.requireReverificationOnNewDevice,
    deviceNotifyLearnerOnNewDevice: body.notifyLearnerOnNewDevice,
    deviceSharedFingerprintAlertEnabled: body.sharedFingerprintAlertEnabled,
    deviceSharedFingerprintThreshold: body.sharedFingerprintThreshold,
  });
  return getActiveDevicesPolicies(tx, _ctx);
}

export async function createDevicePolicyOverride(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateDevicePolicyOverrideBody,
) {
  const body = createDevicePolicyOverrideBodySchema.parse(input);
  const exists = await activeDevicesPoliciesRepository.scopeExists(
    tx,
    body.scopeType,
    body.scopeId,
  );
  if (!exists) {
    throw new AtlasHttpError({
      status: 404,
      code: "PERMISSION_DENIED",
      message: "Override target was not found in this academy.",
    });
  }

  const id = await activeDevicesPoliciesRepository.insertOverride(tx, {
    scopeType: body.scopeType,
    scopeId: body.scopeId,
    devicesAllowed: body.devicesAllowed,
    onLimitReached: body.onLimitReached,
    expiresAt: parseExpiresAt(body.expiresAt ?? null),
    actorMembershipId: ctx.actorMembershipId,
  });

  const row = await activeDevicesPoliciesRepository.findOverride(tx, id);
  if (!row) {
    throw new AtlasHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Override was created but could not be loaded.",
    });
  }

  return devicePolicyOverrideMutationResponseSchema.parse({
    data: mapOverrideRow(row),
  });
}

export async function updateDevicePolicyOverride(
  tx: TenantTx,
  ctx: ServiceCtx,
  overrideId: string,
  input: UpdateDevicePolicyOverrideBody,
) {
  const body = updateDevicePolicyOverrideBodySchema.parse(input);
  const updated = await activeDevicesPoliciesRepository.updateOverride(tx, overrideId, {
    devicesAllowed: body.devicesAllowed,
    onLimitReached: body.onLimitReached,
    expiresAt: parseExpiresAt(body.expiresAt ?? null),
    actorMembershipId: ctx.actorMembershipId,
  });
  if (!updated) {
    throw new AtlasHttpError({
      status: 404,
      code: "PERMISSION_DENIED",
      message: "Override was not found.",
    });
  }
  const row = await activeDevicesPoliciesRepository.findOverride(tx, overrideId);
  if (!row) {
    throw new AtlasHttpError({
      status: 404,
      code: "PERMISSION_DENIED",
      message: "Override was not found.",
    });
  }
  return devicePolicyOverrideMutationResponseSchema.parse({
    data: mapOverrideRow(row),
  });
}

export async function deleteDevicePolicyOverride(
  tx: TenantTx,
  _ctx: ServiceCtx,
  overrideId: string,
) {
  const deleted = await activeDevicesPoliciesRepository.deleteOverride(tx, overrideId);
  if (!deleted) {
    throw new AtlasHttpError({
      status: 404,
      code: "PERMISSION_DENIED",
      message: "Override was not found.",
    });
  }
  return devicePolicyMutationResponseSchema.parse({ data: { ok: true } });
}

export async function createBlockedFingerprint(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreateBlockedFingerprintBody,
) {
  const body = createBlockedFingerprintBodySchema.parse(input);
  const fingerprint = body.fingerprint.trim().toLowerCase();
  const id = await activeDevicesPoliciesRepository.insertBlockedFingerprint(tx, {
    fingerprint,
    reason: body.reason.trim(),
    actorMembershipId: ctx.actorMembershipId,
  });
  const row = await activeDevicesPoliciesRepository.findBlockedFingerprint(tx, id);
  if (!row) {
    throw new AtlasHttpError({
      status: 500,
      code: "INTERNAL_ERROR",
      message: "Fingerprint block was created but could not be loaded.",
    });
  }
  return deviceBlockedFingerprintMutationResponseSchema.parse({
    data: mapBlockedRow(row),
  });
}

export async function unblockFingerprint(tx: TenantTx, _ctx: ServiceCtx, blockId: string) {
  const deleted = await activeDevicesPoliciesRepository.deleteBlockedFingerprint(tx, blockId);
  if (!deleted) {
    throw new AtlasHttpError({
      status: 404,
      code: "PERMISSION_DENIED",
      message: "Blocked fingerprint was not found.",
    });
  }
  return devicePolicyMutationResponseSchema.parse({ data: { ok: true } });
}

export async function searchDevicePolicyTargets(
  tx: TenantTx,
  _ctx: ServiceCtx,
  input: DevicePolicyTargetsQuery,
) {
  const query = devicePolicyTargetsQuerySchema.parse(input);
  const items = await activeDevicesPoliciesRepository.searchTargets(tx, query);
  return devicePolicyTargetsResponseSchema.parse({ data: { items } });
}
