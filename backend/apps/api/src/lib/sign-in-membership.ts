import type { TenantTx } from "@atlas/db";
import type { buildPublicAuthResponse } from "@atlas/domain-identity";
import { ensureSelfServiceLearnerMembership, findMembershipByPrincipal } from "@atlas/membership";
import { applyReferralForNewMembership } from "../server/sales-referrals/sales-referrals.service";

type SignInMembership = Parameters<typeof buildPublicAuthResponse>[0]["membership"];

/**
 * The membership a person signing in to an academy ends up with, for
 * `buildPublicAuthResponse`.
 *
 * Open self-service sign-up: someone fully signed in with no membership here
 * becomes an ACTIVE learner, and a referral is applied to a new membership. If
 * an invitation to their email is waiting instead, they get INVITED_MEMBERSHIP
 * and go on to accept it rather than "no access".
 *
 * Every sign-in path uses this: password, email confirmation, the MFA step and
 * Google. The Google callback had its own copy without the sign-up step, so a
 * new person who signed up with Google was turned away (launch plan 5.1,
 * staging, 6 November 2026).
 *
 * `provision` is false while a required MFA challenge is still pending, so
 * nothing is created before it's satisfied.
 */
export async function resolveSignInMembership(
  tx: TenantTx,
  args: {
    tenantId: string;
    principalId: string | null | undefined;
    email: string;
    provision: boolean;
  },
): Promise<SignInMembership> {
  if (!args.principalId) return null;

  const existing = await findMembershipByPrincipal({
    tx,
    tenantId: args.tenantId,
    authPrincipalId: args.principalId,
  });
  if (existing) return { id: existing.id, status: existing.status };
  if (!args.provision) return null;

  const provisioned = await ensureSelfServiceLearnerMembership({
    tx,
    tenantId: args.tenantId,
    authPrincipalId: args.principalId,
    email: args.email,
  });

  const membership = await findMembershipByPrincipal({
    tx,
    tenantId: args.tenantId,
    authPrincipalId: args.principalId,
  });
  if (membership) {
    if (provisioned?.created) {
      await applyReferralForNewMembership(tx, {
        refereeMembershipId: membership.id,
        emailNormalized: args.email,
      });
    }
    return { id: membership.id, status: membership.status };
  }

  return provisioned?.status === "INVITED"
    ? { id: provisioned.membershipId, status: "INVITED" }
    : null;
}
