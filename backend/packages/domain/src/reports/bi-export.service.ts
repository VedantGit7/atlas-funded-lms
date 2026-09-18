import type { TenantTx } from "@atlas/db";
import {
  assertTenantKeyPrefix,
  buildTenantStorageKey,
  getStorageProvider,
  parseStorageEnv,
} from "@atlas/storage";
import type { BiExportFormat } from "./bi-export.dto";
import {
  biExportDetailResponseSchema,
  biExportListResponseSchema,
  biExportListQuerySchema,
  createBiExportBodySchema,
  createBiExportResponseSchema,
  type BiExportListQuery,
  type CreateBiExportBody,
} from "./bi-export.dto";
import { biExportRepository } from "./bi-export.repository";
import { buildReportDataset } from "./reports.datasets";
import { renderReportCsv } from "./reports-export-runner";
import { isApprovedDatasetKey } from "./reports.allowed-columns";
import { biExportJobNotFound, invalidReportParams } from "./reports.errors";
import type { BiExportJobRow } from "./bi-export.types";
import type { ServiceCtx } from "./reports.types";

export const BI_EXPORT_FORMAT_KEY = "x-biFormat" as const;

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

function mapErrorCode(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const code = (errorJson as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function extractFormat(paramsJson: unknown): BiExportFormat {
  const params = asRecord(paramsJson);
  const format = params[BI_EXPORT_FORMAT_KEY];
  return format === "jsonl" ? "jsonl" : "csv";
}

function extractDatasetParams(paramsJson: unknown): Record<string, unknown> {
  const params = asRecord(paramsJson);
  const { [BI_EXPORT_FORMAT_KEY]: _format, ...rest } = params;
  return rest;
}

function mapBiExportDto(job: BiExportJobRow, download: { url: string; expiresAt: string } | null) {
  return {
    id: job.id,
    datasetKey: job.dataset_key,
    format: extractFormat(job.params_json),
    status: job.status,
    params: extractDatasetParams(job.params_json),
    requestedByMembershipId: job.requested_by_membership_id,
    createdAt: job.created_at.toISOString(),
    updatedAt: job.updated_at.toISOString(),
    completedAt: job.completed_at?.toISOString() ?? null,
    expiresAt: job.expires_at?.toISOString() ?? null,
    errorCode: mapErrorCode(job.error_json),
    download,
  };
}

function renderBiExportJsonl(dataset: { rows: Record<string, unknown>[] }): Uint8Array {
  const lines = dataset.rows.map((row) => JSON.stringify(row));
  return new TextEncoder().encode(`${lines.join("\n")}\n`);
}

async function storeBiExportArtifact(
  ctx: ServiceCtx,
  args: {
    jobId: string;
    content: Uint8Array;
    contentType: string;
    fileExtension: string;
  },
): Promise<{ objectKey: string; expiresAt: Date }> {
  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();
  const objectKey = buildTenantStorageKey({
    tenantId: ctx.tenantId,
    purpose: "export.file",
    resourceId: args.jobId,
    fileName: `bi-export.${args.fileExtension}`,
  });

  const upload = await provider.createSignedUploadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: objectKey,
    contentType: args.contentType,
    sizeBytes: args.content.byteLength,
    expiresInSeconds: env.STORAGE_SIGNED_UPLOAD_TTL_SECONDS,
  });

  if (env.STORAGE_PROVIDER === "r2") {
    const response = await fetch(upload.url, {
      method: "PUT",
      body: Buffer.from(args.content),
      headers: upload.requiredHeaders,
    });

    if (!response.ok) {
      throw new Error("BI_EXPORT_UPLOAD_FAILED");
    }
  }

  const expiresAt = new Date(Date.now() + env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS * 1000);
  return { objectKey, expiresAt };
}

