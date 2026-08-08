import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "../shared/domain.types";
import {
  assignBatchMemberBodySchema,
  assignBatchMemberResponseSchema,
  batchListResponseSchema,
  batchResponseSchema,
  createBatchBodySchema,
  updateBatchBodySchema,
} from "./batches.dto";
import { batchNotFound } from "./batches.errors";
import { batchesRepository, type BatchRow } from "./batches.repository";

function toDto(row: BatchRow) {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    courseId: row.course_id,
    status: row.status as "ACTIVE" | "INACTIVE" | "ARCHIVED",
    createdAt: row.created_at.toISOString(),
  };
}

export async function createBatch(tx: TenantTx, _ctx: ServiceCtx, rawBody: unknown) {
  const body = createBatchBodySchema.parse(rawBody);
  const row = await batchesRepository.insertBatch(tx, {
    key: body.key,
    name: body.name,
    courseId: body.courseId ?? null,
    status: body.status,
    metadataJson: body.metadataJson,
  });
  return batchResponseSchema.parse({ data: toDto(row) });
}

export async function listBatches(tx: TenantTx, _ctx: ServiceCtx) {
  const rows = await batchesRepository.listBatches(tx);
  return batchListResponseSchema.parse({ data: { items: rows.map(toDto) } });
}

export async function getBatch(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const row = await batchesRepository.findBatchById(tx, batchId);
  if (!row) throw batchNotFound();
  return batchResponseSchema.parse({ data: toDto(row) });
}

export async function updateBatch(tx: TenantTx, _ctx: ServiceCtx, batchId: string, rawBody: unknown) {
  const body = updateBatchBodySchema.parse(rawBody);
  const row = await batchesRepository.updateBatch(tx, batchId, {
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.status !== undefined ? { status: body.status } : {}),
    ...(body.metadataJson !== undefined ? { metadataJson: body.metadataJson } : {}),
  });
  if (!row) throw batchNotFound();
  return batchResponseSchema.parse({ data: toDto(row) });
}

export async function deleteBatch(tx: TenantTx, _ctx: ServiceCtx, batchId: string) {
  const deleted = await batchesRepository.deleteBatch(tx, batchId);
  if (!deleted) throw batchNotFound();
  return { data: { deleted: true } };
}

export async function assignBatchMember(
  tx: TenantTx,
  _ctx: ServiceCtx,
  batchId: string,
  rawBody: unknown,
) {
  const body = assignBatchMemberBodySchema.parse(rawBody);
  const batch = await batchesRepository.findBatchById(tx, batchId);
  if (!batch) throw batchNotFound();

  const result = await batchesRepository.assignMember(tx, {
    batchId,
    membershipId: body.membershipId,
  });

  return assignBatchMemberResponseSchema.parse({
    data: {
      batchId,
      membershipId: body.membershipId,
      joinedAt: result.joined_at.toISOString(),
    },
  });
}
