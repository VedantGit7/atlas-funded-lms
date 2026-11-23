import { AtlasHttpError } from "@atlas/core/http/errors";
import type { TenantTx } from "@atlas/db";
import type { ServiceCtx } from "@atlas/domain/shared/domain.types";
import { assertTargetIsNotOwner } from "@atlas/access";
import { auditWriter } from "@atlas/audit";
import {
  membershipHasRoleKey,
  requireMembershipById,
} from "@atlas/membership/member-admin.repository";
import {
  archiveOwnMembership,
  unarchiveOwnMembership,
} from "@atlas/membership/member-self-archive.service";
import { manageLearnerArchiveResponseSchema } from "./manage-learners.schemas";

export async function archiveManageLearner(tx: TenantTx, ctx: ServiceCtx, membershipId: string) {
  const hasOwner = await membershipHasRoleKey({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleKey: "owner",
  });
  assertTargetIsNotOwner(hasOwner);

  // This is the learner archive: admins are managed on the Members page, and
  // archiving one from here could lock the academy out (QA review 1 M12).
  const hasAdmin = await membershipHasRoleKey({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleKey: "admin",
  });
  if (hasAdmin) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Admins can't be archived as learners. Change their role on the Members page first.",
    });
  }

  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const result = await archiveOwnMembership({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  if (!result.archivedAt) {
    throw new AtlasHttpError({
      code: "PERMISSION_DENIED",
      status: 404,
      message: "Learner not found.",
    });
  }

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "identity.membership.archived",
      target: { type: "membership", id: membershipId },
      before: { archivedAt: null },
      after: { archivedAt: result.archivedAt },
      reason: null,
      metadata: {},
    },
  );

  return manageLearnerArchiveResponseSchema.parse({
    data: { id: membershipId, archivedAt: result.archivedAt },
  });
}

export async function unarchiveManageLearner(tx: TenantTx, ctx: ServiceCtx, membershipId: string) {
  const hasOwner = await membershipHasRoleKey({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleKey: "owner",
  });
  assertTargetIsNotOwner(hasOwner);

  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const result = await unarchiveOwnMembership({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
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
      action: "identity.membership.unarchived",
      target: { type: "membership", id: membershipId },
      before: { archivedAt: "set" },
      after: { archivedAt: null },
      reason: null,
      metadata: {},
    },
  );

  return manageLearnerArchiveResponseSchema.parse({
    data: { id: membershipId, archivedAt: result.archivedAt },
  });
}
