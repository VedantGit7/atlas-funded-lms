"use client";

import { clientApi } from "../../../lib/client-api";

export type DevicePolicyOnLimit = "block" | "sign_out_oldest" | "allow_and_alert";
export type DevicePolicyOverrideOnLimit = "inherit" | DevicePolicyOnLimit;
export type DevicePolicyScopeType = "role" | "batch" | "learner";
export type DevicePolicyIdleDays = 7 | 14 | 30 | 90 | null;

export type DevicePolicyTenantDefaults = {
  restrictionsEnabled: boolean;
  devicesAllowed: number;
  restrictParallelLogins: boolean;
  idleSessionExpiryDays: DevicePolicyIdleDays;
  onLimitReached: DevicePolicyOnLimit;
  requireReverificationOnNewDevice: boolean;
  notifyLearnerOnNewDevice: boolean;
  sharedFingerprintAlertEnabled: boolean;
  sharedFingerprintThreshold: number;
};

export type DevicePolicyOverride = {
  id: string;
  scopeType: DevicePolicyScopeType;
  scopeId: string;
  scopeLabel: string;
  devicesAllowed: number;
  onLimitReached: DevicePolicyOverrideOnLimit;
  appliesToCount: number;
  updatedByLabel: string | null;
  updatedAt: string;
  expiresAt: string | null;
};

export type DeviceBlockedFingerprint = {
  id: string;
  fingerprint: string;
  fingerprintShort: string;
  reason: string;
  blockedAt: string;
  blockedByLabel: string | null;
};

export type DevicePoliciesPayload = {
  tenantDefaults: DevicePolicyTenantDefaults;
  overrides: DevicePolicyOverride[];
  blockedFingerprints: DeviceBlockedFingerprint[];
  capabilities: {
    canEditDefaults: boolean;
    canManageOverrides: boolean;
    canManageBlocks: boolean;
    enforcementNote: string;
  };
};

export type DevicePolicyTarget = {
  id: string;
  label: string;
  secondary: string | null;
};

export async function fetchDevicePolicies() {
  return clientApi.get<{ data: DevicePoliciesPayload }>("/api/v1/reports/active-devices/policies");
}

export async function updateDevicePolicies(body: DevicePolicyTenantDefaults) {
  return clientApi.patch<{ data: DevicePoliciesPayload }>(
    "/api/v1/reports/active-devices/policies",
    body,
    "active-devices-policies-update",
    { successMessage: "Device policies saved." },
  );
}

export async function createDevicePolicyOverride(body: {
  scopeType: DevicePolicyScopeType;
  scopeId: string;
  devicesAllowed: number;
  onLimitReached: DevicePolicyOverrideOnLimit;
  expiresAt?: string | null;
}) {
  return clientApi.post<{ data: DevicePolicyOverride }>(
    "/api/v1/reports/active-devices/policies/overrides",
    body,
    "active-devices-policy-override-create",
    { successMessage: "Override created." },
  );
}

export async function updateDevicePolicyOverride(
  overrideId: string,
  body: {
    devicesAllowed: number;
    onLimitReached: DevicePolicyOverrideOnLimit;
    expiresAt?: string | null;
  },
) {
  return clientApi.patch<{ data: DevicePolicyOverride }>(
    `/api/v1/reports/active-devices/policies/overrides/${overrideId}`,
    body,
    "active-devices-policy-override-update",
    { successMessage: "Override updated." },
  );
}

export async function deleteDevicePolicyOverride(overrideId: string) {
  return clientApi.delete<{ data: { ok: true } }>(
    `/api/v1/reports/active-devices/policies/overrides/${overrideId}`,
    "active-devices-policy-override-delete",
    undefined,
    { successMessage: "Override removed." },
  );
}

export async function createBlockedFingerprint(body: { fingerprint: string; reason: string }) {
  return clientApi.post<{ data: DeviceBlockedFingerprint }>(
    "/api/v1/reports/active-devices/policies/blocked-fingerprints",
    body,
    "active-devices-policy-block-create",
    { successMessage: "Fingerprint blocked." },
  );
}

export async function unblockFingerprint(blockId: string) {
  return clientApi.delete<{ data: { ok: true } }>(
    `/api/v1/reports/active-devices/policies/blocked-fingerprints/${blockId}`,
    "active-devices-policy-block-delete",
    undefined,
    { successMessage: "Fingerprint unblocked." },
  );
}

export async function searchDevicePolicyTargets(scopeType: DevicePolicyScopeType, q: string) {
  const params = new URLSearchParams({ scopeType, q, limit: "20" });
  return clientApi.get<{ data: { items: DevicePolicyTarget[] } }>(
    `/api/v1/reports/active-devices/policies/targets?${params.toString()}`,
  );
}
