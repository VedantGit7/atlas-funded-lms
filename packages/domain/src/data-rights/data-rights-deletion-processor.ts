import type { TenantTx } from "@atlas/db";
import { removeMember } from "@atlas/membership";
import { deletionRequestInvalidState, invalidDeletionTarget } from "./data-rights.errors";
import { dataRightsRepository } from "./data-rights.repository";
import type { DeletionRequestRow, ServiceCtx } from "./data-rights.types";
import { DELETION_TARGET_TYPES } from "./data-rights.contract";

export async function processApprovedDeletionRequest(
  tx: TenantTx,
  ctx: ServiceCtx,
  request: DeletionRequestRow,
): Promise<void> {
  if (request.status !== "QUEUED") {
    throw deletionRequestInvalidState("This deletion request cannot be processed.");
  }

  if (
    !DELETION_TARGET_TYPES.includes(request.target_type as (typeof DELETION_TARGET_TYPES)[number])
  ) {
    throw invalidDeletionTarget();
  }

  if (request.target_type === "membership") {
    await removeMember(tx, ctx, request.target_id);
  }
}

export async function completeDeletionRequest(
  tx: TenantTx,
  deletionRequestId: string,
): Promise<DeletionRequestRow> {
  const updated = await dataRightsRepository.markDeletionRequestSucceeded(tx, deletionRequestId);
  if (!updated) {
    const existing = await dataRightsRepository.findDeletionRequestById(tx, deletionRequestId);
    if (existing?.status === "SUCCEEDED") {
      return existing;
    }
    throw deletionRequestInvalidState("This deletion request cannot be processed.");
  }
  return updated;
}