async function resolveSignedDownload(
  ctx: ServiceCtx,
  job: BiExportJobRow,
): Promise<{ url: string; expiresAt: string } | null> {
  if (job.status !== "SUCCEEDED" || !job.r2_object_key) {
    return null;
  }

  const env = parseStorageEnv(process.env);
  const provider = getStorageProvider();

  assertTenantKeyPrefix({
    tenantId: ctx.tenantId,
    key: job.r2_object_key,
  });

  const signed = await provider.createSignedDownloadUrl({
    bucket: env.R2_BUCKET_NAME,
    key: job.r2_object_key,
    expiresInSeconds: env.STORAGE_SIGNED_DOWNLOAD_TTL_SECONDS,
  });

  return {
    url: signed.url,
    expiresAt: signed.expiresAt.toISOString(),
  };
}

export async function processBiExport(tx: TenantTx, ctx: ServiceCtx, jobId: string): Promise<void> {
  const job = await biExportRepository.findById(tx, jobId);
  if (!job || job.status !== "QUEUED") {
    return;
  }

  const claimed = await biExportRepository.markRunning(tx, jobId);
  if (!claimed) {
    return;
  }

  const format = extractFormat(claimed.params_json);
  const params = extractDatasetParams(claimed.params_json);

  try {
    const dataset = await buildReportDataset(tx, {
      datasetKey: claimed.dataset_key,
      params,
    });

    const content = format === "jsonl" ? renderBiExportJsonl(dataset) : renderReportCsv(dataset);

    const stored = await storeBiExportArtifact(ctx, {
      jobId,
      content,
      contentType: format === "jsonl" ? "application/x-ndjson" : "text/csv",
      fileExtension: format === "jsonl" ? "jsonl" : "csv",
    });

    await biExportRepository.markSucceeded(tx, {
      jobId,
      objectKey: stored.objectKey,
      expiresAt: stored.expiresAt,
    });
  } catch {
    await biExportRepository.markFailed(tx, {
      jobId,
      errorCode: "BI_EXPORT_FAILED",
    });
    throw new Error("BI_EXPORT_FAILED");
  }
}

export async function createBiExportJob(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body: CreateBiExportBody = createBiExportBodySchema.parse(rawBody);

  if (!isApprovedDatasetKey(body.datasetKey)) {
    throw invalidReportParams("Dataset is not approved for BI export.");
  }

  const params = body.params ?? {};
  if (typeof params !== "object" || Array.isArray(params)) {
    throw invalidReportParams("Export params must be an object.");
  }

  const created = await biExportRepository.insertJob(tx, {
    requestedByMembershipId: ctx.actorMembershipId,
    datasetKey: body.datasetKey,
    paramsJson: {
      ...params,
      [BI_EXPORT_FORMAT_KEY]: body.format,
    },
  });

  await processBiExport(tx, ctx, created.id);

  const hydrated = await biExportRepository.findById(tx, created.id);
  if (!hydrated) {
    throw new Error("BI_EXPORT_JOB_NOT_FOUND");
  }

  return createBiExportResponseSchema.parse({
    data: mapBiExportDto(hydrated, null),
  });
}

export async function listBiExportJobs(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  void ctx;
  const query: BiExportListQuery = biExportListQuerySchema.parse(rawQuery ?? {});
  const rows = await biExportRepository.listJobs(tx, {
    limit: query.limit,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;

  return biExportListResponseSchema.parse({
    data: {
      items: await Promise.all(
        pageRows.map(async (job) =>
          mapBiExportDto(
            job,
            job.status === "SUCCEEDED" ? await resolveSignedDownload(ctx, job) : null,
          ),
        ),
      ),
      pageInfo: {
        nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function getBiExportJob(tx: TenantTx, ctx: ServiceCtx, jobId: string) {
  const job = await biExportRepository.findById(tx, jobId);
  if (!job || job.tenant_id !== ctx.tenantId) {
    throw biExportJobNotFound();
  }

  const download = await resolveSignedDownload(ctx, job);

  return biExportDetailResponseSchema.parse({
    data: mapBiExportDto(job, download),
  });
}
