"use client";

import { clientApi } from "../../../lib/client-api";

export type ActiveDevicesWindow = "24h" | "7d" | "30d" | "all";
export type ActiveDevicesView = "all" | "attention" | "suspicious";

export type ActiveDevicesLearner = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  deviceCount: number;
  lastSeenAt: string | null;
  platforms: string[];
  ipAddresses: string[];
  status: "active" | "over_limit";
};

export type ActiveDeviceSession = {
  id: string;
  membershipId: string;
  deviceFingerprint: string | null;
  userAgent: string | null;
  ipAddress: string | null;
  platform: string | null;
  lastSeenAt: string;
  createdAt: string;
};

export type ActiveDevicesDetailDeviceStatus = "current" | "active" | "idle" | "flagged";

export type ActiveDevicesDetailDevice = ActiveDeviceSession & {
  shortId: string;
  deviceLabel: string;
  browserLabel: string | null;
  osLabel: string | null;
  status: ActiveDevicesDetailDeviceStatus;
  isCurrent: boolean;
};

export type ActiveDevicesRiskSignal = {
  key: "concurrent_locations" | "device_count" | "recognised_devices" | "no_shared_ip";
  label: string;
  status: "pass" | "warn" | "fail";
  detail: string | null;
};

export type ActiveDevicesActivityEvent = {
  id: string;
  at: string;
  kind: "signed_in" | "last_seen" | "over_limit";
  label: string;
  detail: string | null;
  severity: "neutral" | "warning" | "danger";
};

export type ActiveDevicesLearnerDetail = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  roleLabel: string;
  summary: {
    activeDevices: number;
    deviceLimit: number;
    overLimit: boolean;
    firstSeenAt: string | null;
    lastActivityAt: string | null;
    distinctIpCount: number;
    flagSummary: string | null;
  };
  policy: {
    deviceLimit: number;
    restrictionsEnabled: boolean;
    source: "tenant_default";
    enforcementNote: string;
  };
  riskSignals: ActiveDevicesRiskSignal[];
  recentActivity: ActiveDevicesActivityEvent[];
  devices: ActiveDevicesDetailDevice[];
};

export type ActiveDevicesSessionDetail = {
  membershipId: string;
  learnerName: string | null;
  email: string | null;
  roleLabel: string;
  device: ActiveDevicesDetailDevice & {
    sessionAgeLabel: string;
    heartbeatStatus: "polling" | "idle" | "stale";
    fingerprintShareCount: number;
  };
  network: {
    ipAddress: string | null;
    geoAvailable: false;
    note: string;
  };
  client: {
    platform: string | null;
    osLabel: string | null;
    browserLabel: string | null;
    userAgent: string | null;
  };
  fingerprintPayload: Record<string, unknown>;
  heatstrip: Array<{
    hour: number;
    label: string;
    level: "none" | "low" | "mid" | "high" | "current";
    detail: string;
  }>;
  recentActivity: Array<{
    id: string;
    at: string;
    label: string;
    detail: string | null;
    result: "ok" | "flagged" | "info";
    ipAddress: string | null;
  }>;
  capabilities: {
    canRevoke: boolean;
    trustedDevicesSupported: false;
    requestTelemetrySupported: false;
  };
};

export type ActiveDevicesRosterFilters = {
  email?: string | undefined;
  platform?: string | undefined;
  window?: ActiveDevicesWindow | undefined;
  view?: ActiveDevicesView | undefined;
  page?: number | undefined;
  limit?: number | undefined;
};

export type ActiveDevicesOverview = {
  summary: {
    activeDevicesCount: number;
    previousPeriodCount: number;
    changeCount: number;
    learnersSignedIn: number;
    overDeviceLimit: number;
    flaggedSessions: number;
    deviceLimitPolicy: number;
    restrictionsEnabled: boolean;
    windowLabel: string;
    windowFrom: string | null;
    windowTo: string;
  };
  trend: Array<{
    date: string;
    activeDevices: number;
    learnersSignedIn: number;
  }>;
};

export type ActiveDevicesOverviewFilters = {
  window?: ActiveDevicesWindow | undefined;
  email?: string | undefined;
  platform?: string | undefined;
};

function buildQuery(filters: ActiveDevicesRosterFilters): string {
  const params = new URLSearchParams();
  if (filters.email) params.set("email", filters.email);
  if (filters.platform) params.set("platform", filters.platform);
  if (filters.window) params.set("window", filters.window);
  if (filters.view) params.set("view", filters.view);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return query ? `?${query}` : "";
}

function buildOverviewQuery(filters: ActiveDevicesOverviewFilters): string {
  const params = new URLSearchParams();
  if (filters.window) params.set("window", filters.window);
  if (filters.email) params.set("email", filters.email);
  if (filters.platform) params.set("platform", filters.platform);
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function fetchActiveDevicesRoster(filters: ActiveDevicesRosterFilters = {}) {
  return clientApi.get<{
    data: {
      items: ActiveDevicesLearner[];
      pageInfo: {
        page: number;
        pageSize: number;
        totalCount: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPreviousPage: boolean;
      };
    };
  }>(`/api/v1/reports/active-devices/roster${buildQuery(filters)}`);
}

export async function fetchActiveDevicesOverview(filters: ActiveDevicesOverviewFilters = {}) {
  return clientApi.get<{ data: ActiveDevicesOverview }>(
    `/api/v1/reports/active-devices/overview${buildOverviewQuery(filters)}`,
  );
}

export async function fetchActiveDevicesLearnerDetail(membershipId: string) {
  return clientApi.get<{ data: ActiveDevicesLearnerDetail }>(
    `/api/v1/reports/active-devices/roster/${membershipId}`,
  );
}

export async function fetchActiveDevicesSessionDetail(membershipId: string, deviceId: string) {
  return clientApi.get<{ data: ActiveDevicesSessionDetail }>(
    `/api/v1/reports/active-devices/roster/${membershipId}/${deviceId}`,
  );
}

export async function deleteActiveDevices(sessionIds: string[]) {
  return clientApi.post<{ data: { deletedCount: number } }>(
    "/api/v1/reports/active-devices/delete",
    { sessionIds },
    "active-devices-delete",
    { successMessage: "Selected devices deleted." },
  );
}

export async function forceSignOutActiveDevices(membershipId: string) {
  return clientApi.post<{ data: { membershipId: string; deletedCount: number } }>(
    "/api/v1/reports/active-devices/force-sign-out",
    { membershipId },
    "active-devices-force-sign-out",
    { successMessage: "Learner signed out of all devices." },
  );
}
