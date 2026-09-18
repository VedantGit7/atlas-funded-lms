import { randomBytes } from "node:crypto";
import type { TenantTx } from "@atlas/db";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { assertTargetIsNotOwner, assignDefaultLearnerRole } from "@atlas/access";
import { auditWriter } from "@atlas/audit";
import { createTenantResourceRef } from "@atlas/authorization";
import { outbox } from "@atlas/events";
import { hashInvitationToken } from "./invitation.service";
import {
  findMemberProfileRecord,
  getMemberStatsForTenant,
  insertInvitedMembership,
  listMembersPaginated,
  listMembershipRoles,
  membershipHasRoleKey,
  memberNotFound,
  refreshInviteTokenRecord,
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
import { INVITE_EXPIRY_DAYS } from "./schemas/admin-members";
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
    timezone?: string | null;
    profileVisibility?: "PUBLIC" | "PRIVATE";
  } | null,
) {
  if (!profile) return null;
  return {
    id: profile.id,
    displayName: profile.displayName,
    avatarUrl: profile.avatarUrl,
    bio: profile.bio ?? null,
    timezone: profile.timezone ?? null,
    profileVisibility: profile.profileVisibility ?? "PUBLIC",
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
        accountEmail: item.accountEmail,
        joinedAt: item.joinedAt?.toISOString() ?? null,
        lastActiveAt: item.lastActiveAt?.toISOString() ?? null,
        archivedAt: item.archivedAt?.toISOString() ?? null,
        profile: item.profile
          ? {
              id: item.profile.id,
              displayName: item.profile.displayName,
              avatarUrl: item.profile.avatarUrl,
            }
          : null,
        roles: item.roles,
      })),
      pageInfo: result.pageInfo,
      totalCount: result.totalCount,
    },
  };
}

const ACTIVE_NOW_WINDOW_MINUTES = 5;

export async function getMemberStats(tx: TenantTx, ctx: { tenantId: string }) {
  const stats = await getMemberStatsForTenant({
    tx,
    tenantId: ctx.tenantId,
    activeWindowMinutes: ACTIVE_NOW_WINDOW_MINUTES,
  });

  return { data: stats };
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

type InviteMemberResult = {
  data: {
    id: string;
    status: "INVITED";
    invitedEmail: string;
    inviteExpiresAt: string;
  };
  inviteToken: string;
};

export async function inviteMember(
  tx: TenantTx,
  ctx: ServiceCtx,
  input: InviteMemberBody,
): Promise<InviteMemberResult> {
  const inviteToken = randomBytes(32).toString("base64url");
  const inviteTokenHash = hashInvitationToken(inviteToken);
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

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
    inviteToken,
  };
}

export async function resendInvite(
  tx: TenantTx,
  ctx: ServiceCtx,
  membershipId: string,
): Promise<InviteMemberResult> {
  const before = await requireMembershipById({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
  });

  if (before.status !== "INVITED") {
    throw new AtlasHttpError({
      code: "VALIDATION_ERROR",
      status: 409,
      message: "Only invited members can have their invitation resent.",
    });
  }

  const inviteToken = randomBytes(32).toString("base64url");
  const inviteTokenHash = hashInvitationToken(inviteToken);
  const inviteExpiresAt = new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

  const updated = await refreshInviteTokenRecord({
    tx,
    tenantId: ctx.tenantId,
    membershipId,
    inviteTokenHash,
    inviteExpiresAt,
  });

  if (!updated) {
    throw memberNotFound();
  }

  const invitedEmail = updated.invitedEmail ?? before.invitedEmail ?? "";

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
      target: { type: "membership", id: membershipId },
      before: { status: "INVITED" },
      after: {
        status: "INVITED",
        invitedEmail,
      },
      reason: null,
      metadata: { resent: true },
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
    aggregateId: membershipId,
    payload: {
      tenantId: ctx.tenantId,
      membershipId,
      status: "INVITED",
    },
    idempotencyKey: `${ctx.requestId}:membership-invite-resent:${membershipId}`,
  });

  return {
    data: {
      id: updated.id,
      status: "INVITED" as const,
      invitedEmail,
      inviteExpiresAt: updated.inviteExpiresAt.toISOString(),
    },
    inviteToken,
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
      timezone: profile.timezone,
      profileVisibility: profile.profileVisibility,
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
    ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
    ...(input.profileVisibility !== undefined
      ? { profileVisibility: input.profileVisibility }
      : {}),
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
      timezone: updated.timezone,
      profileVisibility: updated.profileVisibility,
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
