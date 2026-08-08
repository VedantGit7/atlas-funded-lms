"use client";

import { clientApi } from "../../../lib/client-api";
import type { NormalizedResult, VizType } from "../../analytics/viz";

export type ReportParamDefinition = {
  key: string;
  label: string;
  type: "date" | "string" | "select";
  required: boolean;
  options?: Array<{ value: string; label: string }>;
  defaultValue?: string;
};

export type ReportDefinition = {
  id: string;
  key: string;
  category: string;
  name: string;
  description: string;
  defaultViz: VizType;
  params: ReportParamDefinition[];
  columns?: string[];
  scope?: "system" | "tenant";
};

export type CustomReportDefinition = {
  id: string;
  key: string;
  title: string;
  datasetKey: string;
  columns: string[];
  scope: "tenant";
};

export type ReportRun = {
  id: string;
  definitionKey: string;
  status: "queued" | "running" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  downloadUrl: string | null;
};

export type ReportSchedule = {
  id: string;
  definitionKey: string;
  name: string;
  cadence: string;
  nextRunAt: string;
  formats: string[];
  active: boolean;
};

export type ReportHistoryItem = {
  id: string;
  definitionKey: string;
  definitionName: string;
  status: ReportRun["status"];
  createdAt: string;
  completedAt: string | null;
};

type DomainDefinition = {
  id: string;
  key: string;
  category: string;
  title: string;
  description: string | null;
  paramSchema: Record<string, unknown>;
  datasetKey: string;
  columns?: string[];
  defaultFormat: "csv" | "xlsx" | "pdf";
  scope?: "system" | "tenant";
};

type DomainRun = {
  id: string;
  definitionKey: string;
  definitionTitle: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  errorCode: string | null;
  download?: { url: string; expiresAt: string } | null;
};

function mapLegacyStatus(status: string): ReportRun["status"] {
  switch (status) {
    case "QUEUED":
      return "queued";
    case "RUNNING":
      return "running";
    case "SUCCEEDED":
      return "completed";
    case "FAILED":
    case "CANCELLED":
      return "failed";
    default:
      return "failed";
  }
}

function labelize(key: string): string {
  return key.replace(/([A-Z])/g, " $1").replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseParamSchema(paramSchema: Record<string, unknown>): ReportParamDefinition[] {
  const properties =
    paramSchema["properties"] && typeof paramSchema["properties"] === "object"
      ? (paramSchema["properties"] as Record<string, Record<string, unknown>>)
      : {};

  return Object.entries(properties).map(([key, schema]) => {
    const format = typeof schema["format"] === "string" ? schema["format"] : null;
    const enumValues = Array.isArray(schema["enum"]) ? schema["enum"].filter((value): value is string => typeof value === "string") : null;

    if (enumValues) {
      return {
        key,
        label: labelize(key),
        type: "select" as const,
        required: false,
        options: enumValues.map((value) => ({ value, label: labelize(value) })),
      };
    }

    if (format === "date-time" || format === "date") {
      return { key, label: labelize(key), type: "date" as const, required: false };
    }

    return { key, label: labelize(key), type: "string" as const, required: false };
  });
}

function mapDefinition(definition: DomainDefinition): ReportDefinition {
  return {
    id: definition.id,
    key: definition.key,
    category: definition.category,
    name: definition.title,
    description: definition.description ?? "",
    defaultViz: "table",
    params: parseParamSchema(definition.paramSchema),
    columns: definition.columns,
    scope: definition.scope,
  };
}

export async function fetchReportDefinitions(category: string) {
  const response = await clientApi.get<{ data: { items: DomainDefinition[] } }>(
    "/api/v1/reports/definitions",
  );

  const definitions = response.data.items
    .filter(
      (definition) =>
        definition.category === category ||
        definition.key === category ||
        (category === "exports" && definition.category === "custom"),
    )
    .map(mapDefinition);

  return { data: { category, definitions } };
}

export async function createCustomReportDefinition(body: {
  title: string;
  description?: string;
  datasetKey: string;
  columns: string[];
  key?: string;
}) {
  const response = await clientApi.post<{ data: DomainDefinition }>(
    "/api/v1/reports/definitions",
    body,
    `custom-report-${body.title}`,
  );

  return {
    data: {
      id: response.data.id,
      key: response.data.key,
      title: response.data.title,
      datasetKey: response.data.datasetKey,
      columns: response.data.columns ?? body.columns,
      scope: "tenant" as const,
    } satisfies CustomReportDefinition,
  };
}

export type BiExportJob = {
  id: string;
  datasetKey: string;
  format: "csv" | "jsonl";
  status: string;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
};

function mapBiExportStatus(status: string): string {
  return status.toLowerCase();
}

export async function fetchBiExportJobs() {
  const response = await clientApi.get<{
    data: {
      items: Array<{
        id: string;
        datasetKey: string;
        format: "csv" | "jsonl";
        status: string;
        createdAt: string;
        completedAt: string | null;
        download?: { url: string } | null;
      }>;
    };
  }>("/api/v1/reports/bi-exports");

  return {
    data: {
      items: response.data.items.map(
        (job): BiExportJob => ({
          id: job.id,
          datasetKey: job.datasetKey,
          format: job.format,
          status: mapBiExportStatus(job.status),
          createdAt: job.createdAt,
          completedAt: job.completedAt,
          downloadUrl: job.download?.url ?? null,
        }),
      ),
    },
  };
}

export async function createBiExportJob(body: {
  datasetKey: string;
  format?: "csv" | "jsonl";
  params?: Record<string, string>;
}) {
  return clientApi.post("/api/v1/reports/bi-exports", body, `bi-export-${body.datasetKey}`);
}

export async function startReportRun(definitionKey: string, params: Record<string, string>) {
  const normalizedParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value.trim().length > 0),
  );

  const response = await clientApi.post<{ data: DomainRun }>(
    "/api/v1/reports/runs",
    {
      definitionKey,
      format: "csv",
      params: normalizedParams,
    },
    `report-run-${definitionKey}`,
  );

  return {
    data: {
      id: response.data.id,
      definitionKey: response.data.definitionKey,
      status: mapLegacyStatus(response.data.status),
      createdAt: response.data.createdAt,
      completedAt: response.data.completedAt,
      errorMessage: response.data.errorCode,
      downloadUrl: response.data.download?.url ?? null,
    } satisfies ReportRun,
  };
}

