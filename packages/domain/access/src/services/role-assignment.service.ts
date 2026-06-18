import type { TenantTx } from "@atlas/db";
import {
  assertRoleAssignRankGuard,
  assertRoleRevokeRankGuard,
  enforceNoGrantUp,
} from "@atlas/access";
import { auditWriter } from "@atlas/audit";
import { outbox } from "@atlas/events";
import { requireMembershipById } from "@atlas/membership/member-admin.repository";
import type { AssignRoleBody } from "../schemas/access-admin";
import {
  deleteUserRole,
  insertUserRole,
  listActorRoleKeys,
  listRolePermissionKeys,
  requireRoleById,
  roleNotFound,
} from "../repositories/role.repository";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

export async function assignRoleToMember(
  tx: TenantTx,
  ctx: ServiceCtx,
  membershipId: string,
  input: AssignRoleBody,
) {
  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const role = await requireRoleById({
    tx,
    tenantId: ctx.tenantId,
    roleId: input.roleId,
  });

  const actorRoleKeys = await listActorRoleKeys({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  assertRoleAssignRankGuard({
    actorRoleKeys,
    targetRoleKey: role.key,
  });

  const rolePermissions = await listRolePermissionKeys({
    tx,
    tenantId: ctx.tenantId,
    roleId: role.id,
  });

  await enforceNoGrantUp({
    tx,
    tenantId: ctx.tenantId,
    actorMembershipId: ctx.actorMembershipId,
    requestedPermissionKeys: rolePermissions,
  });

  const assignment = await insertUserRole({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleId: role.id,
    assignedByMembershipId: ctx.actorMembershipId,
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
      action: "access.role.assigned",
      target: { type: "user_role", id: assignment.id },
      before: null,
      after: {
        membershipId,
        roleId: role.id,
        roleKey: role.key,
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
    eventType: "role.assigned",
    aggregateType: "user_role",
    aggregateId: assignment.id,
    payload: {
      tenantId: ctx.tenantId,
      membershipId,
      roleId: role.id,
      roleKey: role.key,
    },
    idempotencyKey: `${ctx.requestId}:role-assigned:${membershipId}:${role.id}`,
  });

  return {
    data: {
      membershipId,
      role: {
        id: role.id,
        key: role.key,
        name: role.name,
        isSystem: role.isSystem,
      },
    },
  };
}

export async function revokeRoleFromMember(
  tx: TenantTx,
  ctx: ServiceCtx,
  membershipId: string,
  roleId: string,
) {
  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const role = await requireRoleById({
    tx,
    tenantId: ctx.tenantId,
    roleId,
  });

  const actorRoleKeys = await listActorRoleKeys({
    tx,
    tenantId: ctx.tenantId,
    membershipId: ctx.actorMembershipId,
  });

  assertRoleRevokeRankGuard({
    actorRoleKeys,
    targetRoleKey: role.key,
  });

  const revoked = await deleteUserRole({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleId,
  });

  if (!revoked) {
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
      action: "access.role.revoked",
      target: { type: "user_role", id: null },
      before: {
        membershipId,
        roleId: role.id,
        roleKey: role.key,
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
    eventType: "role.revoked",
    aggregateType: "user_role",
    aggregateId: role.id,
    payload: {
      tenantId: ctx.tenantId,
      membershipId,
      roleId: role.id,
      roleKey: role.key,
    },
    idempotencyKey: `${ctx.requestId}:role-revoked:${membershipId}:${role.id}`,
  });

  return {
    data: {
      membershipId,
      roleId: role.id,
      revoked: true as const,
    },
  };
}
