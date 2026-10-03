import { consumeEntitlementUnits, enforceEntitlement } from "@atlas/authorization";
import { auditWriter } from "@atlas/audit";
import type { TenantTx } from "@atlas/db";
import { outbox } from "@atlas/events";
import { resolveVerifiedExportDownload } from "./export-artifact";
import { loadMembershipResourceRef } from "@atlas/membership";
import { createTenantResourceRef } from "@atlas/authorization";
import { APPROVED_EXPORT_DOMAINS, EXPORT_SCOPE_VERSION } from "./data-rights.contract";
import {
  createDeletionRequestBodySchema,
  createExportResponseSchema,
  deletionListQuerySchema,
  deletionListResponseSchema,
  deletionRequestDtoSchema,
  exportJobDetailResponseSchema,
  exportJobDtoSchema,
  exportListQuerySchema,
  exportListResponseSchema,
  myDeletionRequestStatusResponseSchema,
  processDeletionRequestBodySchema,
  type CreateDeletionRequestBody,
  type ExportListQuery,
  type DeletionListQuery,
} from "./data-rights.dto";
import {
  completeDeletionRequest,
  processApprovedDeletionRequest,
} from "./data-rights-deletion-processor";
import {
  DATA_DELETION_PROCESSED_AUDIT,
  DATA_DELETION_REQUESTED_AUDIT,
  DATA_EXPORT_REQUESTED_AUDIT,
  DATA_EXPORT_REQUESTED_EVENT,
  dataExportRequestedPayloadSchema,
  exportScopeSchema,
} from "./data-rights.events";
import {
  deletionDuplicatePending,
  deletionRequestNotFound,
  exportEntitlementRequired,
  exportJobNotFound,
  invalidDeletionTarget,
} from "./data-rights.errors";
import { dataRightsRepository } from "./data-rights.repository";
import type { DeletionRequestRow, ExportJobRow, ServiceCtx } from "./data-rights.types";
import { DELETION_TARGET_TYPES } from "./data-rights.contract";
import { accessRemovalOutcomeSchema } from "./privacy-lifecycle.contract";