export async function fetchReportRun(runId: string) {
  const response = await clientApi.get<{ data: DomainRun & { download?: { url: string } | null } }>(
    `/api/v1/reports/runs/${encodeURIComponent(runId)}`,
  );

  return {
    data: {
      id: response.data.id,
      definitionKey: response.data.definitionKey,
      status: mapLegacyStatus(response.data.status),
      createdAt: response.data.createdAt,
      completedAt: response.data.completedAt,
      errorMessage: response.data.errorCode,
      downloadUrl: response.data.download?.url ?? null,
    } satisfies ReportRun,
  };
}

export async function fetchReportPreview(runId: string) {
  return clientApi.get<{
    data: { runId: string; defaultViz: VizType; preview: NormalizedResult };
  }>(`/api/v1/reports/runs/${encodeURIComponent(runId)}/preview`);
}

export async function createReportSchedule(body: {
  definitionKey: string;
  name?: string;
  cronExpression: string;
  timezone?: string;
  formats?: Array<"csv" | "xlsx" | "pdf">;
  isActive?: boolean;
}) {
  return clientApi.post<{ data: { id: string; definitionKey: string; name: string | null; cronExpression: string; formats: string[]; isActive: boolean } }>(
    "/api/v1/reports/schedules",
    body,
    `report-schedule-${body.definitionKey}`,
  );
}

export async function fetchReportSchedules(category: string) {
  const response = await clientApi.get<{
    data: {
      items: Array<{
        id: string;
        definitionKey: string;
        name: string | null;
        cronExpression: string;
        nextRunAt: string;
        formats: string[];
        isActive: boolean;
      }>;
    };
  }>("/api/v1/reports/schedules");

  const schedules = response.data.items
    .filter((schedule) => schedule.definitionKey === category || schedule.definitionKey.startsWith(category))
    .map(
      (schedule): ReportSchedule => ({
        id: schedule.id,
        definitionKey: schedule.definitionKey,
        name: schedule.name ?? schedule.definitionKey,
        cadence: schedule.cronExpression,
        nextRunAt: schedule.nextRunAt,
        formats: schedule.formats,
        active: schedule.isActive,
      }),
    );

  return { data: { category, schedules } };
}

export async function fetchReportHistory(category: string, limit = 20) {
  return clientApi.get<{ data: { category: string; items: ReportHistoryItem[] } }>(
    `/api/v1/reports/history?category=${encodeURIComponent(category)}&limit=${String(limit)}`,
  );
}

export function reportDownloadPath(runId: string, format: "csv" | "xlsx" | "pdf" | "json"): string {
  return `/api/v1/reports/runs/${encodeURIComponent(runId)}/download/${format}`;
}

export async function downloadReportExport(runId: string, format: "csv" | "xlsx" | "pdf" | "json") {
  const response = await clientApi.get<{
    data: {
      format: string;
      filename: string;
      contentType: string;
      content: string;
      contentEncoding?: "utf8" | "base64";
      url: string | null;
    };
  }>(reportDownloadPath(runId, format));

  if (response.data.url) {
    window.open(response.data.url, "_blank", "noopener,noreferrer");
    return;
  }

  const encoding = response.data.contentEncoding ?? "utf8";
  let blob: Blob;
  if (encoding === "base64") {
    const binary = atob(response.data.content);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    blob = new Blob([bytes], { type: response.data.contentType });
  } else {
    blob = new Blob([response.data.content], { type: response.data.contentType });
  }

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = response.data.filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function pollReportRunUntilComplete(
  runId: string,
  options?: {
    intervalMs?: number;
    maxAttempts?: number;
    onPoll?: (attempt: number) => void;
  },
): Promise<ReportRun> {
  const intervalMs = options?.intervalMs ?? 800;
  const maxAttempts = options?.maxAttempts ?? 30;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    options?.onPoll?.(attempt);
    const response = await fetchReportRun(runId);
    if (response.data.status === "completed" || response.data.status === "failed") {
      return response.data;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  const final = await fetchReportRun(runId);
  return final.data;
}
