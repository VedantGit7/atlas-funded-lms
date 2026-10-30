import { createHash } from "node:crypto";
import {
  activateInvitedMembership,
  findInvitedMembershipByTokenHash,
  findMembershipByPrincipal,
} from "./membership.repository";
import { createMemberProfileIfMissing } from "./member-profile.repository";
import { alreadyMember, invalidInvitation, invitationEmailMismatch } from "./membership-errors";
import { writeMembershipStatusAudit } from "./membership-audit.repository";
import type { AcceptInvitationInput } from "./schemas";

type Tx = Parameters<typeof findInvitedMembershipByTokenHash>[0]["tx"];

export function hashInvitationToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export async function previewInvitation(args: {
  tx: Tx;
  tenantId: string;
  token: string;
}): Promise<{ invitedEmail: string } | null> {
  const tokenHash = hashInvitationToken(args.token);

  const invited = await findInvitedMembershipByTokenHash({
    tx: args.tx,
    tenantId: args.tenantId,
    tokenHash,
  });

  if (!invited?.invitedEmailNormalized) {
    return null;
  }

  return { invitedEmail: invited.invitedEmailNormalized };
}

export async function acceptInvitation(args: {
  tx: Tx;
  tenantId: string;
  requestId: string;
  input: AcceptInvitationInput;
  principal: {
    id: string;
    emailNormalized: string;
  };
}) {
  const tokenHash = hashInvitationToken(args.input.token);

  const invited = await findInvitedMembershipByTokenHash({
    tx: args.tx,
    tenantId: args.tenantId,
    tokenHash,
  });

  if (!invited) {
    throw invalidInvitation();
  }

  if (
    invited.invitedEmailNormalized &&
    invited.invitedEmailNormalized !== args.principal.emailNormalized
  ) {
    throw invitationEmailMismatch();
  }

  // A principal has one membership per tenant. Accepting while holding one
  // failed on the unique key as an INTERNAL_ERROR (staging, 30 October 2026).
  const existing = await findMembershipByPrincipal({
    tx: args.tx,
    tenantId: args.tenantId,
    authPrincipalId: args.principal.id,
  });
  if (existing) {
    throw alreadyMember();
  }

  const activated = await activateInvitedMembership({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: invited.id,
    authPrincipalId: args.principal.id,
  });

  const profile = await createMemberProfileIfMissing({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: activated.id,
    displayName: null,
  });

  await writeMembershipStatusAudit({
    tx: args.tx,
    tenantId: args.tenantId,
    actorMembershipId: activated.id,
    targetMembershipId: activated.id,
    requestId: args.requestId,
    beforeStatus: "INVITED",
    afterStatus: "ACTIVE",
  });

  return {
    membership: {
      id: activated.id,
      status: "ACTIVE" as const,
    },
    profile,
  };
}
