import type { TenantTx } from "@atlas/db";
import {
  assertRoleEditGuard,
  assertSystemRoleDeleteGuard,
  assertTenantScopedPermissionKeys,
  enforceNoGrantUp,
} from "@atlas/access";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import type { CreateRoleBody, UpdateRoleBody } from "../schemas/access-admin";
import {
  findRoleByKey,
  insertCustomRole,
  listRolePermissionKeys,
  listRolesPaginated,
  mapRoleView,
  permissionKeysExist,
  replaceRolePermissions,
  requireRoleById,
  roleNotFound,
  softDeleteRole,
  updateRoleMetadata,
} from "../repositories/role.repository";
import { listActorRoleKeys } from "../repositories/role.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

async function validatePermissionCatalogue(tx: TenantTx, keys: readonly string[]) {
  assertTenantScopedPermissionKeys(keys);
  const exists = await permissionKeysExist({ tx, permissionKeys: keys });
  if (!exists) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 400,
      message: "One or more permission keys are invalid.",
    });
  }
}

export async function listRoles(
  tx: TenantTx,
  ctx: { tenantId: string },
  query: { limit?: number; cursor?: string },
) {
  const limit = query.limit ?? 25;
  const result = await listRolesPaginated({
    tx,
    tenantId: ctx.tenantId,
    limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
  });

  const items = await Promise.all(
    result.items.map(async (role) => {
      const permissions = await listRolePermissionKeys({
        tx,
        tenantId: ctx.tenantId,
        roleId: role.id,
      });
      return mapRoleView(role, permissions);
    }),
  );

  return {
    data: {
      items,
      pageInfo: result.pageInfo,
    },
  };
}

export async function getRoleById(
  tx: TenantTx,
  ctx: { tenantId: string },
  roleId: string,
) {
  const role = await requireRoleById({
    tx,
    tenantId: ctx.tenantId,
    roleId,
  });

  const permissions = await listRolePermissionKeys({
    tx,
    tenantId: ctx.tenantId,
    roleId: role.id,
  });

  return {
    data: mapRoleView(role, permissions),
  };
}

export async function createRole(tx: TenantTx, ctx: ServiceCtx, input: CreateRoleBody) {
  await validatePermissionCatalogue(tx, input.permissions);
  await enforceNoGrantUp({
    tx,
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    requestedPermissionKeys: input.permissions,
  });

  const existing = await findRoleByKey({
    tx,
    tenantId: ctx.tenantId,
    roleKey: input.key,
  });

  if (existing) {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "A role with this key already exists.",
    });
  }

  const role = await insertCustomRole({
    tx,
    tenantId: ctx.tenantId,
    key: input.key,
    name: input.name,
  });

  await replaceRolePermissions({
    tx,
    tenantId: ctx.tenantId,
    roleId: role.id,
    permissionKeys: input.permissions,
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
      action: "access.role.created",
      target: { type: "role", id: role.id },
      before: null,
      after: {
        key: role.key,
        permissions: input.permissions,
      },
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
    aggregateType: "role",
    aggregateId: role.id,
    payload: {
      tenantId: ctx.tenantId,
      roleId: role.id,
      action: "created",
    },
    idempotencyKey: `${ctx.requestId}:role-created:${role.id}`,
  });

  return {
    data: mapRoleView(role, input.permissions),
  };
}

export async function updateRole(
  tx: TenantTx,
  ctx: ServiceCtx,
  roleId: string,
  input: UpdateRoleBody,
) {
  const role = await requireRoleById({ tx, tenantId: ctx.tenantId, roleId });
  const actorRoleKeys = await listActorRoleKeys({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  assertRoleEditGuard({
    actorRoleKeys,
    roleKey: role.key,
    isSystem: role.isSystem,
  });

  const beforePermissions = await listRolePermissionKeys({
    tx,
    tenantId: ctx.tenantId,
    roleId,
  });

  if (input.permissions) {
    await validatePermissionCatalogue(tx, input.permissions);
    await enforceNoGrantUp({
      tx,
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      requestedPermissionKeys: input.permissions,
    });

    await replaceRolePermissions({
      tx,
      tenantId: ctx.tenantId,
      roleId,
      permissionKeys: input.permissions,
    });
  }

  const updated =
    input.name != null
      ? await updateRoleMetadata({
          tx,
          tenantId: ctx.tenantId,
          roleId,
          name: input.name,
        })
      : role;

  if (!updated) {
    throw roleNotFound();
  }

  const afterPermissions =
    input.permissions ??
    (await listRolePermissionKeys({
      tx,
      tenantId: ctx.tenantId,
      roleId,
    }));

  await auditWriter.write(
    tx,
    {
      tenantId: ctx.tenantId,
      actorMembershipId: ctx.actorMembershipId,
      platformPrincipalId: null,
      requestId: ctx.requestId,
    },
    {
      action: "access.role.updated",
      target: { type: "role", id: roleId },
      before: {
        name: role.name,
        permissions: beforePermissions,
      },
      after: {
        name: updated.name,
        permissions: afterPermissions,
      },
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
    aggregateType: "role",
    aggregateId: roleId,
    payload: {
      tenantId: ctx.tenantId,
      roleId,
      action: "updated",
    },
    idempotencyKey: `${ctx.requestId}:role-updated:${roleId}`,
  });

  return {
    data: mapRoleView(updated, afterPermissions),
  };
}

export async function deleteRole(tx: TenantTx, ctx: ServiceCtx, roleId: string) {
  const role = await requireRoleById({ tx, tenantId: ctx.tenantId, roleId });
  assertSystemRoleDeleteGuard(role.isSystem);

  const permissions = await listRolePermissionKeys({
    tx,
    tenantId: ctx.tenantId,
    roleId,
  });

  const deleted = await softDeleteRole({
    tx,
    tenantId: ctx.tenantId,
    roleId,
  });

  if (!deleted) {
    throw roleNotFound();
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
      action: "access.role.deleted",
      target: { type: "role", id: roleId },
      before: {
        key: role.key,
        permissions,
      },
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
    aggregateType: "role",
    aggregateId: roleId,
    payload: {
      tenantId: ctx.tenantId,
      roleId,
      action: "deleted",
    },
    idempotencyKey: `${ctx.requestId}:role-deleted:${roleId}`,
  });

  return {
    data: mapRoleView(deleted, permissions),
  };
}

export { roleNotFound };
