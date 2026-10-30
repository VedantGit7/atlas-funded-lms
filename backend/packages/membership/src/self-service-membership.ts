import type { TenantTx } from "@atlas/db";
import { assignDefaultLearnerRole } from "@atlas/access";
import type { MembershipStatus } from "./types";
import {
  findMembershipByPrincipal,
  findPendingInvitationByEmail,
  insertActiveSelfServiceMembership,
} from "./membership.repository";
import { createMemberProfileIfMissing } from "./member-profile.repository";

export type SelfServiceMembershipResult = {
  membershipId: string;
  created: boolean;
  /** INVITED when an invitation to this email is waiting to be accepted. */
  status: MembershipStatus;
};

/**
 * Open self-service signup: turns a freshly authenticated principal with no
 * membership into an ACTIVE learner for the current tenant.
 *
 * Behaviour:
 * - If a membership already exists in ANY state (ACTIVE, INVITED, SUSPENDED,
 *   REMOVED), it is left untouched and returned with `created: false`. This
 *   guarantees we never reactivate a suspended/removed member and never bypass
 *   the invitation acceptance flow for an invited member.
 * - If a live invitation to this email is waiting, nothing is created and that
 *   invitation is returned (status INVITED). The invited row has no principal
 *   until it is accepted, so the check above misses it; without this, an
 *   invitee who signed in before accepting became a learner, and accepting
 *   then failed on the duplicate membership (staging, 30 October 2026).
 * - Otherwise a new ACTIVE membership is created, the default `learner` role is
 *   assigned, and a member profile is created with the provided display name.
 *
 * Must be called inside a tenant-scoped transaction (`withTenantTx`) so RLS
 * (`app.tenant_id`) and the membership/role/profile writes are correctly scoped.
 */
export async function ensureSelfServiceLearnerMembership(args: {
  tx: TenantTx;
  tenantId: string;
  authPrincipalId: string;
  email: string;
  displayName?: string | null;
}): Promise<SelfServiceMembershipResult | null> {
  const existing = await findMembershipByPrincipal({
    tx: args.tx,
    tenantId: args.tenantId,
    authPrincipalId: args.authPrincipalId,
  });

  if (existing) {
    return { membershipId: existing.id, created: false, status: existing.status };
  }

  const invitation = await findPendingInvitationByEmail({
    tx: args.tx,
    tenantId: args.tenantId,
    email: args.email,
  });

  if (invitation) {
    return { membershipId: invitation.id, created: false, status: "INVITED" };
  }

  const inserted = await insertActiveSelfServiceMembership({
    tx: args.tx,
    tenantId: args.tenantId,
    authPrincipalId: args.authPrincipalId,
    email: args.email,
  });

  if (!inserted) {
    // A concurrent request created the membership between our read and insert.
    const current = await findMembershipByPrincipal({
      tx: args.tx,
      tenantId: args.tenantId,
      authPrincipalId: args.authPrincipalId,
    });
    return current ? { membershipId: current.id, created: false, status: current.status } : null;
  }

  await assignDefaultLearnerRole({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: inserted.id,
  });

  await createMemberProfileIfMissing({
    tx: args.tx,
    tenantId: args.tenantId,
    membershipId: inserted.id,
    displayName: args.displayName ?? null,
  });

  return { membershipId: inserted.id, created: true, status: "ACTIVE" };
}
