import type { TenantTx } from "@atlas/db";
import { assertTenantScopedPermissionKey, enforceNoGrantUp } from "@atlas/access";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";
import { permissionExists } from "@atlas/authorization";
import type { CreatePermissionOverrideBody } from "../schemas/access-admin";
import {
  deletePermissionOverrideById,
  insertPermissionOverride,
  listPermissionOverridesPaginated,
  permissionOverrideNotFound,
} from "../repositories/permission-override.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function listPermissionOverrides(
  tx: TenantTx,
  ctx: { tenantId: string },
  query: { membershipId?: string; limit?: number; cursor?: string },
) {
  const result = await listPermissionOverridesPaginated({
    tx,
    tenantId: ctx.tenantId,
    limit: query.limit ?? 25,
    ...(query.membershipId ? { membershipId: query.membershipId } : {}),
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  return {
    data: {
      items: result.items,
      pageInfo: result.pageInfo,
    },
  };
}

export async function createPermissionOverride(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: CreatePermissionOverrideBody,
) {
  assertTenantScopedPermissionKey(input.permissionKey);

  const permission = await permissionExists({
    tx,
    permissionKey: input.permissionKey,
  });

  if (!permission.exists) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "Permission key is invalid.",
    });
  }

  if (input.effect === "ALLOW") {
    await enforceNoGrantUp({
      tx,
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestedPermissionKeys: [input.permissionKey],
    });
  }

  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId: input.membershipId,
  });

  const created = await insertPermissionOverride({
    tx,
    tenantId: ctx.tenantId,
    membershipId: input.membershipId,
    permissionKey: input.permissionKey,
    effect: input.effect,
    reason: input.reason ?? null,
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
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
      action: "access.permission_override.created",
      target: { type: "permission_override", id: created.id },
      before: null,
      after: {
        membershipId: input.membershipId,
        permissionKey: input.permissionKey,
        effect: input.effect,
      },
      reason: input.reason ?? null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "permission.changed",
    aggregateType: "permission_override",
    aggregateId: created.id,
    payload: {
      tenantId: ctx.tenantId,
      overrideId: created.id,
      action: "created",
    },
    idempotencyKey: `${ctx.requestId}:override-created:${created.id}`,
  });

  return {
    data: created,
  };
}

export async function deletePermissionOverride(tx: TenantTx, ctx: ServiceCtx, overrideId: string) {
  const deleted = await deletePermissionOverrideById({
    tx,
    tenantId: ctx.tenantId,
    overrideId,
  });

  if (!deleted) {
    throw permissionOverrideNotFound();
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
      action: "access.permission_override.deleted",
      target: { type: "permission_override", id: overrideId },
      before: { id: overrideId },
      after: null,
      reason: null,
      metadata: {},
    },
  );

  await outbox.publish(tx, {
    ctx: {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestId: ctx.requestId,
    },
    eventType: "permission.changed",
    aggregateType: "permission_override",
    aggregateId: overrideId,
    payload: {
      tenantId: ctx.tenantId,
      overrideId,
      action: "deleted",
    },
    idempotencyKey: `${ctx.requestId}:override-deleted:${overrideId}`,
  });

  return {
    data: {
      id: overrideId,
      deleted: true as const,
    },
  };
}

export { permissionOverrideNotFound };
