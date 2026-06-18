import { randomBytes } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { assertTargetIsNotOwner, assignDefaultLearnerRole } from "@atlas/access";
import { auditWriter } from "@atlas/audit";
import { createTenantResourceRef } from "@atlas/authorization";
import { outbox } from "@atlas/events";
import { hashInvitationToken } from "./invitation.service";
import {
  findMemberProfileRecord,
  insertInvitedMembership,
  listMembersPaginated,
  listMembershipRoles,
  membershipHasRoleKey,
  memberNotFound,
  removeMembershipRecord,
  requireMembershipById,
  suspendMembershipRecord,
  updateMemberProfileRecord,
} from "./member-admin.repository";
import type {
  InviteMemberBody,
  MemberListQuery,
  UpdateMemberProfileBody,
} from "./schemas/admin-members";
import { membershipStatusSchema } from "./schemas";

type ServiceCtx = {
  tenantId: string;
  actorMembershipId: string;
  requestId: string;
};

function mapProfile(
  profile: {
    id: string;
    displayName: string | null;
    avatarUrl: string | null;
    bio?: string | null;
  } | null,
) {
  if (!profile) return null;
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio ?? null,
  };
}

export async function listMembers(tx: TenantTx, ctx: { tenantId: string }, query: MemberListQuery) {
  const result = await listMembersPaginated({
    tx,
    tenantId: ctx.tenantId,
    query,
  });

  return {
    data: {
      items: result.items.map((item) => ({
        id: item.id,
        status: membershipStatusSchema.parse(item.status),
        invitedEmail: item.invitedEmail,
        profile: item.profile
          ? {
              id: item.profile.id,
              displayName: item.profile.displayName,
              avatarUrl: item.profile.avatarUrl,
            }
          : null,
      })),
      pageInfo: result.pageInfo,
    },
  };
}

export async function getMember(tx: TenantTx, ctx: { tenantId: string }, membershipId: string) {
  const membership = await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const [profile, roles] = await Promise.all([
    findMemberProfileRecord({
      tx,
      tenantId: ctx.tenantId,
      membershipId,
    }),
    listMembershipRoles({
      tx,
      tenantId: ctx.tenantId,
      membershipId,
    }),
  ]);

  return {
    data: {
      id: membership.id,
      status: membershipStatusSchema.parse(membership.status),
      invitedEmail: membership.invitedEmail,
      joinedAt: membership.joinedAt?.toISOString() ?? null,
      suspendedAt: membership.suspendedAt?.toISOString() ?? null,
      removedAt: membership.removedAt?.toISOString() ?? null,
      profile: mapProfile(profile),
      roles,
    },
  };
}

