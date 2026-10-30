import { createHash, randomBytes } from "node:crypto";
import type { PlatformTx } from "@atlas/db";
import { auditWriter } from "@atlas/audit";
import { AtlasHttpError } from "@atlas/core/http/errors";
import { readPlatformTenantDetail } from "./platform-tenant-read.service";

type OwnerInvitationCtx = {
  platformPrincipalId: string;
  requestId: string;
  reason: string;
};

/** Hostnames that only resolve on a developer's machine. */
function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".test") ||
    hostname.endsWith(".localhost.test")
  );
}

function conflict(message: string): never {
  throw new AtlasHttpError({ code: "VALIDATION_ERROR", status: 409, message });
}

/**
 * Issues a fresh invitation to the tenant's owner, for the console's "Send
 * owner invitation". Provisioning creates the owner's invitation (with the
 * owner role) but cannot deliver it: a new tenant has no live domain for the
 * link. This replaces the token, so any earlier link stops working, and
 * returns what the caller emails. The link uses the tenant's active primary
 * domain, which is where the owner signs in.
 */
export async function issueTenantOwnerInvitation(
  tx: PlatformTx,
  ctx: OwnerInvitationCtx,
  tenantId: string,
  options: { allowLocalHostnames: boolean },
) {
  const { data: tenant } = await readPlatformTenantDetail(tx, tenantId);

  if (tenant.state !== "ACTIVE") {
    conflict("Only an active tenant's owner can be invited.");
  }
  const hostname = tenant.primaryDomain?.status === "ACTIVE" ? tenant.primaryDomain.hostname : null;
  if (!hostname || (!options.allowLocalHostnames && isLocalHostname(hostname))) {
    conflict("This tenant has no live domain yet. Activate its domain and make it primary first.");
  }

  const owners = await tx.$queryRaw<Array<{ id: string; invited_email_normalized: string }>>`
    SELECT m.id::text, m.invited_email_normalized
    FROM memberships m
    JOIN user_roles ur ON ur.membership_id = m.id AND ur.tenant_id = m.tenant_id
    JOIN roles r ON r.id = ur.role_id AND r.tenant_id = m.tenant_id
    WHERE m.tenant_id = ${tenantId}::uuid
      AND m.status = 'INVITED'
      AND r.key = 'owner'
    ORDER BY m.created_at ASC
    LIMIT 1
  `;
  const owner = owners[0];
  if (!owner) {
    conflict("This tenant has no pending owner invitation. Its owner may already have joined.");
  }

  const inviteToken = randomBytes(32).toString("base64url");
  const inviteTokenHash = createHash("sha256").update(inviteToken, "utf8").digest("hex");
  const expires = await tx.$queryRaw<Array<{ invite_expires_at: Date }>>`
    UPDATE memberships
    SET invite_token_hash = ${inviteTokenHash},
        invite_expires_at = now() + interval '7 days',
        updated_at = now()
    WHERE id = ${owner.id}::uuid
      AND tenant_id = ${tenantId}::uuid
    RETURNING invite_expires_at
  `;

  await auditWriter.write(
    tx,
    {
      tenantId,
      actorMembershipId: null,
      platformPrincipalId: ctx.platformPrincipalId,
      requestId: ctx.requestId,
    },
    {
      action: "tenant.owner_invitation.sent",
      target: { type: "membership", id: owner.id },
      before: null,
      after: { hostname },
      reason: ctx.reason,
      metadata: {},
    },
  );

  return {
    email: owner.invited_email_normalized,
    inviteUrl: `https://${hostname}/invite/accept?token=${encodeURIComponent(inviteToken)}`,
    hostname,
    expiresAt: expires[0]?.invite_expires_at ?? null,
  };
}
