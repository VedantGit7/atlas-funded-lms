"use client";

import { clientApi } from "../../../lib/client-api";

export type DeviceAlertType =
  | "concurrent_sessions"
  | "device_limit_exceeded"
  | "shared_fingerprint";

export type DeviceAlertStatus = "open" | "resolved" | "dismissed";
export type DeviceAlertSeverity = "critical" | "warn" | "info";

export type DeviceAlertListItem = {
  id: string;
  alertKey: string;
  alertType: DeviceAlertType;
  severity: DeviceAlertSeverity;
  status: DeviceAlertStatus;
  title: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  evidenceSummary: string[];
  sessionCount: number;
};

export type DeviceAlertsSummary = {
  openTotal: number;
  byType: {
    concurrent_sessions: number;
    device_limit_exceeded: number;
    shared_fingerprint: number;
  };
  resolvedCount: number;
  dismissedCount: number;
  unsupportedRules: Array<{ key: string; label: string; reason: string }>;
};

export type DeviceAlertDetail = {
  id: string;
  alertKey: string;
  alertType: DeviceAlertType;
  severity: DeviceAlertSeverity;
  status: DeviceAlertStatus;
  title: string;
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  detectedAt: string;
  resolvedAt: string | null;
  ruleLabel: string;
  thresholdLabel: string;
  evidence: Record<string, unknown>;
  sessions: Array<{
    id: string;
    deviceLabel: string;
    shortId: string;
    ipAddress: string | null;
    platform: string | null;
    lastSeenAt: string;
    createdAt: string;
  }>;
  notes: Array<{
    id: string;
    body: string;
    createdAt: string;
    authorMembershipId: string | null;
    authorLabel: string | null;
  }>;
  capabilities: {
    canResolve: boolean;
    canDismiss: boolean;
    canRevokeSessions: boolean;
    geoAvailable: false;
  };
};

export type DeviceAlertsFilters = {
  status?: DeviceAlertStatus;
  type?: DeviceAlertType;
  page?: number;
  limit?: number;
};

function buildQuery(filters: DeviceAlertsFilters): string {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.type) params.set("type", filters.type);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchDeviceAlerts(filters: DeviceAlertsFilters = {}) {
  return clientApi.get<{
    data: {
      items: DeviceAlertListItem[];
      summary: DeviceAlertsSummary;
      pageInfo: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  }>(`/api/v1/reports/active-devices/alerts${buildQuery(filters)}`);
}

export async function fetchDeviceAlertDetail(alertId: string) {
  return clientApi.get<{ data: DeviceAlertDetail }>(
    `/api/v1/reports/active-devices/alerts/${alertId}`,
  );
}

export async function resolveDeviceAlerts(alertIds: string[]) {
  return clientApi.post<{ data: { updatedCount: number } }>(
    "/api/v1/reports/active-devices/alerts/resolve",
    { alertIds },
    "active-devices-alerts-resolve",
    { successMessage: "Alert(s) marked resolved." },
  );
}

export async function dismissDeviceAlerts(alertIds: string[]) {
  return clientApi.post<{ data: { updatedCount: number } }>(
    "/api/v1/reports/active-devices/alerts/dismiss",
    { alertIds },
    "active-devices-alerts-dismiss",
    { successMessage: "Alert(s) dismissed." },
  );
}

export async function addDeviceAlertNote(alertId: string, body: string) {
  return clientApi.post<{
    data: DeviceAlertDetail["notes"][number];
  }>(
    `/api/v1/reports/active-devices/alerts/${alertId}/notes`,
    { body },
    "active-devices-alerts-note",
    { successMessage: "Note added." },
  );
}