export async function inviteMember(tx: TenantTx, ctx: ServiceCtx, input: InviteMemberBody) {
  const inviteToken = randomBytes(32).toString("base64url");
  const inviteTokenHash = hashInvitationToken(inviteToken);
  const inviteExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const created = await insertInvitedMembership({
    tx,
    tenantId: ctx.tenantId,
    emailNormalized: input.email,
    inviteTokenHash,
    inviteExpiresAt,
  });

  await assignDefaultLearnerRole({
    tx,
    tenantId: ctx.tenantId,
    membershipId: created.id,
  });

  if (input.displayName) {
    await updateMemberProfileRecord({
      tx,
      tenantId: ctx.tenantId,
      membershipId: created.id,
      displayName: input.displayName,
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
      action: "identity.membership.invited",
      target: { type: "membership", id: created.id },
      before: null,
      after: {
        status: "INVITED",
        invitedEmail: input.email,
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
    eventType: "membership.created",
    aggregateType: "membership",
    aggregateId: created.id,
    payload: {
      tenantId: ctx.tenantId,
      membershipId: created.id,
      status: "INVITED",
    },
    idempotencyKey: `${ctx.requestId}:membership-invited:${created.id}`,
  });

  return {
    data: {
      id: created.id,
      status: "INVITED" as const,
      invitedEmail: input.email,
      inviteExpiresAt: inviteExpiresAt.toISOString(),
    },
  };
}

export async function suspendMember(tx: TenantTx, ctx: ServiceCtx, membershipId: string) {
  const hasOwner = await membershipHasRoleKey({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleKey: "owner",
  });
  assertTargetIsNotOwner(hasOwner);

  const before = await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const updated = await suspendMembershipRecord({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  if (!updated) {
    throw memberNotFound();
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
      action: "identity.membership.status_changed",
      target: { type: "membership", id: membershipId },
      before: { status: before.status },
      after: { status: "SUSPENDED" },
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
    eventType: "membership.status_changed",
    aggregateType: "membership",
    aggregateId: membershipId,
    payload: {
      tenantId: ctx.tenantId,
      membershipId,
      beforeStatus: before.status,
      afterStatus: "SUSPENDED",
    },
    idempotencyKey: `${ctx.requestId}:membership-suspended:${membershipId}`,
  });

  return {
    data: {
      id: updated.id,
      status: "SUSPENDED" as const,
      suspendedAt: updated.suspendedAt.toISOString(),
    },
  };
}

export async function removeMember(tx: TenantTx, ctx: ServiceCtx, membershipId: string) {
  const hasOwner = await membershipHasRoleKey({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    roleKey: "owner",
  });
  assertTargetIsNotOwner(hasOwner);

  const before = await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const updated = await removeMembershipRecord({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  if (!updated) {
    throw memberNotFound();
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
      action: "identity.membership.status_changed",
      target: { type: "membership", id: membershipId },
      before: { status: before.status },
      after: { status: "REMOVED" },
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
    eventType: "membership.status_changed",
    aggregateType: "membership",
    aggregateId: membershipId,
    payload: {
      tenantId: ctx.tenantId,
      membershipId,
      beforeStatus: before.status,
      afterStatus: "REMOVED",
    },
    idempotencyKey: `${ctx.requestId}:membership-removed:${membershipId}`,
  });

  return {
    data: {
      id: updated.id,
      status: "REMOVED" as const,
      removedAt: updated.removedAt.toISOString(),
    },
  };
}

export async function getMemberProfile(
  tx: TenantTx,
  ctx: { tenantId: string },
  membershipId: string,
) {
  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const profile = await findMemberProfileRecord({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  if (!profile) {
    throw memberNotFound();
  }

  return {
    data: mapProfile(profile) ?? {
      id: profile.id,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      bio: profile.bio,
    },
  };
}

export async function updateMemberProfile(
  tx: TenantTx,
  ctx: ServiceCtx,
  membershipId: string,
  input: UpdateMemberProfileBody,
) {
  await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const before = await findMemberProfileRecord({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  const updated = await updateMemberProfileRecord({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
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
      action: "identity.profile.updated",
      target: { type: "member_profile", id: updated.id },
      before: before
        ? {
            displayName: before.displayName,
            bio: before.bio,
          }
        : null,
      after: {
        displayName: updated.displayName,
        bio: updated.bio,
      },
      reason: null,
      metadata: { membershipId },
    },
  );

  return {
    data: mapProfile(updated) ?? {
      id: updated.id,
      displayName: updated.displayName,
      avatarUrl: updated.avatarUrl,
      bio: updated.bio,
    },
  };
}

export async function loadMembershipResourceRef(args: {
  tx: TenantTx;
  tenantId: string;
  membershipId: string;
}) {
  const membership = await findMembershipByIdSafe(args);
  return createTenantResourceRef({
    type: "membership",
    id: membership.id,
    tenantId: args.tenantId,
    ownerMembershipId: membership.id,
  });
}

async function findMembershipByIdSafe(args: {
  tx: TenantTx;
  tenantId: string;
  membershipId: string;
}) {
  const membership = await requireMembershipById(args);
  return membership;
}

// re-export for resource loaders
export { memberNotFound };