function mapExportErrorCode(errorJson: unknown): string | null {
  if (!errorJson || typeof errorJson !== "object" || Array.isArray(errorJson)) {
    return null;
  }
  const code = (errorJson as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function mapExportJobBaseDto(job: ExportJobRow) {
  const scope = exportScopeSchema.safeParse(job.scope_json);
  return exportJobDtoSchema.omit({ download: true }).parse({
    id: job.id,
    status: job.status,
    requestedByMembershipId: job.requested_by_membership_id,
    createdAt: job.created_at.toISOString(),
    updatedAt: job.updated_at.toISOString(),
    expiresAt: job.expires_at?.toISOString() ?? null,
    errorCode: mapExportErrorCode(job.error_json),
    scope: scope.success ? scope.data : null,
    completePersonalDataExport: false,
  });
}

function mapDeletionRequestDto(request: DeletionRequestRow) {
  const parsed = accessRemovalOutcomeSchema.safeParse(request.outcome_json);
  const outcome = request.status === "SUCCEEDED" && parsed.success ? parsed.data : null;
  return deletionRequestDtoSchema.parse({
    id: request.id,
    operation: "remove_school_access",
    outcome,
    completionMessage:
      request.status !== "SUCCEEDED"
        ? null
        : outcome
          ? "School access removed. Personal records remain; data erasure requires a separate review. Your shared login is unchanged."
          : "Legacy request completed. Data erasure was not verified; no detailed outcome was recorded.",
    status: request.status,
    targetType: request.target_type,
    targetId: request.target_id,
    requestedByMembershipId: request.requested_by_membership_id,
    reason: request.reason,
    scheduledAt: request.scheduled_at?.toISOString() ?? null,
    completedAt: request.completed_at?.toISOString() ?? null,
    createdAt: request.created_at.toISOString(),
    updatedAt: request.updated_at.toISOString(),
  });
}

const EXPORT_ENTITLEMENT_KEY = "data.export.enable";

/**
 * The capability gate: may this tenant use exports at all.
 *
 * Runs on the read paths too, so listing and fetching a job are gated the same
 * way as creating one.
 */
async function ensureExportEntitlement(tx: TenantTx, ctx: ServiceCtx): Promise<void> {
  try {
    await enforceEntitlement(tx, {
      tenantId: ctx.tenantId,
      key: EXPORT_ENTITLEMENT_KEY,
      requestId: ctx.requestId,
    });
  } catch {
    throw exportEntitlementRequired();
  }
}

/**
 * Charge one export against the tenant's plan (audit finding M11).
 *
 * Only requesting an export consumes anything — listing jobs and fetching one
 * back are reads, and metering those would charge a tenant repeatedly for a
 * single export they already paid for.
 *
 * Deliberately not routed through `ensureExportEntitlement`'s catch. That
 * converts every failure into `exportEntitlementRequired()`, which would report
 * an exhausted allowance as 403 "your plan does not include exports" when the
 * truth is 402 "your plan includes exports and you have used them all" — a
 * different problem with a different remedy. `EntitlementLimitExceededError`
 * carries the used/limit/period figures, so it is left to propagate intact.
 */
async function consumeExportAllowance(tx: TenantTx, ctx: ServiceCtx): Promise<void> {
  await consumeEntitlementUnits(tx, {
    tenantId: ctx.tenantId,
    key: EXPORT_ENTITLEMENT_KEY,
    requestId: ctx.requestId,
    units: 1,
  });
}

export async function listExportJobs(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  await ensureExportEntitlement(tx, ctx);
  const query: ExportListQuery = exportListQuerySchema.parse(rawQuery ?? {});
  const rows = await dataRightsRepository.listExportJobs(tx, {
    limit: query.limit,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;

  return exportListResponseSchema.parse({
    data: {
      items: pageRows.map(mapExportJobBaseDto),
      pageInfo: {
        nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function createExportJob(tx: TenantTx, ctx: ServiceCtx) {
  await ensureExportEntitlement(tx, ctx);
  // Charged before the job row is written: a request that cannot fit inside the
  // plan should not leave a queued export behind it.
  await consumeExportAllowance(tx, ctx);

  const scope = exportScopeSchema.parse({
    version: EXPORT_SCOPE_VERSION,
    domains: [...APPROVED_EXPORT_DOMAINS],
  });

  const created = await dataRightsRepository.insertExportJob(tx, {
    requestedByMembershipId: ctx.actorMembershipId,
    scopeJson: scope,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: DATA_EXPORT_REQUESTED_AUDIT,
      target: { type: "export_job", id: created.id },
      before: null,
      after: {
        status: created.status,
        scope,
      },
      reason: null,
      metadata: {},
    },
  );

  const payload = dataExportRequestedPayloadSchema.parse({
    exportJobId: created.id,
    requestedAt: new Date().toISOString(),
    requestedByMembershipId: ctx.actorMembershipId,
    schemaVersion: 1,
  });

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: DATA_EXPORT_REQUESTED_EVENT,
    aggregateType: "export_job",
    aggregateId: created.id,
    payload,
    idempotencyKey: ctx.idempotencyKey ?? `${ctx.requestId}:export:${created.id}`,
  });

  return createExportResponseSchema.parse({
    data: mapExportJobBaseDto(created),
  });
}

export async function getExportJob(tx: TenantTx, ctx: ServiceCtx, exportJobId: string) {
  await ensureExportEntitlement(tx, ctx);

  const job = await dataRightsRepository.findExportJobById(tx, exportJobId);
  if (!job || job.tenant_id !== ctx.tenantId) {
    throw exportJobNotFound();
  }

  const download = await resolveVerifiedExportDownload(ctx, job);

  return exportJobDetailResponseSchema.parse({
    data: {
      ...mapExportJobBaseDto(job),
      download,
    },
  });
}

export async function getMyDeletionRequestStatus(tx: TenantTx, ctx: ServiceCtx) {
  const pending = await dataRightsRepository.findPendingDeletionRequestForTarget(tx, {
    targetType: "membership",
    targetId: ctx.actorMembershipId,
  });

  return myDeletionRequestStatusResponseSchema.parse({
    data: {
      pending: pending != null,
    },
  });
}

export async function listDeletionRequests(tx: TenantTx, ctx: ServiceCtx, rawQuery: unknown) {
  const query: DeletionListQuery = deletionListQuerySchema.parse(rawQuery ?? {});
  const rows = await dataRightsRepository.listDeletionRequests(tx, {
    limit: query.limit,
    ...(query.status !== undefined ? { status: query.status } : {}),
    ...(query.cursor !== undefined ? { cursor: query.cursor } : {}),
  });

  const hasNextPage = rows.length > query.limit;
  const pageRows = hasNextPage ? rows.slice(0, query.limit) : rows;

  return deletionListResponseSchema.parse({
    data: {
      items: pageRows.map(mapDeletionRequestDto),
      pageInfo: {
        nextCursor: hasNextPage ? (pageRows.at(-1)?.id ?? null) : null,
        hasNextPage,
      },
    },
  });
}

export async function createDeletionRequest(tx: TenantTx, ctx: ServiceCtx, rawBody: unknown) {
  const body: CreateDeletionRequestBody = createDeletionRequestBodySchema.parse(rawBody);
  const targetMembershipId = body.targetMembershipId ?? ctx.actorMembershipId;

  if (!DELETION_TARGET_TYPES.includes("membership")) {
    throw invalidDeletionTarget();
  }

  await loadMembershipResourceRef({
    tx,
    tenantId: ctx.tenantId,
    membershipId: targetMembershipId,
  });

  const pending = await dataRightsRepository.findPendingDeletionRequestForTarget(tx, {
    targetType: "membership",
    targetId: targetMembershipId,
  });
  if (pending) {
    throw deletionDuplicatePending();
  }

  const created = await dataRightsRepository.insertDeletionRequest(tx, {
    requestedByMembershipId: ctx.actorMembershipId,
    targetType: "membership",
    targetId: targetMembershipId,
    reason: body.reason ?? null,
  });

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: DATA_DELETION_REQUESTED_AUDIT,
      target: { type: "deletion_request", id: created.id },
      before: null,
      after: {
        status: created.status,
        targetType: created.target_type,
        targetId: created.target_id,
      },
      reason: body.reason ?? null,
      metadata: {},
    },
  );

  return {
    data: mapDeletionRequestDto(created),
  };
}

export async function processDeletionRequest(
  tx: TenantTx,
  ctx: ServiceCtx,
  deletionRequestId: string,
  rawBody: unknown,
) {
  processDeletionRequestBodySchema.parse(rawBody);

  const request = await dataRightsRepository.findDeletionRequestById(tx, deletionRequestId, true);
  if (!request || request.tenant_id !== ctx.tenantId) {
    throw deletionRequestNotFound();
  }

  if (request.status === "SUCCEEDED") {
    return {
      data: mapDeletionRequestDto(request),
    };
  }

  const before = {
    status: request.status,
    targetType: request.target_type,
    targetId: request.target_id,
  };

  const outcome = await processApprovedDeletionRequest(tx, ctx, request);
  const completed = await completeDeletionRequest(tx, deletionRequestId, outcome);

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: DATA_DELETION_PROCESSED_AUDIT,
      target: { type: "deletion_request", id: completed.id },
      before,
      after: {
        status: completed.status,
        completedAt: completed.completed_at?.toISOString() ?? null,
        outcome,
      },
      reason: null,
      metadata: {},
    },
  );

  return {
    data: mapDeletionRequestDto(completed),
  };
}

export async function loadExportJobResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  exportJobId: string;
}) {
  const job = await dataRightsRepository.findExportJobById(args.tx, args.exportJobId);
  if (!job || job.tenant_id !== args.tenantId) {
    throw exportJobNotFound();
  }

  return createTenantResourceRef({
    type: "export_job",
    id: job.id,
    tenantId: args.tenantId,
    ownerMembershipId: job.requested_by_membership_id,
  });
}

export async function loadDeletionRequestResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  deletionRequestId: string;
}) {
  const request = await dataRightsRepository.findDeletionRequestById(
    args.tx,
    args.deletionRequestId,
  );
  if (!request || request.tenant_id !== args.tenantId) {
    throw deletionRequestNotFound();
  }

  return createTenantResourceRef({
    type: "deletion_request",
    id: request.id,
    tenantId: args.tenantId,
    ownerMembershipId: request.requested_by_membership_id,
  });
}

export async function loadDeletionRequestMembershipResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  actorMembershipId: string;
  input: { targetMembershipId?: string };
}) {
  const membershipId = args.input.targetMembershipId ?? args.actorMembershipId;
  return loadMembershipResourceRef({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId,
  });
}

export {
  mapExportJobBaseDto,
  mapDeletionRequestDto,
  ensureExportEntitlement,
  consumeExportAllowance,
};
