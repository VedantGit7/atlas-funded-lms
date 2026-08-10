"use client";

import { clientApi } from "../../../lib/client-api";

export type ExportBuilderPreview = {
  definitionKey: string;
  definitionTitle: string;
  datasetKey: string;
  estimatedRowCount: number;
  capped: boolean;
  rowCap: number;
  estimatedSizeLabel: string | null;
  columns: string[];
  piiColumns: string[];
  sampleRows: Array<Record<string, unknown>>;
  sampleLimit: number;
};

export async function previewExportBuilder(body: {
  definitionKey: string;
  params?: Record<string, unknown>;
  columns?: string[];
  format?: "csv" | "xlsx" | "pdf" | "json";
  rowLimit?: number;
  sampleLimit?: number;
}) {
  return clientApi.post<{ data: ExportBuilderPreview }>(
    "/api/v1/reports/exports/preview",
    body,
    `export-builder-preview-${body.definitionKey}`,
  );
}
