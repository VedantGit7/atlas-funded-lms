"use client";

import { clientApi } from "../../../lib/client-api";

export type FileRetentionUnit = "days" | "hours";
export type RunRecordRetention = "1y" | "2y" | "5y" | "forever";
export type DownloadAccessPolicy = "anyone_who_can_run" | "owners_only" | "requester_only";
export type PiiTreatment = "include" | "mask" | "exclude";
export type PiiDataType =
  | "learner_name"
  | "email"
  | "phone"
  | "billing_address"
  | "tax_id"
  | "ip_address"
  | "device_fingerprint";

export type ExportSettings = {
  fileRetentionValue: number;
  fileRetentionUnit: FileRetentionUnit;
  runRecordRetention: RunRecordRetention;
  maxRowsPerExport: number;
  maxConcurrentPerAdmin: number;
  runExportRoleKeys: string[];
  downloadAccess: DownloadAccessPolicy;
  requireReasonForPii: boolean;
  allowExternalDestinations: boolean;
  watermarkExports: boolean;
  personalDataTreatments: Record<PiiDataType, PiiTreatment>;
};

export type ExportSettingsStorage = {
  filesStoredCount: number;
  estimatedBytes: number;
  expiringSoonCount: number;
  expiredCount: number;
  purgeFreesEstimatedBytes: number;
};

export type ExportSettingsRole = {
  key: string;
  name: string;
};

export type PersonalDataFieldMeta = {
  key: PiiDataType;
  label: string;
  maskExample: string | null;
  exposedByReports: string[];
};

export type ExportSettingsAuditEvent = {
  id: string;
  occurredAt: string;
  summary: string;
  actorName: string | null;
};

export type ExportSettingsPayload = {
  settings: ExportSettings;
  storage: ExportSettingsStorage;
  availableRoles: ExportSettingsRole[];
  externalDestinationCount: number;
  personalDataFields: PersonalDataFieldMeta[];
  recentAudit: ExportSettingsAuditEvent[];
  updatedAt: string | null;
  updatedByName: string | null;
};

export type RetentionImpact = {
  filesDeletedImmediately: number;
  estimatedBytesFreed: number;
  currentRetentionLabel: string;
  nextRetentionLabel: string;
};

export type PurgeExpiredResult = {
  deletedCount: number;
  estimatedBytesFreed: number;
};

function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function fetchExportSettings() {
  return clientApi.get<{ data: ExportSettingsPayload }>("/api/v1/reports/exports/settings");
}

export async function updateExportSettings(body: {
  settings: ExportSettings;
  acknowledgeRetentionPurge?: boolean;
}) {
  return clientApi.put<{ data: ExportSettingsPayload }>(
    "/api/v1/reports/exports/settings",
    body,
    "export-settings-update",
  );
}

export async function fetchRetentionImpact(query: {
  fileRetentionValue: number;
  fileRetentionUnit: FileRetentionUnit;
}) {
  return clientApi.get<{ data: RetentionImpact }>(
    `/api/v1/reports/exports/settings/retention-impact${buildQuery({
      fileRetentionValue: query.fileRetentionValue,
      fileRetentionUnit: query.fileRetentionUnit,
    })}`,
  );
}

export async function purgeExpiredExportFiles() {
  return clientApi.post<{ data: PurgeExpiredResult }>(
    "/api/v1/reports/exports/settings/purge-expired",
    {},
    "export-settings-purge-expired",
  );
}
