"use client";

import { clientApi } from "../../../lib/client-api";

export type DestinationKind = "email" | "webhook" | "storage";
export type DestinationStatusFilter = "all" | "enabled" | "disabled" | "failing";
export type DestinationSort = "name_asc" | "updated_desc" | "last_delivery_desc" | "failures_desc";
export type HealthDayStatus = "success" | "fail" | "empty";

export type DestinationEmailTarget = {
  address: string;
  isExternal: boolean;
};

export type DestinationItem = {
  id: string;
  name: string;
  kind: DestinationKind;
  isActive: boolean;
  isFailing: boolean;
  emails: DestinationEmailTarget[];
  webhookHost: string | null;
  webhookPathTruncated: string | null;
  webhookUrl: string | null;
  signingSecretMasked: string | null;
  hasSigningSecret: boolean;
  retryPolicy: "none" | "3x" | "5x" | null;
  payloadFormat: "multipart" | "json_signed_url" | null;
  storageProvider: "s3" | "gcs" | "azure" | null;
  storageBucket: string | null;
  storagePrefix: string | null;
  hasCredentials: boolean;
  credentialsMasked: string | null;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: "succeeded" | "failed" | "pending" | null;
  lastError: string | null;
  consecutiveFailures: number;
  scheduleCount: number;
  linkedSchedules: Array<{ id: string; name: string }>;
  health30d: HealthDayStatus[];
  externalRecipientCount: number;
  createdAt: string;
  updatedAt: string;
};

export type DestinationsRosterSummary = {
  totalCount: number;
  emailCount: number;
  webhookCount: number;
  storageCount: number;
  deliveriesThisMonth: number;
  deliveriesSucceededThisMonth: number;
  failingCount: number;
  failingCaption: string | null;
  externalRecipientCount: number;
  lastDeliveryAt: string | null;
  tenantEmailDomains: string[];
};

type PageInfo = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
};

export type DestinationsRosterFilters = {
  q?: string | undefined;
  kind?: DestinationKind | "any" | undefined;
  status?: DestinationStatusFilter | undefined;
  sort?: DestinationSort | undefined;
  page?: number | undefined;
  limit?: number | undefined;
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

export async function fetchDestinationsRoster(filters?: DestinationsRosterFilters) {
  return clientApi.get<{
    data: {
      items: DestinationItem[];
      pageInfo: PageInfo;
      summary: DestinationsRosterSummary;
    };
  }>(
    `/api/v1/reports/exports/destinations${buildQuery({
      q: filters?.q,
      kind: filters?.kind,
      status: filters?.status,
      sort: filters?.sort,
      page: filters?.page ?? 1,
      limit: filters?.limit ?? 50,
    })}`,
  );
}

export type CreateDestinationBody =
  | { kind: "email"; name: string; emails: string[] }
  | {
      kind: "webhook";
      name: string;
      url: string;
      signingSecret?: string;
      retryPolicy?: "none" | "3x" | "5x";
      payloadFormat?: "multipart" | "json_signed_url";
    }
  | {
      kind: "storage";
      name: string;
      provider?: "s3" | "gcs" | "azure";
      bucket: string;
      prefix?: string;
      credentials?: string;
    };

export async function createDestination(body: CreateDestinationBody) {
  return clientApi.post<{ data: DestinationItem }>(
    "/api/v1/reports/exports/destinations",
    body,
    `destination-create-${body.kind}`,
  );
}

export async function updateDestination(
  id: string,
  body: {
    name?: string;
    isActive?: boolean;
    emails?: string[];
    url?: string;
    signingSecret?: string;
    retryPolicy?: "none" | "3x" | "5x";
    payloadFormat?: "multipart" | "json_signed_url";
    provider?: "s3" | "gcs" | "azure";
    bucket?: string;
    prefix?: string;
    credentials?: string;
  },
) {
  return clientApi.patch<{ data: DestinationItem }>(
    `/api/v1/reports/exports/destinations/${id}`,
    body,
    `destination-update-${id}`,
  );
}

export async function deleteDestination(id: string) {
  return clientApi.delete<{
    data: {
      deleted: true;
      id: string;
      affectedSchedules: Array<{ id: string; name: string }>;
    };
  }>(`/api/v1/reports/exports/destinations/${id}`, `destination-delete-${id}`);
}

export async function testDestination(id: string) {
  return clientApi.post<{
    data: {
      ok: boolean;
      message: string;
      testedAt: string;
      destination: DestinationItem;
    };
  }>(`/api/v1/reports/exports/destinations/${id}/test`, {}, `destination-test-${id}`);
}

export async function exportDestinationsList() {
  return clientApi.post<{
    data: {
      format: "csv";
      filename: string;
      contentType: string;
      content: string;
    };
  }>("/api/v1/reports/exports/destinations/export", {}, "destinations-export-list");
}
