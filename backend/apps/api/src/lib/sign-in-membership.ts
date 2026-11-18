import type { TenantTx } from "@atlas/db";
import type { buildPublicAuthResponse } from "@atlas/domain-identity";
import {
  ensureSelfServiceLearnerMembership,
  findMembershipByPrincipal,
  findPendingInvitationByEmail,
} from "@atlas/membership";
import { applyReferralForNewMembership } from "../server/sales-referrals/sales-referrals.service";
import {
  hasLegalAcceptance,
  recordLegalAcceptance,
  type LegalConsent,
} from "../server/tenant-settings/legal-acceptance.service";

type SignInMembership = Parameters<typeof buildPublicAuthResponse>[0]["membership"];

export type SignInMembershipResult = {
  membership: SignInMembership;
  /**
   * The person has not agreed to this academy's Terms and Privacy Policy:
   * either they have no membership here and gave no consent, so none was
   * opened, or their membership predates the agreement. They are sent to the
   * join page to agree first.
   */
  termsRequired: boolean;
};

/**
 * The membership a person signing in to an academy ends up with, for
 * `buildPublicAuthResponse`.
 *
 * Open self-service sign-up: someone fully signed in with no membership here
 * becomes an ACTIVE learner, but only with `consent`, the "I agree" they
 * ticked on the sign-up form, before Google sign-up, or on the join page
 * (launch plan 5.7). Without it nothing is created and `termsRequired` is set.
 * The agreement is recorded with the membership, and a referral is applied to
 * a new one. If an invitation to their email is waiting instead, they get
 * INVITED_MEMBERSHIP and agree when they accept it.
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
    consent?: LegalConsent | null | undefined;
  },
): Promise<SignInMembershipResult> {
  if (!args.principalId) return { membership: null, termsRequired: false };
  const consent = args.consent ?? null;

  const existing = await findMembershipByPrincipal({
    tx,
    tenantId: args.tenantId,
    authPrincipalId: args.principalId,
  });
  if (existing) {
    const membership = { id: existing.id, status: existing.status };
    if (existing.status !== "ACTIVE") return { membership, termsRequired: false };
    if (await hasLegalAcceptance(tx, { tenantId: args.tenantId, membershipId: existing.id })) {
      return { membership, termsRequired: false };
    }
    // A membership opened before agreement was required (or by an operator)
    // takes the agreement now if the person just gave it, and otherwise asks.
    if (consent && args.provision) {
      await recordLegalAcceptance(tx, {
        tenantId: args.tenantId,
        membershipId: existing.id,
        consent,
      });
      return { membership, termsRequired: false };
    }
    return { membership, termsRequired: true };
  }
  if (!args.provision) return { membership: null, termsRequired: false };

  if (!consent) {
    // No account is opened without agreement. An invitation still waits for
    // its acceptance page, which asks for the agreement itself.
    const invitation = await findPendingInvitationByEmail({
      tx,
      tenantId: args.tenantId,
      email: args.email,
    });
    return invitation
      ? { membership: { id: invitation.id, status: "INVITED" }, termsRequired: false }
      : { membership: null, termsRequired: true };
  }

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
      await recordLegalAcceptance(tx, {
        tenantId: args.tenantId,
        membershipId: membership.id,
        consent,
      });
      await applyReferralForNewMembership(tx, {
        refereeMembershipId: membership.id,
        emailNormalized: args.email,
      });
    }
    return { membership: { id: membership.id, status: membership.status }, termsRequired: false };
  }

  return {
    membership:
      provisioned?.status === "INVITED"
        ? { id: provisioned.membershipId, status: "INVITED" }
        : null,
    termsRequired: false,
  };
}
